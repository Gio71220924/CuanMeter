(function () {
  'use strict';

  const ARENA_FLOW_EVENTS = Object.freeze([
    'ADD',
    'CANCEL',
    'AMEND',
    'MATCH',
    'SWEEP',
    'IDLE',
  ]);

  function freezeMix(mix) {
    return Object.freeze({ ...mix });
  }

  const ARENA_FLOW_MIX = Object.freeze({
    quiet: freezeMix({
      ADD: 0.23,
      CANCEL: 0.18,
      AMEND: 0.15,
      MATCH: 0.12,
      SWEEP: 0.01,
      IDLE: 0.31,
    }),
    normal: freezeMix({
      ADD: 0.30,
      CANCEL: 0.20,
      AMEND: 0.18,
      MATCH: 0.25,
      SWEEP: 0.04,
      IDLE: 0.03,
    }),
    trend_up: freezeMix({
      ADD: 0.27,
      CANCEL: 0.18,
      AMEND: 0.15,
      MATCH: 0.30,
      SWEEP: 0.07,
      IDLE: 0.03,
    }),
    trend_down: freezeMix({
      ADD: 0.27,
      CANCEL: 0.18,
      AMEND: 0.15,
      MATCH: 0.30,
      SWEEP: 0.07,
      IDLE: 0.03,
    }),
    volatile: freezeMix({
      ADD: 0.26,
      CANCEL: 0.18,
      AMEND: 0.15,
      MATCH: 0.30,
      SWEEP: 0.08,
      IDLE: 0.03,
    }),
    panic_buy: freezeMix({
      ADD: 0.20,
      CANCEL: 0.16,
      AMEND: 0.12,
      MATCH: 0.36,
      SWEEP: 0.13,
      IDLE: 0.03,
    }),
    panic_sell: freezeMix({
      ADD: 0.20,
      CANCEL: 0.16,
      AMEND: 0.12,
      MATCH: 0.36,
      SWEEP: 0.13,
      IDLE: 0.03,
    }),
  });

  function normalizeSequence(sequence) {
    if (!Array.isArray(sequence)) return [];
    return sequence
      .map((event) => String(event || '').toUpperCase())
      .filter((event) => ARENA_FLOW_EVENTS.includes(event));
  }

  function createMarketFlowController({
    rng = Math.random,
    sequence = [],
  } = {}) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const requestedSequence = normalizeSequence(sequence);
    let sequenceIndex = 0;

    function next(regimeId) {
      if (requestedSequence.length) {
        const event = requestedSequence[sequenceIndex % requestedSequence.length];
        sequenceIndex += 1;
        return event;
      }

      const mix = ARENA_FLOW_MIX[regimeId] || ARENA_FLOW_MIX.normal;
      const roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
      let boundary = 0;
      for (const event of ARENA_FLOW_EVENTS) {
        boundary += mix[event];
        if (roll < boundary) return event;
      }
      return 'IDLE';
    }

    return { next };
  }

  const api = {
    ARENA_FLOW_EVENTS,
    ARENA_FLOW_MIX,
    createMarketFlowController,
  };

  if (typeof window !== 'undefined') Object.assign(window, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
