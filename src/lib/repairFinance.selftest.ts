import type { RepairRecord, SaleTicket } from '../types';
import {
  buildRepairWeekFinance,
  isRepairIncomeTicket,
  listRepairFinanceWeekStarts,
  repairIncomeFromTicket
} from './repairFinance';
import { addRepairCostLine, mergeRepairSources, repairInternalCost } from './repairUtils';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const product = { id: 'p', code: 'R', name: 'Anticipo taller', category: 'servicio', price: 500, stock: 0 };

const mondayTicket: SaleTicket = {
  id: 't1',
  timestamp: '2026-09-07T18:00:00.000Z',
  branchId: 'b-navojoa',
  operatorName: 'Op',
  total: 500,
  paymentMethod: 'Efectivo',
  items: [
    {
      cartItemId: 'i1',
      product,
      quantity: 1,
      unitPrice: 500,
      totalPrice: 500,
      metadata: { repairId: 'REP-1', repairType: 'anticipo' }
    }
  ]
};

const accessoryTicket: SaleTicket = {
  ...mondayTicket,
  id: 't2',
  total: 200,
  items: [
    {
      cartItemId: 'i2',
      product: { id: 'a', code: 'A', name: 'Mica', category: 'accesorio', price: 200, stock: 1 },
      quantity: 1,
      unitPrice: 200,
      totalPrice: 200
    }
  ]
};

const cancelledRepair: SaleTicket = {
  ...mondayTicket,
  id: 't3',
  estado: 'CANCELADA',
  total: 500
};

const repair: RepairRecord = {
  id: 'REP-1',
  clientName: 'Cliente',
  clientPhone: '6440000000',
  deviceModel: 'Samsung A',
  issueDescription: 'Pantalla',
  status: 'en_taller',
  receivedAt: '07/09/2026',
  receivedAtIso: '2026-09-07T12:00:00.000Z',
  totalCost: 1200,
  advancePayment: 500,
  pendingBalance: 700,
  operatorName: 'Op',
  branchId: 'b-navojoa',
  costLines: [
    {
      id: 'c1',
      kind: 'refaccion',
      concept: 'Display',
      amount: 400,
      at: '2026-09-08T22:00:00.000Z',
      by: 'Op'
    },
    {
      id: 'c2',
      kind: 'mano_obra',
      concept: 'Mano de obra',
      amount: 150,
      at: '2026-09-01T18:00:00.000Z',
      by: 'Op'
    }
  ]
};

assert(isRepairIncomeTicket(mondayTicket), 'anticipo cuenta como ingreso del taller');
assert(!isRepairIncomeTicket(accessoryTicket), 'accesorio no entra al libro del taller');
assert(!isRepairIncomeTicket(cancelledRepair), 'ticket cancelado no cuenta');
assert(repairIncomeFromTicket(mondayTicket) === 500, 'cobrado del anticipo');

const week = buildRepairWeekFinance('2026-09-07', [mondayTicket, accessoryTicket, cancelledRepair], [repair]);
assert(week.cobrado === 500, `cobrado ${week.cobrado}`);
assert(week.costos === 400, `costos de esa semana, no la línea previa: ${week.costos}`);
assert(week.margen === 100, `margen ${week.margen}`);
assert(week.recibidos === 1, 'recibido el lunes');
assert(week.byBranch[0].branchId === 'b-navojoa', 'por sucursal');

const prev = buildRepairWeekFinance('2026-08-31', [], [repair]);
assert(prev.costos === 150, `mano de obra cae en la semana anterior: ${prev.costos}`);
assert(prev.cobrado === 0, 'sin cobros esa semana');

const starts = listRepairFinanceWeekStarts([mondayTicket], [repair]);
assert(starts.includes('2026-09-07'), 'incluye la semana del cobro');
assert(starts.includes('2026-08-31'), 'incluye la semana del costo previo');

const withLine = addRepairCostLine(repair, {
  kind: 'otro',
  concept: 'Envío de pieza',
  amount: 80,
  at: '2026-09-07T20:00:00.000Z',
  by: 'Admin'
});
assert(repairInternalCost(withLine) === 630, `interno ${repairInternalCost(withLine)}`);

const merged = mergeRepairSources(
  [{ ...repair, costLines: withLine.costLines }],
  [{ ...repair, costLines: undefined, clientName: 'Cliente actualizado' }]
);
assert(merged[0].clientName === 'Cliente actualizado', 'la ficha posterior gana el nombre');
assert((merged[0].costLines || []).length === 3, 'los costos internos no se pierden al reconstruir desde tickets');

console.log('repairFinance.selftest ok');
