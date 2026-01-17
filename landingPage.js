// Mobile Menu Toggle
const mobileMenuToggle = document.querySelector('.md\\:hidden');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        if (!mobileMenu) {
            // Create mobile menu if it doesn't exist
            createMobileMenu();
        }
        toggleMobileMenu();
    });
}

function createMobileMenu() {
    const nav = document.querySelector('nav.hidden.md\\:flex');
    if (!nav) return;

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
          <button class="mobile-menu-close p-2 text-slate-900 rounded-lg hover:bg-slate-100">
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
        closeBtn.addEventListener('click', toggleMobileMenu);
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
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (!menu) return;

    menu.classList.toggle('active');
    document.body.classList.toggle('menu-open');
}

// Calculator Navigation Buttons
function initCalculatorButtons() {
    // Average Price Calculator
    const avgPriceBtn = document.querySelector('#tools .grid > div:nth-child(1) button');
    if (avgPriceBtn) {
        avgPriceBtn.addEventListener('click', () => {
            window.location.href = 'AveragePrice.html';
        });
    }

    // ARA/ARB Calculator
    const araArbBtn = document.querySelector('#tools .grid > div:nth-child(2) button');
    if (araArbBtn) {
        araArbBtn.addEventListener('click', () => {
            window.location.href = 'ARAARB.html';
        });
    }

    // Profit Calculator
    const profitBtn = document.querySelector('#tools .grid > div:nth-child(3) button');
    if (profitBtn) {
        profitBtn.addEventListener('click', () => {
            window.location.href = 'ProfitCalc.html';
        });
    }
}

// Lazy Loading Images
function initLazyLoading() {
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
                    observer.unobserve(img);
                }
            });
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
}

// Scroll to Top Button
function initScrollToTop() {
    const scrollBtn = document.getElementById('scroll-to-top');
    if (!scrollBtn) return;

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });

    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Smooth Scroll for Anchor Links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

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
        });
    });
}

// Analytics (placeholder for Google Analytics or other)
function initAnalytics() {
    // Add your analytics initialization here
    // Example: gtag('config', 'GA_MEASUREMENT_ID');
    console.log('Analytics initialized');
}

// Error handling for utils.js
function checkUtils() {
    if (typeof window.CuanMeterUtils === 'undefined') {
        console.warn('CuanMeterUtils not loaded. Some features may not work.');
        return false;
    }
    return true;
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    checkUtils();
    initCalculatorButtons();
    initLazyLoading();
    initSmoothScroll();
    initScrollToTop();
    initAnalytics();

    // Initialize theme from utils
    if (window.CuanMeterUtils && window.CuanMeterUtils.theme) {
        window.CuanMeterUtils.theme.init();
    }
});

// Prevent FOUC (Flash of Unstyled Content) for dark mode
(function () {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
    }
})();
