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

// Calculator Navigation Buttons
function initCalculatorButtons() {
    try {
        // Average Price Calculator
        const avgPriceBtn = document.querySelector('#tools .grid > div:nth-child(1) button');
        if (avgPriceBtn) {
            avgPriceBtn.addEventListener('click', () => {
                try {
                    window.location.href = 'AveragePrice.html';
                } catch (error) {
                    console.error('Error navigating to Average Price calculator:', error);
                    if (window.CuanMeterToast) {
                        window.CuanMeterToast.error('Gagal membuka kalkulator');
                    }
                }
            });
        }

        // ARA/ARB Calculator
        const araArbBtn = document.querySelector('#tools .grid > div:nth-child(2) button');
        if (araArbBtn) {
            araArbBtn.addEventListener('click', () => {
                try {
                    window.location.href = 'ARAARB.html';
                } catch (error) {
                    console.error('Error navigating to ARA/ARB calculator:', error);
                    if (window.CuanMeterToast) {
                        window.CuanMeterToast.error('Gagal membuka kalkulator');
                    }
                }
            });
        }

        // Profit Calculator
        const profitBtn = document.querySelector('#tools .grid > div:nth-child(3) button');
        if (profitBtn) {
            profitBtn.addEventListener('click', () => {
                try {
                    window.location.href = 'ProfitCalc.html';
                } catch (error) {
                    console.error('Error navigating to Profit calculator:', error);
                    if (window.CuanMeterToast) {
                        window.CuanMeterToast.error('Gagal membuka kalkulator');
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error initializing calculator buttons:', error);
    }
}

// Lazy Loading Images
function initLazyLoading() {
    try {
        const images = document.querySelectorAll('img[loading="lazy"]');

        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        img.classList.add('loaded');
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px'
            });

            images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for browsers without IntersectionObserver
            images.forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
            });
        }
    } catch (error) {
        console.error('Error initializing lazy loading:', error);
    }
}

// Scroll to Top Button
function initScrollToTop() {
    try {
        const scrollBtn = document.getElementById('scroll-to-top');
        if (!scrollBtn) {
            console.warn('Scroll to top button not found');
            return;
        }

        let isScrolling = false;

        window.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    if (window.pageYOffset > 300) {
                        scrollBtn.classList.add('visible');
                    } else {
                        scrollBtn.classList.remove('visible');
                    }
                    isScrolling = false;
                });
                isScrolling = true;
            }
        }, { passive: true });

        scrollBtn.addEventListener('click', () => {
            try {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            } catch (error) {
                // Fallback for older browsers
                window.scrollTo(0, 0);
            }
        });
    } catch (error) {
        console.error('Error initializing scroll to top:', error);
    }
}

// Smooth Scroll for Anchor Links
function initSmoothScroll() {
    try {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                try {
                    const href = this.getAttribute('href');
                    if (href === '#' || !href) return;

                    const target = document.querySelector(href);
                    if (target) {
                        e.preventDefault();
                        const headerOffset = 80;
                        const elementPosition = target.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    }
                } catch (error) {
                    console.error('Error in smooth scroll:', error);
                }
            });
        });
    } catch (error) {
        console.error('Error initializing smooth scroll:', error);
    }
}

// Stock Marquee Real-time Updates
async function initStockMarquee() {
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

    async function updateMarquee() {
        try {
            const response = await fetch('http://localhost:3001/api/prices');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            let htmlContent = '';
            
            // Duplicate the items for smooth marquee effect
            const displayItems = [...symbols, ...symbols];

            displayItems.forEach(item => {
                const stockData = data[item.ticker] || { price: 0, change: 0, pct: 0 };
                const isUp = stockData.change >= 0;
                const colorClass = isUp 
                    ? 'text-accent-mint bg-accent-mint/10' 
                    : 'text-red-500 bg-red-500/10';
                const icon = isUp ? 'arrow_upward' : 'arrow_downward';
                const sign = isUp ? '+' : '';

                htmlContent += `
                    <span class="flex items-center gap-3 hover:text-slate-900 dark:hover:text-white transition-colors cursor-default">
                        ${item.label}
                        <span class="${colorClass} px-2 py-0.5 rounded flex items-center gap-1 transition-colors">
                            ${window.CuanMeterUtils ? window.CuanMeterUtils.formatters.nf2.format(stockData.price) : stockData.price}
                            <span class="material-symbols-outlined text-[16px]">${icon}</span>
                            <span class="text-[10px] ml-1">(${sign}${stockData.pct.toFixed(2)}%)</span>
                        </span>
                    </span>
                `;
            });

            marqueeContainer.innerHTML = htmlContent;
        } catch (error) {
            console.error('Error fetching stock prices:', error);
            // Optionally show an error state in the marquee
        }
    }

    // Initial update
    updateMarquee();

    // Update every 3 seconds
    setInterval(updateMarquee, 3000);
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

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        checkUtils();
        initCalculatorButtons();
        initLazyLoading();
        initSmoothScroll();
        initScrollToTop();
        initAnalytics();
        initStockMarquee();

        // Initialize theme from utils
        if (window.CuanMeterUtils && window.CuanMeterUtils.theme) {
            window.CuanMeterUtils.theme.init();
        }
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

