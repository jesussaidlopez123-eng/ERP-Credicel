import assert from 'node:assert/strict';
import { buildXlsxBytes } from './xlsxMinimal.ts';
import { parseSpreadsheetTable } from './xlsxRead.ts';
import { SCREEN_SALE_PRICES } from '../data/initialRepairPrices.ts';
import {
  applyRepairPriceToReception,
  inferRepairBrand,
  mergeRepairPriceCatalog,
  parseRepairPriceAmount,
  repairPriceFingerprint,
  repairPricePickLabel,
  repairPricesFromSpreadsheet,
  repairPricesFromTable,
  searchRepairPrices
} from './repairPriceCatalog.ts';

assert.equal(parseRepairPriceAmount('$1,350.00'), 1350);
assert.equal(parseRepairPriceAmount('1.350,50'), 1350.5);
assert.equal(inferRepairBrand('iPhone 13 Pro'), 'Apple');
assert.equal(inferRepairBrand('Galaxy A54 5G'), 'Samsung');
assert.equal(inferRepairBrand('PANTALLA SAM NOTE 10 PLUS N975'), 'Samsung');
assert.equal(inferRepairBrand('PANTALLA GOOGLE PIXEL 8 OLED'), 'Google');
assert.equal(inferRepairBrand('PANTALLA CUBOT KINGKONG 8'), 'Cubot');
assert.equal(inferRepairBrand('PANTALLA MOTO G54 XT-2343-1 ORIGINAL'), 'Motorola');

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
assert.equal(repairPricePickLabel(hits[0]), 'Apple iPhone 11');
assert.ok(repairPriceFingerprint(hits[0]).includes('iphone 11'));

const fromProducto = repairPricesFromTable([
  ['Producto', 'Precio Venta (x2.7)'],
  ['PANTALLA IPHONE 11 ORIGINAL >>I', '$1,025.00'],
  ['PANTALLA SAMSUNG A54 5G ORIGINAL CON MARCO', '$3,780.00']
]);
assert.equal(fromProducto.length, 2);
assert.equal(fromProducto[0].price, 1025);
assert.equal(fromProducto[0].brand, 'Apple');
assert.equal(fromProducto[1].price, 3780);
assert.equal(fromProducto[1].brand, 'Samsung');

assert.ok(SCREEN_SALE_PRICES.length >= 720, `catálogo corto: ${SCREEN_SALE_PRICES.length}`);
assert.ok(SCREEN_SALE_PRICES.some((row) => /flex "u"/i.test(row.model) && row.price === 730));
const iphone11 = searchRepairPrices(SCREEN_SALE_PRICES, 'iphone 11 original', 8);
assert.ok(iphone11.some((row) => row.price === 1025));
const a54 = searchRepairPrices(SCREEN_SALE_PRICES, 'a54 original', 8);
assert.ok(a54.some((row) => row.price === 3780));
const blue = searchRepairPrices(SCREEN_SALE_PRICES, 'blue g64l', 5);
assert.equal(blue[0]?.price, 1040);
assert.equal(searchRepairPrices(SCREEN_SALE_PRICES, '', 10).length, 0);

const a30 = SCREEN_SALE_PRICES.filter((row) => /a30\/a305 oled negro$/i.test(row.model));
assert.equal(a30.length, 2);

console.log('repairPriceCatalog self-test ok');
