const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ARENA_FLOW_EVENTS,
  ARENA_FLOW_MIX,
  createMarketFlowController,
} = require('../js/cuanmeter/arena-flow.js');

test('normal flow mix prioritizes queue mutations and sums to one', () => {
  assert.deepEqual(ARENA_FLOW_EVENTS, [
    'ADD',
    'CANCEL',
    'AMEND',
    'MATCH',
    'SWEEP',
    'IDLE',
  ]);
  assert.deepEqual(ARENA_FLOW_MIX.normal, {
    ADD: 0.30,
    CANCEL: 0.20,
    AMEND: 0.18,
    MATCH: 0.25,
    SWEEP: 0.04,
    IDLE: 0.03,
  });
  assert.equal(
    Object.values(ARENA_FLOW_MIX.normal).reduce((sum, value) => sum + value, 0),
    1,
  );
  assert.ok(
    ARENA_FLOW_MIX.normal.ADD
      + ARENA_FLOW_MIX.normal.CANCEL
      + ARENA_FLOW_MIX.normal.AMEND
      > ARENA_FLOW_MIX.normal.MATCH + ARENA_FLOW_MIX.normal.SWEEP,
  );
  assert.equal(Object.isFrozen(ARENA_FLOW_MIX), true);
  assert.equal(Object.isFrozen(ARENA_FLOW_MIX.normal), true);
});

test('flow controller supports deterministic event sequences', () => {
  const controller = createMarketFlowController({
    sequence: ['ADD', 'MATCH', 'IDLE'],
    rng: () => 0.99,
  });

  assert.equal(controller.next('normal'), 'ADD');
  assert.equal(controller.next('normal'), 'MATCH');
  assert.equal(controller.next('normal'), 'IDLE');
  assert.equal(controller.next('normal'), 'ADD');
});

test('flow controller uses exact normal weighted boundaries', () => {
  const values = [0, 0.2999, 0.30, 0.4999, 0.50, 0.6799, 0.68, 0.9299, 0.93, 0.9699, 0.97];
  let index = 0;
  const controller = createMarketFlowController({
    rng: () => values[index++],
  });

  assert.deepEqual(
    values.map(() => controller.next('normal')),
    ['ADD', 'ADD', 'CANCEL', 'CANCEL', 'AMEND', 'AMEND', 'MATCH', 'MATCH', 'SWEEP', 'SWEEP', 'IDLE'],
  );
});
