/**
 * StockSearch — Reusable stock search component for CuanMeter calculators
 * Usage: window.StockSearch.init({ insertBefore, onSelect, label, placeholder })
 */
window.StockSearch = (function () {
  let _timer = null;
  let _activeInstance = null;

  const DEBOUNCE_MS = 300;
  const STOCKBIT_CDN = 'https://assets.stockbit.com/logos/companies';

  function init({ insertBefore, onSelect, label, placeholder }) {
    if (!insertBefore) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'stock-search-widget mb-6 relative';
    wrapper.innerHTML = `
      <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 transition-colors">
        <span class="material-symbols-outlined text-[16px] align-middle mr-1 text-primary">search</span>
        ${label || 'Cari Saham IDX'}
      </label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <span class="material-symbols-outlined text-slate-400 text-[20px]">manage_search</span>
        </div>
        <input type="text" autocomplete="off" spellcheck="false"
          class="stock-search-input w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-bg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-base"
          placeholder="${placeholder || 'Ketik kode saham, misal BBRI...'}" />
      </div>
      <div class="stock-search-dropdown hidden absolute left-0 right-0 mt-1 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto"></div>
      <div class="stock-search-status hidden mt-2"></div>
    `;

    insertBefore.parentNode.insertBefore(wrapper, insertBefore);

    const input = wrapper.querySelector('.stock-search-input');
    const dropdown = wrapper.querySelector('.stock-search-dropdown');
    const statusEl = wrapper.querySelector('.stock-search-status');

    // Debounced search
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(_timer);

      if (q.length < 2) {
        hideDropdown(dropdown);
        return;
      }

      _timer = setTimeout(() => fetchSearch(q, dropdown, statusEl, input, onSelect), DEBOUNCE_MS);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideDropdown(dropdown);
        input.blur();
      }
      if (e.key === 'ArrowDown' && !dropdown.classList.contains('hidden')) {
        e.preventDefault();
        const first = dropdown.querySelector('[data-symbol]');
        if (first) first.focus();
      }
    });

    // Outside click dismiss
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        hideDropdown(dropdown);
      }
    });

    return { wrapper, input, destroy: () => wrapper.remove() };
  }

  async function fetchSearch(query, dropdown, statusEl, input, onSelect) {
    try {
      dropdown.innerHTML = `
        <div class="p-4 text-center text-slate-400 dark:text-slate-500">
          <span class="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          <p class="text-xs mt-1">Mencari...</p>
        </div>`;
      dropdown.classList.remove('hidden');

      const res = await fetch(`/search?q=${encodeURIComponent(query)}&exchange=IDX`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        dropdown.innerHTML = `
          <div class="p-4 text-center text-slate-400 dark:text-slate-500 text-sm">
            <span class="material-symbols-outlined text-2xl mb-1 block">search_off</span>
            Tidak ditemukan untuk "<strong>${escapeHtml(query)}</strong>"
          </div>`;
        return;
      }

      dropdown.innerHTML = data.results.map((item) => {
        const code = item.symbol.replace('IDX:', '').split(':').pop();
        return `
          <button type="button" data-symbol="${escapeHtml(code)}" data-name="${escapeHtml(item.name)}"
            class="stock-search-item w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-dark-bg/50 transition-colors focus:bg-slate-50 dark:focus:bg-dark-bg/50 focus:outline-none border-b border-slate-100 dark:border-dark-border last:border-0">
            <div class="size-9 rounded-lg bg-slate-100 dark:bg-dark-bg flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="${STOCKBIT_CDN}/${code}.png" alt="${code}"
                class="size-9 object-contain"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
              <span class="text-xs font-black text-primary hidden items-center justify-center size-full">${code.slice(0, 2)}</span>
            </div>
            <div class="min-w-0 flex-1">
              <span class="block text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(code)}</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">${escapeHtml(item.name)}</span>
            </div>
            <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[18px] flex-shrink-0">chevron_right</span>
          </button>`;
      }).join('');

      // Click handlers for each item
      dropdown.querySelectorAll('[data-symbol]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const symbol = btn.dataset.symbol;
          const name = btn.dataset.name;
          hideDropdown(dropdown);
          input.value = symbol;
          fetchPrice(symbol, name, statusEl, onSelect);
        });

        // Keyboard navigation inside dropdown
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = btn.nextElementSibling;
            if (next) next.focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = btn.previousElementSibling;
            if (prev) prev.focus(); else input.focus();
          } else if (e.key === 'Escape') {
            hideDropdown(dropdown);
            input.focus();
          }
        });
      });
    } catch (err) {
      console.error('[StockSearch] Search error:', err);
      dropdown.innerHTML = `
        <div class="p-4 text-center text-red-500 text-sm">
          <span class="material-symbols-outlined text-2xl mb-1 block">error</span>
          Gagal mencari. Coba lagi.
        </div>`;
    }
  }

  async function fetchPrice(symbol, name, statusEl, onSelect) {
    try {
      showStatus(statusEl, 'loading', `Mengambil harga ${symbol}...`);

      const res = await fetch(`/price?ticker=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.price || data.price <= 0) {
        showStatus(statusEl, 'error', `Harga ${symbol} tidak tersedia`);
        if (window.CuanMeterToast) window.CuanMeterToast.warning(`Harga ${symbol} tidak tersedia`);
        return;
      }

      const price = data.price;
      const changePct = data.change_pct || 0;
      const isUp = changePct >= 0;

      // Show status pill
      const fmt = window.CuanMeterUtils ? window.CuanMeterUtils.formatters : null;
      const priceStr = fmt ? fmt.nf0.format(price) : price.toLocaleString('id-ID');
      const pctStr = (isUp ? '+' : '') + changePct.toFixed(2) + '%';

      const pillColor = isUp
        ? 'bg-accent-mint-light dark:bg-accent-mint/10 text-accent-mint border-emerald-100 dark:border-accent-mint/20'
        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-100 dark:border-rose-500/20';

      statusEl.innerHTML = `
        <div class="flex items-center gap-2 flex-wrap">
          <div class="size-7 rounded-lg bg-slate-100 dark:bg-dark-bg flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="${STOCKBIT_CDN}/${symbol}.png" alt="${symbol}" class="size-7 object-contain"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
            <span class="text-[10px] font-black text-primary hidden items-center justify-center size-full">${symbol.slice(0, 2)}</span>
          </div>
          <span class="text-sm font-bold text-slate-900 dark:text-white">${symbol}</span>
          <span class="text-sm font-semibold text-slate-600 dark:text-slate-400">Rp ${priceStr}</span>
          <span class="inline-flex items-center rounded-full ${pillColor} px-2 py-0.5 text-xs font-bold border">
            <span class="material-symbols-outlined text-[14px] mr-0.5">${isUp ? 'trending_up' : 'trending_down'}</span>
            ${pctStr}
          </span>
        </div>`;
      statusEl.classList.remove('hidden');

      // Callback
      if (typeof onSelect === 'function') {
        onSelect({ ticker: symbol, name: name, price: price });
      }

      if (window.CuanMeterToast) {
        window.CuanMeterToast.success(`Harga ${symbol}: Rp ${priceStr}`);
      }
    } catch (err) {
      console.error('[StockSearch] Price fetch error:', err);
      showStatus(statusEl, 'error', `Gagal mengambil harga ${symbol}`);
      if (window.CuanMeterToast) window.CuanMeterToast.error(`Gagal mengambil harga ${symbol}`);
    }
  }

  function showStatus(el, type, msg) {
    if (!el) return;
    el.classList.remove('hidden');
    if (type === 'loading') {
      el.innerHTML = `
        <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span class="material-symbols-outlined animate-spin text-primary text-[18px]">progress_activity</span>
          ${escapeHtml(msg)}
        </div>`;
    } else if (type === 'error') {
      el.innerHTML = `
        <div class="flex items-center gap-2 text-sm text-red-500">
          <span class="material-symbols-outlined text-[18px]">error</span>
          ${escapeHtml(msg)}
        </div>`;
    }
  }

  function hideDropdown(dropdown) {
    if (dropdown) dropdown.classList.add('hidden');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  return { init };
})();
