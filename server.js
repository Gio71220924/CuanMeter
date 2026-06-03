/**
 * CuanMeter - Unified Dev Server
 * =================================
 * Jalankan : npm start  (atau: node server.js)
 * Port     : 3000
 *
 * Menggabungkan:
 *  1. Static file server  → serve semua file HTML/CSS/JS/gambar
 *  2. GET /search         → proxy TradingView symbol search (IDX)
 *  3. GET /price          → proxy TradingView real-time quote
 *  4. Auto-open browser   → buka Analyzer.html otomatis saat start
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec, spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;           // folder server.js berada
const DEFAULT = '/index.html';   // halaman yang dibuka otomatis
const DATA_DIR = path.join(ROOT, 'data');
const CALENDAR_CACHE_FILE = path.join(DATA_DIR, 'calendar-cache.json');
const CALENDAR_CACHE_VERSION = 10;
const HEATMAP_CACHE_FILE = path.join(DATA_DIR, 'heatmap-cache.json');
const HEATMAP_TTL_MS = 10 * 60 * 1000;
let heatmapCache = null; // { data, cachedAt }
const KSEI_DETAIL_PAGE_LIMIT = 80;
const KSEI_EVENT_LIMIT = 160;
const KSEI_RETRY_COUNT = 2;
const KSEI_RETRY_DELAY_MS = 450;
const KSEI_MIN_CORPORATE_EVENTS = 2;
const CALENDAR_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const MACRO_WINDOW_PAST_DAYS   = 30;
const MACRO_WINDOW_FUTURE_DAYS = 90;
let calendarRefreshInFlight = null;
let calendarRefreshBlockedUntil = 0;
let calendarLastRefreshError = null;

// ─── MIME types ──────────────────────────────────────────────────────────────
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webmanifest': 'application/manifest+json',
};

// ─── Helper: HTTPS request to TradingView ────────────────────────────────────
function tvRequest(opts, body, callback) {
    let done = false;
    const cb = (err, data, status) => {
        if (done) return;       // guard: callback hanya boleh dipanggil sekali
        done = true;
        callback(err, data, status);
    };
    const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try { cb(null, JSON.parse(data), res.statusCode); }
            catch (e) { cb(new Error('Parse error: ' + e.message)); }
        });
    });
    req.on('error', cb);
    req.setTimeout(8000, () => { req.destroy(); cb(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
}

function httpsGetRaw(hostname, requestPath, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname,
            path: requestPath,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/json,*/*',
            },
        }, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode} ${hostname}${requestPath}`));
                    return;
                }
                resolve(data);
            });
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Timeout ${hostname}${requestPath}`));
        });
        req.end();
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientNetworkError(error) {
    const msg = (error?.message || '').toLowerCase();
    return (
        msg.includes('socket hang up')
        || msg.includes('timeout')
        || msg.includes('econnreset')
        || msg.includes('etimedout')
        || msg.includes('eai_again')
        || msg.includes('network')
        || msg.includes('500')
        || msg.includes('502')
        || msg.includes('503')
        || msg.includes('504')
    );
}

async function httpsGetRawWithRetry(hostname, requestPath, options = {}) {
    const {
        retries = KSEI_RETRY_COUNT,
        timeout = 20000,
        delayMs = KSEI_RETRY_DELAY_MS,
    } = options;

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await httpsGetRaw(hostname, requestPath, timeout);
        } catch (error) {
            lastError = error;
            if (!isTransientNetworkError(error) || attempt === retries) break;
            await wait(delayMs * (attempt + 1));
        }
    }
    throw lastError;
}

const TV_HEADERS = {
    'Origin': 'https://www.tradingview.com',
    'Referer': 'https://www.tradingview.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
    'Accept': 'application/json',
};

// ─── Input validation helpers ────────────────────────────────────────────────
// Only allow alphanumeric, dot, dash, colon — no special chars
const TICKER_RE = /^[A-Z0-9.:\-]{1,20}$/i;
const SEARCH_RE = /^[A-Za-z0-9\s.:\-]{1,50}$/;

function validateTicker(t) {
    const clean = (t || '').trim().toUpperCase();
    if (!TICKER_RE.test(clean)) return null;
    return clean;
}

function validateSearch(q) {
    const clean = (q || '').trim();
    if (!SEARCH_RE.test(clean)) return null;
    return clean;
}

// ─── Simple in-memory rate limiter (max 30 req/min per IP) ──────────────────
const rateLimitMap = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const window = 60_000; // 1 minute
    const MAX = 30;
    let entry = rateLimitMap.get(ip);
    if (!entry || now - entry.start > window) {
        entry = { start: now, count: 0 };
        rateLimitMap.set(ip, entry);
    }
    entry.count++;
    return entry.count > MAX;
}

