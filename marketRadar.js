(() => {
  const API_URL = "https://api-saham.mkemalw.workers.dev/screener-accum";
  const CACHE_KEY = "marketRadarAdvanced";
  const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour Cache

  // State
  let activeTimeframe = "5"; // Default 5D
  let cachedData = null; // Store data in memory for fast switching

  const els = {
    container: document.getElementById("market-radar-container"),
    accList: document.getElementById("radar-accumulation"), 
    distList: document.getElementById("radar-distribution"),
    lastUpdate: document.getElementById("radar-last-update"),
    loading: document.getElementById("radar-loading"),
    timeframeBtns: document.querySelectorAll("#radar-timeframe button"),
    
    // Headers
    headerAcc: document.querySelector("#radar-accumulation").previousElementSibling.querySelector("h3"),
    headerDist: document.querySelector("#radar-distribution").previousElementSibling.querySelector("h3")
  };

  if (!els.container) return;

  const { formatters } = window.CuanMeterUtils;

  const formatMoney = (val) => {
      const absVal = Math.abs(val);
      if (absVal >= 1e12) return (val / 1e12).toFixed(1) + " T";
      if (absVal >= 1e9) return (val / 1e9).toFixed(1) + " M";
      return (val / 1e6).toFixed(0) + " Jt";
  };

  const updateActiveButton = () => {
      els.timeframeBtns.forEach(btn => {
          const tf = btn.getAttribute("data-tf");
          if (tf === activeTimeframe) {
              btn.className = "px-3 py-1 text-xs font-bold rounded bg-primary text-white shadow-sm transition-colors";
          } else {
              btn.className = "px-3 py-1 text-xs font-bold rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors";
          }
      });
  };

  const fetchMarketData = async () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          cachedData = parsed.data;
          render();
          return;
        }
      }

      els.loading.classList.remove("hidden");
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("API Error");
      
      const data = await response.json();
      
      // Save
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
      
      cachedData = data;
      render();
    } catch (err) {
      console.error("Market Radar Error:", err);
      els.loading.textContent = "Gagal memuat data pasar.";
    } finally {
      els.loading.classList.add("hidden");
    }
  };

  const processData = (items) => {
    // Filter items that have data for the active timeframe
    const validItems = items.filter(i => i.accum && i.accum[activeTimeframe]);

    // 1. Top Smart Accumulation (GREEN)
    const smartAcc = [...validItems]
        .filter(i => i.accum[activeTimeframe].sm > 0)
        .sort((a, b) => b.accum[activeTimeframe].sm - a.accum[activeTimeframe].sm)
        .slice(0, 5);

    // 2. Top Smart Distribution (RED)
    const smartDist = [...validItems]
        .filter(i => i.accum[activeTimeframe].sm < 0)
        .sort((a, b) => a.accum[activeTimeframe].sm - b.accum[activeTimeframe].sm)
        .slice(0, 5);

    return { smartAcc, smartDist };
  };

  const createStockItem = (item, type) => {
    const dataTF = item.accum[activeTimeframe];
    const flowVal = dataTF.sm;
    
    const isDistCol = type === 'dist';
    const colorClass = isDistCol ? "text-rose-500" : "text-emerald-500";
    const bgClass = isDistCol ? "bg-rose-500/10" : "bg-emerald-500/10";
    const icon = isDistCol ? "trending_down" : "trending_up"; 
    
    const price = item.orderflow?.recent_price || 0;
    const growth = item.orderflow?.growth_pct || 0;
    const sign = growth > 0 ? "+" : "";

    return `
      <div class="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-primary/30 transition-all">
        <div class="flex items-center gap-3">
          <div class="size-8 rounded-lg ${bgClass} flex items-center justify-center ${colorClass}">
            <span class="material-symbols-outlined text-[18px] font-bold">${icon}</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-900 dark:text-white text-sm">${item.t}</h4>
                <span class="text-[10px] font-bold ${growth >= 0 ? 'text-emerald-500' : 'text-rose-500'}">
                    ${sign}${formatters.nf2.format(growth)}%
                </span>
            </div>
            <p class="text-[10px] text-slate-500 dark:text-slate-400">Rp ${formatters.nf0.format(price)}</p>
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold ${colorClass} text-xs">
            ${formatMoney(flowVal)}
          </div>
          <p class="text-[10px] text-slate-400 font-medium">Smart ${activeTimeframe}D</p>
        </div>
      </div>
    `;
  };

  const render = () => {
    if (!cachedData) return;
    
    const { items, date } = cachedData;
    const { smartAcc, smartDist } = processData(items);

    if (els.lastUpdate) {
        els.lastUpdate.textContent = `Data: ${date}`;
    }

    // Update Headers
    if(els.headerAcc) els.headerAcc.textContent = `Top Smart Accum (${activeTimeframe}D)`;
    if(els.headerDist) els.headerDist.textContent = `Top Smart Dist (${activeTimeframe}D)`;

    els.accList.innerHTML = smartAcc.length 
        ? smartAcc.map(item => createStockItem(item, 'acc')).join('')
        : `<div class="p-4 text-center text-xs text-slate-400">Tidak ada data.</div>`;

    els.distList.innerHTML = smartDist.length
        ? smartDist.map(item => createStockItem(item, 'dist')).join('')
        : `<div class="p-4 text-center text-xs text-slate-400">Tidak ada data.</div>`;
  };

  // Event Listeners
  els.timeframeBtns.forEach(btn => {
      btn.addEventListener("click", () => {
          activeTimeframe = btn.getAttribute("data-tf");
          updateActiveButton();
          render();
      });
  });

  // Init
  fetchMarketData();
})();
