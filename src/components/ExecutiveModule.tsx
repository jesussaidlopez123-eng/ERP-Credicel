import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  History,
  Megaphone,
  Package,
  ShieldCheck,
  Smartphone,
  Store,
  Wallet,
  Wrench,
  X
} from 'lucide-react';
import { Branch, CartItem, Expense, Operator, Product, SaleTicket } from '../types';
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
  safeFormatDate,
  safeFormatTime,
  weekStartDateKey
} from '../lib/dateUtils';
import { money, ticketFolioLabel } from '../lib/ids';
import {
  addExecutiveItem,
  classifyExecutiveItem,
  classifySaleItem,
  emptyExecutiveCats,
  isPhoneUnitSale,
  phoneUnitsSold,
  type ExecutiveCatTotals
} from '../lib/saleClassification';
import {
  addExecutiveFinance,
  buildExecutiveFinance,
  emptyExecutiveFinance,
  phoneCommissionAmount,
  phoneCommissionRate,
  type ExecutiveFinanceTotals
} from '../lib/executiveFinance';
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

type CategoryId =
  | 'accesorios'
  | 'reparaciones'
  | 'comisiones'
  | 'gastos'
  | 'equipos'
  | 'abonos'
  | 'recargas';

type CategoryEvent = {
  id: string;
  category: CategoryId;
  weekStart: string;
  dateLabel: string;
  branchId: string;
  branchName: string;
  operatorName: string;
  folio: string;
  title: string;
  detail: string;
  amount: number;
};

type PhoneSale = {
  id: string;
  folio: string;
  dateLabel: string;
  branchId: string;
  branchName: string;
  operatorName: string;
  model: string;
  imei: string;
  clientName: string;
  clientPhone: string;
  saleKind: 'contado' | 'credito';
  financing: string;
  paymentMethod: string;
  collected: number;
  fullPrice: number;
  downPayment: number;
  remaining: number;
  quantity: number;
  commission: number;
};

type BranchWeekRow = {
  branchId: string;
  branchName: string;
  cats: ExecutiveCatTotals;
  gastos: number;
  tickets: number;
  phonesSold: number;
  ventas: number;
  utilidad: number;
  finance: ExecutiveFinanceTotals;
};

type WeekBlock = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isCurrent: boolean;
  branches: BranchWeekRow[];
  totals: BranchWeekRow;
  phones: PhoneSale[];
  events: CategoryEvent[];
};

const OURS: { id: CategoryId; label: string; hint: string }[] = [
  { id: 'accesorios', label: 'Accesorios', hint: 'Sí es ingreso' },
  { id: 'reparaciones', label: 'Reparaciones', hint: 'Sí es ingreso' },
  { id: 'comisiones', label: 'Comisiones', hint: 'Navojoa $1,000 · Huatabampo $350' },
  { id: 'gastos', label: 'Gastos', hint: 'Se restan del resultado' }
];

const PASS: { id: CategoryId; label: string; hint: string }[] = [
  { id: 'equipos', label: 'Equipos', hint: 'Solo pasa · no es utilidad' },
  { id: 'abonos', label: 'Abonos', hint: 'Solo pasa · no es utilidad' },
  { id: 'recargas', label: 'Recargas', hint: 'Solo pasa · no es utilidad' }
];

function categoryMeta(id: CategoryId) {
  return [...OURS, ...PASS].find((item) => item.id === id) || OURS[0];
}

function categoryIcon(id: CategoryId) {
  if (id === 'accesorios') return <Package className="w-4 h-4" />;
  if (id === 'reparaciones') return <Wrench className="w-4 h-4" />;
  if (id === 'comisiones' || id === 'equipos') return <Smartphone className="w-4 h-4" />;
  if (id === 'gastos') return <Wallet className="w-4 h-4" />;
  return <ArrowLeftRight className="w-4 h-4" />;
}

function categoryAmount(row: BranchWeekRow, id: CategoryId): number {
  if (id === 'accesorios') return row.cats.accesorios;
  if (id === 'reparaciones') return row.cats.reparaciones;
  if (id === 'comisiones') return row.finance.comisiones;
  if (id === 'gastos') return row.gastos;
  if (id === 'equipos') return row.cats.equipos;
  if (id === 'abonos') return row.cats.abonos;
  return row.cats.recargas;
}

