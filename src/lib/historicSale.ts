import { CorteXRecord, Expense, SaleTicket } from '../types';
import { COMMERCIAL_BRANCHES, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { money } from './ids';
import { getHermosilloClock, hermosilloDateKey, isActiveCorteRecord } from './shiftHours';
import { summarizeTickets } from './saleClassification';

export type HistoricSaleTarget = {
  branchId: string;
  dateKey: string;
};

export function isCommercialTillBranch(branchId?: string): boolean {
  return hasCashTill(branchId);
}

/** Timestamp del día de caja (Sonora), antes de las 11:00 p.m. Si es hoy y la caja sigue abierta, usa ahora. */
export function buildHistoricSaleTimestamp(dateKey: string, now: Date = new Date()): string {
  const key = String(dateKey || '').slice(0, 10);
  const today = getHermosilloClock(now).dateKey;
  if (key && key === today && getHermosilloClock(now).hour < 23) {
    return now.toISOString();
  }
  return `${key}T21:00:00-07:00`;
}

export function validateHistoricSaleTarget(
  target: Partial<HistoricSaleTarget>,
  now: Date = new Date()
): string | null {
  const branchId = normalizeBranchId(target.branchId);
  if (!isCommercialTillBranch(branchId)) {
    return 'Elige Matriz, Navojoa o Huatabampo. Administración no tiene corte de caja.';
  }
  const dateKey = String(target.dateKey || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return 'Elige la fecha en que se cobró la venta.';
  }
  const today = getHermosilloClock(now).dateKey;
  if (dateKey > today) {
    return 'No se puede registrar una venta en una fecha futura.';
  }
  return null;
}

export function findClosedCorteForDay(
  cortes: CorteXRecord[] | undefined,
  branchId: string,
  dateKey: string
): CorteXRecord | null {
  const norm = normalizeBranchId(branchId);
  const key = String(dateKey || '').slice(0, 10);
  const matches = (cortes || []).filter((corte) => {
    if (!corte || !isActiveCorteRecord(corte)) return false;
    if (normalizeBranchId(corte.branchId || corte.sucursal_id) !== norm) return false;
    const corteDay =
      hermosilloDateKey(corte.timestamp) ||
      hermosilloDateKey(corte.dateStr) ||
      String(corte.dateStr || '').slice(0, 10);
    return corteDay === key;
  });
  matches.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  return matches[0] || null;
}

/** Gasto de caja que sí salió del cajón. La refacción de taller no. */
export function expenseCountsAsCashOut(expense: Expense | null | undefined): boolean {
  if (!expense) return false;
  if (expense.countsAsCashOut === false) return false;
  if (expense.kind === 'refaccion_taller') return false;
  return true;
}

export function corteExpenseTotals(expenses: Expense[] | undefined): { listed: number; cashOut: number } {
  let listed = 0;
  let cashOut = 0;
  for (const exp of expenses || []) {
    const amount = money(Number(exp.amount) || 0);
    listed += amount;
    if (expenseCountsAsCashOut(exp)) cashOut += amount;
  }
  return { listed: money(listed), cashOut: money(cashOut) };
}

export function rebuildCorteTotals(
  corte: CorteXRecord,
  tickets: SaleTicket[],
  expenses: Expense[]
): CorteXRecord {
  const totals = summarizeTickets(tickets);
  const expTotals = corteExpenseTotals(expenses);
  const expected = money(Number(corte.initialCashFund || 0) + totals.cashSales - expTotals.cashOut);
  const counted = corte.countedCash;
  return {
    ...corte,
    cashSales: totals.cashSales,
    cardSales: totals.cardSales,
    transferSales: totals.transferSales,
    totalSales: totals.totalSales,
    totalExpenses: expTotals.listed,
    netIncome: money(totals.totalSales - expTotals.listed),
    expectedCashInDrawer: expected,
    cashDifference:
      counted == null ? corte.cashDifference : money(Number(counted) - expected),
    ticketIds: tickets.map((ticket) => ticket.id),
    expenseIds: expenses.map((exp) => exp.id),
    ticketsSnapshot: tickets,
    expensesSnapshot: expenses,
    breakdown: totals.breakdown
  };
}

export function applyTicketToCorte(corte: CorteXRecord, ticket: SaleTicket): CorteXRecord {
  const tickets = [...(corte.ticketsSnapshot || [])].filter((row) => row.id !== ticket.id);
  tickets.push(ticket);
  const expenses = [...(corte.expensesSnapshot || [])];
  return rebuildCorteTotals(corte, tickets, expenses);
}

export function applyExpenseToCorte(corte: CorteXRecord, expense: Expense): CorteXRecord {
  const expenses = [...(corte.expensesSnapshot || [])].filter((row) => row.id !== expense.id);
  expenses.push(expense);
  const tickets = [...(corte.ticketsSnapshot || [])];
  return rebuildCorteTotals(corte, tickets, expenses);
}

export function removeTicketFromCorte(corte: CorteXRecord, ticketId: string): CorteXRecord {
  const tickets = (corte.ticketsSnapshot || []).filter((row) => row.id !== ticketId);
  const ids = (corte.ticketIds || []).filter((id) => id !== ticketId);
  const expenses = [...(corte.expensesSnapshot || [])];
  const next = rebuildCorteTotals(corte, tickets, expenses);
  next.ticketIds = ids.length ? ids : next.ticketIds;
  return next;
}

/** Ticket o gasto que todavía no quedó sellado en un corte cerrado. */
export function isOpenShiftMovement(row: { corteXId?: string; corteXClosedAt?: string }): boolean {
  return !String(row.corteXId || '').trim() && !String(row.corteXClosedAt || '').trim();
}

export function removeExpenseFromCorte(corte: CorteXRecord, expenseId: string): CorteXRecord {
  const expenses = (corte.expensesSnapshot || []).filter((row) => row.id !== expenseId);
  const ids = (corte.expenseIds || []).filter((id) => id !== expenseId);
  const tickets = [...(corte.ticketsSnapshot || [])];
  const next = rebuildCorteTotals(corte, tickets, expenses);
  next.expenseIds = ids.length ? ids : next.expenseIds;
  return next;
}

export const HISTORIC_TILL_BRANCHES = COMMERCIAL_BRANCHES;
