/**
 * mobileMenu.js — shared mobile nav drawer for all pages
 * Commit: "Feat: mobile menu drawer with overlay and slide-in animation"
 *
 * Requires: each page HTML has:
 *   - <button class="md:hidden p-2..." id="mobileMenuBtn"> (hamburger)
 *   - <nav class="hidden md:flex..." id="desktopNav"> (desktop nav with links)
 * This script clones the nav links into a slide-in drawer on mobile.
 */
(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.querySelector('header button.md\\:hidden');
        const desktopNav = document.querySelector('header nav.hidden.md\\:flex');
        if (!btn || !desktopNav) return;

        // ── Build drawer ───────────────────────────────────────────────────────
        // Overlay (backdrop)
        const overlay = document.createElement('div');
        overlay.id = 'mobileMenuOverlay';
        overlay.className = 'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 opacity-0 pointer-events-none';

        // Drawer panel
        const drawer = document.createElement('div');
        drawer.id = 'mobileMenuDrawer';
        drawer.className = [
            'fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw]',
            'bg-white dark:bg-dark-bg shadow-2xl',
            'flex flex-col',
            'translate-x-full transition-transform duration-300 ease-in-out',
        ].join(' ');

        // Drawer header
        drawer.innerHTML = `
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-dark-border">
        <div class="flex items-center gap-2 font-display font-extrabold text-lg text-slate-900 dark:text-white">
          <span class="material-symbols-outlined text-primary">candlestick_chart</span>
          StockCalcID
        </div>
        <button id="mobileMenuClose" class="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Tutup menu">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <nav id="mobileNav" class="flex flex-col p-4 gap-1 overflow-y-auto flex-1"></nav>
    `;

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);

        // Clone links from desktop nav into mobile nav
        const mobileNav = drawer.querySelector('#mobileNav');
        desktopNav.querySelectorAll('a').forEach(link => {
            const a = link.cloneNode(true);
            // Reset desktop classes, apply mobile-friendly ones
            const isActive = link.classList.contains('text-primary') && !link.classList.contains('hover:text-primary');
            a.className = [
                'flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors',
                isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-surface hover:text-primary',
            ].join(' ');
            mobileNav.appendChild(a);
        });

        // ── Open / Close ───────────────────────────────────────────────────────
        let open = false;

        function openMenu() {
            open = true;
            overlay.classList.remove('opacity-0', 'pointer-events-none');
            overlay.classList.add('opacity-100');
            drawer.classList.remove('translate-x-full');
            drawer.classList.add('translate-x-0');
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            open = false;
            overlay.classList.add('opacity-0', 'pointer-events-none');
            overlay.classList.remove('opacity-100');
            drawer.classList.remove('translate-x-0');
            drawer.classList.add('translate-x-full');
            document.body.style.overflow = '';
        }

        btn.addEventListener('click', () => open ? closeMenu() : openMenu());
        overlay.addEventListener('click', closeMenu);
        drawer.querySelector('#mobileMenuClose').addEventListener('click', closeMenu);

        // Close on Escape key
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) closeMenu(); });
    });
})();
