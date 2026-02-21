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

    function calculate() {
        const divPerShare = parseFloat(divPerShareInput.value) || 0;
        const sharePrice = parseFloat(sharePriceInput.value) || 0;
        const lotsOwned = parseFloat(sharesOwnedInput.value) || 0;
        const sharesOwned = lotsOwned * 100;
        const isTaxEnabled = taxToggle.checked;

        if (sharePrice <= 0) {
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

        netYieldResult.textContent = `${formatter.nf2.format(isTaxEnabled ? netYield : grossYield)}%`;
        grossYieldText.textContent = `Gross: ${formatter.nf2.format(grossYield)}%`;
        totalInvestmentResult.textContent = `Rp ${formatter.nf0.format(totalInvestment)}`;
        totalDivGrossResult.textContent = `Rp ${formatter.nf0.format(totalGross)}`;
        taxAmountResult.textContent = `Rp ${formatter.nf0.format(taxAmount)}`;
        totalDivNetResult.textContent = `Rp ${formatter.nf0.format(totalNet)}`;

        // Add animation class
        netYieldResult.classList.add('animate-pulse');
        setTimeout(() => netYieldResult.classList.remove('animate-pulse'), 1000);
    }

    function resetResults() {
        netYieldResult.textContent = '0%';
        grossYieldText.textContent = 'Gross: 0%';
        totalInvestmentResult.textContent = 'Rp 0';
        totalDivGrossResult.textContent = 'Rp 0';
        taxAmountResult.textContent = 'Rp 0';
        totalDivNetResult.textContent = 'Rp 0';
    }

    calculateBtn.addEventListener('click', calculate);

    // Auto calculate on input change for better UX
    [divPerShareInput, sharePriceInput, sharesOwnedInput, taxToggle].forEach(el => {
        el.addEventListener('input', calculate);
    });

    // Theme initialization
    if (window.CuanMeterUtils && window.CuanMeterUtils.theme) {
        window.CuanMeterUtils.theme.init();
    }
});
