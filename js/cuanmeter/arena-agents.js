(function () {
  'use strict';

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function randomInteger(rng, minimum, maximum) {
    const low = Math.ceil(minimum);
    const high = Math.floor(maximum);
    return low + Math.floor(rng() * (high - low + 1));
  }

  function createMarketMakerAgent({
    profile,
    rng = Math.random,
  } = {}) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const marketProfile = profile || {};
    const levelCount = Math.max(1, Math.floor(marketProfile.depthLevels) || 8);
    const minimumLot = Math.max(
      1,
      Math.floor(marketProfile.depthLotMin)
        || Math.floor(marketProfile.baseLotMin)
        || 1,
    );
    const maximumLot = Math.max(
      minimumLot,
      Math.floor(marketProfile.depthLotMax)
        || Math.floor(marketProfile.baseLotMax)
        || minimumLot,
    );
    const lotRange = maximumLot - minimumLot + 1;
    const spreadRange = Array.isArray(marketProfile.spreadTicks)
      ? marketProfile.spreadTicks
      : [1, 1];
    const baseSpread = randomInteger(
      random,
      Math.max(1, spreadRange[0] || 1),
      Math.max(1, spreadRange[1] || spreadRange[0] || 1),
    );
    const slots = [];

    for (const side of ['buy', 'sell']) {
      for (let level = 0; level < levelCount; level += 1) {
        const sideName = side === 'buy' ? 'bid' : 'ask';
        const sampledLot = randomInteger(random, minimumLot, maximumLot);
        const sideOffset = side === 'buy' ? 0 : levelCount;
        const targetLot = minimumLot
          + ((sampledLot - minimumLot + level + sideOffset) % lotRange);
        slots.push({
          key: `mm:${sideName}:${level}`,
          side,
          level,
          orderId: null,
          targetPrice: null,
          targetLot,
          lastRefreshAt: 0,
          staleAfterMs: randomInteger(random, 18_000, 32_000),
        });
      }
    }

    function desiredPrice(slot, context) {
      const fairValue = context.roundPrice(context.getFairValue(), 'nearest');
      const spreadFactor = Math.max(0.5, Number(context.regime.spreadFactor) || 1);
      const firstOffset = Math.max(1, Math.round(baseSpread * spreadFactor));
      const offset = firstOffset + slot.level;
      const signedOffset = slot.side === 'buy' ? -offset : offset;
      const mode = slot.side === 'buy' ? 'floor' : 'ceil';
      const candidate = context.roundPrice(
        fairValue + (signedOffset * context.tick),
        mode,
      );

      if (slot.side === 'buy') {
        const bestAsk = context.book.bestAsk();
        const ceiling = bestAsk == null ? fairValue - context.tick : bestAsk - context.tick;
        return context.roundPrice(Math.min(candidate, ceiling), 'floor');
      }

      const bestBid = context.book.bestBid();
      const floor = bestBid == null ? fairValue + context.tick : bestBid + context.tick;
      return context.roundPrice(Math.max(candidate, floor), 'ceil');
    }

    function step(context) {
      let changed = false;
      const trades = [];

      for (const slot of slots) {
        const existing = slot.orderId == null
          ? null
          : context.book.inspectOrder(slot.orderId);
        const nextPrice = desiredPrice(slot, context);
        const stale = existing
          && context.simNow - slot.lastRefreshAt >= slot.staleAfterMs;
        const depleted = existing
          && existing.lot < Math.max(1, slot.targetLot * 0.35);
        const moved = existing
          && Math.abs(existing.price - nextPrice) >= context.tick;

        if (existing && !stale && !depleted && !moved) {
          slot.targetPrice = existing.price;
          continue;
        }

        if (existing) context.book.cancel(existing.id);

        const result = context.submitSynthetic({
          side: slot.side,
          price: nextPrice,
          lot: slot.targetLot,
          owner: slot.key,
        });
        slot.orderId = result.restId;
        slot.targetPrice = nextPrice;
        slot.lastRefreshAt = context.simNow;
        trades.push(...result.trades);
        changed = true;
      }

      return { changed, trades };
    }

    function clear(context) {
      const cancelled = context.book.cancelByOwnerPrefix('mm:');
      for (const slot of slots) {
        slot.orderId = null;
        slot.targetPrice = null;
      }
      return cancelled;
    }

    return {
      step,
      clear,
      slots,
    };
  }

  function createRetailAgent({
    profile,
    rng = Math.random,
  } = {}) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const marketProfile = profile || {};
    const maximumPassiveOrders = Math.max(
      12,
      (Math.floor(marketProfile.depthLevels) || 8) * 3,
    );
    let passiveOrderIds = [];
    let sequence = 0;

    function step(context) {
      const activity = Math.max(0, Number(context.regime.activity) || 0);
      const retailRate = Math.max(0, Number(marketProfile.retailRate) || 0);
      if (random() > retailRate * activity) {
        return { changed: false, trades: [] };
      }

      const buyProbability = clamp(
        0.5 + (Number(context.regime.bias) || 0),
        0.05,
        0.95,
      );
      const side = random() < buyProbability ? 'buy' : 'sell';
      const mediumChance = clamp(
        Number(marketProfile.mediumTradeChance) || 0,
        0,
        1,
      );
      const isMedium = random() < mediumChance;
      const lot = isMedium
        ? randomInteger(
          random,
          6,
          Math.max(6, Math.min(40, Math.floor(marketProfile.baseLotMax) || 20)),
        )
        : randomInteger(random, 1, 5);
      const aggression = clamp(
        Number(context.regime.aggression) || 0,
        0,
        1,
      );
      const price = random() < aggression
        ? null
        : context.passivePrice(side);

      passiveOrderIds = passiveOrderIds.filter((id) => (
        context.book.inspectOrder(id) != null
      ));
      if (price != null) {
        while (passiveOrderIds.length >= maximumPassiveOrders) {
          context.book.cancel(passiveOrderIds.shift());
        }
      }

      sequence += 1;
      const result = context.submitSynthetic({
        side,
        price,
        lot,
        owner: `retail:${sequence}`,
      });
      if (result.restId != null) passiveOrderIds.push(result.restId);

      return {
        changed: Boolean(result.restId || result.trades.length),
        trades: result.trades,
      };
    }

    return { step };
  }

  function eventNow(stepContext, context) {
    const value = stepContext && Number(stepContext.now);
    return Number.isFinite(value) ? value : Number(context.simNow) || 0;
  }

  function eventId(context) {
    return typeof context.nextEventId === 'function'
      ? context.nextEventId()
      : Math.floor((context.rng || Math.random)() * 1_000_000);
  }

  function pushInsight(context, insight) {
    if (typeof context.pushInsight === 'function') {
      context.pushInsight(insight);
    }
  }

  function nearbyMedian(context, side) {
    if (typeof context.medianDepth === 'function') {
      return Math.max(1, Number(context.medianDepth(side)) || 1);
    }
    const depth = context.book.depth(8);
    const levels = side === 'buy' ? depth.bids : depth.asks;
    const lots = levels.map((level) => level.lot).sort((left, right) => left - right);
    if (!lots.length) return 1;
    const middle = Math.floor(lots.length / 2);
    return lots.length % 2
      ? lots[middle]
      : (lots[middle - 1] + lots[middle]) / 2;
  }

  function createWallAgent(context, options = {}) {
    const random = typeof context.rng === 'function' ? context.rng : Math.random;
    const side = options.side === 'buy' ? 'buy' : 'sell';
    const id = eventId(context);
    const owner = `wall:${side}:${id}`;
    const price = Number(options.price);
    const lifetimeMs = Math.max(2_000, Number(options.lifetimeMs) || 10_000);
    const initialLot = Math.max(
      1,
      Math.floor(Number(options.lot))
        || Math.ceil(nearbyMedian(context, side) * (4 + random() * 3)),
    );
    let state = 'pending';
    let orderId = null;
    let startedAt = null;
    let expiresAt = null;
    let insightSent = false;

    function finish(now, finalState) {
      const existing = orderId == null ? null : context.book.inspectOrder(orderId);
      if (existing) context.book.cancel(existing.id);
      state = finalState;
      if (!insightSent) {
        pushInsight(context, {
          id,
          category: 'wall',
          side,
          simTime: now,
          message: `Tembok ${side === 'buy' ? 'bid' : 'offer'} besar bertahan lalu menghilang dari antrean.`,
        });
        insightSent = true;
      }
    }

    function step(stepContext) {
      const now = eventNow(stepContext, context);
      if (state === 'pending') {
        const result = context.submitSynthetic({
          side,
          price,
          lot: initialLot,
          owner,
        });
        orderId = result.restId;
        startedAt = now;
        expiresAt = now + lifetimeMs;
        state = orderId == null ? 'filled' : 'resting';
        return {
          changed: Boolean(result.restId || result.trades.length),
          trades: result.trades,
          done: orderId == null,
          state,
        };
      }

      if (['expired', 'filled', 'moved'].includes(state)) {
        return { changed: false, trades: [], done: true, state };
      }

      const existing = orderId == null ? null : context.book.inspectOrder(orderId);
      if (!existing) {
        state = 'filled';
        return { changed: true, trades: [], done: true, state };
      }
      if (existing.lot < initialLot) state = 'partially-filled';

      if (now >= expiresAt) {
        finish(now, 'expired');
        return { changed: true, trades: [], done: true, state };
      }

      return { changed: false, trades: [], done: false, state };
    }

    return {
      owner,
      step,
      finish({ now } = {}) {
        finish(eventNow({ now }, context), 'expired');
      },
      get state() {
        return state;
      },
      get startedAt() {
        return startedAt;
      },
    };
  }

  function createSpoofAgent(context, options = {}) {
    const random = typeof context.rng === 'function' ? context.rng : Math.random;
    const side = options.side === 'buy' ? 'buy' : 'sell';
    const id = eventId(context);
    const owner = `spoof:${side}:${id}`;
    const price = Number(options.price);
    const lifetimeMs = Math.max(2_000, Number(options.lifetimeMs) || 5_000);
    const initialLot = Math.max(
      1,
      Math.floor(Number(options.lot))
        || Math.ceil(nearbyMedian(context, side) * (5 + random() * 3)),
    );
    let state = 'pending';
    let orderId = null;
    let startedAt = null;
    let expiresAt = null;
    let insightSent = false;

    function withdraw(now) {
      const existing = orderId == null ? null : context.book.inspectOrder(orderId);
      const remaining = existing ? existing.lot : 0;
      const executedRatio = (initialLot - remaining) / initialLot;
      if (existing) context.book.cancel(existing.id);
      state = 'withdrawn';

      if (
        !insightSent
        && now - startedAt >= 2_000
        && executedRatio < 0.2
      ) {
        pushInsight(context, {
          id,
          category: 'spoof',
          side,
          simTime: now,
          message: `Indikasi spoofing: antrean ${side === 'buy' ? 'bid' : 'offer'} besar ditarik sebelum banyak tereksekusi.`,
        });
        insightSent = true;
      }
    }

    function step(stepContext) {
      const now = eventNow(stepContext, context);
      if (state === 'pending') {
        const result = context.submitSynthetic({
          side,
          price,
          lot: initialLot,
          owner,
        });
        orderId = result.restId;
        startedAt = now;
        expiresAt = now + lifetimeMs;
        state = orderId == null ? 'withdrawn' : 'resting';
        return {
          changed: Boolean(result.restId || result.trades.length),
          trades: result.trades,
          done: orderId == null,
          state,
        };
      }

      if (state === 'withdrawn') {
        return { changed: false, trades: [], done: true, state };
      }

      const existing = orderId == null ? null : context.book.inspectOrder(orderId);
      if (!existing) {
        state = 'withdrawn';
        return { changed: true, trades: [], done: true, state };
      }

      const reference = context.book.last || price;
      const riskDistance = Math.max(1, Number(options.riskTicks) || 1)
        * Math.max(1, Number(context.tick) || 1);
      const executionRisk = side === 'sell'
        ? reference >= price - riskDistance
        : reference <= price + riskDistance;

      if (now >= expiresAt || (executionRisk && now - startedAt >= 2_000)) {
        withdraw(now);
        return { changed: true, trades: [], done: true, state };
      }

      return { changed: false, trades: [], done: false, state };
    }

    return {
      owner,
      step,
      finish({ now } = {}) {
        if (state !== 'withdrawn') withdraw(eventNow({ now }, context));
      },
      get state() {
        return state;
      },
    };
  }

  function createIcebergAgent(context, options = {}) {
    const side = options.side === 'buy' ? 'buy' : 'sell';
    const id = eventId(context);
    const owner = `iceberg:${side}:${id}`;
    const price = Number(options.price);
    const visibleLot = Math.max(1, Math.floor(Number(options.visibleLot)) || 10);
    const lifetimeMs = Math.max(3_000, Number(options.lifetimeMs) || 20_000);
    let hiddenRemaining = Math.max(
      0,
      Math.floor(Number(options.hiddenLot)) || visibleLot * 4,
    );
    let currentOrderId = null;
    let replenishments = 0;
    let startedAt = null;
    let expiresAt = null;
    let finished = false;
    let insightSent = false;

    function submitSlice(now, isReplenishment) {
      const slice = isReplenishment
        ? Math.min(visibleLot, hiddenRemaining)
        : visibleLot;
      if (slice <= 0) return { changed: false, trades: [] };
      if (isReplenishment) {
        hiddenRemaining -= slice;
        replenishments += 1;
      }
      const result = context.submitSynthetic({
        side,
        price,
        lot: slice,
        owner,
      });
      currentOrderId = result.restId;
      if (startedAt == null) {
        startedAt = now;
        expiresAt = now + lifetimeMs;
      }
      return {
        changed: Boolean(result.restId || result.trades.length),
        trades: result.trades,
      };
    }

    function complete(now) {
      if (finished) return;
      const existing = currentOrderId == null
        ? null
        : context.book.inspectOrder(currentOrderId);
      if (existing) context.book.cancel(existing.id);
      finished = true;
      if (!insightSent && replenishments >= 2) {
        pushInsight(context, {
          id,
          category: 'iceberg',
          side,
          simTime: now,
          message: `Indikasi iceberg: order ${side === 'buy' ? 'bid' : 'offer'} di harga yang sama berulang kali terisi ulang.`,
        });
        insightSent = true;
      }
    }

    function step(stepContext) {
      const now = eventNow(stepContext, context);
      if (finished) {
        return { changed: false, trades: [], done: true, state: 'finished' };
      }
      if (startedAt == null) {
        const initial = submitSlice(now, false);
        return { ...initial, done: false, state: 'resting' };
      }
      if (now >= expiresAt) {
        complete(now);
        return { changed: true, trades: [], done: true, state: 'expired' };
      }

      const existing = currentOrderId == null
        ? null
        : context.book.inspectOrder(currentOrderId);
      const depleted = !existing || existing.lot <= visibleLot * 0.25;
      if (depleted && hiddenRemaining > 0) {
        if (existing) context.book.cancel(existing.id);
        const refill = submitSlice(now, true);
        return { ...refill, done: false, state: 'replenished' };
      }
      if (!existing && hiddenRemaining <= 0) {
        complete(now);
        return { changed: true, trades: [], done: true, state: 'filled' };
      }

      return { changed: false, trades: [], done: false, state: 'resting' };
    }

    return {
      owner,
      step,
      finish({ now } = {}) {
        complete(eventNow({ now }, context));
      },
      get replenishments() {
        return replenishments;
      },
      get hiddenRemaining() {
        return hiddenRemaining;
      },
    };
  }

  function createMomentumAgent({
    profile,
    rng = Math.random,
  } = {}) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const prices = [];
    let sequence = 0;

    function step(context) {
      const latest = Number(context.book.last) || Number(context.getFairValue()) || 0;
      prices.push(latest);
      if (prices.length > 12) prices.shift();
      if (prices.length < 3) return { changed: false, trades: [] };

      const move = latest - prices[0];
      const threshold = Math.max(1, Number(context.tick) || 1) * 2;
      if (Math.abs(move) < threshold) return { changed: false, trades: [] };
      if (random() > Math.max(0, Number(context.regime.activity) || 0)) {
        return { changed: false, trades: [] };
      }

      let side = move > 0 ? 'buy' : 'sell';
      if (context.regime.id === 'panic_buy') side = 'buy';
      if (context.regime.id === 'panic_sell') side = 'sell';
      const maximum = Math.max(4, Math.floor((profile && profile.baseLotMax) || 20));
      const lot = randomInteger(random, 2, Math.min(18, maximum));
      sequence += 1;
      const result = context.submitSynthetic({
        side,
        price: null,
        lot,
        owner: `momentum:${sequence}`,
      });
      return {
        changed: result.trades.length > 0,
        trades: result.trades,
      };
    }

    return { step, prices };
  }

  function createWhaleAgent(context, options = {}) {
    const random = typeof context.rng === 'function' ? context.rng : Math.random;
    const side = options.side === 'buy' ? 'buy' : 'sell';
    const id = eventId(context);
    const medianLot = nearbyMedian(context, side);
    const profileMaximum = Math.max(
      1,
      Number(context.profile && context.profile.baseLotMax) || 1,
    );
    const lot = Math.max(
      profileMaximum,
      Math.round(medianLot * (2.5 + random() * 3.5)),
    );
    let done = false;

    function step() {
      if (done) return { changed: false, trades: [], done: true, state: 'filled' };
      done = true;
      const result = context.submitSynthetic({
        side,
        price: null,
        lot,
        owner: `whale:${side}:${id}`,
      });
      pushInsight(context, {
        id,
        category: 'sweep',
        side,
        simTime: Number(context.simNow) || 0,
        message: `Whale sweep ${side === 'buy' ? 'mengangkat offer' : 'menghantam bid'} beberapa level sekaligus.`,
      });
      return {
        changed: result.trades.length > 0,
        trades: result.trades,
        done: true,
        state: 'filled',
      };
    }

    return { step, owner: `whale:${side}:${id}` };
  }

  const api = {
    createIcebergAgent,
    createMarketMakerAgent,
    createMomentumAgent,
    createRetailAgent,
    createSpoofAgent,
    createWallAgent,
    createWhaleAgent,
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}());
