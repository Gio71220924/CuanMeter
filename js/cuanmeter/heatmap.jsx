/* ============================================================
   heatmap.jsx — Sector treemap (squarified, no dependency).
   ============================================================ */

const { useState: useStateH, useEffect: useEffectH, useRef: useRefH, useMemo: useMemoH } = React;

/* ---------- Ticker → TradingView logo slug (verified against CDN) ----------
   Missing tickers (GOTO, TLKM, JECC) gracefully fall back to text-only. */
const TICKER_LOGO = {
  BYAN: 'bayan-resources-tbk', ADRO: 'adaro-energy-tbk', PTBA: 'bukit-asam-tbk',
  ITMG: 'indo-tambangraya-megah', MEDC: 'medco-energi', PGAS: 'perusahaan-gas-negara',
  BRPT: 'barito-pacific', TPIA: 'chandra-asri', ANTM: 'antam', INCO: 'vale',
  MDKA: 'merdeka-copper-gold', INKP: 'indah-kiat-pulp-and-paper',
  ASII: 'astra-international', UNTR: 'united-tractors', ARNA: 'arwana-citramulia-tbk',
  KRAS: 'krakatau-steel-persero', MARK: 'mark-dynamics-indonesia',
  UNVR: 'unilever', ICBP: 'indofood-cbp', INDF: 'indofood', AMRT: 'sumber-alfaria-trijaya',
  CPIN: 'charoen-pokphand-indonesia', GGRM: 'gudang-garam-tbk',
  MAPI: 'mitra-adiperkasa', ACES: 'ace-hardware', ERAA: 'erajaya-swasembada',
  MNCN: 'media-nusantara-citra-tbk', SCMA: 'surya-citra-media', LPPF: 'matahari-department-store-tbk',
  KLBF: 'kalbe-farma', SIDO: 'sido-muncul', MIKA: 'mitra-keluarga-karyasehat',
  SILO: 'siloam-international-hospitals-tbk', HEAL: 'medikaloka-hermina-tbk', PRDA: 'prodia-widyahusada',
  BBCA: 'bank-central-asia', BBRI: 'bank-rakyat-indonesia', BMRI: 'bank-mandiri',
  BBNI: 'bank-negara-indonesia-persero-tbk', BRIS: 'bank-syariah-indonesia', ARTO: 'bank-jago-tbk',
  PANI: 'pantai-indah-kapuk-dua-tbk', BSDE: 'bumi-serpong-damai', CTRA: 'ciputra-development',
  PWON: 'pakuwon-jati', SMRA: 'summarecon-agung', DMAS: 'puradelta-lestari',
  DCII: 'dci-indonesia-tbk', BUKA: 'bukalapak', EMTK: 'elang-mahkota-teknologi-tbk',
  MTDL: 'metrodata-electronics', WIFI: 'solusi-sinergi-digital-tbk',
  TOWR: 'sarana-menara-nusantara', JSMR: 'jasa-marga-persero', MTEL: 'dayamitra-telekomunikasi',
  ISAT: 'indosat', EXCL: 'xl-axiata-tbk',
  ASSA: 'adi-sarana-armada-tbk', BIRD: 'blue-bird', SMDR: 'samudera-indonesia',
  TMAS: 'temas', WEHA: 'weha-transportasi-indonesia-tbk', HATM: 'habco-trans-maritima-tbk',
};

/* ---------- Squarified treemap layout ----------
   data: [{ value, ... }]  → returns [{ data, x, y, w, h }] in pixels. */
function squarify(data, x, y, w, h) {
  const items = data.filter((d) => d.value > 0).slice().sort((a, b) => b.value - a.value);
  const result = [];
  if (!items.length || w <= 0 || h <= 0) return result;

  const worstRatio = (row, length, scale) => {
    const areas = row.map((r) => r.value * scale);
    const sum = areas.reduce((s, a) => s + a, 0);
    const maxA = Math.max(...areas);
    const minA = Math.min(...areas);
    const sum2 = sum * sum;
    const len2 = length * length;
    return Math.max((len2 * maxA) / sum2, sum2 / (len2 * minA));
  };

  let rect = { x, y, w, h };
  let i = 0;
  while (i < items.length) {
    const remaining = items.slice(i);
    const remTotal = remaining.reduce((s, d) => s + d.value, 0);
    const scale = (rect.w * rect.h) / remTotal; // px per value unit
    const length = Math.min(rect.w, rect.h);    // tile along shorter side

    let row = [items[i]];
    let j = i + 1;
    while (j < items.length) {
      const next = row.concat(items[j]);
      if (worstRatio(next, length, scale) > worstRatio(row, length, scale)) break;
      row = next;
      j++;
    }

    const rowValue = row.reduce((s, d) => s + d.value, 0);
    const thickness = (rowValue * scale) / length; // band depth
    let offset = 0;

    if (rect.w >= rect.h) {
      // vertical column of width `thickness` on the left
      for (const d of row) {
        const cellH = (d.value * scale) / thickness;
        result.push({ data: d, x: rect.x, y: rect.y + offset, w: thickness, h: cellH });
        offset += cellH;
      }
      rect = { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h };
    } else {
      // horizontal band of height `thickness` on top
      for (const d of row) {
        const cellW = (d.value * scale) / thickness;
        result.push({ data: d, x: rect.x + offset, y: rect.y, w: cellW, h: thickness });
        offset += cellW;
      }
      rect = { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness };
    }
    i = j;
  }
  return result;
}

