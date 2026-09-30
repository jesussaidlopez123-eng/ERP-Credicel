import type { AppNotification, RepairRecord } from '../types';
import {
  buildRepairCostDueNotification,
  isPendingRepair,
  needsRepairCostCapture,
  normalizeRepairStatus,
  notificationVisibleToOperator,
  repairCostDueNotificationId,
  repairCostDueNotificationPlan,
  repairStatusLabel
} from './repairUtils';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeRepairStatus('listo') === 'en_taller', 'listo ya no es un paso: queda en taller');
assert(normalizeRepairStatus('ready') === 'en_taller', 'ready también entra a taller');
assert(normalizeRepairStatus('en_taller') === 'en_taller', 'en taller se conserva');
assert(normalizeRepairStatus('entregado') === 'entregado', 'entregado se conserva');
assert(normalizeRepairStatus('cancelado') === 'cancelado', 'cancelado se conserva');
assert(repairStatusLabel('listo') === 'En taller', 'la etiqueta de listo es En taller');

const pending: RepairRecord = {
  id: 'REP-1',
  clientName: 'Ana',
  clientPhone: '6440000000',
  deviceModel: 'A15',
  issueDescription: 'Pantalla',
  status: 'en_taller',
  receivedAt: '29/09/2026',
  totalCost: 800,
  advancePayment: 0,
  pendingBalance: 800,
  operatorName: 'Caja',
  branchId: 'b-navojoa'
};

assert(isPendingRepair(pending), 'en taller está pendiente y se puede entregar');
assert(isPendingRepair({ ...pending, status: 'listo' }), 'un listo viejo sigue entregable');
assert(!needsRepairCostCapture(pending), 'sin entregar no pide gasto interno');

const deliveredZero: RepairRecord = { ...pending, status: 'entregado', pendingBalance: 0 };
assert(needsRepairCostCapture(deliveredZero), 'entregado en $0 pide captura de gasto');
assert(
  !needsRepairCostCapture({
    ...deliveredZero,
    costLines: [{ id: 'c1', kind: 'refaccion', concept: 'Display', amount: 200, at: '', by: 'Admin' }]
  }),
  'con gasto interno ya no pide captura'
);

const first = repairCostDueNotificationPlan(pending, deliveredZero, [], 'Caja Navojoa');
assert(first.add, 'al entregar con $0 se arma el aviso al admin');
assert(first.add?.type === 'gasto_reparacion', 'el aviso es de gasto de reparación');
assert(first.add?.repairId === 'REP-1', 'el aviso apunta al folio');
assert(first.dismissIds.length === 0, 'no se borra nada en la primera entrega');

const existing: AppNotification[] = [
  {
    id: repairCostDueNotificationId('REP-1'),
    urgency: 'urgente',
    title: 'x',
    message: 'x',
    createdAt: 'ahora',
    read: false,
    authorName: 'Caja',
    branchId: 'all',
    targetOperatorId: 'all',
    type: 'gasto_reparacion',
    repairId: 'REP-1'
  }
];

const again = repairCostDueNotificationPlan(deliveredZero, deliveredZero, existing, 'Caja Navojoa');
assert(!again.add, 'no se duplica el aviso si caja vuelve a guardar la entrega');
assert(again.dismissIds.length === 0, 'el aviso se queda hasta que haya gasto');

const withCost: RepairRecord = {
  ...deliveredZero,
  costLines: [{ id: 'c1', kind: 'mano_obra', concept: 'Mano de obra', amount: 150, at: '', by: 'Admin' }]
};
const captured = repairCostDueNotificationPlan(deliveredZero, withCost, existing, 'Admin');
assert(!captured.add, 'al capturar el gasto no se crea otro aviso');
assert(captured.dismissIds.includes(repairCostDueNotificationId('REP-1')), 'se quita el aviso al capturar el costo');

const cancelled = repairCostDueNotificationPlan(
  pending,
  { ...pending, status: 'cancelado' },
  existing,
  'Admin'
);
assert(!cancelled.add, 'una baja no pide gasto');
assert(cancelled.dismissIds.includes(repairCostDueNotificationId('REP-1')), 'una baja quita el aviso');

const paidUpFront = repairCostDueNotificationPlan(
  pending,
  {
    ...deliveredZero,
    costLines: [{ id: 'c1', kind: 'refaccion', concept: 'Flex', amount: 80, at: '', by: 'Admin' }]
  },
  [],
  'Caja'
);
assert(!paidUpFront.add, 'si el gasto ya estaba, caja entrega sin aviso');

const built = buildRepairCostDueNotification(deliveredZero, 'Luis');
assert(
  notificationVisibleToOperator({ ...built, id: 'n1', createdAt: '', read: false }, { role: 'admin' }),
  'el admin ve el aviso de gasto'
);
assert(
  !notificationVisibleToOperator({ ...built, id: 'n1', createdAt: '', read: false }, { role: 'cashier' }),
  'caja no ve el aviso de gasto'
);
assert(
  !notificationVisibleToOperator({ ...built, id: 'n1', createdAt: '', read: false }, { role: 'manager' }),
  'el encargado no ve el aviso de gasto'
);

const stockNotice: AppNotification = {
  id: 'n-stock',
  urgency: 'normal',
  title: 'Surtido',
  message: 'Falta mica',
  createdAt: '',
  read: false,
  authorName: 'Caja',
  branchId: 'b-navojoa',
  targetOperatorId: 'all',
  type: 'pedido_stock'
};
assert(
  notificationVisibleToOperator(stockNotice, { role: 'cashier', branchId: 'b-navojoa', operatorId: 'op-1' }),
  'caja sí ve un pedido de surtido de su sucursal'
);

console.log('repairUtils.selftest ok');