function categoryCount(row: BranchWeekRow, events: CategoryEvent[], id: CategoryId): number {
  if (id === 'accesorios') return row.cats.countAccesorios;
  if (id === 'reparaciones') return row.cats.countReparaciones;
  if (id === 'abonos') return row.cats.countAbonos;
  if (id === 'recargas') return row.cats.countRecargas;
  if (id === 'equipos' || id === 'comisiones') return row.phonesSold;
  return events.filter((event) => event.category === id).length;
}

function emptyRow(branchId: string, branchName: string): BranchWeekRow {
  return {
    branchId,
    branchName,
    cats: emptyExecutiveCats(),
    gastos: 0,
    tickets: 0,
    phonesSold: 0,
    ventas: 0,
    utilidad: 0,
    finance: emptyExecutiveFinance()
  };
}

function applyFinance(row: BranchWeekRow): BranchWeekRow {
  row.finance = buildExecutiveFinance({
    branchId: row.branchId,
    cats: row.cats,
    gastos: row.gastos,
    phonesSold: row.phonesSold
  });
  row.ventas = money(row.finance.ingresosPropios + row.finance.dineroPaso);
  row.utilidad = row.finance.resultado;
  return row;
}

function sumBranchRows(rows: BranchWeekRow[]): BranchWeekRow {
  const totals = emptyRow('all', 'Todas las sucursales');
  let finance = emptyExecutiveFinance();
  rows.forEach((row) => {
    totals.tickets += row.tickets;
    totals.phonesSold += row.phonesSold;
    totals.gastos = money(totals.gastos + row.gastos);
    finance = addExecutiveFinance(finance, row.finance);
    (Object.keys(row.cats) as (keyof ExecutiveCatTotals)[]).forEach((key) => {
      const value = row.cats[key];
      if (typeof value === 'number') {
        (totals.cats[key] as number) = (totals.cats[key] as number) + value;
      }
    });
  });
  totals.cats.accesorios = money(totals.cats.accesorios);
  totals.cats.equipos = money(totals.cats.equipos);
  totals.cats.abonos = money(totals.cats.abonos);
  totals.cats.reparaciones = money(totals.cats.reparaciones);
  totals.cats.recargas = money(totals.cats.recargas);
  totals.finance = finance;
  totals.ventas = money(finance.ingresosPropios + finance.dineroPaso);
  totals.utilidad = finance.resultado;
  return totals;
}

