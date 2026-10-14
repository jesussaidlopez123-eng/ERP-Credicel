import type { RepairCostKind, RepairRecord } from '../types';
import { money } from './ids';
import { addCashDays, safeDateIsoKey, weekStartDateKey } from './dateUtils';
import { hasCashTill, normalizeBranchId } from '../data/initialBranches';
import type { ExecutiveFinanceTotals } from './executiveFinance';

export const EXECUTIVE_AREA_COLORS = {
  utilidad: '#16a34a',
  inversion: '#2563eb',
  gastos: '#e11d48',
  retorno: '#eab308'
} as const;

export type ExecutiveAreaKey = keyof typeof EXECUTIVE_AREA_COLORS;

export const EXECUTIVE_AREA_LEGEND: { id: ExecutiveAreaKey; label: string; hint: string }[] = [
  { id: 'utilidad', label: 'Utilidad', hint: 'Accesorios + margen de taller + comisiones' },
  { id: 'inversion', label: 'Inversión', hint: 'Compra de refacciones' },
  { id: 'gastos', label: 'Gastos', hint: 'Gastos de caja' },
  { id: 'retorno', label: 'Retorno', hint: 'Equipos, abonos y recargas que se regresan' }
];

export type ExecutiveAreaTotals = {
  utilidad: number;
  inversion: number;
  gastos: number;
  retorno: number;
};

export type ExecutiveAreaPoint = ExecutiveAreaTotals & {
  weekStart: string;
  label: string;
  title: string;
};

function inWeek(dateKey: string, weekStart: string): boolean {
  if (!dateKey || !weekStart) return false;
  const end = addCashDays(weekStart, 6);
  return dateKey >= weekStart && dateKey <= end;
}

export function matchesExecutiveBranch(branchId: string | undefined, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  return normalizeBranchId(branchId) === normalizeBranchId(filter);
}

function isCancelledRepair(repair: RepairRecord): boolean {
  const status = String(repair.status || '').toLowerCase();
  return status === 'cancelado' || status === 'cancelada' || status === 'baja';
}

function lineKind(kind: RepairCostKind | string | undefined): RepairCostKind {
  const value = String(kind || '').toLowerCase().trim();
  if (value === 'mano_obra' || value === 'mano de obra' || value === 'labor') return 'mano_obra';
  if (value === 'otro' || value === 'other') return 'otro';
  return 'refaccion';
}

/** Semanas donde hay compra de pieza o costo interno, aunque esa caja no haya vendido. */
export function repairFinanceWeekStarts(repairs: RepairRecord[]): string[] {
  const starts = new Set<string>();
  for (const repair of repairs || []) {
    if (isCancelledRepair(repair)) continue;
    const bid = normalizeBranchId(repair.branchId);
    if (!hasCashTill(bid)) continue;
    for (const line of repair.costLines || []) {
      const start = weekStartDateKey(safeDateIsoKey(line.at));
      if (start) starts.add(start);
    }
  }
  return [...starts];
}

export function sumRepairCostLines(
  repairs: RepairRecord[],
  weekStart: string,
  opts?: { branchId?: string; kinds?: RepairCostKind[] }
): number {
  const wantKinds = opts?.kinds;
  let total = 0;
  for (const repair of repairs || []) {
    if (isCancelledRepair(repair)) continue;
    if (!matchesExecutiveBranch(repair.branchId, opts?.branchId || 'all')) continue;
    const bid = normalizeBranchId(repair.branchId);
    if (!hasCashTill(bid)) continue;
    for (const line of repair.costLines || []) {
      if (!inWeek(safeDateIsoKey(line.at), weekStart)) continue;
      const kind = lineKind(line.kind);
      if (wantKinds && !wantKinds.includes(kind)) continue;
      total += money(line.amount);
    }
  }
  return money(total);
}

export function areaTotalsFromFinance(finance: ExecutiveFinanceTotals): ExecutiveAreaTotals {
  return {
    utilidad: money(finance.utilidad),
    inversion: money(finance.inversion),
    gastos: money(finance.gastos),
    retorno: money(finance.dineroPaso)
  };
}

export function emptyExecutiveAreaTotals(): ExecutiveAreaTotals {
  return { utilidad: 0, inversion: 0, gastos: 0, retorno: 0 };
}

export function addExecutiveAreaTotals(
  acc: ExecutiveAreaTotals,
  next: ExecutiveAreaTotals
): ExecutiveAreaTotals {
  return {
    utilidad: money(acc.utilidad + next.utilidad),
    inversion: money(acc.inversion + next.inversion),
    gastos: money(acc.gastos + next.gastos),
    retorno: money(acc.retorno + next.retorno)
  };
}

/** El área no apila negativos: la utilidad en rojo se ve en el recuadro, no bajo el eje. */
export function areaStackValues(totals: ExecutiveAreaTotals): ExecutiveAreaTotals {
  return {
    utilidad: money(Math.max(0, totals.utilidad)),
    inversion: money(Math.max(0, totals.inversion)),
    gastos: money(Math.max(0, totals.gastos)),
    retorno: money(Math.max(0, totals.retorno))
  };
}
