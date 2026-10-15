import assert from 'node:assert/strict';
import type { Expense, RepairRecord, SaleTicket } from '../types';
import { emptyExecutiveCats } from './saleClassification.ts';
import { buildExecutiveFinance } from './executiveFinance.ts';
import {
  addExecutiveAreaTotals,
  areaStackValues,
  buildExecutiveLinePoints,
  countPhonesSold,
  executiveTramoSegments,
  listPhonesSold,
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
assert.equal(fin.utilidad, 750, 'comisión fuera de la utilidad de caja');
assert.equal(fin.resultado, 650);
assert.equal(fin.dineroPaso, 2000);

const stacked = areaStackValues({ utilidad: -20, comisiones: 80, inversion: 400, gastos: 100, retorno: 50 });
assert.equal(stacked.utilidad, 0);
assert.equal(stacked.comisiones, 80);
assert.equal(stacked.inversion, 400);

const sum = addExecutiveAreaTotals(
  { utilidad: 100, comisiones: 40, inversion: 10, gastos: 5, retorno: 1 },
  { utilidad: 50, comisiones: 10, inversion: 20, gastos: 5, retorno: 2 }
);
assert.equal(sum.utilidad, 150);
assert.equal(sum.comisiones, 50);
assert.equal(sum.inversion, 30);

const tramo = executiveTramoSegments({ utilidad: 50, comisiones: 0, inversion: 30, gastos: 20, retorno: 0 });
assert.equal(tramo.length, 3);
assert.equal(tramo[0].id, 'utilidad');
assert.equal(tramo[0].pct, 50);
assert.equal(tramo[1].pct, 30);
assert.equal(tramo[2].pct, 20);

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
assert.equal(points[1].comisiones, 0);
assert.equal(points[1].inversion, 400);
assert.equal(points[2].inversion, 0);

const lateRepair: RepairRecord = {
  ...repair,
  id: 'REP-LATE',
  status: 'entregado',
  deliveredAtIso: '2026-09-08T18:00:00-07:00',
  costLines: [
    {
      id: 'c-late',
      kind: 'refaccion',
      concept: 'Flex',
      amount: 220,
      at: '2026-09-09T10:00:00-07:00',
      by: 'Taller'
    }
  ]
};
assert.equal(sumRepairCostLines([lateRepair], '2026-09-08', '2026-09-08', { kinds: ['refaccion'] }), 220);
assert.equal(sumRepairCostLines([lateRepair], '2026-09-09', '2026-09-09', { kinds: ['refaccion'] }), 0);

const matrizPiece: Expense = {
  id: 'GTO-REP-LATE',
  amount: 220,
  concept: 'Refacción taller REP-LATE',
  timestamp: '2026-09-08T18:00:00-07:00',
  operatorName: 'Taller',
  branchId: 'b-matriz',
  kind: 'refaccion_taller',
  repairId: 'REP-LATE',
  countsAsCashOut: false
};
const matrizPoints = buildExecutiveLinePoints({
  days: ['2026-09-08'],
  tickets: [],
  expenses: [matrizPiece],
  repairs: [lateRepair],
  branchId: 'b-matriz',
  period: 'semana'
});
assert.equal(matrizPoints[0].gastos, 0, 'el gasto etiquetado no se duplica en rojo');
assert.equal(matrizPoints[0].inversion, 0, 'la pieza de Navojoa no se cuenta como inversión de Matriz');

const navojoaLate = buildExecutiveLinePoints({
  days: ['2026-09-08'],
  tickets: [],
  expenses: [matrizPiece],
  repairs: [lateRepair],
  branchId: 'b-navojoa',
  period: 'semana'
});
assert.equal(navojoaLate[0].inversion, 220);
assert.equal(navojoaLate[0].utilidad, -220);

const phoneTicket: SaleTicket = {
  id: 't-phone',
  timestamp: '2026-09-08T19:00:00-07:00',
  branchId: 'b-navojoa',
  operatorName: 'Op',
  total: 1500,
  paymentMethod: 'Efectivo',
  items: [
    {
      cartItemId: 'p1',
      product: { id: 'eq', code: 'EQ', name: 'A16', category: 'equipo_credito', price: 1500, stock: 1 },
      quantity: 1,
      unitPrice: 1500,
      totalPrice: 1500,
      metadata: { saleType: 'contado', imei: '351111111111111', deviceModel: 'A16' }
    }
  ]
};
const phonePoints = buildExecutiveLinePoints({
  days: ['2026-09-08'],
  tickets: [phoneTicket],
  expenses: [],
  repairs: [],
  branchId: 'b-navojoa',
  period: 'semana'
});
assert.equal(phonePoints[0].comisiones, 1000);
assert.equal(phonePoints[0].utilidad, 0, 'la comisión no se suma al verde de caja');
assert.equal(phonePoints[0].retorno, 1500);
assert.equal(phonePoints[0].equiposVendidos, 1);

const creditTicket: SaleTicket = {
  ...phoneTicket,
  id: 't-credit',
  timestamp: '2026-09-09T11:00:00-07:00',
  branchId: 'b-huatabampo',
  items: [
    {
      cartItemId: 'p2',
      product: { id: 'eq2', code: 'EQ2', name: 'A16', category: 'equipo_credito', price: 800, stock: 1 },
      quantity: 1,
      unitPrice: 800,
      totalPrice: 800,
      metadata: {
        saleType: 'credito',
        imei: '352222222222222',
        deviceModel: 'A16',
        downPayment: 800,
        clientName: 'María López',
        clientPhone: '6471234567'
      }
    }
  ]
};
const cancelledPhone: SaleTicket = {
  ...phoneTicket,
  id: 't-cancel',
  estado: 'CANCELADA',
  timestamp: '2026-09-08T20:00:00-07:00'
};
const counted = countPhonesSold({
  tickets: [ticket, phoneTicket, creditTicket, cancelledPhone],
  from: '2026-09-07',
  to: '2026-09-10',
  branchId: 'all'
});
assert.equal(counted.total, 2, 'un accesorio y un cancelado no cuentan');
assert.equal(counted.contado, 1);
assert.equal(counted.credito, 1);
assert.equal(counted.byBranch.find((row) => row.id === 'b-navojoa')?.total, 1);
assert.equal(counted.byBranch.find((row) => row.id === 'b-huatabampo')?.credito, 1);
assert.equal(
  countPhonesSold({
    tickets: [phoneTicket, creditTicket],
    from: '2026-09-07',
    to: '2026-09-10',
    branchId: 'b-navojoa'
  }).total,
  1
);

const listed = listPhonesSold({
  tickets: [ticket, phoneTicket, creditTicket, cancelledPhone],
  from: '2026-09-07',
  to: '2026-09-10',
  branchId: 'all'
});
assert.equal(listed.length, 2, 'la lista coincide con el contador');
assert.equal(listed[0].imei, '352222222222222', 'la más reciente primero');
assert.equal(listed[0].model, 'A16');
assert.equal(listed[0].clientName, 'María López');
assert.equal(listed[0].clientPhone, '6471234567');
assert.equal(listed[0].operatorName, 'Op');
assert.equal(listed[0].saleKind, 'credito');
assert.equal(listed[1].imei, '351111111111111');
assert.equal(listed[1].clientName, 'Mostrador');
assert.equal(listed[1].saleKind, 'contado');
assert.equal(
  listPhonesSold({
    tickets: [phoneTicket, creditTicket],
    from: '2026-09-07',
    to: '2026-09-10',
    branchId: 'b-navojoa'
  }).length,
  1
);

const imeiFromTicket: SaleTicket = {
  ...phoneTicket,
  id: 't-imei-ticket',
  timestamp: '2026-09-10T10:00:00-07:00',
  operatorName: 'Teresa',
  items: [
    {
      cartItemId: 'p3',
      product: { id: 'eq3', code: 'EQ3', name: 'A05', category: 'equipo_credito', price: 1200, stock: 1 },
      quantity: 1,
      unitPrice: 1200,
      totalPrice: 1200,
      metadata: { saleType: 'contado', deviceModel: 'Motorola A05', clientName: 'Juan Pérez', clientPhone: '6440001111' }
    }
  ],
  imeis: ['353333333333333']
};
const fallbackImei = listPhonesSold({
  tickets: [imeiFromTicket],
  from: '2026-09-07',
  to: '2026-09-10',
  branchId: 'all'
});
assert.equal(fallbackImei.length, 1);
assert.equal(fallbackImei[0].imei, '353333333333333', 'el IMEI del ticket cubre la línea');
assert.equal(fallbackImei[0].dateKey, '2026-09-10');
assert.equal(fallbackImei[0].model, 'Motorola A05');
assert.equal(fallbackImei[0].clientName, 'Juan Pérez');
assert.equal(fallbackImei[0].clientPhone, '6440001111');
assert.equal(fallbackImei[0].operatorName, 'Teresa');

console.log('executiveArea self-test ok');