function toPhoneSale(ticket: SaleTicket, item: CartItem, index: number): PhoneSale | null {
  if (!isPhoneUnitSale(item)) return null;
  const meta = item.metadata || {};
  const qty = phoneUnitsSold(item);
  const collected = money(Number(item.totalPrice) || 0);
  const fullPrice = money(Number(meta.fullPrice ?? item.totalPrice) || 0);
  const downPayment = money(Number(meta.downPayment ?? (meta.saleType === 'credito' ? item.totalPrice : fullPrice)) || 0);
  const remaining = money(
    Number(meta.remainingBalance ?? Math.max(0, fullPrice - downPayment)) || 0
  );
  const credit = classifySaleItem(item) === 'enganches' || meta.saleType === 'credito';
  return {
    id: `${ticket.id}-${item.cartItemId || index}`,
    folio: ticketFolioLabel(ticket),
    dateLabel: `${safeFormatDate(ticket.timestamp)} ${safeFormatTime(ticket.timestamp)}`,
    branchId: normalizeBranchId(ticket.branchId),
    branchName: getBranchDisplayName(ticket.branchId),
    operatorName: ticket.operatorName || 'Cajero',
    model: meta.deviceModel || item.product?.name || 'Celular',
    imei: meta.imei || '',
    clientName: meta.clientName || 'Mostrador',
    clientPhone: meta.clientPhone || '',
    saleKind: credit ? 'credito' : 'contado',
    financing: credit ? (meta.financingPlatform || 'Crédito') : 'Contado',
    paymentMethod: ticket.paymentMethod || 'Efectivo',
    collected,
    fullPrice,
    downPayment,
    remaining,
    quantity: qty,
    commission: phoneCommissionAmount(ticket.branchId, qty)
  };
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
    const phones: PhoneSale[] = [];
    const events: CategoryEvent[] = [];

    pack.tickets.forEach((ticket) => {
      const bid = normalizeBranchId(ticket.branchId);
      if (!byBranch.has(bid)) {
        byBranch.set(bid, emptyRow(bid, getBranchDisplayName(bid)));
      }
      const row = byBranch.get(bid);
      if (!row) return;
      row.tickets += 1;
      const folio = ticketFolioLabel(ticket);
      const dateLabel = `${safeFormatDate(ticket.timestamp)} ${safeFormatTime(ticket.timestamp)}`;
      const branchName = getBranchDisplayName(ticket.branchId);
      (ticket.items || []).forEach((item, index) => {
        addExecutiveItem(row.cats, item);
        const cat = classifyExecutiveItem(item);
        const qty = item.quantity > 0 ? item.quantity : 1;
        events.push({
          id: `${ticket.id}-${item.cartItemId || index}-${cat}`,
          category: cat,
          weekStart,
          dateLabel,
          branchId: bid,
          branchName,
          operatorName: ticket.operatorName || 'Cajero',
          folio,
          title: item.metadata?.deviceModel || item.product?.name || categoryMeta(cat).label,
          detail: qty > 1 ? `${qty} pzas · ${ticket.paymentMethod}` : ticket.paymentMethod,
          amount: money(Number(item.totalPrice) || 0)
        });
        const phone = toPhoneSale(ticket, item, index);
        if (phone) {
          row.phonesSold += phone.quantity;
          phones.push(phone);
          events.push({
            id: `${phone.id}-comision`,
            category: 'comisiones',
            weekStart,
            dateLabel,
            branchId: bid,
            branchName,
            operatorName: phone.operatorName,
            folio,
            title: phone.model,
            detail: phone.imei
              ? `IMEI ${phone.imei} · ${phone.saleKind === 'credito' ? phone.financing : 'Contado'}`
              : phone.saleKind === 'credito' ? phone.financing : 'Contado',
            amount: phone.commission
          });
        }
      });
    });

    pack.expenses.forEach((expense) => {
      const bid = normalizeBranchId(expense.branchId);
      if (!byBranch.has(bid)) {
        byBranch.set(bid, emptyRow(bid, getBranchDisplayName(bid)));
      }
      const row = byBranch.get(bid);
      if (!row) return;
      row.gastos = money(row.gastos + (expense.amount || 0));
      events.push({
        id: expense.id,
        category: 'gastos',
        weekStart,
        dateLabel: `${safeFormatDate(expense.timestamp || expense.date)} ${safeFormatTime(expense.timestamp || expense.date)}`,
        branchId: bid,
        branchName: getBranchDisplayName(expense.branchId),
        operatorName: expense.operatorName || 'Cajero',
        folio: 'Gasto',
        title: expense.concept || 'Gasto',
        detail: getBranchDisplayName(expense.branchId),
        amount: money(expense.amount || 0)
      });
    });

    const branches = Array.from(byBranch.values())
      .map(applyFinance)
      .filter((row) => visibleBranches.some((b) => b.id === row.branchId) || row.ventas > 0 || row.gastos > 0 || row.tickets > 0);

    const totals = sumBranchRows(branches);

    return {
      weekStart,
      weekEnd: addCashDays(weekStart, 6),
      label: formatWeekRangeLabel(weekStart),
      isCurrent: weekStart === currentStart,
      branches,
      totals,
      phones,
      events
    };
  });
}

