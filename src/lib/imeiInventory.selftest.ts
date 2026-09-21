import assert from 'node:assert/strict';
import type { Product, SaleTicket } from '../types';
import {
  addImeisToProduct,
  applyEquipmentIntegrity,
  collectSoldImeis,
  findImeiOnCatalog,
  findSoldImeiTicket,
  imeisAtBranch,
  locateImeiOnProduct,
  imeisEqual,
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
assert.equal(imeisEqual('351299123456789', ']351299123456789'), true);
assert.equal(imeisEqual('351299123456789', '3512991234567890'), true);
assert.equal(imeisEqual('HUA111', 'NAV111'), false);
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

const scannedOff = removeImeisFromProduct(
  phone({
    branchImeiMap: { 'b-navojoa': ['351299123456789'] },
    imeiList: ['351299123456789'],
    stock: 1
  }),
  [']351299123456789']
);
assert.deepEqual(scannedOff.branchImeiMap?.['b-navojoa'], []);
assert.equal(scannedOff.stock, 0);

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

const scannedIn = addImeisToProduct(
  phone({
    branchImeiMap: { 'b-navojoa': ['351299123456789'] },
    imeiList: ['351299123456789'],
    stock: 1
  }),
  'b-navojoa',
  [']C351299123456789']
);
assert.equal(scannedIn.stock, 1);
assert.deepEqual(imeisAtBranch(scannedIn, 'b-navojoa'), ['351299123456789']);

const scannedMove = moveImeisOnProduct(
  phone({
    branchImeiMap: { 'b-matriz': ['351299123456789'], 'b-navojoa': [], 'b-huatabampo': [] },
    imeiList: ['351299123456789'],
    stock: 1
  }),
  'b-matriz',
  'b-navojoa',
  [']351299123456789']
);
assert.deepEqual(imeisAtBranch(scannedMove, 'b-navojoa'), ['351299123456789']);
assert.deepEqual(imeisAtBranch(scannedMove, 'b-matriz'), []);
assert.equal(scannedMove.stock, 1);

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

const stillListed = phone({
  branchImeiMap: { 'b-navojoa': ['FFF'] },
  imeiList: ['FFF'],
  stock: 1
});
const tracedListed = traceImei('FFF', { products: [stillListed], tickets: [ticket] });
assert.equal(tracedListed.status, 'vendido');

const onlyImeisField = phone({
  imeis: ['3512 991234567'],
  imeiList: [],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': [] }
});
const catalogHit = findImeiOnCatalog([onlyImeisField], '3512991234567');
assert.equal(catalogHit?.product.id, 'prod-x');

const soldHit = findSoldImeiTicket([ticket], 'fff');
assert.equal(soldHit?.folio, 'NAV-0101-001');

console.log('imeiInventory self-test ok');
