/* ============================================================
   analyzer.jsx — Stock Analyzer (Bandarmology + AI demo).
   Generates deterministic mock data per ticker so re-search
   yields the same result. NOT real market data.
   Exposes globals: Analyzer.
   ============================================================ */

const { useState: useStateZ, useMemo: useMemoZ, useRef: useRefZ, useEffect: useEffectZ } = React;

const PRED_LABEL = { UP: 'BUY', DOWN: 'SELL', NEUTRAL: 'HOLD' };
const PRED_COLOR = { UP: 'var(--primary)', DOWN: 'var(--danger)', NEUTRAL: 'var(--warning)' };

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
function FlowCard({ icon, label, value, color, live }) {
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
        {live && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            LIVE
          </span>
        )}
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

/* ---------- ML Plan Chart — real candles + entry/TP/SL lines ---------- */
function MLPlanChart({ candles, plan, prediction }) {
  const W = 1000, H = 360, PAD = { t: 16, r: 72, b: 32, l: 12 };
  const n = candles.length;
  if (!n) return null;

  const [hover, setHover] = useStateZ(null);
  const svgRef = useRefZ(null);

  const prices = candles.flatMap((c) => [c.high, c.low]);
  const rawMin = prediction === 'NEUTRAL'
    ? Math.min(...prices)
    : Math.min(...prices, plan.stop_loss, plan.target_profit);
  const rawMax = prediction === 'NEUTRAL'
    ? Math.max(...prices)
    : Math.max(...prices, plan.stop_loss, plan.target_profit);
  const pad    = (rawMax - rawMin) * 0.06;
  const lo = rawMin - pad, hi = rawMax + pad;
  const range = hi - lo || 1;

  const PAD_L  = 62;
  const cw     = (W - PAD_L - PAD.r) / n;
  const chartH = H - PAD.t - PAD.b;
  const fy     = (v) => PAD.t + (1 - (v - lo) / range) * chartH;
  const fx     = (i) => PAD_L + i * cw + cw / 2;

  const hline = (price, color, dash, label) => (
    <g key={label}>
      <line x1={PAD_L} y1={fy(price)} x2={W - PAD.r} y2={fy(price)}
        stroke={color} strokeWidth={1.5} strokeDasharray={dash} opacity={0.9} />
      <rect x={W - PAD.r + 2} y={fy(price) - 14} width={PAD.r - 4} height={28}
        fill={color} rx={4} opacity={0.15} />
      <text x={W - PAD.r + 6} y={fy(price) - 4} fill={color}
        fontSize={8} fontWeight={900} fontFamily="sans-serif" opacity={0.85}>
        {label}
      </text>
      <text x={W - PAD.r + 6} y={fy(price) + 8} fill={color}
        fontSize={9} fontWeight={700} fontFamily="JetBrains Mono,monospace">
        {Math.round(price).toLocaleString('id-ID')}
      </text>
    </g>
  );

  // sample ~6 date labels
  const dateIdxs = [0, Math.floor(n*0.2), Math.floor(n*0.4), Math.floor(n*0.6), Math.floor(n*0.8), n-1]
    .filter((v, i, a) => a.indexOf(v) === i);

  const onMouseMove = (e) => {
    const svg = svgRef.current;
    const pt  = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const { x: svgX, y: svgY } = pt.matrixTransform(svg.getScreenCTM().inverse());
    const idx   = Math.min(n - 1, Math.max(0, Math.floor((svgX - PAD_L) / cw)));
    const price = lo + (1 - (svgY - PAD.t) / chartH) * range;
    setHover({ idx, svgX: fx(idx), svgY, price });
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}>
      {/* grid + Y-axis price labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const priceAtLevel = hi - p * range;
        return (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD.r}
              y1={PAD.t + p * chartH} y2={PAD.t + p * chartH}
              stroke="var(--border)" strokeDasharray="2 4" opacity={0.5} />
            <text x={PAD_L - 4} y={PAD.t + p * chartH + 4}
              textAnchor="end" fontSize={9} fill="var(--fg-muted)"
              fontFamily="JetBrains Mono,monospace" fontWeight={600}>
              {Math.round(priceAtLevel).toLocaleString('id-ID')}
            </text>
          </g>
        );
      })}

      {/* candles */}
      {candles.map((c, i) => {
        const up    = c.close >= c.open;
        const col   = up ? 'var(--success)' : 'var(--danger)';
        const bodyT = fy(Math.max(c.open, c.close));
        const bodyB = fy(Math.min(c.open, c.close));
        const bodyH = Math.max(1.5, bodyB - bodyT);
        const cx    = fx(i);
        const hw    = Math.max(1, cw * 0.35);
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={fy(c.high)} y2={fy(c.low)} stroke={col} strokeWidth={1.2} />
            <rect x={cx - hw} y={bodyT} width={hw*2} height={bodyH} fill={col} />
          </g>
        );
      })}

      {/* signal markers */}
      {candles.map((c, i) => {
        if (c.signal === 0) return null;
        const cx  = fx(i);
        const buy = c.signal === 1;
        const y   = buy ? fy(c.low) + 8 : fy(c.high) - 8;
        return (
          <text key={'sig'+i} x={cx} y={y} textAnchor="middle"
            fontSize={10} fill={buy ? 'var(--success)' : 'var(--danger)'}
            fontWeight={900} opacity={0.85}>
            {buy ? '▲' : '▼'}
          </text>
        );
      })}

      {/* TP / Entry / SL lines */}
      {prediction !== 'NEUTRAL' && (prediction === 'DOWN'
        ? hline(plan.target_profit, 'var(--danger)',  '6 3', 'PROJ')
        : hline(plan.target_profit, 'var(--success)', '6 3', 'TP'))}
      {hline(plan.entry, '#4d8fff', '0', 'ENTRY')}
      {prediction !== 'NEUTRAL' && (prediction === 'DOWN'
        ? hline(plan.stop_loss, 'var(--warning)', '6 3', 'STOP')
        : hline(plan.stop_loss, 'var(--danger)',  '6 3', 'SL'))}

      {/* date labels */}
      {dateIdxs.map((i) => (
        <text key={'d'+i} x={fx(i)} y={H - 4} textAnchor="middle"
          fontSize={9} fill="var(--fg-muted)" fontFamily="sans-serif">
          {candles[i].time.slice(5)}
        </text>
      ))}

      {/* crosshair */}
      {hover && (() => {
        const c   = candles[hover.idx];
        const cx  = hover.svgX;
        return (
          <g>
            {/* vertical line */}
            <line x1={cx} x2={cx} y1={PAD.t} y2={H - PAD.b}
              stroke="var(--fg-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            {/* horizontal line */}
            <line x1={PAD_L} x2={W - PAD.r} y1={hover.svgY} y2={hover.svgY}
              stroke="var(--fg-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            {/* price label on Y axis */}
            <rect x={PAD_L - 52} y={hover.svgY - 9} width={50} height={18} rx={3}
              fill="#4d8fff" opacity={0.9} />
            <text x={PAD_L - 27} y={hover.svgY + 4} textAnchor="middle"
              fontSize={9} fontWeight={700} fill="white" fontFamily="JetBrains Mono,monospace">
              {Math.round(hover.price).toLocaleString('id-ID')}
            </text>
            {/* date label on X axis */}
            <rect x={cx - 22} y={H - PAD.b + 2} width={44} height={14} rx={3}
              fill="#4d8fff" opacity={0.9} />
            <text x={cx} y={H - PAD.b + 12} textAnchor="middle"
              fontSize={9} fontWeight={700} fill="white" fontFamily="sans-serif">
              {c.time.slice(5)}
            </text>
            {/* OHLC info — pojok kiri atas */}
            {[
              { lbl: 'O', val: c.open,  color: 'var(--fg)' },
              { lbl: 'H', val: c.high,  color: 'var(--success)' },
              { lbl: 'L', val: c.low,   color: 'var(--danger)' },
              { lbl: 'C', val: c.close, color: c.close >= c.open ? 'var(--success)' : 'var(--danger)' },
            ].map(({ lbl, val, color }, i) => (
              <g key={lbl}>
                <text x={PAD_L + 4 + i * 68} y={PAD.t + 13}
                  fontSize={10} fontWeight={700} fill="var(--fg-muted)" fontFamily="sans-serif">
                  {lbl}
                </text>
                <text x={PAD_L + 14 + i * 68} y={PAD.t + 13}
                  fontSize={10} fontWeight={700} fill={color} fontFamily="JetBrains Mono,monospace">
                  {Math.round(val).toLocaleString('id-ID')}
                </text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

/* ---------- Analyzer chart — ML plan when ready, else TradingView ---------- */
function AnalyzerChart({ ticker, mlData, mlLoading }) {
  const tvTheme = useTVTheme();

  if (mlLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--fg-muted)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Memuat chart dari yfinance...</span>
      </div>
    );
  }

  if (mlData?.status === 'success' && mlData.chart_history?.length) {
    const plan = mlData.trading_plan;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* legend */}
        <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg)' }}>{ticker} · 60 Hari</span>
          {(mlData.prediction === 'NEUTRAL'
            ? [{ label: 'ENTRY', val: plan.entry, color: '#4d8fff', pct: null }]
            : mlData.prediction === 'DOWN'
            ? [
                { label: 'ENTRY',    val: plan.entry,         color: '#4d8fff',        pct: null },
                { label: 'TARGET TURUN', val: plan.target_profit, color: 'var(--danger)',  pct: plan.tp_percent + '%' },
                { label: 'LEVEL STOP',  val: plan.stop_loss,     color: 'var(--warning)', pct: '+' + plan.sl_percent + '%' },
              ]
            : [
                { label: 'ENTRY', val: plan.entry,         color: '#4d8fff',        pct: null },
                { label: 'TP',    val: plan.target_profit, color: 'var(--success)', pct: '+' + plan.tp_percent + '%' },
                { label: 'SL',    val: plan.stop_loss,     color: 'var(--danger)',  pct: plan.sl_percent + '%' },
              ]
          ).map(({ label, val, color, pct }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 20, height: 2, background: color, display: 'inline-block', borderRadius: 1 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg)', fontWeight: 700 }}>
                Rp {Math.round(val).toLocaleString('id-ID')}
              </span>
              {pct && <span style={{ fontSize: 10, color, fontWeight: 800 }}>{pct}</span>}
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 10, color: 'var(--fg-muted)', fontWeight: 700 }}>
            <span style={{ color: 'var(--success)' }}>▲ BUY</span>
            <span style={{ color: 'var(--danger)' }}>▼ SELL</span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MLPlanChart candles={mlData.chart_history} plan={plan} prediction={mlData.prediction} />
        </div>
      </div>
    );
  }

  return (
    <TVWidget
      widget="advanced-chart"
      height="100%"
      config={{
        autosize: true, symbol: 'IDX:' + ticker, interval: 'D',
        timezone: 'Asia/Jakarta', theme: tvTheme, style: '1',
        locale: 'id', hide_side_toolbar: true,
        allow_symbol_change: false, save_image: false,
        withdateranges: true,
      }}
    />
  );
}

/* ---------- Analyzer screen ---------- */
function Analyzer() {
  const [ticker, setTicker] = useStateZ('BBRI');
  const [active, setActive] = useStateZ('BBRI');
  const [loading, setLoading] = useStateZ(false);
  const [mlData, setMlData] = useStateZ(null);
  const [mlLoading, setMlLoading] = useStateZ(false);
  const [bandData, setBandData] = useStateZ(null);
  const [suggestions, setSuggestions] = useStateZ([]);
  const [showSugg, setShowSugg] = useStateZ(false);
  const debounceRef = useRefZ(null);

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const [bandFrom, setBandFrom] = useStateZ(() => daysAgoStr(7));
  const [bandTo,   setBandTo]   = useStateZ(() => todayStr());
  const activeBand = useRefZ('');
  const [tvPrice, setTvPrice] = useStateZ(null);
  const activePrice = useRefZ('');

  const fetchTVPrice = (code) => {
    activePrice.current = code;
    setTvPrice(null);
    fetch('/price?ticker=' + code)
      .then((r) => r.json())
      .then((d) => { if (activePrice.current === code && d.price) setTvPrice(d); })
      .catch(() => {});
  };

  const fetchBandarmology = (code, from, to) => {
    activeBand.current = code;
    setBandData(null);
    const url = `/bandarmology?ticker=${code}&from=${from}&to=${to}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (activeBand.current === code) setBandData(d.buyers ? d : null); })
      .catch(() => { if (activeBand.current === code) setBandData(null); });
  };

  const data = useMemoZ(() => generateAnalysis(active), [active]);

  useEffectZ(() => { fetchTVPrice('BBRI'); fetchBandarmology('BBRI', bandFrom, bandTo); }, []);

  const onSearchInput = (val) => {
    setTicker(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      fetch('/search?q=' + encodeURIComponent(val))
        .then((r) => r.json())
        .then((d) => setSuggestions(d.results || []))
        .catch(() => setSuggestions([]));
    }, 280);
  };

  const run = (t) => {
    const code = (t || ticker).toUpperCase().trim();
    if (!code) return;
    setLoading(true);
    setMlData(null);
    setMlLoading(true);
    setBandData(null);
    setSuggestions([]);
    setShowSugg(false);
    setTicker(code);
    setTimeout(() => { setActive(code); setLoading(false); }, 500);
    fetchTVPrice(code);
    fetch('/ml-predict?ticker=' + code)
      .then((r) => r.json())
      .then((d) => { setMlData(d); setMlLoading(false); })
      .catch(() => { setMlData({ status: 'offline' }); setMlLoading(false); });
    fetchBandarmology(code, bandFrom, bandTo);
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
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <div
          className="card"
          style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
        >
          <div
            style={{
              display: 'flex', flex: 1, minWidth: 240, gap: 10, alignItems: 'center',
              padding: '8px 16px', background: 'var(--surface-2)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            }}
          >
            <Icon name="target" size={20} />
            <input
              value={ticker}
              onChange={(e) => onSearchInput(e.target.value.toUpperCase())}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run();
                if (e.key === 'Escape') { setSuggestions([]); setShowSugg(false); }
              }}
              placeholder="Masukkan kode saham..."
              maxLength={10}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 22, fontWeight: 800, color: 'var(--fg)',
                letterSpacing: '-0.01em', textTransform: 'uppercase',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>
          <button onClick={() => run()} className="btn btn-primary" disabled={loading}>
            {loading ? 'Loading...' : <>Analisa <Icon name="arrow_right" size={14} /></>}
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSugg && suggestions.length > 0 && (
          <div
            className="card"
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              padding: 6, marginTop: 4, boxShadow: 'var(--shadow-lg)',
            }}
          >
            {suggestions.map((s) => (
              <button
                key={s.symbol}
                onMouseDown={() => { setTicker(s.symbol); run(s.symbol); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 14px', background: 'transparent', border: 'none',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span
                  className="mono"
                  style={{ fontWeight: 800, fontSize: 14, color: 'var(--fg)', minWidth: 60 }}
                >
                  {s.symbol}
                </span>
                <span style={{ fontSize: 13, color: 'var(--fg-muted)', flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-faint)', fontWeight: 600 }}>{s.exchange}</span>
              </button>
            ))}
          </div>
        )}
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
            {active}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span className="mono tnum" style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)' }}>
              {tvPrice ? 'Rp ' + tvPrice.price.toLocaleString('id-ID') : '—'}
            </span>
            {tvPrice && (
              <span style={{ fontSize: 13, fontWeight: 700, color: tvPrice.change_pct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {tvPrice.change_pct >= 0 ? '+' : ''}{tvPrice.change_pct?.toFixed(2)}%
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--fg-faint)', fontWeight: 600 }}>
              {tvPrice ? 'TradingView' : 'memuat...'}
            </span>
          </div>
        </div>
        <div className="badge">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />{' '}
          {tvPrice ? 'Real · TradingView' : 'EOD · 7 hari terakhir'}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16, height: 420 }}>
        <AnalyzerChart ticker={active} mlData={mlData} mlLoading={mlLoading} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <FlowCard icon="rocket"  label="Net Foreign" value={mlData?.bandarmology?.net_foreign ?? (bandData ? bandData.netForeign : data.netForeign)} color="#4d8fff" live={!!(mlData?.bandarmology || bandData)} />
        <FlowCard icon="diamond" label="Net Local"   value={mlData?.bandarmology?.net_local   ?? (bandData ? bandData.netLocal   : data.netLocal)}   color="#a855f7" live={!!(mlData?.bandarmology || bandData)} />
        <FlowCard icon="star"    label="Net Retail"  value={mlData?.bandarmology?.net_retail  ?? (bandData ? bandData.netRetail  : data.netRetail)}  color="#f59e0b" live={!!(mlData?.bandarmology || bandData)} />
      </div>

      {/* ML Trading Plan + Performance */}
      <div
        className="calc-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
      >
        {/* Card 1: Trading Plan */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="rocket" size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)' }}>ML Trading Plan</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {mlData?.status === 'success' ? 'SVM · Live Data' : 'Jalankan npm start'}
                </div>
              </div>
            </div>
            {mlData?.status === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div style={{ padding: '6px 12px', borderRadius: 999, background: 'color-mix(in oklab, ' + PRED_COLOR[mlData.prediction] + ' 14%, transparent)', color: PRED_COLOR[mlData.prediction], fontSize: 11, fontWeight: 900, letterSpacing: '0.06em' }}>
                  {PRED_LABEL[mlData.prediction] || mlData.prediction}
                </div>
                <div style={{ padding: '3px 8px', borderRadius: 999, background: mlData.model_type === 'per_emiten' ? 'color-mix(in oklab, var(--success) 12%, transparent)' : 'color-mix(in oklab, var(--warning) 12%, transparent)', color: mlData.model_type === 'per_emiten' ? 'var(--success)' : 'var(--warning)', fontSize: 9, fontWeight: 900, letterSpacing: '0.08em' }}>
                  {mlData.model_type === 'per_emiten' ? 'PER EMITEN' : 'UNIVERSAL'}
                </div>
              </div>
            )}
          </div>

          {mlLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', color: 'var(--fg-muted)' }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Menghitung prediksi ML...</div>
              <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>Download data + hitung indikator (~5–10 detik)</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : mlData?.status === 'success' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Entry</span>
                <span className="mono tnum" style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>
                  Rp {mlData.trading_plan.entry.toLocaleString('id-ID')}
                </span>
              </div>
              {mlData.prediction === 'NEUTRAL' ? (
                <div style={{ padding: '16px 14px', background: 'color-mix(in oklab, var(--warning) 10%, transparent)', borderRadius: 12, border: '1px solid color-mix(in oklab, var(--warning) 25%, transparent)', marginBottom: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--warning)', marginBottom: 4 }}>TIDAK ADA TRADING PLAN</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Model mendeteksi kondisi sideways — tidak disarankan entry</div>
                </div>
              ) : mlData.prediction === 'DOWN' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ padding: 14, background: 'color-mix(in oklab, var(--danger) 10%, transparent)', borderRadius: 12, border: '1px solid color-mix(in oklab, var(--danger) 25%, transparent)' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--danger)', marginBottom: 4 }}>PROYEKSI TURUN</div>
                    <div className="mono tnum" style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>Rp {mlData.trading_plan.target_profit.toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: 'var(--danger)' }}>{mlData.trading_plan.tp_percent}%</div>
                  </div>
                  <div style={{ padding: 14, background: 'color-mix(in oklab, var(--warning) 10%, transparent)', borderRadius: 12, border: '1px solid color-mix(in oklab, var(--warning) 25%, transparent)' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--warning)', marginBottom: 4 }}>LEVEL WASPADA</div>
                    <div className="mono tnum" style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>Rp {mlData.trading_plan.stop_loss.toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: 'var(--warning)' }}>+{mlData.trading_plan.sl_percent}%</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ padding: 14, background: 'var(--primary-soft)', borderRadius: 12, border: '1px solid color-mix(in oklab, var(--primary) 25%, transparent)' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--primary)', marginBottom: 4 }}>TARGET PROFIT</div>
                    <div className="mono tnum" style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>Rp {mlData.trading_plan.target_profit.toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: 'var(--primary)' }}>+{mlData.trading_plan.tp_percent}%</div>
                  </div>
                  <div style={{ padding: 14, background: 'color-mix(in oklab, var(--danger) 10%, transparent)', borderRadius: 12, border: '1px solid color-mix(in oklab, var(--danger) 25%, transparent)' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--danger)', marginBottom: 4 }}>STOP LOSS</div>
                    <div className="mono tnum" style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>Rp {mlData.trading_plan.stop_loss.toLocaleString('id-ID')}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: 'var(--danger)' }}>{mlData.trading_plan.sl_percent}%</div>
                  </div>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', lineHeight: 1.5 }}>
                {mlData.trading_plan.note}
              </div>
              {/* Indicators mini grid */}
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Stoch %K',  value: mlData.indicators?.stoch != null ? mlData.indicators.stoch.toFixed(1) : '—' },
                  { label: 'BB',        value: mlData.indicators?.bb_pos ?? '—' },
                  { label: 'ADX',       value: mlData.indicators?.adx != null ? mlData.indicators.adx.toFixed(1) : '—' },
                  { label: 'CMF',       value: mlData.indicators?.cmf != null ? mlData.indicators.cmf.toFixed(3) : '—' },
                  { label: 'MFI',       value: mlData.indicators?.mfi != null ? mlData.indicators.mfi.toFixed(1) : '—' },
                  { label: 'Vol Ratio', value: mlData.indicators?.vol_ratio != null ? mlData.indicators.vol_ratio.toFixed(2) + 'x' : '—' },
                ].map((m) => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 700 }}>{m.label}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : mlData?.status === 'error' ? (
            <div style={{ fontSize: 13, color: 'var(--danger)', padding: 16, background: 'color-mix(in oklab, var(--danger) 8%, transparent)', borderRadius: 'var(--radius-sm)' }}>
              {mlData.message}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', lineHeight: 1.6 }}>
              {mlData === null ? (
                loading ? 'Memuat prediksi ML...' : 'Klik Analisa untuk memuat prediksi real dari model SVM.'
              ) : (
                <>Fitur ML memerlukan server lokal.<br /><strong style={{ color: 'var(--fg)' }}>npm start</strong> untuk mengaktifkan.</>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Win Rate + Recent Trades */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Model Performance</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                {mlData?.status === 'success' ? `${mlData.recent_trades?.length ?? 0} sinyal terakhir · Live` : 'Sinyal historis'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span className="mono tnum" style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em', color: mlData?.status === 'success' ? (mlData.win_rate >= 50 ? 'var(--success)' : 'var(--danger)') : 'var(--fg)' }}>
              <AnimatedNumber value={mlData?.status === 'success' ? mlData.win_rate : data.plan.winRate} format={(n) => Math.round(n) + '%'} />
            </span>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 700 }}>Win Rate</span>
          </div>

          {/* Recent Trades table */}
          {mlData?.status === 'success' && mlData.recent_trades?.length > 0 ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 2fr 1.5fr 1.5fr', padding: '6px 10px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Tgl', 'Sinyal', 'Harga', 'Hasil', 'Profit'].map((h) => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                ))}
              </div>
              {mlData.recent_trades.map((t, i) => {
                const isWin = t.result === 'WIN';
                const isBuy = t.signal === 'BUY';
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 2fr 1.5fr 1.5fr', padding: '8px 10px', borderBottom: i < mlData.recent_trades.length - 1 ? '1px solid var(--border)' : 'none', background: isWin ? 'color-mix(in oklab, var(--success) 5%, transparent)' : 'color-mix(in oklab, var(--danger) 5%, transparent)', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600 }}>{t.date}</span>
                    <span style={{ fontSize: 10, fontWeight: 900, color: isBuy ? 'var(--success)' : 'var(--danger)', letterSpacing: '0.04em' }}>{t.signal}</span>
                    <span className="mono tnum" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)' }}>Rp {Math.round(t.price).toLocaleString('id-ID')}</span>
                    <span style={{ fontSize: 10, fontWeight: 900, color: isWin ? 'var(--success)' : 'var(--danger)' }}>{t.result}</span>
                    <span className="mono tnum" style={{ fontSize: 11, fontWeight: 700, color: t.profit_pct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {t.profit_pct >= 0 ? '+' : ''}{t.profit_pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : mlData?.status === 'success' ? (
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
              Belum ada sinyal dalam 60 hari terakhir.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Stoch %K',    value: (40 + (data.plan.strength % 50)).toFixed(1) },
                { label: 'BB Position', value: data.plan.isBullish ? 'Upper' : 'Mid' },
                { label: 'ADX',         value: (20 + (data.plan.strength % 30)).toFixed(1) },
                { label: 'OBV Trend',   value: data.netForeign >= 0 ? 'Rising' : 'Falling' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 700 }}>{m.label}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* broker tables — date range picker */}
      <div
        style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          marginBottom: 12, padding: '10px 16px',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <Icon name="chart" size={16} />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Rentang Data
        </span>
        <input
          type="date"
          value={bandFrom}
          max={bandTo}
          onChange={(e) => setBandFrom(e.target.value)}
          className="input"
          style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
        />
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>s/d</span>
        <input
          type="date"
          value={bandTo}
          min={bandFrom}
          max={todayStr()}
          onChange={(e) => setBandTo(e.target.value)}
          className="input"
          style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
        />
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => active && fetchBandarmology(active, bandFrom, bandTo)}
        >
          Perbarui
        </button>
        {bandData && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            Data live · {bandFrom} s/d {bandTo}
          </span>
        )}
      </div>

      <div className="calc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BrokerTable
          title="Top Buyer"
          subtitle={mlData?.bandarmology ? 'Live · ML Response' : bandData ? 'Live · 7 hari terakhir' : 'Akumulasi terbesar'}
          list={mlData?.bandarmology?.top_buyers ?? (bandData ? bandData.buyers : data.buyers)}
          color="var(--success)"
          icon="rocket"
        />
        <BrokerTable
          title="Top Seller"
          subtitle={mlData?.bandarmology ? 'Live · ML Response' : bandData ? 'Live · 7 hari terakhir' : 'Distribusi terbesar'}
          list={mlData?.bandarmology?.top_sellers ?? (bandData ? bandData.sellers : data.sellers)}
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
          <strong style={{ color: 'var(--fg)' }}>Disclaimer:</strong> Data bandarmology dari api-saham. ML Trading Plan menggunakan model SVM yang dilatih dari data historis IDX — bukan rekomendasi beli/jual. DYOR.
        </div>
      </div>
    </CalcScreen>
  );
}

Object.assign(window, { Analyzer });
