import assert from 'node:assert/strict';
import { emptyExecutiveCats } from './saleClassification.ts';
import {
  addExecutiveFinance,
  buildExecutiveFinance,
  executiveOwnIncome,
  executivePassThrough,
  phoneCommissionAmount,
  phoneCommissionRate
} from './executiveFinance.ts';

assert.equal(phoneCommissionRate('b-navojoa'), 1000);
assert.equal(phoneCommissionRate('Navojoa'), 1000);
assert.equal(phoneCommissionRate('b-huatabampo'), 350);
assert.equal(phoneCommissionRate('b-bodega'), 0);
assert.equal(phoneCommissionRate('all'), 0);
assert.equal(phoneCommissionAmount('all', 10), 0);
assert.equal(phoneCommissionAmount('b-navojoa', 3), 3000);
assert.equal(phoneCommissionAmount('b-huatabampo', 2), 700);

const cats = emptyExecutiveCats();
cats.accesorios = 800;
cats.reparaciones = 200;
cats.abonos = 5000;
cats.equipos = 4000;
cats.recargas = 300;
assert.equal(executiveOwnIncome(cats), 1000);
assert.equal(executivePassThrough(cats), 9300);

const navojoa = buildExecutiveFinance({
  branchId: 'b-navojoa',
  cats,
  gastos: 150,
  phonesSold: 2
});
assert.equal(navojoa.ingresosPropios, 1000);
assert.equal(navojoa.comisiones, 2000);
assert.equal(navojoa.dineroPaso, 9300);
assert.equal(navojoa.gastos, 150);
assert.equal(navojoa.resultado, 2850);

const huata = buildExecutiveFinance({
  branchId: 'b-huatabampo',
  cats: emptyExecutiveCats(),
  gastos: 100,
  phonesSold: 1
});
assert.equal(huata.comisiones, 350);
assert.equal(huata.resultado, 250);

const sum = addExecutiveFinance(navojoa, huata);
assert.equal(sum.comisiones, 2350);
assert.equal(sum.resultado, 3100);

console.log('executiveFinance self-test ok');
