import type { Expense, RepairCostKind, RepairRecord, SaleTicket } from '../types';
import { money } from './ids';
import {
  addCashDays,
  formatCashDateLabel,
  formatMonthLabel,
  formatWeekRangeLabel,
  listCashDays,
  monthEndDateKey,
  monthStartDateKey,
  safeDateIsoKey,
  todayCashDateKey,
  weekdayShortEs,
  weekStartDateKey
} from './dateUtils';
import { COMMERCIAL_BRANCHES, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import {
  addExecutiveItem,
  emptyExecutiveCats,
  isPhoneUnitSale,
  phoneUnitsSold
} from './saleClassification';
import {
  addExecutiveFinance,
  buildExecutiveFinance,
  emptyExecutiveFinance,
  type ExecutiveFinanceTotals
} from './executiveFinance';
import { isMatrizRepairExpense } from './repairCorte';
import { repairCostFinanceDateKey } from './repairUtils';

export const EXECUTIVE_AREA_COLORS = {
  utilidad: '#16a34a',
  inversion: '#2563eb',
  gastos: '#e11d48',
  retorno: '#eab308'
} as const;

export type ExecutiveAreaKey = keyof typeof EXECUTIVE_AREA_COLORS;

export const EXECUTIVE_AREA_LEGEND: { id: ExecutiveAreaKey; label: string; hint: string }[] = [
  { id: 'utilidad', label: 'Utilidad', hint: 'Accesorios + margen de taller + comisiones' },
  { id: 'inversion', label: 'Inversión', hint: 'Refacciones / repuestos de taller' },
  { id: 'gastos', label: 'Gastos', hint: 'Gastos de caja (sin refacciones de taller)' },
  { id: 'retorno', label: 'Retorno', hint: 'Equipos, abonos y recargas que se regresan' }
];

export type ExecutiveLinePeriod = 'semana' | 'mes' | 'rango';

export const EXECUTIVE_LINE_PERIODS: { id: ExecutiveLinePeriod; label: string }[] = [
  { id: 'semana', label: 'Semanal' },
  { id: 'mes', label: 'Mensual' },
  { id: 'rango', label: 'Rango' }
];

export type ExecutiveAreaTotals = {
  utilidad: number;
  inversion: number;
  gastos: number;
  retorno: number;
};

export type ExecutiveAreaPoint = ExecutiveAreaTotals & {
  dateKey: string;
  weekStart?: string;
  label: string;
  title: string;
};

function inDateRange(dateKey: string, from: string, to: string): boolean {
  if (!dateKey || !from || !to) return false;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return dateKey >= start && dateKey <= end;
}

export function matchesExecutiveBranch(branchId: string | undefined, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  return normalizeBranchId(branchId) === normalizeBranchId(filter);
}

function isCancelledRepair(repair: RepairRecord): boolean {
  const status = String(repair.status || '').toLowerCase();
  return status === 'cancelado' || status === 'cancelada' || status === 'baja';
}

function isCancelledTicket(ticket: SaleTicket): boolean {
  return String(ticket.estado || '').toUpperCase() === 'CANCELADA';
}

function lineKind(kind: RepairCostKind | string | undefined): RepairCostKind {
  const value = String(kind || '')
    .toLowerCase()
    .trim();
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
      const start = weekStartDateKey(repairCostFinanceDateKey(repair, line));
      if (start) starts.add(start);
    }
  }
  return [...starts];
}

export function sumRepairCostLines(
  repairs: RepairRecord[],
  from: string,
  to: string,
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
      if (!inDateRange(repairCostFinanceDateKey(repair, line), from, to)) continue;
      const kind = lineKind(line.kind);
      if (wantKinds && !wantKinds.includes(kind)) continue;
      total += money(line.amount);
    }
  }
  return money(total);
}

