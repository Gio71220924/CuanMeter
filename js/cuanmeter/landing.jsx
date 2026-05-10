/* ============================================================
   landing.jsx — CuanMeter landing page.
   Sections: Hero · StockMarquee · IHSGChart · ToolsGrid ·
             GuidesSection · FinalCTA.
   Exposes globals: LandingPage, IDX_STOCKS.
   ============================================================ */

const { useState: useStateL, useEffect: useEffectL, useMemo: useMemoL } = React;

const IDX_STOCKS = [
  { code: 'BBCA', price: 11525, change:  0.65, name: 'Bank Central Asia' },
  { code: 'BBRI', price:  4280, change: -0.93, name: 'Bank Rakyat Indonesia' },
  { code: 'TLKM', price:  2710, change:  1.50, name: 'Telkom Indonesia' },
  { code: 'BMRI', price:  6325, change:  0.40, name: 'Bank Mandiri' },
  { code: 'ASII', price:  4980, change: -0.30, name: 'Astra Internasional' },
  { code: 'GOTO', price:    88, change:  3.53, name: 'GoTo Gojek Tokopedia' },
  { code: 'UNVR', price:  2240, change: -1.32, name: 'Unilever Indonesia' },
  { code: 'ICBP', price: 11800, change:  0.85, name: 'Indofood CBP' },
  { code: 'INDF', price:  7625, change:  0.66, name: 'Indofood Sukses' },
  { code: 'BBNI', price:  5475, change: -0.45, name: 'Bank Negara Indonesia' },
  { code: 'ADRO', price:  2680, change:  2.29, name: 'Adaro Energy' },
  { code: 'KLBF', price:  1620, change:  0.62, name: 'Kalbe Farma' },
  { code: 'AMRT', price:  3050, change:  1.66, name: 'Sumber Alfaria' },
  { code: 'ANTM', price:  2120, change: -0.94, name: 'Aneka Tambang' },
  { code: 'PGAS', price:  1845, change:  1.10, name: 'Perusahaan Gas Negara' },
];

