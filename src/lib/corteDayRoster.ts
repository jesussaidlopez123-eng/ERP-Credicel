import { getBranchDisplayName } from '../data/initialBranches';
import { safeDateIsoKey, safeFormatDate, parseSafeDate } from './dateUtils';
import { toInventoryBranchId, type InventoryBranchId } from './imeiInventory';
import type { CorteXRecord } from '../types';

export const DAY_BRANCH_IDS = ['b-matriz', 'b-navojoa', 'b-huatabampo'] as const;

export function corteDayKey(corte: Pick<CorteXRecord, 'timestamp' | 'dateStr'>): string {
  return safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
}

export function emptyDayCorte(dateKey: string, branchId: string): CorteXRecord {
  const dest = toInventoryBranchId(branchId);
  const targetDate = parseSafeDate(dateKey);
  return {
    id: `CAL-ZERO-${dest.replace('b-', '').toUpperCase()}-${dateKey}`,
    timestamp: `${dateKey}T12:00:00-07:00`,
    dateStr: safeFormatDate(targetDate),
    timeStr: 'Cerrado / Sin Actividad (No se laboró)',
    branchId: dest,
    branchName: getBranchDisplayName(dest),
    operatorName: 'Sin Movimientos',
    initialCashFund: 0,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    totalSales: 0,
    totalExpenses: 0,
    netIncome: 0,
    expectedCashInDrawer: 0,
    ticketIds: [],
    expenseIds: [],
    breakdown: {
      accesoriosTotal: 0,
      accesoriosCount: 0,
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

function rowRank(corte: CorteXRecord): number {
  const id = String(corte.id || '');
  if (id.startsWith('CAL-ZERO')) return 0;
  if (id.startsWith('CTX_')) return 20;
  if (id.startsWith('CTX-TURNO')) return 25;
  return 40;
}

export function pickBetterDayCorte(current: CorteXRecord | undefined, incoming: CorteXRecord): CorteXRecord {
  if (!current) return incoming;
  const a = rowRank(current);
  const b = rowRank(incoming);
  if (b !== a) return b > a ? incoming : current;
  return (incoming.timestamp || '') > (current.timestamp || '') ? incoming : current;
}

/**
 * Una fila por sucursal (Matriz, Navojoa, Huatabampo) en cada día.
 * Si faltaba una tienda, se rellena en cero. Nunca dos Navojoa el mismo día.
 */
export function foldOnePerBranchPerDay(rows: CorteXRecord[]): CorteXRecord[] {
  const byDay = new Map<string, Map<InventoryBranchId, CorteXRecord>>();

  for (const row of rows || []) {
    const dateKey = corteDayKey(row);
    if (!dateKey) continue;
    const branchId = toInventoryBranchId(row.branchId);
    if (!(DAY_BRANCH_IDS as readonly string[]).includes(branchId)) continue;
    let day = byDay.get(dateKey);
    if (!day) {
      day = new Map();
      byDay.set(dateKey, day);
    }
    day.set(branchId, pickBetterDayCorte(day.get(branchId), { ...row, branchId, branchName: getBranchDisplayName(branchId) }));
  }

  const out: CorteXRecord[] = [];
  const dates = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  for (const dateKey of dates) {
    const day = byDay.get(dateKey)!;
    for (const branchId of DAY_BRANCH_IDS) {
      out.push(day.get(branchId) || emptyDayCorte(dateKey, branchId));
    }
  }
  return out;
}

export function assertThreeBranchesPerDay(rows: CorteXRecord[]): boolean {
  const byDay = new Map<string, string[]>();
  for (const row of rows) {
    const dateKey = corteDayKey(row);
    const branchId = toInventoryBranchId(row.branchId);
    const list = byDay.get(dateKey) || [];
    list.push(branchId);
    byDay.set(dateKey, list);
  }
  for (const list of byDay.values()) {
    if (list.length !== 3) return false;
    if (new Set(list).size !== 3) return false;
    if (DAY_BRANCH_IDS.some((id, i) => list[i] !== id)) return false;
  }
  return true;
}
