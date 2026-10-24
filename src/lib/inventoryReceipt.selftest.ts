import assert from 'node:assert/strict';
import type { AppNotification, InventoryMovement } from '../types.ts';
import {
  arrivalFromMovement,
  confirmMerchandiseReceipt,
  isPendingMerchandiseReceipt,
  mergeReceiptLines,
  receiptLineLabel,
  upsertMerchandiseReceiptNotice
} from './inventoryReceipt.ts';
import { notificationVisibleToOperator } from './repairUtils.ts';
import { notificationIsSticky } from './agenda.ts';

assert.equal(receiptLineLabel({ productName: 'Mica 15D', quantity: 5 }), '5× Mica 15D');
assert.deepEqual(
  mergeReceiptLines(
    [{ productName: 'Mica 15D', quantity: 2 }],
    [{ productName: 'Mica 15D', quantity: 3 }, { productName: 'A16', quantity: 1, imeis: ['351'] }]
  ),
  [
    { productName: 'Mica 15D', quantity: 5 },
    { productName: 'A16', quantity: 1, imeis: ['351'] }
  ]
);

const ingreso: InventoryMovement = {
  id: 'mov-1',
  timestamp: '2026-10-24T18:00:00.000Z',
  type: 'ingreso',
  productId: 'p1',
  productCode: 'CA01',
  productName: 'Mica 15D',
  quantity: 4,
  targetBranchId: 'b-navojoa',
  targetBranchName: 'Navojoa',
  operatorName: 'Admin',
  details: 'Paquete de ingreso'
};
assert.equal(arrivalFromMovement({ ...ingreso, type: 'venta' }), null);
assert.equal(arrivalFromMovement(ingreso)?.destBranchId, 'b-navojoa');

const first = upsertMerchandiseReceiptNotice([], arrivalFromMovement(ingreso)!);
assert.equal(first.type, 'ingreso_mercancia');
assert.equal(isPendingMerchandiseReceipt(first), true);
assert.equal(notificationIsSticky(first), true);
assert.match(first.title, /Navojoa/);
assert.match(first.message, /4× Mica 15D/);

const second = upsertMerchandiseReceiptNotice(
  [first],
  arrivalFromMovement({ ...ingreso, id: 'mov-2', productName: 'Cable USB', quantity: 2 })!
);
assert.equal(second.id, first.id, 'el lote se junta en un solo aviso');
assert.match(second.message, /Cable USB/);
assert.match(second.message, /4× Mica 15D/);

assert.equal(
  notificationVisibleToOperator(first, { role: 'cashier', branchId: 'b-navojoa', operatorId: 'op-1' }),
  true
);
assert.equal(
  notificationVisibleToOperator(first, { role: 'cashier', branchId: 'b-huatabampo', operatorId: 'op-2' }),
  false,
  'Huatabampo no ve el aviso de Navojoa'
);
assert.equal(notificationVisibleToOperator(first, { role: 'admin', branchId: 'b-matriz' }), true);

const confirmed = confirmMerchandiseReceipt(second, { id: 'op-teresa', name: 'Teresa' }, '2026-10-24T21:15:00.000Z');
assert.equal(confirmed.receiptDetails?.status, 'confirmado');
assert.equal(isPendingMerchandiseReceipt(confirmed), false);
assert.equal(notificationIsSticky(confirmed), false);
assert.match(confirmed.message, /Teresa/);

const notice: AppNotification = first;
assert.equal(notice.branchId, 'b-navojoa');

console.log('inventoryReceipt self-test ok');
