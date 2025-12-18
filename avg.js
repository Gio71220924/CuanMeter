(() => {
  const LOT_SIZE = 100;

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
  };

  // Kalau ID tidak ketemu, stop (biasanya karena file HTML beda / typo id)
  if (!els.currentAvgPrice || !els.currentLots || !els.orderRows) return;

  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const nfPct = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

  const toNonNegativeNumber = (value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;
    return numberValue;
  };

  const toNonNegativeInt = (value) => Math.floor(toNonNegativeNumber(value));
  const formatCurrencyFull = (value) => `Rp ${nf0.format(Math.round(value))}`;

  const formatCurrencyCompact = (value) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    const units = [
      { suffix: "T", value: 1e12 },
      { suffix: "M", value: 1e9 }, // (Indonesia sering pakai M = miliar)
      { suffix: "Jt", value: 1e6 }, // juta
      { suffix: "Rb", value: 1e3 }, // ribu
    ];

    for (const unit of units) {
      if (absValue >= unit.value) {
        const scaled = absValue / unit.value;
        let formatted = scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
        return `${sign}Rp ${formatted}${unit.suffix}`;
      }
    }
    return `${sign}Rp ${nf0.format(Math.round(absValue))}`;
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
      const price = toNonNegativeNumber(priceInput?.value);
      const lots = toNonNegativeInt(lotsInput?.value);
      if (price > 0 && lots > 0) {
        orders.push({ price, lots });
        lastOrderPrice = price;
      }
    }

    return { orders, lastOrderPrice };
  };

  const calculate = () => {
    const currentAvgPrice = toNonNegativeNumber(els.currentAvgPrice.value);
    const currentLots = toNonNegativeInt(els.currentLots.value);

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

    // kalau user belum isi order baru, break-even pakai avg sekarang
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
    els.averagePriceDeltaText.textContent = `${sign}${nfPct.format(deltaPct)}% dari awal`;

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

    if (els.newAveragePrice) els.newAveragePrice.textContent = nf0.format(Math.round(result.newAvg));
    if (els.totalLots) els.totalLots.textContent = nf0.format(result.totalLots);
    if (els.totalShares) els.totalShares.textContent = `${nf0.format(result.totalShares)} Saham`;
    if (els.totalValue) els.totalValue.textContent = formatCurrencyCompact(result.totalCost);

    renderDeltaBadge(result.deltaPct);

    if (els.breakEvenText) {
      if (result.totalShares === 0 || result.breakEvenMovePct === null || !Number.isFinite(result.breakEvenMovePct)) {
        els.breakEvenText.textContent = "Masukkan data untuk melihat analisis.";
      } else if (result.breakEvenMovePct <= 0) {
        els.breakEvenText.innerHTML =
          `Harga sudah berada di atas titik impas Anda (<span class="font-bold text-slate-900">${formatCurrencyFull(result.newAvg)}</span>).`;
      } else {
        els.breakEvenText.innerHTML =
          `Harga saham perlu naik sebesar <span class="font-bold text-slate-900">${nfPct.format(result.breakEvenMovePct)}%</span> ` +
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

  // init
  getOrderRows().forEach(bindRowEvents);
  els.currentAvgPrice.addEventListener("input", render);
  els.currentLots.addEventListener("input", render);
  els.addOrderRowBtn?.addEventListener("click", addRow);
  els.calculateBtn?.addEventListener("click", render);
  els.resetBtn?.addEventListener("click", resetAll);

  render();
})();