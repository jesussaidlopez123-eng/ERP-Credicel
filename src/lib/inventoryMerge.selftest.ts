import assert from 'node:assert/strict';
import type { Product } from '../types';
import { accessoryStockAt } from './accessoryInventory.ts';
import { imeisAtBranch, unmappedImeis } from './imeiInventory.ts';
import { applyInventoryWrite, snapshotInventory } from './inventoryMerge.ts';

const mica = (over: Partial<Product> = {}): Product => ({
  id: 'prod-mica',
  code: 'CA01',
  name: 'Micas',
  category: 'accesorio',
  inventoryType: 'accesorio',
  price: 50,
  stock: 0,
  ...over
});

const phone = (over: Partial<Product> = {}): Product => ({
  id: 'prod-phone',
  code: 'EQ-01',
  name: 'SAM A16',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 4000,
  stock: 0,
  ...over
});

const serverAcc = mica({
  stock: 155,
  branchStock: { 'b-navojoa': 155, 'b-huatabampo': 412, 'b-matriz': 0 }
});
const staleHua = mica({
  stock: 412,
  branchStock: { 'b-navojoa': 0, 'b-huatabampo': 412, 'b-matriz': 0 }
});
const afterHuaSale = mica({
  stock: 411,
  branchStock: { 'b-navojoa': 0, 'b-huatabampo': 411, 'b-matriz': 0 }
});

const mergedSale = applyInventoryWrite(serverAcc, afterHuaSale, snapshotInventory(staleHua));
assert.equal(accessoryStockAt(mergedSale, 'b-navojoa'), 155);
assert.equal(accessoryStockAt(mergedSale, 'b-huatabampo'), 411);

const afterNavIngreso = mica({
  stock: 195,
  branchStock: { 'b-navojoa': 195, 'b-huatabampo': 412, 'b-matriz': 0 }
});
const mergedIngreso = applyInventoryWrite(serverAcc, afterNavIngreso, snapshotInventory(serverAcc));
assert.equal(accessoryStockAt(mergedIngreso, 'b-navojoa'), 195);
assert.equal(accessoryStockAt(mergedIngreso, 'b-huatabampo'), 412);

