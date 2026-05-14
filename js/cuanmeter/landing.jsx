/* ============================================================
   landing.jsx — CuanMeter landing page.
   Sections: Hero · StockMarquee · IHSGChart · ToolsGrid ·
             GuidesSection · FinalCTA.
   StockMarquee, IHSGChart, and HeroMockup use TradingView
   widgets for live data — see tradingview.jsx for the wrapper.
   Exposes globals: LandingPage.
   ============================================================ */

const { useState: useStateL, useEffect: useEffectL, useMemo: useMemoL } = React;

/* ---------- Hero ---------- */
function Hero({ onNavigate }) {
  return (
    <section style={{ padding: '64px 0 88px', position: 'relative', overflow: 'visible' }}>
      <div
        id="hero-grid"
        className="container"
        style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 60, alignItems: 'center' }}
      >
        <div className="fade-up">
          <div className="badge" style={{ marginBottom: 24 }}>
            <Icon name="flash" size={12} />
            <span>BUAT TRADER GEN-Z</span>
          </div>
          <h1
            style={{
              fontSize: 'clamp(40px, 6vw, 76px)',
              lineHeight: 0.98,
              marginBottom: 20,
              letterSpacing: '-0.04em',
            }}
          >
            Cuan-mu,<br />
            <span style={{ color: 'var(--primary)' }}>terukur.</span><br />
            <span style={{ color: 'var(--fg-muted)' }}>Tanpa drama.</span>
          </h1>
          <p
            style={{
              fontSize: 19,
              color: 'var(--fg-muted)',
              lineHeight: 1.55,
              marginBottom: 36,
              maxWidth: 520,
              fontWeight: 500,
            }}
          >
            Kalkulator saham IDX yang gercep buat hitung{' '}
            <strong style={{ color: 'var(--fg)' }}>average</strong>, batas{' '}
            <strong style={{ color: 'var(--fg)' }}>ARA/ARB</strong>, dan{' '}
            <strong style={{ color: 'var(--fg)' }}>profit bersih</strong>. Free forever, no
            iklan, no NPS prompt menyebalkan.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
            <button className="btn btn-primary" onClick={() => onNavigate('average')}>
              Hitung Cuan-mu <Icon name="arrow_right" size={16} />
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate('araarb')}>
              Cek ARA/ARB
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              paddingTop: 24,
              borderTop: '1px solid var(--border)',
            }}
          >
            {[
              { v: '6',    l: 'Tools' },
              { v: '100%', l: 'Gratis' },
              { v: '0',    l: 'Iklan' },
              { v: '< 1s', l: 'Hitung' },
            ].map((s, i) => (
              <div key={i}>
                <div
                  className="mono tnum"
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: 'var(--fg)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.v}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--fg-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <HeroMockup />
      </div>

      <style>{`
        @media (max-width: 900px) {
          #hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </section>
  );
}

/* ---------- HeroMockup — 3D isometric finance illustration ---------- */
function HeroMockup() {
  const [tick, setTick] = useStateL(0);

  useEffectL(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1600);
    return () => clearInterval(id);
  }, []);

  const bars = useMemoL(() =>
    [0.55, 0.42, 0.78, 0.62, 0.95, 0.85].map((b, i) =>
      Math.min(1, b + Math.sin((tick + i) * 0.8) * 0.06)
    ), [tick]);

  return (
    <div className="fade-up fade-up-2 hero-3d" style={{
      position: 'relative', height: 560,
      marginTop: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      perspective: 1400,
    }}>
      {/* glow backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 55%, var(--primary-soft) 0%, transparent 65%)',
        filter: 'blur(20px)',
        opacity: 0.9,
      }} />

      {/* main isometric scene */}
      <div style={{
        position: 'relative', width: 480, height: 480,
        transformStyle: 'preserve-3d',
        transform: 'rotateX(55deg) rotateZ(-35deg)',
        animation: 'hero3dFloat 6s ease-in-out infinite',
      }}>

        {/* base platform — shadow layer */}
        <div style={{
          position: 'absolute', left: 70, top: 70, width: 340, height: 340,
          borderRadius: 28,
          background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, var(--bg)) 0%, var(--bg-soft) 100%)',
          border: '1px solid var(--border)',
          boxShadow: '0 30px 60px -20px color-mix(in oklab, var(--primary) 35%, transparent)',
          transform: 'translateZ(-30px)',
        }} />

        {/* base platform — surface */}
        <div style={{
          position: 'absolute', left: 70, top: 70, width: 340, height: 340,
          borderRadius: 28,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          transform: 'translateZ(0px)',
          boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--primary) 12%, transparent)',
        }} />

        {/* grid lines */}
        <svg viewBox="0 0 340 340" style={{
          position: 'absolute', left: 70, top: 70, width: 340, height: 340,
          transform: 'translateZ(1px)',
        }}>
          {[60, 120, 180, 240, 280].map((y, i) => (
            <line key={i} x1="30" y1={y} x2="310" y2={y}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3 6" opacity="0.7" />
          ))}
        </svg>

        {/* rising bar chart */}
        {bars.map((h, i) => {
          const barH = 30 + h * 170;
          return (
            <div key={i} style={{
              position: 'absolute',
              left: 110 + i * 36, top: 220,
              width: 28, height: 28,
              transformStyle: 'preserve-3d',
              transform: `translateZ(${barH}px)`,
              transition: 'transform 0.8s ease-out',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(135deg, color-mix(in oklab, var(--primary) ${50 + i * 8}%, white) 0%, var(--primary) 100%)`,
                borderRadius: 4,
                boxShadow: '0 0 0 1px color-mix(in oklab, var(--primary) 60%, black)',
              }} />
              <div style={{
                position: 'absolute', left: 0, top: 28,
                width: 28, height: barH,
                background: 'linear-gradient(to bottom, color-mix(in oklab, var(--primary) 80%, black), color-mix(in oklab, var(--primary) 50%, black))',
                transform: 'rotateX(-90deg)', transformOrigin: 'top',
              }} />
            </div>
          );
        })}

        {/* rupiah coin stack */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            position: 'absolute', left: 110, top: 290,
            width: 84, height: 84, borderRadius: '50%',
            background: i === 4
              ? 'radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 60%, #b45309 100%)'
              : 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 60%, #b45309 100%)',
            border: '2px solid #92400e',
            transform: `translateZ(${20 + i * 18}px)`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Satoshi, sans-serif', fontWeight: 900,
            fontSize: i === 4 ? 30 : 0, color: '#92400e', letterSpacing: '-0.04em',
          }}>{i === 4 && 'Rp'}</div>
        ))}

        {/* green upward arrow */}
        <svg viewBox="0 0 120 200" style={{
          position: 'absolute', left: 290, top: 110,
          width: 120, height: 200,
          transform: 'translateZ(180px) rotateZ(35deg) rotateX(-55deg)',
        }}>
          <defs>
            <linearGradient id="arrowGrad" x1="0" y1="100%" x2="0" y2="0%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
          <path d="M 50 190 Q 50 100, 90 60 L 60 60 L 95 25 L 115 60 L 90 60"
            fill="none" stroke="url(#arrowGrad)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 90 60 L 60 60 L 95 25 L 115 60 Z" fill="var(--primary)" />
        </svg>

        {/* floating coin — right back */}
        <div style={{
          position: 'absolute', left: 340, top: 110,
          width: 56, height: 56, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 60%, #b45309 100%)',
          border: '2px solid #92400e',
          transform: 'translateZ(160px) rotateX(-55deg) rotateZ(35deg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Satoshi, sans-serif', fontWeight: 900, fontSize: 22, color: '#92400e',
          animation: 'coinFloat 4s ease-in-out infinite',
        }}>Rp</div>

        {/* P/L floating card */}
        <div style={{
          position: 'absolute', left: 200, top: 90,
          width: 180, height: 110,
          transform: 'translateZ(260px) rotateX(-55deg) rotateZ(35deg)',
          background: 'var(--surface)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.18)',
          padding: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--fg-muted)' }}>P/L HARI INI</span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }} />
          </div>
          <div className="mono tnum" style={{ fontSize: 22, fontWeight: 900, color: 'var(--success)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            +Rp 2.4 jt
          </div>
          <svg viewBox="0 0 160 30" style={{ width: '100%', height: 30 }} preserveAspectRatio="none">
            <path d="M 0 22 L 20 18 L 40 20 L 60 14 L 80 16 L 100 10 L 120 12 L 140 6 L 160 4"
              fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes hero3dFloat {
          0%, 100% { transform: rotateX(55deg) rotateZ(-35deg) translateY(0px); }
          50%       { transform: rotateX(55deg) rotateZ(-35deg) translateY(-12px); }
        }
        @keyframes coinFloat {
          0%, 100% { transform: translateZ(160px) rotateX(-55deg) rotateZ(35deg) translateY(0px); }
          50%       { transform: translateZ(160px) rotateX(-55deg) rotateZ(35deg) translateY(-14px); }
        }
        .hero-3d::before {
          content: '';
          position: absolute;
          left: 50%; top: 55%;
          width: 360px; height: 60px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, transparent 70%);
          transform: translate(-50%, 50%);
          filter: blur(8px);
          z-index: 0;
        }
      `}</style>
    </div>
  );
}

/* ---------- Stock ticker — custom real-time marquee via SSE ---------- */
const MARQUEE_SYMBOLS = [
  { key: 'IDX:COMPOSITE',   label: 'IHSG',    logo: null                            },
  { key: 'IDX:LQ45',        label: 'LQ45',    logo: null                            },
  { key: 'IDX:BBCA',        label: 'BBCA',    logo: 'bank-central-asia'           },
  { key: 'IDX:BBRI',        label: 'BBRI',    logo: 'bank-rakyat-indonesia'       },
  { key: 'IDX:BBNI',        label: 'BBNI',    logo: 'bank-negara-indonesia-persero-tbk' },
  { key: 'IDX:BMRI',        label: 'BMRI',    logo: 'bank-mandiri'                     },
  { key: 'IDX:BUMI',        label: 'BUMI',    logo: 'bumi-resources-minerals'          },
  { key: 'IDX:TLKM',        label: 'TLKM',    logo: 'tlkm-icon'                                  },
  { key: 'IDX:ASII',        label: 'ASII',    logo: 'asii-icon'                                  },
  { key: 'IDX:ANTM',        label: 'ANTM',    logo: 'antam'                                      },
  { key: 'IDX:ADMR',        label: 'ADMR',    logo: 'adaro-minerals-indonesia-tbk'               },
  { key: 'IDX:PTBA',        label: 'PTBA',    logo: 'bukit-asam-tbk'                             },
  { key: 'IDX:GOTO',        label: 'GOTO',    logo: 'goto-icon'                                  },
  { key: 'IDX:AADI',        label: 'AADI',    logo: 'aadi-icon'                                  },
  { key: 'IDX:MBMA',        label: 'MBMA',    logo: 'merdeka-battery-materials-tbk'              },
  { key: 'BINANCE:BTCUSDT', label: 'BTC/USD', logo: 'crypto/XTVCBTC'                             },
  { key: 'OANDA:XAUUSD',    label: 'GOLD',    logo: 'gold-icon'                                  },
];

function makeSvgLogo(text, bg, fg = '#fff') {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="${bg}"/><text x="10" y="14" text-anchor="middle" font-size="8" font-weight="800" font-family="sans-serif" fill="${fg}">${text}</text></svg>`
  )}`;
}

const SVG_LOGOS = {
  'tlkm-icon': makeSvgLogo('TL', '#CC0000'),
  'asii-icon': makeSvgLogo('AS', '#1B4693'),
  'goto-icon': makeSvgLogo('GT', '#00AA13'),
  'aadi-icon': makeSvgLogo('AA', '#003082'),
  'gold-icon': makeSvgLogo('Au', '#F5A623', '#7A4F00'),
};

function MarqueeLogo({ slug, label }) {
  const [err, setErr] = useStateL(false);

  let src = null;
  if (slug && SVG_LOGOS[slug]) {
    src = SVG_LOGOS[slug];
  } else if (slug && slug.startsWith('data:')) {
    src = slug;
  } else if (slug) {
    src = `https://s3-symbol-logo.tradingview.com/${slug}.svg`;
  }

  if (!src || err) {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'var(--primary-soft)', color: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 800, flexShrink: 0,
      }}>
        {label.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      width={20} height={20}
      style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'contain' }}
      onError={() => setErr(true)}
    />
  );
}

