import assert from 'node:assert/strict';
import type { CorteXRecord, RepairRecord, SaleTicket, SesionCaja } from '../types.ts';
import { applyExpenseToCorte, corteExpenseTotals, expenseCountsAsCashOut, rebuildCorteTotals } from './historicSale.ts';
import {
  attachExpenseToMatrizCorte,
  buildLateRepairMatrizExpense,
  isMatrizRepairExpense,
  matrizRepairExpenseId,
  planLateRepairMatrizExpense,
  shouldSyncLateRepairMatrizExpense
} from './repairCorte.ts';

const pending: RepairRecord = {
  id: 'REP-88',
  clientName: 'Luis',
  clientPhone: '6441112233',
  deviceModel: 'A15',
  issueDescription: 'Pantalla',
  status: 'en_taller',
  receivedAt: '13/10/2026',
  receivedAtIso: '2026-10-13T10:00:00-07:00',
  totalCost: 900,
  advancePayment: 0,
  pendingBalance: 0,
  operatorName: 'Caja',
  branchId: 'b-navojoa'
};

const delivered: RepairRecord = {
  ...pending,
  status: 'entregado',
  deliveredAtIso: '2026-10-13T18:00:00-07:00',
  deliveredAt: '13/10/2026 6:00 p.m.',
  deliveredByName: 'Caja Navojoa'
};

const withPart: RepairRecord = {
  ...delivered,
  costLines: [
    { id: 'c1', kind: 'refaccion', concept: 'Display', amount: 350, at: '2026-10-14T09:30:00-07:00', by: 'Taller' }
  ]
};

assert.equal(shouldSyncLateRepairMatrizExpense(pending, delivered), false, 'entregar sin pieza no genera gasto todavía');
assert.equal(shouldSyncLateRepairMatrizExpense(delivered, withPart), true, 'capturar pieza después de entregar sí');
assert.equal(
  shouldSyncLateRepairMatrizExpense({ ...pending, costLines: withPart.costLines }, withPart),
  false,
  'si la pieza ya estaba antes de entregar no se duplica en Matriz'
);

const built = buildLateRepairMatrizExpense(withPart, 'Said');
assert.ok(built);
assert.equal(built?.id, matrizRepairExpenseId('REP-88'));
assert.equal(built?.branchId, 'b-matriz');
assert.equal(built?.amount, 350);
assert.equal(built?.kind, 'refaccion_taller');
assert.equal(built?.countsAsCashOut, false);
assert.equal(built?.timestamp, '2026-10-13T18:00:00-07:00');
assert.equal(isMatrizRepairExpense(built), true);
assert.equal(expenseCountsAsCashOut(built), false);

const ticket: SaleTicket = {
  id: 'TCK-MTZ-1',
  timestamp: '2026-10-13T12:00:00-07:00',
  branchId: 'b-matriz',
  operatorName: 'Teresa',
  items: [],
  total: 500,
  paymentMethod: 'Efectivo'
};

const corte: CorteXRecord = {
  id: 'SES-MTZ-20261013-1',
  timestamp: '2026-10-13T23:00:00-07:00',
  dateStr: '2026-10-13',
  timeStr: '23:00',
  branchId: 'b-matriz',
  branchName: 'Matriz',
  operatorName: 'Teresa',
  initialCashFund: 1000,
  cashSales: 500,
  cardSales: 0,
  transferSales: 0,
  totalSales: 500,
  totalExpenses: 0,
  netIncome: 500,
  expectedCashInDrawer: 1500,
  countedCash: 1500,
  ticketIds: [ticket.id],
  expenseIds: [],
  ticketsSnapshot: [ticket],
  expensesSnapshot: [],
  breakdown: {
    accesoriosTotal: 0,
    accesoriosCount: 0,
    abonosTotal: 0,
    abonosCount: 0,
    enganchesTotal: 0,
    enganchesCount: 0,
    reparacionesTotal: 0,
    reparacionesCount: 0,
    recargasTotal: 0,
    recargasCount: 0
  }
};

const patched = applyExpenseToCorte(corte, built!);
assert.equal(patched.totalExpenses, 350, 'el Corte X de Matriz suma la refacción');
assert.equal(patched.netIncome, 150, 'el neto baja con la pieza');
assert.equal(patched.expectedCashInDrawer, 1500, 'el cajón no se mueve: no salió efectivo');
assert.equal(patched.cashDifference, 0, 'el arqueo original se conserva');
assert.equal(patched.expenseIds.includes(built!.id), true);

const cashGasto = {
  id: 'GTO-1',
  amount: 80,
  concept: 'Pasaje',
  timestamp: '2026-10-13T12:00:00-07:00',
  operatorName: 'Teresa',
  branchId: 'b-matriz'
};
const mixed = rebuildCorteTotals(corte, [ticket], [built!, cashGasto]);
assert.equal(mixed.totalExpenses, 430);
assert.equal(mixed.expectedCashInDrawer, 1420, 'solo el pasaje baja el cajón');
assert.deepEqual(corteExpenseTotals([built!, cashGasto]), { listed: 430, cashOut: 80 });

const closedPlan = planLateRepairMatrizExpense({
  previous: delivered,
  next: withPart,
  operatorName: 'Said',
  cortes: [corte]
});
assert.equal(closedPlan.action, 'upsert');
assert.equal(closedPlan.closedCorte?.id, corte.id);
assert.equal(closedPlan.expense?.corteXId, corte.id);

const openSession: SesionCaja = {
  id: 'SES-MTZ-OPEN',
  sucursal_id: 'b-matriz',
  sucursal_nombre: 'Matriz',
  operador_apertura: { uid: 'op', nombre: 'Teresa' },
  estado: 'ABIERTA',
  fecha_apertura: '2026-10-13T09:00:00-07:00',
  monto_inicial_efectivo: 1000
};
const live = attachExpenseToMatrizCorte(built!, [], openSession);
assert.equal(live.closedCorte, null);
assert.equal(live.expense.sesion_caja_id, 'SES-MTZ-OPEN');

const cleared = planLateRepairMatrizExpense({
  previous: withPart,
  next: delivered,
  operatorName: 'Said',
  cortes: [corte]
});
assert.equal(cleared.action, 'remove');
assert.equal(cleared.removeId, matrizRepairExpenseId('REP-88'));

console.log('repairCorte self-test ok');
