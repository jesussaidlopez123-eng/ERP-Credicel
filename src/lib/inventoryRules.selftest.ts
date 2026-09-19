import assert from 'node:assert/strict';
import type { Product } from '../types';
import { findImeiInInventory, getBranchStockQty, realEquipmentStockAt, restoreBranchForSaleItem } from './inventoryRules.ts';

const phone: Product = {
  id: 'prod-x',
  code: 'CE-01',
  name: 'Redmi Note',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 4000,
  stock: 2,
  imeiList: ['AAA', 'BBB'],
  branchImeiMap: { 'b-navojoa': ['AAA'], 'b-huatabampo': ['BBB'], 'b-matriz': [] }
};

assert.equal(getBranchStockQty(phone, 'b-navojoa'), 1);
assert.equal(getBranchStockQty(phone, 'all'), 2);
assert.equal(getBranchStockQty(phone, 'Administración'), 2);

const atNavojoa = findImeiInInventory([phone], 'AAA', 'b-navojoa');
assert.equal(atNavojoa.status, 'found');
assert.equal(atNavojoa.status === 'found' ? atNavojoa.branchId : '', 'b-navojoa');

const navojoaAlias = findImeiInInventory([phone], 'AAA', 'Navojoa');
assert.equal(navojoaAlias.status, 'found');

const looseOnly: Product = {
  ...phone,
  imeiList: ['351299123456789'],
  branchImeiMap: { 'b-navojoa': [], 'b-huatabampo': [], 'b-matriz': [] }
};
const looseAtNav = findImeiInInventory([looseOnly], '351299123456789', 'b-navojoa');
assert.equal(looseAtNav.status, 'found');
assert.equal(looseAtNav.status === 'found' ? looseAtNav.branchId : '', 'b-navojoa');

const scanned = findImeiInInventory([looseOnly], ']351299123456789', 'b-navojoa');
assert.equal(scanned.status, 'found');

const mislabeled: Product = {
  ...phone,
  inventoryType: 'accesorio',
  category: 'accesorio'
};
const stillFound = findImeiInInventory([mislabeled], 'AAA', 'b-navojoa');
assert.equal(stillFound.status, 'found');

const other = findImeiInInventory([phone], 'BBB', 'b-navojoa');
assert.equal(other.status, 'other_branch');

const adminHit = findImeiInInventory([phone], 'BBB', 'all');
assert.equal(adminHit.status, 'found');
assert.equal(adminHit.status === 'found' ? adminHit.branchId : '', 'b-huatabampo');

assert.equal(restoreBranchForSaleItem({ metadata: { stockBranchId: 'b-huatabampo' } }, 'b-matriz'), 'b-huatabampo');
assert.equal(restoreBranchForSaleItem({ metadata: {} }, 'b-navojoa'), 'b-navojoa');

const virtualPhone: Product = {
  id: 'prod-equipo-credito-gen',
  code: 'EQ-VENTA',
  name: 'Venta de Celular',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 0,
  stock: 0
};
assert.equal(getBranchStockQty(virtualPhone, 'b-huatabampo'), 0);
assert.equal(realEquipmentStockAt([virtualPhone, phone], 'b-huatabampo'), 1);
assert.equal(realEquipmentStockAt([virtualPhone, phone], 'b-navojoa'), 1);

console.log('inventoryRules self-test ok');
