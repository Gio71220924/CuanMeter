/**
 * Analytics Module for CuanMeter
 * Handles Google Analytics 4, Web Vitals tracking, and custom events
 */

(function () {
    const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your actual GA4 measurement ID

    // Initialize Google Analytics 4
    function initGA4() {
        try {
            // Load gtag.js
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
            document.head.appendChild(script);

            // Initialize gtag
            window.dataLayer = window.dataLayer || [];
            function gtag() { dataLayer.push(arguments); }
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', GA_MEASUREMENT_ID, {
                send_page_view: true,
                cookie_flags: 'SameSite=None;Secure'
            });

            console.log('[Analytics] Google Analytics 4 initialized');
        } catch (error) {
            console.error('[Analytics] Error initializing GA4:', error);
        }
    }

    // Track Web Vitals
    function trackWebVitals() {
        try {
            // Function to send vital to GA4
            function sendToGA(metric) {
                if (window.gtag) {
                    gtag('event', metric.name, {
                        event_category: 'Web Vitals',
                        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
                        event_label: metric.id,
                        non_interaction: true,
                    });

                    console.log(`[Analytics] ${metric.name}:`, Math.round(metric.value));
                }
            }

            // Simplified Web Vitals tracking using PerformanceObserver
            // CLS - Cumulative Layout Shift
            let cls = 0;
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        cls += entry.value;
                    }
                }
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });

            // Report CLS on page hide
            addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    sendToGA({ name: 'CLS', value: cls, id: generateId() });
                }
            });

            // FCP - First Contentful Paint
            const fcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const fcp = entries[entries.length - 1];
                sendToGA({ name: 'FCP', value: fcp.startTime, id: generateId() });
                fcpObserver.disconnect();
            });
            fcpObserver.observe({ type: 'paint', buffered: true });

            // LCP - Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lcp = entries[entries.length - 1];
                sendToGA({ name: 'LCP', value: lcp.renderTime || lcp.loadTime, id: generateId() });
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

            // FID - First Input Delay
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const fid = entries[0];
                sendToGA({ name: 'FID', value: fid.processingStart - fid.startTime, id: generateId() });
                fidObserver.disconnect();
            });
            fidObserver.observe({ type: 'first-input', buffered: true });

            console.log('[Analytics] Web Vitals tracking initialized');
        } catch (error) {
            console.error('[Analytics] Error tracking Web Vitals:', error);
        }
    }

    // Generate unique ID for vitals
    function generateId() {
        return `v1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Track custom events
    function trackEvent(eventName, eventParams = {}) {
        try {
            if (window.gtag) {
                gtag('event', eventName, eventParams);
                console.log(`[Analytics] Event tracked: ${eventName}`, eventParams);
            }
        } catch (error) {
            console.error('[Analytics] Error tracking event:', error);
        }
    }

    // Track calculator usage
    function trackCalculatorUsage(calculatorType) {
        trackEvent('calculator_opened', {
            event_category: 'engagement',
            event_label: calculatorType,
            value: 1
        });
    }

    // Track navigation
    function trackNavigation(destination) {
        trackEvent('navigation', {
            event_category: 'engagement',
            event_label: destination
        });
    }

    // Track errors
    function trackError(errorMessage, errorStack) {
        trackEvent('javascript_error', {
            event_category: 'error',
            event_label: errorMessage,
            value: 1,
            error_stack: errorStack
        });
    }

    // Global error handler
    window.addEventListener('error', (event) => {
        trackError(event.message, event.error ? event.error.stack : '');
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        trackError('Unhandled Promise Rejection: ' + event.reason, '');
    });

    // Expose analytics functions globally
    window.CuanMeterAnalytics = {
        trackEvent,
        trackCalculatorUsage,
        trackNavigation,
        trackError
    };

    // Initialize analytics
    function init() {
        // Only initialize if not in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('[Analytics] Development mode, analytics disabled');
            return;
        }

        initGA4();

        // Track Web Vitals after page load
        if (document.readyState === 'complete') {
            trackWebVitals();
        } else {
            window.addEventListener('load', trackWebVitals);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
