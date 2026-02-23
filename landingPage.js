// Mobile Menu Toggle
const mobileMenuToggle = document.querySelector('button.md\\:hidden');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', (e) => {
        try {
            e.preventDefault();
            if (!document.getElementById('mobile-menu')) {
                // Create mobile menu if it doesn't exist
                createMobileMenu();
            }
            toggleMobileMenu();
        } catch (error) {
            console.error('Error toggling mobile menu:', error);
            if (window.CuanMeterToast) {
                window.CuanMeterToast.error('Gagal membuka menu');
            }
        }
    });
}

function createMobileMenu() {
    try {
        const nav = document.querySelector('nav.hidden.md\\:flex');
        if (!nav) {
            console.warn('Navigation element not found');
            return;
        }

        const mobileMenuHTML = `
    <div id="mobile-menu" class="mobile-menu">
      <div class="mobile-menu-backdrop"></div>
      <div class="mobile-menu-panel">
        <div class="mobile-menu-header">
          <div class="flex items-center gap-3">
            <div class="size-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <span class="material-symbols-outlined text-[24px]">candlestick_chart</span>
            </div>
            <h2 class="text-xl font-extrabold text-slate-900 font-display">StockCalcID</h2>
          </div>
          <button class="mobile-menu-close p-2 text-slate-900 rounded-lg hover:bg-slate-100" aria-label="Tutup menu">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav class="mobile-menu-nav">
          <a class="mobile-menu-link" href="AveragePrice.html">
            <span class="material-symbols-outlined">calculate</span>
            Kalkulator Rata-rata Saham
          </a>
          <a class="mobile-menu-link" href="ARAARB.html">
            <span class="material-symbols-outlined">vertical_align_center</span>
            Cek ARA/ARB
          </a>
          <a class="mobile-menu-link" href="ProfitCalc.html">
            <span class="material-symbols-outlined">savings</span>
            Simulasi Profit
          </a>
          <a class="mobile-menu-link" href="PositionSize.html">
            <span class="material-symbols-outlined">security</span>
            Kalkulator Amunisi
          </a>
          <a class="mobile-menu-link" href="DividendYield.html">
            <span class="material-symbols-outlined">payments</span>
            Kalkulator Dividen
          </a>
          <a class="mobile-menu-link" href="#tools">
            <span class="material-symbols-outlined">apps</span>
            Semua Kalkulator
          </a>
          <a class="mobile-menu-link" href="#guides">
            <span class="material-symbols-outlined">menu_book</span>
            Panduan
          </a>
        </nav>
      </div>
    </div>
  `;

        document.body.insertAdjacentHTML('beforeend', mobileMenuHTML);

        // Add event listener to close button
        const closeBtn = document.querySelector('.mobile-menu-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                try {
                    e.preventDefault();
                    toggleMobileMenu();
                } catch (error) {
                    console.error('Error closing mobile menu:', error);
                }
            });
        }

        // Close on backdrop click
        const backdrop = document.querySelector('.mobile-menu-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', toggleMobileMenu);
        }

        // Close on link click
        const links = document.querySelectorAll('.mobile-menu-link');
        links.forEach(link => {
            link.addEventListener('click', () => {
                setTimeout(toggleMobileMenu, 300);
            });
        });
    } catch (error) {
        console.error('Error creating mobile menu:', error);
        if (window.CuanMeterToast) {
            window.CuanMeterToast.error('Gagal membuat menu mobile');
        }
    }
}

function toggleMobileMenu() {
    try {
        const menu = document.getElementById('mobile-menu');
        if (!menu) {
            console.warn('Mobile menu not found');
            return;
        }

        menu.classList.toggle('active');
        document.body.classList.toggle('menu-open');

        // Manage focus for accessibility
        if (menu.classList.contains('active')) {
            const closeBtn = menu.querySelector('.mobile-menu-close');
            if (closeBtn) closeBtn.focus();
        }
    } catch (error) {
        console.error('Error in toggleMobileMenu:', error);
    }
}

