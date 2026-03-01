(() => {
    const { formatters, idx } = window.CuanMeterUtils;
    const LOT_SIZE = idx.LOT_SIZE;

    const els = {
        totalEquity: document.getElementById("total_equity"),
        riskPercent: document.getElementById("risk_percent"),
        entryPrice: document.getElementById("entry_price"),
        stopLoss: document.getElementById("stop_loss"),
        recommendedLots: document.getElementById("recommended_lots"),
        riskAmount: document.getElementById("risk_amount"),
        totalBuyValue: document.getElementById("total_buy_value"),
        slDistancePct: document.getElementById("sl_distance_pct"),
        btnShare: document.getElementById("btn_share"),
        calculateBtn: document.getElementById("calculateBtn"),
        resetBtn: document.getElementById("resetBtn")
    };

    if (!els.totalEquity) return;

    const calculate = () => {
        const equity = formatters.toNumber(els.totalEquity.value);
        const riskPct = formatters.toNumber(els.riskPercent.value) / 100;
        const entry = formatters.toNumber(els.entryPrice.value);
        const sl = formatters.toNumber(els.stopLoss.value);

        if (equity <= 0 || entry <= 0 || sl <= 0) {
            renderEmpty();
            return;
        }

        if (entry <= sl) {
            if (window.CuanMeterToast && entry > 0) {
                window.CuanMeterToast.error('Harga beli harus lebih tinggi dari Stop Loss!');
            }
            renderEmpty();
            return;
        }

        // 1. Uang yang siap dirisikokan (Risk Amount)
        const riskAmount = equity * riskPct;

        // 2. Risiko per lembar saham (Risk per Share)
        const riskPerShare = entry - sl;

        // 3. Jarak ke SL dalam persen
        const slDistancePct = (riskPerShare / entry) * 100;

        // 4. Jumlah lembar saham maksimal (Max Shares)
        // Rumus: Risk Amount / Risk per Share
        const maxShares = riskAmount / riskPerShare;

        // 5. Konversi ke Lot (Round down)
        const maxLots = Math.floor(maxShares / LOT_SIZE);

        // 6. Total nilai pembelian
        const totalBuy = maxLots * LOT_SIZE * entry;

        render(maxLots, riskAmount, totalBuy, slDistancePct);
    };

    const render = (lots, risk, totalBuy, slPct) => {
        // Use nf0 for thousands separator in Lot count (e.g., 1.000)
        els.recommendedLots.textContent = formatters.nf0.format(lots);
        els.riskAmount.textContent = formatters.formatCurrency(risk);
        els.totalBuyValue.textContent = formatters.formatCurrency(totalBuy);
        els.slDistancePct.textContent = `${formatters.nfPct1.format(slPct)}%`;

        // Visual feedback based on buying power
        const equity = formatters.toNumber(els.totalEquity.value);
        if (totalBuy > equity) {
            els.totalBuyValue.classList.add('text-red-200');
            els.recommendedLots.classList.add('text-orange-200');
            if (window.CuanMeterToast) {
                window.CuanMeterToast.warning('Total beli melebihi modal Anda!', 2000);
            }
        } else {
            els.totalBuyValue.classList.remove('text-red-200');
            els.recommendedLots.classList.remove('text-orange-200');
        }
    };

    const renderEmpty = () => {
        els.recommendedLots.textContent = "0";
        els.riskAmount.textContent = "Rp 0";
        els.totalBuyValue.textContent = "Rp 0";
        els.slDistancePct.textContent = "0%";
    };

    const init = () => {
        [els.totalEquity, els.entryPrice, els.stopLoss].forEach(el => {
            el.addEventListener("input", (e) => {
                formatters.formatInput(e.target);
                calculate();
            });
        });

        els.riskPercent.addEventListener("input", calculate);

        els.calculateBtn?.addEventListener("click", () => {
            calculate();
            if (window.CuanMeterToast) window.CuanMeterToast.success('Perhitungan diperbarui');
        });

        els.resetBtn?.addEventListener("click", () => {
          els.totalEquity.value = "";
          els.riskPercent.value = "1";
          els.entryPrice.value = "";
          els.stopLoss.value = "";
          renderEmpty();
          if (window.CuanMeterToast) window.CuanMeterToast.info('Data telah di-reset');
        });
    };

    init();

    // Stock search integration
    if (window.StockSearch) {
        const target = els.entryPrice.closest('section');
        if (target) {
            window.StockSearch.init({
                insertBefore: target,
                label: 'Cari Saham IDX',
                placeholder: 'Ketik kode saham, misal TLKM...',
                onSelect: ({ price }) => {
                    els.entryPrice.value = formatters.nf0.format(price);
                    calculate();
                }
            });
        }
    }
})();