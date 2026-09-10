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
    return 'Elige Navojoa o Huatabampo. Administración y Bodega no tienen corte de caja.';
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

export function rebuildCorteTotals(
  corte: CorteXRecord,
  tickets: SaleTicket[],
  expenses: Expense[]
): CorteXRecord {
  const totals = summarizeTickets(tickets);
  const totalExpenses = money(expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));
  const expected = money(Number(corte.initialCashFund || 0) + totals.cashSales - totalExpenses);
  const counted = corte.countedCash;
  return {
    ...corte,
    cashSales: totals.cashSales,
    cardSales: totals.cardSales,
    transferSales: totals.transferSales,
    totalSales: totals.totalSales,
    totalExpenses,
    netIncome: money(totals.totalSales - totalExpenses),
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

export function removeTicketFromCorte(corte: CorteXRecord, ticketId: string): CorteXRecord {
  const tickets = (corte.ticketsSnapshot || []).filter((row) => row.id !== ticketId);
  const ids = (corte.ticketIds || []).filter((id) => id !== ticketId);
  const expenses = [...(corte.expensesSnapshot || [])];
  const next = rebuildCorteTotals(corte, tickets, expenses);
  next.ticketIds = ids.length ? ids : next.ticketIds;
  return next;
}

export const HISTORIC_TILL_BRANCHES = COMMERCIAL_BRANCHES;