const serverPhone = phone({
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': ['BBB'], 'b-matriz': [] }
});
const stalePhone = phone({
  stock: 1,
  imeiList: ['BBB'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': ['BBB'], 'b-matriz': [] }
});
const soldHua = phone({
  stock: 0,
  imeiList: [],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': [] }
});
const mergedPhoneSale = applyInventoryWrite(serverPhone, soldHua, snapshotInventory(stalePhone));
assert.deepEqual(imeisAtBranch(mergedPhoneSale, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(mergedPhoneSale, 'b-huatabampo'), []);

const addedNav = phone({
  stock: 2,
  imeiList: ['BBB', 'CCC'],
  branchImeiMap: { 'b-navojoa': ['CCC'], 'b-huatabampo': ['BBB'], 'b-matriz': [] }
});
const mergedAdd = applyInventoryWrite(serverPhone, addedNav, snapshotInventory(stalePhone));
assert.deepEqual(imeisAtBranch(mergedAdd, 'b-navojoa').sort(), ['AAA', 'CCC']);
assert.deepEqual(imeisAtBranch(mergedAdd, 'b-huatabampo'), ['BBB']);

const noBaseAcc = applyInventoryWrite(serverAcc, afterHuaSale, null);
assert.equal(accessoryStockAt(noBaseAcc, 'b-navojoa'), 155);
assert.equal(accessoryStockAt(noBaseAcc, 'b-huatabampo'), 412);

const staleNonZero = mica({
  stock: 10,
  branchStock: { 'b-navojoa': 10, 'b-huatabampo': 412, 'b-matriz': 0 }
});
const noBaseStaleQty = applyInventoryWrite(serverAcc, staleNonZero, null);
assert.equal(accessoryStockAt(noBaseStaleQty, 'b-navojoa'), 155);
assert.equal(accessoryStockAt(noBaseStaleQty, 'b-huatabampo'), 412);

const noBasePhone = applyInventoryWrite(serverPhone, soldHua, null);
assert.deepEqual(imeisAtBranch(noBasePhone, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(noBasePhone, 'b-huatabampo'), ['BBB']);

const staleListIncoming = phone({
  stock: 1,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': [], 'b-matriz': [] }
});
const noDump = applyInventoryWrite(serverPhone, staleListIncoming, null);
assert.deepEqual(imeisAtBranch(noDump, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(noDump, 'b-huatabampo'), ['BBB']);
assert.deepEqual(imeisAtBranch(noDump, 'b-matriz'), []);

const strippedIncoming = phone({
  stock: 0,
  imeiList: [],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': [] }
});
const strippedBase = snapshotInventory(strippedIncoming);
const keepAfterStripView = applyInventoryWrite(serverPhone, strippedIncoming, strippedBase);
assert.deepEqual(imeisAtBranch(keepAfterStripView, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(keepAfterStripView, 'b-huatabampo'), ['BBB']);

const noDumpWithBase = applyInventoryWrite(serverPhone, staleListIncoming, snapshotInventory(serverPhone));
assert.deepEqual(imeisAtBranch(noDumpWithBase, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(noDumpWithBase, 'b-huatabampo'), ['BBB']);
assert.deepEqual(imeisAtBranch(noDumpWithBase, 'b-matriz'), []);

const serverAfterTransfer = phone({
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': ['AAA', 'BBB'], 'b-matriz': [] }
});
const staleNavView = phone({
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': ['BBB'], 'b-matriz': [] }
});
const noRevert = applyInventoryWrite(serverAfterTransfer, staleNavView, snapshotInventory(staleNavView));
assert.deepEqual(imeisAtBranch(noRevert, 'b-huatabampo').sort(), ['AAA', 'BBB']);
assert.deepEqual(imeisAtBranch(noRevert, 'b-navojoa'), []);

const fromBodega = phone({
  stock: 1,
  imeiList: ['AAA'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': ['AAA'] }
});
const toNavojoa = phone({
  stock: 1,
  imeiList: ['AAA'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': [], 'b-matriz': [] }
});
const transferred = applyInventoryWrite(fromBodega, toNavojoa, snapshotInventory(fromBodega));
assert.deepEqual(imeisAtBranch(transferred, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(transferred, 'b-matriz'), []);

const bothPhones = phone({
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': ['AAA', 'BBB'], 'b-huatabampo': [], 'b-matriz': [] }
});
const afterASold = phone({
  stock: 1,
  imeiList: ['BBB'],
  branchImeiMap: { 'b-navojoa': ['BBB'], 'b-huatabampo': [], 'b-matriz': [] }
});
const tabBSoldOther = phone({
  stock: 1,
  imeiList: ['AAA'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': [], 'b-matriz': [] }
});
const noResurrect = applyInventoryWrite(afterASold, tabBSoldOther, snapshotInventory(bothPhones));
assert.deepEqual(imeisAtBranch(noResurrect, 'b-navojoa'), []);
assert.equal(noResurrect.stock, 0);

const stillTransfer = applyInventoryWrite(
  bothPhones,
  phone({
    stock: 2,
    imeiList: ['AAA', 'BBB'],
    branchImeiMap: { 'b-navojoa': ['BBB'], 'b-huatabampo': ['AAA'], 'b-matriz': [] }
  }),
  snapshotInventory(bothPhones)
);
assert.deepEqual(imeisAtBranch(stillTransfer, 'b-huatabampo'), ['AAA']);
assert.deepEqual(imeisAtBranch(stillTransfer, 'b-navojoa'), ['BBB']);

const serverCleanImei = phone({
  stock: 1,
  imeiList: ['351299123456789'],
  branchImeiMap: { 'b-navojoa': ['351299123456789'], 'b-huatabampo': [], 'b-matriz': [] }
});
const incomingDirtyImei = phone({
  stock: 1,
  imeiList: [']351299123456789'],
  branchImeiMap: { 'b-navojoa': [']351299123456789'], 'b-huatabampo': [], 'b-matriz': [] }
});
const noDupFormat = applyInventoryWrite(serverCleanImei, incomingDirtyImei, null);
assert.equal(noDupFormat.stock, 1);
assert.equal(imeisAtBranch(noDupFormat, 'b-navojoa').length, 1);

const serverWithOrphan = phone({
  stock: 2,
  imeiList: ['AAA', 'LEGACY'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': [], 'b-matriz': [] }
});
const keepLegacy = applyInventoryWrite(
  serverWithOrphan,
  phone({
    stock: 2,
    imeiList: ['AAA', 'LEGACY'],
    branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': [], 'b-matriz': [] }
  }),
  snapshotInventory(serverWithOrphan)
);
assert.deepEqual(imeisAtBranch(keepLegacy, 'b-navojoa'), ['AAA']);
assert.ok(unmappedImeis(keepLegacy).includes('LEGACY'));

const injectOrphan = applyInventoryWrite(
  serverPhone,
  phone({
    stock: 3,
    imeiList: ['AAA', 'BBB', 'NEWORPHAN'],
    branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': ['BBB'], 'b-matriz': [] }
  }),
  snapshotInventory(serverPhone)
);
assert.deepEqual(imeisAtBranch(injectOrphan, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(injectOrphan, 'b-huatabampo'), ['BBB']);
assert.equal(unmappedImeis(injectOrphan).includes('NEWORPHAN'), false);

const ingresoWithLoose = applyInventoryWrite(
  phone({
    stock: 0,
    imeiList: [],
    branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': [] }
  }),
  phone({
    stock: 2,
    imeiList: ['NAV1', 'NAV2'],
    branchImeiMap: { 'b-navojoa': ['NAV1'], 'b-huatabampo': [], 'b-matriz': [] }
  }),
  snapshotInventory(
    phone({
      stock: 0,
      imeiList: [],
      branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': [] }
    })
  )
);
assert.deepEqual(imeisAtBranch(ingresoWithLoose, 'b-navojoa').sort(), ['NAV1', 'NAV2']);
assert.deepEqual(unmappedImeis(ingresoWithLoose), []);

const newOnlyLoose = applyInventoryWrite(null, phone({
  stock: 1,
  imeiList: ['SOLO'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': [] }
}));
assert.deepEqual(unmappedImeis(newOnlyLoose), ['SOLO']);
assert.deepEqual(imeisAtBranch(newOnlyLoose, 'b-matriz'), []);

const newWithDest = applyInventoryWrite(null, phone({
  stock: 2,
  imeiList: ['H1', 'H2'],
  branchImeiMap: { 'b-huatabampo': ['H1'], 'b-navojoa': [], 'b-matriz': [] }
}));
assert.deepEqual(imeisAtBranch(newWithDest, 'b-huatabampo').sort(), ['H1', 'H2']);
assert.deepEqual(unmappedImeis(newWithDest), []);

console.log('inventoryMerge self-test ok');
