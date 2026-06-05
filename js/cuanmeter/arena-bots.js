/* ============================================================
   arena-bots.js — bot agents + tick loop on top of the engine.
   createMarket() seeds a book from a real price, populates it with
   market-maker liquidity, and on each step() lets noise + momentum
   bots trade so the price emerges. Pure logic (step() is synchronous
   and seedable) — node-testable; start()/stop() just wrap step in a
   timer for the browser.
   ============================================================ */

function createMarket(opts) {
  opts = opts || {};
  const random = opts.rng || Math.random;
  const seed = opts.seedPrice;
  const tick = tickSizeFor(seed);
  const book = createBook(tick);
  book.last = roundToTick(seed, tick);
  let ref = book.last;                 // fair-value reference for market makers
  let recent = [book.last];            // short price window for momentum
  let timer = null;

  // three market makers at increasing spreads → layered depth
  const mms = [{ spread: 1, size: 25 }, { spread: 2, size: 45 }, { spread: 4, size: 75 }]
    .map((c) => ({ ...c, bidId: null, askId: null }));

  const rint = (n) => Math.floor(random() * n);

  function requote() {
    const center = roundToTick(ref, tick);
    for (const mm of mms) {
      if (mm.bidId) book.cancel(mm.bidId);
      if (mm.askId) book.cancel(mm.askId);
      mm.bidId = mm.askId = null;
    }
    for (const mm of mms) {
      const r1 = book.submit({ side: 'buy', price: center - mm.spread * tick, lot: mm.size + rint(20), owner: 'mm' });
      const r2 = book.submit({ side: 'sell', price: center + mm.spread * tick, lot: mm.size + rint(20), owner: 'mm' });
      mm.bidId = r1.restId;
      mm.askId = r2.restId;
      // a resting user/other order may have filled against the MM quote:
      emit(r1.trades); emit(r2.trades);
    }
  }

  function emit(trades) {
    if (trades && trades.length && opts.onTrade) trades.forEach((t) => opts.onTrade(t));
  }

  function step() {
    // 1. drift the reference: small random walk + momentum bias, clamped ±20%
    const drift = recent[recent.length - 1] - recent[0];
    const mom = Math.sign(drift) * (random() < 0.6 ? 1 : 0);
    ref += ((random() - 0.5) * 2 + mom) * tick * 0.5;
    ref = Math.max(seed * 0.8, Math.min(seed * 1.2, ref));

    // 2. market makers refresh quotes around ref
    requote();

    // 3. noise traders: a few small market orders
    for (let i = 0, n = 1 + rint(3); i < n; i++) {
      emit(book.submit({ side: random() < 0.5 ? 'buy' : 'sell', price: null, lot: 1 + rint(5), owner: 'noise' }).trades);
    }

    // 4. momentum trader: lean into the trend
    if (Math.abs(drift) > tick && random() < 0.5) {
      emit(book.submit({ side: drift > 0 ? 'buy' : 'sell', price: null, lot: 2 + rint(4), owner: 'momentum' }).trades);
    }

    recent.push(book.last);
    if (recent.length > 6) recent.shift();
    if (opts.onUpdate) opts.onUpdate();
    return book.last;
  }

  // user order goes straight to the engine (owner 'user')
  function submitUser(order) {
    const res = book.submit({ side: order.side, price: order.price, lot: order.lot, owner: 'user' });
    emit(res.trades);
    if (opts.onUpdate) opts.onUpdate();
    return res;
  }

  function snapshot(n) {
    return { last: book.last, ref, tick, depth: book.depth(n || 7), bestBid: book.bestBid(), bestAsk: book.bestAsk() };
  }

  function start(ms) { stop(); requote(); timer = setInterval(step, ms || 600); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  requote(); // seed the book immediately
  return { book, step, submitUser, snapshot, cancel: (id) => book.cancel(id), start, stop, tick };
}

if (typeof window !== 'undefined') {
  Object.assign(window, { createMarket });
}
