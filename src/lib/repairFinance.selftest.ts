import type { RepairRecord, SaleTicket } from '../types';
import {
  buildDeliveredWeekRegister,
  buildRepairRangeRegister,
  isRepairIncomeTicket,
  listAdminWeekStarts,
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

const delivered: RepairRecord = {
  ...repair,
  status: 'entregado',
  deliveredAt: '09/09/2026',
  deliveredAtIso: '2026-09-09T18:00:00.000Z',
  pendingBalance: 0
};

const week = buildDeliveredWeekRegister('2026-09-07', [delivered]);
assert(week.equipos === 1, 'el entregado entra a la semana');
assert(week.cobrado === 1200, `cobrado es el precio al cliente: ${week.cobrado}`);
assert(week.gastos === 550, `gastos del folio completo, no por fecha de captura: ${week.gastos}`);
assert(week.utilidad === 650, `utilidad ${week.utilidad}`);

const prev = buildDeliveredWeekRegister('2026-08-31', [delivered]);
assert(prev.equipos === 0, 'no entra a la semana anterior');
assert(prev.gastos === 0, 'los gastos viajan con la entrega, no con la fecha de la pieza');

const starts = listAdminWeekStarts([delivered]);
assert(starts.includes('2026-09-07'), 'incluye la semana de entrega');

const rangeHit = buildRepairRangeRegister('2026-09-08', '2026-09-10', [delivered]);
assert(rangeHit.equipos === 1, 'el rango incluye el día de entrega');
assert(rangeHit.utilidad === 650, `utilidad del rango ${rangeHit.utilidad}`);

const rangeMiss = buildRepairRangeRegister('2026-09-01', '2026-09-07', [delivered]);
assert(rangeMiss.equipos === 0, 'fuera del rango no entra');

const swapped = buildRepairRangeRegister('2026-09-10', '2026-09-08', [delivered]);
assert(swapped.equipos === 1, 'si las fechas van al revés se acomodan');

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