function ymdLocal(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Market calendar: macro events generated dynamically.
// BI RDG schedule published annually by Bank Indonesia — add new year once/year.
// KSEI corporate actions fetched daily and cached on disk.
const BI_RDG_SCHEDULE = {
    2025: [
        '2025-01-14', '2025-02-18', '2025-03-18', '2025-04-22',
        '2025-05-20', '2025-06-17', '2025-07-15', '2025-08-19',
        '2025-09-16', '2025-10-14', '2025-11-18', '2025-12-16',
    ],
    2026: [
        '2026-01-14', '2026-02-18', '2026-03-18', '2026-04-22',
        '2026-05-19', '2026-06-17', '2026-07-15', '2026-08-19',
        '2026-09-16', '2026-10-21', '2026-11-18', '2026-12-16',
    ],
};

/** @param {number} month - 0-indexed (0 = January) */
function firstBusinessDay(year, month) {
    const d = new Date(year, month, 1);
    const dow = d.getDay();
    if (dow === 0) d.setDate(2);
    else if (dow === 6) d.setDate(3);
    return ymdLocal(d);
}

function getMacroEvents() {
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - MACRO_WINDOW_PAST_DAYS);
    const until = new Date(today); until.setDate(until.getDate() + MACRO_WINDOW_FUTURE_DAYS);
    const events = [];

    // BI RDG — scan current year + next year
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        const rdgDates = BI_RDG_SCHEDULE[year];
        if (!rdgDates) continue;
        for (const date of rdgDates) {
            const d = new Date(date + 'T00:00:00');
            if (d < from || d > until) continue;
            const endD = new Date(d); endD.setDate(endD.getDate() + 1);
            events.push({
                id: `bi-rdg-${date}`,
                date,
                endDate: ymdLocal(endD),
                category: 'macro',
                label: 'BI Rate',
                title: 'RDG Bank Indonesia',
                detail: 'Rapat Dewan Gubernur BI. Pantau arah suku bunga, rupiah, dan sentimen sektor bank.',
                impact: 'high',
                source: 'Bank Indonesia',
                url: 'https://www.bi.go.id/en/publikasi/Kalender/',
            });
        }
    }

    // BPS — first business day of each month, up to 30 days back, up to 3 months ahead
    for (let offset = -1; offset <= 3; offset++) {
        const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        const date = firstBusinessDay(ref.getFullYear(), ref.getMonth());
        const d = new Date(date + 'T00:00:00');
        if (d < from || d > until) continue;
        const monthLabel = ref.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        events.push({
            id: `bps-${date}`,
            date,
            category: 'macro',
            label: 'BPS',
            title: `Rilis Data Ekonomi ${monthLabel}`,
            detail: 'Data ekonomi bulanan BPS: inflasi, nilai tukar petani, pariwisata, dan indikator lainnya.',
            impact: 'medium',
            source: 'BPS',
            url: 'https://www.bps.go.id/id/statistics-table',
        });
    }

    return events;
}

function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

function startOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthWeekRange(date = new Date(), weekNumber = 1) {
    const safeWeek = Math.max(1, Math.min(parseInt(weekNumber, 10) || 1, 4));
    const start = new Date(date.getFullYear(), date.getMonth(), 1 + ((safeWeek - 1) * 7));
    const end = safeWeek === 4
        ? endOfMonth(date)
        : new Date(date.getFullYear(), date.getMonth(), safeWeek * 7, 23, 59, 59, 999);
    return { start, end, week: safeWeek };
}

