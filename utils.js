window.CuanMeterUtils = (function() {
  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const nfPct = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfPct1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

  // --- Formatters ---
  const formatters = {
    nf0,
    nfPct,
    nfPct1,
    
    toNumber: (value) => {
        if (value === null || value === undefined) return 0;
        const raw = String(value).trim();
        if (raw === "") return 0;
        // Robust cleaning: allows digits, minus, dot, comma
        // Assumption: Indonesian locale uses dot for thousands and comma for decimal?
        // Or standard JS? 
        // existing code in `profit.js`: replace(",", ".") -> implies comma is decimal separator in input
        // existing code in `avg.js`: Number(value) -> implies standard JS (dot is decimal)
        
        // Let's support both roughly: 
        // If it contains comma, replace with dot. Remove non-numeric chars except dot/minus.
        // This is a heuristic.
        const clean = raw.replace(/\s/g, '').replace(',', '.');
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

    formatCurrency: (value) => `Rp ${nf0.format(Math.round(value || 0))}`,
    
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
        if (price < 200) return { tier: 1, pct: 0.35 };
        if (price <= 5000) return { tier: 2, pct: 0.25 };
        return { tier: 3, pct: 0.2 };
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
    clear: (key) => {
        localStorage.removeItem(key);
    }
  };

  // --- Theme ---
  const theme = {
    init: () => {
      const themeToggle = document.getElementById('theme-toggle');
      const htmlElement = document.documentElement;

      // Check for saved theme preference or respect OS preference
      const savedTheme = localStorage.getItem('theme');
      const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

      const applyTheme = (isDark) => {
          if (isDark) {
              htmlElement.classList.add('dark');
          } else {
              htmlElement.classList.remove('dark');
          }
      };

      // Set initial theme
      if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
        applyTheme(true);
      } else {
        applyTheme(false);
      }

      // Toggle theme function
      const toggleTheme = () => {
        const isDark = htmlElement.classList.contains('dark');
        if (isDark) {
          applyTheme(false);
          localStorage.setItem('theme', 'light');
        } else {
          applyTheme(true);
          localStorage.setItem('theme', 'dark');
        }
      };

      // Add event listener to theme toggle button
      if (themeToggle) {
          themeToggle.addEventListener('click', toggleTheme);
      }

      // Listen for OS theme changes
      prefersDarkScheme.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          applyTheme(e.matches);
        }
      });
    }
  };

  return { formatters, idx, storage, theme };
})();
