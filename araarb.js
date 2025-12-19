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

  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const nfPct = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const toNonNegativeInt = (value) => {
    if (value === null || value === undefined) return 0;
    const raw = String(value).trim();
    if (raw === "") return 0;
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") return 0;
    const numberValue = Number(digits);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;
    return Math.floor(numberValue);
  };

  const formatNumber = (value) => nf0.format(Math.round(value || 0));
  const formatTick = (tick) => `Rp ${formatNumber(tick)}`;

  const getAraArbTier = (price) => {
    if (price < 200) return { tier: 1, pct: 0.35 };
    if (price <= 5000) return { tier: 2, pct: 0.25 };
    return { tier: 3, pct: 0.2 };
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

  const floorToTick = (value) => {
    const tick = getTickSize(value);
    if (!Number.isFinite(tick) || tick <= 0) return Math.floor(value);
    return Math.floor(value / tick) * tick;
  };

  const ceilToTick = (value) => {
    const tick = getTickSize(value);
    if (!Number.isFinite(tick) || tick <= 0) return Math.ceil(value);
    return Math.ceil(value / tick) * tick;
  };

  const setTier = (tier) => {
    if (els.tier1) els.tier1.checked = tier === 1;
    if (els.tier2) els.tier2.checked = tier === 2;
    if (els.tier3) els.tier3.checked = tier === 3;
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

  const render = () => {
    const basePrice = toNonNegativeInt(els.prevClose.value);
    if (basePrice <= 0) {
      renderEmpty();
      return;
    }

    const { tier, pct } = getAraArbTier(basePrice);
    setTier(tier);

    const rawAra = basePrice * (1 + pct);
    const rawArb = basePrice * (1 - pct);

    const araPrice = floorToTick(rawAra);
    const arbPrice = Math.max(0, ceilToTick(rawArb));

    const araTick = getTickSize(araPrice);
    const baseTick = getTickSize(basePrice);
    const arbTick = getTickSize(arbPrice);

    const araDelta = araPrice - basePrice;
    const arbDelta = basePrice - arbPrice;

    if (els.araPctBadge) els.araPctBadge.textContent = `+${nfPct.format(pct * 100)}%`;
    if (els.arbPctBadge) els.arbPctBadge.textContent = `-${nfPct.format(pct * 100)}%`;

    if (els.araPrice) els.araPrice.textContent = formatNumber(araPrice);
    if (els.arbPrice) els.arbPrice.textContent = formatNumber(arbPrice);

    if (els.araDeltaText) els.araDeltaText.textContent = `Naik Rp ${formatNumber(araDelta)}`;
    if (els.arbDeltaText) els.arbDeltaText.textContent = `Turun Rp ${formatNumber(arbDelta)}`;

    if (els.analysisReference) els.analysisReference.textContent = `Berdasarkan Rp ${formatNumber(basePrice)}`;

    if (els.analysisAraPrice) els.analysisAraPrice.textContent = formatNumber(araPrice);
    if (els.analysisAraTick) els.analysisAraTick.textContent = formatTick(araTick);

    if (els.analysisBasePrice) els.analysisBasePrice.textContent = formatNumber(basePrice);
    if (els.analysisBaseTick) els.analysisBaseTick.textContent = formatTick(baseTick);

    if (els.analysisArbPrice) els.analysisArbPrice.textContent = formatNumber(arbPrice);
    if (els.analysisArbTick) els.analysisArbTick.textContent = formatTick(arbTick);
  };

  const bindEvents = () => {
    els.prevClose?.addEventListener("input", render);
    els.prevClose?.addEventListener("change", render);
    els.calculateBtn?.addEventListener("click", render);
  };

  bindEvents();
  render();
})();

