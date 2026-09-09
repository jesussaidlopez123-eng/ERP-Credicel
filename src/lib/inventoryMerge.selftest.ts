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
assert.equal(accessoryStockAt(noBaseAcc, 'b-huatabampo'), 411);

const noBasePhone = applyInventoryWrite(serverPhone, soldHua, null);
assert.deepEqual(imeisAtBranch(noBasePhone, 'b-navojoa'), ['AAA']);
assert.deepEqual(imeisAtBranch(noBasePhone, 'b-huatabampo'), ['BBB']);

console.log('inventoryMerge self-test ok');
