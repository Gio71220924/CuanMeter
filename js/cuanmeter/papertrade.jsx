/* ============================================================
   papertrade.jsx — virtual portfolio (paper trading).
   localStorage store + pub/sub, mirrors watchlist.jsx.
   Realistic: lot system (×100), optional broker fees.
   ============================================================ */

const { useState: useStateP, useEffect: useEffectP } = React;

const PT_KEY = 'cuanmeter:papertrade';
const PT_DEFAULT_MODAL = 100000000; // Rp 100 juta
const FEE_BUY = 0.0015;  // 0.15%
const FEE_SELL = 0.0025; // 0.25% (termasuk pajak jual)
const ptListeners = new Set();

function ptDefault() {
  return { cash: PT_DEFAULT_MODAL, initial: PT_DEFAULT_MODAL, holdings: {}, history: [], feeOn: true };
}

function getPaper() {
  try {
    const v = JSON.parse(localStorage.getItem(PT_KEY));
    if (v && typeof v === 'object' && typeof v.cash === 'number') {
      return { feeOn: true, holdings: {}, history: [], initial: PT_DEFAULT_MODAL, ...v };
    }
  } catch (e) {}
  return ptDefault();
}

function setPaper(state) {
  try { localStorage.setItem(PT_KEY, JSON.stringify(state)); } catch (e) {}
  ptListeners.forEach((fn) => fn(state));
}

function subscribePaper(fn) {
  ptListeners.add(fn);
  return () => ptListeners.delete(fn);
}

function resetPaper(modal) {
  const m = Number(modal) > 0 ? Math.round(Number(modal)) : PT_DEFAULT_MODAL;
  setPaper({ cash: m, initial: m, holdings: {}, history: [], feeOn: getPaper().feeOn });
}

function setPaperFee(on) {
  setPaper({ ...getPaper(), feeOn: !!on });
}

/* Execute a buy. Returns { ok, error? }. */
function buyPaper(ticker, lot, price) {
  const code = String(ticker).toUpperCase().trim();
  lot = Math.floor(Number(lot));
  price = Number(price);
  if (!/^[A-Z]{4}$/.test(code) || !(lot > 0) || !(price > 0)) return { ok: false, error: 'Input tidak valid' };
  const s = getPaper();
  const shares = lot * 100;
  const cost = shares * price;
  const fee = s.feeOn ? cost * FEE_BUY : 0;
  const total = cost + fee;
  if (total > s.cash) return { ok: false, error: 'Cash tidak cukup' };
  const h = s.holdings[code] || { lot: 0, avg: 0 };
  const newLot = h.lot + lot;
  const newAvg = (h.avg * h.lot + price * lot) / newLot; // weighted avg execution price
  const holdings = { ...s.holdings, [code]: { lot: newLot, avg: Math.round(newAvg * 100) / 100 } };
  const history = [{ t: Date.now(), type: 'BUY', ticker: code, lot, price, fee: Math.round(fee) }, ...s.history].slice(0, 200);
  setPaper({ ...s, cash: Math.round(s.cash - total), holdings, history });
  return { ok: true };
}

/* Execute a sell. Returns { ok, error? }. */
function sellPaper(ticker, lot, price) {
  const code = String(ticker).toUpperCase().trim();
  lot = Math.floor(Number(lot));
  price = Number(price);
  if (!/^[A-Z]{4}$/.test(code) || !(lot > 0) || !(price > 0)) return { ok: false, error: 'Input tidak valid' };
  const s = getPaper();
  const h = s.holdings[code];
  if (!h || lot > h.lot) return { ok: false, error: 'Lot melebihi yang dimiliki' };
  const shares = lot * 100;
  const proceeds = shares * price;
  const fee = s.feeOn ? proceeds * FEE_SELL : 0;
  const realized = (price - h.avg) * shares - fee;
  const remLot = h.lot - lot;
  const holdings = { ...s.holdings };
  if (remLot > 0) holdings[code] = { lot: remLot, avg: h.avg };
  else delete holdings[code];
  const history = [{ t: Date.now(), type: 'SELL', ticker: code, lot, price, fee: Math.round(fee), realized: Math.round(realized) }, ...s.history].slice(0, 200);
  setPaper({ ...s, cash: Math.round(s.cash + proceeds - fee), holdings, history });
  return { ok: true };
}

/* Hook: re-render on any paper-trade change (same tab). */
function usePaper() {
  const [state, setState] = useStateP(getPaper);
  useEffectP(() => subscribePaper(setState), []);
  return state;
}

Object.assign(window, {
  getPaper, resetPaper, setPaperFee, buyPaper, sellPaper, subscribePaper, usePaper,
  PT_DEFAULT_MODAL, PT_FEE_BUY: FEE_BUY, PT_FEE_SELL: FEE_SELL,
});
