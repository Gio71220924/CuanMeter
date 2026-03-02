(() => {
  const { formatters, idx, storage } = window.CuanMeterUtils;
  const LOT_SIZE = idx.LOT_SIZE;
  const HISTORY_KEY = 'avgPriceHistory';

  // State
  let appState = {
    mode: 'standard', // 'standard', 'target', or 'scenario'
    inputType: 'lot', // 'lot' or 'cash' (per row actually, but default)
    scenarioChart: null
  };

  const els = {
    // Mode Tabs
    modeStandardBtn: document.getElementById("modeStandardBtn"),
    modeTargetBtn: document.getElementById("modeTargetBtn"),
    modeScenarioBtn: document.getElementById("modeScenarioBtn"),

    // Inputs
    currentAvgPrice: document.getElementById("currentAvgPrice"),
    currentLots: document.getElementById("currentLots"),

    // Sections
    orderSectionTitle: document.getElementById("orderSectionTitle"),
    addOrderRowBtn: document.getElementById("addOrderRowBtn"),
    orderRows: document.getElementById("orderRows"),
    targetInputSection: document.getElementById("targetInputSection"),
    targetPrice: document.getElementById("targetPrice"),

    // Scenario Sections
    scenarioInputSection: document.getElementById("scenarioInputSection"),
    scenarioSteps: document.getElementById("scenarioSteps"),
    addScenarioStepBtn: document.getElementById("addScenarioStepBtn"),

    // Buttons
    resetBtn: document.getElementById("resetBtn"),
    calculateBtn: document.getElementById("calculateBtn"),

    // Standard Results
    standardResultPanel: document.getElementById("standardResultPanel"),
    newAveragePrice: document.getElementById("newAveragePrice"),
    averagePriceDeltaBadge: document.getElementById("averagePriceDeltaBadge"),
    averagePriceDeltaIcon: document.getElementById("averagePriceDeltaIcon"),
    averagePriceDeltaText: document.getElementById("averagePriceDeltaText"),
    totalLots: document.getElementById("totalLots"),
    totalShares: document.getElementById("totalShares"),
    totalValue: document.getElementById("totalValue"),
    breakEvenText: document.getElementById("breakEvenText"),

    // Result Labels (Dynamic)
    resultTitleLabel: document.querySelector("#standardResultPanel .text-center > p"), // "Harga Rata-rata Baru"
    resultTotalLotsLabel: document.querySelector("#standardResultPanel .space-y-4 .flex:first-child span.text-sm"), // "Total Lot"
    resultTotalValueLabel: document.querySelector("#standardResultPanel .space-y-4 .flex:last-child span.text-sm"), // "Total Nilai"

    // Scenario Results
    scenarioResultPanel: document.getElementById("scenarioResultPanel"),
    scenarioFinalAvg: document.getElementById("scenarioFinalAvg"),
    scenarioDeltaBadge: document.getElementById("scenarioDeltaBadge"),
    scenarioDeltaText: document.getElementById("scenarioDeltaText"),
    scenarioTotalLots: document.getElementById("scenarioTotalLots"),
    scenarioTotalCost: document.getElementById("scenarioTotalCost"),
    scenarioDeltaPct: document.getElementById("scenarioDeltaPct"),
    scenarioChartCanvas: document.getElementById("scenarioChart"),
    scenarioStepsBreakdown: document.getElementById("scenarioStepsBreakdown"),

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

  // --- Scenario Step Helpers ---
  const getScenarioSteps = () => [...els.scenarioSteps.querySelectorAll(".scenario-step")];

  const normalizeStep = (step) => ({
    step,
    priceInput: step.querySelector(".step-price"),
    lotsInput: step.querySelector(".step-lots"),
    badge: step.querySelector(".step-badge"),
    removeBtn: step.querySelector(".remove-scenario-step"),
  });

  const renumberSteps = () => {
    getScenarioSteps().forEach((step, i) => {
      const { badge } = normalizeStep(step);
      const num = i + 1;
      if (badge) badge.textContent = num;
      const label = step.querySelector('.text-xs.font-bold.text-slate-400.uppercase');
      if (label) label.textContent = `Langkah ${num}`;
    });
  };

  const bindScenarioStepEvents = (step) => {
    const { priceInput, lotsInput, removeBtn } = normalizeStep(step);

    priceInput?.addEventListener("input", (e) => {
      formatters.formatInput(e.target);
      render();
    });

    lotsInput?.addEventListener("input", render);

    removeBtn?.addEventListener("click", () => {
      const steps = getScenarioSteps();
      if (steps.length <= 1) {
        priceInput.value = "";
        lotsInput.value = "";
        render();
      } else {
        step.remove();
        renumberSteps();
        render();
      }
    });
  };

  const addScenarioStep = () => {
    const steps = getScenarioSteps();
    const template = steps[0];
    if (!template) return;
    const clone = template.cloneNode(true);

    const { priceInput, lotsInput } = normalizeStep(clone);
    priceInput.value = "";
    lotsInput.value = "";

    els.scenarioSteps.appendChild(clone);
    bindScenarioStepEvents(clone);
    renumberSteps();
    priceInput.focus();
  };

  // --- Mode Switching ---
  const setMode = (mode) => {
    appState.mode = mode;

    // Deactivate all tabs
    const allTabs = [els.modeStandardBtn, els.modeTargetBtn, els.modeScenarioBtn];
    allTabs.forEach(btn => {
      if (btn) {
        btn.classList.remove('tab-active', 'bg-white', 'dark:bg-dark-surface', 'text-primary', 'shadow-sm');
        btn.classList.add('tab-inactive');
      }
    });

    // Activate selected tab
    const activeTab = mode === 'standard' ? els.modeStandardBtn
      : mode === 'target' ? els.modeTargetBtn
      : els.modeScenarioBtn;
    if (activeTab) {
      activeTab.classList.remove('tab-inactive');
      activeTab.classList.add('tab-active');
    }

    // Hide all mode-specific sections first
    els.targetInputSection.classList.add('hidden');
    els.scenarioInputSection.classList.add('hidden');

    // Toggle result panels
    if (mode === 'scenario') {
      els.standardResultPanel.classList.add('hidden');
      els.scenarioResultPanel.classList.remove('hidden');
    } else {
      els.standardResultPanel.classList.remove('hidden');
      els.scenarioResultPanel.classList.add('hidden');
    }

    if (mode === 'standard') {
      // UI Visibility
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

    } else if (mode === 'target') {
      // UI Visibility
      els.targetInputSection.classList.remove('hidden');
      els.orderRows.classList.remove('hidden');
      els.addOrderRowBtn.classList.add('hidden'); // No multiple buys in reverse calc

      // Reset rows to just 1
      const rows = getOrderRows();
      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) rows[i].remove();
      }

      // Disable Lots input in Target Mode
      const firstRow = getOrderRows()[0];
      if (firstRow) {
        const { lotsInput, toggleBtn, inputTypeLabel } = normalizeRow(firstRow);
        lotsInput.parentElement.parentElement.classList.add('opacity-50', 'pointer-events-none');
        if (toggleBtn) toggleBtn.classList.add('hidden');
        if (inputTypeLabel) inputTypeLabel.textContent = "JUMLAH (OTOMATIS)";
      }

      els.orderSectionTitle.textContent = "Rencana Pembelian";
      els.calculateBtn.innerHTML = `Hitung Kebutuhan Lot <span class="material-symbols-outlined">calculate</span>`;

      // Result Labels
      els.resultTitleLabel.textContent = "Lot Harus Dibeli";
      els.resultTotalLotsLabel.textContent = "Total Lot Akhir";
      els.resultTotalValueLabel.textContent = "Modal Dibutuhkan";

    } else {
      // Scenario mode
      els.scenarioInputSection.classList.remove('hidden');
      els.orderRows.classList.add('hidden');
      els.addOrderRowBtn.classList.add('hidden');
      els.orderSectionTitle.textContent = "Skenario Average Down";
      els.calculateBtn.innerHTML = `Simulasikan <span class="material-symbols-outlined">insights</span>`;
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

  const calculateScenario = () => {
    const currentAvgPrice = formatters.toNonNegativeNumber(els.currentAvgPrice.value);
    const currentLots = formatters.toNonNegativeInt(els.currentLots.value);

    if (currentAvgPrice <= 0 || currentLots <= 0) {
      return { valid: false, steps: [], finalAvg: 0, totalLots: 0, totalCost: 0, deltaPct: null };
    }

    const steps = [];
    let cumShares = currentLots * LOT_SIZE;
    let cumCost = currentAvgPrice * cumShares;

    // Step 0: baseline (posisi awal)
    steps.push({
      label: 'Posisi Awal',
      price: currentAvgPrice,
      lots: currentLots,
      cumLots: currentLots,
      cumCost: cumCost,
      runningAvg: currentAvgPrice,
      addedLots: 0
    });

    const stepEls = getScenarioSteps();
    let hasValidStep = false;

    for (let i = 0; i < stepEls.length; i++) {
      const { priceInput, lotsInput } = normalizeStep(stepEls[i]);
      const price = formatters.toNonNegativeNumber(priceInput?.value);
      const lots = formatters.toNonNegativeInt(lotsInput?.value);

      if (price > 0 && lots > 0) {
        hasValidStep = true;
        const shares = lots * LOT_SIZE;
        cumShares += shares;
        cumCost += price * shares;
        const cumLots = cumShares / LOT_SIZE;
        const runningAvg = cumCost / cumShares;

        steps.push({
          label: `Langkah ${i + 1}`,
          price,
          lots,
          cumLots,
          cumCost,
          runningAvg,
          addedLots: lots
        });
      }
    }

    const finalAvg = cumShares > 0 ? cumCost / cumShares : 0;
    const totalLots = cumShares / LOT_SIZE;
    const totalCost = cumCost;
    const deltaPct = (currentAvgPrice > 0 && finalAvg > 0)
      ? ((finalAvg - currentAvgPrice) / currentAvgPrice) * 100
      : null;

    return { valid: hasValidStep, steps, finalAvg, totalLots, totalCost, deltaPct };
  };

  // --- Render ---

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
    } else if (appState.mode === 'target') {
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
    } else if (appState.mode === 'scenario') {
        const res = calculateScenario();
        renderScenarioResults(res);
        renderScenarioChart(res);
    }
  };

  const renderDeltaBadge = (deltaPct) => {
    if (!els.averagePriceDeltaBadge) return;
    if (deltaPct === null || !Number.isFinite(deltaPct)) {
      els.averagePriceDeltaBadge.classList.add("hidden");
      return;
    }
    const isUp = deltaPct > 0;

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

  // --- Scenario Rendering ---

  const renderScenarioResults = (res) => {
    if (!els.scenarioFinalAvg) return;

    els.scenarioFinalAvg.textContent = res.valid ? formatters.nf0.format(Math.round(res.finalAvg)) : '0';
    els.scenarioTotalLots.textContent = formatters.nf0.format(res.totalLots);
    els.scenarioTotalCost.textContent = formatters.formatCurrencyCompact(res.totalCost);

    // Delta badge
    if (res.deltaPct !== null && Number.isFinite(res.deltaPct) && res.valid) {
      els.scenarioDeltaBadge.classList.remove('hidden');
      const sign = res.deltaPct > 0 ? '+' : '';
      els.scenarioDeltaText.textContent = `${sign}${formatters.formatPct(res.deltaPct, 1)}% dari awal`;
      els.scenarioDeltaPct.textContent = `${formatters.formatPct(Math.abs(res.deltaPct), 1)}%`;
    } else {
      els.scenarioDeltaBadge.classList.add('hidden');
      els.scenarioDeltaPct.textContent = '0%';
    }

    // Step breakdown
    if (!els.scenarioStepsBreakdown) return;
    if (!res.valid || res.steps.length <= 1) {
      els.scenarioStepsBreakdown.innerHTML = `
        <p class="text-sm text-slate-400 dark:text-slate-500 text-center py-3">Masukkan langkah skenario untuk melihat breakdown.</p>
      `;
      return;
    }

    let html = `<p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Breakdown Langkah</p>`;
    res.steps.forEach((s, i) => {
      const isBaseline = i === 0;
      const bgClass = isBaseline
        ? 'bg-primary/5 dark:bg-primary/10 border-primary/20'
        : 'bg-slate-50/50 dark:bg-dark-bg/50 border-slate-200/50 dark:border-dark-border';
      html += `
        <div class="flex items-center justify-between p-3 rounded-xl border ${bgClass} text-sm">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center size-6 rounded-full ${isBaseline ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-dark-border text-slate-500 dark:text-slate-400'} text-[10px] font-bold">${i}</span>
            <div>
              <span class="font-semibold text-slate-700 dark:text-slate-200">${s.label}</span>
              ${!isBaseline ? `<span class="text-xs text-slate-400 dark:text-slate-500 ml-1">${formatters.nf0.format(s.addedLots)} Lot @ ${formatCurrencyFull(s.price)}</span>` : ''}
            </div>
          </div>
          <div class="text-right">
            <span class="font-bold text-slate-900 dark:text-white">${formatCurrencyFull(s.runningAvg)}</span>
            <span class="block text-[10px] text-slate-400 dark:text-slate-500">${formatters.nf0.format(s.cumLots)} Lot total</span>
          </div>
        </div>
      `;
    });
    els.scenarioStepsBreakdown.innerHTML = html;
  };

  const renderScenarioChart = (res) => {
    // Graceful degradation: if Chart.js not loaded, skip
    if (typeof Chart === 'undefined') return;
    if (!els.scenarioChartCanvas) return;

    // Destroy previous instance
    if (appState.scenarioChart) {
      appState.scenarioChart.destroy();
      appState.scenarioChart = null;
    }

    if (!res.valid || res.steps.length <= 1) return;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
    const primaryColor = '#0ea5e9';
    const accentColor = '#f59e0b';
    const successColor = '#10b981';

    const labels = res.steps.map(s => s.label);
    const buyPrices = res.steps.map(s => s.price);
    const runningAvgs = res.steps.map(s => Math.round(s.runningAvg));
    const lotsAdded = res.steps.map(s => s.addedLots);

    appState.scenarioChart = new Chart(els.scenarioChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: 'Harga Beli',
            data: buyPrices,
            borderColor: accentColor,
            backgroundColor: accentColor,
            borderDash: [6, 3],
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: accentColor,
            tension: 0.1,
            yAxisID: 'y',
            order: 1
          },
          {
            type: 'line',
            label: 'Rata-rata Berjalan',
            data: runningAvgs,
            borderColor: primaryColor,
            backgroundColor: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)',
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: primaryColor,
            fill: true,
            tension: 0.3,
            yAxisID: 'y',
            order: 0
          },
          {
            type: 'bar',
            label: 'Lot Dibeli',
            data: lotsAdded,
            backgroundColor: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)',
            borderColor: successColor,
            borderWidth: 1,
            borderRadius: 6,
            yAxisID: 'y1',
            order: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: textColor,
              font: { family: "'Manrope', sans-serif", size: 11, weight: '600' },
              usePointStyle: true,
              pointStyleWidth: 10,
              boxHeight: 6,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            titleColor: isDark ? '#f1f5f9' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            cornerRadius: 10,
            padding: 10,
            titleFont: { family: "'Manrope', sans-serif", weight: '700', size: 12 },
            bodyFont: { family: "'Noto Sans', sans-serif", size: 11 },
            callbacks: {
              label: function (ctx) {
                if (ctx.dataset.label === 'Lot Dibeli') {
                  return `${ctx.dataset.label}: ${formatters.nf0.format(ctx.parsed.y)} Lot`;
                }
                return `${ctx.dataset.label}: Rp ${formatters.nf0.format(ctx.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              font: { family: "'Noto Sans', sans-serif", size: 10 },
              maxRotation: 45
            },
            grid: { display: false }
          },
          y: {
            position: 'left',
            title: {
              display: true,
              text: 'Harga (Rp)',
              color: textColor,
              font: { family: "'Manrope', sans-serif", size: 11, weight: '600' }
            },
            ticks: {
              color: textColor,
              font: { family: "'Noto Sans', sans-serif", size: 10 },
              callback: (v) => `Rp ${formatters.nf0.format(v)}`
            },
            grid: { color: gridColor }
          },
          y1: {
            position: 'right',
            title: {
              display: true,
              text: 'Lot',
              color: textColor,
              font: { family: "'Manrope', sans-serif", size: 11, weight: '600' }
            },
            ticks: {
              color: textColor,
              font: { family: "'Noto Sans', sans-serif", size: 10 },
              stepSize: 1
            },
            grid: { drawOnChartArea: false },
            beginAtZero: true
          }
        }
      }
    });
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
            cashHint.textContent = `Setara \u00b1 ${formatters.nf0.format(lots)} Lot`;
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
  els.modeScenarioBtn.addEventListener("click", () => setMode('scenario'));

  els.addOrderRowBtn.addEventListener("click", addRow);
  els.addScenarioStepBtn.addEventListener("click", addScenarioStep);

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

      // Reset order rows
      const rows = getOrderRows();
      // Keep only first row
      for(let i=1; i<rows.length; i++) rows[i].remove();

      const { priceInput, lotsInput, cashInput } = normalizeRow(rows[0]);
      priceInput.value = "";
      lotsInput.value = "";
      cashInput.value = "";

      // Reset scenario steps
      const steps = getScenarioSteps();
      for (let i = 1; i < steps.length; i++) steps[i].remove();
      const firstStep = getScenarioSteps()[0];
      if (firstStep) {
        const { priceInput: sp, lotsInput: sl } = normalizeStep(firstStep);
        if (sp) sp.value = "";
        if (sl) sl.value = "";
      }
      renumberSteps();

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
    } else if (appState.mode === 'target') {
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
    } else if (appState.mode === 'scenario') {
      const res = calculateScenario();
      if (res.valid) {
        storage.save(HISTORY_KEY, {
          mode: 'scenario',
          finalAvg: Math.round(res.finalAvg),
          totalLots: res.totalLots,
          totalCost: res.totalCost,
          deltaPct: res.deltaPct,
          stepsCount: res.steps.length - 1, // exclude baseline
          steps: res.steps.map(s => ({ label: s.label, price: s.price, lots: s.addedLots, avg: Math.round(s.runningAvg) }))
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
                <p class="text-sm text-slate-500 dark:text-slate-400">Awal: Rp ${formatters.nf0.format(d.currentAvgPrice)} x ${formatters.nf0.format(d.currentLots)} Lot \u2022 Total: ${formatters.nf0.format(d.totalLots)} Lot</p>
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
      } else if (d.mode === 'target') {
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
                <p class="text-sm text-slate-500 dark:text-slate-400">Beli ${formatters.nf0.format(d.requiredLots)} Lot @ Rp ${formatters.nf0.format(d.buyPrice)} \u2022 Modal: ${formatCurrencyFull(d.requiredCapital)}</p>
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
      } else if (d.mode === 'scenario') {
        const deltaText = d.deltaPct !== null && Number.isFinite(d.deltaPct)
          ? `${d.deltaPct > 0 ? '+' : ''}${formatters.formatPct(d.deltaPct, 1)}%`
          : '';
        const deltaColor = d.deltaPct > 0 ? 'text-danger' : 'text-success';

        html += `
          <div class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-dark-bg/20 transition-colors group">
            <div class="flex items-center gap-4">
              <div class="size-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <span class="material-symbols-outlined">insights</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-black text-slate-900 dark:text-white">Skenario ${d.stepsCount} Langkah</span>
                  ${deltaText ? `<span class="text-xs font-bold ${deltaColor}">${deltaText}</span>` : ''}
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</span>
                </div>
                <p class="text-sm text-slate-500 dark:text-slate-400">Avg Akhir: Rp ${formatters.nf0.format(d.finalAvg)} \u2022 Total: ${formatters.nf0.format(d.totalLots)} Lot</p>
              </div>
            </div>
            <div class="flex items-center justify-between md:justify-end gap-6">
              <div class="text-right">
                <span class="block text-lg font-black text-emerald-500">Rp ${formatters.nf0.format(d.finalAvg)}</span>
                <span class="block text-[10px] font-bold text-slate-400 uppercase">Rata-rata Akhir</span>
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

  // Re-render chart on theme change
  window.addEventListener('themechange', () => {
    if (appState.mode === 'scenario') {
      const res = calculateScenario();
      renderScenarioChart(res);
    }
  });

  // Init
  getOrderRows().forEach(bindRowEvents);
  getScenarioSteps().forEach(bindScenarioStepEvents);
  setMode('standard'); // Default
  renderHistory();

})();
