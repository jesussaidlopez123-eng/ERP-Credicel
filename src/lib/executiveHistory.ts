import { CorteXRecord, Expense, SaleTicket } from '../types';
import { addCashDays, listCashDays, safeDateIsoKey, todayCashDateKey, weekStartDateKey } from './dateUtils';
import { mergeByIdKeep } from './listMerge';

/** Días que Dirección pide de un golpe a la nube. */
export const CAJA_RANGE_CHUNK_DAYS = 14;

/** El Corte X de estos días sí necesita la foto de tickets; lo más viejo se aligera. */
export const CORTE_SNAPSHOT_KEEP_DAYS = 14;

export function slimCorteRecord(corte: CorteXRecord): CorteXRecord {
  if (!corte?.ticketsSnapshot?.length && !corte?.expensesSnapshot?.length) return corte;
  const { ticketsSnapshot: _tickets, expensesSnapshot: _expenses, ...rest } = corte;
  return rest;
}

export function corteSnapshotKeepFrom(today = todayCashDateKey()): string {
  return addCashDays(today, -CORTE_SNAPSHOT_KEEP_DAYS);
}

export function slimOldCortes(cortes: CorteXRecord[] = [], keepFromDateKey?: string): CorteXRecord[] {
  if (!cortes.length) return cortes;
  const from = keepFromDateKey || corteSnapshotKeepFrom();
  let changed = false;
  const next = cortes.map((corte) => {
    const key = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
    if (key && key >= from) return corte;
    const slim = slimCorteRecord(corte);
    if (slim !== corte) changed = true;
    return slim;
  });
  return changed ? next : cortes;
}

export function collectTicketsFromCortes(cortes: CorteXRecord[] = []): SaleTicket[] {
  const rows: SaleTicket[] = [];
  for (const corte of cortes) {
    for (const ticket of corte.ticketsSnapshot || []) {
      if (ticket?.id) rows.push(ticket);
    }
  }
  return mergeByIdKeep([], rows);
}

export function collectExpensesFromCortes(cortes: CorteXRecord[] = []): Expense[] {
  const rows: Expense[] = [];
  for (const corte of cortes) {
    for (const expense of corte.expensesSnapshot || []) {
      if (expense?.id) rows.push(expense);
    }
  }
  return mergeByIdKeep([], rows);
}

/**
 * Completa tickets y gastos con lo que ya viene dentro del corte.
 * Lo pedido a ventas/gastos pisa el snapshot (más fresco).
 */
export function mergeCajaDocsWithSnapshots(docs: {
  tickets?: SaleTicket[];
  expenses?: Expense[];
  cortes?: CorteXRecord[];
}): { tickets: SaleTicket[]; expenses: Expense[]; cortes: CorteXRecord[] } {
  const cortes = docs.cortes || [];
  return {
    tickets: mergeByIdKeep(collectTicketsFromCortes(cortes), docs.tickets || []),
    expenses: mergeByIdKeep(collectExpensesFromCortes(cortes), docs.expenses || []),
    cortes
  };
}

export function weekStartsFromCortes(cortes: CorteXRecord[] = []): string[] {
  const starts = new Set<string>();
  for (const corte of cortes) {
    const key = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
    const week = weekStartDateKey(key);
    if (week) starts.add(week);
  }
  return Array.from(starts);
}

export function missingCashDays(loaded: Iterable<string>, from: string, to: string): string[] {
  const have = loaded instanceof Set ? loaded : new Set(loaded);
  return listCashDays(from, to).filter((day) => !have.has(day));
}

export function markCashDaysLoaded(loaded: Set<string>, from: string, to: string): void {
  for (const day of listCashDays(from, to)) loaded.add(day);
}
