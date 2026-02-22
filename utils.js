window.CuanMeterUtils = (function () {
  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const nfPct = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfPct1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

  // --- Formatters ---
  const formatters = {
    nf0,
    nf2,
    nfPct,
    nfPct1,

    toNumber: (value) => {
      if (value === null || value === undefined) return 0;
      let raw = String(value).trim();
      if (raw === "") return 0;

      // Clean the string for Indonesian format: 
      // 1. Remove all dots (assumed thousands)
      // 2. Replace comma with dot (assumed decimal)
      let clean = raw.replace(/\./g, '').replace(',', '.');
      
      // Remove any other non-numeric characters except minus and decimal dot
      clean = clean.replace(/[^0-9.-]/g, '');
      
      const num = parseFloat(clean);
      return Number.isFinite(num) ? num : 0;
    },

    toNonNegativeNumber: (value) => {
      const num = formatters.toNumber(value);
      return num > 0 ? num : 0;
    },

    toNonNegativeInt: (value) => {
      return Math.floor(formatters.toNonNegativeNumber(value));
    },

    formatCurrency: (value) => {
      const formatted = nf0.format(Math.round(value || 0));
      return `Rp ${formatted},-`;
    },

    formatCurrencyPrecise: (value) => {
      // Show decimals if the value has them, otherwise standard integer format
      if (value % 1 === 0) {
          return `Rp ${nf0.format(value)}`;
      }
      return `Rp ${nf2.format(value)}`;
    },

    formatCurrencyCompact: (value) => {
      const absValue = Math.abs(value);
      const sign = value < 0 ? "-" : "";
      const units = [
        { suffix: "T", value: 1e12 },
        { suffix: "M", value: 1e9 },
        { suffix: "Jt", value: 1e6 },
        { suffix: "Rb", value: 1e3 },
      ];
      for (const unit of units) {
        if (absValue >= unit.value) {
          const scaled = absValue / unit.value;
          let formatted = scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
          return `${sign}Rp ${formatted}${unit.suffix}`;
        }
      }
      return `${sign}Rp ${nf0.format(Math.round(absValue))}`;
    },

    formatPct: (value, decimals = 2) => {
      if (decimals === 1) return nfPct1.format(value);
      return nfPct.format(value);
    },

    formatInput: (inputElement) => {
      if (!inputElement) return;
      
      const selectionStart = inputElement.selectionStart;
      const originalValue = inputElement.value;
      const originalLength = originalValue.length;

      // Allow digits and comma only
      // If user types dot '.', treat it as comma ',' for convenience? 
      // Standard ID format uses comma for decimal. Let's strictly allow comma for decimal input.
      // But we must allow dots if they are already there (thousand separators), 
      // actually we strip non-digits/non-commas first.
      
      let clean = originalValue.replace(/[^0-9,]/g, "");
      
      // Ensure only one comma (the first one)
      const parts = clean.split(',');
      let integerPart = parts[0];
      let decimalPart = parts.length > 1 ? parts.slice(1).join('') : null;
      
      if (integerPart === "" && decimalPart === null) {
        inputElement.value = "";
        return;
      }
      
      // Format integer part with thousand separators
      const formattedInteger = integerPart ? nf0.format(parseInt(integerPart)) : "";
      
      let newValue = formattedInteger;
      if (decimalPart !== null) {
        newValue += "," + decimalPart;
      }
      
      inputElement.value = newValue;

      // Restore cursor position
      const newLength = newValue.length;
      
      if (selectionStart === originalLength) {
          inputElement.setSelectionRange(newLength, newLength);
      } else {
          let newPos = selectionStart + (newLength - originalLength);
          if (newPos < 0) newPos = 0;
          inputElement.setSelectionRange(newPos, newPos);
      }
    },
  };

  // --- IDX Rules (Fraksi Harga & Lot) ---
  const idx = {
    LOT_SIZE: 100,

    getTickSize: (price) => {
      if (price < 200) return 1;
      if (price < 500) return 2;
      if (price < 2000) return 5;
      if (price < 5000) return 10;
      if (price < 10000) return 25;
      if (price < 20000) return 50;
      return 100;
    },

    floorToTick: (value) => {
      const tick = idx.getTickSize(value);
      if (!Number.isFinite(tick) || tick <= 0) return Math.floor(value);
      return Math.floor(value / tick) * tick;
    },

    ceilToTick: (value) => {
      const tick = idx.getTickSize(value);
      if (!Number.isFinite(tick) || tick <= 0) return Math.ceil(value);
      return Math.ceil(value / tick) * tick;
    },

    getAraArbTier: (price) => {
      // ARA (Auto Rejection Atas) is still tiered
      let araPct = 0.2;
      if (price < 200) araPct = 0.35;
      else if (price <= 5000) araPct = 0.25;

      // ARB (Auto Rejection Bawah) is now 15% for all price fractions per 2025/2026 rules
      const arbPct = 0.15;

      return { araPct, arbPct };
    }
  };

  // --- Storage ---
  const storage = {
    load: (key) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
      } catch (e) {
        console.error(`Error loading ${key}`, e);
        return [];
      }
    },
    save: (key, data, limit = 10, type = 'generic') => {
      try {
        const history = storage.load(key);
        const newEntry = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          data: data,
          type: type
        };
        const updated = [newEntry, ...history].slice(0, limit);
        localStorage.setItem(key, JSON.stringify(updated));
        return updated;
      } catch (e) {
        console.error(`Error saving ${key}`, e);
        return [];
      }
    },
    deleteItem: (key, id) => {
      try {
        let history = storage.load(key);
        history = history.filter(item => item.id !== id);
        localStorage.setItem(key, JSON.stringify(history));
        return history;
      } catch (e) {
        console.error(`Error deleting item from ${key}`, e);
        return [];
      }
    },
    clear: (key) => {
      localStorage.removeItem(key);
    }
  };

  // --- Theme ---
  const theme = {
    init: () => {
      try {
        const themeToggle = document.getElementById('theme-toggle');
        const htmlElement = document.documentElement;

        // Check for saved theme preference or respect OS preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = (isDark, withTransition = false) => {
          if (withTransition) {
            // Add transition class for smooth theme change
            htmlElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
            setTimeout(() => {
              htmlElement.style.transition = '';
            }, 300);
          }

          if (isDark) {
            htmlElement.classList.add('dark');
            if (themeToggle) themeToggle.setAttribute('aria-label', 'Ganti ke mode terang');
          } else {
            htmlElement.classList.remove('dark');
            if (themeToggle) themeToggle.setAttribute('aria-label', 'Ganti ke mode gelap');
          }

          // Broadcast theme change event
          window.dispatchEvent(new CustomEvent('themechange', { detail: { isDark } }));
        };

        // Set initial theme (no transition on load)
        if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
          applyTheme(true, false);
        } else {
          applyTheme(false, false);
        }

        // Toggle theme function
        const toggleTheme = () => {
          try {
            const isDark = htmlElement.classList.contains('dark');
            if (isDark) {
              applyTheme(false, true);
              localStorage.setItem('theme', 'light');
            } else {
              applyTheme(true, true);
              localStorage.setItem('theme', 'dark');
            }
          } catch (error) {
            console.error('Error toggling theme:', error);
            if (window.CuanMeterToast) {
              window.CuanMeterToast.error('Gagal mengubah tema');
            }
          }
        };

        // Add event listener to theme toggle button
        if (themeToggle) {
          themeToggle.addEventListener('click', toggleTheme);
        } else {
          console.warn('Theme toggle button not found');
        }

        // Listen for OS theme changes
        prefersDarkScheme.addEventListener('change', (e) => {
          try {
            if (!localStorage.getItem('theme')) {
              applyTheme(e.matches, true);
            }
          } catch (error) {
            console.error('Error handling OS theme change:', error);
          }
        });
      } catch (error) {
        console.error('Error initializing theme:', error);
      }
    }
  };

  return { formatters, idx, storage, theme };
})();
