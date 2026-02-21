/**
 * CuanMeter Share Image Tool
 * Uses html2canvas to capture calculator results as beautiful images
 */

window.CuanMeterShare = (() => {
    const capture = async (elementId, filename = 'CuanMeter_Plan.png') => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element ${elementId} not found`);
            return;
        }

        if (window.CuanMeterToast) window.CuanMeterToast.info('Menyiapkan gambar...');

        try {
            // Using a higher scale for better quality
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    // Pre-capture styling for the cloned element
                    const clonedElement = clonedDoc.getElementById(elementId);
                    if (clonedElement) {
                        clonedElement.style.padding = '20px';
                        clonedElement.style.borderRadius = '16px';
                    }
                }
            });

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();

            if (window.CuanMeterToast) window.CuanMeterToast.success('Gambar berhasil disimpan!');
        } catch (error) {
            console.error('Error capturing image:', error);
            if (window.CuanMeterToast) window.CuanMeterToast.error('Gagal mengambil gambar');
        }
    };

    // Initialize share buttons
    const init = (btnId, targetId, filename) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => capture(targetId, filename));
        }
    };

    return { capture, init };
})();

// Auto-init for common pages
document.addEventListener('DOMContentLoaded', () => {
    // Average Price Page
    if (document.getElementById('averagePriceCard')) {
        window.CuanMeterShare.init('btn_share', 'averagePriceCard', 'CuanMeter_AvgDown.png');
    }
    
    // Position Size Page
    if (document.getElementById('result_area')) {
        window.CuanMeterShare.init('btn_share', 'result_area', 'CuanMeter_AmmoPlan.png');
    }
});
