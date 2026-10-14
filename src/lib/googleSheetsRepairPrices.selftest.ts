import assert from 'node:assert/strict';
import {
  gvizTableToRows,
  looksLikeGoogleLoginHtml,
  parseGoogleSheetsUrl,
  parseGvizText,
  repairPricesFromPastedText,
  SHEET_PRIVATE_ERROR
} from './googleSheetsRepairPrices.ts';
import { repairPricesFromTable } from './repairPriceCatalog.ts';

const ref = parseGoogleSheetsUrl(
  'https://docs.google.com/spreadsheets/d/1xaIQBbZNFCaFBXCRPJoHF8sTj7HfE9NfwMKXWFYdqYQ/edit?gid=1066474966#gid=1066474966'
);
assert.equal(ref.id, '1xaIQBbZNFCaFBXCRPJoHF8sTj7HfE9NfwMKXWFYdqYQ');
assert.equal(ref.gid, '1066474966');

assert.equal(parseGoogleSheetsUrl('1xaIQBbZNFCaFBXCRPJoHF8sTj7HfE9NfwMKXWFYdqYQ').gid, '0');

const gviz = parseGvizText(
  `/*O_o*/\ngoogle.visualization.Query.setResponse({"status":"ok","table":{"cols":[{"id":"A","label":"Modelo","type":"string"},{"id":"B","label":"Precio","type":"number"}],"rows":[{"c":[{"v":"iPhone 11"},{"v":850,"f":"$850.00"}]},{"c":[{"v":"Galaxy A54"},{"v":1450}]}]}});`
);
const rows = gvizTableToRows(gviz);
assert.equal(rows[0][0], 'Modelo');
assert.equal(rows[1][1], '$850.00');

const fromGviz = repairPricesFromTable(rows);
assert.equal(fromGviz.length, 2);
assert.equal(fromGviz[0].price, 850);
assert.equal(fromGviz[0].brand, 'Apple');

const pasted = repairPricesFromPastedText('Modelo\tPrecio\nMoto G54\t780\n');
assert.equal(pasted[0].model, 'Moto G54');
assert.equal(pasted[0].price, 780);
assert.equal(pasted[0].serviceName, 'Cambio de pantalla');

const titled = repairPricesFromTable([
  ['Lista de pantallas 2026'],
  ['Modelo', 'Precio'],
  ['iPhone 14', '2100']
]);
assert.equal(titled.length, 1);
assert.equal(titled[0].model, 'iPhone 14');
assert.equal(titled[0].price, 2100);

assert.equal(looksLikeGoogleLoginHtml('<!DOCTYPE html><html><body>ServiceLogin</body></html>'), true);

try {
  gvizTableToRows({ status: 'error', errors: [{ reason: 'access_denied' }] });
  assert.fail('debía fallar con hoja privada');
} catch (err) {
  assert.ok(err instanceof Error);
  assert.equal((err as Error).message, SHEET_PRIVATE_ERROR);
}

console.log('googleSheetsRepairPrices self-test ok');
