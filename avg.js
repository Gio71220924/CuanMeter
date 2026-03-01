(() => {
  const { formatters, idx, storage } = window.CuanMeterUtils;
  const LOT_SIZE = idx.LOT_SIZE;
  const HISTORY_KEY = 'avgPriceHistory';

  // State
  let appState = {
    mode: 'standard', // 'standard' or 'target'
    inputType: 'lot' // 'lot' or 'cash' (per row actually, but default)
  };

  const els = {
    // Mode Tabs
    modeStandardBtn: document.getElementById("modeStandardBtn"),
    modeTargetBtn: document.getElementById("modeTargetBtn"),
    
    // Inputs
    currentAvgPrice: document.getElementById("currentAvgPrice"),
    currentLots: document.getElementById("currentLots"),
    
    // Sections
    orderSectionTitle: document.getElementById("orderSectionTitle"),
    addOrderRowBtn: document.getElementById("addOrderRowBtn"),
    orderRows: document.getElementById("orderRows"),
    targetInputSection: document.getElementById("targetInputSection"),
    targetPrice: document.getElementById("targetPrice"),
    
    // Buttons
    resetBtn: document.getElementById("resetBtn"),
    calculateBtn: document.getElementById("calculateBtn"),
    
    // Results
    newAveragePrice: document.getElementById("newAveragePrice"),
    averagePriceDeltaBadge: document.getElementById("averagePriceDeltaBadge"),
    averagePriceDeltaIcon: document.getElementById("averagePriceDeltaIcon"),
    averagePriceDeltaText: document.getElementById("averagePriceDeltaText"),
    totalLots: document.getElementById("totalLots"),
    totalShares: document.getElementById("totalShares"),
    totalValue: document.getElementById("totalValue"),
    breakEvenText: document.getElementById("breakEvenText"),
    
    // Result Labels (Dynamic)
    resultTitleLabel: document.querySelector(".glass-dark .text-center > p"), // "Harga Rata-rata Baru"
    resultTotalLotsLabel: document.querySelector(".glass-dark .space-y-4 .flex:first-child span.text-sm"), // "Total Lot"
    resultTotalValueLabel: document.querySelector(".glass-dark .space-y-4 .flex:last-child span.text-sm"), // "Total Nilai"

    // History
    historyContainer: document.getElementById('historyContainer'),
    historyList: document.getElementById('historyList'),
    noHistoryMessage: document.getElementById('noHistoryMessage'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn')
  };

  if (!els.currentAvgPrice) return;

  // --- Helpers ---
  const formatCurrencyFull = (value) => `Rp ${formatters.nf0.format(Math.round(value))}`;
  const getOrderRows = () => [...els.orderRows.querySelectorAll(".order-row")];

  const normalizeRow = (row) => ({
    row,
    priceInput: row.querySelector(".order-price"),
    lotsInput: row.querySelector(".order-lots"), // Actual Lot Input
    cashInput: row.querySelector(".order-cash"), // Cash Input
    toggleBtn: row.querySelector(".toggle-input-type"),
    inputTypeLabel: row.querySelector(".input-type-label"),
    inputSuffix: row.querySelector(".input-suffix"),
    inputPrefix: row.querySelector(".input-prefix"),
    cashHint: row.querySelector(".cash-conversion-hint"),
    removeBtn: row.querySelector(".remove-order-row"),
  });

  // --- Mode Switching ---
  const setMode = (mode) => {
    appState.mode = mode;
    
    // Update Tab Styles
    if (mode === 'standard') {
        els.modeStandardBtn.classList.add('tab-active');
        els.modeStandardBtn.classList.remove('tab-inactive');
        els.modeTargetBtn.classList.add('tab-inactive');
        els.modeTargetBtn.classList.remove('tab-active');
        
        // UI Visibility
        els.targetInputSection.classList.add('hidden');
        els.orderRows.classList.remove('hidden');
        els.addOrderRowBtn.classList.remove('hidden');
        els.orderSectionTitle.textContent = "Order Beli Baru";
        els.calculateBtn.innerHTML = `Hitung Rata-rata <span class="material-symbols-outlined">arrow_forward</span>`;
        
        // Result Labels
        els.resultTitleLabel.textContent = "Harga Rata-rata Baru";
        els.resultTotalLotsLabel.textContent = "Total Lot";
        els.resultTotalValueLabel.textContent = "Total Nilai";

        // Re-enable Lots Input in First Row (Fix for switching back)
        const firstRow = getOrderRows()[0];
        if (firstRow) {
            const { lotsInput, toggleBtn, inputTypeLabel } = normalizeRow(firstRow);
            lotsInput.parentElement.parentElement.classList.remove('opacity-50', 'pointer-events-none');
            if (toggleBtn) toggleBtn.classList.remove('hidden');
            if (inputTypeLabel) inputTypeLabel.textContent = "JUMLAH (LOT)";
        }

    } else {
        els.modeTargetBtn.classList.add('tab-active');
        els.modeTargetBtn.classList.remove('tab-inactive');
        els.modeStandardBtn.classList.add('tab-inactive');
        els.modeStandardBtn.classList.remove('tab-active');
        
        // UI Visibility
        els.targetInputSection.classList.remove('hidden');
        els.orderRows.classList.remove('hidden');
        els.addOrderRowBtn.classList.add('hidden'); // No multiple buys in reverse calc
        
        // Reset rows to just 1
        const rows = getOrderRows();
        if (rows.length > 1) {
            for(let i=1; i<rows.length; i++) rows[i].remove();
        }
        
        // Disable Lots input in Target Mode
        const firstRow = getOrderRows()[0];
        if (firstRow) {
            const { lotsInput, toggleBtn, inputTypeLabel } = normalizeRow(firstRow);
            lotsInput.parentElement.parentElement.classList.add('opacity-50', 'pointer-events-none');
            // Hide the toggle button in target mode because quantity is output
            if (toggleBtn) toggleBtn.classList.add('hidden');
            if (inputTypeLabel) inputTypeLabel.textContent = "JUMLAH (OTOMATIS)";
        }

        els.orderSectionTitle.textContent = "Rencana Pembelian";
        els.calculateBtn.innerHTML = `Hitung Kebutuhan Lot <span class="material-symbols-outlined">calculate</span>`;
        
        // Result Labels
        els.resultTitleLabel.textContent = "Lot Harus Dibeli";
        els.resultTotalLotsLabel.textContent = "Total Lot Akhir";
        els.resultTotalValueLabel.textContent = "Modal Dibutuhkan";
    }
    render();
  };

  // --- Logic ---
  
  const calculateStandard = () => {
    const currentAvgPrice = formatters.toNonNegativeNumber(els.currentAvgPrice.value);
    const currentLots = formatters.toNonNegativeInt(els.currentLots.value);

    const currentShares = currentLots * LOT_SIZE;
    const currentCost = currentAvgPrice * currentShares;

    const rows = getOrderRows();
    let addedShares = 0;
    let addedCost = 0;
    let lastOrderPrice = 0;

    for (const row of rows) {
      const { priceInput, lotsInput, cashInput } = normalizeRow(row);
      const price = formatters.toNonNegativeNumber(priceInput?.value);
      
      // Determine lots based on visible input
      let lots = 0;
      if (lotsInput && !lotsInput.classList.contains('hidden')) {
         lots = formatters.toNonNegativeInt(lotsInput.value);
      } else if (cashInput && !cashInput.classList.contains('hidden')) {
         const cash = formatters.toNonNegativeNumber(cashInput.value);
         if (price > 0) {
             lots = Math.floor(cash / (price * LOT_SIZE));
         }
      }

      if (price > 0 && lots > 0) {
        const shares = lots * LOT_SIZE;
        addedShares += shares;
        addedCost += price * shares;
        lastOrderPrice = price;
      }
    }

    const totalShares = currentShares + addedShares;
    const totalCost = currentCost + addedCost;
    const totalLots = totalShares / LOT_SIZE;
    const newAvg = totalShares > 0 ? totalCost / totalShares : 0;
    
    const deltaPct = (currentShares > 0 && currentAvgPrice > 0 && totalShares > 0)
        ? ((newAvg - currentAvgPrice) / currentAvgPrice) * 100
        : null;
        
    const refPrice = lastOrderPrice > 0 ? lastOrderPrice : currentAvgPrice;
    const breakEvenMovePct = (refPrice > 0 && newAvg > 0) 
        ? ((newAvg - refPrice) / refPrice) * 100 
        : null;

    return { 
        type: 'standard',
        currentAvgPrice, currentLots,
        newAvg, totalLots, totalShares, totalCost, deltaPct, refPrice, breakEvenMovePct 
    };
  };

  const calculateTarget = () => {
    const currentAvg = formatters.toNonNegativeNumber(els.currentAvgPrice.value);
    const currentLots = formatters.toNonNegativeInt(els.currentLots.value);
    const targetAvg = formatters.toNonNegativeNumber(els.targetPrice.value);
    
    // Get buy price from first row
    const firstRow = getOrderRows()[0];
    const { priceInput } = normalizeRow(firstRow);
    const buyPrice = formatters.toNonNegativeNumber(priceInput?.value);

    let requiredLots = 0;
    let requiredCapital = 0;
    let resultingAvg = 0;
    let valid = false;
    let message = "";

    // Validation
    if (currentAvg <= 0 || currentLots <= 0) {
        return { valid: false, message: "Masukkan posisi awal." };
    }
    if (targetAvg <= 0) {
        return { valid: false, message: "Masukkan target harga." };
    }
    if (buyPrice <= 0) {
        return { valid: false, message: "Masukkan rencana harga beli." };
    }

    // Logic Check: Impossible Targets
    if (targetAvg < currentAvg && buyPrice >= targetAvg) {
         valid = false;
         message = `Untuk MENURUNKAN average ke ${formatters.nf0.format(targetAvg)}, Anda harus beli DI BAWAH ${formatters.nf0.format(targetAvg)}.`;
    } else if (targetAvg > currentAvg && buyPrice <= targetAvg) {
         valid = false;
         message = `Untuk MENAIKKAN average ke ${formatters.nf0.format(targetAvg)}, Anda harus beli DI ATAS ${formatters.nf0.format(targetAvg)}.`;
    } else if (Math.abs(buyPrice - targetAvg) < 0.01) { 
         valid = false;
         message = "Harga beli terlalu dekat dengan target (butuh lot tak terhingga).";
    } else {
         // Formula: BuyLots = CurLots * (TargetAvg - CurAvg) / (BuyPrice - TargetAvg)
         const numerator = currentLots * (targetAvg - currentAvg);
         const denominator = buyPrice - targetAvg;
         
         const rawLots = numerator / denominator;
         
         if (rawLots < 0) {
             valid = false;
             message = "Target tidak dapat dicapai (hasil negatif).";
         } else {
             requiredLots = Math.ceil(rawLots); 
             
             // Calculate Resulting Average (Proof)
             const totalShares = (currentLots + requiredLots) * LOT_SIZE;
             const totalCost = (currentAvg * currentLots * LOT_SIZE) + (buyPrice * requiredLots * LOT_SIZE);
             resultingAvg = totalCost / totalShares;
             
             requiredCapital = requiredLots * LOT_SIZE * buyPrice;
             valid = true;
         }
    }

    return {
        type: 'target',
        currentAvg, currentLots, targetAvg, buyPrice,
        requiredLots, requiredCapital, resultingAvg, valid, message,
        totalLots: currentLots + requiredLots
    };
  };

  const render = () => {
    // Determine result based on mode
    if (appState.mode === 'standard') {
        const res = calculateStandard();
        
        if (els.newAveragePrice) els.newAveragePrice.textContent = formatters.nf0.format(Math.round(res.newAvg));
        if (els.totalLots) els.totalLots.textContent = formatters.nf0.format(res.totalLots);
        if (els.totalShares) els.totalShares.textContent = `${formatters.nf0.format(res.totalShares)} Saham`;
        if (els.totalValue) els.totalValue.textContent = formatters.formatCurrencyCompact(res.totalCost);

        // Render Delta
        renderDeltaBadge(res.deltaPct);

        // Break Even Analysis
        if (els.breakEvenText) {
             if (res.totalShares === 0 || res.breakEvenMovePct === null) {
                els.breakEvenText.textContent = "Masukkan data untuk melihat analisis.";
             } else {
                 const upDown = res.breakEvenMovePct > 0 ? "naik" : "turun";
                 const pct = Math.abs(res.breakEvenMovePct);
                 els.breakEvenText.innerHTML = `Harga perlu <b>${upDown} ${formatters.formatPct(pct, 1)}%</b> ke ${formatCurrencyFull(res.newAvg)} untuk impas.`;
             }
        }
    } else {
        // Target Mode
        const res = calculateTarget();
        
        // Show result in "New Average Price" slot -> "Required Lots"
        if (res.valid) {
             els.newAveragePrice.textContent = formatters.nf0.format(res.requiredLots) + " Lot";
             
             // Use badge for context
             els.averagePriceDeltaBadge.classList.remove('hidden', 'bg-success/20', 'bg-danger/20');
             els.averagePriceDeltaBadge.classList.add('bg-blue-50', 'text-primary', 'border-blue-100');
             els.averagePriceDeltaIcon.textContent = "verified";
             els.averagePriceDeltaText.textContent = `Avg Akhir: ${formatCurrencyFull(res.resultingAvg)}`;
             
             els.totalLots.textContent = formatters.nf0.format(res.totalLots);
             els.totalShares.textContent = "Total Lot Akhir";
             els.totalValue.textContent = formatters.formatCurrencyCompact(res.requiredCapital);
             
             els.breakEvenText.innerHTML = `Butuh modal <span class="font-bold text-slate-900">${formatCurrencyFull(res.requiredCapital)}</span>.`;

        } else {
             els.newAveragePrice.textContent = "---";
             els.averagePriceDeltaBadge.classList.add('hidden');
             els.totalLots.textContent = "0";
             els.totalValue.textContent = "Rp 0";
             els.breakEvenText.textContent = res.message || "Masukkan data valid.";
        }
    }
  };

  const renderDeltaBadge = (deltaPct) => {
    if (!els.averagePriceDeltaBadge) return;
    if (deltaPct === null || !Number.isFinite(deltaPct)) {
      els.averagePriceDeltaBadge.classList.add("hidden");
      return;
    }
    const isUp = deltaPct > 0;
    const isDownOrFlat = !isUp;

    els.averagePriceDeltaText.textContent = `${deltaPct > 0 ? "+" : ""}${formatters.formatPct(deltaPct, 1)}% dari awal`;
    els.averagePriceDeltaBadge.classList.remove("hidden", "bg-blue-50", "text-primary");
    els.averagePriceDeltaIcon.textContent = isUp ? "trending_up" : "trending_down";

    if (isUp) {
         els.averagePriceDeltaBadge.classList.add("bg-danger/20", "text-danger");
         els.averagePriceDeltaBadge.classList.remove("bg-success/20", "text-success");
    } else {
         els.averagePriceDeltaBadge.classList.add("bg-success/20", "text-success");
         els.averagePriceDeltaBadge.classList.remove("bg-danger/20", "text-danger");
    }
  };

  // --- Row Logic (Toggle & Conversion) ---
  const bindRowEvents = (row) => {
    const { priceInput, lotsInput, cashInput, toggleBtn, inputTypeLabel, inputSuffix, inputPrefix, cashHint, removeBtn } = normalizeRow(row);

    // Toggle Input Type (Lot <-> Cash)
    toggleBtn?.addEventListener("click", () => {
        const isCurrentlyLot = !lotsInput.classList.contains("hidden");
        
        if (isCurrentlyLot) {
            // Switch to Cash
            lotsInput.classList.add("hidden");
            cashInput.classList.remove("hidden");
            inputTypeLabel.textContent = "MODAL (RP)";
            toggleBtn.textContent = "Ubah ke Lot";
            inputSuffix.classList.add("hidden");
            inputPrefix.classList.remove("hidden");
            cashHint.classList.remove("hidden");
            cashInput.focus();
        } else {
            // Switch to Lot
            cashInput.classList.add("hidden");
            lotsInput.classList.remove("hidden");
            inputTypeLabel.textContent = "JUMLAH (LOT)";
            toggleBtn.textContent = "Ubah ke Rp";
            inputSuffix.classList.remove("hidden");
            inputPrefix.classList.add("hidden");
            cashHint.classList.add("hidden");
            lotsInput.focus();
        }
        render(); // Re-calc based on visible input
    });

    // Inputs
    priceInput?.addEventListener("input", (e) => {
        formatters.formatInput(e.target);
        updateCashHint();
        render();
    });
    
    lotsInput?.addEventListener("input", render);
    
    cashInput?.addEventListener("input", (e) => {
        formatters.formatInput(e.target);
        updateCashHint();
        render();
    });

    // Helper to update "Equivalent to X Lots" hint
    const updateCashHint = () => {
        if (!cashInput || cashInput.classList.contains("hidden")) return;
        
        const price = formatters.toNonNegativeNumber(priceInput.value);
        const cash = formatters.toNonNegativeNumber(cashInput.value);
        
        if (price > 0 && cash > 0) {
            const lots = Math.floor(cash / (price * LOT_SIZE));
            cashHint.textContent = `Setara ± ${formatters.nf0.format(lots)} Lot`;
        } else {
            cashHint.textContent = "Setara 0 Lot";
        }
    };

    removeBtn?.addEventListener("click", () => {
        const rows = getOrderRows();
        if (rows.length <= 1) {
            priceInput.value = "";
            lotsInput.value = "";
            cashInput.value = "";
            render();
        } else {
            row.remove();
            render();
        }
    });
  };

  const addRow = () => {
    const rows = getOrderRows();
    const template = rows[0];
    if (!template) return;
    const clone = template.cloneNode(true);
    
    // Reset values & state of clone
    const { priceInput, lotsInput, cashInput, toggleBtn, inputTypeLabel, inputSuffix, inputPrefix, cashHint } = normalizeRow(clone);
    priceInput.value = "";
    lotsInput.value = "";
    cashInput.value = "";
    
    // Default to Lot view for new row
    cashInput.classList.add("hidden");
    lotsInput.classList.remove("hidden");
    inputTypeLabel.textContent = "JUMLAH (LOT)";
    toggleBtn.textContent = "Ubah ke Rp";
    inputSuffix.classList.remove("hidden");
    inputPrefix.classList.add("hidden");
    cashHint.classList.add("hidden");
    
    els.orderRows.appendChild(clone);
    bindRowEvents(clone);
    priceInput.focus();
  };

  // --- Initial Bindings ---
  
  els.modeStandardBtn.addEventListener("click", () => setMode('standard'));
  els.modeTargetBtn.addEventListener("click", () => setMode('target'));
  
  els.addOrderRowBtn.addEventListener("click", addRow);
  
  els.currentAvgPrice.addEventListener("input", (e) => {
      formatters.formatInput(e.target);
      render();
  });
  els.currentLots.addEventListener("input", render);
  
  els.targetPrice.addEventListener("input", (e) => {
      formatters.formatInput(e.target);
      render();
  });
  
  els.resetBtn.addEventListener("click", () => {
      els.currentAvgPrice.value = "";
      els.currentLots.value = "";
      els.targetPrice.value = "";
      
      const rows = getOrderRows();
      // Keep only first row
      for(let i=1; i<rows.length; i++) rows[i].remove();
      
      const { priceInput, lotsInput, cashInput } = normalizeRow(rows[0]);
      priceInput.value = "";
      lotsInput.value = "";
      cashInput.value = "";
      
      render();
  });

  // --- History ---
  const saveCurrentCalculation = () => {
    if (appState.mode === 'standard') {
      const res = calculateStandard();
      if (res.currentAvgPrice > 0 && res.currentLots > 0 && res.totalShares > 0) {
        storage.save(HISTORY_KEY, {
          mode: 'standard',
          currentAvgPrice: res.currentAvgPrice,
          currentLots: res.currentLots,
          newAvg: Math.round(res.newAvg),
          totalLots: res.totalLots,
          totalCost: res.totalCost,
          deltaPct: res.deltaPct
        }, 10, 'avg_price');
        renderHistory();
      }
    } else {
      const res = calculateTarget();
      if (res.valid) {
        storage.save(HISTORY_KEY, {
          mode: 'target',
          currentAvg: res.currentAvg,
          currentLots: res.currentLots,
          targetAvg: res.targetAvg,
          buyPrice: res.buyPrice,
          requiredLots: res.requiredLots,
          requiredCapital: res.requiredCapital,
          resultingAvg: Math.round(res.resultingAvg)
        }, 10, 'avg_price');
        renderHistory();
      }
    }
  };

  const renderHistory = () => {
    if (!els.historyList) return;
    const history = storage.load(HISTORY_KEY);

    if (history.length === 0) {
      els.historyList.innerHTML = `
        <div id="noHistoryMessage" class="p-8 text-center text-slate-500 dark:text-slate-400 transition-colors">
          <span class="material-symbols-outlined text-4xl mb-3 block">history</span>
          <p>Belum ada riwayat perhitungan</p>
          <p class="text-sm mt-1">Lakukan perhitungan untuk menyimpannya di sini</p>
        </div>
      `;
      return;
    }

    let html = '';
    history.forEach(item => {
      const d = item.data;
      const date = new Date(item.timestamp).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });

      if (d.mode === 'standard') {
        const deltaText = d.deltaPct !== null && Number.isFinite(d.deltaPct)
          ? `${d.deltaPct > 0 ? '+' : ''}${formatters.formatPct(d.deltaPct, 1)}%`
          : '';
        const deltaColor = d.deltaPct > 0 ? 'text-danger' : 'text-success';

        html += `
          <div class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-dark-bg/20 transition-colors group">
            <div class="flex items-center gap-4">
              <div class="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined">calculate</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-black text-slate-900 dark:text-white">Avg Rp ${formatters.nf0.format(d.newAvg)}</span>
                  ${deltaText ? `<span class="text-xs font-bold ${deltaColor}">${deltaText}</span>` : ''}
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</span>
                </div>
                <p class="text-sm text-slate-500 dark:text-slate-400">Awal: Rp ${formatters.nf0.format(d.currentAvgPrice)} x ${formatters.nf0.format(d.currentLots)} Lot • Total: ${formatters.nf0.format(d.totalLots)} Lot</p>
              </div>
            </div>
            <div class="flex items-center justify-between md:justify-end gap-6">
              <div class="text-right">
                <span class="block text-lg font-black text-primary">Rp ${formatters.nf0.format(d.newAvg)}</span>
                <span class="block text-[10px] font-bold text-slate-400 uppercase">Rata-rata Baru</span>
              </div>
              <button onclick="window.CuanMeterUtils.storage.deleteItem('${HISTORY_KEY}', ${item.id}); window.dispatchEvent(new Event('historyUpdate'));" class="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-dark-bg/20 transition-colors group">
            <div class="flex items-center gap-4">
              <div class="size-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                <span class="material-symbols-outlined">target</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-black text-slate-900 dark:text-white">Target Avg Rp ${formatters.nf0.format(d.targetAvg)}</span>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</span>
                </div>
                <p class="text-sm text-slate-500 dark:text-slate-400">Beli ${formatters.nf0.format(d.requiredLots)} Lot @ Rp ${formatters.nf0.format(d.buyPrice)} • Modal: ${formatCurrencyFull(d.requiredCapital)}</p>
              </div>
            </div>
            <div class="flex items-center justify-between md:justify-end gap-6">
              <div class="text-right">
                <span class="block text-lg font-black text-accent">${formatters.nf0.format(d.requiredLots)} Lot</span>
                <span class="block text-[10px] font-bold text-slate-400 uppercase">Harus Dibeli</span>
              </div>
              <button onclick="window.CuanMeterUtils.storage.deleteItem('${HISTORY_KEY}', ${item.id}); window.dispatchEvent(new Event('historyUpdate'));" class="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        `;
      }
    });

    els.historyList.innerHTML = html;
  };

  els.calculateBtn.addEventListener("click", () => {
    render();
    saveCurrentCalculation();
  });

  els.clearHistoryBtn?.addEventListener('click', () => {
    if (confirm('Hapus semua riwayat perhitungan rata-rata?')) {
      storage.clear(HISTORY_KEY);
      renderHistory();
    }
  });

  window.addEventListener('historyUpdate', renderHistory);

  // Init
  getOrderRows().forEach(bindRowEvents);
  setMode('standard'); // Default
  renderHistory();

})();
