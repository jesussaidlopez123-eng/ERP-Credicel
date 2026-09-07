import type { RepairCostKind, RepairCostLine, RepairRecord, SaleTicket } from '../types';
import { money } from './ids';
import {
  addCashDays,
  currentWeekStartKey,
  formatWeekRangeLabel,
  safeDateIsoKey,
  weekStartDateKey
} from './dateUtils';
import { repairInternalCost } from './repairUtils';

export type RepairWeekFinanceRow = {
  branchId: string;
  cobrado: number;
  costos: number;
  margen: number;
  recibidos: number;
  entregados: number;
};

export type RepairWeekFinance = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isCurrent: boolean;
  cobrado: number;
  costos: number;
  margen: number;
  recibidos: number;
  entregados: number;
  byBranch: RepairWeekFinanceRow[];
};

const INCOME_TYPES = new Set(['anticipo', 'saldo_final', 'pago_total']);

export function isRepairIncomeTicket(ticket: SaleTicket): boolean {
  if (ticket.estado === 'CANCELADA') return false;
  return (ticket.items || []).some((item) => INCOME_TYPES.has(String(item.metadata?.repairType || '')));
}

export function repairIncomeFromTicket(ticket: SaleTicket): number {
  if (!isRepairIncomeTicket(ticket)) return 0;
  const sum = (ticket.items || []).reduce((acc, item) => {
    if (!INCOME_TYPES.has(String(item.metadata?.repairType || ''))) return acc;
    return acc + money(item.totalPrice || 0);
  }, 0);
  return money(sum);
}

function dateKeyOf(value: string | undefined): string {
  return safeDateIsoKey(value);
}

function inWeek(dateKey: string, weekStart: string): boolean {
  if (!dateKey || !weekStart) return false;
  const end = addCashDays(weekStart, 6);
  return dateKey >= weekStart && dateKey <= end;
}

export function listRepairFinanceWeekStarts(tickets: SaleTicket[], repairs: RepairRecord[]): string[] {
  const current = currentWeekStartKey();
  const starts = new Set<string>();
  if (current) starts.add(current);

  for (const ticket of tickets) {
    if (!isRepairIncomeTicket(ticket)) continue;
    const start = weekStartDateKey(dateKeyOf(ticket.timestamp));
    if (start) starts.add(start);
  }

  for (const repair of repairs) {
    const received = weekStartDateKey(dateKeyOf(repair.receivedAtIso || repair.receivedAt));
    if (received) starts.add(received);
    const deliveredAt = repair.deliveredAtIso || repair.deliveredAt;
    if (deliveredAt) {
      const delivered = weekStartDateKey(dateKeyOf(deliveredAt));
      if (delivered) starts.add(delivered);
    }
    for (const line of repair.costLines || []) {
      const start = weekStartDateKey(dateKeyOf(line.at));
      if (start) starts.add(start);
    }
  }

  return [...starts].filter(Boolean).sort((a, b) => (a < b ? 1 : -1));
}

export function buildRepairWeekFinance(
  weekStart: string,
  tickets: SaleTicket[],
  repairs: RepairRecord[]
): RepairWeekFinance {
  const current = currentWeekStartKey();
  const branches = new Map<string, RepairWeekFinanceRow>();
  const ensure = (branchId: string): RepairWeekFinanceRow => {
    let row = branches.get(branchId);
    if (!row) {
      row = { branchId, cobrado: 0, costos: 0, margen: 0, recibidos: 0, entregados: 0 };
      branches.set(branchId, row);
    }
    return row;
  };

  for (const ticket of tickets) {
    const cobrado = repairIncomeFromTicket(ticket);
    if (!cobrado) continue;
    if (!inWeek(dateKeyOf(ticket.timestamp), weekStart)) continue;
    ensure(ticket.branchId).cobrado = money(ensure(ticket.branchId).cobrado + cobrado);
  }

  for (const repair of repairs) {
    const row = ensure(repair.branchId);
    if (inWeek(dateKeyOf(repair.receivedAtIso || repair.receivedAt), weekStart)) {
      row.recibidos += 1;
    }
    if (repair.deliveredAtIso || repair.deliveredAt) {
      if (inWeek(dateKeyOf(repair.deliveredAtIso || repair.deliveredAt), weekStart)) {
        row.entregados += 1;
      }
    }
    for (const line of repair.costLines || []) {
      if (inWeek(dateKeyOf(line.at), weekStart)) {
        row.costos = money(row.costos + money(line.amount));
      }
    }
  }

  const byBranch = [...branches.values()]
    .map((row) => ({ ...row, margen: money(row.cobrado - row.costos) }))
    .filter((row) => row.cobrado || row.costos || row.recibidos || row.entregados)
    .sort((a, b) => a.branchId.localeCompare(b.branchId, 'es'));

  const cobrado = money(byBranch.reduce((sum, row) => sum + row.cobrado, 0));
  const costos = money(byBranch.reduce((sum, row) => sum + row.costos, 0));

  return {
    weekStart,
    weekEnd: addCashDays(weekStart, 6),
    label: formatWeekRangeLabel(weekStart),
    isCurrent: weekStart === current,
    cobrado,
    costos,
    margen: money(cobrado - costos),
    recibidos: byBranch.reduce((sum, row) => sum + row.recibidos, 0),
    entregados: byBranch.reduce((sum, row) => sum + row.entregados, 0),
    byBranch
  };
}

export function buildRepairFinanceWeeks(
  tickets: SaleTicket[],
  repairs: RepairRecord[]
): RepairWeekFinance[] {
  return listRepairFinanceWeekStarts(tickets, repairs).map((weekStart) =>
    buildRepairWeekFinance(weekStart, tickets, repairs)
  );
}

export function repairCustomerMargin(repair: RepairRecord): number {
  return money((repair.totalCost || 0) - repairInternalCost(repair));
}

export type WeekCostLine = RepairCostLine & { repairId: string; branchId: string };

export function listCostLinesInWeek(
  weekStart: string,
  repairs: RepairRecord[]
): WeekCostLine[] {
  const rows: WeekCostLine[] = [];
  for (const repair of repairs) {
    for (const line of repair.costLines || []) {
      if (!inWeek(dateKeyOf(line.at), weekStart)) continue;
      rows.push({ ...line, repairId: repair.id, branchId: repair.branchId });
    }
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export const REPAIR_COST_KIND_LABEL: Record<RepairCostKind, string> = {
  refaccion: 'Refacción',
  mano_obra: 'Mano de obra',
  otro: 'Otro'
};
