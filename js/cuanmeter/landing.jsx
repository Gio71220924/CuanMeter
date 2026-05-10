/* ============================================================
   landing.jsx — CuanMeter landing page.
   Sections: Hero · StockMarquee · IHSGChart · ToolsGrid ·
             GuidesSection · FinalCTA.
   StockMarquee, IHSGChart, and HeroMockup use TradingView
   widgets for live data — see tradingview.jsx for the wrapper.
   Exposes globals: LandingPage.
   ============================================================ */

const { useState: useStateL, useEffect: useEffectL } = React;

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

/* ---------- HeroMockup — live BBCA chart from TradingView ---------- */
function HeroMockup() {
  const tvTheme = useTVTheme();

  return (
    <div className="fade-up fade-up-2" style={{ position: 'relative', height: 540 }}>
      <div
        className="card"
        style={{
          position: 'absolute',
          top: 30,
          left: 0,
          right: 0,
          padding: 0,
          zIndex: 2,
          height: 380,
          overflow: 'hidden',
        }}
      >
        <TVWidget
          widget="mini-symbol-overview"
          height="100%"
          config={{
            symbol: 'IDX:BBCA',
            width: '100%',
            height: '100%',
            locale: 'id',
            dateRange: '12M',
            colorTheme: tvTheme,
            isTransparent: true,
            autosize: true,
            chartOnly: false,
            noTimeScale: false,
          }}
        />
      </div>

    </div>
  );
}

/* ---------- Stock ticker — TradingView Ticker Tape widget ---------- */
const TICKER_SYMBOLS = [
  { description: 'IHSG', proName: 'IDX:COMPOSITE' },
  { description: 'BBCA', proName: 'IDX:BBCA' },
  { description: 'BBRI', proName: 'IDX:BBRI' },
  { description: 'BMRI', proName: 'IDX:BMRI' },
  { description: 'BBNI', proName: 'IDX:BBNI' },
  { description: 'TLKM', proName: 'IDX:TLKM' },
  { description: 'ASII', proName: 'IDX:ASII' },
  { description: 'GOTO', proName: 'IDX:GOTO' },
  { description: 'ANTM', proName: 'IDX:ANTM' },
  { description: 'ADRO', proName: 'IDX:ADRO' },
  { description: 'KLBF', proName: 'IDX:KLBF' },
  { description: 'PGAS', proName: 'IDX:PGAS' },
  { description: 'BTC',  proName: 'BINANCE:BTCUSDT' },
  { description: 'GOLD', proName: 'OANDA:XAUUSD' },
];

function StockMarquee() {
  const tvTheme = useTVTheme();

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        overflow: 'hidden',
      }}
    >
      <TVWidget
        widget="ticker-tape"
        height={50}
        config={{
          symbols: TICKER_SYMBOLS,
          showSymbolLogo: true,
          isTransparent: true,
          displayMode: 'regular',
          colorTheme: tvTheme,
          locale: 'id',
        }}
      />
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

Object.assign(window, { LandingPage });
