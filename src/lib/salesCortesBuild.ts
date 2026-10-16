import type { Branch, CorteXRecord, Expense, Operator, SaleTicket } from '../types';
import { COMMERCIAL_BRANCHES, getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { fillCashDateSpan, parseSafeDate, safeDateIsoKey, safeFormatDate } from './dateUtils';
import { isAfterCashClose, isPrematureAutoCorteRecord } from './shiftHours';
import { money } from './ids';
import { corteExpenseTotals } from './historicSale';
import { branchDateKey, datesFromBranchDateIndex, indexByBranchDate } from './branchDateIndex';
import { emptyDayCorte, foldOnePerBranchPerDay } from './corteDayRoster';

export const RECENT_ZERO_DAYS = 31;
export const CORTES_VISIBLE_DAYS = 31;

type BuildArgs = {
  cortes: CorteXRecord[];
  tickets: SaleTicket[];
  expenses: Expense[];
  todayKey: string;
  currentBranch: Branch;
  currentOperator: Operator;
  openingFund: (branchId: string) => number;
  openCashiersByBranch?: Record<string, string>;
  now?: Date;
};

export function cashierNameFromSession(session?: {
  operador_actual?: { nombre?: string };
  operador_apertura?: { nombre?: string };
} | null): string {
  return String(session?.operador_actual?.nombre || session?.operador_apertura?.nombre || '').trim();
}

export function latestTicketCashier(tickets: SaleTicket[]): string {
  const sorted = tickets
    .slice()
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  return String(sorted[sorted.length - 1]?.operatorName || '').trim();
}

/** Quién está en esa caja ahora: turno abierto, no el login de otra computadora. */
export function liveShiftCashierName(params: {
  branchId: string;
  sessionCashier?: string;
  tickets?: SaleTicket[];
  currentBranchId?: string;
  currentOperatorName?: string;
}): string {
  const fromSession = String(params.sessionCashier || '').trim();
  if (fromSession) return fromSession;
  const fromTickets = latestTicketCashier(params.tickets || []);
  if (fromTickets) return fromTickets;
  if (normalizeBranchId(params.branchId) === normalizeBranchId(params.currentBranchId)) {
    const here = String(params.currentOperatorName || '').trim();
    if (here) return here;
  }
  return 'Turno abierto';
}

function paymentTotals(tickets: SaleTicket[]): { cash: number; card: number; transfer: number; total: number } {
  let cash = 0;
  let card = 0;
  let transfer = 0;
  for (const t of tickets) {
    const amt = t.total || 0;
    if (t.paymentMethod === 'Efectivo') cash += amt;
    else if (t.paymentMethod === 'Tarjeta') card += amt;
    else if (t.paymentMethod === 'Transferencia') transfer += amt;
  }
  return { cash, card, transfer, total: cash + card + transfer };
}

function liveShiftRow(
  branch: Branch,
  dateKey: string,
  tickets: SaleTicket[],
  expenses: Expense[],
  currentBranch: Branch,
  currentOperator: Operator,
  openingFund: (branchId: string) => number,
  sessionCashier?: string
): CorteXRecord {
  const pay = paymentTotals(tickets);
  const expTotals = corteExpenseTotals(expenses);
  const totalExp = expTotals.listed;
  const fund = openingFund(branch.id);
  let shiftLoginTime = '09:00 a.m.';
  try {
    const saved = localStorage.getItem(`erp_shift_login_${branch.id}_${dateKey}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.time) shiftLoginTime = parsed.time;
    }
  } catch {
    /* ignore */
  }
  return {
    id: `CTX-TURNO-${branch.id.replace('b-', '').toUpperCase()}-${dateKey}`,
    timestamp: `${dateKey}T23:00:00-07:00`,
    dateStr: safeFormatDate(parseSafeDate(dateKey)),
    timeStr: `Inicia: ${shiftLoginTime} (Turno en Vivo / Tiempo Real)`,
    branchId: branch.id,
    branchName: branch.name,
    operatorName: liveShiftCashierName({
      branchId: branch.id,
      sessionCashier,
      tickets,
      currentBranchId: currentBranch.id,
      currentOperatorName: currentOperator.name
    }),
    initialCashFund: fund,
    cashSales: pay.cash,
    cardSales: pay.card,
    transferSales: pay.transfer,
    totalSales: pay.total,
    totalExpenses: totalExp,
    netIncome: pay.total - totalExp,
    expectedCashInDrawer: fund + pay.cash - expTotals.cashOut,
    ticketIds: tickets.map((t) => t.id),
    expenseIds: expenses.map((e) => e.id),
    breakdown: {
      accesoriosTotal: pay.total,
      accesoriosCount: tickets.length,
      abonosTotal: 0,
      abonosCount: 0,
      enganchesTotal: 0,
      enganchesCount: 0,
      reparacionesTotal: 0,
      reparacionesCount: 0,
      recargasTotal: 0,
      recargasCount: 0
    }
  };
}

function reconciledRow(branch: Branch, dateKey: string, tickets: SaleTicket[], expenses: Expense[]): CorteXRecord {
  const pay = paymentTotals(tickets);
  const expTotals = corteExpenseTotals(expenses);
  const totalExp = expTotals.listed;
  return {
    id: `CTX_${branch.id}_${dateKey}`,
    timestamp: `${dateKey}T23:00:00-07:00`,
    dateStr: safeFormatDate(parseSafeDate(dateKey)),
    timeStr: 'Cierre Oficial de Turno',
    branchId: branch.id,
    branchName: branch.name,
    operatorName: tickets[0]?.operatorName || 'Cajero en Turno',
    initialCashFund: 0,
    cashSales: pay.cash,
    cardSales: pay.card,
    transferSales: pay.transfer,
    totalSales: pay.total,
    totalExpenses: totalExp,
    netIncome: pay.total - totalExp,
    expectedCashInDrawer: pay.cash - expTotals.cashOut,
    ticketIds: tickets.map((t) => t.id),
    expenseIds: expenses.map((e) => e.id),
    breakdown: {
      accesoriosTotal: pay.total,
      accesoriosCount: tickets.length,
      abonosTotal: 0,
      abonosCount: 0,
      enganchesTotal: 0,
      enganchesCount: 0,
      reparacionesTotal: 0,
      reparacionesCount: 0,
      recargasTotal: 0,
      recargasCount: 0
    }
  };
}

/** Arma el roster: 1 pasada por tickets/gastos, 3 sucursales por día. */
export function buildCortesRoster(args: BuildArgs): CorteXRecord[] {
  const {
    cortes,
    tickets,
    expenses,
    todayKey,
    currentBranch,
    currentOperator,
    openingFund,
    openCashiersByBranch = {},
    now
  } = args;
  const clockNow = now || new Date();
  const todayStillOpen = !isAfterCashClose(clockNow);
  const savedGrouped: Record<string, CorteXRecord> = {};
  const suppressed = new Set<string>();
  const corteIds = new Set<string>();

  for (const corte of cortes || []) {
    if (!corte) continue;
    corteIds.add(corte.id);
    const normBId = normalizeBranchId(corte.branchId);
    if (!hasCashTill(normBId)) continue;
    const dateKey = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
    if (!dateKey) continue;
    if (isPrematureAutoCorteRecord(corte, clockNow)) {
      suppressed.add(corte.id);
      if (corte.sesion_caja_id) suppressed.add(corte.sesion_caja_id);
      continue;
    }
    // Un cierre a media mañana no debe tapar el turno que sigue abierto el mismo día.
    if (dateKey === todayKey && todayStillOpen) {
      suppressed.add(corte.id);
      if (corte.sesion_caja_id) suppressed.add(corte.sesion_caja_id);
      continue;
    }
    const groupKey = branchDateKey(normBId, dateKey);
    const normalized: CorteXRecord = {
      ...corte,
      branchId: normBId,
      branchName: getBranchDisplayName(normBId),
      dateStr: safeFormatDate(parseSafeDate(dateKey))
    };
    const prev = savedGrouped[groupKey];
    if (!prev || (normalized.timestamp || '') > (prev.timestamp || '')) {
      savedGrouped[groupKey] = normalized;
    }
  }

  const ticketIndex = indexByBranchDate(tickets, (t) => t.branchId, (t) => t.timestamp);
  const expenseIndex = indexByBranchDate(expenses, (e) => e.branchId, (e) => e.timestamp || e.date);

  for (const [key, list] of ticketIndex) {
    const orphanGroups = new Map<string, SaleTicket[]>();
    for (const t of list) {
      if (!t.corteXId || corteIds.has(t.corteXId) || suppressed.has(t.corteXId)) continue;
      const pack = orphanGroups.get(t.corteXId) || [];
      pack.push(t);
      orphanGroups.set(t.corteXId, pack);
    }
    for (const [corteId, pack] of orphanGroups) {
      const dateKey = key.slice(key.lastIndexOf('::') + 2);
      if (dateKey === todayKey && todayStillOpen) {
        suppressed.add(corteId);
        continue;
      }
      if (savedGrouped[key]) continue;
      const branchId = normalizeBranchId(pack[0]?.branchId);
      const exp = expenseIndex.get(key) || [];
      const relatedExp = exp.filter((e) => e.corteXId === corteId);
      const pay = paymentTotals(pack);
      const expTotals = corteExpenseTotals(relatedExp);
      const totalExp = expTotals.listed;
      savedGrouped[key] = {
        id: corteId,
        timestamp: pack[pack.length - 1]?.timestamp || `${dateKey}T23:00:00-07:00`,
        dateStr: safeFormatDate(parseSafeDate(dateKey)),
        timeStr: 'Corte Recuperado',
        branchId,
        branchName: getBranchDisplayName(branchId),
        operatorName: pack[0]?.operatorName || 'Cajero',
        initialCashFund: 0,
        cashSales: pay.cash,
        cardSales: pay.card,
        transferSales: pay.transfer,
        totalSales: pay.total,
        totalExpenses: totalExp,
        netIncome: pay.total - totalExp,
        expectedCashInDrawer: pay.cash - expTotals.cashOut,
        ticketIds: pack.map((t) => t.id),
        expenseIds: relatedExp.map((e) => e.id),
        breakdown: {
          accesoriosTotal: pay.total,
          accesoriosCount: pack.length,
          abonosTotal: 0,
          abonosCount: 0,
          enganchesTotal: 0,
          enganchesCount: 0,
          reparacionesTotal: 0,
          reparacionesCount: 0,
          recargasTotal: 0,
          recargasCount: 0
        }
      };
    }
  }

  const evidence = new Set<string>([todayKey]);
  for (const corte of Object.values(savedGrouped)) {
    const key = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
    if (key) evidence.add(key);
  }
  for (const key of datesFromBranchDateIndex(ticketIndex)) evidence.add(key);
  for (const key of datesFromBranchDateIndex(expenseIndex)) evidence.add(key);
  const dateKeys = fillCashDateSpan(evidence, todayKey, RECENT_ZERO_DAYS);

  const extras: CorteXRecord[] = [];
  for (const dateKey of dateKeys) {
    for (const branch of COMMERCIAL_BRANCHES) {
      const groupKey = branchDateKey(branch.id, dateKey);
      if (savedGrouped[groupKey]) continue;

      const dayTickets = ticketIndex.get(groupKey) || [];
      const dayExpenses = expenseIndex.get(groupKey) || [];

      if (dateKey === todayKey) {
        const openTickets = dayTickets.filter((t) => !t.corteXId || suppressed.has(t.corteXId));
        const openExpenses = dayExpenses.filter((e) => !e.corteXId || suppressed.has(e.corteXId));
        extras.push(
          liveShiftRow(
            branch,
            dateKey,
            openTickets.length > 0 ? openTickets : dayTickets,
            openExpenses.length > 0 ? openExpenses : dayExpenses,
            currentBranch,
            currentOperator,
            openingFund,
            openCashiersByBranch[normalizeBranchId(branch.id)]
          )
        );
        continue;
      }

      if (dayTickets.length > 0 || dayExpenses.length > 0) {
        extras.push(reconciledRow(branch, dateKey, dayTickets, dayExpenses));
      } else {
        extras.push(emptyDayCorte(dateKey, branch.id));
      }
    }
  }

  return foldOnePerBranchPerDay([...Object.values(savedGrouped), ...extras]);
}

export function todayBranchStats(
  tickets: SaleTicket[],
  expenses: Expense[],
  todayKey: string,
  openingFund: (branchId: string) => number,
  openCashiersByBranch: Record<string, string> = {},
  currentBranchId?: string,
  currentOperatorName?: string
) {
  const ticketIndex = indexByBranchDate(tickets, (t) => t.branchId, (t) => t.timestamp);
  const expenseIndex = indexByBranchDate(expenses, (e) => e.branchId, (e) => e.timestamp || e.date);
  return COMMERCIAL_BRANCHES.map((branch) => {
    const key = branchDateKey(branch.id, todayKey);
    const todayTickets = ticketIndex.get(key) || [];
    const todayExpenses = expenseIndex.get(key) || [];
    const pay = paymentTotals(todayTickets);
    const totalExpenses = corteExpenseTotals(todayExpenses).listed;
    const openTickets = todayTickets.filter((t) => !t.corteXId);
    const openExpenses = todayExpenses.filter((e) => !e.corteXId);
    let openCash = 0;
    for (const t of openTickets) {
      if (t.paymentMethod === 'Efectivo') openCash += t.total || 0;
    }
    const openExp = corteExpenseTotals(openExpenses).cashOut;
    const fund = openingFund(branch.id);
    return {
      branchId: branch.id,
      branchName: branch.name,
      hasActivityToday: todayTickets.length > 0 || todayExpenses.length > 0,
      todayTicketsCount: todayTickets.length,
      openTicketsCount: openTickets.length,
      todayExpensesCount: todayExpenses.length,
      totalSales: money(pay.total),
      cashSales: money(pay.cash),
      cardSales: money(pay.card),
      transferSales: money(pay.transfer),
      totalExpenses: money(totalExpenses),
      initialCashFund: fund,
      expectedCashInDrawer: money(fund + openCash - openExp),
      currentShiftOperator: liveShiftCashierName({
        branchId: branch.id,
        sessionCashier: openCashiersByBranch[normalizeBranchId(branch.id)],
        tickets: openTickets.length > 0 ? openTickets : todayTickets,
        currentBranchId,
        currentOperatorName
      }),
      hasOpenShift: openTickets.length > 0 || openExpenses.length > 0 || todayTickets.length > 0 || todayExpenses.length > 0
    };
  });
}
