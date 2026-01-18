/**
 * Scroll Animations for CuanMeter
 * Provides smooth fade-in and slide-in animations using Intersection Observer
 */

(function () {
    // Check user's motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        console.log('[Animations] Reduced motion preferred, skipping animations');
        return;
    }

    // Animation configuration
    const animationConfig = {
        root: null,
        rootMargin: '0px 0px -100px 0px',
        threshold: 0.1
    };

    // Intersection Observer callback
    const handleIntersection = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const animationType = element.dataset.animate || 'fade-in';

                // Add animation class
                element.classList.add('animate-' + animationType);
                element.classList.add('animated');

                // Stop observing this element
                observer.unobserve(element);
            }
        });
    };

    // Create observer
    const observer = new IntersectionObserver(handleIntersection, animationConfig);

    // Initialize animations when DOM is ready
    function initAnimations() {
        try {
            // Auto-detect elements to animate
            const elementsToAnimate = document.querySelectorAll('.glass-card, .layout-container > div, section > div');

            elementsToAnimate.forEach((el, index) => {
                // Skip if already has animation class
                if (el.classList.contains('animated')) return;

                // Set initial state
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';

                // Add stagger delay
                el.style.transitionDelay = `${index * 0.1}s`;

                // Set default animation type if not specified
                if (!el.dataset.animate) {
                    el.dataset.animate = 'fade-in';
                }

                // Observe element
                observer.observe(el);
            });

            console.log(`[Animations] Observing ${elementsToAnimate.length} elements`);
        } catch (error) {
            console.error('[Animations] Error initializing animations:', error);
        }
    }

    // CSS for animations
    const styles = document.createElement('style');
    styles.innerHTML = `
    /* Animation base */
    [data-animate] {
      transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    
    /* Fade in animation */
    .animate-fade-in.animated {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
    
    /* Slide in from left */
    .animate-slide-left {
      transform: translateX(-50px) !important;
    }
    
    .animate-slide-left.animated {
      opacity: 1 !important;
      transform: translateX(0) !important;
    }
    
    /* Slide in from right */
    .animate-slide-right {
      transform: translateX(50px) !important;
    }
    
    .animate-slide-right.animated {
      opacity: 1 !important;
      transform: translateX(0) !important;
    }
    
    /* Scale up */
    .animate-scale-up {
      transform: scale(0.95) !important;
    }
    
    .animate-scale-up.animated {
      opacity: 1 !important;
      transform: scale(1) !important;
    }
    
    /* Respect reduced motion preference */
    @media (prefers-reduced-motion: reduce) {
      [data-animate] {
        transition: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
  `;
    document.head.appendChild(styles);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnimations);
    } else {
        initAnimations();
    }
})();
