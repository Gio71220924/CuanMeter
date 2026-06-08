(function () {
  'use strict';

  const SIM_QUANTUM_MS = 250;
  const MAX_SYNTHETIC_ORDERS = 220;
  const MAX_SPECIAL_EVENTS = 5;
  const MAX_INSIGHTS = 5;

  function isValidArenaPrice(price) {
    return Number.isInteger(price)
      && price >= 50
      && price % tickSizeFor(price) === 0;
  }

  function findValidArenaPrice(price, direction) {
    let candidate = direction < 0 ? Math.floor(price) : Math.ceil(price);
    candidate = Math.max(50, candidate);

    while (!isValidArenaPrice(candidate)) {
      candidate += direction;
      if (candidate <= 50) return 50;
    }
    return candidate;
  }

  function normalizeArenaOrderPrice(price, mode = 'nearest') {
    const source = Number(price);
    if (!Number.isFinite(source) || source <= 50) return 50;

    const floorPrice = findValidArenaPrice(source, -1);
    if (mode === 'floor') return floorPrice;

    const ceilPrice = findValidArenaPrice(source, 1);
    if (mode === 'ceil') return ceilPrice;

    return source - floorPrice < ceilPrice - source
      ? floorPrice
      : ceilPrice;
  }

  function roundToValidTick(price, mode = 'nearest') {
    return normalizeArenaOrderPrice(price, mode);
  }

  function previousArenaPrice(price) {
    const current = normalizeArenaOrderPrice(price);
    if (current <= 50) return 50;
    return findValidArenaPrice(current - 1, -1);
  }

  function nextArenaPrice(price) {
    const current = normalizeArenaOrderPrice(price);
    return findValidArenaPrice(current + 1, 1);
  }

  function buildArenaPriceRows(top, bottom, maxRows = 240) {
    const highest = normalizeArenaOrderPrice(top, 'floor');
    const lowest = normalizeArenaOrderPrice(bottom, 'ceil');
    const limit = Number.isFinite(Number(maxRows))
      ? Math.max(0, Math.floor(Number(maxRows)))
      : 240;
    const rows = [];
    let current = highest;

    while (rows.length < limit && current >= lowest) {
      rows.push(current);
      const previous = previousArenaPrice(current);
      if (previous >= current) break;
      current = previous;
    }
    return rows;
  }

  function calculateDailyBands(previousClose) {
    const araPercentage = previousClose <= 200
      ? 0.35
      : previousClose <= 5_000
        ? 0.25
        : 0.20;
    return {
      ara: roundToValidTick(previousClose * (1 + araPercentage), 'floor'),
      arb: Math.max(
        50,
        roundToValidTick(previousClose * 0.85, 'ceil'),
      ),
    };
  }

  function createMarket(options) {
    const opts = options || {};
    const random = typeof opts.rng === 'function'
      ? opts.rng
      : opts.seed != null
        ? createArenaRng(opts.seed)
        : Math.random;
    const seedInput = Number(opts.seedPrice);
    const seed = Math.max(
      50,
      Number.isFinite(seedInput) && seedInput > 0 ? seedInput : 1_000,
    );
    const preferences = normalizeArenaPreferences({
      profile: opts.profile,
      speed: opts.speed,
    });
    const profile = ARENA_PROFILES[preferences.profile];
    const previousClose = Math.max(50, roundToValidTick(seed, 'nearest'));
    const dailyBands = calculateDailyBands(previousClose);
    const minimumFair = Math.max(
      50,
      roundToValidTick(seed * 0.8, 'ceil'),
      dailyBands.arb,
    );
    const maximumFair = Math.min(
      roundToValidTick(seed * 1.2, 'floor'),
      dailyBands.ara,
    );
    const book = createBook(tickSizeFor(previousClose));
    const schedule = typeof opts.schedule === 'function' ? opts.schedule : setTimeout;
    const cancelSchedule = typeof opts.cancelSchedule === 'function'
      ? opts.cancelSchedule
      : clearTimeout;
    const regimeController = opts.forcedRegime
      ? createFixedRegimeController(opts.forcedRegime)
      : createRegimeController({ rng: random, initial: 'normal', now: 0 });
    let fairValue = Math.max(
      minimumFair,
      Math.min(maximumFair, roundToValidTick(seed, 'nearest')),
    );
    let simNow = 0;
    let speed = preferences.speed;
    let running = false;
    let timer = null;
    let nextEventId = 1;
    let eventSequenceIndex = 0;
    let nextSpecialEventAt = opts.initialSpecialEventAt === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Number.isFinite(Number(opts.initialSpecialEventAt))
        ? Math.max(0, Number(opts.initialSpecialEventAt))
        : profile.specialCooldownMs;
    const specialEvents = [];
    const requestedEventSequence = Array.isArray(opts.specialEventSequence)
      ? opts.specialEventSequence.filter((type) => (
        ['spoof', 'iceberg', 'wall', 'whale'].includes(type)
      ))
      : [];
    const insights = Array.isArray(opts.initialInsights)
      ? opts.initialInsights.map((item) => (
        item && typeof item === 'object' ? { ...item } : item
      )).slice(0, MAX_INSIGHTS)
      : [];
    let lastEvent = {
      type: 'SEED',
      side: null,
      price: fairValue,
      lot: 0,
      tradeCount: 0,
      simTime: 0,
    };

    book.last = fairValue;

    const stats = {
      vol: 0,
      val: 0,
      freq: 0,
      high: book.last,
      low: book.last,
      open: book.last,
      prevClose: previousClose,
      done: {},
    };

    function reportError(error) {
      if (typeof opts.onError !== 'function') return;
      try {
        opts.onError(error);
      } catch (_) {
        // External error handlers must not interrupt the simulation.
      }
    }

    function safeInvoke(callback, ...args) {
      if (typeof callback !== 'function') return;
      try {
        callback(...args);
      } catch (error) {
        reportError(error);
      }
    }

    function recordTrade(trade) {
      stats.vol += trade.lot;
      stats.val += trade.lot * 100 * trade.price;
      stats.freq += 1;
      stats.high = Math.max(stats.high, trade.price);
      stats.low = Math.min(stats.low, trade.price);
      stats.done[trade.price] = (stats.done[trade.price] || 0) + trade.lot;
    }

    function emitTrades(trades) {
      if (!Array.isArray(trades) || !trades.length) return;
      for (const trade of trades) {
        recordTrade(trade);
        safeInvoke(opts.onTrade, trade);
      }
    }

    function syntheticOrderCount() {
      return book.restingOrders()
        .filter((order) => order.owner !== 'user')
        .length;
    }

    function pushMarketInsight(insight) {
      if (!insight || typeof insight !== 'object') return;
      insights.unshift({ ...insight });
      if (insights.length > MAX_INSIGHTS) insights.length = MAX_INSIGHTS;
    }

    function submitSynthetic(order) {
      if (order.price != null && syntheticOrderCount() >= MAX_SYNTHETIC_ORDERS) {
        return { trades: [], restingLot: 0, restId: null };
      }
      const normalizedOrder = order.price == null
        ? order
        : {
          ...order,
          price: roundPrice(
            order.price,
            order.side === 'buy' ? 'floor' : 'ceil',
          ),
        };
      const result = book.submit(normalizedOrder);
      emitTrades(result.trades);
      return result;
    }

    function currentTick() {
      return tickSizeFor(fairValue);
    }

    function roundPrice(price, mode = 'nearest') {
      return Math.max(
        minimumFair,
        Math.min(maximumFair, roundToValidTick(price, mode)),
      );
    }

    function passivePrice(side) {
      if (side === 'buy') {
        return roundPrice(
          book.bestBid() || fairValue - currentTick(),
          'floor',
        );
      }
      return roundPrice(
        book.bestAsk() || fairValue + currentTick(),
        'ceil',
      );
    }

    function medianDepth(side) {
      const depth = book.depth(profile.depthLevels);
      const levels = side === 'buy' ? depth.bids : depth.asks;
      return median(levels.map((level) => level.lot));
    }

    function createAgentContext() {
      return {
        book,
        tick: currentTick(),
        rng: random,
        simNow,
        profile,
        regime: regimeController.get(),
        getFairValue: () => fairValue,
        roundPrice,
        submitSynthetic,
        passivePrice,
        medianDepth,
        nextEventId: () => {
          const id = nextEventId;
          nextEventId += 1;
          return id;
        },
        pushInsight: pushMarketInsight,
      };
    }

    const marketMaker = createMarketMakerAgent({ profile, rng: random });
    const orderFlow = createOrderFlowAgent({ profile, rng: random });
    const flowController = createMarketFlowController({
      rng: random,
      sequence: opts.flowEventSequence,
    });

    marketMaker.step(createAgentContext());

    function syncFairValue(regime) {
      const previous = fairValue;
      const bestBid = book.bestBid();
      const bestAsk = book.bestAsk();
      const midpoint = Number.isFinite(bestBid) && Number.isFinite(bestAsk)
        ? (bestBid + bestAsk) / 2
        : Number(book.last) || fairValue;
      const last = Number(book.last) || fairValue;
      const directionalBias = (Number(regime.bias) || 0) * currentTick() * 0.35;
      fairValue = roundPrice(
        (last * 0.7) + (midpoint * 0.3) + directionalBias,
        'nearest',
      );
      return fairValue !== previous;
    }

    function runPrimaryEvent(type, context) {
      if (type === 'ADD') {
        const maintenance = marketMaker.maintainOne(context);
        if (maintenance.changed) {
          return {
            type: 'ADD',
            ...maintenance,
          };
        }
        return orderFlow.addPassive(context);
      }
      if (type === 'CANCEL') return orderFlow.cancelOne(context);
      if (type === 'AMEND') return orderFlow.amendOne(context);
      if (type === 'MATCH') return orderFlow.match(context);
      if (type === 'SWEEP') return orderFlow.sweep(context);
      return {
        type: 'IDLE',
        changed: false,
        trades: [],
        side: null,
        price: null,
        lot: 0,
        orderId: null,
      };
    }

    function selectSpecialEventType() {
      if (requestedEventSequence.length) {
        const type = requestedEventSequence[
          eventSequenceIndex % requestedEventSequence.length
        ];
        eventSequenceIndex += 1;
        return type;
      }
      const roll = random();
      if (roll < 0.24) return 'whale';
      if (roll < 0.5) return 'wall';
      if (roll < 0.76) return 'spoof';
      return 'iceberg';
    }

    function selectEventSide(regime) {
      const bias = Number(regime.bias) || 0;
      const buyChance = Math.max(0.15, Math.min(0.85, 0.5 + bias));
      return random() < buyChance ? 'buy' : 'sell';
    }

    function createSpecialEvent(type, context) {
      const side = selectEventSide(context.regime);
      const price = passivePrice(side);
      const medianLot = Math.max(1, medianDepth(side));

      if (type === 'whale') {
        return createWhaleAgent(context, { side });
      }
      if (type === 'wall') {
        return createWallAgent(context, {
          side,
          price,
          lifetimeMs: 8_000 + Math.floor(random() * 8_000),
        });
      }
      if (type === 'spoof') {
        return createSpoofAgent(context, {
          side,
          price,
          lifetimeMs: 4_000 + Math.floor(random() * 5_000),
          riskTicks: 1 + Math.floor(random() * 2),
        });
      }
      return createIcebergAgent(context, {
        side,
        price,
        visibleLot: Math.max(4, Math.round(medianLot * 0.7)),
        hiddenLot: Math.max(20, Math.round(medianLot * (3 + random() * 3))),
        lifetimeMs: 12_000 + Math.floor(random() * 10_000),
      });
    }

    function maybeSpawnSpecialEvent(regime) {
      if (specialEvents.length >= MAX_SPECIAL_EVENTS) return false;
      if (syntheticOrderCount() >= MAX_SYNTHETIC_ORDERS) return false;
      if (simNow < nextSpecialEventAt) return false;

      const event = createSpecialEvent(
        selectSpecialEventType(),
        createAgentContext(),
      );
      specialEvents.push(event);
      const cooldown = Math.max(2_000, Number(profile.specialCooldownMs) || 20_000);
      nextSpecialEventAt = simNow + Math.round(
        cooldown * (0.75 + random() * 0.5),
      );
      return true;
    }

    function runSpecialEvents() {
      let changed = false;
      let tradeCount = 0;

      for (let index = specialEvents.length - 1; index >= 0; index -= 1) {
        const event = specialEvents[index];
        const result = event.step({ now: simNow }) || {};
        changed ||= Boolean(result.changed);
        tradeCount += Array.isArray(result.trades) ? result.trades.length : 0;
        if (result.done) specialEvents.splice(index, 1);
      }

      return { changed, tradeCount };
    }

    function needsLiquidityRepair() {
      const depth = book.depth(Math.min(4, profile.depthLevels));
      const bidSparse = depth.bids.length < 4
        && book.bestBid() !== dailyBands.arb;
      const askSparse = depth.asks.length < 4
        && book.bestAsk() !== dailyBands.ara;
      return bidSparse || askSparse;
    }

    function step(deltaMs = SIM_QUANTUM_MS) {
      const numericDelta = Number(deltaMs);
      const elapsed = Number.isFinite(numericDelta) && numericDelta > 0
        ? numericDelta
        : SIM_QUANTUM_MS;
      simNow += elapsed;

      const regimeChanged = regimeController.advance(simNow);
      const regime = regimeController.get();
      const context = createAgentContext();
      const requestedEventType = flowController.next(regime.id);
      const eventType = needsLiquidityRepair() ? 'ADD' : requestedEventType;
      const primaryResult = runPrimaryEvent(eventType, context);
      const specialSpawned = maybeSpawnSpecialEvent(regime);
      const specialResult = runSpecialEvents();
      const fairChanged = syncFairValue(regime);
      const spreadRepair = marketMaker.repairSpread(context);
      const primaryTrades = Array.isArray(primaryResult.trades)
        ? primaryResult.trades.length
        : 0;
      const tradeCount = primaryTrades + specialResult.tradeCount;
      lastEvent = {
        type: primaryResult.type,
        side: primaryResult.side,
        price: primaryResult.price,
        lot: primaryResult.lot,
        tradeCount: primaryTrades,
        simTime: simNow,
      };
      const changed = Boolean(
        regimeChanged
        || fairChanged
        || primaryResult.changed
        || spreadRepair.changed
        || specialSpawned
        || specialResult.changed,
      );

      safeInvoke(opts.onUpdate);

      return {
        changed,
        tradeCount,
        regimeChanged,
        simNow,
        event: { ...lastEvent },
      };
    }

    function normalizeLimitPrice(price) {
      return Math.max(
        dailyBands.arb,
        Math.min(
          dailyBands.ara,
          normalizeArenaOrderPrice(price),
        ),
      );
    }

    function submitUser(order) {
      const normalizedPrice = order.price == null
        ? null
        : normalizeLimitPrice(order.price);
      const result = book.submit({
        side: order.side,
        price: normalizedPrice,
        lot: order.lot,
        owner: 'user',
      });
      emitTrades(result.trades);
      const changed = result.restId != null || result.trades.length > 0;
      if (changed) safeInvoke(opts.onUpdate);
      return result;
    }

    function snapshot(requestedDepth) {
      const depthCount = Number.isFinite(Number(requestedDepth))
        && Number(requestedDepth) > 0
        ? Math.floor(Number(requestedDepth))
        : profile.depthLevels;
      const vwap = stats.vol > 0
        ? stats.val / (stats.vol * 100)
        : book.last;
      return {
        last: book.last,
        ref: fairValue,
        tick: currentTick(),
        depth: book.depth(depthCount),
        bestBid: book.bestBid(),
        bestAsk: book.bestAsk(),
        done: { ...stats.done },
        stats: {
          vol: stats.vol,
          val: stats.val,
          freq: stats.freq,
          avg: Math.round(vwap),
          high: stats.high,
          low: stats.low,
          open: stats.open,
          prevClose: stats.prevClose,
          ara: dailyBands.ara,
          arb: dailyBands.arb,
        },
        regime: regimeController.get(),
        lastEvent: { ...lastEvent },
        insights: insights.map((item) => (
          item && typeof item === 'object' ? { ...item } : item
        )),
      };
    }

    function scheduleNext() {
      if (!running || timer != null) return;
      timer = schedule(() => {
        timer = null;
        try {
          step(SIM_QUANTUM_MS);
        } catch (error) {
          reportError(error);
        } finally {
          if (running && timer == null) scheduleNext();
        }
      }, speedToDelay(SIM_QUANTUM_MS, speed));
    }

    function start() {
      if (running) return;
      running = true;
      scheduleNext();
    }

    function stop() {
      if (!running) return;
      running = false;
      if (timer != null) cancelSchedule(timer);
      timer = null;
    }

    function setSpeed(nextSpeed) {
      speed = normalizeArenaPreferences({
        profile: profile.id,
        speed: nextSpeed,
      }).speed;
      if (!running) return speed;

      if (timer != null) cancelSchedule(timer);
      timer = null;
      scheduleNext();
      return speed;
    }

    function getState() {
      return {
        simNow,
        speed,
        running,
      };
    }

    return {
      book,
      step,
      submitUser,
      snapshot,
      start,
      stop,
      setSpeed,
      getState,
      normalizeLimitPrice,
      cancel: (id) => book.cancel(id),
      userOrders: () => book.restingByOwner('user').map((order) => ({
        ...order,
        aheadLot: book.lotsAhead(order.id) || 0,
      })),
      get tick() {
        return currentTick();
      },
    };
  }

  const api = {
    buildArenaPriceRows,
    createMarket,
    nextArenaPrice,
    normalizeArenaOrderPrice,
    previousArenaPrice,
    roundToValidTick,
    SIM_QUANTUM_MS,
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}());
