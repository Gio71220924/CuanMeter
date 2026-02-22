(() => {
  const API_BASE = "https://api-saham.mkemalw.workers.dev/cache-summary";
  
  const els = {
    tickerInput: document.getElementById("tickerInput"),
    dateFrom: document.getElementById("dateFrom"),
    dateTo: document.getElementById("dateTo"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    
    loading: document.getElementById("loadingState"),
    results: document.getElementById("resultsContainer"),
    
    valForeign: document.getElementById("valForeign"),
    statusForeign: document.getElementById("statusForeign"),
    
    valLocal: document.getElementById("valLocal"),
    statusLocal: document.getElementById("statusLocal"),
    
    valRetail: document.getElementById("valRetail"),
    statusRetail: document.getElementById("statusRetail"),
    
    listTopBuyers: document.getElementById("listTopBuyers"),
    listTopSellers: document.getElementById("listTopSellers"),
    suggestBox: document.getElementById("suggestBox"),
  };

  if (!els.analyzeBtn) return;

  const { formatters } = window.CuanMeterUtils;
  let searchTimeout = null;

  // --- Search Suggestions (Modern & Dynamic) ---
  const updateSuggestions = async () => {
    let query = els.tickerInput.value.trim().toUpperCase();
    
    // Auto-update input value for better UX
    if (els.tickerInput.value !== query) {
      els.tickerInput.value = query;
    }

    if (query.length < 1) {
      els.suggestBox.innerHTML = "";
      els.suggestBox.classList.add("hidden");
      return;
    }

    // Always show the "Primary Action" first
    let html = `
      <div class="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-100 dark:border-dark-border bg-primary/5 group transition-colors" data-ticker="${query}">
        <div class="flex items-center gap-3">
          <div class="size-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary text-lg">analytics</span>
          </div>
          <div>
            <div class="font-bold text-slate-900 dark:text-white">Analisa "${query}"</div>
            <div class="text-[10px] text-slate-400 font-medium">Tekan Enter untuk mulai analisa</div>
          </div>
        </div>
        <span class="material-symbols-outlined text-primary text-sm opacity-0 group-hover:opacity-100 transition-all">keyboard_return</span>
      </div>
    `;

    els.suggestBox.innerHTML = html;
    els.suggestBox.classList.remove("hidden");

    // Debounce to prevent API spamming
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (query.length < 2) return;

      try {
        // Fetch from TradingView (The Industry Standard for Stock Lists)
        const targetUrl = `https://symbol-search.tradingview.com/symbol_search/?text=${query}&exchange=IDX&type=stock`;
        
        // Try multiple reliable proxies
        const proxies = [
          `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
        ];

        let matches = [];
        for (const proxy of proxies) {
          try {
            const resp = await fetch(proxy);
            if (resp.ok) {
              matches = await resp.json();
              if (Array.isArray(matches) && matches.length > 0) break;
            }
          } catch (e) { continue; }
        }

        if (matches && Array.isArray(matches) && matches.length > 0) {
          // Filter out warrants (W) and other non-stock entities
          const filtered = matches
            .filter(m => !m.symbol.includes('-W') && !m.symbol.includes('.'))
            .slice(0, 7);

          const suggestions = filtered.map(m => {
            // Highlight the matching part of the ticker
            const highlightedSymbol = m.symbol.replace(query, `<span class="text-primary">${query}</span>`);
            
            return `
              <div class="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-100 dark:border-dark-border last:border-none group transition-colors" data-ticker="${m.symbol}">
                <div class="flex items-center gap-3 overflow-hidden">
                  <div class="relative size-10 shrink-0 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-dark-border group-hover:border-primary/30 transition-colors">
                    <img src="https://assets.stockbit.com/logos/companies/${m.symbol}.png" 
                         alt="${m.symbol}" 
                         class="w-full h-full object-contain p-1.5"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="hidden absolute inset-0 items-center justify-center text-[11px] font-black text-slate-400 uppercase">
                      ${m.symbol.slice(0, 2)}
                    </div>
                  </div>
                  <div class="flex flex-col overflow-hidden">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">${highlightedSymbol}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase">${m.type}</span>
                    </div>
                    <span class="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
                      ${m.description}
                    </span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-slate-300 text-sm opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">arrow_forward</span>
              </div>
            `;
          }).join("");

          if (suggestions) {
            els.suggestBox.innerHTML = html + suggestions;
          }
        } else if (query.length >= 3) {
            // No results found from API but user typed a lot
            els.suggestBox.innerHTML = html + `
              <div class="px-4 py-6 text-center">
                <span class="material-symbols-outlined text-slate-300 text-3xl mb-1">inventory_2</span>
                <div class="text-xs text-slate-400 font-medium">Emiten tidak ditemukan</div>
              </div>
            `;
        }
      } catch (err) {
        console.error("Search Logic Error:", err);
      }
    }, 350);
  };

  els.tickerInput.addEventListener("input", updateSuggestions);

  els.suggestBox.addEventListener("click", (e) => {
    const item = e.target.closest("[data-ticker]");
    if (item) {
      els.tickerInput.value = item.dataset.ticker;
      els.suggestBox.classList.add("hidden");
      fetchData();
    }
  });

  // Close suggestions on outside click
  document.addEventListener("click", (e) => {
    if (!els.tickerInput.contains(e.target) && !els.suggestBox.contains(e.target)) {
      els.suggestBox.classList.add("hidden");
    }
  });

  // --- Formatters ---
  const formatMoneyBig = (val) => {
      const absVal = Math.abs(val);
      if (absVal >= 1e12) return (val / 1e12).toFixed(2) + " T";
      if (absVal >= 1e9) return (val / 1e9).toFixed(2) + " M";
      if (absVal >= 1e6) return (val / 1e6).toFixed(2) + " Jt";
      return formatters.nf0.format(val);
  };

  const setStatus = (el, val, type) => {
      const isPos = val > 0;
      if (val === 0) {
          el.textContent = "Netral";
          el.className = "text-xs font-bold mt-1 text-slate-400";
          return;
      }

      if (type === 'retail') {
          // For Retail: Negative is usually GOOD (Smart Money collecting)
          // Positive is usually BAD (Retail holding bag)
          if (!isPos) {
              el.textContent = "Distribusi (Bagus)";
              el.className = "text-xs font-bold mt-1 text-emerald-500";
          } else {
              el.textContent = "Akumulasi (Hati-hati)";
              el.className = "text-xs font-bold mt-1 text-rose-500";
          }
      } else {
          // For Foreign/Local: Positive is Accumulation (Good)
          if (isPos) {
              el.textContent = "Akumulasi";
              el.className = "text-xs font-bold mt-1 text-emerald-500";
          } else {
              el.textContent = "Distribusi";
              el.className = "text-xs font-bold mt-1 text-rose-500";
          }
      }
  };

  // --- Logic ---
  const fetchData = async () => {
      let ticker = els.tickerInput.value.trim().toUpperCase();
      const from = els.dateFrom.value;
      const to = els.dateTo.value;

      if (!ticker) {
          if(window.CuanMeterToast) window.CuanMeterToast.error("Masukkan kode saham!");
          return;
      }
      if (!from || !to) {
          if(window.CuanMeterToast) window.CuanMeterToast.error("Pilih rentang tanggal!");
          return;
      }

      // UI Loading
      els.loading.classList.remove("hidden");
      els.results.classList.add("hidden");
      els.suggestBox.classList.add("hidden");
      
      try {
          const url = `${API_BASE}?symbol=${ticker}&from=${from}&to=${to}`;
          const response = await fetch(url);
          
          if (!response.ok) {
              const errText = await response.text();
              console.error("API Error Response:", errText);
              throw new Error("Gagal mengambil data dari server. Coba lagi nanti atau cek kode saham.");
          }
          
          const json = await response.json();
          console.log("API Success Data:", json);

          if (!json || (!json.summary && !json.data)) {
              throw new Error("Data tidak tersedia untuk periode ini.");
          }

          // Handle different possible JSON structures from the worker
          const dataToRender = json.summary ? json : (json.data ? { summary: json.data } : null);
          
          if (!dataToRender || !dataToRender.summary) {
              throw new Error("Format data tidak dikenali.");
          }

          render(dataToRender);
          
      } catch (err) {
          console.error("Fetch Error:", err);
          if(window.CuanMeterToast) window.CuanMeterToast.error(err.message);
      } finally {
          els.loading.classList.add("hidden");
      }
  };

  const render = (data) => {
      const summary = data.summary;
      if (!summary) return;

      const { foreign, local, retail } = summary;

      // 1. Summary Cards
      if (foreign) {
          els.valForeign.textContent = formatMoneyBig(foreign.net_val || 0);
          setStatus(els.statusForeign, foreign.net_val || 0, 'foreign');
      }

      if (local) {
          els.valLocal.textContent = formatMoneyBig(local.net_val || 0);
          setStatus(els.statusLocal, local.net_val || 0, 'local');
      }

      if (retail) {
          els.valRetail.textContent = formatMoneyBig(retail.net_val || 0);
          setStatus(els.statusRetail, retail.net_val || 0, 'retail');
      }

      // 2. Broker Summary
      const buyers = summary.top_net_buyers || [];
      const sellers = summary.top_net_sellers || [];

      // Render Buyers
      if (buyers.length > 0) {
          els.listTopBuyers.innerHTML = buyers.slice(0, 5).map(b => {
            const avg = (b.bvol && b.bvol > 0) ? Math.round(b.bval / b.bvol) : 0;
            return `
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td class="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">
                      <span class="inline-block w-8 text-center bg-slate-100 dark:bg-slate-700 rounded px-1">${b.code}</span>
                      <span class="ml-2 text-xs text-slate-400 font-normal">${b.type || ''}</span>
                  </td>
                  <td class="px-4 py-3 text-right font-bold text-emerald-500">+${formatMoneyBig(b.net)}</td>
                  <td class="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs">
                      ${avg > 0 ? formatters.nf0.format(avg) : '-'} 
                  </td>
              </tr>
            `;
          }).join('');
      } else {
          els.listTopBuyers.innerHTML = `<tr><td colspan="3" class="px-4 py-8 text-center text-slate-400">Tidak ada data pembeli</td></tr>`;
      }

      // Render Sellers
      if (sellers.length > 0) {
          els.listTopSellers.innerHTML = sellers.slice(0, 5).map(s => {
            const avg = (s.svol && s.svol > 0) ? Math.round(s.sval / s.svol) : 0;
            return `
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td class="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">
                      <span class="inline-block w-8 text-center bg-slate-100 dark:bg-slate-700 rounded px-1">${s.code}</span>
                      <span class="ml-2 text-xs text-slate-400 font-normal">${s.type || ''}</span>
                  </td>
                  <td class="px-4 py-3 text-right font-bold text-rose-500">${formatMoneyBig(s.net)}</td>
                  <td class="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs">
                      ${avg > 0 ? formatters.nf0.format(avg) : '-'}
                  </td>
              </tr>
            `;
          }).join('');
      } else {
          els.listTopSellers.innerHTML = `<tr><td colspan="3" class="px-4 py-8 text-center text-slate-400">Tidak ada data penjual</td></tr>`;
      }

      els.results.classList.remove("hidden");
  };

  // Init Defaults (Last 7 Days)
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  if (els.dateTo) els.dateTo.valueAsDate = today;
  if (els.dateFrom) els.dateFrom.valueAsDate = sevenDaysAgo;

  els.analyzeBtn.addEventListener("click", fetchData);
  
  // Add Enter key support
  els.tickerInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") fetchData();
  });
})();
