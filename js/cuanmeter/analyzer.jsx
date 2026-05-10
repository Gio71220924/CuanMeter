/* ============================================================
   analyzer.jsx — Stock Analyzer (Bandarmology + AI demo).
   Generates deterministic mock data per ticker so re-search
   yields the same result. NOT real market data.
   Exposes globals: Analyzer.
   ============================================================ */

const { useState: useStateZ, useMemo: useMemoZ } = React;

const POPULAR_TICKERS = ['BBRI', 'BBCA', 'TLKM', 'ASII', 'ANTM', 'BUMI', 'BMRI', 'GOTO', 'ADRO'];
const BROKER_CODES = ['MG', 'CC', 'YP', 'RG', 'BR', 'AT', 'GR', 'CS', 'KZ', 'NI', 'DH', 'YU'];

/* deterministic pseudo-random per ticker (LCG seeded by string hash) */
function seededRand(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function tickSizeFor(price) {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

function generateAnalysis(ticker) {
  const rand = seededRand(ticker.toUpperCase());
  const basePrice = 500 + Math.floor(rand() * 11000);
  const tickSize = tickSizeFor(basePrice);

  // 40-period candle history
  const candles = [];
  let v = basePrice;
  for (let i = 0; i < 40; i++) {
    const open = v;
    const change = (rand() - 0.45) * basePrice * 0.04;
    v = Math.max(50, v + change);
    const high = Math.max(open, v) + rand() * basePrice * 0.015;
    const low = Math.min(open, v) - rand() * basePrice * 0.015;
    candles.push({ open, close: v, high, low });
  }
  const lastPrice = Math.round(v / tickSize) * tickSize;
  const prevPrice = Math.round(candles[candles.length - 2].close / tickSize) * tickSize;
  const chgPct = ((lastPrice - prevPrice) / prevPrice) * 100;

  // money flows
  const totalVolValue = (rand() * 800 + 200) * 1e9;
  const foreignBias = (rand() - 0.5) * 2;
  const localBias = (rand() - 0.5) * 1.5;
  const retailBias = -(foreignBias * 0.6 + localBias * 0.4); // retail balances institutions
  const netForeign = foreignBias * totalVolValue * 0.3;
  const netLocal = localBias * totalVolValue * 0.25;
  const netRetail = retailBias * totalVolValue * 0.4;

  // top buyers & sellers
  const buyers = BROKER_CODES.slice(0, 8)
    .map((c) => ({
      code: c,
      netVal: (rand() * 60 + 10) * 1e9,
      avgPrice: lastPrice + (rand() - 0.6) * basePrice * 0.02,
    }))
    .sort((a, b) => b.netVal - a.netVal)
    .slice(0, 5);

  const sellers = BROKER_CODES.slice(4, 12)
    .map((c) => ({
      code: c,
      netVal: (rand() * 60 + 10) * 1e9,
      avgPrice: lastPrice + (rand() - 0.4) * basePrice * 0.02,
    }))
    .sort((a, b) => b.netVal - a.netVal)
    .slice(0, 5);

  // AI plan
  const isBullish = foreignBias + localBias > -retailBias * 0.5;
  const entry = lastPrice;
  const tp = Math.round((entry * (1 + (isBullish ? 0.06 : 0.04))) / tickSize) * tickSize;
  const sl = Math.round((entry * (1 - (isBullish ? 0.025 : 0.04))) / tickSize) * tickSize;
  const winRate = Math.round(48 + rand() * 22);
  const signal = isBullish
    ? rand() > 0.4
      ? 'BUY'
      : 'STRONG BUY'
    : rand() > 0.6
      ? 'HOLD'
      : 'SELL';
  const strength = Math.round(55 + rand() * 35);

  return {
    ticker,
    lastPrice,
    chgPct,
    candles,
    netForeign,
    netLocal,
    netRetail,
    buyers,
    sellers,
    plan: { entry, tp, sl, signal, winRate, strength, isBullish },
  };
}

/* ---------- Candlestick chart ---------- */
function CandleChart({ data, height = 360 }) {
  const w = 1200;
  const pad = 40;
  const min = Math.min(...data.map((c) => c.low)) * 0.998;
  const max = Math.max(...data.map((c) => c.high)) * 1.002;
  const range = max - min || 1;
  const cw = (w - pad * 2) / data.length;
  const y = (v) => pad + (1 - (v - min) / range) * (height - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1={pad}
          y1={pad + p * (height - pad * 2)}
          x2={w - pad}
          y2={pad + p * (height - pad * 2)}
          stroke="var(--border)"
          strokeDasharray="2 4"
          opacity="0.6"
        />
      ))}
      {data.map((c, i) => {
        const cx = pad + i * cw + cw / 2;
        const up = c.close >= c.open;
        const color = up ? 'var(--success)' : 'var(--danger)';
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBot = y(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.high)} x2={cx} y2={y(c.low)} stroke={color} strokeWidth="1.2" />
            <rect
              x={cx - cw * 0.32}
              y={bodyTop}
              width={cw * 0.64}
              height={Math.max(1, bodyBot - bodyTop)}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Net flow card ---------- */
function FlowCard({ icon, label, value, color }) {
  const positive = value >= 0;
  return (
    <div className="card" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: color,
          opacity: 0.08,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color }}>
          <Icon name={icon} size={18} />
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--fg-muted)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="mono tnum"
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: positive ? 'var(--success)' : 'var(--danger)',
        }}
      >
        {positive ? '+' : '−'}Rp {fmt.compact(Math.abs(value))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 700, marginTop: 4 }}>
        {positive ? 'Akumulasi' : 'Distribusi'}
      </div>
    </div>
  );
}

