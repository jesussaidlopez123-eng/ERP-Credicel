import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Megaphone,
  ShieldCheck,
  Smartphone,
  Store,
  Wallet,
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
  /** Cobrado en caja (incluye dinero de paso). */
  ventas: number;
  /** Resultado: accesorios + reparaciones + comisiones − gastos. */
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
      phones
    };
  });
}

function peso(n: number): string {
  return money(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function branchAccent(branchId: string): string {
  if (branchId === 'b-huatabampo') return 'border-l-teal-600';
  if (branchId === 'b-navojoa') return 'border-l-[#0047AB]';
  return 'border-l-slate-400';
}

function LedgerLine({
  label,
  hint,
  amount,
  tone = 'ink'
}: {
  label: string;
  hint?: string;
  amount: number;
  tone?: 'ink' | 'plus' | 'minus' | 'muted' | 'result';
}) {
  const amountClass =
    tone === 'plus'
      ? 'text-emerald-800'
      : tone === 'minus'
        ? 'text-rose-700'
        : tone === 'muted'
          ? 'text-slate-400'
          : tone === 'result'
            ? 'text-slate-950'
            : 'text-slate-800';
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className={`text-sm ${tone === 'muted' ? 'text-slate-500' : 'text-slate-800'}`}>{label}</p>
        {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
      </div>
      <p className={`shrink-0 font-mono text-sm tabular-nums ${amountClass} ${tone === 'result' ? 'font-bold text-base' : 'font-semibold'}`}>
        {tone === 'minus' && amount ? '−' : ''}
        ${peso(Math.abs(amount))}
      </p>
    </div>
  );
}

function CashSplitBar({ ours, pass, theme = 'light' }: { ours: number; pass: number; theme?: 'light' | 'dark' }) {
  const total = ours + pass;
  if (total <= 0) return null;
  const oursPct = Math.max(6, Math.min(94, (ours / total) * 100));
  const dark = theme === 'dark';
  return (
    <div className="space-y-1.5">
      <div className={`flex h-2.5 overflow-hidden rounded-full ${dark ? 'bg-white/15' : 'bg-slate-200'}`}>
        <div className={dark ? 'bg-blue-300' : 'bg-[#0047AB]'} style={{ width: `${oursPct}%` }} />
        <div className={dark ? 'bg-white/35' : 'bg-slate-300'} style={{ width: `${100 - oursPct}%` }} />
      </div>
      <div className="flex justify-between gap-3 text-[11px]">
        <span className={dark ? 'text-slate-200' : 'text-slate-700'}>
          Lo nuestro <span className="font-mono font-semibold">${peso(ours)}</span>
        </span>
        <span className={dark ? 'text-slate-400' : 'text-slate-400'}>
          De paso <span className="font-mono font-semibold">${peso(pass)}</span>
        </span>
      </div>
    </div>
  );
}

function OursPanel({
  row,
  onOpenPhones
}: {
  row: BranchWeekRow;
  onOpenPhones: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
          <Wallet className="w-4 h-4" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Lo nuestro</p>
          <p className="text-xs text-slate-500">Sí entra al resultado</p>
        </div>
      </div>
      <LedgerLine label="Accesorios" hint={`${row.cats.countAccesorios} operaciones`} amount={row.cats.accesorios} tone="plus" />
      <LedgerLine
        label="Reparaciones"
        hint={`${row.cats.countReparaciones} operaciones`}
        amount={row.cats.reparaciones}
        tone="plus"
      />
      <button type="button" onClick={onOpenPhones} className="w-full text-left cursor-pointer">
        <LedgerLine
          label="Comisiones"
          hint={`${row.phonesSold} celular${row.phonesSold === 1 ? '' : 'es'} · Navojoa $1,000 · Huatabampo $350`}
          amount={row.finance.comisiones}
          tone="plus"
        />
      </button>
      <div className="border-t border-dashed border-slate-200 my-1" />
      <LedgerLine label="Gastos de sucursal" hint="Salidas de caja" amount={row.finance.gastos} tone="minus" />
      <div className="mt-2 rounded-xl bg-slate-950 px-3 py-2.5 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Resultado</p>
        <p className={`font-mono text-lg font-bold tabular-nums ${row.utilidad >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          ${peso(row.utilidad)}
        </p>
      </div>
    </section>
  );
}

function PassPanel({
  row,
  onOpenPhones
}: {
  row: BranchWeekRow;
  onOpenPhones: () => void;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 border border-slate-200">
          <ArrowLeftRight className="w-4 h-4" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dinero de paso</p>
          <p className="text-xs text-slate-400">Se regresa a otras compañías · no es utilidad</p>
        </div>
      </div>
      <button
        type="button"
        onClick={row.phonesSold > 0 ? onOpenPhones : undefined}
        className={`w-full text-left ${row.phonesSold > 0 ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <LedgerLine
          label="Equipos cobrados"
          hint={`${row.phonesSold} celular${row.phonesSold === 1 ? '' : 'es'}${row.phonesSold > 0 ? ' · ver cuáles' : ''}`}
          amount={row.cats.equipos}
          tone="muted"
        />
      </button>
      <LedgerLine label="Abonos" hint={`${row.cats.countAbonos} operaciones`} amount={row.cats.abonos} tone="muted" />
      <LedgerLine label="Recargas" hint={`${row.cats.countRecargas} operaciones`} amount={row.cats.recargas} tone="muted" />
      <div className="border-t border-dashed border-slate-200 mt-1 pt-2 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total que solo pasa</p>
        <p className="font-mono text-sm font-semibold text-slate-500 tabular-nums">${peso(row.finance.dineroPaso)}</p>
      </div>
    </section>
  );
}

function BranchCard({
  row,
  onOpenPhones
}: {
  row: BranchWeekRow;
  onOpenPhones: () => void;
}) {
  const rate = phoneCommissionRate(row.branchId);
  const idle = row.tickets === 0 && row.gastos === 0 && row.phonesSold === 0 && row.ventas === 0;

  return (
    <article className={`rounded-2xl border border-slate-200 bg-white border-l-4 ${branchAccent(row.branchId)} overflow-hidden`}>
      <header className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-slate-500" />
            {row.branchName}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {row.tickets} ticket{row.tickets === 1 ? '' : 's'}
            {rate > 0 ? ` · comisión $${peso(rate)} / celular` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Resultado</p>
          <p className={`font-mono text-xl font-bold tabular-nums ${row.utilidad >= 0 ? 'text-slate-950' : 'text-rose-700'}`}>
            ${peso(row.utilidad)}
          </p>
        </div>
      </header>

      {idle ? (
        <p className="px-4 pb-4 text-sm text-slate-400">Sin movimiento en esta semana.</p>
      ) : (
        <div className="px-4 pb-4 space-y-3">
          <button
            type="button"
            disabled={row.phonesSold === 0}
            onClick={onOpenPhones}
            className={`flex items-center justify-between w-full rounded-xl bg-slate-50 px-3 py-2 text-left ${
              row.phonesSold > 0 ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <Smartphone className="w-4 h-4 text-slate-500" />
              {row.phonesSold} celular{row.phonesSold === 1 ? '' : 'es'}
            </span>
            <span className="font-mono text-xs font-semibold text-emerald-800">
              Comisión ${peso(row.finance.comisiones)}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-x-4 text-xs">
            <LedgerLine label="Accesorios" amount={row.cats.accesorios} tone="plus" />
            <LedgerLine label="Reparaciones" amount={row.cats.reparaciones} tone="plus" />
            <LedgerLine label="Gastos" amount={row.gastos} tone="minus" />
            <LedgerLine label="De paso" amount={row.finance.dineroPaso} tone="muted" />
          </div>
        </div>
      )}
    </article>
  );
}

function WeekStatement({
  block,
  subtitle,
  onOpenPhones,
  showHero = true
}: {
  block: WeekBlock;
  subtitle: string;
  onOpenPhones: (branchId?: string, branchName?: string) => void;
  showHero?: boolean;
}) {
  const ours = money(block.totals.finance.ingresosPropios + block.totals.finance.comisiones);
  const hasRows = block.branches.some(
    (row) => row.tickets > 0 || row.gastos > 0 || row.ventas > 0 || row.phonesSold > 0
  );

  return (
    <div className="space-y-4">
      {showHero && (
      <div className="rounded-3xl bg-slate-950 text-white overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
              {block.isCurrent ? 'Semana en curso' : 'Semana'}
            </p>
            <h2 className="text-2xl font-semibold mt-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              {block.label}
            </h2>
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          </div>
          <div className="lg:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Resultado de Credicel</p>
            <p className={`font-mono text-4xl sm:text-5xl font-bold tabular-nums leading-none mt-1 ${
              block.totals.utilidad >= 0 ? 'text-white' : 'text-rose-300'
            }`}>
              ${peso(block.totals.utilidad)}
            </p>
          </div>
        </div>
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-300 font-mono">
            <span>${peso(block.totals.cats.accesorios)} accesorios</span>
            <span className="text-slate-500">+</span>
            <span>${peso(block.totals.cats.reparaciones)} reparaciones</span>
            <span className="text-slate-500">+</span>
            <span>${peso(block.totals.finance.comisiones)} comisiones</span>
            <span className="text-slate-500">−</span>
            <span>${peso(block.totals.finance.gastos)} gastos</span>
          </div>
          <div className="mt-4">
            <CashSplitBar ours={ours} pass={block.totals.finance.dineroPaso} theme="dark" />
          </div>
        </div>
      </div>
      )}

      {!showHero && (
        <CashSplitBar ours={ours} pass={block.totals.finance.dineroPaso} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OursPanel row={block.totals} onOpenPhones={() => onOpenPhones()} />
        <PassPanel row={block.totals} onOpenPhones={() => onOpenPhones()} />
      </div>

      {hasRows ? (
        <div className={`grid gap-4 ${block.branches.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {block.branches.map((row) => (
            <BranchCard
              key={row.branchId}
              row={row}
              onOpenPhones={() => onOpenPhones(row.branchId, row.branchName)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Sin movimientos en esta semana{block.isCurrent ? ' todavía' : ''}.
        </div>
      )}
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
  const commissions = phones.reduce((sum, phone) => sum + phone.commission, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-950 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">Celulares vendidos</p>
            <h3 className="text-base font-semibold mt-1 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-300" />
              {units} equipo{units === 1 ? '' : 's'} · {weekLabel}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {branchName || 'Todas las sucursales'} · el cobro del equipo es dinero de paso
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Comisión de este recorte</p>
              <p className="font-mono text-xl font-bold text-emerald-300">${peso(commissions)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:bg-white/10 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 sm:bg-white">
          {phones.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No hay celulares vendidos en este recorte.
            </div>
          ) : (
            <>
              <div className="sm:hidden divide-y divide-slate-200 p-3 space-y-3">
                {phones.map((phone) => (
                  <article key={phone.id} className="rounded-2xl bg-white border border-slate-200 p-3">
                    <div className="flex justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-slate-900">{phone.folio}</p>
                      <p className="font-mono text-sm font-bold text-emerald-800">${peso(phone.commission)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{phone.model}</p>
                    <p className="text-[11px] text-slate-500">
                      {phone.dateLabel} · {phone.branchName}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {phone.clientName}
                      {phone.imei ? ` · IMEI ${phone.imei}` : ''}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                      <div>Precio* <span className="block font-mono text-slate-600">${peso(phone.fullPrice)}</span></div>
                      <div>Enganche* <span className="block font-mono text-slate-600">${peso(phone.downPayment)}</span></div>
                      <div>Saldo* <span className="block font-mono text-slate-600">{phone.remaining ? `$${peso(phone.remaining)}` : '—'}</span></div>
                    </div>
                  </article>
                ))}
              </div>

              <table className="hidden sm:table w-full text-left text-xs min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Folio / Fecha</th>
                    <th className="px-3 py-2.5 font-semibold">Equipo</th>
                    <th className="px-3 py-2.5 font-semibold">Cliente</th>
                    <th className="px-3 py-2.5 font-semibold">Tipo</th>
                    <th className="px-3 py-2.5 font-semibold text-right text-slate-400">Precio*</th>
                    <th className="px-3 py-2.5 font-semibold text-right text-slate-400">Enganche*</th>
                    <th className="px-3 py-2.5 font-semibold text-right text-slate-400">Saldo*</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {phones.map((phone) => (
                    <tr key={phone.id} className="hover:bg-slate-50">
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
                          <span className="block text-[10px] text-slate-500">{phone.quantity} pzas</span>
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
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">${peso(phone.fullPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">${peso(phone.downPayment)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                        {phone.remaining > 0 ? `$${peso(phone.remaining)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-800">
                        ${peso(phone.commission)}
                        <span className="block text-[10px] font-medium text-slate-400">
                          ${peso(phoneCommissionRate(phone.branchId))} / pza
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-[10px] text-slate-500 bg-slate-50 border-t border-slate-100">
                *Precio, enganche y saldo son dinero de paso. Solo la comisión (Navojoa $1,000 / Huatabampo $350 por celular) entra al resultado.
              </p>
            </>
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
            Estado de resultados
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            El recuadro oscuro es lo que gana Credicel. A la derecha, el dinero que solo transita.
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

      {currentWeek && (
        <WeekStatement
          block={currentWeek}
          subtitle={filterLabel}
          onOpenPhones={(id, name) => openPhones(currentWeek, id, name)}
        />
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Semanas anteriores</h2>
          <p className="text-sm text-slate-500">Una línea por semana. Ábrela para ver Navojoa y Huatabampo.</p>
        </div>

        {historyWeeks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Aún no hay semanas anteriores en lo que está cargado.
          </div>
        ) : (
          historyWeeks.map((week) => {
            const open = openHistory[week.weekStart] ?? false;
            return (
              <article key={week.weekStart} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setOpenHistory((prev) => ({ ...prev, [week.weekStart]: !open }))
                  }
                  className="w-full px-4 sm:px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 cursor-pointer"
                >
                  {open ? (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{week.label}</p>
                    <p className="text-xs text-slate-500">
                      {week.totals.phonesSold} celular{week.totals.phonesSold === 1 ? '' : 'es'} · {week.totals.tickets} tickets
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono text-base font-bold tabular-nums ${week.totals.utilidad >= 0 ? 'text-slate-950' : 'text-rose-700'}`}>
                      ${peso(week.totals.utilidad)}
                    </p>
                    <p className="text-[10px] text-slate-400">paso ${peso(week.totals.finance.dineroPaso)}</p>
                  </div>
                </button>
                {open && (
                  <div className="px-4 sm:px-5 pb-5 border-t border-slate-100 pt-4">
                    <WeekStatement
                      block={week}
                      subtitle={filterLabel}
                      showHero={false}
                      onOpenPhones={(id, name) => openPhones(week, id, name)}
                    />
                  </div>
                )}
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
