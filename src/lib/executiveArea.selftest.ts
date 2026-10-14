import assert from 'node:assert/strict';
import type { RepairRecord } from '../types';
import { emptyExecutiveCats } from './saleClassification.ts';
import { buildExecutiveFinance } from './executiveFinance.ts';
import {
  addExecutiveAreaTotals,
  areaStackValues,
  matchesExecutiveBranch,
  repairFinanceWeekStarts,
  sumRepairCostLines
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
assert.equal(sumRepairCostLines([repair], week, { kinds: ['refaccion'] }), 400);
assert.equal(sumRepairCostLines([repair], week), 550);
assert.equal(sumRepairCostLines([repair], week, { branchId: 'b-huatabampo' }), 0);
assert.equal(sumRepairCostLines([repair], week, { branchId: 'b-navojoa', kinds: ['refaccion'] }), 400);
assert.ok(repairFinanceWeekStarts([repair]).includes(week));

const cancelled: RepairRecord = { ...repair, id: 'REP-X', status: 'cancelado' };
assert.equal(sumRepairCostLines([cancelled], week, { kinds: ['refaccion'] }), 0);

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

console.log('executiveArea self-test ok');
