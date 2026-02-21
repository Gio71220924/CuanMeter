(() => {
  const els = {
    prevClose: document.getElementById("prevClose"),

    tier1: document.getElementById("tier1"),
    tier2: document.getElementById("tier2"),
    tier3: document.getElementById("tier3"),

    calculateBtn: document.getElementById("calculateBtn"),

    araPctBadge: document.getElementById("araPctBadge"),
    arbPctBadge: document.getElementById("arbPctBadge"),

    araPrice: document.getElementById("araPrice"),
    arbPrice: document.getElementById("arbPrice"),

    araDeltaText: document.getElementById("araDeltaText"),
    arbDeltaText: document.getElementById("arbDeltaText"),

    analysisReference: document.getElementById("analysisReference"),
    analysisAraPrice: document.getElementById("analysisAraPrice"),
    analysisAraTick: document.getElementById("analysisAraTick"),
    analysisBasePrice: document.getElementById("analysisBasePrice"),
    analysisBaseTick: document.getElementById("analysisBaseTick"),
    analysisArbPrice: document.getElementById("analysisArbPrice"),
    analysisArbTick: document.getElementById("analysisArbTick"),
  };

  if (!els.prevClose) return;

  const { formatters, idx, storage } = window.CuanMeterUtils;
  const HISTORY_KEY = 'araarbHistory';

  const formatInput = (input) => {
    if (!input) return;
    const selectionStart = input.selectionStart;
    const oldLength = input.value.length;

    let value = input.value.replace(/[^0-9]/g, "");
    if (value === "") {
      input.value = "";
      return;
    }
    
    input.value = formatters.nf0.format(parseInt(value));

    const newLength = input.value.length;
    const newPosition = selectionStart + (newLength - oldLength);
    input.setSelectionRange(newPosition, newPosition);
  };

  const formatTick = (tick) => `Rp ${formatters.nf0.format(tick)}`;

  const getFormData = () => {
    const basePrice = formatters.toNonNegativeInt(els.prevClose.value);
    const { araPct, arbPct } = idx.getAraArbTier(basePrice);

    return {
      basePrice,
      araPct,
      arbPct
    };
  };

  const setTier = (basePrice) => {
    if (els.tier1) els.tier1.checked = basePrice < 200;
    if (els.tier2) els.tier2.checked = basePrice >= 200 && basePrice <= 5000;
    if (els.tier3) els.tier3.checked = basePrice > 5000;
  };

  const renderEmpty = () => {
    setTier(null);

    if (els.araPctBadge) els.araPctBadge.textContent = "+0.00%";
    if (els.arbPctBadge) els.arbPctBadge.textContent = "-0.00%";

    if (els.araPrice) els.araPrice.textContent = "0";
    if (els.arbPrice) els.arbPrice.textContent = "0";

    if (els.araDeltaText) els.araDeltaText.textContent = "Naik Rp 0";
    if (els.arbDeltaText) els.arbDeltaText.textContent = "Turun Rp 0";

    if (els.analysisReference) els.analysisReference.textContent = "Berdasarkan Rp 0";

    if (els.analysisAraPrice) els.analysisAraPrice.textContent = "0";
    if (els.analysisAraTick) els.analysisAraTick.textContent = "Rp 1";

    if (els.analysisBasePrice) els.analysisBasePrice.textContent = "0";
    if (els.analysisBaseTick) els.analysisBaseTick.textContent = "Rp 1";

    if (els.analysisArbPrice) els.analysisArbPrice.textContent = "0";
    if (els.analysisArbTick) els.analysisArbTick.textContent = "Rp 1";
  };

  const calculate = () => {
    const basePrice = formatters.toNonNegativeInt(els.prevClose.value);
    if (basePrice <= 0) {
      return null;
    }

    const { araPct, arbPct } = idx.getAraArbTier(basePrice);

    const rawAra = basePrice * (1 + araPct);
    const rawArb = basePrice * (1 - arbPct);

    const araPrice = idx.floorToTick(rawAra);
    const arbPrice = Math.max(0, idx.ceilToTick(rawArb));

    const araTick = idx.getTickSize(araPrice);
    const baseTick = idx.getTickSize(basePrice);
    const arbTick = idx.getTickSize(arbPrice);

    const araDelta = araPrice - basePrice;
    const arbDelta = basePrice - arbPrice;

    return {
      basePrice,
      araPct,
      arbPct,
      araPrice,
      arbPrice,
      araDelta,
      arbDelta,
      araTick,
      baseTick,
      arbTick
    };
  };

  const render = () => {
    const result = calculate();
    if (!result) {
      renderEmpty();
      return;
    }

    const { basePrice, araPct, arbPct, araPrice, arbPrice, araDelta, arbDelta, araTick, baseTick, arbTick } = result;

    setTier(basePrice);

    if (els.araPctBadge) els.araPctBadge.textContent = `+${formatters.formatPct(araPct * 100, 0)}%`;
    if (els.arbPctBadge) els.arbPctBadge.textContent = `-${formatters.formatPct(arbPct * 100, 0)}%`;

    if (els.araPrice) els.araPrice.textContent = formatters.nf0.format(araPrice);
    if (els.arbPrice) els.arbPrice.textContent = formatters.nf0.format(arbPrice);

    if (els.araDeltaText) els.araDeltaText.textContent = `Naik Rp ${formatters.nf0.format(araDelta)}`;
    if (els.arbDeltaText) els.arbDeltaText.textContent = `Turun Rp ${formatters.nf0.format(arbDelta)}`;

    if (els.analysisReference) els.analysisReference.textContent = `Berdasarkan Rp ${formatters.nf0.format(basePrice)}`;

    if (els.analysisAraPrice) els.analysisAraPrice.textContent = formatters.nf0.format(araPrice);
    if (els.analysisAraTick) els.analysisAraTick.textContent = formatTick(araTick);

    if (els.analysisBasePrice) els.analysisBasePrice.textContent = formatters.nf0.format(basePrice);
    if (els.analysisBaseTick) els.analysisBaseTick.textContent = formatTick(baseTick);

    if (els.analysisArbPrice) els.analysisArbPrice.textContent = formatters.nf0.format(arbPrice);
    if (els.analysisArbTick) els.analysisArbTick.textContent = formatTick(arbTick);
  };

  // Save to history after calculation
  const saveCurrentCalculation = () => {
    const formData = getFormData();
    const result = calculate();

    if (result && result.basePrice > 0) {
      const historyData = {
        ...formData,
        result: {
          araPrice: result.araPrice,
          arbPrice: result.arbPrice,
          araDelta: result.araDelta,
          arbDelta: result.arbDelta
        }
      };

      storage.save(HISTORY_KEY, historyData, 10, 'ara_arb');
    }
  };

  const bindEvents = () => {
    els.prevClose?.addEventListener("input", (e) => {
      formatInput(e.target);
      render();
    });
    els.prevClose?.addEventListener("change", render);
    els.calculateBtn?.addEventListener("click", () => {
      render();
      saveCurrentCalculation();
    });
  };

  bindEvents();
  render();
})();