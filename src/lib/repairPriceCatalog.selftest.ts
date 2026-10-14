import assert from 'node:assert/strict';
import { buildXlsxBytes } from './xlsxMinimal.ts';
import { parseSpreadsheetTable } from './xlsxRead.ts';
import {
  applyRepairPriceToReception,
  inferRepairBrand,
  mergeRepairPriceCatalog,
  parseRepairPriceAmount,
  repairPriceFingerprint,
  repairPricesFromSpreadsheet,
  repairPricesFromTable,
  searchRepairPrices
} from './repairPriceCatalog.ts';

assert.equal(parseRepairPriceAmount('$1,350.00'), 1350);
assert.equal(parseRepairPriceAmount('1.350,50'), 1350.5);
assert.equal(inferRepairBrand('iPhone 13 Pro'), 'Apple');
assert.equal(inferRepairBrand('Galaxy A54 5G'), 'Samsung');

const fromSimple = repairPricesFromTable([
  ['Modelo', 'Precio'],
  ['iPhone 11', '850'],
  ['Galaxy A54', '1450']
]);
assert.equal(fromSimple.length, 2);
assert.equal(fromSimple[0].serviceName, 'Cambio de pantalla');
assert.equal(fromSimple[0].category, 'Pantalla');
assert.equal(fromSimple[0].price, 850);
assert.equal(fromSimple[0].brand, 'Apple');

const bytes = buildXlsxBytes([
  {
    name: 'Precios',
    rows: [
      ['Marca', 'Modelo', 'Servicio', 'Categoria', 'Precio'],
      ['Apple', 'iPhone 12', 'Cambio de pantalla', 'Pantalla', 1350]
    ]
  }
]);
const sheet = await parseSpreadsheetTable(bytes, 'precios.xlsx');
assert.equal(sheet[1][1], 'iPhone 12');
const fromXlsx = await repairPricesFromSpreadsheet(bytes, 'precios.xlsx');
assert.equal(fromXlsx[0].price, 1350);
assert.equal(fromXlsx[0].model, 'iPhone 12');

const csv = repairPricesFromTable([
  ['marca', 'modelo', 'servicio', 'precio'],
  ['Samsung', 'A14', 'Cambio de pantalla', '750']
]);
const merged = mergeRepairPriceCatalog(fromSimple, csv);
assert.equal(merged.added, 1);
assert.ok(merged.next.some((row) => row.model === 'A14' && row.price === 750));

const hits = searchRepairPrices(
  [
    { id: '1', brand: 'Apple', model: 'iPhone 11', serviceName: 'Cambio de pantalla', category: 'Pantalla', price: 850 },
    { id: '2', brand: 'Apple', model: 'iPhone 11', serviceName: 'Cambio de batería', category: 'Batería', price: 550 },
    { id: '3', brand: 'Samsung', model: 'Galaxy A54', serviceName: 'Cambio de pantalla', category: 'Pantalla', price: 1450 }
  ],
  'iphone 11 pantalla'
);
assert.equal(hits.length, 1);
assert.equal(hits[0].price, 850);

const applied = applyRepairPriceToReception(hits[0]);
assert.equal(applied.deviceModel, 'Apple iPhone 11');
assert.equal(applied.totalCost, '850.00');
assert.ok(repairPriceFingerprint(hits[0]).includes('iphone 11'));

console.log('repairPriceCatalog self-test ok');
