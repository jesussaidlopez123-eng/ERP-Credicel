import type { AppNotification, RepairRecord, SaleTicket } from '../types';
import {
  assembleRepairRecords,
  buildRepairCostDueNotification,
  combineRepairRecords,
  findPendingDuplicate,
  foldRepairDuplicates,
  inferRepairsFromTickets,
  isPendingRepair,
  mergeRepairSources,
  needsRepairCostCapture,
  normalizeRepairStatus,
  normalizeWorkStage,
  notificationVisibleToOperator,
  repairCostDueNotificationId,
  repairCostDueNotificationPlan,
  repairDaysInShop,
  repairFingerprint,
  repairStatusLabel,
  setRepairWorkStage,
  shiftRepairWorkStage,
  workStageOf
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

assert(normalizeWorkStage(undefined) === 'recibido', 'sin etapa empieza en recibido');
assert(normalizeWorkStage('listo') === 'para_entrega', 'listo viejo es para recoger');
assert(normalizeWorkStage('espera_pieza') === 'espera_pieza', 'espera pieza se conserva');
assert(workStageOf(setRepairWorkStage(pending, 'en_proceso')) === 'en_proceso', 'se mueve al banco');
assert(workStageOf(shiftRepairWorkStage(pending, 1)) === 'diagnostico', 'el siguiente paso es diagnóstico');
assert(repairDaysInShop({ ...pending, receivedAtIso: '2026-10-01T12:00:00-07:00' }, '2026-10-03') === 2, 'días en taller');
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

const twinA: RepairRecord = {
  ...pending,
  id: 'REP-0310-K3M01',
  clientPhone: '6441234567',
  deviceModel: 'Moto G06',
  receivedAtIso: '2026-10-03T10:00:00-07:00',
  workStage: 'en_proceso',
  totalCost: 800,
  deviceId: 'caja-nav'
};
const twinB: RepairRecord = {
  ...pending,
  id: 'REP-0310-K3M02',
  clientPhone: '644-123-4567',
  deviceModel: 'moto g06',
  receivedAtIso: '2026-10-03T10:05:00-07:00',
  workStage: 'recibido'
};
assert(
  repairFingerprint(twinA) === repairFingerprint(twinB),
  'el mismo celular el mismo día comparte huella aunque cambie el folio'
);
assert(findPendingDuplicate([twinA], twinB)?.id === 'REP-0310-K3M01', 'detecta el alta duplicada');
assert(
  findPendingDuplicate([twinA], { ...twinB, receivedAtIso: '2026-10-04T09:00:00-07:00' })?.id ===
    'REP-0310-K3M01',
  'si sigue en taller no se recibe otra vez al día siguiente'
);
const folded = foldRepairDuplicates([twinA, twinB]);
assert(folded.length === 1, 'el tablero no muestra dos fichas del mismo equipo');
assert(folded[0].id === 'REP-0310-K3M01', 'se queda el folio que ya iba en el banco');
assert(workStageOf(folded[0]) === 'en_proceso', 'no se regresa a recibido');

const deliveredOfficial: RepairRecord = {
  ...twinA,
  status: 'entregado',
  workStage: 'para_entrega',
  deliveredAtIso: '2026-10-03T18:00:00-07:00'
};
const ghostFromTicket: RepairRecord = { ...twinB, status: 'en_taller', workStage: 'recibido' };
const noGhost = assembleRepairRecords([ghostFromTicket], [deliveredOfficial]);
assert(noGhost.length === 1, 'un ticket viejo no revive el equipo ya entregado');
assert(noGhost[0].status === 'entregado', 'la entrega gana contra el snapshot en taller');

const inferredOver = combineRepairRecords(deliveredOfficial, {
  ...deliveredOfficial,
  status: 'en_taller',
  workStage: 'recibido',
  deliveredAtIso: undefined
});
assert(inferredOver.status === 'entregado', 'reconstruir desde anticipo no borra la entrega');
assert(inferredOver.deliveredAtIso === deliveredOfficial.deliveredAtIso, 'se conserva la marca de entrega');

const fromCancelled = inferRepairsFromTickets([
  {
    id: 'TCK-X',
    timestamp: '2026-10-03T10:00:00-07:00',
    branchId: 'b-navojoa',
    operatorName: 'Caja',
    total: 0,
    paymentMethod: 'Efectivo',
    estado: 'CANCELADA',
    items: [
      {
        product: { id: 'p', code: 'R', name: 'Recepción', category: 'servicio', price: 0, stock: 1 },
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        metadata: { repairId: 'REP-GHOST', clientPhone: '6440000000', deviceModel: 'A15', repairType: 'anticipo' }
      }
    ]
  } as SaleTicket
]);
assert(fromCancelled.length === 0, 'un ticket cancelado no inventa ficha de taller');

const laterName = mergeRepairSources(
  [{ ...pending, clientName: 'ana' }],
  [{ ...pending, clientName: 'Ana Guadalupe' }]
);
assert(laterName[0].clientName === 'Ana Guadalupe', 'el nombre de la ficha posterior se conserva');

console.log('repairUtils.selftest ok');
