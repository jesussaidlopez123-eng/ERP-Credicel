import assert from 'node:assert/strict';
import type { Product, SaleTicket } from '../types';
import {
  addImeisToProduct,
  applyEquipmentIntegrity,
  collectSoldImeis,
  imeisAtBranch,
  locateImeiOnProduct,
  moveImeisOnProduct,
  normalizeImei,
  removeImeisFromProduct,
  sanitizeEquipmentProduct,
  toInventoryBranchId,
  traceImei
} from './imeiInventory.ts';

const phone = (over: Partial<Product> = {}): Product => ({
  id: 'prod-x',
  code: 'CE-01',
  name: 'Redmi Note',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 4000,
  stock: 2,
  ...over
});

assert.equal(normalizeImei('  3512 99  '), '351299');
assert.equal(toInventoryBranchId('all'), 'b-matriz');
assert.equal(toInventoryBranchId('Administracion'), 'b-matriz');
assert.equal(toInventoryBranchId('sucursal-rara'), 'b-matriz');
assert.equal(toInventoryBranchId('navojoa'), 'b-navojoa');

const hidden = sanitizeEquipmentProduct(
  phone({
    stock: 1,
    imeiList: ['111111111111111'],
    branchImeiMap: { all: ['111111111111111'], 'b-nav': ['222222222222222'] }
  })
);
assert.deepEqual(hidden.branchImeiMap?.['b-matriz'], ['111111111111111']);
assert.deepEqual(hidden.branchImeiMap?.['b-navojoa'], ['222222222222222']);
assert.equal(hidden.stock, 2);
assert.ok(!hidden.branchImeiMap?.all);

const soldStay = removeImeisFromProduct(
  phone({
    branchImeiMap: { 'b-matriz': ['AAA'], 'b-navojoa': ['BBB'] },
    imeiList: ['AAA', 'BBB'],
    stock: 2
  }),
  ['bbb']
);
assert.deepEqual(soldStay.branchImeiMap?.['b-matriz'], ['AAA']);
assert.deepEqual(soldStay.branchImeiMap?.['b-navojoa'], []);
assert.equal(soldStay.stock, 1);

const moved = moveImeisOnProduct(
  phone({
    branchImeiMap: { 'b-matriz': ['CCC'], 'b-navojoa': [], 'b-huatabampo': [] },
    imeiList: ['CCC'],
    stock: 1
  }),
  'b-matriz',
  'b-huatabampo',
  ['CCC']
);
assert.deepEqual(imeisAtBranch(moved, 'b-huatabampo'), ['CCC']);
assert.deepEqual(imeisAtBranch(moved, 'b-matriz'), []);

const added = addImeisToProduct(phone({ stock: 0, imeiList: [] }), 'b-navojoa', ['DDD']);
assert.deepEqual(imeisAtBranch(added, 'b-navojoa'), ['DDD']);

const loc = locateImeiOnProduct(
  phone({ branchImeiMap: { all: ['EEE'] }, imeiList: ['EEE'] }),
  'eee'
);
assert.equal(loc?.branchId, 'b-matriz');
assert.equal(loc?.hidden, true);

const preferHua = locateImeiOnProduct(
  phone({
    branchImeiMap: { 'b-bodega': ['HUA111'], 'b-huatabampo': ['HUA111'] },
    imeiList: ['HUA111']
  }),
  'HUA111'
);
assert.equal(preferHua?.branchId, 'b-huatabampo');
assert.equal(preferHua?.hidden, false);

const dangling = sanitizeEquipmentProduct(
  phone({
    stock: 2,
    imeiList: ['AAA', 'BBB'],
    branchImeiMap: { 'b-navojoa': ['AAA'] }
  })
);
assert.deepEqual(imeisAtBranch(dangling, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(dangling, 'b-matriz'), []);
assert.deepEqual(dangling.imeiList?.includes('BBB'), true);
assert.equal(dangling.stock, 2);

const ticket = {
  id: 't1',
  folio: 'NAV-0101-001',
  timestamp: '2026-09-01T18:00:00.000Z',
  branchId: 'b-navojoa',
  branchName: 'Navojoa',
  operatorName: 'Said',
  items: [
    {
      product: { id: 'prod-x', code: 'CE-01', name: 'Redmi Note', category: 'equipo_credito', price: 4000, stock: 0 },
      quantity: 1,
      unitPrice: 4000,
      totalPrice: 4000,
      paymentMethod: 'Efectivo',
      metadata: { saleType: 'contado', imei: 'FFF' }
    }
  ]
} as unknown as SaleTicket;

const sold = collectSoldImeis([ticket]);
assert.equal(sold.has('FFF'), true);

const reconciled = applyEquipmentIntegrity(
  [
    phone({
      branchImeiMap: { 'b-navojoa': ['FFF', 'GGG'] },
      imeiList: ['FFF', 'GGG'],
      stock: 2
    })
  ],
  sold
);
assert.deepEqual(reconciled.changed[0].imeiList, ['GGG']);
assert.equal(reconciled.changed[0].stock, 1);

const traced = traceImei('FFF', { products: reconciled.next, tickets: [ticket] });
assert.equal(traced.status, 'vendido');
assert.equal(traced.ticket?.folio, 'NAV-0101-001');

console.log('imeiInventory self-test ok');
