/* ============================================================
   arena-engine.js — order book + matching engine (pure JS).
   Unit: a single-stock limit order book with price-time priority.
   Works in LOTS (1 lot = 100 shares); the account layer converts
   to rupiah. No UI, no globals beyond the window export — fully
   node-testable.
   ============================================================ */

/* IDX fraksi harga (tick size) by price band. */
function tickSizeFor(price) {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}
function roundToTick(price, tick) {
  return Math.round(price / tick) * tick;
}

/* Create an order book.
   submit(order) where order = { side:'buy'|'sell', price:number|null, lot, owner }
     price === null  → market order (never rests).
   Returns { trades:[{price,lot,buyOwner,sellOwner}], restingLot, restId }. */
function createBook(tick) {
  const bids = []; // levels sorted by price DESC: [{ price, orders:[{id,lot,owner,seq}] }]
  const asks = []; // levels sorted by price ASC
  let last = null;
  let seq = 0;

  const sideArr = (side) => (side === 'buy' ? bids : asks);

  function levelFor(side, price) {
    const arr = sideArr(side);
    const found = arr.find((l) => l.price === price);
    if (found) return found;
    const lvl = { price, orders: [] };
    let j = 0;
    if (side === 'buy') { while (j < arr.length && arr[j].price > price) j++; }
    else { while (j < arr.length && arr[j].price < price) j++; }
    arr.splice(j, 0, lvl);
    return lvl;
  }
  function prune() {
    for (let i = bids.length - 1; i >= 0; i--) if (!bids[i].orders.length) bids.splice(i, 1);
    for (let i = asks.length - 1; i >= 0; i--) if (!asks[i].orders.length) asks.splice(i, 1);
  }
  const bestBid = () => (bids.length ? bids[0].price : null);
  const bestAsk = () => (asks.length ? asks[0].price : null);

  function submit(order) {
    let remaining = Math.floor(order.lot) || 0;
    const trades = [];
    if (remaining <= 0) return { trades, restingLot: 0, restId: null };
    const opp = order.side === 'buy' ? asks : bids;
    const crosses = (lvlPrice) => {
      if (order.price == null) return true; // market takes any
      return order.side === 'buy' ? order.price >= lvlPrice : order.price <= lvlPrice;
    };

    while (remaining > 0 && opp.length && crosses(opp[0].price)) {
      const lvl = opp[0];
      while (remaining > 0 && lvl.orders.length) {
        const resting = lvl.orders[0]; // price-time priority: oldest first
        const fill = Math.min(remaining, resting.lot);
        trades.push({
          price: lvl.price,
          lot: fill,
          buyOwner: order.side === 'buy' ? order.owner : resting.owner,
          sellOwner: order.side === 'sell' ? order.owner : resting.owner,
        });
        resting.lot -= fill;
        remaining -= fill;
        last = lvl.price;
        if (resting.lot === 0) lvl.orders.shift();
      }
      if (!lvl.orders.length) opp.shift();
    }
    prune();

    let restId = null;
    if (remaining > 0 && order.price != null) {
      restId = ++seq;
      levelFor(order.side, order.price).orders.push({ id: restId, lot: remaining, owner: order.owner, seq: ++seq });
    }
    return { trades, restingLot: order.price == null ? 0 : remaining, restId };
  }

  function cancel(id) {
    for (const arr of [bids, asks]) {
      for (const lvl of arr) {
        const i = lvl.orders.findIndex((o) => o.id === id);
        if (i >= 0) { lvl.orders.splice(i, 1); prune(); return true; }
      }
    }
    return false;
  }

  function depth(n) {
    const map = (arr) => arr.slice(0, n || 7).map((l) => ({
      price: l.price,
      lot: l.orders.reduce((s, o) => s + o.lot, 0),
    }));
    return { bids: map(bids), asks: map(asks) };
  }

  return {
    submit,
    cancel,
    depth,
    bestBid,
    bestAsk,
    tick,
    get last() { return last; },
    set last(v) { last = v; },
  };
}

if (typeof window !== 'undefined') {
  Object.assign(window, { createBook, tickSizeFor, roundToTick });
}
