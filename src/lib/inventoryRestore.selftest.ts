import assert from 'node:assert/strict';
import type { InventoryMovement, Product, SaleTicket } from '../types';
import { accessoryStockAt } from './accessoryInventory.ts';
import { imeisAtBranch } from './imeiInventory.ts';
import {
  applyRestoreActionsToProducts,
  planInventoryRestore
} from './inventoryRestore.ts';

const phone = (over: Partial<Product> = {}): Product => ({
  id: 'eq-a16',
  code: 'EQ-A16',
  name: 'Samsung A16',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 4000,
  stock: 0,
  branchImeiMap: { 'b-matriz': [], 'b-navojoa': [], 'b-huatabampo': [] },
  ...over
});

const mica = (over: Partial<Product> = {}): Product => ({
  id: 'acc-mica',
  code: 'CA01',
  name: 'Mica',
  category: 'accesorio',
  inventoryType: 'accesorio',
  price: 50,
  stock: 0,
  branchStock: { 'b-matriz': 0, 'b-navojoa': 0, 'b-huatabampo': 0 },
  ...over
});

const mov = (over: Partial<InventoryMovement>): InventoryMovement => ({
  id: over.id || 'mov-1',
  timestamp: over.timestamp || '2026-08-01T10:00:00.000Z',
  type: over.type || 'ingreso',
  productId: over.productId || 'eq-a16',
  productCode: over.productCode || 'EQ-A16',
  productName: over.productName || 'Samsung A16',
  quantity: over.quantity ?? 1,
  operatorName: 'Said',
  details: over.details || 'ingreso',
  ...over
});

const emptyPhone = phone();
const emptyMica = mica();

const movements: InventoryMovement[] = [
  mov({
    id: 'm1',
    timestamp: '2026-08-01T10:00:00.000Z',
    type: 'ingreso',
    targetBranchId: 'b-huatabampo',
    quantity: 2,
    imeis: ['HUA111', 'HUA222']
  }),
  mov({
    id: 'm2',
    timestamp: '2026-08-02T10:00:00.000Z',
    type: 'ingreso',
    targetBranchId: 'b-navojoa',
    quantity: 1,
    imeis: ['NAV111']
  }),
  mov({
    id: 'm3',
    timestamp: '2026-08-03T10:00:00.000Z',
    type: 'venta',
    targetBranchId: 'b-huatabampo',
    quantity: -1,
    imeis: ['HUA222']
  }),
  mov({
    id: 'm4',
    timestamp: '2026-08-01T11:00:00.000Z',
    type: 'ingreso',
    productId: 'acc-mica',
    productCode: 'CA01',
    productName: 'Mica',
    targetBranchId: 'b-huatabampo',
    quantity: 40
  }),
  mov({
    id: 'm5',
    timestamp: '2026-08-04T11:00:00.000Z',
    type: 'venta',
    productId: 'acc-mica',
    productCode: 'CA01',
    productName: 'Mica',
    targetBranchId: 'b-huatabampo',
    quantity: -5
  })
];

const soldTicket = {
  id: 't1',
  folio: 'HUA-0108-001',
  timestamp: '2026-08-03T10:00:00.000Z',
  branchId: 'b-huatabampo',
  items: [
    {
      product: emptyPhone,
      quantity: 1,
      unitPrice: 4000,
      totalPrice: 4000,
      paymentMethod: 'Efectivo',
      metadata: { saleType: 'contado', imei: 'HUA222' }
    }
  ]
} as unknown as SaleTicket;

const leaked = phone({
  stock: 1,
  imeiList: ['HUA111'],
  branchImeiMap: { 'b-matriz': ['HUA111'], 'b-navojoa': [], 'b-huatabampo': [] }
});

const report = planInventoryRestore([leaked, emptyMica], movements, [soldTicket]);
assert.equal(report.kardex['b-huatabampo'].phones, 1);
assert.equal(report.kardex['b-navojoa'].phones, 1);
assert.equal(report.kardex['b-huatabampo'].accessories, 35);

const huaPhone = report.actions.find((a) => a.productId === 'eq-a16' && a.branchId === 'b-huatabampo');
assert.ok(huaPhone);
assert.deepEqual(huaPhone?.imeis, ['HUA111']);

const navPhone = report.actions.find((a) => a.productId === 'eq-a16' && a.branchId === 'b-navojoa');
assert.ok(navPhone);
assert.deepEqual(navPhone?.imeis, ['NAV111']);

const huaMica = report.actions.find((a) => a.productId === 'acc-mica' && a.branchId === 'b-huatabampo');
assert.ok(huaMica);
assert.equal(huaMica?.accessoryQty, 35);

const restored = applyRestoreActionsToProducts([leaked, emptyMica], report.actions);
const restoredPhone = restored.find((p) => p.id === 'eq-a16')!;
const restoredMica = restored.find((p) => p.id === 'acc-mica')!;
assert.deepEqual(imeisAtBranch(restoredPhone, 'b-huatabampo'), ['HUA111']);
assert.deepEqual(imeisAtBranch(restoredPhone, 'b-navojoa'), ['NAV111']);
assert.deepEqual(imeisAtBranch(restoredPhone, 'b-matriz'), []);
assert.equal(accessoryStockAt(restoredMica, 'b-huatabampo'), 35);

const alreadyOk = phone({
  stock: 1,
  imeiList: ['HUA111'],
  branchImeiMap: { 'b-matriz': [], 'b-navojoa': [], 'b-huatabampo': ['HUA111'] }
});
const noDup = planInventoryRestore(
  [alreadyOk, mica({ branchStock: { 'b-matriz': 0, 'b-navojoa': 0, 'b-huatabampo': 35 }, stock: 35 })],
  movements,
  [soldTicket]
);
assert.equal(
  noDup.actions.some((a) => a.imeis.includes('HUA111')),
  false
);
assert.equal(
  noDup.actions.some((a) => a.productId === 'acc-mica'),
  false
);

const soldStayGone = planInventoryRestore([emptyPhone, emptyMica], movements, [soldTicket]);
assert.equal(
  soldStayGone.actions.some((a) => a.imeis.includes('HUA222')),
  false
);

console.log('inventoryRestore self-test ok');