function peso(n: number): string {
  return money(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CategoryTile({
  id,
  amount,
  count,
  passThrough,
  onOpen
}: {
  id: CategoryId;
  amount: number;
  count: number;
  passThrough?: boolean;
  onOpen: () => void;
}) {
  const meta = categoryMeta(id);
  const minus = id === 'gastos';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`h-full min-h-[148px] w-full rounded-2xl border p-4 text-left flex flex-col cursor-pointer transition-colors ${
        passThrough
          ? 'border-dashed border-slate-300 bg-slate-50 hover:bg-white'
          : 'border-slate-200 bg-white hover:border-[#0047AB]/40 hover:shadow-sm'
      }`}
    >
      <div className={`flex items-center gap-2 ${passThrough ? 'text-slate-500' : 'text-slate-700'}`}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
          passThrough ? 'bg-white border border-slate-200' : 'bg-slate-100'
        }`}>
          {categoryIcon(id)}
        </span>
        <p className="text-sm font-semibold">{meta.label}</p>
      </div>
      <p className={`mt-3 font-mono text-2xl font-bold tabular-nums ${
        minus ? 'text-rose-700' : passThrough ? 'text-slate-500' : 'text-slate-950'
      }`}>
        {minus && amount ? '−' : ''}${peso(Math.abs(amount))}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {count} registro{count === 1 ? '' : 's'} · {meta.hint}
      </p>
      <p className="mt-auto pt-3 text-xs font-semibold text-[#0047AB] flex items-center gap-1">
        <History className="w-3.5 h-3.5" />
        Ver historial
      </p>
    </button>
  );
}

function CategoryHistoryModal({
  category,
  weeks,
  onClose,
  onLoadOlder,
  salesHasMore,
  historyBusy
}: {
  category: CategoryId;
  weeks: WeekBlock[];
  onClose: () => void;
  onLoadOlder?: () => void;
  salesHasMore?: boolean;
  historyBusy?: string | null;
}) {
  const meta = categoryMeta(category);
  const passThrough = PASS.some((item) => item.id === category);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>(() => {
    const first = weeks[0]?.weekStart;
    return first ? { [first]: true } : {};
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grandTotal = weeks.reduce((sum, week) => money(sum + categoryAmount(week.totals, category)), 0);
  const grandCount = weeks.reduce((sum, week) => sum + categoryCount(week.totals, week.events, category), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className={`px-4 sm:px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 ${
          passThrough ? 'bg-slate-100' : 'bg-slate-950 text-white'
        }`}>
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${passThrough ? 'text-slate-500' : 'text-blue-300'}`}>
              Historial de categoría
            </p>
            <h3 className="text-lg font-semibold mt-1 flex items-center gap-2">
              {categoryIcon(category)}
              {meta.label}
            </h3>
            <p className={`text-xs mt-1 ${passThrough ? 'text-slate-500' : 'text-slate-400'}`}>
              {meta.hint} · {grandCount} registro{grandCount === 1 ? '' : 's'} en lo cargado
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right">
              <p className={`text-[10px] uppercase tracking-wider ${passThrough ? 'text-slate-500' : 'text-slate-400'}`}>
                Total
              </p>
              <p className={`font-mono text-xl font-bold tabular-nums ${
                category === 'gastos' ? 'text-rose-600' : passThrough ? 'text-slate-700' : 'text-emerald-300'
              }`}>
                {category === 'gastos' && grandTotal ? '−' : ''}${peso(Math.abs(grandTotal))}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg cursor-pointer ${passThrough ? 'text-slate-500 hover:bg-white' : 'text-slate-300 hover:bg-white/10'}`}
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-2">
          {weeks.every((week) => categoryCount(week.totals, week.events, category) === 0) ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Aún no hay {meta.label.toLowerCase()} en las semanas cargadas.
            </div>
          ) : (
            weeks.map((week) => {
              const amount = categoryAmount(week.totals, category);
              const count = categoryCount(week.totals, week.events, category);
              const lines = week.events.filter((event) => event.category === category);
              const open = openWeeks[week.weekStart] ?? false;
              return (
                <article key={week.weekStart} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenWeeks((prev) => ({ ...prev, [week.weekStart]: !open }))}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 cursor-pointer"
                  >
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{week.label}</p>
                      <p className="text-xs text-slate-500">
                        {week.isCurrent ? 'Semana en curso · ' : ''}
                        {count} registro{count === 1 ? '' : 's'}
                      </p>
                    </div>
                    <p className={`font-mono text-sm font-bold tabular-nums ${
                      category === 'gastos' ? 'text-rose-700' : passThrough ? 'text-slate-500' : 'text-slate-950'
                    }`}>
                      {category === 'gastos' && amount ? '−' : ''}${peso(Math.abs(amount))}
                    </p>
                  </button>
                  {open && (
                    <div className="border-t border-slate-100">
                      {lines.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-slate-400">Sin registros en esta semana.</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {lines.map((event) => (
                            <li key={event.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{event.title}</p>
                                <p className="text-[11px] text-slate-500">
                                  {event.folio} · {event.dateLabel}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {event.branchName} · {event.operatorName}
                                  {event.detail ? ` · ${event.detail}` : ''}
                                </p>
                              </div>
                              <p className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                                category === 'gastos' ? 'text-rose-700' : passThrough ? 'text-slate-500' : 'text-emerald-800'
                              }`}>
                                {category === 'gastos' ? '−' : ''}${peso(Math.abs(event.amount))}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
          <LoadMoreButton
            hasMore={salesHasMore}
            loading={historyBusy === 'sales'}
            onClick={onLoadOlder}
            label="Cargar semanas anteriores"
          />
        </div>
      </div>
    </div>
  );
}

