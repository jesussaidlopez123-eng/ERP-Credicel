import assert from 'node:assert/strict';
import type { Product } from '../types';
import { accessoryStockAt } from './accessoryInventory.ts';
import { imeisAtBranch } from './imeiInventory.ts';
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
  branchStock: { 'b-navojoa': 155, 'b-huatabampo': 412, 'b-bodega': 0 }
});
const staleHua = mica({
  stock: 412,
  branchStock: { 'b-navojoa': 0, 'b-huatabampo': 412, 'b-bodega': 0 }
});
const afterHuaSale = mica({
  stock: 411,
  branchStock: { 'b-navojoa': 0, 'b-huatabampo': 411, 'b-bodega': 0 }
});

const mergedSale = applyInventoryWrite(serverAcc, afterHuaSale, snapshotInventory(staleHua));
assert.equal(accessoryStockAt(mergedSale, 'b-navojoa'), 155);
assert.equal(accessoryStockAt(mergedSale, 'b-huatabampo'), 411);

const afterNavIngreso = mica({
  stock: 195,
  branchStock: { 'b-navojoa': 195, 'b-huatabampo': 412, 'b-bodega': 0 }
});
const mergedIngreso = applyInventoryWrite(serverAcc, afterNavIngreso, snapshotInventory(serverAcc));
assert.equal(accessoryStockAt(mergedIngreso, 'b-navojoa'), 195);
assert.equal(accessoryStockAt(mergedIngreso, 'b-huatabampo'), 412);

const serverPhone = phone({
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': ['BBB'], 'b-bodega': [] }
});
const stalePhone = phone({
  stock: 1,
  imeiList: ['BBB'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': ['BBB'], 'b-bodega': [] }
});
const soldHua = phone({
  stock: 0,
  imeiList: [],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-bodega': [] }
});
const mergedPhoneSale = applyInventoryWrite(serverPhone, soldHua, snapshotInventory(stalePhone));
assert.deepEqual(imeisAtBranch(mergedPhoneSale, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(mergedPhoneSale, 'b-huatabampo'), []);

const addedNav = phone({
  stock: 2,
  imeiList: ['BBB', 'CCC'],
  branchImeiMap: { 'b-navojoa': ['CCC'], 'b-huatabampo': ['BBB'], 'b-bodega': [] }
});
const mergedAdd = applyInventoryWrite(serverPhone, addedNav, snapshotInventory(stalePhone));
assert.deepEqual(imeisAtBranch(mergedAdd, 'b-navojoa').sort(), ['AAA', 'CCC']);
assert.deepEqual(imeisAtBranch(mergedAdd, 'b-huatabampo'), ['BBB']);

const noBaseAcc = applyInventoryWrite(serverAcc, afterHuaSale, null);
assert.equal(accessoryStockAt(noBaseAcc, 'b-navojoa'), 155);
assert.equal(accessoryStockAt(noBaseAcc, 'b-huatabampo'), 412);

const staleNonZero = mica({
  stock: 10,
  branchStock: { 'b-navojoa': 10, 'b-huatabampo': 412, 'b-bodega': 0 }
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
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': [], 'b-bodega': [] }
});
const noDump = applyInventoryWrite(serverPhone, staleListIncoming, null);
assert.deepEqual(imeisAtBranch(noDump, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(noDump, 'b-huatabampo'), ['BBB']);
assert.deepEqual(imeisAtBranch(noDump, 'b-bodega'), []);

const noDumpWithBase = applyInventoryWrite(serverPhone, staleListIncoming, snapshotInventory(serverPhone));
assert.deepEqual(imeisAtBranch(noDumpWithBase, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(noDumpWithBase, 'b-huatabampo'), ['BBB']);
assert.deepEqual(imeisAtBranch(noDumpWithBase, 'b-bodega'), []);

const serverAfterTransfer = phone({
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': ['AAA', 'BBB'], 'b-bodega': [] }
});
const staleNavView = phone({
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': ['BBB'], 'b-bodega': [] }
});
const noRevert = applyInventoryWrite(serverAfterTransfer, staleNavView, snapshotInventory(staleNavView));
assert.deepEqual(imeisAtBranch(noRevert, 'b-huatabampo').sort(), ['AAA', 'BBB']);
assert.deepEqual(imeisAtBranch(noRevert, 'b-navojoa'), []);

const fromBodega = phone({
  stock: 1,
  imeiList: ['AAA'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-bodega': ['AAA'] }
});
const toNavojoa = phone({
  stock: 1,
  imeiList: ['AAA'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': [], 'b-bodega': [] }
});
const transferred = applyInventoryWrite(fromBodega, toNavojoa, snapshotInventory(fromBodega));
assert.deepEqual(imeisAtBranch(transferred, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(transferred, 'b-bodega'), []);

console.log('inventoryMerge self-test ok');
