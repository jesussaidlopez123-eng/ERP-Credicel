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
  COMMERCIAL_BRANCHES,
  compareBranchIds,
  getBranchDisplayName,
  hasCashTill,
  normalizeBranchId
} from '../data/initialBranches';
import {
  addCashDays,
  currentWeekStartKey,
  formatWeekRangeLabel,
  naturalWeekTitle,
  isoWeekAndYear,
  safeDateIsoKey,
  safeFormatDate,
  safeFormatTime,
  weekStartDateKey,
  workedDatesLabel
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
  title: string;
  weekNumber: number;
  weekYear: number;
  isCurrent: boolean;
  workedFrom: string;
  workedTo: string;
  workedLabel: string;
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

const PASS: { id: CategoryId; label: 'Equipos cobrados' | 'Abonos' | 'Recargas'; hint: string }[] = [
  { id: 'equipos', label: 'Equipos cobrados', hint: 'Se retorna · no es utilidad' },
  { id: 'abonos', label: 'Abonos', hint: 'Se retorna · no es utilidad' },
  { id: 'recargas', label: 'Recargas', hint: 'Se retorna · no es utilidad' }
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
  const totals = emptyRow('all', 'Totales');
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

/** Suma visible: productos + comisiones − gastos, todavía con lo que se retorna. */
function weekGross(row: BranchWeekRow): number {
  return money(row.finance.ingresosPropios + row.finance.comisiones + row.finance.dineroPaso - row.finance.gastos);
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

function buildWeekBlocks(tickets: SaleTicket[], expenses: Expense[]): WeekBlock[] {
  const currentStart = currentWeekStartKey();
  const bucket = new Map<string, { tickets: SaleTicket[]; expenses: Expense[] }>();

  const take = (weekStart: string) => {
    if (!weekStart) return;
    if (!bucket.has(weekStart)) bucket.set(weekStart, { tickets: [], expenses: [] });
    return bucket.get(weekStart);
  };

  tickets.forEach((ticket) => {
    const bid = normalizeBranchId(ticket.branchId);
    if (!hasCashTill(bid)) return;
    const group = take(weekStartDateKey(safeDateIsoKey(ticket.timestamp)));
    group?.tickets.push(ticket);
  });

  expenses.forEach((expense) => {
    const bid = normalizeBranchId(expense.branchId);
    if (!hasCashTill(bid)) return;
    const group = take(weekStartDateKey(safeDateIsoKey(expense.timestamp || expense.date)));
    group?.expenses.push(expense);
  });

  const starts = Array.from(bucket.keys()).sort((a, b) => (a < b ? 1 : -1));
  if (currentStart && !starts.includes(currentStart)) starts.unshift(currentStart);

  const visibleBranches = COMMERCIAL_BRANCHES.slice().sort((a, b) => compareBranchIds(a.id, b.id));

  return starts.map((weekStart) => {
    const pack = bucket.get(weekStart) || { tickets: [], expenses: [] };
    const byBranch = new Map<string, BranchWeekRow>();
    visibleBranches.forEach((b) => byBranch.set(b.id, emptyRow(b.id, getBranchDisplayName(b.id))));
    const phones: PhoneSale[] = [];
    const events: CategoryEvent[] = [];
    const dateKeys: string[] = [];

    pack.tickets.forEach((ticket) => {
      const bid = normalizeBranchId(ticket.branchId);
      if (!byBranch.has(bid)) {
        byBranch.set(bid, emptyRow(bid, getBranchDisplayName(bid)));
      }
      const row = byBranch.get(bid);
      if (!row) return;
      const dayKey = safeDateIsoKey(ticket.timestamp);
      if (dayKey) dateKeys.push(dayKey);
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
      const dayKey = safeDateIsoKey(expense.timestamp || expense.date);
      if (dayKey) dateKeys.push(dayKey);
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

    const branches = visibleBranches
      .map((b) => byBranch.get(b.id) || emptyRow(b.id, getBranchDisplayName(b.id)))
      .map(applyFinance);

    const totals = sumBranchRows(branches);
    dateKeys.sort();
    const workedFrom = dateKeys[0] || '';
    const workedTo = dateKeys[dateKeys.length - 1] || '';
    const iso = isoWeekAndYear(weekStart);

    return {
      weekStart,
      weekEnd: addCashDays(weekStart, 6),
      label: formatWeekRangeLabel(weekStart),
      title: naturalWeekTitle(weekStart),
      weekNumber: iso.week,
      weekYear: iso.year,
      isCurrent: weekStart === currentStart,
      workedFrom,
      workedTo,
      workedLabel: workedDatesLabel(workedFrom, workedTo),
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

function MoneyCell({
  amount,
  minus,
  muted,
  strong
}: {
  amount: number;
  minus?: boolean;
  muted?: boolean;
  strong?: boolean;
}) {
  const color = minus
    ? 'text-rose-700'
    : muted
      ? 'text-slate-500'
      : strong
        ? 'text-slate-950'
        : 'text-slate-800';
  return (
    <span className={`font-mono tabular-nums ${strong ? 'text-base font-bold' : 'text-sm font-semibold'} ${color}`}>
      {minus && amount ? '−' : ''}${peso(Math.abs(amount))}
    </span>
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
                      <p className="text-sm font-semibold text-slate-900">{week.title}</p>
                      <p className="text-xs text-slate-500">
                        {week.label}
                        {week.isCurrent ? ' · En curso' : ''}
                        {' · '}
                        {week.workedLabel}
                        {' · '}
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

function WeekBoard({
  week,
  onOpenCategory
}: {
  week: WeekBlock;
  onOpenCategory: (id: CategoryId) => void;
}) {
  const columns = [...week.branches, week.totals];
  const ownRows = OURS;
  const passRows = PASS;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 bg-slate-950 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {week.isCurrent ? 'Semana en curso' : 'Semana elegida'}
          </p>
          <h2 className="text-2xl font-semibold mt-1">{week.title}</h2>
          <p className="text-sm text-slate-300 mt-1">
            Calendario {week.label}
          </p>
          <p className="text-sm text-slate-400">{week.workedLabel}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Utilidad</p>
          <p className={`font-mono text-3xl font-bold tabular-nums ${
            week.totals.utilidad >= 0 ? 'text-white' : 'text-rose-300'
          }`}>
            ${peso(week.totals.utilidad)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Después de descontar lo que se retorna
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left font-semibold text-slate-500 px-4 py-3 w-[28%]">Concepto</th>
              {week.branches.map((row) => (
                <th key={row.branchId} className="text-right font-semibold text-slate-700 px-4 py-3 w-[24%]">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <Store className="w-3.5 h-3.5 text-slate-400" />
                    {row.branchName}
                  </span>
                  <span className="block text-[10px] font-medium text-slate-400 mt-0.5">
                    {phoneCommissionRate(row.branchId) > 0
                      ? `Comisión $${peso(phoneCommissionRate(row.branchId))} / celular`
                      : 'Sin comisión'}
                  </span>
                </th>
              ))}
              <th className="text-right font-semibold text-slate-950 px-4 py-3 w-[24%] bg-slate-100">
                Totales
                <span className="block text-[10px] font-medium text-slate-500 mt-0.5">
                  Matriz + Navojoa + Huatabampo
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-4 py-2.5 text-slate-600">Celulares vendidos</td>
              {columns.map((row) => (
                <td
                  key={`${row.branchId}-phones`}
                  className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                    row.branchId === 'all' ? 'bg-slate-50' : ''
                  }`}
                >
                  {row.phonesSold}
                </td>
              ))}
            </tr>

            <tr>
              <td colSpan={columns.length + 1} className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Productos de Credicel
              </td>
            </tr>
            {ownRows.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer"
                onClick={() => onOpenCategory(item.id)}
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-slate-800 font-medium">
                    {categoryIcon(item.id)}
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 pl-6">{item.hint}</span>
                </td>
                {columns.map((row) => (
                  <td
                    key={`${row.branchId}-${item.id}`}
                    className={`px-4 py-2.5 text-right ${row.branchId === 'all' ? 'bg-slate-50' : ''}`}
                  >
                    <MoneyCell amount={categoryAmount(row, item.id)} minus={item.id === 'gastos'} />
                  </td>
                ))}
              </tr>
            ))}

            <tr>
              <td colSpan={columns.length + 1} className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Dinero de paso · se retorna
              </td>
            </tr>
            {passRows.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => onOpenCategory(item.id)}
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-slate-500 font-medium">
                    {categoryIcon(item.id)}
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 pl-6">{item.hint}</span>
                </td>
                {columns.map((row) => (
                  <td
                    key={`${row.branchId}-${item.id}`}
                    className={`px-4 py-2.5 text-right ${row.branchId === 'all' ? 'bg-slate-50' : ''}`}
                  >
                    <MoneyCell amount={categoryAmount(row, item.id)} muted />
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-t border-slate-200 bg-white">
              <td className="px-4 py-2.5 text-slate-600 font-medium">Suma de la semana</td>
              {columns.map((row) => (
                <td
                  key={`${row.branchId}-gross`}
                  className={`px-4 py-2.5 text-right ${row.branchId === 'all' ? 'bg-slate-50' : ''}`}
                >
                  <MoneyCell amount={weekGross(row)} />
                </td>
              ))}
            </tr>
            <tr className="bg-white">
              <td className="px-4 py-2.5 text-rose-800 font-medium">(−) Se retorna</td>
              {columns.map((row) => (
                <td
                  key={`${row.branchId}-paso`}
                  className={`px-4 py-2.5 text-right ${row.branchId === 'all' ? 'bg-amber-50' : ''}`}
                >
                  <MoneyCell amount={row.finance.dineroPaso} minus />
                </td>
              ))}
            </tr>
            <tr className="border-t-2 border-slate-900 bg-slate-950 text-white">
              <td className="px-4 py-3 font-semibold">
                Utilidad
                <span className="block text-[10px] font-medium text-slate-400 mt-0.5">
                  Accesorios + reparaciones + comisiones − gastos
                </span>
              </td>
              {columns.map((row) => (
                <td
                  key={`${row.branchId}-utilidad`}
                  className={`px-4 py-3 text-right ${row.branchId === 'all' ? 'bg-slate-900' : ''}`}
                >
                  <span className={`font-mono text-lg font-bold tabular-nums ${
                    row.utilidad >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    ${peso(row.utilidad)}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-slate-500 border-t border-slate-100 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Toca un producto para ver el historial de esa categoría.
      </p>
    </section>
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
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [historyCategory, setHistoryCategory] = useState<CategoryId | null>(null);

  const weeks = useMemo(
    () => buildWeekBlocks(salesTickets, expenses),
    [salesTickets, expenses]
  );

  const currentStart = weeks.find((week) => week.isCurrent)?.weekStart || weeks[0]?.weekStart || '';
  const activeWeekStart = weeks.some((week) => week.weekStart === selectedWeekStart)
    ? selectedWeekStart
    : currentStart;
  const activeWeek = weeks.find((week) => week.weekStart === activeWeekStart) || weeks[0];

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
            Semana actual
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Matriz, Navojoa, Huatabampo y el total. Equipos cobrados, abonos y recargas se ven en la suma y al final se descuentan: no son utilidad.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNoticeModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#0047AB] hover:bg-blue-700 text-white rounded-full text-xs font-semibold cursor-pointer self-start lg:self-auto"
        >
          <Megaphone className="w-3.5 h-3.5" />
          Aviso a sucursales
        </button>
      </div>

      {activeWeek && (
        <WeekBoard week={activeWeek} onOpenCategory={setHistoryCategory} />
      )}

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Semanas naturales</h2>
            <p className="text-xs text-slate-500">
              Numeradas lunes a domingo. Abajo van las fechas en que sí se trabajó.
            </p>
          </div>
        </div>
        {weeks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            Aún no hay semanas cargadas.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {weeks.map((week) => {
              const active = week.weekStart === activeWeek?.weekStart;
              return (
                <button
                  key={week.weekStart}
                  type="button"
                  onClick={() => setSelectedWeekStart(week.weekStart)}
                  className={`rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors min-h-[92px] ${
                    active
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                    active ? 'text-blue-300' : 'text-slate-400'
                  }`}>
                    {week.isCurrent ? 'En curso' : `Semana ${week.weekNumber}`}
                  </p>
                  <p className="text-sm font-semibold mt-0.5 leading-tight">{week.title}</p>
                  <p className={`text-[11px] mt-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                    {week.label}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${active ? 'text-slate-400' : 'text-slate-400'}`}>
                    {week.workedLabel}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

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
