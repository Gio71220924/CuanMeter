/**
 * Service Worker for CuanMeter
 * Provides offline caching and PWA functionality
 */

const CACHE_VERSION = 'cuanmeter-v1.3.0';
const CACHE_NAME = `${CACHE_VERSION}`;

// Assets to cache immediately
const CORE_ASSETS = [
    '/',
    '/LandingPage.html',
    '/AveragePrice.html',
    '/ARAARB.html',
    '/ProfitCalc.html',
    '/Analyzer.html',
    '/PositionSize.html',
    '/DividendYield.html',
    '/guides/ara-arb.html',
    '/guides/profit-saham.html',
    '/guides/position-sizing.html',
    '/guides/average-down.html',
    '/stockSearch.js',
    '/CSS/LandingPage.css',
    '/CSS/AveragePrice.css',
    '/CSS/ARAARB.css',
    '/CSS/ProfitCalc.css',
    '/CSS/Analyzer.css',
    '/CSS/tailwind-output.css',
    '/landingPage.js',
    '/avg.js',
    '/araarb.js',
    '/profit.js',
    '/analyzer.js',
    '/positionSize.js',
    '/dividend.js',
    '/marketRadar.js',
    '/mobileMenu.js',
    '/shareImage.js',
    '/pwa-install.js',
    '/utils.js',
    '/toast.js',
    '/analytics.js',
    '/animations.js',
    '/manifest.json',
    '/offline.html',
    '/assets/images/favicon.png',
    '/assets/images/desktop-mockup.png',
    '/assets/images/hero-illustration.png'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching core assets');
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip external requests
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response
                const responseToCache = response.clone();

                // Cache the fetched resource
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }

                        // If HTML page and not in cache, return offline page
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/offline.html');
                        }

                        return new Response('Network error', {
                            status: 408,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
