(() => {
  const LOT_SIZE = 100;

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
  };

  if (!els.buyPrice || !els.sellPrice || !els.lots) return;

  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const nfPct = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

  const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const raw = String(value).trim();
    if (raw === "") return 0;
    const numberValue = Number(raw.replace(/\s+/g, "").replace(",", "."));
    if (!Number.isFinite(numberValue)) return 0;
    return numberValue;
  };

  const toNonNegativeNumber = (value) => {
    const numberValue = toNumber(value);
    if (numberValue <= 0) return 0;
    return numberValue;
  };

  const toNonNegativeInt = (value) => Math.floor(toNonNegativeNumber(value));

  const formatCurrency = (value) => `Rp ${nf0.format(Math.round(value))}`;

  const formatCurrencySigned = (value) => {
    const rounded = Math.round(value);
    if (rounded === 0) return formatCurrency(0);
    const absValue = Math.abs(rounded);
    const formatted = formatCurrency(absValue);
    return rounded < 0 ? `-${formatted}` : formatted;
  };

  const formatCost = (value) => {
    if (!Number.isFinite(value) || value <= 0) return "Rp 0";
    return `-(Rp ${nf0.format(Math.round(value))})`;
  };

  const getTickSize = (price) => {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    if (price < 10000) return 25;
    if (price < 20000) return 50;
    return 100;
  };

  const readInputs = () => {
    const buyPrice = toNonNegativeNumber(els.buyPrice.value);
    const sellPrice = toNonNegativeNumber(els.sellPrice.value);
    const lots = toNonNegativeInt(els.lots.value);
    const shares = lots * LOT_SIZE;

    const buyFeePct = toNonNegativeNumber(els.buyFeePct?.value);
    const sellFeePct = toNonNegativeNumber(els.sellFeePct?.value);

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

    return { ...input, buyGross, sellGross, buyTotal, sellNet, netProfit, totalCosts, roiPct };
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

    if (els.totalBuyValue) els.totalBuyValue.textContent = formatCurrency(result.buyGross);
    if (els.totalSellValue) els.totalSellValue.textContent = formatCurrency(result.sellGross);
    if (els.totalCostsValue) els.totalCostsValue.textContent = formatCost(result.totalCosts);

    if (els.netProfit) els.netProfit.textContent = formatCurrencySigned(result.netProfit);

    if (els.roiPct) {
      const sign = result.roiPct > 0 ? "+" : "";
      els.roiPct.textContent = `${sign}${nfPct.format(result.roiPct)}%`;
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

    els.calculateBtn?.addEventListener("click", render);
    els.resetBtn?.addEventListener("click", resetAll);

    document.querySelectorAll("[data-stepper][data-target]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();

        const direction = btn.getAttribute("data-stepper");
        const targetId = btn.getAttribute("data-target");
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;

        const current = toNonNegativeNumber(input.value);
        const tickRef = direction === "dec" ? Math.max(0, current - 1) : current;
        let step = getTickSize(tickRef || 0);
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