function decodeHtml(text = '') {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripHtml(text = '') {
    return decodeHtml(text.replace(/<[^>]*>/g, ' '));
}

function shortVenueName(venue = '') {
    // Split at comma OR street address marker (Jl./Jalan/No.)
    const firstPart = venue.split(/,|\.\s+(?:Jl|Jalan|No)\b|\s+Jl\.\s/i)[0].trim();
    const noFloor = firstPart
        .replace(/\s+\d{1,3}(?:st|nd|rd|th)?\s+(?:floor|lt|lantai)\b.*/i, '')
        .replace(/\s+(?:lt|lantai)\.?\s*\d+\b.*/i, '')
        .trim();
    const beforeParen = noFloor.replace(/\s*\(.*$/, '').trim();
    return beforeParen.length >= 4 ? beforeParen : noFloor;
}

function parseRupsDescription(description = '') {
    const timeMatch = description.match(/Waktu\s*:\s*(\d{1,2}:\d{2})\s*WIB/i);
    const venueMatch = description.match(/Tempat\s*:\s*(.+)/i);
    return {
        time: timeMatch ? timeMatch[1] : null,
        venue: venueMatch ? venueMatch[1].trim() : null,
    };
}

function parseDivAmount(raw) {
    // Indonesian format: period = thousand sep, comma = decimal sep
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    if (isNaN(num)) return raw;
    // Round to max 2 decimal places, strip trailing zeros
    const rounded = Math.round(num * 100) / 100;
    // Format back to Indonesian: comma as decimal separator
    return rounded % 1 === 0
        ? rounded.toLocaleString('id-ID')
        : rounded.toFixed(2).replace('.', ',');
}

function summarizeCorporateAction(label, description = '') {
    const divMatch = description.match(/Rp\s*([\d.,]+)/i);
    if ((label === 'Dividen' || /dividen/i.test(description)) && divMatch) {
        return `Div ${parseDivAmount(divMatch[1])} rupiah/lembar`;
    }

    if (label === 'RUPS' || label === 'RUPO') {
        const { time, venue } = parseRupsDescription(description);
        const venueName = venue ? shortVenueName(venue) : null;
        if (time && venueName) return `Pukul ${time} WIB · ${venueName}`;
        if (time) return `Pukul ${time} WIB`;
        if (venueName) return venueName;
    }

    return description.length > 72 ? description.slice(0, 69) + '...' : description;
}

function formatRupsDetail(description = '') {
    const { time, venue } = parseRupsDescription(description);
    if (!time && !venue) return description;
    const lines = [];
    if (time) lines.push(`Pukul ${time} WIB`);
    if (venue) lines.push(`Tempat: ${venue}`);
    return lines.join('\n');
}

function isIdxStockTicker(code = '') {
    return /^[A-Z]{4}$/.test(code);
}

function isAllowedCalendarEvent(event = {}) {
    if (event.category === 'macro') return true;
    if (event.category === 'corporate') return isIdxStockTicker(event.ticker || '');
    return false;
}

function normalizeCalendarEvent(event = {}) {
    if (event.category !== 'corporate') return event;
    const detailText = `${event.detail || ''} ${event.summary || ''}`;
    if (/dividen/i.test(detailText)) {
        return {
            ...event,
            label: 'Dividen',
            summary: event.summary || summarizeCorporateAction('Dividen', detailText),
        };
    }
    return event;
}

function countCorporateEvents(events = []) {
    return events.filter(event => event.category === 'corporate').length;
}

function kseiTypeFromPath(detailPath = '') {
    if (detailPath.includes('/cum/')) return { label: 'Cum Date', type: 'cum' };
    if (detailPath.includes('/rec/')) return { label: 'Record Date', type: 'rec' };
    if (detailPath.includes('/eff/')) return { label: 'Effective Date', type: 'eff' };
    return { label: 'Corporate Action', type: 'ca' };
}

function kseiPathPriority(detailPath = '') {
    if (detailPath.includes('/cum/')) return 0;
    if (detailPath.includes('/rec/')) return 1;
    if (detailPath.includes('/eff/')) return 2;
    return 3;
}

function actionLabelFromDetail(html = '') {
    const upper = html.toUpperCase();
    if (upper.includes('DIVIDEN')) return 'Dividen';
    if (upper.includes('CASH DIVIDEND')) return 'Dividen';
    if (upper.includes('RUPS') || upper.includes('RUPO')) return 'RUPS';
    if (upper.includes('RIGHT')) return 'Rights';
    if (upper.includes('STOCK SPLIT')) return 'Stock Split';
    if (upper.includes('SHARE DIVIDEND')) return 'Share Div';
    return 'Corp Act';
}

function parseKseiDetail(html, eventDate, detailPath) {
    const type = kseiTypeFromPath(detailPath);
    const blocks = html.match(/<section class="accordion accordion--nested accordion--last">[\s\S]*?<\/section>/g) || [];
    const events = [];

    for (const block of blocks) {
        const codeMatch = block.match(/<b>\s*Security Code:\s*<\/b>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i);
        if (!codeMatch) continue;
        const nameMatch = block.match(/<b>\s*Security Name:\s*<\/b>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i);
        const descMatch = block.match(/<dt[^>]*>\s*CA Description\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i);

        const ticker = decodeHtml(codeMatch[1]).trim().toUpperCase();
        if (!isIdxStockTicker(ticker)) continue;

        const securityName = nameMatch ? decodeHtml(nameMatch[1]) : '';
        const description = descMatch ? stripHtml(descMatch[1]) : '';
        const label = actionLabelFromDetail(`${block} ${description}`);
        const isRups = label === 'RUPS' || label === 'RUPO';
        const shortDesc = (!isRups && description.length > 110) ? description.slice(0, 107) + '...' : description;
        const summary = summarizeCorporateAction(label, description);
        const detail = isRups
            ? (formatRupsDetail(description) || shortDesc || `${securityName || ticker} masuk jadwal ${type.label} KSEI.`)
            : (shortDesc || `${securityName || ticker} masuk jadwal ${type.label} KSEI.`);

        events.push({
            id: `ksei-${type.type}-${eventDate}-${ticker}`,
            date: eventDate,
            category: 'corporate',
            label,
            ticker,
            title: `${ticker} - ${type.label}`,
            detail,
            summary: summary || `${ticker} ${type.label}`,
            impact: type.type === 'cum' ? 'high' : 'medium',
            source: 'KSEI',
            url: `https://web.ksei.co.id${detailPath}`,
            eventType: type.type,
            securityName,
        });
    }

    return events;
}

async function fetchKseiCalendarEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = startOfMonth(today);
    const until = endOfMonth(addMonths(today, 1));

    const months = [today, addMonths(today, 1)];
    const detailItems = [];

    for (const monthDate of months) {
        const month = String(monthDate.getMonth() + 1).padStart(2, '0');
        const year = monthDate.getFullYear();
        const raw = await httpsGetRawWithRetry('web.ksei.co.id', `/ksei_calendar/get_json/event-${month}-${year}-all.json`);
        const json = JSON.parse(raw);
        for (const group of (json.data || [])) {
            for (const item of (group.events || [])) {
                if (!item.start || !item.description) continue;
                const date = new Date(`${item.start}T00:00:00`);
                if (date < from || date > until) continue;
                detailItems.push({ date: item.start, path: item.description });
            }
        }
    }

    const uniqueDetails = [...new Map(detailItems.map(item => [`${item.date}|${item.path}`, item])).values()]
        .sort((a, b) => {
            const pa = kseiPathPriority(a.path);
            const pb = kseiPathPriority(b.path);
            if (pa !== pb) return pa - pb;
            return a.date.localeCompare(b.date);
        });
    const events = [];
    let skippedDetails = 0;
    for (const item of uniqueDetails.slice(0, KSEI_DETAIL_PAGE_LIMIT)) {
        try {
            const html = await httpsGetRawWithRetry('web.ksei.co.id', item.path);
            events.push(...parseKseiDetail(html, item.date, item.path));
        } catch (e) {
            skippedDetails++;
            if (!isTransientNetworkError(e) && !item.path.includes('/eff/')) {
                console.error('[Calendar] KSEI detail error:', e.message);
            }
        }
        await wait(120);
    }

    if (skippedDetails > 0) {
        console.warn(`[Calendar] KSEI skipped ${skippedDetails} detail page(s) after retry.`);
    }

    if (countCorporateEvents(events) < KSEI_MIN_CORPORATE_EVENTS) {
        throw new Error(`KSEI corporate events too low (${countCorporateEvents(events)}), skip cache write`);
    }

    return events.slice(0, KSEI_EVENT_LIMIT);
}

async function fetchIdxCorporateActions() {
    // IDX corporate actions API endpoint:
    //   https://www.idx.co.id/primary/TradingData/GetCorporateAction
    // Expected request params:
    //   indexFrom=0, pageSize=80, type=, code=, startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
    //
    // NOTE: IDX website is protected by Cloudflare and blocks automated requests (curl, HTTPS client).
    // Browser-based JavaScript clients (with Cloudflare challenges enabled) can reach it.
    // A headless browser solution (Puppeteer/Playwright) or Cloudflare bypass is required for production use.
    //
    // For now, return empty array. When Cloudflare access is available, uncomment the fetch logic:
    /*
    const today = new Date();
    const startDate = ymdLocal(new Date(today.getFullYear(), today.getMonth(), 1));
    const endDate   = ymdLocal(new Date(today.getFullYear(), today.getMonth() + 2, 0));
    const path = `/primary/TradingData/GetCorporateAction?indexFrom=0&pageSize=80&type=&code=&startDate=${startDate}&endDate=${endDate}`;

    const raw = await httpsGetRawWithRetry('www.idx.co.id', path, { timeout: 15000 });
    const json = JSON.parse(raw);
    const events = [];

    for (const item of (json.Results || [])) {
        // Use actual field names from IDX API response (found via browser inspection)
        const ticker = ((item.Code || item.StockCode || '')).toUpperCase().trim();
        if (!isIdxStockTicker(ticker)) continue;

        const actionType = item.TypeCA || item.ActionType || '';
        const label = actionLabelFromDetail(actionType + ' ' + (item.Detail || item.Description || ''));
        const cumDate = item.CumDate || item.ExDate || null;
        const payDate = item.PayDate || item.PaymentDate || null;

        if (cumDate) {
            events.push({
                id: `idx-cum-${cumDate.slice(0, 10)}-${ticker}`,
                date: cumDate.slice(0, 10),
                category: 'corporate',
                label,
                ticker,
                title: `${ticker} - Cum Date`,
                detail: item.Detail || item.Description || `${ticker} ${label}`,
                summary: item.Detail || item.Description || label,
                impact: 'high',
                source: 'IDX',
                url: 'https://www.idx.co.id/en/market-data/corporate-actions/',
                eventType: 'cum',
            });
        }

        if (payDate && payDate.slice(0, 10) !== (cumDate || '').slice(0, 10)) {
            events.push({
                id: `idx-pay-${payDate.slice(0, 10)}-${ticker}`,
                date: payDate.slice(0, 10),
                category: 'corporate',
                label,
                ticker,
                title: `${ticker} - Payment Date`,
                detail: item.Detail || item.Description || `${ticker} ${label}`,
                summary: item.Detail || item.Description || label,
                impact: 'medium',
                source: 'IDX',
                url: 'https://www.idx.co.id/en/market-data/corporate-actions/',
                eventType: 'pay',
            });
        }
    }

    return events;
    */
    return [];
}

function readCalendarCache() {
    try {
        if (!fs.existsSync(CALENDAR_CACHE_FILE)) return null;
        const cache = JSON.parse(fs.readFileSync(CALENDAR_CACHE_FILE, 'utf8'));
        if (cache.version !== CALENDAR_CACHE_VERSION) return null;
        if (cache.cache_date !== ymdLocal()) return null;
        if (!Array.isArray(cache.events)) return null;
        return cache;
    } catch {
        return null;
    }
}

function writeCalendarCache(events) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const payload = {
            version: CALENDAR_CACHE_VERSION,
            cache_date: ymdLocal(),
            generated_at: new Date().toISOString(),
            events,
        };
        fs.writeFileSync(CALENDAR_CACHE_FILE, JSON.stringify(payload, null, 2));
        return payload;
    } catch (e) {
        console.error('[Calendar] Cache write error:', e.message);
        return { generated_at: new Date().toISOString(), events };
    }
}

