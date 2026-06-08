/* ============================================================
   arena-store.jsx — Arena account: cash / position / history.
   Separate virtual money from the real-price paper trading.
   localStorage persists the ACCOUNT; the market (book + bots) is
   ephemeral and re-seeded each session by the UI.
   applyUserFills() is the glue: engine fills → account changes.
   ============================================================ */

const { useState: useStateAR, useEffect: useEffectAR } = React;

const AR_KEY = 'cuanmeter:arena';
const AR_DEFAULT_MODAL = 100000000; // Rp 100 juta
const AR_FEE_BUY = 0.0015;
const AR_FEE_SELL = 0.0025;
const arListeners = new Set();

function arDefault() {
  return {
    cash: AR_DEFAULT_MODAL,
    initial: AR_DEFAULT_MODAL,
    ticker: null,
    position: { lot: 0, avg: 0 },
    history: [],
    feeOn: true,
    market: { profile: 'normal', speed: 1 },
  };
}
function getArena() {
  try {
    const v = JSON.parse(localStorage.getItem(AR_KEY));
    if (v && typeof v.cash === 'number') {
      return {
        ...arDefault(),
        ...v,
        position: v.position || { lot: 0, avg: 0 },
        market: normalizeArenaPreferences(v.market),
      };
    }
  } catch (e) {}
  return arDefault();
}
function setArena(s) {
  try { localStorage.setItem(AR_KEY, JSON.stringify(s)); } catch (e) {}
  arListeners.forEach((fn) => fn(s));
}
function subscribeArena(fn) { arListeners.add(fn); return () => arListeners.delete(fn); }

function resetArena(modal, ticker) {
  const m = Number(modal) > 0 ? Math.round(Number(modal)) : AR_DEFAULT_MODAL;
  const cur = getArena();
  setArena({
    cash: m,
    initial: m,
    ticker: ticker || cur.ticker,
    position: { lot: 0, avg: 0 },
    history: [],
    feeOn: cur.feeOn,
    market: cur.market,
  });
}
function setArenaTicker(ticker) {
  // switching stock clears the (synthetic) position — different market
  const s = getArena();
  setArena({ ...s, ticker, position: { lot: 0, avg: 0 } });
}
function setArenaFee(on) { setArena({ ...getArena(), feeOn: !!on }); }
function setArenaMarketPreferences(next) {
  const state = getArena();
  setArena({
    ...state,
    market: normalizeArenaPreferences({
      ...state.market,
      ...(next || {}),
    }),
  });
}

/* Glue: apply engine fills involving the user to the account.
   `trades` may hold 1+ fills (a market order can hit several levels);
   all user-involved fills in one call share the same user side. */
function applyUserFills(trades) {
  const ut = (trades || []).filter((t) => t.buyOwner === 'user' || t.sellOwner === 'user');
  if (!ut.length) return;
  const buy = ut[0].buyOwner === 'user';
  const lot = ut.reduce((sum, t) => sum + t.lot, 0);
  const value = ut.reduce((sum, t) => sum + t.lot * 100 * t.price, 0);
  const avgPx = value / (lot * 100);
  const s = getArena();
  const pos = s.position || { lot: 0, avg: 0 };

  if (buy) {
    const fee = s.feeOn ? value * AR_FEE_BUY : 0;
    const newLot = pos.lot + lot;
    const newAvg = (pos.avg * pos.lot + avgPx * lot) / newLot;
    setArena({
      ...s,
      cash: Math.round(s.cash - value - fee),
      position: { lot: newLot, avg: Math.round(newAvg * 100) / 100 },
      history: [{ t: Date.now(), type: 'BUY', lot, price: Math.round(avgPx * 100) / 100, fee: Math.round(fee) }, ...s.history].slice(0, 200),
    });
  } else {
    const fee = s.feeOn ? value * AR_FEE_SELL : 0;
    const sellLot = Math.min(lot, pos.lot);
    const realized = (avgPx - pos.avg) * sellLot * 100 - fee;
    const remLot = pos.lot - sellLot;
    setArena({
      ...s,
      cash: Math.round(s.cash + value - fee),
      position: remLot > 0 ? { lot: remLot, avg: pos.avg } : { lot: 0, avg: 0 },
      history: [{ t: Date.now(), type: 'SELL', lot, price: Math.round(avgPx * 100) / 100, fee: Math.round(fee), realized: Math.round(realized) }, ...s.history].slice(0, 200),
    });
  }
}

function useArena() {
  const [state, setState] = useStateAR(getArena);
  useEffectAR(() => subscribeArena(setState), []);
  return state;
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    getArena, setArenaTicker, setArenaFee, setArenaMarketPreferences,
    resetArena, applyUserFills, subscribeArena, useArena,
    AR_DEFAULT_MODAL, AR_FEE_BUY, AR_FEE_SELL,
  });
}