export default function ExecutiveModule({
  onOpenNoticeModal,
  salesTickets = [],
  expenses = [],
  onLoadOlderSales,
  salesHasMore = false,
  historyBusy = null
}: ExecutiveModuleProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [historyCategory, setHistoryCategory] = useState<CategoryId | null>(null);

  const weeks = useMemo(
    () => buildWeekBlocks(salesTickets, expenses, selectedBranchId),
    [salesTickets, expenses, selectedBranchId]
  );

  const currentStart = weeks.find((week) => week.isCurrent)?.weekStart || weeks[0]?.weekStart || '';
  const activeWeekStart = weeks.some((week) => week.weekStart === selectedWeekStart)
    ? selectedWeekStart
    : currentStart;
  const activeWeek = weeks.find((week) => week.weekStart === activeWeekStart) || weeks[0];
  const filterLabel = selectedBranchId === 'all' ? 'Navojoa y Huatabampo' : getBranchDisplayName(selectedBranchId);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0047AB] uppercase tracking-[0.18em]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Dirección
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-400" />
            Resumen de la semana
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Cuatro cuentas que sí son de Credicel y tres que solo transitan. Toca una para ver su historial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
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
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0047AB] hover:bg-blue-700 text-white rounded-full text-xs font-semibold cursor-pointer"
          >
            <Megaphone className="w-3.5 h-3.5" />
            Aviso a sucursales
          </button>
        </div>
      </div>

      {activeWeek && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {activeWeek.isCurrent ? 'Semana en curso' : 'Semana elegida'}
              </p>
              <h2 className="text-xl font-semibold text-slate-900 mt-0.5">{activeWeek.label}</h2>
              <p className="text-sm text-slate-500">{filterLabel}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Resultado</p>
              <p className={`font-mono text-3xl font-bold tabular-nums ${
                activeWeek.totals.utilidad >= 0 ? 'text-slate-950' : 'text-rose-700'
              }`}>
                ${peso(activeWeek.totals.utilidad)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                accesorios + reparaciones + comisiones − gastos
              </p>
            </div>
          </section>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {weeks.map((week) => {
              const active = week.weekStart === activeWeek.weekStart;
              return (
                <button
                  key={week.weekStart}
                  type="button"
                  onClick={() => setSelectedWeekStart(week.weekStart)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer border ${
                    active
                      ? 'bg-slate-950 text-white border-slate-950'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {week.isCurrent ? 'Esta semana' : week.label}
                </button>
              );
            })}
          </div>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Lo que sí es de Credicel</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {OURS.map((item) => (
                <CategoryTile
                  key={item.id}
                  id={item.id}
                  amount={categoryAmount(activeWeek.totals, item.id)}
                  count={categoryCount(activeWeek.totals, activeWeek.events, item.id)}
                  onOpen={() => setHistoryCategory(item.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-500 mb-2">Dinero de paso · no entra al resultado</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PASS.map((item) => (
                <CategoryTile
                  key={item.id}
                  id={item.id}
                  amount={categoryAmount(activeWeek.totals, item.id)}
                  count={categoryCount(activeWeek.totals, activeWeek.events, item.id)}
                  passThrough
                  onOpen={() => setHistoryCategory(item.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Por sucursal</h2>
            <div className={`grid gap-3 ${activeWeek.branches.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {activeWeek.branches.map((row) => (
                <article key={row.branchId} className="rounded-2xl border border-slate-200 bg-white p-4 min-h-[148px] flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-slate-500" />
                        {row.branchName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {phoneCommissionRate(row.branchId) > 0
                          ? `Comisión $${peso(phoneCommissionRate(row.branchId))} / celular`
                          : 'Sin comisión por celular'}
                      </p>
                    </div>
                    <p className={`font-mono text-2xl font-bold tabular-nums ${
                      row.utilidad >= 0 ? 'text-slate-950' : 'text-rose-700'
                    }`}>
                      ${peso(row.utilidad)}
                    </p>
                  </div>
                  <div className="mt-auto pt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <p className="text-slate-400">Celulares</p>
                      <p className="font-semibold text-slate-800">{row.phonesSold}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Lo nuestro</p>
                      <p className="font-mono font-semibold text-slate-800">
                        ${peso(money(row.finance.ingresosPropios + row.finance.comisiones))}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">De paso</p>
                      <p className="font-mono font-semibold text-slate-500">${peso(row.finance.dineroPaso)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <LoadMoreButton
        hasMore={salesHasMore}
        loading={historyBusy === 'sales'}
        onClick={onLoadOlderSales}
        label="Cargar semanas anteriores"
      />

      {historyCategory && (
        <CategoryHistoryModal
          category={historyCategory}
          weeks={weeks}
          onClose={() => setHistoryCategory(null)}
          onLoadOlder={onLoadOlderSales}
          salesHasMore={salesHasMore}
          historyBusy={historyBusy}
        />
      )}
    </div>
  );
}
