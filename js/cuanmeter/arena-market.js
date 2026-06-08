(function () {
  'use strict';

  const ARENA_SPEEDS = Object.freeze([1, 2, 5, 10]);

  function freezeProfile(profile) {
    return Object.freeze({
      ...profile,
      spreadTicks: Object.freeze([...profile.spreadTicks]),
    });
  }

  const ARENA_PROFILES = Object.freeze({
    liquid: freezeProfile({
      id: 'liquid',
      label: 'Likuid',
      depthLevels: 12,
      spreadTicks: [1, 1],
      baseLotMin: 45,
      baseLotMax: 160,
      depthLotMin: 5_000,
      depthLotMax: 80_000,
      retailRate: 0.72,
      mediumTradeChance: 0.18,
      wallChance: 0.015,
      specialCooldownMs: 45_000,
      volatility: 0.45,
    }),
    normal: freezeProfile({
      id: 'normal',
      label: 'Normal',
      depthLevels: 10,
      spreadTicks: [1, 2],
      baseLotMin: 20,
      baseLotMax: 100,
      depthLotMin: 1_000,
      depthLotMax: 25_000,
      retailRate: 0.55,
      mediumTradeChance: 0.14,
      wallChance: 0.025,
      specialCooldownMs: 35_000,
      volatility: 0.8,
    }),
    gorengan: freezeProfile({
      id: 'gorengan',
      label: 'Gorengan',
      depthLevels: 8,
      spreadTicks: [1, 4],
      baseLotMin: 5,
      baseLotMax: 55,
      depthLotMin: 100,
      depthLotMax: 8_000,
      retailRate: 0.38,
      mediumTradeChance: 0.22,
      wallChance: 0.07,
      specialCooldownMs: 18_000,
      volatility: 1.8,
    }),
    trending: freezeProfile({
      id: 'trending',
      label: 'Trending',
      depthLevels: 10,
      spreadTicks: [1, 3],
      baseLotMin: 15,
      baseLotMax: 90,
      depthLotMin: 3_000,
      depthLotMax: 50_000,
      retailRate: 0.62,
      mediumTradeChance: 0.2,
      wallChance: 0.04,
      specialCooldownMs: 25_000,
      volatility: 1.15,
    }),
  });

  function freezeRegime(regime) {
    return Object.freeze(regime);
  }

  const ARENA_REGIMES = Object.freeze({
    quiet: freezeRegime({
      id: 'quiet',
      label: 'Quiet',
      minMs: 18_000,
      maxMs: 45_000,
      activity: 0.28,
      aggression: 0.18,
      bias: 0,
      spreadFactor: 1.35,
    }),
    normal: freezeRegime({
      id: 'normal',
      label: 'Normal',
      minMs: 25_000,
      maxMs: 75_000,
      activity: 0.62,
      aggression: 0.42,
      bias: 0,
      spreadFactor: 1,
    }),
    trend_up: freezeRegime({
      id: 'trend_up',
      label: 'Trend Up',
      minMs: 20_000,
      maxMs: 60_000,
      activity: 0.72,
      aggression: 0.58,
      bias: 0.28,
      spreadFactor: 1.05,
    }),
    trend_down: freezeRegime({
      id: 'trend_down',
      label: 'Trend Down',
      minMs: 20_000,
      maxMs: 60_000,
      activity: 0.72,
      aggression: 0.58,
      bias: -0.28,
      spreadFactor: 1.05,
    }),
    volatile: freezeRegime({
      id: 'volatile',
      label: 'Volatile',
      minMs: 12_000,
      maxMs: 35_000,
      activity: 0.88,
      aggression: 0.72,
      bias: 0,
      spreadFactor: 1.45,
    }),
    panic_buy: freezeRegime({
      id: 'panic_buy',
      label: 'Panic Buy',
      minMs: 7_000,
      maxMs: 18_000,
      activity: 0.96,
      aggression: 0.9,
      bias: 0.68,
      spreadFactor: 1.7,
    }),
    panic_sell: freezeRegime({
      id: 'panic_sell',
      label: 'Panic Sell',
      minMs: 7_000,
      maxMs: 18_000,
      activity: 0.96,
      aggression: 0.9,
      bias: -0.68,
      spreadFactor: 1.7,
    }),
  });

  function freezeTransitions(transitions) {
    return Object.freeze(
      transitions.map(([id, weight]) => Object.freeze([id, weight])),
    );
  }

  const REGIME_TRANSITIONS = Object.freeze({
    quiet: freezeTransitions([['normal', 1]]),
    normal: freezeTransitions([
      ['quiet', 0.28],
      ['trend_up', 0.22],
      ['trend_down', 0.22],
      ['volatile', 0.28],
    ]),
    trend_up: freezeTransitions([
      ['normal', 0.45],
      ['volatile', 0.35],
      ['panic_buy', 0.2],
    ]),
    trend_down: freezeTransitions([
      ['normal', 0.45],
      ['volatile', 0.35],
      ['panic_sell', 0.2],
    ]),
    volatile: freezeTransitions([
      ['normal', 0.46],
      ['trend_up', 0.18],
      ['trend_down', 0.18],
      ['panic_buy', 0.09],
      ['panic_sell', 0.09],
    ]),
    panic_buy: freezeTransitions([['volatile', 1]]),
    panic_sell: freezeTransitions([['volatile', 1]]),
  });

  function hasOwnEntry(record, key) {
    return Object.hasOwn(record, key);
  }

  function getArenaRegime(id) {
    return hasOwnEntry(ARENA_REGIMES, id)
      ? ARENA_REGIMES[id]
      : ARENA_REGIMES.normal;
  }

  function createArenaRng(seed) {
    let state = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 0;

    return function arenaRandom() {
      state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
      return state / 4_294_967_296;
    };
  }

  function normalizeArenaSpeed(speed) {
    const numericSpeed = Number(speed);
    return ARENA_SPEEDS.includes(numericSpeed) ? numericSpeed : 1;
  }

  function speedToDelay(simulatedQuantumMs, speed) {
    const validSpeed = normalizeArenaSpeed(speed);
    const quantum = Number.isFinite(simulatedQuantumMs)
      ? simulatedQuantumMs
      : 0;
    return Math.max(25, quantum / validSpeed);
  }

  function median(values) {
    if (!Array.isArray(values)) return 0;
    const finiteValues = values
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);
    if (!finiteValues.length) return 0;

    const middle = Math.floor(finiteValues.length / 2);
    if (finiteValues.length % 2) return finiteValues[middle];
    return (finiteValues[middle - 1] + finiteValues[middle]) / 2;
  }

  function randomDuration(regime, rng) {
    const range = regime.maxMs - regime.minMs + 1;
    return regime.minMs + Math.floor(rng() * range);
  }

  function selectTransition(regimeId, rng) {
    const transitions = REGIME_TRANSITIONS[regimeId];
    const totalWeight = transitions.reduce(
      (total, transition) => total + transition[1],
      0,
    );
    const target = rng() * totalWeight;
    let cumulative = 0;

    for (const [id, weight] of transitions) {
      cumulative += weight;
      if (target < cumulative) return id;
    }

    return transitions[transitions.length - 1][0];
  }

  function createRegimeController({
    rng = Math.random,
    initial = 'normal',
    now = 0,
  } = {}) {
    const random = typeof rng === 'function' ? rng : Math.random;
    let current = getArenaRegime(initial);
    let enteredAt = Number.isFinite(now) ? now : 0;
    let expiresAt = enteredAt + randomDuration(current, random);

    return {
      get() {
        return {
          ...current,
          enteredAt,
          expiresAt,
        };
      },

      advance(simNow) {
        if (!Number.isFinite(simNow) || simNow < expiresAt) return false;

        current = getArenaRegime(selectTransition(current.id, random));
        enteredAt = simNow;
        expiresAt = enteredAt + randomDuration(current, random);
        return true;
      },
    };
  }

  function createFixedRegimeController(id) {
    const regime = getArenaRegime(id);

    return {
      get() {
        return {
          ...regime,
          enteredAt: 0,
          expiresAt: Infinity,
        };
      },

      advance() {
        return false;
      },
    };
  }

  function normalizeArenaPreferences(input = {}) {
    const preferences = input && typeof input === 'object' ? input : {};
    return {
      profile: hasOwnEntry(ARENA_PROFILES, preferences.profile)
        ? preferences.profile
        : 'normal',
      speed: normalizeArenaSpeed(preferences.speed),
    };
  }

  const api = {
    ARENA_PROFILES,
    ARENA_REGIMES,
    ARENA_SPEEDS,
    REGIME_TRANSITIONS,
    createArenaRng,
    createFixedRegimeController,
    createRegimeController,
    median,
    normalizeArenaPreferences,
    speedToDelay,
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}());
