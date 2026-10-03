import { hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { safeDateIsoKey } from './dateUtils';

export function branchDateKey(branchId: string, dateKey: string): string {
  return `${normalizeBranchId(branchId)}::${dateKey}`;
}

/** Una pasada: tickets o gastos agrupados por sucursal + día (hora Sonora). */
export function indexByBranchDate<T>(
  rows: T[] | undefined,
  branchOf: (row: T) => string | undefined,
  timeOf: (row: T) => string | undefined
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows || []) {
    const branchId = normalizeBranchId(branchOf(row));
    if (!hasCashTill(branchId)) continue;
    const dateKey = safeDateIsoKey(timeOf(row));
    if (!dateKey) continue;
    const key = branchDateKey(branchId, dateKey);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

export function datesFromBranchDateIndex(index: Map<string, unknown[]>): string[] {
  const dates = new Set<string>();
  for (const key of index.keys()) {
    const sep = key.lastIndexOf('::');
    if (sep >= 0) dates.add(key.slice(sep + 2));
  }
  return [...dates];
}
