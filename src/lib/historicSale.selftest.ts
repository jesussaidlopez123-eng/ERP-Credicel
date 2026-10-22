import assert from 'node:assert/strict';
import {
  applyExpenseToCorte,
  applyTicketToCorte,
  buildHistoricSaleTimestamp,
  findClosedCorteForDay,
  isOpenShiftMovement,
  rebuildCorteTotals,
  removeExpenseFromCorte,
  removeTicketFromCorte,
  resolveHistoricCorteTickets,
  ticketIncludesPhoneUnit,
  ticketsNotSealedOnCorte,
  ticketsSealedOnOtherCorteSameDay,
  validateHistoricSaleTarget
} from './historicSale.ts';
import { classifySaleItem, isPhoneUnitSale } from './saleClassification.ts';
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

const payjoyItem = {
  cartItemId: 'cel-1',
  quantity: 1,
  unitPrice: 3500,
  totalPrice: 3500,
  product: { id: 'p1', code: 'CEL-1', name: 'Samsung A15', category: 'equipo_credito', price: 3500, stock: 1 },
  metadata: {
    saleType: 'credito' as const,
    financingPlatform: 'PayJoy',
    clientName: 'María',
    deviceModel: 'Samsung A15',
    imei: '351111111111111'
  }
};
const contadoItem = {
  cartItemId: 'cel-2',
  quantity: 1,
  unitPrice: 2800,
  totalPrice: 2800,
  product: { id: 'p2', code: 'CEL-2', name: 'Moto G', category: 'equipo', price: 2800, stock: 1 },
  metadata: { saleType: 'contado' as const, imei: '352222222222222', deviceModel: 'Moto G' }
};
assert.equal(classifySaleItem(payjoyItem), 'enganches');
assert.equal(classifySaleItem(contadoItem), 'accesorios');
assert.equal(isPhoneUnitSale(payjoyItem), true);
assert.equal(isPhoneUnitSale(contadoItem), true);

const sealedPhone: SaleTicket = {
  id: 'TCK-PAYJOY',
  folio: 'NAV-0909-010',
  timestamp: pastStamp,
  branchId: 'b-navojoa',
  operatorName: 'Cajero',
  items: [payjoyItem],
  total: 3500,
  paymentMethod: 'Efectivo',
  corteXId: corte.id
};
const unsealedPhone: SaleTicket = {
  id: 'TCK-ORPHAN',
  folio: 'NAV-0909-011',
  timestamp: pastStamp,
  branchId: 'b-navojoa',
  operatorName: 'Cajero',
  items: [contadoItem],
  total: 2800,
  paymentMethod: 'Efectivo'
};
const otherCortePhone: SaleTicket = {
  id: 'TCK-OTHER',
  folio: 'NAV-0909-012',
  timestamp: pastStamp,
  branchId: 'b-navojoa',
  operatorName: 'Cajero',
  items: [payjoyItem],
  total: 3500,
  paymentMethod: 'Efectivo',
  corteXId: 'SES-NAV-OTRO'
};
const slimCorte: CorteXRecord = {
  ...corte,
  ticketIds: ['TCK-PAYJOY'],
  ticketsSnapshot: []
};
const available = [sealedPhone, unsealedPhone, otherCortePhone];
assert.deepEqual(
  resolveHistoricCorteTickets(slimCorte, available).map((row) => row.id),
  ['TCK-PAYJOY']
);
assert.equal(ticketIncludesPhoneUnit(unsealedPhone), true);
assert.deepEqual(
  ticketsNotSealedOnCorte(slimCorte, available).map((row) => row.id),
  ['TCK-ORPHAN']
);
assert.deepEqual(
  ticketsSealedOnOtherCorteSameDay(slimCorte, available).map((row) => row.id),
  ['TCK-OTHER']
);
assert.deepEqual(
  resolveHistoricCorteTickets({ ...slimCorte, ticketsSnapshot: [sealedPhone] }, available).map((row) => row.id),
  ['TCK-PAYJOY'],
  'si hay foto del corte, no se mezclan ventas huérfanas del mismo día'
);

const refaccion: Expense = {
  id: 'GTO-REP-1',
  amount: 200,
  concept: 'Refacción taller',
  timestamp: pastStamp,
  operatorName: 'Taller',
  branchId: 'b-matriz',
  kind: 'refaccion_taller',
  repairId: 'REP-1',
  countsAsCashOut: false
};
const patchedRefaccion = applyExpenseToCorte(corte, refaccion);
assert.equal(patchedRefaccion.totalExpenses, 0, 'la refacción no aparece en el Corte X');
assert.equal(patchedRefaccion.expectedCashInDrawer, 500, 'la pieza no baja el cajón');
assert.equal(patchedRefaccion.netIncome, corte.netIncome);
assert.equal(patchedRefaccion.expenseIds.includes('GTO-REP-1'), false);

console.log('historicSale self-test ok');
