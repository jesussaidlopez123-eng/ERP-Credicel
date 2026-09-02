import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Megaphone,
  ShieldCheck,
  Store
} from 'lucide-react';
import { Branch, Expense, Operator, Product, SaleTicket } from '../types';
import {
  ALL_BRANCHES,
  COMMERCIAL_BRANCHES,
  getBranchDisplayName,
  normalizeBranchId
} from '../data/initialBranches';
import {
  addCashDays,
  currentWeekStartKey,
  formatWeekRangeLabel,
  safeDateIsoKey,
  weekStartDateKey
} from '../lib/dateUtils';
import { formatMoney, money } from '../lib/ids';
import {
  addExecutiveItem,
  emptyExecutiveCats,
  executiveVentas,
  type ExecutiveCatKey,
  type ExecutiveCatTotals
} from '../lib/saleClassification';
import LoadMoreButton from './LoadMoreButton';

interface ExecutiveModuleProps {
  currentBranch: Branch;
  currentOperator: Operator;
  operators?: Operator[];
  onOpenNoticeModal: () => void;
  salesTickets?: SaleTicket[];
  expenses?: Expense[];
  products?: Product[];
  onLoadOlderSales?: () => void;
  salesHasMore?: boolean;
  historyBusy?: string | null;
}

const CATEGORIES: { key: ExecutiveCatKey; label: string; tone: string }[] = [
  { key: 'accesorios', label: 'Accesorios', tone: 'text-blue-800 bg-blue-50 border-blue-200' },
  { key: 'equipos', label: 'Equipos', tone: 'text-amber-900 bg-amber-50 border-amber-200' },
  { key: 'abonos', label: 'Abonos', tone: 'text-purple-900 bg-purple-50 border-purple-200' },
  { key: 'reparaciones', label: 'Reparaciones', tone: 'text-orange-900 bg-orange-50 border-orange-200' },
  { key: 'recargas', label: 'Recargas', tone: 'text-emerald-900 bg-emerald-50 border-emerald-200' }
];

type BranchWeekRow = {
  branchId: string;
  branchName: string;
  cats: ExecutiveCatTotals;
  gastos: number;
  tickets: number;
  ventas: number;
  utilidad: number;
};

type WeekBlock = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isCurrent: boolean;
  branches: BranchWeekRow[];
  totals: BranchWeekRow;
};

function emptyRow(branchId: string, branchName: string): BranchWeekRow {
  return {
    branchId,
    branchName,
    cats: emptyExecutiveCats(),
    gastos: 0,
    tickets: 0,
    ventas: 0,
    utilidad: 0
  };
}

function finalizeRow(row: BranchWeekRow): BranchWeekRow {
  row.ventas = executiveVentas(row.cats);
  row.utilidad = money(row.ventas - row.gastos);
  return row;
}

