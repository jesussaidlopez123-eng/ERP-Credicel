import assert from 'node:assert/strict';
import {
  HUA_OPEN_SESSION_20261011,
  retargetOpenShiftTicket,
  ticketNeedsHuatabampoRetarget
} from './shiftBranchRepair.ts';
import type { SaleTicket } from '../types.ts';

const ticket: SaleTicket = {
  id: 'TCK-MV41I6SP-0G9CWI',
  folio: 'MTZ-1110-001',
  timestamp: '2026-10-11T16:30:55.465Z',
  branchId: 'b-matriz',
  sucursal_id: 'b-matriz',
  sesion_caja_id: 'SES-MTZ-20261011-MV40TO74',
  corteXId: 'SES-MTZ-20261011-MV40TO74',
  corteXClosedAt: '2026-10-11T17:36:23.346Z',
  operatorName: 'GERALDIN FLORES',
  items: [
    {
      cartItemId: 'x',
      product: { id: 'p', name: 'Abono', code: 'A', price: 204, stock: 1, category: 'abono_credito' },
      quantity: 1,
      unitPrice: 204,
      totalPrice: 204,
      metadata: { stockBranchId: 'b-matriz', saleType: 'abono' }
    }
  ],
  total: 204,
  paymentMethod: 'Efectivo'
};

assert.equal(ticketNeedsHuatabampoRetarget(ticket), true);
const moved = retargetOpenShiftTicket(ticket, {
  branchId: 'b-huatabampo',
  sessionId: HUA_OPEN_SESSION_20261011
});
assert.equal(moved.branchId, 'b-huatabampo');
assert.equal(moved.sucursal_id, 'b-huatabampo');
assert.equal(moved.sesion_caja_id, HUA_OPEN_SESSION_20261011);
assert.equal(moved.corteXId, undefined);
assert.equal(moved.corteXClosedAt, undefined);
assert.equal(moved.folio, 'MTZ-1110-001');
assert.equal(moved.items[0].metadata?.stockBranchId, 'b-huatabampo');
assert.equal(ticketNeedsHuatabampoRetarget(moved), false);
assert.equal(ticketNeedsHuatabampoRetarget({ id: 'otro', branchId: 'b-matriz' }), false);

console.log('shiftBranchRepair self-test ok');
