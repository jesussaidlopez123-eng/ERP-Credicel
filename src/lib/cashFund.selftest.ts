import assert from 'node:assert/strict';
import {
  expectedCashWithFund,
  leftoverFromLatestCorte,
  lookupBranchFund,
  mapBranchFundsSnapshot,
  parseCashFundAmount,
  resolveOpeningCashFund,
  suggestedLeftoverFund
} from './cashFund.ts';

assert.equal(parseCashFundAmount('1500'), 1500);
assert.equal(parseCashFundAmount(1500.129), 1500.13);
assert.equal(parseCashFundAmount(-1), null);
assert.equal(parseCashFundAmount(''), null);

assert.equal(lookupBranchFund({ 'b-navojoa': 800 }, 'Navojoa'), 800);
assert.equal(lookupBranchFund({ navojoa: 900 }, 'b-navojoa'), 900);
assert.equal(
  lookupBranchFund(mapBranchFundsSnapshot([{ id: 'b-huatabampo', data: { fundAmount: '1200' } }]), 'Huatabampo'),
  1200
);

assert.equal(suggestedLeftoverFund(1000, 3500), 1000);
assert.equal(suggestedLeftoverFund(1000, 400), 400);
assert.equal(suggestedLeftoverFund(0, 3500), 0);

assert.equal(expectedCashWithFund(1000, 500, 80), 1420, 'el fondo tiene que entrar al arqueo');

assert.equal(
  resolveOpeningCashFund({
    branchId: 'b-navojoa',
    funds: {},
    sessionInitial: 0,
    cortes: [{ branchId: 'b-navojoa', timestamp: '2026-10-13T23:00:00-07:00', cashFundLeftForNextShift: 1500 }]
  }),
  1500,
  'si el cierre de ayer dejó fondo, mañana abre con ese monto'
);

assert.equal(
  leftoverFromLatestCorte(
    [
      { branchId: 'b-matriz', timestamp: '2026-10-12T23:00:00-07:00', cashFundLeftForNextShift: 200 },
      { branchId: 'b-matriz', timestamp: '2026-10-13T23:00:00-07:00', cashFundLeftForNextShift: 750 }
    ],
    'Matriz'
  ),
  750
);

assert.equal(
  resolveOpeningCashFund({
    branchId: 'b-navojoa',
    funds: { 'b-navojoa': 0 },
    sessionInitial: 1800
  }),
  1800,
  'el monto de la sesión abierta gana si es mayor a cero'
);

console.log('cashFund self-test ok');
