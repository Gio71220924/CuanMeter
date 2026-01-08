(() => {
  const { formatters, idx, storage } = window.CuanMeterUtils;
  const LOT_SIZE = idx.LOT_SIZE;
  const HISTORY_KEY = 'profitCalcHistory';

  const els = {
    buyPrice: document.getElementById("buy_price"),
    sellPrice: document.getElementById("sell_price"),
    lots: document.getElementById("quantity"),

    buyFeePct: document.getElementById("buy_fee_pct"),
    sellFeePct: document.getElementById("sell_fee_pct"),

    resetBtn: document.getElementById("resetBtn"),
    calculateBtn: document.getElementById("calculateBtn"),

    netProfit: document.getElementById("netProfit"),
    roiBadge: document.getElementById("roiBadge"),
    roiIcon: document.getElementById("roiIcon"),
    roiPct: document.getElementById("roiPct"),
    totalBuyValue: document.getElementById("totalBuyValue"),
    totalSellValue: document.getElementById("totalSellValue"),
    totalCostsValue: document.getElementById("totalCostsValue"),
    breakEvenPrice: document.getElementById("breakEvenPrice"),
  };

  if (!els.buyPrice || !els.sellPrice || !els.lots) return;

  const formatCost = (value) => {
    if (!Number.isFinite(value) || value <= 0) return "Rp 0";
    return `-(Rp ${formatters.nf0.format(Math.round(value))})`;
  };

  const formatCurrencySigned = (value) => {
    const rounded = Math.round(value);
    if (rounded === 0) return formatters.formatCurrency(0);
    const absValue = Math.abs(rounded);
    const formatted = formatters.formatCurrency(absValue);
    return rounded < 0 ? `-${formatted}` : formatted;
  };

  const getFormData = () => {
    const buyPrice = formatters.toNonNegativeNumber(els.buyPrice.value);
    const sellPrice = formatters.toNonNegativeNumber(els.sellPrice.value);
    const lots = formatters.toNonNegativeInt(els.lots.value);
    const buyFeePct = formatters.toNonNegativeNumber(els.buyFeePct?.value);
    const sellFeePct = formatters.toNonNegativeNumber(els.sellFeePct?.value);

    return {
      buyPrice,
      sellPrice,
      lots,
      buyFeePct,
      sellFeePct
    };
  };

  const readInputs = () => {
    const buyPrice = formatters.toNonNegativeNumber(els.buyPrice.value);
    const sellPrice = formatters.toNonNegativeNumber(els.sellPrice.value);
    const lots = formatters.toNonNegativeInt(els.lots.value);
    const shares = lots * LOT_SIZE;

    const buyFeePct = formatters.toNonNegativeNumber(els.buyFeePct?.value);
    const sellFeePct = formatters.toNonNegativeNumber(els.sellFeePct?.value);

    return { buyPrice, sellPrice, lots, shares, buyFeePct, sellFeePct };
  };

  const calculate = () => {
    const input = readInputs();
    const { buyPrice, sellPrice, shares, buyFeePct, sellFeePct } = input;

    const buyGross = buyPrice * shares;
    const sellGross = sellPrice * shares;

    const buyFee = buyGross * (buyFeePct / 100);
    const sellFee = sellGross * (sellFeePct / 100);

    const buyTotal = buyGross + buyFee;
    const sellNet = sellGross - sellFee;

    const netProfit = sellNet - buyTotal;
    const totalCosts = buyFee + sellFee;
    const roiPctRaw = buyTotal > 0 ? (netProfit / buyTotal) * 100 : 0;
    const roiPct = Math.abs(roiPctRaw) < 0.005 ? 0 : roiPctRaw;

    // Break Even Point Calculation
    // BEP = SellPrice where NetProfit = 0
    // NetProfit = SellNet - BuyTotal
    // SellNet = SellPrice * Shares * (1 - sellFeePct/100)
    // BuyTotal = SellPrice * Shares * (1 - sellFeePct/100)
    // SellPrice = BuyTotal / (Shares * (1 - sellFeePct/100))
    
    let bep = 0;
    if (shares > 0 && (1 - sellFeePct/100) > 0) {
        const rawBep = buyTotal / (shares * (1 - sellFeePct/100));
        // We usually round up to the nearest tick to be safe (don't lose money), 
        // or just round to nearest int for display. 
        // Let's ceil to tick to be strictly "Break Even" (not losing).
        bep = idx.ceilToTick(rawBep);
    }

    return { ...input, buyGross, sellGross, buyTotal, sellNet, netProfit, totalCosts, roiPct, bep };
  };

  const applyTheme = (isProfit) => {
    if (els.netProfit) {
      els.netProfit.classList.toggle("text-accent-mint", isProfit);
      els.netProfit.classList.toggle("text-rose-500", !isProfit);
    }

    if (!els.roiBadge) return;

    els.roiBadge.classList.toggle("bg-accent-mint-light", isProfit);
    els.roiBadge.classList.toggle("text-accent-mint", isProfit);
    els.roiBadge.classList.toggle("border-emerald-100", isProfit);

    els.roiBadge.classList.toggle("bg-rose-50", !isProfit);
    els.roiBadge.classList.toggle("text-rose-500", !isProfit);
    els.roiBadge.classList.toggle("border-rose-100", !isProfit);
  };

  const render = () => {
    const result = calculate();

    const netProfitRounded = Math.round(result.netProfit);
    const isProfit = netProfitRounded >= 0;
    applyTheme(isProfit);

    if (els.totalBuyValue) els.totalBuyValue.textContent = formatters.formatCurrency(result.buyGross);
    if (els.totalSellValue) els.totalSellValue.textContent = formatters.formatCurrency(result.sellGross);
    if (els.totalCostsValue) els.totalCostsValue.textContent = formatCost(result.totalCosts);

    if (els.netProfit) els.netProfit.textContent = formatCurrencySigned(result.netProfit);
    
    if (els.breakEvenPrice) els.breakEvenPrice.textContent = formatters.formatCurrency(result.bep);

    if (els.roiPct) {
      const sign = result.roiPct > 0 ? "+" : "";
      els.roiPct.textContent = `${sign}${formatters.formatPct(result.roiPct)}%`;
    }

    if (els.roiIcon) els.roiIcon.textContent = isProfit ? "trending_up" : "trending_down";
  };

  const resetAll = () => {
    els.buyPrice.value = "";
    els.sellPrice.value = "";
    els.lots.value = "";

    if (els.buyFeePct) els.buyFeePct.value = "0.15";
    if (els.sellFeePct) els.sellFeePct.value = "0.25";

    render();
  };

  const saveCurrentCalculation = () => {
    const formData = getFormData();
    const result = calculate();

    if (formData.buyPrice > 0 && formData.sellPrice > 0 && formData.lots > 0) {
      const historyData = {
        ...formData,
        result: {
          netProfit: result.netProfit,
          roiPct: result.roiPct,
          totalBuyValue: result.buyGross,
          totalSellValue: result.sellGross,
          totalCosts: result.totalCosts,
          bep: result.bep
        }
      };

      storage.save(HISTORY_KEY, historyData, 10, 'profit_calc');
    }
  };

  const bindEvents = () => {
    const rerenderOnInput = (node) => {
      node?.addEventListener("input", render);
      node?.addEventListener("change", render);
    };

    rerenderOnInput(els.buyPrice);
    rerenderOnInput(els.sellPrice);
    rerenderOnInput(els.lots);

    rerenderOnInput(els.buyFeePct);
    rerenderOnInput(els.sellFeePct);

    els.calculateBtn?.addEventListener("click", () => {
      render();
      saveCurrentCalculation();
    });
    els.resetBtn?.addEventListener("click", resetAll);

    document.querySelectorAll("[data-stepper][data-target]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();

        const direction = btn.getAttribute("data-stepper");
        const targetId = btn.getAttribute("data-target");
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;

        const current = formatters.toNonNegativeNumber(input.value);
        const tickRef = direction === "dec" ? Math.max(0, current - 1) : current;
        let step = idx.getTickSize(tickRef || 0);
        if (event.shiftKey) step *= 10;

        const nextRaw = direction === "dec" ? Math.max(0, current - step) : Math.max(0, current + step);
        const next = Math.round(nextRaw);

        input.value = String(next);
        render();
        input.focus();
      });
    });
  };

  bindEvents();
  render();
})();