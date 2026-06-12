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
function normalizeOwner(owner) {
  if (typeof owner === 'string') return owner;
  if (owner == null) return '';
  return String(owner);
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
    const owner = normalizeOwner(order.owner);
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
          aggressor: order.side, // taker side that crossed the spread
          buyOwner: order.side === 'buy' ? owner : resting.owner,
          sellOwner: order.side === 'sell' ? owner : resting.owner,
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
      levelFor(order.side, order.price).orders.push({ id: restId, lot: remaining, owner, seq: ++seq });
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

  function amend(id, changes = {}) {
    for (const [side, levels] of [['buy', bids], ['sell', asks]]) {
      for (const level of levels) {
        const index = level.orders.findIndex((order) => order.id === id);
        if (index < 0) continue;

        const order = level.orders[index];
        const requestedLot = changes.lot == null
          ? order.lot
          : Math.floor(Number(changes.lot)) || 0;
        const requestedPrice = changes.price == null
          ? level.price
          : Number(changes.price);

        if (requestedLot <= 0) {
          level.orders.splice(index, 1);
          prune();
          return { changed: true, restId: null, trades: [] };
        }

        if (requestedPrice === level.price && requestedLot <= order.lot) {
          if (requestedLot === order.lot) {
            return { changed: false, restId: order.id, trades: [] };
          }
          order.lot = requestedLot;
          return { changed: true, restId: order.id, trades: [] };
        }

        const replacement = {
          side,
          price: requestedPrice,
          lot: requestedLot,
          owner: order.owner,
        };
        level.orders.splice(index, 1);
        prune();
        const result = submit(replacement);
        return {
          changed: true,
          restId: result.restId,
          trades: result.trades,
        };
      }
    }

    return { changed: false, restId: null, trades: [] };
  }

  function depth(n) {
    const map = (arr) => arr.slice(0, n || 7).map((l) => ({
      price: l.price,
      lot: l.orders.reduce((s, o) => s + o.lot, 0),
      freq: l.orders.length, // number of resting orders at this level
    }));
    return { bids: map(bids), asks: map(asks) };
  }

  function restingByOwner(owner) {
    const out = [];
    for (const arr of [bids, asks]) {
      const side = arr === bids ? 'buy' : 'sell';
      for (const lvl of arr) for (const o of lvl.orders) if (o.owner === owner) out.push({ id: o.id, side, price: lvl.price, lot: o.lot });
    }
    return out;
  }

  function restingOrders() {
    const out = [];
    for (const [side, levels] of [['buy', bids], ['sell', asks]]) {
      for (const level of levels) {
        for (const order of level.orders) {
          out.push({
            id: order.id,
            side,
            price: level.price,
            lot: order.lot,
            owner: order.owner,
          });
        }
      }
    }
    return out;
  }

  function inspectOrder(id) {
    return restingOrders().find((order) => order.id === id) || null;
  }

  function lotsAhead(id) {
    for (const levels of [bids, asks]) {
      for (const level of levels) {
        let ahead = 0;
        for (const order of level.orders) {
          if (order.id === id) return ahead;
          ahead += order.lot;
        }
      }
    }
    return null;
  }

  function cancelByOwnerPrefix(prefix) {
    if (typeof prefix !== 'string' || prefix.length === 0) return 0;
    const ids = restingOrders()
      .filter((order) => typeof order.owner === 'string' && order.owner.startsWith(prefix))
      .map((order) => order.id);
    ids.forEach(cancel);
    return ids.length;
  }

  return {
    submit,
    cancel,
    amend,
    depth,
    restingByOwner,
    restingOrders,
    inspectOrder,
    lotsAhead,
    cancelByOwnerPrefix,
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
