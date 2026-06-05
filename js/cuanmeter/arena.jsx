/* ============================================================
   arena.jsx — Arena FO page: live ladder + fast order entry.
   Wires the synthetic market (createMarket) to the account store.
   The market runs on a timer while this page is mounted; the
   account (cash/position) persists, the market re-seeds each visit.
   ============================================================ */

const { useState: useStateAA, useEffect: useEffectAA, useRef: useRefAA } = React;

function arRp(v) { return 'Rp ' + Math.round(v || 0).toLocaleString('id-ID'); }
function arShort(v) {
  v = v || 0; const a = Math.abs(v);
  if (a >= 1e12) return 'Rp ' + (v / 1e12).toFixed(2).replace('.', ',') + ' T';
  if (a >= 1e9) return 'Rp ' + (v / 1e9).toFixed(2).replace('.', ',') + ' M';
  if (a >= 1e6) return 'Rp ' + (v / 1e6).toFixed(1).replace('.', ',') + ' jt';
  return 'Rp ' + Math.round(v).toLocaleString('id-ID');
}

/* Live bid/ask ladder. Click a price → fills the order ticket. */
function ArenaLadder({ snap, onPick }) {
  if (!snap) return <div className="arena-ladder arena-ladder-skel" />;
  const maxLot = Math.max(1, ...snap.depth.bids.map((l) => l.lot), ...snap.depth.asks.map((l) => l.lot));
  const asks = snap.depth.asks.slice().reverse(); // highest ask on top
  return (
    <div className="arena-ladder">
      {asks.map((l) => (
        <div key={'a' + l.price} className="arena-lr" onClick={() => onPick(l.price)}>
          <span className="arena-lr-side" />
          <span className="arena-lr-px">{l.price.toLocaleString('id-ID')}</span>
          <span className="arena-lr-bar"><span className="arena-bar-ask" style={{ width: (l.lot / maxLot * 100) + '%' }} /><em>{l.lot}</em></span>
        </div>
      ))}
      <div className="arena-lr arena-lr-last">
        <span className="arena-lr-side" />
        <span className="arena-lr-px">{snap.last != null ? snap.last.toLocaleString('id-ID') : '—'}</span>
        <span className="arena-lr-bar"><em>last</em></span>
      </div>
      {snap.depth.bids.map((l) => (
        <div key={'b' + l.price} className="arena-lr" onClick={() => onPick(l.price)}>
          <span className="arena-lr-bar arena-lr-bar-bid"><em>{l.lot}</em><span className="arena-bar-bid" style={{ width: (l.lot / maxLot * 100) + '%' }} /></span>
          <span className="arena-lr-px">{l.price.toLocaleString('id-ID')}</span>
          <span className="arena-lr-side" />
        </div>
      ))}
    </div>
  );
}

