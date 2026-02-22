(() => {
  const { formatters } = window.CuanMeterUtils;
  
  const shareBtn = document.getElementById("shareBtn"); // Make sure to add this button in HTML if not exists, or hook into existing Result Card click?
  // Actually, usually we put a share button in the result card. 
  // Let's assume we will add a share icon/button in the result card.
  
  const els = {
    shareContainer: document.getElementById("shareContainer"),
    shareNewAvg: document.getElementById("shareNewAvg"),
    shareDelta: document.getElementById("shareDelta"),
    shareTotalLots: document.getElementById("shareTotalLots"),
    shareTotalValue: document.getElementById("shareTotalValue"),
    
    // Source Elements
    newAveragePrice: document.getElementById("newAveragePrice"),
    totalLots: document.getElementById("totalLots"),
    totalValue: document.getElementById("totalValue"),
    averagePriceDeltaBadge: document.getElementById("averagePriceDeltaBadge"),
    averagePriceDeltaText: document.getElementById("averagePriceDeltaText"),
    averagePriceDeltaIcon: document.getElementById("averagePriceDeltaIcon"),
    
    resultCard: document.querySelector(".glass-dark"), // The main result card to click?
  };

  if (!els.shareContainer) return;

  const generateAndShare = async () => {
    // 1. Populate Data
    els.shareNewAvg.textContent = els.newAveragePrice.textContent;
    els.shareTotalLots.textContent = els.totalLots.textContent;
    els.shareTotalValue.textContent = els.totalValue.textContent;
    
    // Copy Delta Badge Style
    const isHidden = els.averagePriceDeltaBadge.classList.contains("hidden");
    if (isHidden) {
        els.shareDelta.style.opacity = "0";
    } else {
        els.shareDelta.style.opacity = "1";
        const text = els.averagePriceDeltaText.textContent;
        els.shareDelta.querySelector("span:last-child").textContent = text;
        
        // Check if green or red
        const isGreen = els.averagePriceDeltaBadge.classList.contains("bg-success/20") || els.averagePriceDeltaBadge.classList.contains("text-success");
        const iconName = els.averagePriceDeltaIcon.textContent;
        
        els.shareDelta.querySelector(".material-symbols-outlined").textContent = iconName;
        
        if (isGreen) {
            els.shareDelta.className = "mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20";
        } else {
            els.shareDelta.className = "mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20";
        }
    }

    // 2. Prepare Container
    els.shareContainer.style.display = "flex"; // Make visible for capture
    
    try {
        // 3. Render
        const canvas = await html2canvas(els.shareContainer, {
            scale: 2, // High res
            backgroundColor: "#0f172a", // Dark background
            logging: false,
            useCORS: true
        });
        
        // 4. Convert to Blob
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            
            const file = new File([blob], "stockcalc-analysis.png", { type: "image/png" });
            
            // 5. Share or Download
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Analisis StockCalcID',
                        text: 'Cek perhitungan saham saya di StockCalcID!'
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Share failed:', err);
                        downloadImage(canvas); // Fallback
                    }
                }
            } else {
                downloadImage(canvas);
            }
            
            // Cleanup
            els.shareContainer.style.display = "none"; // Hide again? Or keep it off-screen class?
            // Actually it has -left-[9999px] class, so display:flex is fine, it renders offscreen.
        }, 'image/png');
        
    } catch (err) {
        console.error("Capture failed:", err);
        if (window.CuanMeterToast) window.CuanMeterToast.error("Gagal membuat gambar.");
    }
  };
  
  const downloadImage = (canvas) => {
      const link = document.createElement("a");
      link.download = `stockcalc-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      if (window.CuanMeterToast) window.CuanMeterToast.success("Gambar berhasil disimpan!");
  };

  // Add Share Button to Result Card (Dynamically)
  const addShareButton = () => {
      if (!els.resultCard) return;
      
      // Check if already added
      if (els.resultCard.querySelector("#shareActionBtn")) return;
      
      const btn = document.createElement("button");
      btn.id = "shareActionBtn";
      btn.className = "absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-primary hover:bg-white transition-all shadow-sm z-20";
      btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">share</span>`;
      btn.setAttribute("aria-label", "Bagikan Analisis");
      
      btn.addEventListener("click", generateAndShare);
      
      els.resultCard.appendChild(btn);
  };

  // Init
  if (els.resultCard) {
      // Ensure relative positioning for absolute button
      if (getComputedStyle(els.resultCard).position === 'static') {
          els.resultCard.style.position = 'relative';
      }
      addShareButton();
  }

})();
