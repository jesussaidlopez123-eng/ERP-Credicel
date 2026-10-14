import type { CorteXRecord, Expense, RepairRecord, SesionCaja } from '../types';
import { money } from './ids';
import { safeDateIsoKey, todayCashDateKey } from './dateUtils';
import { buildHistoricSaleTimestamp, findClosedCorteForDay } from './historicSale';
import { repairInternalCost } from './repairUtils';

export const MATRIZ_REPAIR_EXPENSE_KIND = 'refaccion_taller' as const;
export const MATRIZ_BRANCH_ID = 'b-matriz';

export function matrizRepairExpenseId(repairId: string): string {
  return `GTO-REP-${repairId}`;
}

export function isMatrizRepairExpense(expense: Expense | null | undefined): boolean {
  if (!expense) return false;
  if (expense.kind === MATRIZ_REPAIR_EXPENSE_KIND) return true;
  return expense.countsAsCashOut === false && Boolean(String(expense.repairId || '').trim());
}

/** La pieza se cargó (o se quitó) cuando el equipo ya había salido de caja. */
export function shouldSyncLateRepairMatrizExpense(
  previous: RepairRecord | undefined,
  next: RepairRecord
): boolean {
  if (next.status !== 'entregado') return false;
  if (!previous || previous.status !== 'entregado') return false;
  return money(repairInternalCost(previous)) !== money(repairInternalCost(next));
}

export function buildLateRepairMatrizExpense(
  record: RepairRecord,
  operatorName: string
): Expense | null {
  const amount = money(repairInternalCost(record));
  if (amount <= 0) return null;
  const dateKey =
    safeDateIsoKey(record.deliveredAtIso || record.deliveredAt) || todayCashDateKey();
  const timestamp = record.deliveredAtIso || buildHistoricSaleTimestamp(dateKey);
  return {
    id: matrizRepairExpenseId(record.id),
    amount,
    concept: `Refacción taller ${record.id} · ${record.deviceModel}`,
    timestamp,
    date: dateKey,
    operatorName: operatorName || record.deliveredByName || 'Taller',
    branchId: MATRIZ_BRANCH_ID,
    sucursal_id: MATRIZ_BRANCH_ID,
    kind: MATRIZ_REPAIR_EXPENSE_KIND,
    repairId: record.id,
    countsAsCashOut: false
  };
}

export function attachExpenseToMatrizCorte(
  expense: Expense,
  cortes: CorteXRecord[] | undefined,
  matrizOpenSession?: SesionCaja | null
): { expense: Expense; closedCorte: CorteXRecord | null } {
  const dateKey = safeDateIsoKey(expense.timestamp || expense.date);
  const closed = findClosedCorteForDay(cortes, MATRIZ_BRANCH_ID, dateKey);
  if (closed) {
    return {
      closedCorte: closed,
      expense: {
        ...expense,
        corteXId: closed.id,
        sesion_caja_id: closed.sesion_caja_id || closed.id,
        corteXClosedAt: closed.timestamp,
        sucursal_id: MATRIZ_BRANCH_ID
      }
    };
  }
  if (matrizOpenSession && matrizOpenSession.estado === 'ABIERTA') {
    return {
      closedCorte: null,
      expense: {
        ...expense,
        sesion_caja_id: matrizOpenSession.id,
        sucursal_id: MATRIZ_BRANCH_ID
      }
    };
  }
  return { expense, closedCorte: null };
}

export type LateRepairMatrizPlan = {
  action: 'none' | 'upsert' | 'remove';
  expense: Expense | null;
  closedCorte: CorteXRecord | null;
  removeId?: string;
};

export function planLateRepairMatrizExpense(input: {
  previous?: RepairRecord;
  next: RepairRecord;
  operatorName: string;
  cortes: CorteXRecord[];
  matrizOpenSession?: SesionCaja | null;
}): LateRepairMatrizPlan {
  if (!shouldSyncLateRepairMatrizExpense(input.previous, input.next)) {
    return { action: 'none', expense: null, closedCorte: null };
  }
  const built = buildLateRepairMatrizExpense(input.next, input.operatorName);
  if (!built) {
    return {
      action: 'remove',
      expense: null,
      closedCorte: findClosedCorteForDay(
        input.cortes,
        MATRIZ_BRANCH_ID,
        safeDateIsoKey(input.next.deliveredAtIso || input.next.deliveredAt)
      ),
      removeId: matrizRepairExpenseId(input.next.id)
    };
  }
  const attached = attachExpenseToMatrizCorte(built, input.cortes, input.matrizOpenSession);
  return { action: 'upsert', expense: attached.expense, closedCorte: attached.closedCorte };
}
