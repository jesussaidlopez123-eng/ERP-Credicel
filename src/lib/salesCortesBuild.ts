import type { Branch, CorteXRecord, Expense, Operator, SaleTicket } from '../types';
import { COMMERCIAL_BRANCHES, getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { addCashDays, parseSafeDate, safeDateIsoKey, safeFormatDate } from './dateUtils';
import { isAfterCashClose, isPrematureAutoCorteRecord } from './shiftHours';
import { money } from './ids';
import { branchDateKey, datesFromBranchDateIndex, indexByBranchDate } from './branchDateIndex';
import { emptyDayCorte, foldOnePerBranchPerDay } from './corteDayRoster';

export const RECENT_ZERO_DAYS = 14;
export const CORTES_VISIBLE_DAYS = 21;

type BuildArgs = {
  cortes: CorteXRecord[];
  tickets: SaleTicket[];
  expenses: Expense[];
  todayKey: string;
  currentBranch: Branch;
  currentOperator: Operator;
  openingFund: (branchId: string) => number;
};

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
  openingFund: (branchId: string) => number
): CorteXRecord {
  const pay = paymentTotals(tickets);
  const totalExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const fund = openingFund(branch.id);
  let shiftLoginTime = '09:00 a.m.';
  let loggedOperatorName = '';
  try {
    const saved = localStorage.getItem(`erp_shift_login_${branch.id}_${dateKey}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.time) shiftLoginTime = parsed.time;
      if (parsed?.operatorName) loggedOperatorName = parsed.operatorName;
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
    operatorName:
      loggedOperatorName || tickets[0]?.operatorName || (branch.id === currentBranch.id ? currentOperator.name : 'Turno Activo (Hoy)'),
    initialCashFund: fund,
    cashSales: pay.cash,
    cardSales: pay.card,
    transferSales: pay.transfer,
    totalSales: pay.total,
    totalExpenses: totalExp,
    netIncome: pay.total - totalExp,
    expectedCashInDrawer: fund + pay.cash - totalExp,
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
  const totalExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
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
    expectedCashInDrawer: pay.cash - totalExp,
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
  const { cortes, tickets, expenses, todayKey, currentBranch, currentOperator, openingFund } = args;
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
    if (isPrematureAutoCorteRecord(corte)) {
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
      if (dateKey === todayKey && !isAfterCashClose()) {
        suppressed.add(corteId);
        continue;
      }
      if (savedGrouped[key]) continue;
      const branchId = normalizeBranchId(pack[0]?.branchId);
      const exp = expenseIndex.get(key) || [];
      const relatedExp = exp.filter((e) => e.corteXId === corteId);
      const pay = paymentTotals(pack);
      const totalExp = relatedExp.reduce((sum, e) => sum + (e.amount || 0), 0);
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
        expectedCashInDrawer: pay.cash - totalExp,
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

  const dateKeys = new Set<string>([todayKey]);
  for (let d = 1; d <= RECENT_ZERO_DAYS; d++) {
    dateKeys.add(addCashDays(todayKey, -d));
  }
  for (const corte of Object.values(savedGrouped)) {
    const key = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
    if (key) dateKeys.add(key);
  }
  for (const key of datesFromBranchDateIndex(ticketIndex)) dateKeys.add(key);
  for (const key of datesFromBranchDateIndex(expenseIndex)) dateKeys.add(key);

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
            openingFund
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
  openingFund: (branchId: string) => number
) {
  const ticketIndex = indexByBranchDate(tickets, (t) => t.branchId, (t) => t.timestamp);
  const expenseIndex = indexByBranchDate(expenses, (e) => e.branchId, (e) => e.timestamp || e.date);
  return COMMERCIAL_BRANCHES.map((branch) => {
    const key = branchDateKey(branch.id, todayKey);
    const todayTickets = ticketIndex.get(key) || [];
    const todayExpenses = expenseIndex.get(key) || [];
    const pay = paymentTotals(todayTickets);
    const totalExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const openTickets = todayTickets.filter((t) => !t.corteXId);
    const openExpenses = todayExpenses.filter((e) => !e.corteXId);
    let openCash = 0;
    for (const t of openTickets) {
      if (t.paymentMethod === 'Efectivo') openCash += t.total || 0;
    }
    const openExp = openExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
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
      currentShiftOperator: todayTickets[todayTickets.length - 1]?.operatorName || 'Operador en Turno',
      hasOpenShift: openTickets.length > 0 || openExpenses.length > 0 || todayTickets.length > 0 || todayExpenses.length > 0
    };
  });
}
