/**
 * Toast Notification System for CuanMeter
 * Provides user feedback for actions, errors, and success states
 */

window.CuanMeterToast = (function () {
    let toastContainer = null;
    let toastId = 0;

    // Initialize toast container
    function initContainer() {
        if (toastContainer) return;

        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-20 right-4 z-[100] flex flex-col gap-3 pointer-events-none';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toastContainer);
    }

    // Toast configuration
    const config = {
        success: {
            icon: 'check_circle',
            bgClass: 'bg-accent-mint',
            iconBgClass: 'bg-green-600',
            textClass: 'text-green-50'
        },
        error: {
            icon: 'error',
            bgClass: 'bg-red-500',
            iconBgClass: 'bg-red-600',
            textClass: 'text-red-50'
        },
        warning: {
            icon: 'warning',
            bgClass: 'bg-accent-yellow',
            iconBgClass: 'bg-amber-600',
            textClass: 'text-amber-50'
        },
        info: {
            icon: 'info',
            bgClass: 'bg-primary',
            iconBgClass: 'bg-sky-600',
            textClass: 'text-sky-50'
        }
    };

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (default: 4000)
     */
    function show(message, type = 'info', duration = 4000) {
        try {
            initContainer();

            const id = ++toastId;
            const toastConfig = config[type] || config.info;

            const toast = document.createElement('div');
            toast.id = `toast-${id}`;
            toast.className = `pointer-events-auto flex items-start gap-3 ${toastConfig.bgClass} ${toastConfig.textClass} px-4 py-3 rounded-xl shadow-lg min-w-[300px] max-w-md transform translate-x-[400px] transition-transform duration-300 ease-out`;
            toast.setAttribute('role', 'alert');

            toast.innerHTML = `
        <div class="${toastConfig.iconBgClass} rounded-lg p-1.5 flex-shrink-0">
          <span class="material-symbols-outlined text-[20px] text-white">${toastConfig.icon}</span>
        </div>
        <div class="flex-1 pt-0.5">
          <p class="font-medium leading-snug">${escapeHtml(message)}</p>
        </div>
        <button class="toast-close ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors" aria-label="Close notification">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      `;

            toastContainer.appendChild(toast);

            // Trigger animation
            setTimeout(() => {
                toast.style.transform = 'translateX(0)';
            }, 10);

            // Close button handler
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => {
                hideToast(toast);
            });

            // Auto-dismiss
            if (duration > 0) {
                setTimeout(() => {
                    hideToast(toast);
                }, duration);
            }

            return id;
        } catch (error) {
            console.error('Error showing toast:', error);
            return null;
        }
    }

    /**
     * Hide a toast notification
     * @param {HTMLElement} toast - Toast element to hide
     */
    function hideToast(toast) {
        if (!toast || !toast.parentElement) return;

        toast.style.transform = 'translateX(400px)';
        toast.style.opacity = '0';

        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Convenience methods
    return {
        show,
        success: (message, duration) => show(message, 'success', duration),
        error: (message, duration) => show(message, 'error', duration),
        warning: (message, duration) => show(message, 'warning', duration),
        info: (message, duration) => show(message, 'info', duration)
    };
})();
