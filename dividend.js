document.addEventListener('DOMContentLoaded', () => {
    const divPerShareInput = document.getElementById('div_per_share');
    const sharePriceInput = document.getElementById('share_price');
    const sharesOwnedInput = document.getElementById('shares_owned');
    const taxToggle = document.getElementById('tax_toggle');
    const calculateBtn = document.getElementById('calculateBtn');

    // Result elements
    const netYieldResult = document.getElementById('net_yield');
    const grossYieldText = document.getElementById('gross_yield_text');
    const totalInvestmentResult = document.getElementById('total_investment');
    const totalDivGrossResult = document.getElementById('total_div_gross');
    const taxAmountResult = document.getElementById('tax_amount');
    const totalDivNetResult = document.getElementById('total_div_net');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    const STORAGE_KEY = 'cuanmeter_div_history';

    function calculate(saveToHistory = true) {
        const utils = window.CuanMeterUtils;
        const divPerShare = utils ? utils.formatters.toNumber(divPerShareInput.value) : parseFloat(divPerShareInput.value) || 0;
        const sharePrice = utils ? utils.formatters.toNumber(sharePriceInput.value) : parseFloat(sharePriceInput.value) || 0;
        const lotsOwned = parseFloat(sharesOwnedInput.value) || 0;
        const sharesOwned = lotsOwned * 100;
        const isTaxEnabled = taxToggle.checked;

        if (sharePrice <= 0 || divPerShare <= 0) {
            resetResults();
            return;
        }

        // Calculations
        const totalInvestment = sharePrice * sharesOwned;
        const grossYield = (divPerShare / sharePrice) * 100;
        const totalGross = divPerShare * sharesOwned;
        const taxAmount = isTaxEnabled ? totalGross * 0.1 : 0;
        const totalNet = totalGross - taxAmount;
        const netYield = (totalNet / (totalInvestment || 1)) * 100;

        // Display results
        const formatter = window.CuanMeterUtils ? window.CuanMeterUtils.formatters : {
            nf2: new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }),
            nf0: new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
        };

        const netYieldValue = isTaxEnabled ? netYield : grossYield;
        netYieldResult.textContent = `${formatter.nf2.format(netYieldValue)}%`;
        grossYieldText.textContent = `Gross: ${formatter.nf2.format(grossYield)}%`;
        totalInvestmentResult.textContent = `Rp ${formatter.nf0.format(totalInvestment)}`;
        totalDivGrossResult.textContent = `Rp ${formatter.nf0.format(totalGross)}`;
        taxAmountResult.textContent = `Rp ${formatter.nf0.format(taxAmount)}`;
        totalDivNetResult.textContent = `Rp ${formatter.nf0.format(totalNet)}`;

        // Save to History (if triggered by button or specific action)
        if (saveToHistory && sharesOwned > 0) {
            const data = {
                divPerShare,
                sharePrice,
                lotsOwned,
                netYield: netYieldValue,
                totalNet,
                totalInvestment,
                timestamp: new Date().toISOString()
            };
            saveHistory(data);
        }

        // Add animation class
        netYieldResult.classList.add('animate-pulse');
        setTimeout(() => netYieldResult.classList.remove('animate-pulse'), 1000);
    }

    function saveHistory(data) {
        if (!window.CuanMeterUtils) return;
        window.CuanMeterUtils.storage.save(STORAGE_KEY, data, 10, 'dividend');
        renderHistory();
    }

    function renderHistory() {
        if (!window.CuanMeterUtils || !historyList) return;
        const history = window.CuanMeterUtils.storage.load(STORAGE_KEY);
        const formatter = window.CuanMeterUtils.formatters;

        if (history.length === 0) {
            historyList.innerHTML = `
                <div id="noHistoryMessage" class="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors">
                    <span class="material-symbols-outlined text-5xl mb-4 block text-slate-300 dark:text-slate-600">history</span>
                    <p class="font-bold text-lg">Belum ada riwayat</p>
                    <p class="text-sm mt-1">Lakukan perhitungan untuk menyimpannya di sini</p>
                </div>
            `;
            return;
        }

        let html = '';
        history.forEach(item => {
            const data = item.data;
            const date = new Date(item.timestamp).toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            html += `
                <div class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-dark-bg/20 transition-colors group">
                    <div class="flex items-center gap-4">
                        <div class="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <span class="material-symbols-outlined">payments</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-black text-slate-900 dark:text-white">Yield ${formatter.nf2.format(data.netYield)}%</span>
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</span>
                            </div>
                            <p class="text-sm text-slate-500 dark:text-slate-400">Modal: Rp ${formatter.nf0.format(data.totalInvestment)} • Dividen: Rp ${formatter.nf0.format(data.divPerShare)}/saham</p>
                        </div>
                    </div>
                    <div class="flex items-center justify-between md:justify-end gap-6">
                        <div class="text-right">
                            <span class="block text-lg font-black text-accent-mint">Rp ${formatter.nf0.format(data.totalNet)}</span>
                            <span class="block text-[10px] font-bold text-slate-400 uppercase">Dividen Bersih</span>
                        </div>
                        <button onclick="window.CuanMeterUtils.storage.deleteItem('${STORAGE_KEY}', ${item.id}); window.dispatchEvent(new Event('historyUpdate'));" class="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </div>
            `;
        });

        historyList.innerHTML = html;
    }

    function resetResults() {
        netYieldResult.textContent = '0%';
        grossYieldText.textContent = 'Gross: 0%';
        totalInvestmentResult.textContent = 'Rp 0';
        totalDivGrossResult.textContent = 'Rp 0';
        taxAmountResult.textContent = 'Rp 0';
        totalDivNetResult.textContent = 'Rp 0';
    }

    calculateBtn.addEventListener('click', () => calculate(true));

    // Auto calculate on input change with masking for price fields
    [divPerShareInput, sharePriceInput].forEach(el => {
        el.addEventListener('input', (e) => {
            window.CuanMeterUtils.formatters.formatInput(e.target);
            calculate(false);
        });
    });

    sharesOwnedInput.addEventListener('input', () => calculate(false));
    taxToggle.addEventListener('change', () => calculate(false));

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Hapus semua riwayat dividen?')) {
            window.CuanMeterUtils.storage.clear(STORAGE_KEY);
            renderHistory();
        }
    });

    // Listen for history updates
    window.addEventListener('historyUpdate', renderHistory);

    // Initial load
    renderHistory();
});
