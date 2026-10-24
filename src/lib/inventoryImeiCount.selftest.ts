import assert from 'node:assert/strict';
import type { Product, SaleTicket } from '../types.ts';
import {
  applyImeiCountScan,
  buildImeiCountReportSheet,
  expectedImeisForCount,
  isInventoryHistoryMovement,
  normalizeScannedImei
} from './inventoryImeiCount.ts';

const a16: Product = {
  id: 'p-a16',
  code: 'EQ-A16',
  name: 'Samsung A16',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 3500,
  stock: 2,
  branchImeiMap: {
    'b-matriz': ['351111111111111', '353333333333333'],
    'b-navojoa': ['352222222222222']
  }
};

const soldTicket: SaleTicket = {
  id: 'TCK-1',
  folio: 'MTZ-2410-001',
  timestamp: '2026-10-20T18:00:00-07:00',
  branchId: 'b-matriz',
  operatorName: 'Teresa',
  total: 3500,
  paymentMethod: 'Efectivo',
  items: [
    {
      cartItemId: 'c1',
      quantity: 1,
      unitPrice: 3500,
      totalPrice: 3500,
      product: a16,
      metadata: { saleType: 'credito', imei: '353333333333333' }
    }
  ]
};

assert.equal(normalizeScannedImei(']C1351111111111111'), '351111111111111');

const expected = expectedImeisForCount([a16], 'b-matriz', [], [soldTicket]);
assert.equal(expected.length, 1);
assert.equal(expected[0].imei, '351111111111111');

const counted = applyImeiCountScan({
  expected,
  scanned: ['351111111111111', '359999999999999', '352222222222222'],
  products: [a16],
  tickets: [soldTicket],
  branchId: 'b-matriz'
});
assert.equal(counted.foundCount, 1);
assert.equal(counted.missingCount, 0);
assert.equal(counted.extras.length, 2);
assert.ok(counted.extras.some((row) => row.kind === 'unknown' && row.imei.includes('3599')));
assert.ok(counted.extras.some((row) => row.kind === 'other_branch' && row.branchName === 'Navojoa'));

const soldGhost = applyImeiCountScan({
  expected,
  scanned: ['353333333333333'],
  products: [a16],
  tickets: [soldTicket],
  branchId: 'b-matriz'
});
assert.equal(soldGhost.extras[0].kind, 'sold');

const gap = applyImeiCountScan({
  expected,
  scanned: ['359999999999999'],
  products: [a16],
  tickets: [soldTicket],
  branchId: 'b-matriz'
});
assert.equal(gap.missingCount, 1);
assert.equal(gap.extras.length, 1);
const report = buildImeiCountReportSheet({ result: gap, branchId: 'b-matriz' });
const reportText = report.rows.map((row) => row.join('|')).join('\n');
assert.match(reportText, /NO MARCADOS/);
assert.match(reportText, /351111111111111/);
assert.match(reportText, /NO DETECTADOS/);
assert.match(reportText, /359999999999999/);
assert.ok(!reportText.includes('PayJoy'));

const okReport = buildImeiCountReportSheet({ result: counted, branchId: 'b-matriz' });
const okText = okReport.rows.map((row) => row.join('|')).join('\n');
assert.match(okText, /MARCADOS/);
assert.match(okText, /351111111111111/);
assert.match(okText, /359999999999999/);

assert.equal(isInventoryHistoryMovement('ingreso'), true);
assert.equal(isInventoryHistoryMovement('traspaso'), true);
assert.equal(isInventoryHistoryMovement('creacion'), true);
assert.equal(isInventoryHistoryMovement('venta'), false);
assert.equal(isInventoryHistoryMovement('ajuste'), false);

console.log('inventoryImeiCount self-test ok');
