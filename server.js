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

const PORT = 3000;
const ROOT = __dirname;           // folder server.js berada
const DEFAULT = '/index.html';   // halaman yang dibuka otomatis

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
    const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try { callback(null, JSON.parse(data), res.statusCode); }
            catch (e) { callback(new Error('Parse error: ' + e.message)); }
        });
    });
    req.on('error', callback);
    req.setTimeout(8000, () => { req.destroy(); callback(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
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

        let netForeign = 0, netLocal = 0, netRetail = 0, lastPrice = null;
        for (const entry of (data.history || [])) {
            const d = entry.data || {};
            netForeign += (d.foreign?.net_val || 0);
            netLocal   += (d.local?.net_val   || 0);
            netRetail  += (d.retail?.net_val   || 0);
            if (d.price) lastPrice = d.price;
        }

        const mapBroker = (b) => ({
            code:     b.code,
            type:     b.type || '',
            netVal:   (b.bval || 0) - (b.sval || 0),
            avgPrice: b.bvol > 0 ? Math.round((b.bval || 0) / b.bvol) : 0,
        });

        const buyers  = (data.summary?.top_buyers  || []).slice(0, 5).map(mapBroker)
                            .sort((a, b) => b.netVal - a.netVal);
        const sellers = (data.summary?.top_sellers || []).slice(0, 5).map(mapBroker)
                            .sort((a, b) => a.netVal - b.netVal);

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
            sendJSON(res, 500, { error: "Gagal parsing JSON", detail: output });
        }
    });

}

// ─── Helper: send JSON with CORS ─────────────────────────────────────────────
function sendJSON(res, status, obj) {
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