// Stock Marquee Real-time Updates via SSE
function initStockMarquee() {
    const marqueeContainer = document.getElementById('stock-marquee');
    if (!marqueeContainer) return;

    const symbols = [
        { ticker: 'IDX:COMPOSITE', label: 'IHSG' },
        { ticker: 'IDX:LQ45', label: 'LQ45' },
        { ticker: 'IDX:BBCA', label: 'BBCA' },
        { ticker: 'IDX:BUMI', label: 'BUMI' },
        { ticker: 'IDX:BBNI', label: 'BBNI' },
        { ticker: 'IDX:ADMR', label: 'ADMR' },
        { ticker: 'IDX:PTBA', label: 'PTBA' },
        { ticker: 'IDX:AADI', label: 'AADI' },
        { ticker: 'IDX:ANTM', label: 'ANTM' },
        { ticker: 'IDX:MBMA', label: 'MBMA' },
        { ticker: 'IDX:BBRI', label: 'BBRI' },
        { ticker: 'BINANCE:BTCUSDT', label: 'BTC/USDT' },
        { ticker: 'OANDA:XAUUSD', label: 'Gold (XAUUSD)' }
    ];

    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : '';

    const fmt = window.CuanMeterUtils ? window.CuanMeterUtils.formatters.nf2 : { format: v => v.toFixed(2) };

    // Track previous prices to detect direction of change
    const prevPrices = {};

    // Build initial marquee DOM (only once)
    function buildMarquee(data) {
        const displaySymbols = [...symbols, ...symbols]; // duplicate for seamless loop
        marqueeContainer.innerHTML = displaySymbols.map((item, i) => {
            const d = data[item.ticker] || { price: 0, change: 0, pct: 0 };
            const up = d.change >= 0;
            const sign = up ? '+' : '';
            const colorClass = up ? 'text-accent-mint bg-accent-mint/10' : 'text-red-500 bg-red-500/10';
            const icon = up ? 'arrow_upward' : 'arrow_downward';
            return `
                <span class="flex items-center gap-3 hover:text-slate-900 dark:hover:text-white transition-colors cursor-default" data-ticker="${item.ticker}" data-idx="${i}">
                    ${item.label}
                    <span class="price-badge ${colorClass} px-2 py-0.5 rounded flex items-center gap-1 transition-all duration-300">
                        <span class="price-val">${fmt.format(d.price)}</span>
                        <span class="material-symbols-outlined text-[16px] price-icon">${icon}</span>
                        <span class="text-[10px] ml-1 price-pct">(${sign}${d.pct.toFixed(2)}%)</span>
                    </span>
                </span>
            `;
        }).join('');

        // Save initial prices
        symbols.forEach(s => { prevPrices[s.ticker] = (data[s.ticker] || {}).price || 0; });
    }

    // Flash animation: briefly highlight the badge
    function flashBadge(el, direction) {
        const flashClass = direction === 'up' ? 'marquee-flash-up' : 'marquee-flash-down';
        el.classList.add(flashClass);
        setTimeout(() => el.classList.remove(flashClass), 600);
    }

    // Patch only changed values in the DOM
    function patchMarquee(data) {
        symbols.forEach(item => {
            const d = data[item.ticker];
            if (!d) return;

            const prev = prevPrices[item.ticker] || 0;
            const changed = d.price !== prev;
            const direction = d.price > prev ? 'up' : 'down';

            // Update all instances (original + duplicate) for this ticker
            marqueeContainer.querySelectorAll(`[data-ticker="${item.ticker}"]`).forEach(span => {
                const badge = span.querySelector('.price-badge');
                const valEl = span.querySelector('.price-val');
                const iconEl = span.querySelector('.price-icon');
                const pctEl = span.querySelector('.price-pct');
                if (!badge || !valEl) return;

                const up = d.change >= 0;
                const sign = up ? '+' : '';
                const newColor = up ? 'text-accent-mint bg-accent-mint/10' : 'text-red-500 bg-red-500/10';

                valEl.textContent = fmt.format(d.price);
                if (iconEl) iconEl.textContent = up ? 'arrow_upward' : 'arrow_downward';
                if (pctEl) pctEl.textContent = `(${sign}${d.pct.toFixed(2)}%)`;

                // Update color class
                badge.className = `price-badge ${newColor} px-2 py-0.5 rounded flex items-center gap-1 transition-all duration-300`;

                // Flash only on actual price change
                if (changed) flashBadge(badge, direction);
            });

            prevPrices[item.ticker] = d.price;
        });
    }

    let built = false;

    // ── SSE connection ──────────────────────────────────────────────────────
    function connectSSE() {
        const es = new EventSource(`${API_BASE}/api/prices/stream`);

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!built) { buildMarquee(data); built = true; }
                else { patchMarquee(data); }
            } catch (e) { console.error('SSE parse error', e); }
        };

        es.onerror = () => {
            console.warn('[Marquee] SSE disconnected, reconnecting in 5s...');
            es.close();
            setTimeout(connectSSE, 5000);
        };
    }

    connectSSE();
}


// Analytics (placeholder for Google Analytics or other)
function initAnalytics() {
    try {
        // Add your analytics initialization here
        // Example: gtag('config', 'GA_MEASUREMENT_ID');
        console.log('Analytics initialized');
    } catch (error) {
        console.error('Error initializing analytics:', error);
    }
}

// Error handling for utils.js
function checkUtils() {
    try {
        if (typeof window.CuanMeterUtils === 'undefined') {
            console.warn('CuanMeterUtils not loaded. Some features may not work.');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking utils:', error);
        return false;
    }
}

function initLazyLoading() {
    // Basic lazy loading for images if needed
}

function initSmoothScroll() {
    // Add smooth scroll behavior to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

function initScrollToTop() {
    // Placeholder for scroll to top button logic if added later
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        checkUtils();
        initLazyLoading();
        initSmoothScroll();
        initScrollToTop();
        initAnalytics();
        initStockMarquee();

        // Theme initialization is now handled directly in the HTML scripts
        // to prevent double-initialization or conflicts.
    } catch (error) {
        console.error('Error during initialization:', error);
        if (window.CuanMeterToast) {
            window.CuanMeterToast.error('Terjadi kesalahan saat memuat halaman');
        }
    }
});

// Prevent FOUC (Flash of Unstyled Content) for dark mode
(function () {
    try {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark');
        }
    } catch (error) {
        console.error('Error preventing FOUC:', error);
    }
})();