function StockMarquee() {
  const [prices, setPrices] = useStateL({});
  const [paused, setPaused] = useStateL(false);

  useEffectL(() => {
    const es = new EventSource('/api/prices/stream');
    es.onmessage = (e) => {
      try { setPrices(JSON.parse(e.data)); } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  const items = MARQUEE_SYMBOLS.map(({ key, label, logo }) => {
    const d = prices[key] || {};
    return { key, label, logo, price: d.price || 0, pct: d.pct || 0 };
  });

  const renderItem = (item, sfx) => {
    const pos = item.pct >= 0;
    return (
      <div
        key={item.key + sfx}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '0 16px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          height: 50,
        }}
      >
        <MarqueeLogo slug={item.logo} label={item.label} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', letterSpacing: '0.02em' }}>
          {item.label}
        </span>
        <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
          {item.price > 0 ? item.price.toLocaleString('id-ID') : '—'}
        </span>
        {item.price > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: pos ? 'var(--success)' : 'var(--danger)',
          }}>
            {pos ? '+' : ''}{item.pct.toFixed(2)}%
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        overflow: 'hidden',
        height: 50,
        display: 'flex',
        alignItems: 'center',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        width: 'max-content',
        animation: 'marqueeScroll 55s linear infinite',
        animationPlayState: paused ? 'paused' : 'running',
      }}>
        {items.map((item) => renderItem(item, '-a'))}
        {items.map((item) => renderItem(item, '-b'))}
      </div>
      <style>{`
        @keyframes marqueeScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* ---------- IHSG live chart — TradingView Advanced Chart widget ---------- */
function IHSGChart() {
  const tvTheme = useTVTheme();

  return (
    <section style={{ padding: '80px 0' }}>
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <div className="badge" style={{ marginBottom: 12 }}>
            <Icon name="chart" size={12} />
            <span>IHSG · INDEKS HARGA SAHAM GABUNGAN</span>
          </div>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              letterSpacing: '-0.025em',
              marginBottom: 8,
            }}
          >
            Pergerakan IHSG <span style={{ color: 'var(--primary)' }}>real-time</span>.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--fg-muted)', margin: 0 }}>
            Data live dari TradingView · interactive — drag, zoom, ganti timeframe.
          </p>
        </div>

        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            height: 520,
          }}
        >
          <TVWidget
            widget="advanced-chart"
            height="100%"
            config={{
              autosize: true,
              symbol: 'IDX:COMPOSITE',
              interval: 'D',
              timezone: 'Asia/Jakarta',
              theme: tvTheme,
              style: '3',
              locale: 'id',
              hide_side_toolbar: true,
              allow_symbol_change: false,
              save_image: false,
              details: false,
              withdateranges: true,
              hide_legend: false,
            }}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- Market calendar widget ---------- */
const MARKET_CALENDAR_FALLBACK = [
  {
    id: 'bi-rdg-2026-05-19',
    date: '2026-05-19',
    endDate: '2026-05-20',
    category: 'macro',
    label: 'BI Rate',
    title: 'RDG Bank Indonesia',
    detail: 'Pantau arah suku bunga, rupiah, dan sentimen sektor bank.',
    impact: 'high',
    source: 'Bank Indonesia',
    url: 'https://www.bi.go.id/en/publikasi/Kalender/',
  },
  {
    id: 'bps-monthly-2026-06-01',
    date: '2026-06-01',
    category: 'macro',
    label: 'BPS',
    title: 'Rilis indikator ekonomi bulanan',
    detail: 'Inflasi, pariwisata, dan indikator bulanan dari BPS.',
    impact: 'medium',
    source: 'BPS',
    url: 'https://www.bps.go.id/assets/arc',
  },
  {
    id: 'ksei-dividend-watch',
    date: null,
    category: 'corporate',
    label: 'Dividen',
    title: 'Pantau cum/ex date dividen',
    detail: 'Cek jadwal dividen KSEI sebelum entry saham yield tinggi.',
    impact: 'medium',
    source: 'KSEI',
    url: 'https://www.ksei.co.id/publications/corporate-action-schedules/cash-dividend?setLocale=id-ID',
  },
];

function formatCalendarDate(event) {
  if (!event.date) return 'Harian';
  const start = new Date(`${event.date}T00:00:00`);
  const startLabel = start.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  if (!event.endDate) return startLabel;
  const end = new Date(`${event.endDate}T00:00:00`);
  const endLabel = end.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  return `${startLabel} - ${endLabel}`;
}

function calendarDateParts(event) {
  if (!event.date) return { day: 'Pantau', month: 'Harian' };
  const start = new Date(`${event.date}T00:00:00`);
  return {
    day: start.toLocaleDateString('id-ID', { day: '2-digit' }),
    month: start.toLocaleDateString('id-ID', { month: 'short' }),
  };
}

function formatCalendarEventTitle(event) {
  if (!event.ticker) return event.title;

  const typeLabel = {
    cum: 'CUM DATE',
    rec: 'RECORD DATE',
    eff: 'EFFECTIVE DATE',
  }[event.eventType] || 'CORP ACT';

  return `${event.ticker} ${typeLabel}`;
}

function getCurrentMonthWeek(date = new Date()) {
  return Math.min(4, Math.max(1, Math.ceil(date.getDate() / 7)));
}

function impactStyle(impact) {
  if (impact === 'high') {
    return { color: '#b91c1c', background: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.22)' };
  }
  return { color: 'var(--primary)', background: 'var(--primary-soft)', border: 'var(--border)' };
}

function MarketCalendarWidget() {
  const [range, setRange] = useStateL('week');
  const [week, setWeek] = useStateL(getCurrentMonthWeek());
  const [events, setEvents] = useStateL([]);
  const [updatedAt, setUpdatedAt] = useStateL(null);
  const [rangeMeta, setRangeMeta] = useStateL(null);
  const [loading, setLoading] = useStateL(true);
  const [loadError, setLoadError] = useStateL(null);
  const [page, setPage] = useStateL(0);
  const PAGE_SIZE = 5;

  useEffectL(() => {
    let alive = true;
    const limit = range === 'week' ? 40 : 80;
    const weekParam = range === 'week' ? `&week=${week}` : '';
    setLoading(true);
    setLoadError(null);
    setPage(0);
    fetch(`/calendar?range=${range}${weekParam}&limit=${limit}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!alive) return;
        if (!Array.isArray(data?.events)) {
          setEvents([]);
          setLoadError('Kalender belum bisa dimuat.');
          return;
        }
        setEvents(data.events);
        setUpdatedAt(data.generated_at);
        setRangeMeta(data.range_start && data.range_end ? `${data.range_start} - ${data.range_end}` : null);
        setLoadError(data.error && !data.cached ? 'Data KSEI belum lengkap, coba refresh lagi nanti.' : null);
      })
      .catch(() => {
        if (!alive) return;
        setEvents([]);
        setLoadError('Kalender belum bisa dimuat.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [range, week]);

  return (
    <section
      style={{
        padding: '56px 0',
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container">
        <div
          className="market-calendar-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 0.85fr) minmax(0, 1.6fr)',
            gap: 24,
            alignItems: 'stretch',
          }}
        >
          <div style={{ alignSelf: 'center' }}>
            <div className="badge" style={{ marginBottom: 14 }}>
              <Icon name="bookmark" size={12} />
              <span>MARKET CALENDAR</span>
            </div>
            <h2
              style={{
                fontSize: 'clamp(26px, 4vw, 38px)',
                lineHeight: 1.04,
                letterSpacing: '-0.03em',
                marginBottom: 12,
              }}
            >
              Event penting<br />
              <span style={{ color: 'var(--primary)' }}>{range === 'week' ? `minggu ${week}.` : 'bulan ini.'}</span>
            </h2>
            <p style={{ color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0, fontSize: 14 }}>
              Corporate action dan data makro yang perlu dicek sebelum masuk posisi.
            </p>
            {updatedAt && (
              <div className="mono" style={{ marginTop: 14, fontSize: 11, color: 'var(--fg-muted)' }}>
                Sync {new Date(updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {rangeMeta && (
              <div className="mono" style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-muted)' }}>
                {rangeMeta}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              padding: 12,
            }}
          >
            <div style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: '0 2px 2px',
            }}>
              {[
                { id: 'month', label: 'Bulan ini' },
              ].map((option) => {
                const active = range === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRange(option.id)}
                    style={{
                      border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      background: active ? 'var(--primary-soft)' : 'var(--bg)',
                      color: active ? 'var(--primary)' : 'var(--fg-muted)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
              {[1, 2, 3, 4].map((weekNo) => {
                const active = range === 'week' && week === weekNo;
                return (
                  <button
                    key={weekNo}
                    type="button"
                    onClick={() => {
                      setRange('week');
                      setWeek(weekNo);
                    }}
                    style={{
                      border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      background: active ? 'var(--primary-soft)' : 'var(--bg)',
                      color: active ? 'var(--primary)' : 'var(--fg-muted)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    M{weekNo}
                  </button>
                );
              })}
            </div>

            {(loading || loadError || events.length === 0) && (
              <div style={{
                padding: 18,
                borderRadius: 'calc(var(--radius) - 4px)',
                border: '1px dashed var(--border)',
                background: 'var(--bg)',
                color: 'var(--fg-muted)',
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {loading ? 'Memuat kalender...' : loadError || 'Belum ada event terjadwal di range ini.'}
              </div>
            )}

            {events.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map((event) => {
              const impact = impactStyle(event.impact);
              const dateParts = calendarDateParts(event);
              return (
                <div
                  key={event.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '76px minmax(0, 1fr) auto',
                    gap: 14,
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 'calc(var(--radius) - 4px)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                  }}
                >
                  <div
                    style={{
                      minHeight: 64,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-soft)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: event.date ? 24 : 12,
                        fontWeight: 800,
                        color: 'var(--fg)',
                        lineHeight: 1,
                      }}
                    >
                      {dateParts.day}
                    </span>
                    <span
                      className="mono"
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        fontWeight: 800,
                        color: 'var(--fg-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {dateParts.month}
                    </span>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: 16,
                        letterSpacing: '-0.02em',
                        marginBottom: 5,
                        textTransform: event.ticker ? 'uppercase' : 'none',
                      }}
                    >
                      {formatCalendarEventTitle(event)}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13, lineHeight: 1.45 }}>
                      {event.summary || event.detail}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: '0.06em',
                        padding: '5px 7px',
                        borderRadius: 6,
                        color: impact.color,
                        background: impact.background,
                        border: `1px solid ${impact.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {event.label}
                    </span>
                  </div>
                </div>
              );
            })}

            {events.length > PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, events.length)} dari {events.length} event
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    style={{
                      padding: '5px 12px', fontSize: 13, fontWeight: 700,
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      background: 'var(--bg)', color: page === 0 ? 'var(--fg-faint)' : 'var(--fg)',
                      cursor: page === 0 ? 'default' : 'pointer',
                    }}
                  >‹ Prev</button>
                  <button
                    type="button"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * PAGE_SIZE >= events.length}
                    style={{
                      padding: '5px 12px', fontSize: 13, fontWeight: 700,
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      background: 'var(--bg)', color: (page + 1) * PAGE_SIZE >= events.length ? 'var(--fg-faint)' : 'var(--fg)',
                      cursor: (page + 1) * PAGE_SIZE >= events.length ? 'default' : 'pointer',
                    }}
                  >Next ›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .market-calendar-grid {
            grid-template-columns: 1fr !important;
          }
          .market-calendar-grid [style*="76px"] {
            grid-template-columns: 64px minmax(0, 1fr) !important;
          }
          .market-calendar-grid [style*="justify-content: flex-end"] {
            justify-content: flex-start !important;
            grid-column: 2;
          }
        }
      `}</style>
    </section>
  );
}

/* ---------- Tools grid (6 calculators) ---------- */
const TOOLS = [
  { id: 'analyzer', icon: 'chart',  title: 'Stock Analyzer',         tag: 'BANDARMOLOGY + AI', desc: 'Lacak smart money: net flow asing/lokal/retail, top broker buyer/seller, plus AI trading plan.' },
  { id: 'average',  icon: 'calc',   title: 'Average Price',          tag: 'PALING DIPAKAI',    desc: 'Hitung harga rata-rata setelah average down. Tau harga break-even-mu dalam sekejap.' },
  { id: 'araarb',   icon: 'arrows', title: 'ARA & ARB',              tag: 'AUTO-REJECT',       desc: 'Cek batas atas & bawah harga harian sesuai aturan IDX terbaru. Tier-1, Tier-2, Tier-3 auto.' },
  { id: 'profit',   icon: 'wallet', title: 'Profit Calc',            tag: 'NET P/L',           desc: 'Estimasi profit bersih setelah fee broker, levy, dan PPh. Plus breakeven price.' },
  { id: 'amunisi',  icon: 'shield', title: 'Amunisi (Position Size)', tag: 'RISK MGMT',         desc: 'Tentuin lot maksimal yang aman buat di-snipe, biar gak overbet & rekening selamat.' },
  { id: 'dividen',  icon: 'coin',   title: 'Dividen Yield',          tag: 'PASSIVE',           desc: 'Hitung yield bersih setelah PPh 10%. Buat pemburu cuan tahunan tanpa pegang ribet.' },
];

function ToolsGrid({ onNavigate }) {
  return (
    <section style={{ padding: '80px 0' }}>
      <div className="container">
        <div style={{ marginBottom: 48, maxWidth: 720 }}>
          <div className="badge" style={{ marginBottom: 16 }}>
            <Icon name="zap" size={12} />
            <span>6 TOOLS</span>
          </div>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              marginBottom: 12,
              letterSpacing: '-0.03em',
            }}
          >
            Semua tools yang lo butuhin,<br />
            <span style={{ color: 'var(--primary)' }}>di satu tempat.</span>
          </h2>
          <p style={{ fontSize: 17, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
            Tinggal klik, isi, dapet jawaban. Gak perlu Excel ribet, gak perlu install apa-apa.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {TOOLS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id)}
              className={`card interactive fade-up fade-up-${(i % 4) + 1}`}
              style={{
                padding: 24,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                cursor: 'pointer',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--radius)',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={t.icon} size={24} />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: 'var(--primary)',
                    letterSpacing: '0.08em',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'var(--primary-soft)',
                  }}
                >
                  {t.tag}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: 22, marginBottom: 6, letterSpacing: '-0.025em' }}>
                  {t.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: 'var(--fg-muted)',
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {t.desc}
                </p>
              </div>
              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--primary)',
                }}
              >
                Buka kalkulator <Icon name="arrow_right" size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Guides preview section ---------- */
const PREVIEW_GUIDES = [
  { icon: 'book',   tag: 'BASIC',    title: 'Apa itu ARA & ARB?',                 desc: 'Aturan auto-rejection di IDX yang wajib lo ngerti sebelum nge-haka saham gocap.', read: '5 min' },
  { icon: 'target', tag: 'STRATEGY', title: 'Average Down: Pahlawan atau Jebakan?', desc: 'Kapan boleh average down dan kapan harusnya cut-loss. Spoiler: gak semua bottom itu real bottom.', read: '7 min' },
  { icon: 'shield', tag: 'RISK',     title: 'Position Sizing 101',                desc: 'Kenapa "all-in" itu cara tercepat buat porto sultan jadi porto receh. Pakai 2% rule.', read: '6 min' },
  { icon: 'coin',   tag: 'INCOME',   title: 'Bedanya Dividen vs Capital Gain',     desc: 'Dua cara cuan dari saham. Yang satu cair tahunan, yang satu cair pas lo jual.', read: '4 min' },
];

function GuidesSection({ onNavigate }) {
  return (
    <section
      style={{
        padding: '80px 0',
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 40,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ maxWidth: 620 }}>
            <div className="badge" style={{ marginBottom: 16 }}>
              <Icon name="book" size={12} />
              <span>BELAJAR DULU, CUAN KEMUDIAN</span>
            </div>
            <h2
              style={{
                fontSize: 'clamp(32px, 4vw, 44px)',
                marginBottom: 12,
                letterSpacing: '-0.03em',
              }}
            >
              Panduan ringkas buat<br />newbie & sultan-in-the-making.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--fg-muted)' }}>
              Bahasa sehari-hari, 5–7 menit baca, langsung praktek di kalkulator.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate && onNavigate('guides')}>
            Lihat Semua Panduan
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {PREVIEW_GUIDES.map((g, i) => (
            <a
              key={i}
              className="card interactive"
              onClick={() => onNavigate && onNavigate('guides')}
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius)',
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={g.icon} size={20} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: 'var(--fg-muted)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                <span>{g.tag}</span>
                <span>·</span>
                <span>{g.read}</span>
              </div>
              <h3 style={{ fontSize: 18, letterSpacing: '-0.02em' }}>{g.title}</h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--fg-muted)',
                  lineHeight: 1.55,
                  margin: 0,
                  flexGrow: 1,
                }}
              >
                {g.desc}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--primary)',
                }}
              >
                Baca panduan <Icon name="arrow_right" size={12} />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Final CTA — Terminal style ---------- */
const CTA_TICKER = [
  { label: 'IHSG',  val: '+0.32%', up: true  },
  { label: 'BBCA',  val: '+0.26%', up: true  },
  { label: 'BBRI',  val: '-0.40%', up: false },
  { label: 'BMRI',  val: '+1.20%', up: true  },
  { label: 'TLKM',  val: '-0.15%', up: false },
  { label: 'ANTM',  val: '+2.10%', up: true  },
  { label: 'GOTO',  val: '-1.30%', up: false },
  { label: 'BUMI',  val: '+0.85%', up: true  },
  { label: 'PTBA',  val: '+0.60%', up: true  },
  { label: 'ADMR',  val: '-0.55%', up: false },
];

function FinalCTA({ onNavigate }) {
  return (
    <section style={{ padding: '88px 0' }}>
      <div className="container">
        <div className="cta-terminal" style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
          background: 'var(--cta-terminal-bg)',
          position: 'relative',
        }}>

          {/* Status bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace',
            fontSize: 11,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: 'var(--primary)',
              boxShadow: '0 0 8px color-mix(in oklab, var(--primary) 60%, transparent)',
            }} />
            <span style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em' }}>
              CUANMETER_TERMINAL
            </span>
            <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 4px' }}>·</span>
            <span style={{ color: 'var(--primary)', opacity: 0.6, letterSpacing: '0.08em', fontSize: 10 }}>
              IDX LIVE
            </span>
            <span style={{
              marginLeft: 'auto', color: 'rgba(255,255,255,0.12)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em',
            }}>
              v1.0.0
            </span>
          </div>

          {/* Main body */}
          <div style={{
            padding: 'clamp(36px, 5vw, 72px) clamp(24px, 5vw, 64px)',
            textAlign: 'center',
            position: 'relative',
          }}>

            {/* Terminal prompt */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace',
              fontSize: 12, letterSpacing: '0.06em',
              color: 'var(--primary)',
              marginBottom: 20, opacity: 0.85,
            }}>
              <span style={{ opacity: 0.5 }}>{'$'}</span>
              <span>exit nebak_mode</span>
              <span style={{ animation: 'ctaCursorBlink 1.1s step-end infinite' }}>▌</span>
            </div>

            <h2 style={{
              fontSize: 'clamp(34px, 5vw, 62px)',
              color: '#fff',
              marginBottom: 18,
              letterSpacing: '-0.04em',
              lineHeight: 0.97,
            }}>
              Stop nebak-nebak.<br />
              <span style={{ color: 'var(--primary)' }}>Mulai ngitung.</span>
            </h2>

            <p style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.38)',
              maxWidth: 460,
              margin: '0 auto 36px',
              lineHeight: 1.7,
              fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace',
              letterSpacing: '-0.01em',
            }}>
              // 5 kalkulator · 1 web · free forever<br />
              // bookmark sekarang, gas pas market open
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => onNavigate('average')}
                className="btn btn-primary"
                style={{ color: '#02110a', fontWeight: 800 }}
              >
                Mulai Hitung <Icon name="arrow_right" size={16} />
              </button>
              <button
                onClick={() => onNavigate('araarb')}
                className="btn"
                style={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Cek ARA/ARB
              </button>
            </div>
          </div>

          {/* Bottom ticker strip */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '9px 0',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              width: 'max-content',
              fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace',
              fontSize: 11,
              animation: 'ctaTicker 28s linear infinite',
            }}>
              {[...CTA_TICKER, ...CTA_TICKER].map((item, i) => (
                <span key={i} style={{
                  padding: '0 18px',
                  color: item.up
                    ? 'color-mix(in oklab, var(--primary) 85%, white)'
                    : 'rgba(255,84,112,0.85)',
                  borderRight: '1px solid rgba(255,255,255,0.05)',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                }}>
                  {item.label} <span style={{ opacity: 0.6 }}>{item.val}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ctaCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes ctaTicker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function LandingPage({ onNavigate }) {
  return (
    <>
      <Hero onNavigate={onNavigate} />
      <StockMarquee />
      <IHSGChart />
      <MarketCalendarWidget />
      <ToolsGrid onNavigate={onNavigate} />
      <GuidesSection onNavigate={onNavigate} />
      <FinalCTA onNavigate={onNavigate} />
    </>
  );
}

Object.assign(window, { LandingPage });
