/** Unique document / ticket identifiers. Random 6-digit folios collided and overwrote sales. */
export function newUniqueId(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${time}-${rand}`;
}

export function newTicketId(): string {
  return newUniqueId('TCK');
}

export function newSessionId(branchId: string, openedAt: Date = new Date()): string {
  const code = (branchId || 'suc').replace(/^b-/, '').toUpperCase().slice(0, 8);
  const y = openedAt.getFullYear();
  const m = String(openedAt.getMonth() + 1).padStart(2, '0');
  const d = String(openedAt.getDate()).padStart(2, '0');
  const seq = Date.now().toString(36).toUpperCase();
  return `SES-${code}-${y}${m}${d}-${seq}`;
}

export function money(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