function buildWeekBlocks(tickets: SaleTicket[], expenses: Expense[], branchFilter: string): WeekBlock[] {
  const currentStart = currentWeekStartKey();
  const bucket = new Map<string, { tickets: SaleTicket[]; expenses: Expense[] }>();

  const take = (weekStart: string) => {
    if (!weekStart) return;
    if (!bucket.has(weekStart)) bucket.set(weekStart, { tickets: [], expenses: [] });
    return bucket.get(weekStart);
  };

  tickets.forEach((ticket) => {
    const bid = normalizeBranchId(ticket.branchId);
    if (branchFilter !== 'all' && bid !== branchFilter) return;
    const group = take(weekStartDateKey(safeDateIsoKey(ticket.timestamp)));
    group?.tickets.push(ticket);
  });

  expenses.forEach((expense) => {
    const bid = normalizeBranchId(expense.branchId);
    if (branchFilter !== 'all' && bid !== branchFilter) return;
    const group = take(weekStartDateKey(safeDateIsoKey(expense.timestamp || expense.date)));
    group?.expenses.push(expense);
  });

  const starts = Array.from(bucket.keys()).sort((a, b) => (a < b ? 1 : -1));
  if (currentStart && !starts.includes(currentStart)) starts.unshift(currentStart);

  const visibleBranches = (branchFilter === 'all' ? COMMERCIAL_BRANCHES : ALL_BRANCHES.filter((b) => b.id === branchFilter))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return starts.map((weekStart) => {
    const pack = bucket.get(weekStart) || { tickets: [], expenses: [] };
    const byBranch = new Map<string, BranchWeekRow>();
    visibleBranches.forEach((b) => byBranch.set(b.id, emptyRow(b.id, getBranchDisplayName(b.id))));

    pack.tickets.forEach((ticket) => {
      const bid = normalizeBranchId(ticket.branchId);
      if (!byBranch.has(bid)) {
        byBranch.set(bid, emptyRow(bid, getBranchDisplayName(bid)));
      }
      const row = byBranch.get(bid);
      if (!row) return;
      row.tickets += 1;
      (ticket.items || []).forEach((item) => addExecutiveItem(row.cats, item));
    });

    pack.expenses.forEach((expense) => {
      const bid = normalizeBranchId(expense.branchId);
      if (!byBranch.has(bid)) {
        byBranch.set(bid, emptyRow(bid, getBranchDisplayName(bid)));
      }
      const row = byBranch.get(bid);
      if (!row) return;
      row.gastos = money(row.gastos + (expense.amount || 0));
    });

    const branches = Array.from(byBranch.values())
      .map(finalizeRow)
      .filter((row) => visibleBranches.some((b) => b.id === row.branchId) || row.ventas > 0 || row.gastos > 0 || row.tickets > 0);

    const totals = emptyRow('all', 'Todas las sucursales');
    branches.forEach((row) => {
      totals.tickets += row.tickets;
      totals.gastos = money(totals.gastos + row.gastos);
      (Object.keys(row.cats) as (keyof ExecutiveCatTotals)[]).forEach((key) => {
        if (typeof row.cats[key] === 'number') {
          (totals.cats[key] as number) = money((totals.cats[key] as number) + (row.cats[key] as number));
        }
      });
    });
    finalizeRow(totals);

    return {
      weekStart,
      weekEnd: addCashDays(weekStart, 6),
      label: formatWeekRangeLabel(weekStart),
      isCurrent: weekStart === currentStart,
      branches,
      totals
    };
  });
}

function moneyCell(value: number, emptyDash = true) {
  if (!value && emptyDash) return <span className="text-slate-300">—</span>;
  return `$${formatMoney(value)}`;
}