function getCalendarFallback(errorMessage) {
    const stale = (() => {
        try {
            if (!fs.existsSync(CALENDAR_CACHE_FILE)) return null;
            return JSON.parse(fs.readFileSync(CALENDAR_CACHE_FILE, 'utf8'));
        } catch {
            return null;
        }
    })();
    const staleEvents = (stale?.events || []).filter(isAllowedCalendarEvent);
    const canUseStale = countCorporateEvents(staleEvents) >= KSEI_MIN_CORPORATE_EVENTS;
    const fallbackEvents = canUseStale ? staleEvents : getMacroEvents();
    return {
        generated_at: canUseStale ? stale.generated_at : new Date().toISOString(),
        events: fallbackEvents,
        cached: canUseStale,
        error: errorMessage,
    };
}

async function loadCalendarCache(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = readCalendarCache();
        if (cached) return { ...cached, cached: true };
    }

    if (!forceRefresh && calendarRefreshBlockedUntil > Date.now()) {
        return getCalendarFallback(calendarLastRefreshError || 'KSEI refresh paused after recent failure');
    }

    // Start background KSEI fetch if not already running
    if (!calendarRefreshInFlight) {
        calendarRefreshInFlight = (async () => {
            try {
                const kseiEvents = await fetchKseiCalendarEvents();
                console.log(`[Calendar] KSEI: ${countCorporateEvents(kseiEvents)} corporate action events`);

                let idxEvents = [];
                try {
                    idxEvents = await fetchIdxCorporateActions();
                    if (idxEvents.length > 0) console.log(`[Calendar] IDX: ${idxEvents.length} corporate action events`);
                } catch (e) {
                    console.warn('[Calendar] IDX fetch skipped:', e.message);
                }

                const kseiKeys = new Set(kseiEvents.map(e => `${e.date}|${e.ticker}|${e.eventType}`));
                const kseiTickerDates = new Set(
                    kseiEvents.filter(e => e.eventType === 'ca').map(e => `${e.date}|${e.ticker}`)
                );
                const idxUnique = idxEvents.filter(e =>
                    !kseiKeys.has(`${e.date}|${e.ticker}|${e.eventType}`) &&
                    !kseiTickerDates.has(`${e.date}|${e.ticker}`)
                );

                const allEvents = [...getMacroEvents(), ...kseiEvents, ...idxUnique].filter(isAllowedCalendarEvent);
                writeCalendarCache(allEvents);
                calendarLastRefreshError = null;
                calendarRefreshBlockedUntil = 0;
                console.log(`[Calendar] Background refresh selesai: ${allEvents.length} events.`);
            } catch (e) {
                calendarLastRefreshError = e.message;
                calendarRefreshBlockedUntil = Date.now() + CALENDAR_REFRESH_COOLDOWN_MS;
                console.warn('[Calendar] Background refresh gagal:', e.message);
            } finally {
                calendarRefreshInFlight = null;
            }
        })();
    }

    // On a fresh deploy there is no disk cache yet. Wait once so the public site
    // does not render a macro-only calendar while KSEI is still warming up.
    if (forceRefresh || !fs.existsSync(CALENDAR_CACHE_FILE)) {
        await calendarRefreshInFlight;
        const refreshed = readCalendarCache();
        if (refreshed) return { ...refreshed, cached: true };
        return getCalendarFallback(calendarLastRefreshError || 'KSEI belum tersedia.');
    }

    // Return immediately with macro + stale KSEI while background fetch refreshes cache.
    return getCalendarFallback('KSEI sedang dimuat di background, refresh untuk data lengkap.');
}