function ArenaPage({ onNavigate }) {
  const acct = useArena();
  const marketRef = useRefAA(null);
  const [snap, setSnap] = useStateAA(null);
  const [seedPrice, setSeedPrice] = useStateAA(null);
  const [mode, setMode] = useStateAA('limit');
  const [lot, setLot] = useStateAA('5');
  const [price, setPrice] = useStateAA('');
  const [orders, setOrders] = useStateAA([]); // resting user orders
  const [msg, setMsg] = useStateAA(null);
  const [q, setQ] = useStateAA('');
  const [results, setResults] = useStateAA([]);
  const searchTimer = useRefAA(null);

  const ticker = acct.ticker;

  // build & run the market when a ticker is active
  useEffectAA(() => {
    if (!ticker) { setSnap(null); return; }
    let dead = false;
    fetch('/price?ticker=' + ticker)
      .then((r) => r.json())
      .then((d) => {
        if (dead) return;
        const sp = d.price || 1000;
        setSeedPrice(sp);
        const market = createMarket({
          seedPrice: sp,
          onUpdate: () => {
            if (dead) return;
            setSnap(market.snapshot());
            setOrders(market.userOrders());
          },
          onTrade: (t) => { if (t.buyOwner === 'user' || t.sellOwner === 'user') applyUserFills([t]); },
        });
        marketRef.current = market;
        setSnap(market.snapshot());
        setPrice(String(market.snapshot().last));
        market.start(700);
      })
      .catch(() => {});
    return () => { dead = true; if (marketRef.current) marketRef.current.stop(); marketRef.current = null; };
  }, [ticker]);

  const pos = acct.position || { lot: 0, avg: 0 };
  const last = snap ? snap.last : (seedPrice || 0);
  const posPL = pos.lot > 0 && pos.avg > 0 ? (last - pos.avg) / pos.avg * 100 : 0;
  const equity = acct.cash + pos.lot * 100 * last;
  const totalPL = acct.initial > 0 ? (equity - acct.initial) / acct.initial * 100 : 0;
  const chgSeed = seedPrice ? (last - seedPrice) / seedPrice * 100 : 0;

  const flash = (m) => { setMsg(m); setTimeout(() => setSnap((s) => s), 0); };

  const place = (side) => {
    const m = marketRef.current; if (!m) return;
    const n = Math.floor(Number(lot)) || 0;
    if (n <= 0) { flash('Lot tidak valid'); return; }
    const px = mode === 'market' ? null : roundToTick(Number(price), m.tick);
    if (mode === 'limit' && !(px > 0)) { flash('Harga tidak valid'); return; }
    if (side === 'sell' && n > pos.lot) { flash('Lot melebihi posisi'); return; }
    if (side === 'buy') {
      const ref = px || m.snapshot().bestAsk || last;
      const est = n * 100 * ref * (1 + (acct.feeOn ? AR_FEE_BUY : 0));
      if (est > acct.cash) { flash('Cash tidak cukup'); return; }
    }
    const res = m.submitUser({ side, price: px, lot: n }); // account updates via onTrade
    setSnap(m.snapshot());
    setOrders(m.userOrders());
    const filled = res.trades.reduce((s, t) => s + t.lot, 0);
    if (filled && res.restingLot) flash(`${side === 'buy' ? 'Beli' : 'Jual'}: fill ${filled} lot, ${res.restingLot} antri`);
    else if (filled) flash(`${side === 'buy' ? 'Beli' : 'Jual'}: fill ${filled} lot`);
    else if (res.restingLot) flash(`Order ${side === 'buy' ? 'beli' : 'jual'} ${res.restingLot} lot masuk antrian`);
    else flash('Belum ada yang match');
  };

  const cancelOrder = (id) => { const m = marketRef.current; if (m) { m.cancel(id); setOrders(m.userOrders()); } };

  const onSearch = (val) => {
    setQ(val);
    clearTimeout(searchTimer.current);
    if (val.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(() => {
      fetch('/search?q=' + encodeURIComponent(val.trim())).then((r) => r.json()).then((d) => setResults((d.results || []).slice(0, 6))).catch(() => setResults([]));
    }, 250);
  };
  const pickTicker = (sym) => { setQ(''); setResults([]); setArenaTicker(String(sym).toUpperCase()); };
  const doReset = () => { const v = window.prompt('Reset Arena. Modal awal (Rp):', String(acct.initial)); if (v != null) resetArena(Number(String(v).replace(/[^\d]/g, '')) || AR_DEFAULT_MODAL, ticker); };

  return (
    <CalcScreen icon="fire" tag="ARENA · MARKET SIMULATOR"
      title={<>Arena <span style={{ color: 'var(--primary)' }}>FO</span> — lawan bot.</>}
      subtitle="Order book sintetik + bot trader. Harga digerakin bot (bukan harga real). Latihan fast order: limit & market.">

      <div className="paper-summary">
        <div className="paper-sumbox"><span>Cash</span><strong>{arShort(acct.cash)}</strong></div>
        <div className="paper-sumbox"><span>Equity</span><strong>{arShort(equity)}</strong></div>
        <div className="paper-sumbox"><span>Total P&L</span><strong className={totalPL >= 0 ? 'paper-up' : 'paper-dn'}>{totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}%</strong></div>
        <div className="paper-sum-actions">
          <label className="paper-fee-toggle"><input type="checkbox" checked={acct.feeOn} onChange={(e) => setArenaFee(e.target.checked)} /> Fee</label>
          <button type="button" className="btn btn-secondary paper-reset" onClick={doReset}>↺ Reset</button>
        </div>
      </div>

      {!ticker ? (
        <div className="watchlist-search arena-pick">
          <input className="watchlist-search-input" placeholder="🔍 Pilih saham buat masuk arena…" value={q} onChange={(e) => onSearch(e.target.value)} />
          {results.length > 0 && (
            <div className="watchlist-search-results">
              {results.map((r) => (
                <button type="button" key={r.symbol} className="watchlist-search-item" onClick={() => pickTicker(r.symbol)}>
                  <strong>{r.symbol}</strong> <span>{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="arena-head">
            <div className="arena-head-tk">
              <strong>{ticker}</strong>
              <span className="arena-head-last">{last ? last.toLocaleString('id-ID') : '…'}</span>
              <span className={chgSeed >= 0 ? 'paper-up' : 'paper-dn'}>{chgSeed >= 0 ? '+' : ''}{chgSeed.toFixed(2)}%</span>
            </div>
            <button type="button" className="arena-change" onClick={() => setArenaTicker(null)}>ganti saham</button>
          </div>

          {pos.lot > 0 && (
            <div className="arena-pos">
              Posisi: <strong>{pos.lot} lot</strong> @ {arRp(pos.avg)} · <span className={posPL >= 0 ? 'paper-up' : 'paper-dn'}>{posPL >= 0 ? '+' : ''}{posPL.toFixed(2)}%</span> ({arRp((last - pos.avg) * pos.lot * 100)})
            </div>
          )}

          <div className="arena-main">
            <ArenaLadder snap={snap} onPick={(p) => { setMode('limit'); setPrice(String(p)); }} />

            <div className="arena-ticket">
              <div className="arena-seg">
                <button type="button" className={mode === 'limit' ? 'on' : ''} onClick={() => setMode('limit')}>Limit</button>
                <button type="button" className={mode === 'market' ? 'on' : ''} onClick={() => setMode('market')}>Market</button>
              </div>
              {mode === 'limit' && (
                <label className="paper-field"><span>Harga (klik ladder)</span>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
              )}
              <label className="paper-field"><span>Lot</span>
                <input type="number" min="1" value={lot} onChange={(e) => setLot(e.target.value)} /></label>
              <div className="arena-btns">
                <button type="button" className="btn btn-primary" onClick={() => place('buy')}>BELI</button>
                <button type="button" className="btn btn-sell" onClick={() => place('sell')}>JUAL</button>
              </div>
              {msg && <div className="arena-msg">{msg}</div>}

              {orders.length > 0 && (
                <div className="arena-orders">
                  <div className="arena-orders-h">Order aktif</div>
                  {orders.map((o) => (
                    <div key={o.id} className="arena-order">
                      <span className={o.side === 'buy' ? 'paper-up' : 'paper-dn'}>{o.side === 'buy' ? 'BUY' : 'SELL'}</span>
                      <span>{o.lot} @ {o.price.toLocaleString('id-ID')}</span>
                      <button type="button" onClick={() => cancelOrder(o.id)} aria-label="Batal">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {acct.history.length > 0 && (
            <div className="arena-hist">
              <div className="arena-hist-h">Riwayat fill</div>
              {acct.history.slice(0, 12).map((x, i) => (
                <div key={i} className="paper-hist-row">
                  <span className={x.type === 'BUY' ? 'paper-up' : 'paper-dn'}>{x.type}</span>
                  <span>{x.lot} lot @ {arRp(x.price)}</span>
                  <span className={x.realized >= 0 ? 'paper-up' : 'paper-dn'}>{x.type === 'SELL' && x.realized != null ? (x.realized >= 0 ? '+' : '') + arRp(x.realized) : ''}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CalcScreen>
  );
}

Object.assign(window, { ArenaPage });
