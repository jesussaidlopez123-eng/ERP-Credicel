import { branchFolioCode } from '../data/initialBranches';
import { getHermosilloClock } from './shiftHours';

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
  const code = branchFolioCode(branchId);
  const key = getHermosilloClock(openedAt).dateKey.replace(/-/g, '');
  const seq = Date.now().toString(36).toUpperCase();
  return `SES-${code}-${key}-${seq}`;
}

export function money(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number): string {
  return money(n).toFixed(2);
}

export function formatTicketFolio(branchId: string, dateKey: string, seq: number): string {
  const code = branchFolioCode(branchId);
  const dd = dateKey.slice(8, 10);
  const mm = dateKey.slice(5, 7);
  return `${code}-${dd}${mm}-${String(Math.max(1, seq)).padStart(3, '0')}`;
}

export function ticketFolioLabel(ticket: { folio?: string; id?: string } | null | undefined): string {
  if (!ticket) return 'S/F';
  return ticket.folio || ticket.id || 'S/F';
}
