/**
 * Dirección no “pierde” semanas: las arma con cortes y pide el rango visto.
 *
 *   npx tsx src/lib/executiveHistory.selftest.ts
 */
import assert from 'node:assert/strict';
import { chunkInclusiveRange } from './dateUtils.ts';
import { cajaRangeQueryBounds } from './shiftDocs.ts';
import {
  collectExpensesFromCortes,
  collectTicketsFromCortes,
  markCashDaysLoaded,
  mergeCajaDocsWithSnapshots,
  missingCashDays,
  weekStartsFromCortes
} from './executiveHistory.ts';
import type { CorteXRecord, Expense, SaleTicket } from '../types.ts';

const corte: CorteXRecord = {
  id: 'CTX-1',
  timestamp: '2026-09-08T22:10:00-07:00',
  dateStr: '2026-09-08',
  timeStr: '22:10',
  branchId: 'b-navojoa',
  branchName: 'Navojoa',
  operatorName: 'Caja',
  initialCashFund: 1000,
  cashSales: 500,
  cardSales: 0,
  transferSales: 0,
  totalSales: 500,
  totalExpenses: 40,
  netIncome: 460,
  expectedCashInDrawer: 1460,
  ticketIds: ['TCK-SNAP', 'TCK-LIVE'],
  expenseIds: ['EXP-SNAP'],
  ticketsSnapshot: [
    {
      id: 'TCK-SNAP',
      timestamp: '2026-09-08T10:00:00-07:00',
      branchId: 'b-navojoa'
    } as SaleTicket,
    {
      id: 'TCK-LIVE',
      timestamp: '2026-09-08T11:00:00-07:00',
      branchId: 'b-navojoa',
      total: 1
    } as SaleTicket
  ],
  expensesSnapshot: [
    {
      id: 'EXP-SNAP',
      timestamp: '2026-09-08T12:00:00-07:00',
      branchId: 'b-navojoa',
      amount: 40
    } as Expense
  ],
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

assert.deepEqual(
  collectTicketsFromCortes([corte]).map((row) => row.id).sort(),
  ['TCK-LIVE', 'TCK-SNAP']
);
assert.equal(collectExpensesFromCortes([corte])[0]?.id, 'EXP-SNAP');
assert.deepEqual(weekStartsFromCortes([corte]), ['2026-09-07']);

const merged = mergeCajaDocsWithSnapshots({
  cortes: [corte],
  tickets: [
    {
      id: 'TCK-LIVE',
      timestamp: '2026-09-08T11:00:00-07:00',
      branchId: 'b-navojoa',
      total: 99
    } as SaleTicket
  ],
  expenses: []
});
assert.equal(
  (merged.tickets.find((row) => row.id === 'TCK-LIVE') as { total?: number } | undefined)?.total,
  99,
  'el ticket vivo pisa el snapshot del corte'
);
assert.ok(merged.tickets.some((row) => row.id === 'TCK-SNAP'), 'el snapshot cubre lo que aún no se pidió a ventas');

const loaded = new Set<string>(['2026-10-13']);
assert.deepEqual(missingCashDays(loaded, '2026-10-12', '2026-10-14'), ['2026-10-12', '2026-10-14']);
markCashDaysLoaded(loaded, '2026-10-12', '2026-10-14');
assert.deepEqual(missingCashDays(loaded, '2026-10-12', '2026-10-14'), []);

assert.deepEqual(chunkInclusiveRange('2026-10-01', '2026-10-16', 7), [
  { from: '2026-10-01', to: '2026-10-07' },
  { from: '2026-10-08', to: '2026-10-14' },
  { from: '2026-10-15', to: '2026-10-16' }
]);
assert.deepEqual(chunkInclusiveRange('2026-10-14', '2026-10-14', 7), [{ from: '2026-10-14', to: '2026-10-14' }]);

const bounds = cajaRangeQueryBounds('2026-10-12', '2026-10-14');
assert.equal(bounds.start, '2026-10-12T00:00:00.000Z');
assert.ok(bounds.end.startsWith('2026-10-15'));

console.log('executiveHistory self-test ok');
