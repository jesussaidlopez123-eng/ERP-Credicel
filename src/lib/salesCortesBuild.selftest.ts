import assert from 'node:assert/strict';
import type { Branch, Operator, SaleTicket } from '../types';
import { assertThreeBranchesPerDay } from './corteDayRoster.ts';
import { branchDateKey, indexByBranchDate } from './branchDateIndex.ts';
import { corteDayKey } from './corteDayRoster.ts';
import { addCashDays } from './dateUtils.ts';
import { buildCortesRoster } from './salesCortesBuild.ts';

const branch: Branch = { id: 'b-navojoa', name: 'Navojoa' };
const operator: Operator = {
  id: 'op-1',
  name: 'Said',
  username: 'said',
  role: 'admin',
  branchIds: ['all']
};

const tickets: SaleTicket[] = [];
for (let i = 0; i < 80; i++) {
  tickets.push({
    id: `t-${i}`,
    folio: `NAV-0109-${i}`,
    timestamp: `2026-09-01T${String(9 + (i % 8)).padStart(2, '0')}:00:00-07:00`,
    branchId: i % 2 === 0 ? 'b-navojoa' : 'b-huatabampo',
    branchName: i % 2 === 0 ? 'Navojoa' : 'Huatabampo',
    operatorName: 'Said',
    items: [],
    total: 100,
    paymentMethod: 'Efectivo'
  } as SaleTicket);
}

const indexed = indexByBranchDate(tickets, (t) => t.branchId, (t) => t.timestamp);
assert.ok((indexed.get(branchDateKey('b-navojoa', '2026-09-01')) || []).length > 0);

const roster = buildCortesRoster({
  cortes: [
    {
      id: 'SES-NAV-1',
      timestamp: '2026-09-01T23:00:00-07:00',
      dateStr: '01/09/2026',
      timeStr: '11:00 p.m.',
      branchId: 'b-navojoa',
      branchName: 'Navojoa',
      operatorName: 'Said',
      initialCashFund: 0,
      cashSales: 4000,
      cardSales: 0,
      transferSales: 0,
      totalSales: 4000,
      totalExpenses: 0,
      netIncome: 4000,
      expectedCashInDrawer: 4000,
      ticketIds: [],
      expenseIds: [],
      breakdown: {
        accesoriosTotal: 4000,
        accesoriosCount: 1,
        abonosTotal: 0,
        abonosCount: 0,
        enganchesTotal: 0,
        enganchesCount: 0,
        reparacionesTotal: 0,
        reparacionesCount: 0,
        recargasTotal: 0,
        recargasCount: 0
      }
    }
  ],
  tickets,
  expenses: [],
  todayKey: '2026-10-03',
  currentBranch: branch,
  currentOperator: operator,
  openingFund: () => 0
});

const sept = roster.filter((r) => r.timestamp.startsWith('2026-09-01') || r.id.includes('2026-09-01'));
assert.equal(sept.length, 3, '1 de septiembre debe tener 3 sucursales');
assert.equal(assertThreeBranchesPerDay(roster), true);
assert.equal(sept.filter((r) => r.branchId === 'b-navojoa').length, 1);
assert.equal(sept.find((r) => r.branchId === 'b-navojoa')?.id, 'SES-NAV-1');

const days = [...new Set(roster.map((r) => corteDayKey(r)))].sort();
assert.equal(days[0], '2026-09-01');
assert.equal(days[days.length - 1], '2026-10-03');
assert.equal(days.includes('2026-09-15'), true, '15 de septiembre no se debe perder');
for (let cursor = '2026-09-01'; cursor <= '2026-10-03'; cursor = addCashDays(cursor, 1)) {
  assert.equal(days.includes(cursor), true, `falta el día ${cursor}`);
}

console.log('salesCortesBuild self-test ok');