function handleCalendar(query, res) {
    const type = (query.type || 'all').toString().toLowerCase();
    const range = query.range === 'week' ? 'week' : 'month';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekRange = monthWeekRange(today, query.week);
    const maxLimit = range === 'week' ? 80 : 300;
    const defaultLimit = range === 'week' ? 40 : 300;
    const limit = Math.max(1, Math.min(parseInt(query.limit || String(defaultLimit), 10) || defaultLimit, maxLimit));
    const forceRefresh = query.refresh === '1';
    const rangeStart = range === 'week' ? weekRange.start : startOfMonth(today);
    const rangeEnd = range === 'week' ? weekRange.end : endOfMonth(today);

    loadCalendarCache(forceRefresh).then((calendar) => {
        const filtered = calendar.events
        .filter(isAllowedCalendarEvent)
        .filter(event => type === 'all' || event.category === type)
        .map(normalizeCalendarEvent)
        .map(event => {
            const eventDate = event.date ? new Date(event.date + 'T00:00:00') : null;
            const daysUntil = eventDate ? Math.round((eventDate - today) / 86400000) : null;
            return { ...event, daysUntil };
        })
        .filter(event => {
            if (!event.date) return false;
            const eventDate = new Date(event.date + 'T00:00:00');
            return eventDate >= rangeStart && eventDate <= rangeEnd;
        })
        .sort((a, b) => {
            const av = a.daysUntil === null ? 999 : a.daysUntil;
            const bv = b.daysUntil === null ? 999 : b.daysUntil;
            return av - bv;
        })
        .slice(0, limit);

        sendJSON(res, 200, {
            status: 'success',
            generated_at: calendar.generated_at || new Date().toISOString(),
            cached: calendar.cached,
            error: calendar.error || null,
            range,
            week: range === 'week' ? weekRange.week : null,
            range_start: ymdLocal(rangeStart),
            range_end: ymdLocal(rangeEnd),
            events: filtered,
            sources: [
                { name: 'Bank Indonesia', url: 'https://www.bi.go.id/en/publikasi/Kalender/' },
                { name: 'BPS', url: 'https://www.bps.go.id/assets/arc' },
                { name: 'KSEI', url: 'https://web.ksei.co.id/ksei-calendar?setLocale=id-ID' },
                { name: 'IDX', url: 'https://www.idx.co.id/en/market-data/corporate-actions/' },
            ],
        });
    }).catch((e) => {
        sendJSON(res, 500, { status: 'error', message: e.message });
    });
}

// ─── /search  →  TradingView symbol search ───────────────────────────────────
function handleSearch(query, exchange, res) {
    const params = new URLSearchParams({
        text: query.toUpperCase(),
        exchange: exchange || 'IDX',
    });

    tvRequest({
        hostname: 'symbol-search.tradingview.com',
        path: `/symbol_search/?${params}`,
        method: 'GET',
        headers: TV_HEADERS,
    }, null, (err, tvData) => {
        if (err) { return sendJSON(res, 502, { error: err.message }); }

        const symbols = Array.isArray(tvData) ? tvData : (tvData.symbols || []);
        const results = symbols
            .filter(s =>
                s.exchange && s.exchange.toUpperCase().includes('IDX') &&
                s.type !== 'warrant' &&
                !s.symbol.includes('-W') && !s.symbol.includes('-R') && !s.symbol.includes('.')
            )
            .slice(0, 10)
            .map(s => ({
                symbol: s.symbol,
                name: s.description || s.symbol,
                type: s.type || 'stock',
                exchange: s.exchange,
            }));

        sendJSON(res, 200, { results });
    });
}

