import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Megaphone,
  ShieldCheck,
  Smartphone,
  Store,
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
import { formatMoney, money, ticketFolioLabel } from '../lib/ids';
import {
  addExecutiveItem,
  classifySaleItem,
  emptyExecutiveCats,
  executiveVentas,
  isPhoneUnitSale,
  phoneUnitsSold,
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
};

type WeekBlock = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isCurrent: boolean;
  branches: BranchWeekRow[];
  totals: BranchWeekRow;
  phones: PhoneSale[];
};

function emptyRow(branchId: string, branchName: string): BranchWeekRow {
  return {
    branchId,
    branchName,
    cats: emptyExecutiveCats(),
    gastos: 0,
    tickets: 0,
    phonesSold: 0,
    ventas: 0,
    utilidad: 0
  };
}

function finalizeRow(row: BranchWeekRow): BranchWeekRow {
  row.ventas = executiveVentas(row.cats);
  row.utilidad = money(row.ventas - row.gastos);
  return row;
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
    quantity: qty
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

    pack.tickets.forEach((ticket) => {
      const bid = normalizeBranchId(ticket.branchId);
      if (!byBranch.has(bid)) {
        byBranch.set(bid, emptyRow(bid, getBranchDisplayName(bid)));
      }
      const row = byBranch.get(bid);
      if (!row) return;
      row.tickets += 1;
      (ticket.items || []).forEach((item, index) => {
        addExecutiveItem(row.cats, item);
        const phone = toPhoneSale(ticket, item, index);
        if (phone) {
          row.phonesSold += phone.quantity;
          phones.push(phone);
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
    });

    const branches = Array.from(byBranch.values())
      .map(finalizeRow)
      .filter((row) => visibleBranches.some((b) => b.id === row.branchId) || row.ventas > 0 || row.gastos > 0 || row.tickets > 0);

    const totals = emptyRow('all', 'Todas las sucursales');
    branches.forEach((row) => {
      totals.tickets += row.tickets;
      totals.phonesSold += row.phonesSold;
      totals.gastos = money(totals.gastos + row.gastos);
      (Object.keys(row.cats) as (keyof ExecutiveCatTotals)[]).forEach((key) => {
        if (typeof row.cats[key] === 'number') {
          (totals.cats[key] as number) = (totals.cats[key] as number) + (row.cats[key] as number);
        }
      });
    });
    totals.cats.accesorios = money(totals.cats.accesorios);
    totals.cats.equipos = money(totals.cats.equipos);
    totals.cats.abonos = money(totals.cats.abonos);
    totals.cats.reparaciones = money(totals.cats.reparaciones);
    totals.cats.recargas = money(totals.cats.recargas);
    finalizeRow(totals);

    return {
      weekStart,
      weekEnd: addCashDays(weekStart, 6),
      label: formatWeekRangeLabel(weekStart),
      isCurrent: weekStart === currentStart,
      branches,
      totals,
      phones
    };
  });
}

function moneyCell(value: number, emptyDash = true) {
  if (!value && emptyDash) return <span className="text-slate-300">—</span>;
  return `$${formatMoney(value)}`;
}

function CategoryStrip({
  cats,
  gastos,
  phonesSold,
  onOpenPhones
}: {
  cats: ExecutiveCatTotals;
  gastos: number;
  phonesSold: number;
  onOpenPhones?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {CATEGORIES.map((cat) => {
        const count =
          cat.key === 'accesorios'
            ? cats.countAccesorios
            : cat.key === 'equipos'
              ? phonesSold
              : cat.key === 'abonos'
                ? cats.countAbonos
                : cat.key === 'reparaciones'
                  ? cats.countReparaciones
                  : cats.countRecargas;

        if (cat.key === 'equipos') {
          return (
            <button
              key={cat.key}
              type="button"
              onClick={phonesSold > 0 ? onOpenPhones : undefined}
              className={`rounded-xl border px-3 py-2 text-left ${cat.tone} ${phonesSold > 0 ? 'cursor-pointer hover:shadow-sm hover:border-amber-400' : ''}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{cat.label}</p>
              <p className="text-sm font-bold mt-0.5">
                {phonesSold} celular{phonesSold === 1 ? '' : 'es'}
              </p>
              <p className="text-[10px] font-mono opacity-80">${formatMoney(cats.equipos)} cobrado</p>
              {phonesSold > 0 && (
                <p className="text-[10px] font-semibold mt-0.5 underline underline-offset-2">Ver cuáles</p>
              )}
            </button>
          );
        }

        return (
          <div key={cat.key} className={`rounded-xl border px-3 py-2 ${cat.tone}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{cat.label}</p>
            <p className="text-sm font-bold font-mono mt-0.5">${formatMoney(cats[cat.key])}</p>
            <p className="text-[10px] opacity-70">{count} ops</p>
          </div>
        );
      })}
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Gastos</p>
        <p className="text-sm font-bold font-mono mt-0.5">-${formatMoney(gastos)}</p>
        <p className="text-[10px] opacity-70">salidas de caja</p>
      </div>
    </div>
  );
}

function WeekTable({
  block,
  onOpenPhones
}: {
  block: WeekBlock;
  onOpenPhones: (branchId?: string, branchName?: string) => void;
}) {
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
      <table className="w-full text-left text-xs min-w-[760px]">
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
                  {cat.key === 'equipos' ? (
                    <button
                      type="button"
                      disabled={row.phonesSold === 0}
                      onClick={() => onOpenPhones(row.branchId, row.branchName)}
                      className={`text-right ${row.phonesSold > 0 ? 'cursor-pointer hover:text-amber-800' : 'cursor-default'}`}
                    >
                      <span className="block">{moneyCell(row.cats.equipos)}</span>
                      <span className="block text-[10px] font-semibold text-amber-800">
                        {row.phonesSold} celular{row.phonesSold === 1 ? '' : 'es'}
                      </span>
                    </button>
                  ) : (
                    moneyCell(row.cats[cat.key])
                  )}
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
                  {cat.key === 'equipos' ? (
                    <button
                      type="button"
                      disabled={block.totals.phonesSold === 0}
                      onClick={() => onOpenPhones()}
                      className={`text-right ${block.totals.phonesSold > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="block">${formatMoney(block.totals.cats.equipos)}</span>
                      <span className="block text-[10px] text-amber-800">
                        {block.totals.phonesSold} celular{block.totals.phonesSold === 1 ? '' : 'es'}
                      </span>
                    </button>
                  ) : (
                    moneyCell(block.totals.cats[cat.key], false)
                  )}
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

function PhoneSalesModal({
  weekLabel,
  branchName,
  phones,
  onClose
}: {
  weekLabel: string;
  branchName?: string;
  phones: PhoneSale[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const units = phones.reduce((sum, phone) => sum + phone.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-start justify-between gap-3 bg-amber-50">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Celulares vendidos</p>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-700" />
              {units} equipo{units === 1 ? '' : 's'} · {weekLabel}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {branchName || 'Todas las sucursales'} · no incluye abonos ni taller
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-white cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {phones.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No hay celulares vendidos en este recorte.
            </div>
          ) : (
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide text-[10px] sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Folio / Fecha</th>
                  <th className="px-3 py-2.5 font-semibold">Equipo</th>
                  <th className="px-3 py-2.5 font-semibold">Cliente</th>
                  <th className="px-3 py-2.5 font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Precio</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Enganche</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {phones.map((phone) => (
                  <tr key={phone.id} className="hover:bg-amber-50/40">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="block font-mono font-semibold text-slate-900">{phone.folio}</span>
                      <span className="block text-[10px] text-slate-500">{phone.dateLabel}</span>
                      <span className="block text-[10px] text-slate-500">{phone.branchName} · {phone.operatorName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-semibold text-slate-900">{phone.model}</span>
                      {phone.imei ? (
                        <span className="block font-mono text-[10px] text-slate-600">IMEI {phone.imei}</span>
                      ) : (
                        <span className="block text-[10px] text-slate-400">Sin IMEI</span>
                      )}
                      {phone.quantity > 1 && (
                        <span className="block text-[10px] text-amber-800">{phone.quantity} pzas</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-semibold text-slate-900">{phone.clientName}</span>
                      {phone.clientPhone && (
                        <span className="block text-[10px] text-slate-600">{phone.clientPhone}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        phone.saleKind === 'credito'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {phone.saleKind === 'credito' ? phone.financing : 'Contado'}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{phone.paymentMethod}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                      ${formatMoney(phone.fullPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                      ${formatMoney(phone.downPayment)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-indigo-800">
                      {phone.remaining > 0 ? `$${formatMoney(phone.remaining)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const [phoneView, setPhoneView] = useState<{
    weekStart: string;
    weekLabel: string;
    branchId?: string;
    branchName?: string;
  } | null>(null);

  const weeks = useMemo(
    () => buildWeekBlocks(salesTickets, expenses, selectedBranchId),
    [salesTickets, expenses, selectedBranchId]
  );

  const currentWeek = weeks.find((week) => week.isCurrent) || weeks[0];
  const historyWeeks = weeks.filter((week) => !week.isCurrent);

  const phoneModalWeek = phoneView ? weeks.find((week) => week.weekStart === phoneView.weekStart) : null;
  const phoneModalList = (phoneModalWeek?.phones || []).filter((phone) =>
    phoneView?.branchId ? phone.branchId === phoneView.branchId : true
  );

  const openPhones = (week: WeekBlock, branchId?: string, branchName?: string) => {
    setPhoneView({
      weekStart: week.weekStart,
      weekLabel: week.label,
      branchId,
      branchName
    });
  };

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
                <button
                  type="button"
                  disabled={currentWeek.totals.phonesSold === 0}
                  onClick={() => openPhones(currentWeek)}
                  className={`text-right ${currentWeek.totals.phonesSold > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Celulares</p>
                  <p className="text-lg font-bold text-amber-800">{currentWeek.totals.phonesSold}</p>
                </button>
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
            <CategoryStrip
              cats={currentWeek.totals.cats}
              gastos={currentWeek.totals.gastos}
              phonesSold={currentWeek.totals.phonesSold}
              onOpenPhones={() => openPhones(currentWeek)}
            />
            <WeekTable block={currentWeek} onOpenPhones={(id, name) => openPhones(currentWeek, id, name)} />
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
                      <p className="text-xs text-slate-500">
                        {week.totals.phonesSold} celular{week.totals.phonesSold === 1 ? '' : 'es'} · {week.totals.tickets} tickets
                      </p>
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
                  <CategoryStrip
                    cats={week.totals.cats}
                    gastos={week.totals.gastos}
                    phonesSold={week.totals.phonesSold}
                    onOpenPhones={() => openPhones(week)}
                  />
                  {open && <WeekTable block={week} onOpenPhones={(id, name) => openPhones(week, id, name)} />}
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

      {phoneView && (
        <PhoneSalesModal
          weekLabel={phoneView.weekLabel}
          branchName={phoneView.branchName}
          phones={phoneModalList}
          onClose={() => setPhoneView(null)}
        />
      )}
    </div>
  );
}
