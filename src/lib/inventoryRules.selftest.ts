import assert from 'node:assert/strict';
import type { Product } from '../types';
import { findImeiInInventory, getBranchStockQty, realEquipmentStockAt, resolveInventoryScan, restoreBranchForSaleItem, unassignedEquipmentCount } from './inventoryRules.ts';

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
assert.equal(looseAtNav.status, 'unassigned');
assert.equal(looseAtNav.status === 'unassigned' ? looseAtNav.product.id : '', 'prod-x');

const scanned = findImeiInInventory([looseOnly], ']351299123456789', 'b-navojoa');
assert.equal(scanned.status, 'unassigned');

const assignedScan: Product = {
  ...phone,
  imeiList: ['351299123456789'],
  branchImeiMap: { 'b-navojoa': ['351299123456789'], 'b-huatabampo': [], 'b-matriz': [] }
};
const aimHit = findImeiInInventory([assignedScan], ']C1351299123456789', 'b-navojoa');
assert.equal(aimHit.status, 'found');

const adminLoose = findImeiInInventory([looseOnly], '351299123456789', 'all');
assert.equal(adminLoose.status, 'unassigned');
assert.equal(unassignedEquipmentCount([looseOnly]), 1);
assert.equal(unassignedEquipmentCount([phone]), 0);

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

const g06: Product = {
  id: 'prod-g06',
  code: '840493602370',
  name: 'MOTO G06',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 3900,
  stock: 1,
  imeiList: ['359158767245502'],
  branchImeiMap: { 'b-navojoa': ['359158767245502'], 'b-huatabampo': [], 'b-matriz': [] }
};
const boxScan = resolveInventoryScan([g06], '840493602370', 'b-navojoa');
assert.equal(boxScan.kind, 'barcode');
assert.equal(boxScan.kind === 'barcode' ? boxScan.product.name : '', 'MOTO G06');
const imeiScan = resolveInventoryScan([g06], '359158767245502', 'b-navojoa');
assert.equal(imeiScan.kind, 'imei');
const missingImei = resolveInventoryScan([g06], '351299123456789', 'b-navojoa');
assert.equal(missingImei.kind, 'missing_imei');

console.log('inventoryRules self-test ok');
