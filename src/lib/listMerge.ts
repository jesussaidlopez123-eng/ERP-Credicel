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

export function oldestTimestamp<T>(rows: T[], field: keyof T): string {
  let oldest = '';
  for (const row of rows) {
    const value = String(row[field] || '');
    if (!value) continue;
    if (!oldest || value < oldest) oldest = value;
  }
  return oldest;
}