/* ---------- Color scale: red ↔ gray ↔ green, clamp ±4% ---------- */
function mixRGB(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function colorFor(pct) {
  const GRAY = [120, 120, 128];
  const GREEN = [0, 168, 107];
  const RED = [220, 52, 52];
  const t = Math.max(-4, Math.min(4, pct)) / 4; // -1..1
  return t >= 0 ? mixRGB(GRAY, GREEN, t) : mixRGB(GRAY, RED, -t);
}
function textOn(rgbStr) {
  const m = rgbStr.match(/\d+/g).map(Number);
  const lum = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
  return lum > 0.6 ? '#0b0b0c' : '#ffffff';
}

/* ---------- One stock tile ---------- */
function Tile({ stock, x, y, w, h, onSelect }) {
  const bg = colorFor(stock.pct);
  const small = w < 46 || h < 30;
  const sign = stock.pct >= 0 ? '+' : '';
  const slug = TICKER_LOGO[stock.ticker];
  const showLogo = slug && w >= 52 && h >= 48;
  const logoSize = Math.min(28, Math.floor(Math.min(w, h) * 0.34));
  return (
    <button
      type="button"
      className="heatmap-tile"
      style={{ left: x, top: y, width: w, height: h, background: bg, color: textOn(bg) }}
      onClick={() => onSelect(stock.ticker)}
      title={`${stock.ticker} · ${sign}${stock.pct}% · Rp ${stock.price.toLocaleString('id-ID')}`}
    >
      {!small && (
        <span className="heatmap-tile-label">
          {showLogo && (
            <img
              className="heatmap-tile-logo"
              src={`https://s3-symbol-logo.tradingview.com/${slug}.svg`}
              alt=""
              width={logoSize}
              height={logoSize}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <strong>{stock.ticker}</strong>
          <span>{sign}{stock.pct}%</span>
        </span>
      )}
    </button>
  );
}

/* ---------- One sector block (header + nested stock tiles) ---------- */
function SectorBlock({ sector, x, y, w, h, onSelect }) {
  const HEADER = 18;
  const PAD = 2;
  const innerH = Math.max(0, h - HEADER - PAD);
  const innerW = Math.max(0, w - PAD * 2);
  const tiles = useMemoH(
    () => squarify(sector.stocks.map((st) => ({ stock: st, value: st.mcap })), 0, 0, innerW, innerH),
    [sector, innerW, innerH]
  );
  return (
    <div className="heatmap-sector" style={{ left: x, top: y, width: w, height: h }}>
      <div className="heatmap-sector-label">{sector.name}</div>
      <div className="heatmap-sector-inner" style={{ top: HEADER, left: PAD, width: innerW, height: innerH }}>
        {tiles.map(({ data, x: sx, y: sy, w: sw, h: sh }) => (
          <Tile key={data.stock.ticker} stock={data.stock} x={sx} y={sy} w={sw} h={sh} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Treemap canvas (measures itself, lays out sectors) ---------- */
function Treemap({ sectors, onSelect }) {
  const ref = useRefH(null);
  const [size, setSize] = useStateH({ w: 0, h: 0 });

  useEffectH(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rects = useMemoH(() => {
    if (!size.w || !size.h) return [];
    const items = sectors.map((s) => ({
      sector: s,
      value: s.stocks.reduce((sum, st) => sum + st.mcap, 0),
    }));
    return squarify(items, 0, 0, size.w, size.h);
  }, [sectors, size]);

  return (
    <div ref={ref} className="heatmap-canvas">
      {rects.map(({ data, x, y, w, h }) => (
        <SectorBlock key={data.sector.code} sector={data.sector} x={x} y={y} w={w} h={h} onSelect={onSelect} />
      ))}
    </div>
  );
}

/* ---------- Color legend ---------- */
function HeatmapLegend() {
  const stops = [-4, -2, 0, 2, 4];
  return (
    <div className="heatmap-legend">
      <span className="heatmap-legend-cap">-4%</span>
      <div className="heatmap-legend-bar">
        {stops.map((p) => (
          <span key={p} style={{ background: colorFor(p) }} />
        ))}
      </div>
      <span className="heatmap-legend-cap">+4%</span>
    </div>
  );
}

/* ---------- Page ---------- */
function HeatmapPage({ onNavigate }) {
  const [data, setData] = useStateH(null);
  const [loading, setLoading] = useStateH(true);
  const [error, setError] = useStateH(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/heatmap')
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok') setData(d);
        else setError(d.message || 'Gagal memuat heatmap');
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal menghubungi server');
        setLoading(false);
      });
  };
  useEffectH(() => { load(); }, []);

  const ts = data
    ? new Date(data.generated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : null;

  const select = (ticker) => onNavigate && onNavigate('analyzer', ticker);

  return (
    <CalcScreen
      icon="fire"
      tag="MARKET · HEATMAP"
      title={<>Heatmap <span style={{ color: 'var(--primary)' }}>sektor</span> IDX.</>}
      subtitle="Sektor & saham mana yang panas hari ini. Ukuran kotak = market cap, warna = perubahan harga harian. Klik saham buat buka analisisnya."
    >
      <div className="heatmap-toolbar">
        <HeatmapLegend />
        <div className="heatmap-toolbar-right">
          {ts && <span className="heatmap-ts">data per {ts}</span>}
          <button onClick={load} disabled={loading} className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Memuat...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="heatmap-error">{error} — coba klik Refresh.</div>
      )}

      {loading && !data && (
        <div className="heatmap-canvas heatmap-skeleton" />
      )}

      {data && <Treemap sectors={data.sectors} onSelect={select} />}
    </CalcScreen>
  );
}

Object.assign(window, { Treemap, colorFor, squarify, HeatmapPage });
