import assert from 'node:assert/strict';
import {
  applyTicketToCorte,
  buildHistoricSaleTimestamp,
  findClosedCorteForDay,
  isOpenShiftMovement,
  rebuildCorteTotals,
  removeExpenseFromCorte,
  removeTicketFromCorte,
  validateHistoricSaleTarget
} from './historicSale.ts';
import { hermosilloDateKey } from './shiftHours.ts';
import type { CorteXRecord, Expense, SaleTicket } from '../types.ts';

const pastStamp = buildHistoricSaleTimestamp('2026-09-09', new Date('2026-09-10T18:00:00-07:00'));
assert.equal(pastStamp, '2026-09-09T21:00:00-07:00');
assert.equal(hermosilloDateKey(pastStamp), '2026-09-09');

assert.equal(
  validateHistoricSaleTarget({ branchId: 'all', dateKey: '2026-09-09' }),
  'Elige Matriz, Navojoa o Huatabampo. Administración no tiene corte de caja.'
);
assert.equal(
  validateHistoricSaleTarget({ branchId: 'b-navojoa', dateKey: '2099-01-01' }, new Date('2026-09-10T12:00:00-07:00')),
  'No se puede registrar una venta en una fecha futura.'
);
assert.equal(validateHistoricSaleTarget({ branchId: 'b-huatabampo', dateKey: '2026-09-09' }, new Date('2026-09-10T12:00:00-07:00')), null);
assert.equal(validateHistoricSaleTarget({ branchId: 'b-matriz', dateKey: '2026-09-09' }, new Date('2026-09-10T12:00:00-07:00')), null);
assert.equal(validateHistoricSaleTarget({ branchId: 'Bodega', dateKey: '2026-09-09' }, new Date('2026-09-10T12:00:00-07:00')), null);

const corte: CorteXRecord = {
  id: 'SES-NAV-20260909-1',
  timestamp: '2026-09-09T23:00:00-07:00',
  dateStr: '2026-09-09',
  timeStr: '23:00',
  branchId: 'b-navojoa',
  branchName: 'Navojoa',
  operatorName: 'Cajero',
  initialCashFund: 500,
  cashSales: 0,
  cardSales: 0,
  transferSales: 0,
  totalSales: 0,
  totalExpenses: 0,
  netIncome: 0,
  expectedCashInDrawer: 500,
  countedCash: 500,
  ticketIds: [],
  expenseIds: [],
  ticketsSnapshot: [],
  expensesSnapshot: [],
  breakdown: {
    accesoriosTotal: 0,
    accesoriosCount: 0,
    abonosTotal: 0,
    abonosCount: 0,
    enganchesTotal: 0,
    enganchesCount: 0,
    reparacionesTotal: 0,
    reparacionesCount: 0,
    recargasTotal: 0,
    recargasCount: 0
  }
};

const ticket: SaleTicket = {
  id: 'TCK-1',
  folio: 'NAV-0909-001',
  timestamp: pastStamp,
  branchId: 'b-navojoa',
  operatorName: 'Admin',
  items: [],
  total: 200,
  paymentMethod: 'Efectivo'
};

const withSale = applyTicketToCorte(corte, ticket);
assert.equal(withSale.totalSales, 200);
assert.equal(withSale.cashSales, 200);
assert.equal(withSale.ticketIds.includes('TCK-1'), true);
assert.equal(withSale.expectedCashInDrawer, 700);
assert.equal(withSale.cashDifference, -200);

const without = removeTicketFromCorte(withSale, 'TCK-1');
assert.equal(without.totalSales, 0);
assert.equal(without.ticketIds.includes('TCK-1'), false);
assert.equal(without.expectedCashInDrawer, 500);

const gasto: Expense = {
  id: 'GTO-1',
  amount: 80,
  concept: 'Pasaje',
  timestamp: pastStamp,
  operatorName: 'Cajero',
  branchId: 'b-navojoa'
};
assert.equal(isOpenShiftMovement(gasto), true);
assert.equal(isOpenShiftMovement({ ...gasto, corteXId: 'SES-1' }), false);

const withExpense = rebuildCorteTotals(withSale, withSale.ticketsSnapshot || [], [gasto]);
assert.equal(withExpense.totalExpenses, 80);
assert.equal(withExpense.expectedCashInDrawer, 620);
assert.equal(withExpense.expenseIds.includes('GTO-1'), true);

const withoutExpense = removeExpenseFromCorte(withExpense, 'GTO-1');
assert.equal(withoutExpense.totalExpenses, 0);
assert.equal(withoutExpense.expenseIds.includes('GTO-1'), false);
assert.equal(withoutExpense.expectedCashInDrawer, 700);

assert.equal(findClosedCorteForDay([corte], 'Navojoa', '2026-09-09')?.id, corte.id);
assert.equal(findClosedCorteForDay([corte], 'b-huatabampo', '2026-09-09'), null);

console.log('historicSale self-test ok');
