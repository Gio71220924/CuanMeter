/**
 * PWA Install Prompt Handler for CuanMeter
 * Manages the "Add to Home Screen" installation experience
 */

(function () {
    let deferredPrompt = null;
    let installButton = null;

    // Check if already installed
    function isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }

    // Show install button if available
    function showInstallPromotion() {
        try {
            // Create install button if doesn't exist
            if (!installButton && !isInstalled()) {
                installButton = document.createElement('button');
                installButton.id = 'install-pwa-btn';
                installButton.className = 'fixed bottom-20 right-4 z-40 bg-primary hover:bg-primary-hover text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold text-sm transition-all transform translate-x-0 hover:scale-105';
                installButton.innerHTML = `
          <span class="material-symbols-outlined text-[20px]">install_mobile</span>
          Install App
        `;
                installButton.style.display = 'flex';

                installButton.addEventListener('click', installApp);
                document.body.appendChild(installButton);

                // Auto-hide after 10 seconds
                setTimeout(() => {
                    if (installButton) {
                        installButton.style.transform = 'translateX(400px)';
                        setTimeout(() => {
                            if (installButton && installButton.parentElement) {
                                installButton.parentElement.removeChild(installButton);
                                installButton = null;
                            }
                        }, 300);
                    }
                }, 10000);
            }
        } catch (error) {
            console.error('Error showing install promotion:', error);
        }
    }

    // Install app function
    async function installApp() {
        try {
            if (!deferredPrompt) {
                console.log('No install prompt available');
                return;
            }

            // Show the install prompt
            deferredPrompt.prompt();

            // Wait for the user to respond
            const { outcome } = await deferredPrompt.userChoice;

            console.log(`User response to install prompt: ${outcome}`);

            if (outcome === 'accepted') {
                if (window.CuanMeterToast) {
                    window.CuanMeterToast.success('Aplikasi berhasil diinstall!');
                }

                // Track installation
                if (window.gtag) {
                    gtag('event', 'pwa_install', {
                        event_category: 'engagement',
                        event_label: 'PWA Installation'
                    });
                }
            }

            // Clear the deferred prompt
            deferredPrompt = null;

            // Hide install button
            if (installButton && installButton.parentElement) {
                installButton.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (installButton && installButton.parentElement) {
                        installButton.parentElement.removeChild(installButton);
                        installButton = null;
                    }
                }, 300);
            }
        } catch (error) {
            console.error('Error during app installation:', error);
            if (window.CuanMeterToast) {
                window.CuanMeterToast.error('Gagal menginstall aplikasi');
            }
        }
    }

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        try {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();

            // Stash the event so it can be triggered later
            deferredPrompt = e;

            // Show custom install promotion
            showInstallPromotion();

            console.log('beforeinstallprompt event captured');
        } catch (error) {
            console.error('Error handling beforeinstallprompt:', error);
        }
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
        try {
            console.log('PWA installed successfully');

            if (window.CuanMeterToast) {
                window.CuanMeterToast.success('StockCalcID berhasil diinstall!');
            }

            // Track successful installation
            if (window.gtag) {
                gtag('event', 'pwa_installed', {
                    event_category: 'engagement',
                    event_label: 'PWA Installed'
                });
            }

            deferredPrompt = null;
        } catch (error) {
            console.error('Error handling appinstalled event:', error);
        }
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration.scope);

                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000); // Check every hour
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
})();
