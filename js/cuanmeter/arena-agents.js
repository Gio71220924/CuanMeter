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
    let maintenanceCursor = 0;

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
          orderIds: [],
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
      const firstOffset = clamp(Math.round(baseSpread * spreadFactor), 1, 2);
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
        const ids = Array.isArray(slot.orderIds) ? slot.orderIds : [];
        const liveOrders = ids
          .map((id) => context.book.inspectOrder(id))
          .filter(Boolean);
        const restingLot = liveOrders.reduce((sum, order) => sum + order.lot, 0);
        const head = liveOrders[0] || null;
        const nextPrice = desiredPrice(slot, context);
        const stale = ids.length
          && context.simNow - slot.lastRefreshAt >= slot.staleAfterMs;
        const depleted = restingLot < Math.max(1, slot.targetLot * 0.35);
        const moved = head
          && Math.abs(head.price - nextPrice) >= context.tick;

        if (ids.length && !stale && !depleted && !moved) {
          slot.targetPrice = head ? head.price : nextPrice;
          continue;
        }

        for (const id of ids) context.book.cancel(id);

        // Split the level into several smaller orders so Freq reflects many
        // participants instead of one giant order. Kept modest because the
        // book now maintains many more price levels (deeper, contiguous depth).
        const pieces = randomInteger(random, 3, 6);
        const base = Math.max(1, Math.floor(slot.targetLot / pieces));
        let remaining = slot.targetLot;
        slot.orderIds = [];
        for (let piece = 0; piece < pieces && remaining > 0; piece += 1) {
          const jitter = randomInteger(random, -Math.floor(base * 0.4), Math.floor(base * 0.4));
          const lot = piece === pieces - 1
            ? remaining
            : Math.min(remaining, Math.max(1, base + jitter));
          remaining -= lot;
          const result = context.submitSynthetic({
            side: slot.side,
            price: nextPrice,
            lot,
            owner: slot.key,
          });
          if (result.restId != null) slot.orderIds.push(result.restId);
          trades.push(...result.trades);
        }
        slot.orderId = slot.orderIds[0] || null;
        slot.targetPrice = nextPrice;
        slot.lastRefreshAt = context.simNow;
        changed = true;
      }

      return { changed, trades };
    }

    function liveSlotOrders(slot, context) {
      const liveOrders = (Array.isArray(slot.orderIds) ? slot.orderIds : [])
        .map((id) => context.book.inspectOrder(id))
        .filter(Boolean);
      slot.orderIds = liveOrders.map((order) => order.id);
      slot.orderId = slot.orderIds[0] || null;
      return liveOrders;
    }

    function moveOne(slot, liveOrders, nextPrice, context) {
      const order = liveOrders.find((candidate) => candidate.price !== nextPrice);
      if (!order) return null;
      const result = context.book.amend(order.id, { price: nextPrice });
      const index = slot.orderIds.indexOf(order.id);
      if (index >= 0) {
        if (result.restId == null) slot.orderIds.splice(index, 1);
        else slot.orderIds[index] = result.restId;
      }
      slot.orderId = slot.orderIds[0] || null;
      slot.targetPrice = nextPrice;
      slot.lastRefreshAt = context.simNow;
      return {
        changed: result.changed,
        trades: result.trades,
        side: slot.side,
        price: nextPrice,
        lot: order.lot,
        orderId: result.restId,
      };
    }

    function maintainOne(context) {
      for (let attempt = 0; attempt < slots.length; attempt += 1) {
        const index = (maintenanceCursor + attempt) % slots.length;
        const slot = slots[index];
        const liveOrders = liveSlotOrders(slot, context);

        const restingLot = liveOrders.reduce((sum, order) => sum + order.lot, 0);
        if (restingLot >= slot.targetLot) continue;

        const nextPrice = liveOrders[0]
          ? liveOrders[0].price
          : desiredPrice(slot, context);
        const lot = slot.targetLot - restingLot;
        const result = context.submitSynthetic({
          side: slot.side,
          price: nextPrice,
          lot,
          owner: slot.key,
        });
        if (result.restId != null) slot.orderIds.push(result.restId);
        slot.orderId = slot.orderIds[0] || null;
        slot.targetPrice = nextPrice;
        slot.lastRefreshAt = context.simNow;
        maintenanceCursor = (index + 1) % slots.length;
        return {
          changed: result.restId != null || result.trades.length > 0,
          trades: result.trades,
          side: slot.side,
          price: nextPrice,
          lot,
          orderId: result.restId,
        };
      }

      for (let attempt = 0; attempt < slots.length; attempt += 1) {
        const index = (maintenanceCursor + attempt) % slots.length;
        const slot = slots[index];
        const liveOrders = liveSlotOrders(slot, context);
        if (!liveOrders.length) continue;
        const moved = moveOne(
          slot,
          liveOrders,
          desiredPrice(slot, context),
          context,
        );
        if (!moved) continue;
        maintenanceCursor = (index + 1) % slots.length;
        return moved;
      }

      return {
        changed: false,
        trades: [],
        side: null,
        price: null,
        lot: 0,
        orderId: null,
      };
    }

    function repairSide(slot, nextPrice, context, protectedPrices = null) {
      const liveOrders = liveSlotOrders(slot, context);
      const movableOrders = protectedPrices
        ? liveOrders.filter((order) => !protectedPrices.has(order.price))
        : liveOrders;
      const moved = moveOne(slot, movableOrders, nextPrice, context);
      if (moved) return moved;

      const donorSlots = slots
        .filter((candidate) => candidate.side === slot.side && candidate !== slot)
        .sort((left, right) => right.level - left.level);
      for (const donor of donorSlots) {
        const donorOrders = liveSlotOrders(donor, context)
          .filter((order) => !protectedPrices || !protectedPrices.has(order.price));
        const donorMove = moveOne(donor, donorOrders, nextPrice, context);
        if (donorMove) return donorMove;
      }

      const lot = Math.max(1, Math.round(slot.targetLot * 0.25));
      let result = context.submitSynthetic({
        side: slot.side,
        price: nextPrice,
        lot,
        owner: slot.key,
      });
      if (result.restId == null) {
        const last = Number(context.book.last) || nextPrice;
        const removable = context.book.restingOrders()
          .filter((order) => (
            order.owner !== 'user'
            && (!protectedPrices || !protectedPrices.has(order.price))
          ))
          .sort((left, right) => (
            Math.abs(right.price - last) - Math.abs(left.price - last)
          ))[0];
        if (removable) {
          context.book.cancel(removable.id);
          result = context.submitSynthetic({
            side: slot.side,
            price: nextPrice,
            lot,
            owner: slot.key,
          });
        }
      }
      if (result.restId != null) slot.orderIds.push(result.restId);
      slot.orderId = slot.orderIds[0] || null;
      slot.targetPrice = nextPrice;
      slot.lastRefreshAt = context.simNow;
      return {
        changed: result.restId != null || result.trades.length > 0,
        trades: result.trades,
        side: slot.side,
        price: nextPrice,
        lot,
        orderId: result.restId,
      };
    }

    function repairSpread(context) {
      const bestBid = context.book.bestBid();
      const bestAsk = context.book.bestAsk();
      const last = Number(context.book.last) || Number(context.getFairValue()) || 50;
      const bidSlot = slots.find((slot) => slot.side === 'buy' && slot.level === 0);
      const askSlot = slots.find((slot) => slot.side === 'sell' && slot.level === 0);
      if (bestBid == null) {
        return repairSide(
          bidSlot,
          context.roundPrice(last - context.tick, 'floor'),
          context,
        );
      }
      if (bestAsk == null) {
        return repairSide(
          askSlot,
          context.roundPrice(last + context.tick, 'ceil'),
          context,
        );
      }

      const spreadFactor = Math.max(
        0.5,
        Number(context.regime && context.regime.spreadFactor) || 1,
      );
      const maximumTicks = clamp(
        Math.round(baseSpread * spreadFactor) * 2,
        1,
        3,
      );
      if (bestAsk - bestBid <= maximumTicks * context.tick) {
        return {
          changed: false,
          trades: [],
          side: null,
          price: null,
          lot: 0,
          orderId: null,
        };
      }

      const repairBid = last - bestBid >= bestAsk - last;
      const bidPrice = context.roundPrice(
        bestAsk - (maximumTicks * context.tick),
        'ceil',
      );
      const askPrice = context.roundPrice(
        bestBid + (maximumTicks * context.tick),
        'floor',
      );
      const slot = repairBid ? bidSlot : askSlot;
      const nextPrice = repairBid ? bidPrice : askPrice;
      return repairSide(slot, nextPrice, context);
    }

    function repairLadder(context, minimumLevels = levelCount) {
      let changed = false;
      const trades = [];

      for (const side of ['buy', 'sell']) {
        const direction = side === 'buy' ? -1 : 1;
        const getNextPrice = direction < 0
          ? context.previousPrice
          : context.nextPrice;
        let bestPrice = side === 'buy'
          ? context.book.bestBid()
          : context.book.bestAsk();
        if (bestPrice == null) continue;

        const expectedPrices = [bestPrice];
        while (expectedPrices.length < minimumLevels) {
          const nextPrice = getNextPrice(expectedPrices[expectedPrices.length - 1]);
          if (
            nextPrice === expectedPrices[expectedPrices.length - 1]
            || nextPrice < context.minimumPrice
            || nextPrice > context.maximumPrice
          ) break;
          expectedPrices.push(nextPrice);
        }
        const protectedPrices = new Set(expectedPrices);

        for (let levelIndex = 1; levelIndex < expectedPrices.length; levelIndex += 1) {
          const expectedPrice = expectedPrices[levelIndex];
          const depth = context.book.depth(Math.max(minimumLevels * 2, levelCount));
          const levels = side === 'buy' ? depth.bids : depth.asks;
          if (levels.some((level) => level.price === expectedPrice)) continue;

          let donor = null;
          for (const slot of slots.filter((candidate) => candidate.side === side)) {
            const liveOrders = liveSlotOrders(slot, context);
            for (const order of liveOrders) {
              if (protectedPrices.has(order.price)) continue;
              const distance = Math.abs(order.price - bestPrice);
              if (!donor || distance > donor.distance) {
                donor = { slot, order, distance };
              }
            }
          }
          if (!donor) {
            const slot = slots.find((candidate) => (
              candidate.side === side && candidate.level === levelIndex
            )) || slots.find((candidate) => candidate.side === side);
            const result = repairSide(
              slot,
              expectedPrice,
              context,
              protectedPrices,
            );
            changed ||= result.changed;
            trades.push(...result.trades);
            continue;
          }

          const result = context.book.amend(donor.order.id, {
            price: expectedPrice,
          });
          const orderIndex = donor.slot.orderIds.indexOf(donor.order.id);
          if (orderIndex >= 0) {
            if (result.restId == null) donor.slot.orderIds.splice(orderIndex, 1);
            else donor.slot.orderIds[orderIndex] = result.restId;
          }
          donor.slot.orderId = donor.slot.orderIds[0] || null;
          donor.slot.targetPrice = expectedPrice;
          donor.slot.lastRefreshAt = context.simNow;
          changed ||= result.changed;
          trades.push(...result.trades);
        }
      }

      return { changed, trades };
    }

    function clear(context) {
      const cancelled = context.book.cancelByOwnerPrefix('mm:');
      for (const slot of slots) {
        slot.orderId = null;
        slot.orderIds = [];
        slot.targetPrice = null;
      }
      return cancelled;
    }

    return {
      step,
      maintainOne,
      repairSpread,
      repairLadder,
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

      const tick = Math.max(1, Number(context.tick) || 1);
      const bestBid = context.book.bestBid();
      const bestAsk = context.book.bestAsk();
      const midpoint = Number.isFinite(bestBid) && Number.isFinite(bestAsk)
        ? (bestBid + bestAsk) / 2
        : Number(context.book.last) || 0;
      const fair = Number(context.getFairValue()) || midpoint;
      const fairPull = clamp(midpoint ? ((fair - midpoint) / tick) * 0.18 : 0, -0.34, 0.34);
      const buyProbability = clamp(
        0.5 + (Number(context.regime.bias) || 0) + fairPull,
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

  function createOrderFlowAgent({
    profile,
    rng = Math.random,
  } = {}) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const marketProfile = profile || {};
    let sequence = 0;

    function chooseSide(context) {
      const bias = Number(context.regime && context.regime.bias) || 0;
      // Pull taker side toward the OU fair value: when fair value sits above
      // the book midpoint, buyers lift offers (and vice-versa). This makes
      // order flow trend in runs instead of alternating bid/ask each print.
      const tick = Math.max(1, Number(context.tick) || 1);
      const bestBid = context.book.bestBid();
      const bestAsk = context.book.bestAsk();
      const midpoint = Number.isFinite(bestBid) && Number.isFinite(bestAsk)
        ? (bestBid + bestAsk) / 2
        : Number(context.book.last) || 0;
      const fair = Number(context.getFairValue()) || midpoint;
      const gapTicks = midpoint ? (fair - midpoint) / tick : 0;
      const fairPull = clamp(gapTicks * 0.2, -0.38, 0.38);
      const buyChance = clamp(0.5 + bias + fairPull, 0.06, 0.94);
      return random() < buyChance ? 'buy' : 'sell';
    }

    function ordinaryOrders(context) {
      return context.book.restingOrders().filter((order) => (
        order.owner !== 'user'
        && /^(mm:|retail:|flow:|seed:)/.test(order.owner)
      ));
    }

    function chooseOrder(context) {
      const orders = ordinaryOrders(context);
      if (!orders.length) return null;
      return orders[Math.min(
        orders.length - 1,
        Math.floor(random() * orders.length),
      )];
    }

    function eventResult(type, details = {}) {
      const trades = Array.isArray(details.trades) ? details.trades : [];
      return {
        type,
        changed: Boolean(details.changed || trades.length),
        trades,
        side: details.side || null,
        price: Number.isFinite(Number(details.price)) ? Number(details.price) : null,
        lot: Math.max(0, Math.floor(Number(details.lot)) || 0),
        orderId: details.orderId == null ? null : details.orderId,
      };
    }

    function addPassive(context) {
      const side = chooseSide(context);
      const tick = Math.max(1, Number(context.tick) || 1);
      const reference = Number(context.getFairValue()) || Number(context.book.last) || 0;
      const levels = Math.max(2, Math.floor(marketProfile.depthLevels) || 8);
      const offset = randomInteger(random, 1, levels);
      const direction = side === 'buy' ? -1 : 1;
      let price = context.roundPrice(
        reference + (direction * offset * tick),
        side === 'buy' ? 'floor' : 'ceil',
      );

      if (side === 'buy' && context.book.bestAsk() != null) {
        price = context.roundPrice(
          Math.min(price, context.book.bestAsk() - tick),
          'floor',
        );
      }
      if (side === 'sell' && context.book.bestBid() != null) {
        price = context.roundPrice(
          Math.max(price, context.book.bestBid() + tick),
          'ceil',
        );
      }

      const minimum = Math.max(1, Math.floor(marketProfile.baseLotMin) || 1);
      const maximum = Math.max(
        minimum,
        Math.floor(marketProfile.baseLotMax) || minimum,
        Math.round((Number(marketProfile.depthLotMin) || minimum) * 0.12),
      );
      const lot = randomInteger(random, minimum, maximum);
      sequence += 1;
      const result = context.submitSynthetic({
        side,
        price,
        lot,
        owner: `flow:add:${sequence}`,
      });
      return eventResult('ADD', {
        changed: result.restId != null || result.trades.length > 0,
        trades: result.trades,
        side,
        price,
        lot,
        orderId: result.restId,
      });
    }

    function cancelOne(context) {
      const order = chooseOrder(context);
      if (!order) return addPassive(context);
      const changed = context.book.cancel(order.id);
      return eventResult('CANCEL', {
        changed,
        side: order.side,
        price: order.price,
        lot: order.lot,
        orderId: order.id,
      });
    }

    function amendOne(context) {
      const order = chooseOrder(context);
      if (!order) return addPassive(context);
      const magnitude = Math.max(1, Math.round(order.lot * (0.08 + random() * 0.22)));
      const increase = random() >= 0.55;
      const nextLot = increase
        ? order.lot + magnitude
        : Math.max(1, order.lot - magnitude);
      const result = context.book.amend(order.id, { lot: nextLot });
      return eventResult('AMEND', {
        changed: result.changed,
        trades: result.trades,
        side: order.side,
        price: order.price,
        lot: nextLot,
        orderId: result.restId,
      });
    }

    function match(context) {
      const side = chooseSide(context);
      const mediumChance = clamp(
        Number(marketProfile.mediumTradeChance) || 0,
        0,
        1,
      );
      const maximum = random() < mediumChance
        ? Math.max(8, Math.min(80, Math.floor(marketProfile.baseLotMax) || 20))
        : 8;
      const lot = randomInteger(random, 1, maximum);
      sequence += 1;
      const result = context.submitSynthetic({
        side,
        price: null,
        lot,
        owner: `flow:match:${sequence}`,
      });
      const price = result.trades.length
        ? result.trades[result.trades.length - 1].price
        : null;
      return eventResult('MATCH', {
        changed: result.trades.length > 0,
        trades: result.trades,
        side,
        price,
        lot,
      });
    }

    function sweep(context) {
      const side = chooseSide(context);
      const depth = context.book.depth(8);
      const opposing = side === 'buy' ? depth.asks : depth.bids;
      if (!opposing.length) return addPassive(context);
      const fullLevels = Math.min(2, Math.max(0, opposing.length - 4));
      let lot = opposing
        .slice(0, fullLevels)
        .reduce((sum, level) => sum + level.lot, 0);
      const partialLevel = opposing[fullLevels];
      if (partialLevel && partialLevel.lot > 1) {
        lot += Math.max(1, Math.floor(partialLevel.lot * 0.35));
      }
      if (lot <= 0) return match(context);
      sequence += 1;
      const result = context.submitSynthetic({
        side,
        price: null,
        lot,
        owner: `flow:sweep:${sequence}`,
      });
      const price = result.trades.length
        ? result.trades[result.trades.length - 1].price
        : null;
      return eventResult('SWEEP', {
        changed: result.trades.length > 0,
        trades: result.trades,
        side,
        price,
        lot,
      });
    }

    return {
      addPassive,
      amendOne,
      cancelOne,
      match,
      sweep,
    };
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
    createOrderFlowAgent,
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
