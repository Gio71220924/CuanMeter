/* ============================================================
   arena-utils.js - pure calculations shared by the Arena UI.
   Browser globals are also exported through CommonJS for tests.
   ============================================================ */

(function registerArenaUtils(root) {
  function calculateArenaAllocation({ cash, price, feeRate = 0, fraction = 1 }) {
    const availableCash = Number(cash);
    const referencePrice = Number(price);
    const rate = Math.max(0, Number(feeRate) || 0);
    const share = Math.max(0, Math.min(1, Number(fraction) || 0));

    if (!(availableCash > 0) || !(referencePrice > 0) || share <= 0) return 0;

    const maxLots = Math.floor(availableCash / (referencePrice * 100 * (1 + rate)));
    if (maxLots <= 0) return 0;

    return Math.min(maxLots, Math.max(1, Math.floor(maxLots * share)));
  }

  function calculateArenaEstimate({ side, lot, price, feeRate = 0 }) {
    const orderLot = Math.max(0, Math.floor(Number(lot)) || 0);
    const orderPrice = Math.max(0, Number(price) || 0);
    const rate = Math.max(0, Number(feeRate) || 0);
    const gross = orderLot * 100 * orderPrice;
    const fee = Math.round(gross * rate);
    const total = side === 'sell' ? gross - fee : gross + fee;

    return { gross, fee, total };
  }

  const api = { calculateArenaAllocation, calculateArenaEstimate };

  if (root) Object.assign(root, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : null));