/* ---------- Hero ---------- */
function Hero({ onNavigate }) {
  return (
    <section style={{ padding: '64px 0 88px', position: 'relative', overflow: 'hidden' }}>
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

/* Live-feel dashboard mockup floating to the right of hero */
function HeroMockup() {
  const [tick, setTick] = useStateL(0);
  useEffectL(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1800);
    return () => clearInterval(id);
  }, []);

  const stock = useMemoL(() => {
    const base = { code: 'BBCA', price: 11525 };
    const w = Math.sin(tick * 0.7) * 25 + Math.random() * 8;
    return { ...base, price: Math.round(base.price + w) };
  }, [tick]);

  const sparkData = useMemoL(
    () =>
      Array.from(
        { length: 30 },
        (_, i) =>
          Math.sin(i * 0.4 + tick * 0.2) * 18 + Math.cos(i * 0.7) * 10 + i * 0.3 + 100,
      ),
    [tick],
  );

  return (
    <div className="fade-up fade-up-2" style={{ position: 'relative', height: 540 }}>
      <div
        className="card"
        style={{ position: 'absolute', top: 30, left: 0, right: 0, padding: 24, zIndex: 2 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              BCA
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>BBCA</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Bank Central Asia</div>
            </div>
          </div>
          <div className="badge" style={{ background: 'var(--success)', color: '#fff' }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#fff',
                display: 'inline-block',
              }}
            />
            LIVE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <span
            className="mono tnum"
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: 'var(--fg)',
              letterSpacing: '-0.03em',
            }}
          >
            <AnimatedNumber value={stock.price} />
          </span>
          <span className="mono" style={{ color: 'var(--success)', fontSize: 15, fontWeight: 700 }}>
            +0.65%
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          Volume: 142.5 jt · Vol Rp 1.65 T
        </div>

        <div style={{ height: 100, marginBottom: 16 }}>
          <Sparkline data={sparkData} height={100} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'ARA', value: '14.075' },
            { label: 'ARB', value: '9.225' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '12px 14px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                }}
              >
                {stat.label}
              </div>
              <div className="mono tnum" style={{ fontWeight: 700, color: 'var(--fg)' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="card fade-up fade-up-3"
        style={{
          position: 'absolute',
          top: 0,
          right: -14,
          padding: '12px 16px',
          zIndex: 3,
          transform: 'rotate(2deg)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Icon name="rocket" size={18} />
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600 }}>P/L kamu</div>
          <div
            className="mono tnum"
            style={{ fontWeight: 800, fontSize: 16, color: 'var(--success)' }}
          >
            + Rp 2.4 jt
          </div>
        </div>
      </div>

      <div
        className="card fade-up fade-up-4"
        style={{
          position: 'absolute',
          bottom: 0,
          left: -10,
          padding: '14px 18px',
          zIndex: 3,
          transform: 'rotate(-2deg)',
          maxWidth: 260,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          AVERAGE DOWN
        </div>
        <div
          className="mono tnum"
          style={{ fontWeight: 800, fontSize: 20, color: 'var(--fg)', marginBottom: 4 }}
        >
          Rp 11.380
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
          dari 3 transaksi · 12 lot
        </div>
      </div>
    </div>
  );
}

/* ---------- Stock ticker marquee ---------- */
function StockMarquee() {
  const items = [...IDX_STOCKS, ...IDX_STOCKS]; // duplicated for seamless loop
  return (
    <div
      className="marquee-pause"
      style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        padding: '14px 0',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div className="marquee-track" style={{ gap: 40 }}>
        {items.map((s, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 32 }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: 'var(--fg)',
                letterSpacing: '-0.01em',
              }}
            >
              {s.code}
            </span>
            <span
              className="mono tnum"
              style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600 }}
            >
              {s.price.toLocaleString('id-ID')}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: s.change >= 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {s.change >= 0 ? '▲' : '▼'} {Math.abs(s.change).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- IHSG mini chart with period selector ---------- */
const IHSG_PERIOD_LENGTHS = { '1D': 24, '1W': 30, '1M': 60, '3M': 80, '1Y': 90 };
const IHSG_PERIODS = Object.keys(IHSG_PERIOD_LENGTHS);

function IHSGChart() {
  const [period, setPeriod] = useStateL('1M');

  const data = useMemoL(() => {
    const len = IHSG_PERIOD_LENGTHS[period];
    const arr = [];
    let v = 7280;
    const vol = period === '1D' ? 0.4 : period === '1W' ? 0.6 : 1.2;
    for (let i = 0; i < len; i++) {
      v +=
        (Math.sin(i * 0.4) * 12 +
          Math.cos(i * 0.7) * 8 +
          (Math.random() - 0.45) * 16) *
        vol;
      arr.push(v);
    }
    return arr;
  }, [period]);

  const last = data[data.length - 1];
  const first = data[0];
  const chg = last - first;
  const chgPct = (chg / first) * 100;
  const isUp = chg >= 0;

  const w = 1200;
  const h = 360;
  const pad = 40;
  const min = Math.min(...data) - 30;
  const max = Math.max(...data) + 30;
  const range = max - min;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const dPath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
  const dFill = `${dPath} L ${pts[pts.length - 1][0]},${h - pad} L ${pts[0][0]},${h - pad} Z`;

  return (
    <section style={{ padding: '80px 0' }}>
      <div className="container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div className="badge" style={{ marginBottom: 12 }}>
              <Icon name="chart" size={12} />
              <span>IHSG · INDEKS HARGA SAHAM GABUNGAN</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span
                className="mono tnum"
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: 'var(--fg)',
                  letterSpacing: '-0.03em',
                }}
              >
                {last.toFixed(2)}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isUp ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {isUp ? '+' : ''}
                {chg.toFixed(2)} ({fmt.pct(chgPct, 2)})
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 6 }}>
              Update terakhir:{' '}
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            {IHSG_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 'calc(var(--radius) - 4px)',
                  background: period === p ? 'var(--primary)' : 'transparent',
                  color: period === p ? 'var(--primary-fg)' : 'var(--fg-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: 360, display: 'block' }}
          >
            <defs>
              <linearGradient id="ihsg-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={isUp ? 'var(--success)' : 'var(--danger)'} stopOpacity="0.25" />
                <stop offset="1" stopColor={isUp ? 'var(--success)' : 'var(--danger)'} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
              <line
                key={i}
                x1={pad}
                y1={pad + p * (h - pad * 2)}
                x2={w - pad}
                y2={pad + p * (h - pad * 2)}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="2 4"
                opacity="0.6"
              />
            ))}
            <path d={dFill} fill="url(#ihsg-fill)" />
            <path
              d={dPath}
              fill="none"
              stroke={isUp ? 'var(--success)' : 'var(--danger)'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={pts[pts.length - 1][0]}
              cy={pts[pts.length - 1][1]}
              r="5"
              fill={isUp ? 'var(--success)' : 'var(--danger)'}
            />
            <circle
              cx={pts[pts.length - 1][0]}
              cy={pts[pts.length - 1][1]}
              r="10"
              fill={isUp ? 'var(--success)' : 'var(--danger)'}
              opacity="0.2"
            />
          </svg>
        </div>
      </div>
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

/* ---------- Final CTA ---------- */
function FinalCTA({ onNavigate }) {
  return (
    <section style={{ padding: '88px 0' }}>
      <div className="container">
        <div
          className="card"
          style={{
            padding: 'clamp(32px, 5vw, 64px)',
            textAlign: 'center',
            background:
              'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklab, var(--primary) 70%, #006040) 100%)',
            color: '#fff',
            border: 'none',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -60,
              left: -30,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
            }}
          />

          <div style={{ position: 'relative' }}>
            <h2
              style={{
                fontSize: 'clamp(32px, 5vw, 56px)',
                color: '#fff',
                marginBottom: 16,
                letterSpacing: '-0.03em',
              }}
            >
              Stop nebak-nebak.<br />Mulai ngitung.
            </h2>
            <p
              style={{
                fontSize: 18,
                color: 'rgba(255,255,255,0.9)',
                maxWidth: 540,
                margin: '0 auto 32px',
                lineHeight: 1.6,
              }}
            >
              5 kalkulator. 1 web. Free forever. Bookmark sekarang biar pas market open lo udah
              siap gas.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => onNavigate('average')}
                className="btn"
                style={{ background: '#fff', color: 'var(--primary)' }}
              >
                Mulai Hitung <Icon name="arrow_right" size={16} />
              </button>
              <button
                onClick={() => onNavigate('araarb')}
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              >
                Cek ARA/ARB
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingPage({ onNavigate }) {
  return (
    <>
      <Hero onNavigate={onNavigate} />
      <StockMarquee />
      <IHSGChart />
      <ToolsGrid onNavigate={onNavigate} />
      <GuidesSection onNavigate={onNavigate} />
      <FinalCTA onNavigate={onNavigate} />
    </>
  );
}

Object.assign(window, { LandingPage, IDX_STOCKS });
