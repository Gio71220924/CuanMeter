/**
 * CuanMeter - Local TradingView Search Proxy
 * ============================================
 * Jalankan: node proxy.js
 * Port    : 3001
 *
 * Proxy ini forward request ke TradingView Symbol Search API
 * dengan header yang benar (Origin/Referer) supaya tidak kena CORS block.
 * Browser tidak bisa set header ini sendiri, makanya perlu proxy lokal.
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// --- Helper: forward ke TradingView ---
function fetchTradingView(query, exchange, callback) {
    const params = new URLSearchParams({
        text: query.toUpperCase(),
        exchange: exchange || 'IDX',
        lang: 'id',
    });

    const options = {
        hostname: 'symbol-search.tradingview.com',
        path: `/symbol_search/?${params.toString()}`,
        method: 'GET',
        headers: {
            'Origin': 'https://www.tradingview.com',
            'Referer': 'https://www.tradingview.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
        },
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                callback(null, parsed);
            } catch (e) {
                callback(new Error('Failed to parse TradingView response: ' + e.message));
            }
        });
    });

    req.on('error', (e) => callback(e));
    req.setTimeout(8000, () => {
        req.destroy();
        callback(new Error('Request timeout'));
    });
    req.end();
}

// --- HTTP Server ---
const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);

    // CORS headers supaya browser bisa akses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Hanya handle GET /search
    if (req.method !== 'GET' || parsed.pathname !== '/search') {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found. Use GET /search?q=BBRI' }));
        return;
    }

    const query = (parsed.query.q || '').trim();
    const exchange = (parsed.query.exchange || 'IDX').trim();

    if (!query || query.length < 1) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Query param "q" required' }));
        return;
    }

    fetchTradingView(query, exchange, (err, tvData) => {
        if (err) {
            console.error('[Proxy Error]', err.message);
            res.writeHead(502);
            res.end(JSON.stringify({ error: err.message }));
            return;
        }

        // Normalize response — ambil dari .symbols (v3 API) atau array langsung (v1 API)
        const symbols = tvData.symbols || (Array.isArray(tvData) ? tvData : []);

        // Filter: IDX only, exclude warrant/right (-W, -R, dots, type warrant)
        const results = symbols
            .filter(s =>
                s.exchange && s.exchange.toUpperCase().includes('IDX') &&
                s.type !== 'warrant' &&
                !s.symbol.includes('-W') &&
                !s.symbol.includes('-R') &&
                !s.symbol.includes('.')
            )
            .slice(0, 10)
            .map(s => ({
                symbol: s.symbol,
                name: s.description || s.symbol,
                type: s.type || 'stock',
                exchange: s.exchange,
            }));

        res.writeHead(200);
        res.end(JSON.stringify({ results }));
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('  🚀 CuanMeter Proxy berjalan!');
    console.log(`  📡 http://localhost:${PORT}/search?q=BBRI`);
    console.log('');
    console.log('  Buka Analyzer.html di browser, search saham bakal langsung');
    console.log('  real-time dari TradingView lewat proxy ini.');
    console.log('');
    console.log('  Tekan Ctrl+C untuk berhenti.');
    console.log('');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[Error] Port ${PORT} sudah dipakai. Tutup proses lain atau ganti PORT di proxy.js`);
    } else {
        console.error('[Error]', err.message);
    }
    process.exit(1);
});