/* ---------- Broker table ---------- */
function BrokerTable({ title, subtitle, list, color, icon }) {
  const cellTh = {
    padding: '10px 20px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--fg-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ color }}>
          <Icon name={icon} size={18} />
        </span>
        <div>
          <div style={{ fontWeight: 800, color }}>{title}</div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--fg-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{ ...cellTh, textAlign: 'left' }}>Broker</th>
            <th style={{ ...cellTh, textAlign: 'right' }}>Net Value</th>
            <th style={{ ...cellTh, textAlign: 'right' }}>Avg Price</th>
          </tr>
        </thead>
        <tbody>
          {list.map((b, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 20px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 28,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {b.code}
                </span>
              </td>
              <td
                className="mono tnum"
                style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color }}
              >
                Rp {fmt.compact(b.netVal)}
              </td>
              <td
                className="mono tnum"
                style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  color: 'var(--fg-muted)',
                  fontWeight: 600,
                }}
              >
                Rp {Math.round(b.avgPrice).toLocaleString('id-ID')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Analyzer screen ---------- */
function Analyzer() {
  const [ticker, setTicker] = useStateZ('BBRI');
  const [active, setActive] = useStateZ('BBRI');
  const [loading, setLoading] = useStateZ(false);

  const data = useMemoZ(() => generateAnalysis(active), [active]);

  const run = (t) => {
    const code = (t || ticker).toUpperCase().trim();
    if (!code) return;
    setLoading(true);
    setTicker(code);
    setTimeout(() => {
      setActive(code);
      setLoading(false);
    }, 500);
  };

  return (
    <CalcScreen
      icon="chart"
      tag="ANALYZER · BANDARMOLOGY + AI"
      title={
        <>
          Lacak <span style={{ color: 'var(--primary)' }}>smart money</span>
          <br />
          per saham IDX.
        </>
      }
      subtitle="Net flow asing/lokal/retail, top broker buyer/seller, plus AI trading plan (entry/TP/SL). Cek siapa yang akumulasi sebelum lo masuk."
    >
      {/* search bar */}
      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flex: 1,
            minWidth: 240,
            gap: 10,
            alignItems: 'center',
            padding: '8px 16px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <Icon name="target" size={20} />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Masukkan kode saham..."
            maxLength={6}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--fg)',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>
        <button onClick={() => run()} className="btn btn-primary" disabled={loading}>
          {loading ? 'Loading...' : <>Analisa <Icon name="arrow_right" size={14} /></>}
        </button>
      </div>

      {/* quick tickers */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--fg-muted)',
            textTransform: 'uppercase',
            alignSelf: 'center',
          }}
        >
          POPULER:
        </span>
        {POPULAR_TICKERS.map((t) => (
          <button
            key={t}
            onClick={() => run(t)}
            style={{
              padding: '6px 12px',
              background: active === t ? 'var(--primary)' : 'var(--surface)',
              color: active === t ? 'var(--primary-fg)' : 'var(--fg)',
              border: '1px solid ' + (active === t ? 'var(--primary)' : 'var(--border)'),
              borderRadius: 'var(--radius)',
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* price header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em' }}>
            {data.ticker}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              className="mono tnum"
              style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)' }}
            >
              Rp {data.lastPrice.toLocaleString('id-ID')}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: data.chgPct >= 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {fmt.pct(data.chgPct, 2)}
            </span>
          </div>
        </div>
        <div className="badge">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--success)',
            }}
          />{' '}
          EOD · 7 hari terakhir
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <CandleChart data={data.candles} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <FlowCard icon="rocket"  label="Net Foreign" value={data.netForeign} color="#4d8fff" />
        <FlowCard icon="diamond" label="Net Local"   value={data.netLocal}   color="#a855f7" />
        <FlowCard icon="star"    label="Net Retail"  value={data.netRetail}  color="#f59e0b" />
      </div>

      {/* AI plan + win rate */}
      <div
        className="calc-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
      >
        <div className="card" style={{ padding: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="rocket" size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)' }}>
                  AI Trading Plan
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                  }}
                >
                  Setup buat 3–7 hari ke depan
                </div>
              </div>
            </div>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: data.plan.isBullish
                  ? 'var(--primary-soft)'
                  : 'color-mix(in oklab, var(--danger) 14%, transparent)',
                color: data.plan.isBullish ? 'var(--primary)' : 'var(--danger)',
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.06em',
              }}
            >
              {data.plan.signal}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--fg-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Entry
            </span>
            <span
              className="mono tnum"
              style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}
            >
              Rp {data.plan.entry.toLocaleString('id-ID')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div
              style={{
                padding: 14,
                background: 'var(--primary-soft)',
                borderRadius: 12,
                border: '1px solid color-mix(in oklab, var(--primary) 25%, transparent)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  color: 'var(--primary)',
                  marginBottom: 4,
                }}
              >
                TARGET PROFIT
              </div>
              <div
                className="mono tnum"
                style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}
              >
                Rp {data.plan.tp.toLocaleString('id-ID')}
              </div>
              <div
                style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: 'var(--primary)' }}
              >
                +{(((data.plan.tp - data.plan.entry) / data.plan.entry) * 100).toFixed(2)}%
              </div>
            </div>
            <div
              style={{
                padding: 14,
                background: 'color-mix(in oklab, var(--danger) 10%, transparent)',
                borderRadius: 12,
                border: '1px solid color-mix(in oklab, var(--danger) 25%, transparent)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  color: 'var(--danger)',
                  marginBottom: 4,
                }}
              >
                STOP LOSS
              </div>
              <div
                className="mono tnum"
                style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}
              >
                Rp {data.plan.sl.toLocaleString('id-ID')}
              </div>
              <div
                style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: 'var(--danger)' }}
              >
                −{(((data.plan.entry - data.plan.sl) / data.plan.entry) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Model Performance</div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                }}
              >
                Akurasi 60 hari terakhir
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <span
              className="mono tnum"
              style={{
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: 'var(--fg)',
              }}
            >
              <AnimatedNumber value={data.plan.winRate} format={(n) => Math.round(n) + '%'} />
            </span>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 700 }}>
              Win Rate
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Stoch %K',   value: (40 + (data.plan.strength % 50)).toFixed(1) },
              { label: 'BB Position', value: data.plan.isBullish ? 'Upper' : 'Mid' },
              { label: 'ADX',         value: (20 + (data.plan.strength % 30)).toFixed(1) },
              { label: 'OBV Trend',   value: data.netForeign >= 0 ? 'Rising' : 'Falling' },
            ].map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 700 }}>
                  {m.label}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* broker tables */}
      <div className="calc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BrokerTable
          title="Top Buyer"
          subtitle="Akumulasi terbesar"
          list={data.buyers}
          color="var(--success)"
          icon="rocket"
        />
        <BrokerTable
          title="Top Seller"
          subtitle="Distribusi terbesar"
          list={data.sellers}
          color="var(--danger)"
          icon="arrow_left"
        />
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 18,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }}>
          <Icon name="info" size={18} />
        </span>
        <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--fg)' }}>Disclaimer:</strong> Data simulasi untuk demo.
          Bandarmology bersifat historis dan <strong>bukan</strong> rekomendasi beli/jual. DYOR
          — Do Your Own Research.
        </div>
      </div>
    </CalcScreen>
  );
}

Object.assign(window, { Analyzer });
