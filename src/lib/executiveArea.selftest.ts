import assert from 'node:assert/strict';
import type { RepairRecord, SaleTicket } from '../types';
import { emptyExecutiveCats } from './saleClassification.ts';
import { buildExecutiveFinance } from './executiveFinance.ts';
import {
  addExecutiveAreaTotals,
  areaStackValues,
  buildExecutiveLinePoints,
  linePointTitle,
  matchesExecutiveBranch,
  repairFinanceWeekStarts,
  resolveExecutiveLineRange,
  sumRepairCostLines,
  sumRepairCostLinesInWeek
} from './executiveArea.ts';

const repair: RepairRecord = {
  id: 'REP-1',
  clientName: 'Cliente',
  clientPhone: '6440000000',
  deviceModel: 'Samsung A',
  issueDescription: 'Pantalla',
  status: 'en_taller',
  receivedAt: '07/09/2026',
  receivedAtIso: '2026-09-07T12:00:00.000Z',
  totalCost: 1200,
  advancePayment: 500,
  pendingBalance: 700,
  operatorName: 'Op',
  branchId: 'b-navojoa',
  costLines: [
    {
      id: 'c1',
      kind: 'refaccion',
      concept: 'Display',
      amount: 400,
      at: '2026-09-08T22:00:00.000Z',
      by: 'Op'
    },
    {
      id: 'c2',
      kind: 'mano_obra',
      concept: 'Mano de obra',
      amount: 150,
      at: '2026-09-08T22:30:00.000Z',
      by: 'Op'
    }
  ]
};

assert.equal(matchesExecutiveBranch('b-navojoa', 'all'), true);
assert.equal(matchesExecutiveBranch('Navojoa', 'b-navojoa'), true);
assert.equal(matchesExecutiveBranch('b-huatabampo', 'b-navojoa'), false);

const week = '2026-09-07';
assert.equal(sumRepairCostLinesInWeek([repair], week, { kinds: ['refaccion'] }), 400);
assert.equal(sumRepairCostLinesInWeek([repair], week), 550);
assert.equal(sumRepairCostLinesInWeek([repair], week, { branchId: 'b-huatabampo' }), 0);
assert.equal(sumRepairCostLines([repair], '2026-09-08', '2026-09-08', { kinds: ['refaccion'] }), 400);
assert.equal(sumRepairCostLines([repair], '2026-09-01', '2026-09-07', { kinds: ['refaccion'] }), 0);
assert.ok(repairFinanceWeekStarts([repair]).includes(week));

const cancelled: RepairRecord = { ...repair, id: 'REP-X', status: 'cancelado' };
assert.equal(sumRepairCostLinesInWeek([cancelled], week, { kinds: ['refaccion'] }), 0);

const cats = emptyExecutiveCats();
cats.accesorios = 800;
cats.reparaciones = 500;
cats.abonos = 2000;
const fin = buildExecutiveFinance({
  branchId: 'b-navojoa',
  cats,
  gastos: 100,
  phonesSold: 2,
  tallerCostos: 550,
  inversion: 400
});
assert.equal(fin.inversion, 400);
assert.equal(fin.tallerCostos, 550);
assert.equal(fin.comisiones, 2000);
assert.equal(fin.utilidad, 2750);
assert.equal(fin.resultado, 2650);
assert.equal(fin.dineroPaso, 2000);

const stacked = areaStackValues({ utilidad: -20, inversion: 400, gastos: 100, retorno: 50 });
assert.equal(stacked.utilidad, 0);
assert.equal(stacked.inversion, 400);

const sum = addExecutiveAreaTotals(
  { utilidad: 100, inversion: 10, gastos: 5, retorno: 1 },
  { utilidad: 50, inversion: 20, gastos: 5, retorno: 2 }
);
assert.equal(sum.utilidad, 150);
assert.equal(sum.inversion, 30);

const weekRange = resolveExecutiveLineRange('semana', {
  weekStart: '2026-09-07',
  rangeFrom: '2026-09-01',
  rangeTo: '2026-09-30',
  today: '2026-09-14'
});
assert.equal(weekRange.days.length, 7);
assert.equal(weekRange.from, '2026-09-07');
assert.equal(weekRange.to, '2026-09-13');

const monthRange = resolveExecutiveLineRange('mes', {
  weekStart: '2026-09-07',
  monthDateKey: '2026-09-07',
  rangeFrom: '',
  rangeTo: '',
  today: '2026-09-14'
});
assert.equal(monthRange.from, '2026-09-01');
assert.equal(monthRange.to, '2026-09-14');
assert.equal(monthRange.days[0], '2026-09-01');
assert.equal(monthRange.days[monthRange.days.length - 1], '2026-09-14');

const openRange = resolveExecutiveLineRange('rango', {
  weekStart: '2026-09-07',
  rangeFrom: '2026-09-10',
  rangeTo: '2026-09-12',
  today: '2026-09-14'
});
assert.deepEqual(openRange.days, ['2026-09-10', '2026-09-11', '2026-09-12']);

assert.match(linePointTitle('2026-09-08', 'semana'), /8/);
assert.equal(linePointTitle('2026-09-08', 'mes'), '8');

const ticket: SaleTicket = {
  id: 't1',
  timestamp: '2026-09-08T18:00:00.000Z',
  branchId: 'b-navojoa',
  operatorName: 'Op',
  total: 200,
  paymentMethod: 'Efectivo',
  items: [
    {
      cartItemId: 'i1',
      product: { id: 'a', code: 'A', name: 'Mica', category: 'accesorio', price: 200, stock: 1 },
      quantity: 1,
      unitPrice: 200,
      totalPrice: 200
    }
  ]
};

const points = buildExecutiveLinePoints({
  days: ['2026-09-07', '2026-09-08', '2026-09-09'],
  tickets: [ticket],
  expenses: [],
  repairs: [repair],
  branchId: 'b-navojoa',
  period: 'semana'
});
assert.equal(points.length, 3);
assert.equal(points[0].utilidad, 0);
assert.equal(points[1].utilidad, -350);
assert.equal(points[1].inversion, 400);
assert.equal(points[2].inversion, 0);

console.log('executiveArea self-test ok');