// ─── /price  →  TradingView real-time quote via scanner ──────────────────────
function handlePrice(ticker, res) {
    const body = JSON.stringify({
        symbols: { tickers: [`IDX:${ticker.toUpperCase()}`] },
        columns: ['close', 'open', 'high', 'low', 'volume', 'change', 'change_abs',
            'market_cap_basic', 'description'],
    });

    tvRequest({
        hostname: 'scanner.tradingview.com',
        path: '/global/scan',
        method: 'POST',
        headers: { ...TV_HEADERS, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body, (err, data) => {
        if (err) { return sendJSON(res, 502, { error: err.message }); }

        const item = data?.data?.[0];
        if (!item) { return sendJSON(res, 404, { error: 'Ticker not found' }); }

        const [close, open, high, low, volume, change, changeAbs, marketCap, description] = item.d;
        sendJSON(res, 200, {
            ticker: ticker.toUpperCase(),
            description: description || ticker,
            price: close,
            open, high, low,
            volume: volume,
            change_pct: change,
            change_abs: changeAbs,
            market_cap: marketCap,
        });
    });
}

// ─── Data: Real-time Stock Prices for Marquee ────────────────────────────────
let stockPrices = {
    'IDX:COMPOSITE': { price: 0, change: 0, pct: 0 },
    'IDX:LQ45':      { price: 0, change: 0, pct: 0 },
    'IDX:BBCA':      { price: 0, change: 0, pct: 0 },
    'IDX:BBRI':      { price: 0, change: 0, pct: 0 },
    'IDX:BBNI':      { price: 0, change: 0, pct: 0 },
    'IDX:BMRI':      { price: 0, change: 0, pct: 0 },
    'IDX:BUMI':      { price: 0, change: 0, pct: 0 },
    'IDX:TLKM':      { price: 0, change: 0, pct: 0 },
    'IDX:ASII':      { price: 0, change: 0, pct: 0 },
    'IDX:ANTM':      { price: 0, change: 0, pct: 0 },
    'IDX:ADMR':      { price: 0, change: 0, pct: 0 },
    'IDX:PTBA':      { price: 0, change: 0, pct: 0 },
    'IDX:AADI':      { price: 0, change: 0, pct: 0 },
    'IDX:MBMA':      { price: 0, change: 0, pct: 0 },
    'IDX:GOTO':      { price: 0, change: 0, pct: 0 },
    'BINANCE:BTCUSDT': { price: 0, change: 0, pct: 0 },
    'OANDA:XAUUSD':    { price: 0, change: 0, pct: 0 },
};

function fetchMarketData() {
    const tickers = Object.keys(stockPrices);
    const body = JSON.stringify({
        symbols: { tickers: tickers },
        columns: ['close', 'change', 'change_abs'],
    });

    tvRequest({
        hostname: 'scanner.tradingview.com',
        path: '/global/scan',
        method: 'POST',
        headers: { ...TV_HEADERS, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body, (err, data) => {
        if (err) { console.error('[Marquee Error]', err.message); return; }
        
        const items = data?.data || [];
        items.forEach(item => {
            const ticker = item.s;
            const [price, pct, change] = item.d;
            if (stockPrices[ticker]) {
                stockPrices[ticker] = { price, change, pct };
            }
        });
        console.log(`[Marquee] Updated ${items.length} prices from TradingView`);
    });
}

// Update setiap 15 detik (aman & real-time)
fetchMarketData();
setInterval(fetchMarketData, 15000);

// ─── Board Cache (IDX Papan Pencatatan) ──────────────────────────────────────
const boardCache = new Map(); // ticker → 'utama' | 'pengembangan' | 'akselerasi' | 'ekonomi_baru'

function normalizeBoard(raw) {
    if (!raw) return 'unknown';
    const s = raw.toString().toLowerCase();
    if (s.includes('akseler') || s.includes('acceler')) return 'akselerasi';
    if (s.includes('ekonomi') || s.includes('economy') || s === 'ne') return 'ekonomi_baru';
    if (s.includes('pengembangan') || s.includes('develop')) return 'pengembangan';
    if (s.includes('utama') || s.includes('main')) return 'utama';
    return 'unknown';
}

function fetchBoardList() {
    const qs = 'start=0&length=9999&board=0&key=';
    const req = https.request({
        hostname: 'www.idx.co.id',
        path: `/primary/StockData/GetStockList?${qs}`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.idx.co.id/',
            'Origin': 'https://www.idx.co.id',
        },
    }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const trimmed = data.trim();
                if (res.statusCode >= 400 || trimmed.startsWith('<')) {
                    console.warn(`[Board] IDX returned non-JSON response (status ${res.statusCode}); keeping existing cache.`);
                    return;
                }
                const json = JSON.parse(data);
                const list = json.data || json.Data || json.results || json.Results || [];
                if (!Array.isArray(list) || list.length === 0) {
                    console.warn('[Board] IDX returned empty list, status:', res.statusCode);
                    return;
                }
                let count = 0;
                list.forEach(item => {
                    const code = (
                        item.code || item.Code || item.symbol || item.Symbol ||
                        item.KodeEmiten || item.Kode || ''
                    ).toString().trim().toUpperCase();
                    const boardRaw = (
                        item.board || item.Board || item.listingBoard || item.ListingBoard ||
                        item.papan || item.Papan || item.PapanPencatatan || item.market || ''
                    ).toString().trim();
                    if (code && boardRaw) {
                        boardCache.set(code, normalizeBoard(boardRaw));
                        count++;
                    }
                });
                console.log(`[Board] Loaded ${count} tickers from IDX (${boardCache.size} cached)`);
            } catch (e) {
                console.error('[Board] Parse error:', e.message);
            }
        });
    });
    req.on('error', (e) => console.error('[Board] Fetch error:', e.message));
    req.setTimeout(15000, () => { req.destroy(); console.error('[Board] Timeout'); });
    req.end();
}

fetchBoardList();
setInterval(fetchBoardList, 24 * 60 * 60 * 1000); // refresh tiap 24 jam

