import { addCashDays, safeDateIsoKey } from './dateUtils';

/** Al abrir Ventas y cortes se pide historial hasta esta ventana. */
export const SALES_HISTORY_DAYS = 180;
export const SALES_HISTORY_MAX_PAGES = 10;

export function oldestDateKey(rows: { timestamp?: string; dateStr?: string }[]): string {
  let oldest = '';
  for (const row of rows || []) {
    const key = safeDateIsoKey(row.timestamp) || safeDateIsoKey(row.dateStr);
    if (!key) continue;
    if (!oldest || key < oldest) oldest = key;
  }
  return oldest;
}

export function historyWindowReached(
  rows: { timestamp?: string; dateStr?: string }[],
  todayKey: string,
  days: number = SALES_HISTORY_DAYS
): boolean {
  const oldest = oldestDateKey(rows);
  if (!oldest || !todayKey) return false;
  return oldest <= addCashDays(todayKey, -days);
}
