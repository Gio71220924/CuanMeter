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
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;           // folder server.js berada
const DEFAULT = '/Analyzer.html';   // halaman yang dibuka otomatis

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

// ─── /ml-predict  →  Run ML prediction script ────────────────────────────────
function handleMLPredict(ticker, res) {
    console.log(`[ML Request] Menghitung prediksi untuk: ${ticker}`);

    // Menjalankan script python: python predict.py <ticker>
    // Karena predict.py ada di root, dan server ini ada di CuanMeter/, 
    // kita panggil path yang benar (parent dir)
    const python = spawn('python', [path.join(ROOT, '..', 'predict.py'), ticker]);

    let output = '';
    python.stdout.on('data', (data) => {
        output += data.toString();
    });

    python.stderr.on('data', (data) => {
        console.error(`[Python Error] ${data}`);
    });

    python.on('close', (code) => {
        try {
            const jsonResult = JSON.parse(output);
            sendJSON(res, 200, jsonResult);
        } catch (e) {
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

    // API: /ml-predict
    if (req.method === 'GET' && pathname === '/ml-predict') {
        const ip = req.socket.remoteAddress;
        if (isRateLimited(ip)) { sendJSON(res, 429, { error: 'Too many requests' }); return; }

        const ticker = validateTicker(parsed.query.ticker);
        if (!ticker) { sendJSON(res, 400, { error: 'Invalid or missing ?ticker=' }); return; }
        return handleMLPredict(ticker, res);
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

    // Auto-buka browser
    const openUrl = `${baseUrl}${DEFAULT}`;
    const cmd = process.platform === 'win32'
        ? `start "" "${openUrl}"`
        : process.platform === 'darwin'
            ? `open "${openUrl}"`
            : `xdg-open "${openUrl}"`;

    exec(cmd, (err) => {
        if (err) console.log(`  Buka manual: ${openUrl}`);
    });
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