export function sumRepairCostLinesInWeek(
  repairs: RepairRecord[],
  weekStart: string,
  opts?: { branchId?: string; kinds?: RepairCostKind[] }
): number {
  return sumRepairCostLines(repairs, weekStart, addCashDays(weekStart, 6), opts);
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

/** La línea no baja del eje: la utilidad en rojo se ve en el recuadro. */
export function areaStackValues(totals: ExecutiveAreaTotals): ExecutiveAreaTotals {
  return {
    utilidad: money(Math.max(0, totals.utilidad)),
    inversion: money(Math.max(0, totals.inversion)),
    gastos: money(Math.max(0, totals.gastos)),
    retorno: money(Math.max(0, totals.retorno))
  };
}

export type ExecutiveTramoSegment = {
  id: ExecutiveAreaKey;
  label: string;
  amount: number;
  pct: number;
};

/** Partes de un solo tramo (como la barra de almacenamiento del iPhone). */
export function executiveTramoSegments(totals: ExecutiveAreaTotals): ExecutiveTramoSegment[] {
  const stacked = areaStackValues(totals);
  const whole = money(stacked.utilidad + stacked.inversion + stacked.gastos + stacked.retorno);
  return EXECUTIVE_AREA_LEGEND.map((item) => ({
    id: item.id,
    label: item.label,
    amount: stacked[item.id],
    pct: whole > 0 ? Math.round((stacked[item.id] / whole) * 1000) / 10 : 0
  })).filter((item) => item.amount > 0);
}

export function linePointTitle(dateKey: string, period: ExecutiveLinePeriod): string {
  const day = String(Number(dateKey.slice(8, 10) || '0'));
  if (period === 'mes') return day;
  if (period === 'semana') return `${weekdayShortEs(dateKey)} ${day}`;
  const month = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Hermosillo',
    month: 'short'
  })
    .format(new Date(`${dateKey}T12:00:00-07:00`))
    .replace('.', '');
  return `${day} ${month}`;
}

export function resolveExecutiveLineRange(
  period: ExecutiveLinePeriod,
  opts: {
    weekStart: string;
    monthDateKey?: string;
    rangeFrom: string;
    rangeTo: string;
    today?: string;
  }
): { from: string; to: string; days: string[]; label: string } {
  const today = opts.today || todayCashDateKey();
  if (period === 'semana') {
    const from = opts.weekStart || weekStartDateKey(today);
    const to = addCashDays(from, 6);
    return { from, to, days: listCashDays(from, to), label: formatWeekRangeLabel(from) };
  }
  if (period === 'mes') {
    const pivot = opts.monthDateKey || opts.weekStart || today;
    const from = monthStartDateKey(pivot);
    const monthEnd = monthEndDateKey(pivot);
    const to = monthEnd > today && from.slice(0, 7) === today.slice(0, 7) ? today : monthEnd;
    return { from, to, days: listCashDays(from, to), label: formatMonthLabel(from) };
  }
  let from = opts.rangeFrom || addCashDays(today, -29);
  let to = opts.rangeTo || today;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const days = listCashDays(from, to, 120);
  const last = days[days.length - 1] || to;
  return { from, to: last, days, label: `${formatCashDateLabel(from)} – ${formatCashDateLabel(last)}` };
}

function financeForDay(
  dateKey: string,
  tickets: SaleTicket[],
  expenses: Expense[],
  repairs: RepairRecord[],
  branchFilter: string
): ExecutiveFinanceTotals {
  let finance = emptyExecutiveFinance();
  for (const branch of COMMERCIAL_BRANCHES) {
    if (!matchesExecutiveBranch(branch.id, branchFilter)) continue;
    const cats = emptyExecutiveCats();
    let phonesSold = 0;
    let gastos = 0;
    for (const ticket of tickets) {
      if (isCancelledTicket(ticket)) continue;
      if (normalizeBranchId(ticket.branchId) !== branch.id) continue;
      if (safeDateIsoKey(ticket.timestamp) !== dateKey) continue;
      for (const item of ticket.items || []) {
        addExecutiveItem(cats, item);
        if (isPhoneUnitSale(item)) phonesSold += phoneUnitsSold(item);
      }
    }
    for (const expense of expenses) {
      if (isMatrizRepairExpense(expense)) continue;
      if (normalizeBranchId(expense.branchId) !== branch.id) continue;
      if (safeDateIsoKey(expense.timestamp || expense.date) !== dateKey) continue;
      gastos += money(expense.amount || 0);
    }
    const inversion = sumRepairCostLines(repairs, dateKey, dateKey, {
      branchId: branch.id,
      kinds: ['refaccion']
    });
    const tallerCostos = sumRepairCostLines(repairs, dateKey, dateKey, { branchId: branch.id });
    finance = addExecutiveFinance(
      finance,
      buildExecutiveFinance({
        branchId: branch.id,
        cats,
        gastos,
        phonesSold,
        inversion,
        tallerCostos
      })
    );
  }
  return finance;
}

export function buildExecutiveLinePoints(params: {
  days: string[];
  tickets: SaleTicket[];
  expenses: Expense[];
  repairs: RepairRecord[];
  branchId: string;
  period: ExecutiveLinePeriod;
}): ExecutiveAreaPoint[] {
  return (params.days || []).map((dateKey) => {
    const finance = financeForDay(
      dateKey,
      params.tickets || [],
      params.expenses || [],
      params.repairs || [],
      params.branchId
    );
    return {
      dateKey,
      weekStart: weekStartDateKey(dateKey),
      title: linePointTitle(dateKey, params.period),
      label: formatCashDateLabel(dateKey),
      ...areaTotalsFromFinance(finance)
    };
  });
}
