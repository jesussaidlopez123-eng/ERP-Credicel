import assert from 'node:assert/strict';
import type { Branch, CorteXRecord, Operator, SaleTicket } from '../types';
import { assertThreeBranchesPerDay } from './corteDayRoster.ts';
import { branchDateKey, indexByBranchDate } from './branchDateIndex.ts';
import { corteDayKey } from './corteDayRoster.ts';
import { addCashDays } from './dateUtils.ts';
import { buildCortesRoster, liveShiftCashierName, todayBranchStats } from './salesCortesBuild.ts';

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

assert.equal(
  liveShiftCashierName({
    branchId: 'b-matriz',
    sessionCashier: 'Teresa',
    tickets: [{ ...tickets[0], branchId: 'b-matriz', operatorName: 'Geraldín', timestamp: '2026-10-11T10:00:00-07:00' }]
  }),
  'Teresa',
  'el cajero del turno abierto gana sobre un ticket viejo de otra persona'
);
assert.equal(
  liveShiftCashierName({
    branchId: 'b-huatabampo',
    sessionCashier: 'Geraldín',
    tickets: []
  }),
  'Geraldín'
);
assert.equal(
  liveShiftCashierName({
    branchId: 'b-matriz',
    tickets: [
      { ...tickets[0], branchId: 'b-matriz', operatorName: 'Geraldín', timestamp: '2026-10-11T09:00:00-07:00' },
      { ...tickets[0], id: 't-new', branchId: 'b-matriz', operatorName: 'Teresa', timestamp: '2026-10-11T11:00:00-07:00' }
    ]
  }),
  'Teresa',
  'sin sesión, se toma el último ticket de esa sucursal'
);

const liveStats = todayBranchStats(
  [
    { ...tickets[0], branchId: 'b-matriz', operatorName: 'Geraldín', timestamp: '2026-10-11T09:00:00-07:00' },
    { ...tickets[1], branchId: 'b-huatabampo', operatorName: 'Geraldín', timestamp: '2026-10-11T09:30:00-07:00' }
  ],
  [],
  '2026-10-11',
  (branchId) => (branchId === 'b-matriz' ? 1000 : 0),
  { 'b-matriz': 'Teresa', 'b-huatabampo': 'Geraldín' }
);
assert.equal(liveStats.find((row) => row.branchId === 'b-matriz')?.currentShiftOperator, 'Teresa');
assert.equal(liveStats.find((row) => row.branchId === 'b-huatabampo')?.currentShiftOperator, 'Geraldín');
assert.equal(liveStats.find((row) => row.branchId === 'b-matriz')?.initialCashFund, 1000);
assert.equal(
  liveStats.find((row) => row.branchId === 'b-matriz')?.expectedCashInDrawer,
  1100,
  'fondo inicial + efectivo del día'
);

const emptyMorning: CorteXRecord = {
  id: 'SES-MTZ-20261016-AM',
  timestamp: '2026-10-16T18:35:03.227Z',
  dateStr: '16/10/2026',
  timeStr: '11:35 a.m.',
  branchId: 'b-matriz',
  branchName: 'Matriz',
  operatorName: 'Teresa',
  initialCashFund: 80,
  cashSales: 0,
  cardSales: 0,
  transferSales: 0,
  totalSales: 0,
  totalExpenses: 0,
  netIncome: 0,
  expectedCashInDrawer: 80,
  ticketIds: [],
  expenseIds: [],
  ticketsSnapshot: [],
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
const middayTickets: SaleTicket[] = [
  {
    id: 't-am',
    folio: 'MTZ-1610-001',
    timestamp: '2026-10-16T17:20:00.000Z',
    branchId: 'b-matriz',
    operatorName: 'Teresa',
    items: [],
    total: 915,
    paymentMethod: 'Efectivo',
    corteXId: 'SES-MTZ-20261016-AM',
    sesion_caja_id: 'SES-MTZ-20261016-AM'
  } as SaleTicket,
  {
    id: 't-pm',
    folio: 'MTZ-1610-026',
    timestamp: '2026-10-16T19:04:29.492Z',
    branchId: 'b-matriz',
    operatorName: 'Teresa',
    items: [],
    total: 419,
    paymentMethod: 'Efectivo',
    sesion_caja_id: 'SES-MTZ-20261016-PM'
  } as SaleTicket
];
const liveAfterClose = buildCortesRoster({
  cortes: [emptyMorning],
  tickets: middayTickets,
  expenses: [],
  todayKey: '2026-10-16',
  currentBranch: { id: 'b-matriz', name: 'Matriz' },
  currentOperator: operator,
  openingFund: () => 80,
  openCashiersByBranch: { 'b-matriz': 'Teresa Lopez' },
  now: new Date('2026-10-16T12:20:00-07:00')
});
const matrizToday = liveAfterClose.find(
  (row) => row.branchId === 'b-matriz' && (row.timestamp || '').startsWith('2026-10-16')
);
assert.equal(matrizToday?.id.startsWith('CTX-TURNO'), true, 'el turno reabierto no debe verse como corte cerrado');
assert.equal(matrizToday?.totalSales, 1334, 'las ventas de la mañana y la tarde entran al turno en curso');
assert.equal((matrizToday?.ticketIds || []).length, 2);

console.log('salesCortesBuild self-test ok');
