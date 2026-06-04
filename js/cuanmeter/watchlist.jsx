/* ============================================================
   watchlist.jsx — localStorage store + ★ toggle.
   Persists the user's watchlist and keeps the Analyzer star and
   the home widget in sync via a tiny pub/sub.
   ============================================================ */

const { useState: useStateW, useEffect: useEffectW } = React;

const WATCHLIST_KEY = 'cuanmeter:watchlist';
const wlListeners = new Set();

function getWatchlist() {
  try {
    const v = JSON.parse(localStorage.getItem(WATCHLIST_KEY));
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}
function setWatchlist(list) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); } catch (e) {}
  wlListeners.forEach((fn) => fn(list));
}
function hasTicker(t) { return getWatchlist().includes(String(t).toUpperCase()); }
function addTicker(t) {
  const code = String(t).toUpperCase().trim();
  if (!/^[A-Z]{4}$/.test(code)) return;
  const list = getWatchlist();
  if (!list.includes(code)) setWatchlist([...list, code]);
}
function removeTicker(t) {
  const code = String(t).toUpperCase();
  setWatchlist(getWatchlist().filter((x) => x !== code));
}
function toggleTicker(t) {
  hasTicker(t) ? removeTicker(t) : addTicker(t);
}
function subscribeWatchlist(fn) {
  wlListeners.add(fn);
  return () => wlListeners.delete(fn);
}

/* Hook: re-render on any watchlist change (same tab). */
function useWatchlist() {
  const [list, setList] = useStateW(getWatchlist);
  useEffectW(() => subscribeWatchlist(setList), []);
  return list;
}

/* ★ toggle button — used in the Analyzer header. */
function WatchlistStar({ ticker, size = 22 }) {
  const list = useWatchlist();
  if (!ticker) return null;
  const code = String(ticker).toUpperCase();
  const active = list.includes(code);
  return (
    <button
      type="button"
      className={`watchlist-star${active ? ' active' : ''}`}
      style={{ fontSize: size }}
      onClick={() => toggleTicker(code)}
      title={active ? 'Hapus dari watchlist' : 'Simpan ke watchlist'}
      aria-label={active ? 'Hapus dari watchlist' : 'Simpan ke watchlist'}
    >
      {active ? '★' : '☆'}
    </button>
  );
}

Object.assign(window, {
  getWatchlist, addTicker, removeTicker, toggleTicker, hasTicker,
  subscribeWatchlist, useWatchlist, WatchlistStar,
});