function CategoryStrip({ cats, gastos }: { cats: ExecutiveCatTotals; gastos: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className={`rounded-xl border px-3 py-2 ${cat.tone}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{cat.label}</p>
          <p className="text-sm font-bold font-mono mt-0.5">${formatMoney(cats[cat.key])}</p>
          <p className="text-[10px] opacity-70">
            {cats[
              cat.key === 'accesorios'
                ? 'countAccesorios'
                : cat.key === 'equipos'
                  ? 'countEquipos'
                  : cat.key === 'abonos'
                    ? 'countAbonos'
                    : cat.key === 'reparaciones'
                      ? 'countReparaciones'
                      : 'countRecargas'
            ]}{' '}
            ops
          </p>
        </div>
      ))}
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Gastos</p>
        <p className="text-sm font-bold font-mono mt-0.5">-${formatMoney(gastos)}</p>
        <p className="text-[10px] opacity-70">salidas de caja</p>
      </div>
    </div>
  );
}

function WeekTable({ block }: { block: WeekBlock }) {
  const hasRows = block.branches.some((row) => row.tickets > 0 || row.gastos > 0 || row.ventas > 0);

  if (!hasRows) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Sin movimientos en esta semana{block.isCurrent ? ' todavía' : ''}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-xs min-w-[720px]">
        <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide text-[10px]">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Sucursal</th>
            {CATEGORIES.map((cat) => (
              <th key={cat.key} className="px-3 py-2.5 font-semibold text-right">
                {cat.label}
              </th>
            ))}
            <th className="px-3 py-2.5 font-semibold text-right">Gastos</th>
            <th className="px-3 py-2.5 font-semibold text-right">Ventas</th>
            <th className="px-3 py-2.5 font-semibold text-right">Utilidad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {block.branches.map((row) => (
            <tr key={row.branchId} className="hover:bg-slate-50/80">
              <td className="px-3 py-2.5 font-semibold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#0047AB]" />
                  {row.branchName}
                </span>
                <span className="block text-[10px] text-slate-500 font-medium">{row.tickets} tickets</span>
              </td>
              {CATEGORIES.map((cat) => (
                <td key={cat.key} className="px-3 py-2.5 text-right font-mono text-slate-800">
                  {moneyCell(row.cats[cat.key])}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-mono text-rose-700">
                {row.gastos ? `-$${formatMoney(row.gastos)}` : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                {moneyCell(row.ventas, false)}
              </td>
              <td className={`px-3 py-2.5 text-right font-mono font-bold ${row.utilidad >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ${formatMoney(row.utilidad)}
              </td>
            </tr>
          ))}
          {block.branches.length > 1 && (
            <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2.5 text-slate-900">Total semana</td>
              {CATEGORIES.map((cat) => (
                <td key={cat.key} className="px-3 py-2.5 text-right font-mono text-slate-900">
                  {moneyCell(block.totals.cats[cat.key], false)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-mono text-rose-700">
                -${formatMoney(block.totals.gastos)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-slate-900">
                ${formatMoney(block.totals.ventas)}
              </td>
              <td className={`px-3 py-2.5 text-right font-mono ${block.totals.utilidad >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ${formatMoney(block.totals.utilidad)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ExecutiveModule({
  currentBranch,
  currentOperator,
  onOpenNoticeModal,
  salesTickets = [],
  expenses = [],
  onLoadOlderSales,
  salesHasMore = false,
  historyBusy = null
}: ExecutiveModuleProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const weeks = useMemo(
    () => buildWeekBlocks(salesTickets, expenses, selectedBranchId),
    [salesTickets, expenses, selectedBranchId]
  );

  const currentWeek = weeks.find((week) => week.isCurrent) || weeks[0];
  const historyWeeks = weeks.filter((week) => !week.isCurrent);

  return (
    <div className="space-y-5 pb-16">
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0047AB] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Dirección
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              Semanas por sucursal y categoría
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Semana actual (lunes a domingo, hora Sonora) y el historial agrupado por las mismas categorías.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <Store className="w-3.5 h-3.5 text-[#0047AB]" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">Todas las sucursales</option>
                {ALL_BRANCHES.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {getBranchDisplayName(branch.id)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onOpenNoticeModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0047AB] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Aviso a sucursales
            </button>
          </div>
        </div>
      </div>

      {currentWeek && (
        <section className="bg-white rounded-2xl border-2 border-[#0047AB]/20 shadow-xs overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-blue-50/50">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0047AB]">Semana actual</p>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  {currentWeek.label}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedBranchId === 'all' ? 'Navojoa y Huatabampo' : getBranchDisplayName(selectedBranchId)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-right">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Ventas</p>
                  <p className="text-lg font-bold font-mono text-slate-900">${formatMoney(currentWeek.totals.ventas)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Gastos</p>
                  <p className="text-lg font-bold font-mono text-rose-700">-${formatMoney(currentWeek.totals.gastos)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Utilidad</p>
                  <p className={`text-lg font-bold font-mono ${currentWeek.totals.utilidad >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    ${formatMoney(currentWeek.totals.utilidad)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <CategoryStrip cats={currentWeek.totals.cats} gastos={currentWeek.totals.gastos} />
            <WeekTable block={currentWeek} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Historial semanal</h2>
          <p className="text-sm text-slate-500">
            Semanas anteriores, agrupadas lunes a domingo, con las mismas categorías.
          </p>
        </div>

        {historyWeeks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Aún no hay semanas anteriores en lo que está cargado.
          </div>
        ) : (
          historyWeeks.map((week) => {
            const open = openHistory[week.weekStart] ?? false;
            return (
              <article key={week.weekStart} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setOpenHistory((prev) => ({ ...prev, [week.weekStart]: !open }))
                  }
                  className="w-full px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 mt-0.5" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{week.label}</p>
                      <p className="text-xs text-slate-500">{week.totals.tickets} tickets</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono sm:text-right">
                    <span className="text-slate-700">
                      Ventas <strong>${formatMoney(week.totals.ventas)}</strong>
                    </span>
                    <span className="text-rose-700">
                      Gastos <strong>-${formatMoney(week.totals.gastos)}</strong>
                    </span>
                    <span className={week.totals.utilidad >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      Utilidad <strong>${formatMoney(week.totals.utilidad)}</strong>
                    </span>
                  </div>
                </button>

                <div className="px-4 sm:px-5 pb-4 space-y-3">
                  <CategoryStrip cats={week.totals.cats} gastos={week.totals.gastos} />
                  {open && <WeekTable block={week} />}
                  {!open && (
                    <p className="text-[11px] text-slate-400">Toca la semana para ver el desglose por sucursal.</p>
                  )}
                </div>
              </article>
            );
          })
        )}

        <LoadMoreButton
          hasMore={salesHasMore}
          loading={historyBusy === 'sales'}
          onClick={onLoadOlderSales}
          label="Cargar semanas anteriores"
        />
      </section>
    </div>
  );
}
