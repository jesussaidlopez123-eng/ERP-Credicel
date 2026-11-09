/** Conserva filas ya cargadas (páginas viejas) y deja que las nuevas pisen el mismo id. */
export function mergeByIdKeep<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  if (!incoming.length) return previous;
  if (!previous.length) return incoming.slice();
  const map = new Map<string, T>();
  for (const row of previous) {
    if (row?.id) map.set(row.id, row);
  }
  for (const row of incoming) {
    if (row?.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

/**
 * Un documento que ya no viene en la ventana en vivo no es “historial viejo”:
 * si su fecha entra en esa ventana, se borró y no debe reaparecer desde el caché.
 */
export function dropAbsentFromLiveWindow<T extends { id: string; timestamp?: string }>(
  previous: T[],
  live: T[],
  options?: { keepIds?: Iterable<string>; liveIsComplete?: boolean; minLiveCount?: number }
): T[] {
  if (!live.length) return previous;
  const minLiveCount = Math.max(0, Number(options?.minLiveCount) || 0);
  // Un snapshot chico (caché parcial de Firestore) no es la ventana completa:
  // no borres el turno de Huatabampo/Navojoa porque llegaron 20 tickets.
  if (minLiveCount > 0 && live.length < minLiveCount && !options?.liveIsComplete) {
    return previous;
  }
  const liveIds = new Set((live || []).map((row) => row?.id).filter(Boolean));
  const keepIds = new Set(
    [...(options?.keepIds || [])].map((id) => String(id || '').trim()).filter(Boolean)
  );
  let oldestLive = '';
  for (const row of live) {
    const ts = String(row?.timestamp || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(ts)) continue;
    if (!oldestLive || ts < oldestLive) oldestLive = ts;
  }
  return (previous || []).filter((row) => {
    if (!row?.id) return false;
    if (liveIds.has(row.id) || keepIds.has(row.id)) return true;
    if (options?.liveIsComplete) return false;
    const ts = String(row.timestamp || '');
    if (oldestLive && ts >= oldestLive) return false;
    return true;
  });
}

export function oldestTimestamp<T>(rows: T[], field: keyof T): string {
  let oldest = '';
  for (const row of rows) {
    const value = String(row[field] || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) continue;
    if (!oldest || value < oldest) oldest = value;
  }
  return oldest;
}