// ─── /bandarmology  →  Real broker flow from api-saham ───────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function handleBandarmology(ticker, fromParam, toParam, res) {
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const fromStr = (fromParam && DATE_RE.test(fromParam)) ? fromParam : defaultFrom.toISOString().slice(0, 10);
    const toStr   = (toParam   && DATE_RE.test(toParam))   ? toParam   : today.toISOString().slice(0, 10);

    const params = new URLSearchParams({
        symbol: ticker, from: fromStr, to: toStr,
        include_orderflow: 'false', cache: 'off',
    });

    tvRequest({
        hostname: 'api-saham.mkemalw.workers.dev',
        path: `/cache-summary?${params}`,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }, null, (err, data) => {
        if (err) { return sendJSON(res, 502, { error: err.message }); }

        const netForeign = data.summary?.foreign?.net_val ?? 0;
        const netLocal   = data.summary?.local?.net_val   ?? 0;
        const netRetail  = data.summary?.retail?.net_val  ?? 0;
        let lastPrice = null;
        for (const entry of (data.history || [])) {
            if (entry.data?.price) lastPrice = entry.data.price;
        }

        const mapBuyer = (b) => ({
            code:     b.code,
            type:     b.type || '',
            netVal:   (b.bval || 0) - (b.sval || 0),
            avgPrice: b.bvol > 0 ? Math.round((b.bval || 0) / b.bvol) : 0,
        });
        const mapSeller = (b) => ({
            code:     b.code,
            type:     b.type || '',
            netVal:   (b.sval || 0) - (b.bval || 0),
            avgPrice: b.svol > 0 ? Math.round((b.sval || 0) / b.svol) : 0,
        });

        const buyers  = (data.summary?.top_net_buyers  || []).slice(0, 5).map(mapBuyer);
        const sellers = (data.summary?.top_net_sellers || []).slice(0, 5).map(mapSeller);

        sendJSON(res, 200, { ticker, netForeign, netLocal, netRetail, lastPrice, buyers, sellers });
    });
}

// ─── /board  →  IDX papan pencatatan lookup ──────────────────────────────────
function handleBoard(ticker, res) {
    const board = boardCache.get(ticker.toUpperCase()) || 'unknown';
    sendJSON(res, 200, { ticker: ticker.toUpperCase(), board, cached: boardCache.size });
}

// ─── /ml-predict  →  Run ML prediction script ────────────────────────────────
function handleMLPredict(ticker, res) {
    console.log(`[ML Request] Menghitung prediksi untuk: ${ticker}`);

    // Menjalankan script python: python predict.py <ticker>
    // Karena predict.py ada di folder yang sama dengan server.js
    const python = spawn('python', [path.join(ROOT, 'predict.py'), ticker]);

    let output = '';
    python.stdout.on('data', (data) => {
        output += data.toString();
    });

    python.stderr.on('data', (data) => {
        console.error(`[Python Error] ${data}`);
    });

    python.on('close', (code) => {
        try {
            // Bersihkan output: ambil hanya bagian antara { dan }
            const start = output.indexOf('{');
            const end = output.lastIndexOf('}');
            if (start === -1 || end === -1) throw new Error("Format output Python tidak valid");

            const cleanJson = output.substring(start, end + 1);
            const jsonResult = JSON.parse(cleanJson);
            sendJSON(res, 200, jsonResult);
        } catch (e) {
            console.error(`[Parse Error] ${e.message}. Raw output: ${output}`);
            sendJSON(res, 500, { error: "Prediksi tidak tersedia saat ini." });
        }
    });

}

// ─── /screener  →  Run screener script ───────────────────────────────────────
function handleScreener(req, res) {
    const parsed     = url.parse(req.url, true);
    const strategies = /^[a-z,]+$/.test(parsed.query.strategies || '') ? parsed.query.strategies : 'triple';
    const mode       = parsed.query.mode === 'or' ? 'or' : 'and';

    console.log(`[Screener] Scan 14 emiten | strategies=${strategies} mode=${mode}`);

    const python = spawn('python', [
        path.join(ROOT, 'screener.py'),
        '--strategies', strategies,
        '--mode', mode,
    ]);
    let output = '';
    let timedOut = false;
    let timer = setTimeout(() => {
        timedOut = true;
        python.kill();
        sendJSON(res, 504, { status: 'error', message: 'Screener timeout (>90 detik)' });
    }, 90000);

    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { console.error(`[Screener Error] ${data}`); });

    python.on('close', () => {
        if (timedOut) return;
        clearTimeout(timer);
        try {
            const result = JSON.parse(output.trim());
            sendJSON(res, 200, result);
        } catch (e) {
            console.error(`[Screener Parse Error] ${e.message}`);
            sendJSON(res, 500, { status: 'error', message: 'Gagal parse output screener' });
        }
    });
}

// ─── /heatmap  →  Sector treemap data (cache 10 menit) ───────────────────────
function handleHeatmap(req, res) {
    if (heatmapCache && Date.now() - heatmapCache.cachedAt < HEATMAP_TTL_MS) {
        return sendJSON(res, 200, heatmapCache.data);
    }

    console.log('[Heatmap] Refresh data sektor...');
    const python = spawn('python', [path.join(ROOT, 'heatmap.py')]);
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        python.kill();
        serveHeatmapFallback(res);
    }, 30000);

    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { console.error(`[Heatmap Error] ${data}`); });

    python.on('close', () => {
        if (timedOut) return;
        clearTimeout(timer);
        try {
            const result = JSON.parse(output.trim());
            if (result.status !== 'ok') throw new Error(result.message || 'status bukan ok');
            heatmapCache = { data: result, cachedAt: Date.now() };
            try { fs.writeFileSync(HEATMAP_CACHE_FILE, JSON.stringify(result)); } catch (e) {}
            sendJSON(res, 200, result);
        } catch (e) {
            console.error(`[Heatmap Parse Error] ${e.message}`);
            serveHeatmapFallback(res);
        }
    });
}

function serveHeatmapFallback(res) {
    if (heatmapCache) return sendJSON(res, 200, heatmapCache.data);
    try {
        if (fs.existsSync(HEATMAP_CACHE_FILE)) {
            const disk = JSON.parse(fs.readFileSync(HEATMAP_CACHE_FILE, 'utf8'));
            heatmapCache = { data: disk, cachedAt: 0 }; // serve now, refresh on next hit
            return sendJSON(res, 200, disk);
        }
    } catch (e) {}
    sendJSON(res, 503, { status: 'error', message: 'Heatmap belum siap, coba lagi sebentar.' });
}

