const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateArenaAllocation,
  calculateArenaEstimate,
} = require('../js/cuanmeter/arena-utils.js');

test('calculateArenaAllocation uses the requested share of buying power', () => {
  const lot = calculateArenaAllocation({
    cash: 10_000_000,
    price: 1_000,
    feeRate: 0,
    fraction: 0.25,
  });

  assert.equal(lot, 25);
});

test('calculateArenaAllocation includes the buy fee and never exceeds cash', () => {
  const lot = calculateArenaAllocation({
    cash: 10_000_000,
    price: 1_000,
    feeRate: 0.0015,
    fraction: 1,
  });

  assert.equal(lot, 99);
  assert.ok(lot * 100 * 1_000 * 1.0015 <= 10_000_000);
});

test('calculateArenaAllocation returns one lot for a positive small fraction when affordable', () => {
  const lot = calculateArenaAllocation({
    cash: 150_000,
    price: 1_000,
    feeRate: 0,
    fraction: 0.25,
  });

  assert.equal(lot, 1);
});

test('calculateArenaAllocation returns zero when one lot is not affordable', () => {
  const lot = calculateArenaAllocation({
    cash: 99_999,
    price: 1_000,
    feeRate: 0,
    fraction: 1,
  });

  assert.equal(lot, 0);
});

test('calculateArenaEstimate adds fee to buy debit', () => {
  const estimate = calculateArenaEstimate({
    side: 'buy',
    lot: 5,
    price: 1_000,
    feeRate: 0.0015,
  });

  assert.deepEqual(estimate, {
    gross: 500_000,
    fee: 750,
    total: 500_750,
  });
});

test('calculateArenaEstimate subtracts fee from sell proceeds', () => {
  const estimate = calculateArenaEstimate({
    side: 'sell',
    lot: 5,
    price: 1_000,
    feeRate: 0.0025,
  });

  assert.deepEqual(estimate, {
    gross: 500_000,
    fee: 1_250,
    total: 498_750,
  });
});
