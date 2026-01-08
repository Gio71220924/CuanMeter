(() => {
  const { formatters, idx, storage } = window.CuanMeterUtils;
  const LOT_SIZE = idx.LOT_SIZE;
  const HISTORY_KEY = 'avgPriceHistory';

  const els = {
    currentAvgPrice: document.getElementById("currentAvgPrice"),
    currentLots: document.getElementById("currentLots"),
    orderRows: document.getElementById("orderRows"),
    addOrderRowBtn: document.getElementById("addOrderRowBtn"),
    resetBtn: document.getElementById("resetBtn"),
    calculateBtn: document.getElementById("calculateBtn"),
    newAveragePrice: document.getElementById("newAveragePrice"),
    averagePriceDeltaBadge: document.getElementById("averagePriceDeltaBadge"),
    averagePriceDeltaIcon: document.getElementById("averagePriceDeltaIcon"),
    averagePriceDeltaText: document.getElementById("averagePriceDeltaText"),
    totalLots: document.getElementById("totalLots"),
    totalShares: document.getElementById("totalShares"),
    totalValue: document.getElementById("totalValue"),
    breakEvenText: document.getElementById("breakEvenText"),
    historyContainer: document.getElementById('historyContainer'),
    historyList: document.getElementById('historyList'),
    noHistoryMessage: document.getElementById('noHistoryMessage'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn')
  };

  if (!els.currentAvgPrice || !els.currentLots || !els.orderRows) return;

  const formatCurrencyFull = (value) => `Rp ${formatters.nf0.format(Math.round(value))}`;

  const getFormData = () => {
    const currentAvgPrice = formatters.toNonNegativeNumber(els.currentAvgPrice.value);
    const currentLots = formatters.toNonNegativeInt(els.currentLots.value);

    const orders = [];
    for (const row of getOrderRows()) {
      const { priceInput, lotsInput } = normalizeRow(row);
      const price = formatters.toNonNegativeNumber(priceInput?.value);
      const lots = formatters.toNonNegativeInt(lotsInput?.value);
      if (price > 0 && lots > 0) {
        orders.push({ price, lots });
      }
    }

    return {
      currentAvgPrice,
      currentLots,
      orders
    };
  };

  const getOrderRows = () => [...els.orderRows.querySelectorAll(".order-row")];

  const normalizeRow = (row) => ({
    row,
    priceInput: row.querySelector(".order-price"),
    lotsInput: row.querySelector(".order-lots"),
    removeBtn: row.querySelector(".remove-order-row"),
  });

  const readOrders = () => {
    const orders = [];
    let lastOrderPrice = 0;

    for (const row of getOrderRows()) {
      const { priceInput, lotsInput } = normalizeRow(row);
      const price = formatters.toNonNegativeNumber(priceInput?.value);
      const lots = formatters.toNonNegativeInt(lotsInput?.value);
      if (price > 0 && lots > 0) {
        orders.push({ price, lots });
        lastOrderPrice = price;
      }
    }

    return { orders, lastOrderPrice };
  };

  const calculate = () => {
    const currentAvgPrice = formatters.toNonNegativeNumber(els.currentAvgPrice.value);
    const currentLots = formatters.toNonNegativeInt(els.currentLots.value);

    const currentShares = currentLots * LOT_SIZE;
    const currentCost = currentAvgPrice * currentShares;

    const { orders, lastOrderPrice } = readOrders();

    let addedShares = 0;
    let addedCost = 0;

    for (const order of orders) {
      const shares = order.lots * LOT_SIZE;
      addedShares += shares;
      addedCost += order.price * shares;
    }

    const totalShares = currentShares + addedShares;
    const totalCost = currentCost + addedCost;
    const totalLots = totalShares / LOT_SIZE;
    const newAvg = totalShares > 0 ? totalCost / totalShares : 0;

    const deltaPct =
      currentShares > 0 && currentAvgPrice > 0 && totalShares > 0
        ? ((newAvg - currentAvgPrice) / currentAvgPrice) * 100
        : null;

    const refPrice = lastOrderPrice > 0 ? lastOrderPrice : currentAvgPrice;

    const breakEvenMovePct =
      refPrice > 0 && newAvg > 0 ? ((newAvg - refPrice) / refPrice) * 100 : null;

    return { totalShares, totalLots, totalCost, newAvg, deltaPct, refPrice, breakEvenMovePct };
  };

  const renderDeltaBadge = (deltaPct) => {
    if (!els.averagePriceDeltaBadge || !els.averagePriceDeltaIcon || !els.averagePriceDeltaText) return;

    if (deltaPct === null || !Number.isFinite(deltaPct)) {
      els.averagePriceDeltaBadge.classList.add("hidden");
      return;
    }

    const sign = deltaPct > 0 ? "+" : "";
    els.averagePriceDeltaText.textContent = `${sign}${formatters.formatPct(deltaPct, 1)}% dari awal`;

    const isUp = deltaPct > 0;
    const isDownOrFlat = !isUp;

    els.averagePriceDeltaBadge.classList.remove("hidden");
    els.averagePriceDeltaIcon.textContent = isUp ? "trending_up" : "trending_down";

    els.averagePriceDeltaBadge.classList.toggle("bg-success/20", isDownOrFlat);
    els.averagePriceDeltaBadge.classList.toggle("text-success", isDownOrFlat);
    els.averagePriceDeltaBadge.classList.toggle("border-success/30", isDownOrFlat);

    els.averagePriceDeltaBadge.classList.toggle("bg-danger/20", isUp);
    els.averagePriceDeltaBadge.classList.toggle("text-danger", isUp);
    els.averagePriceDeltaBadge.classList.toggle("border-danger/30", isUp);
  };

  const render = () => {
    const result = calculate();

    if (els.newAveragePrice) els.newAveragePrice.textContent = formatters.nf0.format(Math.round(result.newAvg));
    if (els.totalLots) els.totalLots.textContent = formatters.nf0.format(result.totalLots);
    if (els.totalShares) els.totalShares.textContent = `${formatters.nf0.format(result.totalShares)} Saham`;
    if (els.totalValue) els.totalValue.textContent = formatters.formatCurrencyCompact(result.totalCost);

    renderDeltaBadge(result.deltaPct);

    if (els.breakEvenText) {
      if (result.totalShares === 0 || result.breakEvenMovePct === null || !Number.isFinite(result.breakEvenMovePct)) {
        els.breakEvenText.textContent = "Masukkan data untuk melihat analisis.";
      } else if (result.breakEvenMovePct <= 0) {
        els.breakEvenText.innerHTML =
          `Harga sudah berada di atas titik impas Anda (<span class="font-bold text-slate-900">${formatCurrencyFull(result.newAvg)}</span>).`;
      } else {
        els.breakEvenText.innerHTML =
          `Harga saham perlu naik sebesar <span class="font-bold text-slate-900">${formatters.formatPct(result.breakEvenMovePct, 1)}%</span> ` +
          `dari ${formatCurrencyFull(result.refPrice)} untuk mencapai titik impas Anda.`;
      }
    }
  };

  const bindRowEvents = (row) => {
    const { priceInput, lotsInput, removeBtn } = normalizeRow(row);
    priceInput?.addEventListener("input", render);
    lotsInput?.addEventListener("input", render);
    removeBtn?.addEventListener("click", () => {
      const rows = getOrderRows();
      if (rows.length <= 1) {
        if (priceInput) priceInput.value = "";
        if (lotsInput) lotsInput.value = "";
      } else {
        row.remove();
      }
      render();
    });
  };

  const addRow = () => {
    const rows = getOrderRows();
    const template = rows[0];
    if (!template) return;

    const clone = template.cloneNode(true);
    const { priceInput, lotsInput } = normalizeRow(clone);
    if (priceInput) priceInput.value = "";
    if (lotsInput) lotsInput.value = "";

    els.orderRows.appendChild(clone);
    bindRowEvents(clone);
    priceInput?.focus();
  };

  const resetAll = () => {
    els.currentAvgPrice.value = "";
    els.currentLots.value = "";

    const rows = getOrderRows();
    rows.forEach((row, index) => {
      if (index === 0) {
        const { priceInput, lotsInput } = normalizeRow(row);
        if (priceInput) priceInput.value = "";
        if (lotsInput) lotsInput.value = "";
        return;
      }
      row.remove();
    });

    render();
  };

  // Display history
  const displayHistory = () => {
    const history = storage.load(HISTORY_KEY);

    if (history.length === 0) {
      els.noHistoryMessage.style.display = 'block';
      els.historyList.innerHTML = '';
      els.historyList.appendChild(els.noHistoryMessage);
      return;
    }

    els.noHistoryMessage.style.display = 'none';
    els.historyList.innerHTML = '';

    history.forEach(entry => {
      const historyItem = document.createElement('div');
      historyItem.className = 'p-4 hover:bg-slate-50 transition-colors';

      const timestamp = new Date(entry.timestamp).toLocaleString('id-ID');
      const currentAvg = formatters.formatCurrency(entry.data.currentAvgPrice);
      const currentLots = entry.data.currentLots;
      const ordersCount = entry.data.orders.length;
      const newAvg = formatters.formatCurrency(entry.data.result.newAvg);

      historyItem.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-bold text-slate-900 truncate">${entry.id}</span>
              <span class="text-xs text-slate-500">${timestamp}</span>
            </div>
            <div class="text-sm text-slate-600 space-y-1">
              <div>Harga Rata-rata Awal: <span class="font-medium">${currentAvg}</span></div>
              <div>Lot Awal: <span class="font-medium">${currentLots}</span></div>
              <div>Order Tambahan: <span class="font-medium">${ordersCount} order</span></div>
              <div class="pt-1 border-t border-slate-100">
                <span class="font-bold text-primary">Harga Rata-rata Baru: ${newAvg}</span>
              </div>
            </div>
          </div>
          <button class="load-history-btn ml-4 p-2 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100"
                  data-id="${entry.id}">
            <span class="material-symbols-outlined text-sm">restore</span>
          </button>
        </div>
      `;

      els.historyList.appendChild(historyItem);
    });

    document.querySelectorAll('.load-history-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const history = storage.load(HISTORY_KEY);
        const entry = history.find(item => item.id == id);

        if (entry) {
          loadFromHistory(entry.data);
        }
      });
    });
  };

  const loadFromHistory = (data) => {
    els.currentAvgPrice.value = data.currentAvgPrice;
    els.currentLots.value = data.currentLots;

    const rows = getOrderRows();
    for (let i = 1; i < rows.length; i++) {
      rows[i].remove();
    }

    if (rows.length > 0) {
      const { priceInput, lotsInput } = normalizeRow(rows[0]);
      if (data.orders[0]) {
        priceInput.value = data.orders[0].price;
        lotsInput.value = data.orders[0].lots;
      }
    }

    for (let i = 1; i < data.orders.length; i++) {
      addRow();
      const allRows = getOrderRows();
      const newRow = allRows[allRows.length - 1];
      const { priceInput, lotsInput } = normalizeRow(newRow);

      if (priceInput && lotsInput) {
        priceInput.value = data.orders[i].price;
        lotsInput.value = data.orders[i].lots;
      }
    }

    render();
  };

  const clearHistory = () => {
    if (confirm('Apakah Anda yakin ingin menghapus semua riwayat perhitungan?')) {
      storage.clear(HISTORY_KEY);
      displayHistory();
    }
  };

  const saveCurrentCalculation = () => {
    const formData = getFormData();
    const result = calculate();

    if (formData.currentAvgPrice > 0 || formData.orders.length > 0) {
      const historyData = {
        ...formData,
        result: {
          newAvg: result.newAvg,
          totalLots: result.totalLots,
          totalShares: result.totalShares,
          totalValue: result.totalCost
        }
      };

      storage.save(HISTORY_KEY, historyData, 10, 'average_price');
      displayHistory();
    }
  };

  getOrderRows().forEach(bindRowEvents);
  els.currentAvgPrice.addEventListener("input", render);
  els.currentLots.addEventListener("input", render);
  els.addOrderRowBtn?.addEventListener("click", addRow);
  els.calculateBtn?.addEventListener("click", () => {
    render();
    saveCurrentCalculation();
  });
  els.resetBtn?.addEventListener("click", resetAll);
  els.clearHistoryBtn?.addEventListener("click", clearHistory);

  displayHistory();
  render();
})();