// ─── Helper: send JSON with CORS ─────────────────────────────────────────────
function sendJSON(res, status, obj) {
    if (res.headersSent || res.writableEnded) return; // jangan crash kalau response sudah dikirim
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(obj));
}

// ─── Static file server ──────────────────────────────────────────────────────
function serveStatic(pathname, res) {
    // Default index
    if (pathname === '/' || pathname === '') pathname = DEFAULT;

    const filePath = path.join(ROOT, pathname);

    // Security: jangan keluar dari ROOT folder
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`File not found: ${pathname}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache',  // dev mode: always fresh
        });

        fs.createReadStream(filePath).pipe(res);
    });
}

// ─── Main HTTP server ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsed.pathname);

    // CORS preflight
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {}); return;
    }

    // API: /search
    if (req.method === 'GET' && pathname === '/search') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }

        const q = validateSearch(parsed.query.q);
        const exchange = validateTicker(parsed.query.exchange || 'IDX') || 'IDX';
        if (!q) { sendJSON(res, 400, { error: 'Invalid or missing ?q= (max 50 alphanumeric chars)' }); return; }
        console.log(`[Search] "${q}" (${exchange})`);
        return handleSearch(q, exchange, res);
    }

    // API: /price
    if (req.method === 'GET' && pathname === '/price') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }

        const ticker = validateTicker(parsed.query.ticker);
        if (!ticker) { sendJSON(res, 400, { error: 'Invalid or missing ?ticker= (alphanumeric, max 20 chars)' }); return; }
        console.log(`[Price]  ${ticker}`);
        return handlePrice(ticker, res);
    }

    // API: /board
    if (req.method === 'GET' && pathname === '/board') {
        const ticker = validateTicker(parsed.query.ticker);
        if (!ticker) { sendJSON(res, 400, { error: 'Missing ?ticker=' }); return; }
        return handleBoard(ticker, res);
    }

    // API: /bandarmology
    if (req.method === 'GET' && pathname === '/bandarmology') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }
        const ticker = validateTicker(parsed.query.ticker);
        if (!ticker) { sendJSON(res, 400, { error: 'Missing ?ticker=' }); return; }
        const fromP = parsed.query.from || null;
        const toP   = parsed.query.to   || null;
        console.log(`[Band]   ${ticker} ${fromP || 'default'} → ${toP || 'today'}`);
        return handleBandarmology(ticker, fromP, toP, res);
    }

    // API: /ml-predict
    if (req.method === 'GET' && pathname === '/ml-predict') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }

        const ticker = validateTicker(parsed.query.ticker);
        if (!ticker) { sendJSON(res, 400, { error: 'Invalid or missing ?ticker=' }); return; }
        return handleMLPredict(ticker, res);
    }

    // API: /screener
    if (req.method === 'GET' && pathname === '/screener') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }
        return handleScreener(req, res);
    }

    // API: /heatmap
    if (req.method === 'GET' && pathname === '/heatmap') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }
        return handleHeatmap(req, res);
    }

    // API: /calendar
    if (req.method === 'GET' && pathname === '/calendar') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }
        return handleCalendar(parsed.query, res);
    }

    // API: /api/prices/stream (SSE for Landing Page)
    if (req.method === 'GET' && (pathname === '/api/prices/stream' || pathname === '/prices/stream')) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Kirim data awal
        res.write(`data: ${JSON.stringify(stockPrices)}\n\n`);

        // Kirim data setiap 5 detik
        const interval = setInterval(() => {
            res.write(`data: ${JSON.stringify(stockPrices)}\n\n`);
        }, 5000);

        req.on('close', () => clearInterval(interval));
        return;
    }

    // Static files
    serveStatic(pathname, res);
});

// ─── Daily calendar refresh ───────────────────────────────────────────────────
function scheduleDailyCalendarRefresh() {
    const now = new Date();
    const nextMidnightWIB = new Date(now);
    nextMidnightWIB.setUTCHours(17, 0, 0, 0); // 00:00 WIB = 17:00 UTC
    if (nextMidnightWIB <= now) nextMidnightWIB.setUTCDate(nextMidnightWIB.getUTCDate() + 1);
    const msUntilMidnight = nextMidnightWIB - now;

    setTimeout(() => {
        loadCalendarCache(true)
            .then(() => console.log('[Calendar] Daily refresh selesai.'))
            .catch(e => console.error('[Calendar] Daily refresh gagal:', e.message));
        setInterval(() => {
            loadCalendarCache(true)
                .then(() => console.log('[Calendar] Daily refresh selesai.'))
                .catch(e => console.error('[Calendar] Daily refresh gagal:', e.message));
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    console.log(`[Calendar] Daily refresh dijadwalkan dalam ${Math.round(msUntilMidnight / 60000)} menit (00:00 WIB).`);
}

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    const baseUrl = `http://localhost:${PORT}`;
    console.log('');
    console.log('  ✅ CuanMeter Server siap!');
    console.log(`  🌐 ${baseUrl}${DEFAULT}`);
    console.log('');
    console.log('  Endpoints tersedia:');
    console.log(`  📊 ${baseUrl}/search?q=BBRI          (symbol search)`);
    console.log(`  💰 ${baseUrl}/price?ticker=BBRI       (realtime price)`);
    console.log('');
    console.log('  Tekan Ctrl+C untuk berhenti.');
    console.log('');
    scheduleDailyCalendarRefresh();
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n  [Error] Port ${PORT} sudah dipakai.`);
        console.error(`  Tutup proses lain di port ${PORT} atau ganti PORT di server.js.\n`);
    } else {
        console.error('[Error]', err.message);
    }
    process.exit(1);
});
