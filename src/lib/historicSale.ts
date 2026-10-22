import { CorteXRecord, Expense, SaleTicket } from '../types';
import { COMMERCIAL_BRANCHES, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { money } from './ids';
import { getHermosilloClock, hermosilloDateKey, isActiveCorteRecord } from './shiftHours';
import { isPhoneUnitSale, summarizeTickets } from './saleClassification';

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

/** Compra de pieza de taller: no es gasto de caja ni renglón del Corte X. */
export function expenseAppearsOnCorteX(expense: Expense | null | undefined): boolean {
  if (!expense) return false;
  if (expense.countsAsCashOut === false) return false;
  if (expense.kind === 'refaccion_taller') return false;
  return true;
}

/** Gasto de caja que sí salió del cajón. La refacción de taller no. */
export function expenseCountsAsCashOut(expense: Expense | null | undefined): boolean {
  return expenseAppearsOnCorteX(expense);
}

export function corteXExpenses(expenses: Expense[] | undefined): Expense[] {
  return (expenses || []).filter(expenseAppearsOnCorteX);
}

export function corteExpenseTotals(expenses: Expense[] | undefined): { listed: number; cashOut: number } {
  let listed = 0;
  let cashOut = 0;
  for (const exp of corteXExpenses(expenses)) {
    const amount = money(Number(exp.amount) || 0);
    listed += amount;
    cashOut += amount;
  }
  return { listed: money(listed), cashOut: money(cashOut) };
}

export function rebuildCorteTotals(
  corte: CorteXRecord,
  tickets: SaleTicket[],
  expenses: Expense[]
): CorteXRecord {
  const totals = summarizeTickets(tickets);
  const corteExpenses = corteXExpenses(expenses);
  const expTotals = corteExpenseTotals(corteExpenses);
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
    expenseIds: corteExpenses.map((exp) => exp.id),
    ticketsSnapshot: tickets,
    expensesSnapshot: corteExpenses,
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

function corteDayKey(corte: Pick<CorteXRecord, 'timestamp' | 'dateStr'>): string {
  return (
    hermosilloDateKey(corte.timestamp) ||
    hermosilloDateKey(corte.dateStr) ||
    String(corte.dateStr || '').slice(0, 10)
  );
}

function ticketDayKey(ticket: Pick<SaleTicket, 'timestamp'>): string {
  return hermosilloDateKey(ticket.timestamp) || String(ticket.timestamp || '').slice(0, 10);
}

function sameCorteStamp(ticket: Pick<SaleTicket, 'corteXId' | 'sesion_caja_id'>, corte: CorteXRecord): boolean {
  const stamp = String(ticket.corteXId || ticket.sesion_caja_id || '').trim();
  if (!stamp) return false;
  if (stamp === corte.id) return true;
  const sessionId = String(corte.sesion_caja_id || '').trim();
  return !!sessionId && stamp === sessionId;
}

function pushUnique<T extends { id: string }>(rows: T[], seen: Set<string>, row?: T): void {
  if (!row?.id || seen.has(row.id)) return;
  seen.add(row.id);
  rows.push(row);
}

/**
 * Tickets que sí pertenecen al arqueo guardado.
 * No mezcla ventas del mismo día que nunca se sellaron: esas se listan aparte.
 */
export function resolveHistoricCorteTickets(
  corte: CorteXRecord,
  available: SaleTicket[] = []
): SaleTicket[] {
  const snapshot = (corte.ticketsSnapshot || []).filter((row) => row?.id);
  if (snapshot.length > 0) return snapshot;

  const byId = new Map<string, SaleTicket>();
  for (const ticket of available) {
    if (ticket?.id) byId.set(ticket.id, ticket);
  }
  const seen = new Set<string>();
  const rows: SaleTicket[] = [];
  for (const id of corte.ticketIds || []) {
    pushUnique(rows, seen, byId.get(id));
  }
  for (const ticket of available) {
    if (sameCorteStamp(ticket, corte)) pushUnique(rows, seen, ticket);
  }
  return rows;
}

export function resolveHistoricCorteExpenses(
  corte: CorteXRecord,
  available: Expense[] = []
): Expense[] {
  const snapshot = (corte.expensesSnapshot || []).filter((row) => row?.id);
  if (snapshot.length > 0) return snapshot;

  const byId = new Map<string, Expense>();
  for (const expense of available) {
    if (expense?.id) byId.set(expense.id, expense);
  }
  const seen = new Set<string>();
  const rows: Expense[] = [];
  for (const id of corte.expenseIds || []) {
    pushUnique(rows, seen, byId.get(id));
  }
  for (const expense of available) {
    const stamp = String(expense.corteXId || expense.sesion_caja_id || '').trim();
    if (stamp && (stamp === corte.id || stamp === String(corte.sesion_caja_id || '').trim())) {
      pushUnique(rows, seen, expense);
    }
  }
  return rows;
}

export function ticketIncludesPhoneUnit(ticket: SaleTicket | null | undefined): boolean {
  return (ticket?.items || []).some((item) => isPhoneUnitSale(item));
}

function sameBranchAndDay(ticket: SaleTicket, corte: CorteXRecord, dateKey: string): boolean {
  if (String(ticket.estado || '').toUpperCase() === 'CANCELADA') return false;
  if (normalizeBranchId(ticket.branchId || ticket.sucursal_id) !== normalizeBranchId(corte.branchId || corte.sucursal_id)) {
    return false;
  }
  return !!dateKey && ticketDayKey(ticket) === dateKey;
}

/** Ventas del mismo día/sucursal que Dirección sí ve y este corte no selló. */
export function ticketsNotSealedOnCorte(corte: CorteXRecord, tickets: SaleTicket[] = []): SaleTicket[] {
  const sealed = new Set((corte.ticketIds || []).filter(Boolean));
  for (const row of corte.ticketsSnapshot || []) {
    if (row?.id) sealed.add(row.id);
  }
  const dateKey = corteDayKey(corte);
  return tickets.filter((ticket) => {
    if (!ticket?.id || sealed.has(ticket.id)) return false;
    if (sameCorteStamp(ticket, corte)) return false;
    if (!sameBranchAndDay(ticket, corte, dateKey)) return false;
    const stamp = String(ticket.corteXId || ticket.sesion_caja_id || '').trim();
    return !stamp;
  });
}

/** Ventas del mismo día que quedaron en otro turno/corte de la sucursal. */
export function ticketsSealedOnOtherCorteSameDay(
  corte: CorteXRecord,
  tickets: SaleTicket[] = []
): SaleTicket[] {
  const sealed = new Set((corte.ticketIds || []).filter(Boolean));
  for (const row of corte.ticketsSnapshot || []) {
    if (row?.id) sealed.add(row.id);
  }
  const dateKey = corteDayKey(corte);
  return tickets.filter((ticket) => {
    if (!ticket?.id || sealed.has(ticket.id)) return false;
    if (sameCorteStamp(ticket, corte)) return false;
    if (!sameBranchAndDay(ticket, corte, dateKey)) return false;
    const stamp = String(ticket.corteXId || ticket.sesion_caja_id || '').trim();
    return !!stamp;
  });
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
