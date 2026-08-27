/** Cash day for CREDI CEL: America/Hermosillo (Sonora, no DST). Till closes at 23:00. */

export const CASH_TIME_ZONE = 'America/Hermosillo';
export const CASH_CLOSE_HOUR = 23;

export const AUTO_CORTE_NOTE =
  'Cierre automático 23:00 (hora Sonora). Efectivo contado = esperado porque no hubo arqueo en mostrador.';

export type HermosilloClock = {
  dateKey: string;
  hour: number;
  minute: number;
};

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value || '0';
}

export function getHermosilloClock(now: Date = new Date()): HermosilloClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CASH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

  return {
    dateKey: `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`,
    hour: parseInt(part(parts, 'hour'), 10) || 0,
    minute: parseInt(part(parts, 'minute'), 10) || 0
  };
}

export function isAfterCashClose(now: Date = new Date()): boolean {
  return getHermosilloClock(now).hour >= CASH_CLOSE_HOUR;
}

export function canOpenNewCashSession(now: Date = new Date()): boolean {
  return !isAfterCashClose(now);
}

export function hermosilloDateKey(isoOrDate: string | Date | undefined): string {
  if (!isoOrDate) return '';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  return getHermosilloClock(d).dateKey;
}

export function formatHermosilloDate(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '--/--/----';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: CASH_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

export function formatHermosilloTime(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: CASH_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

/** 23:00 on the Sonora calendar day when the session was opened. */
export function automaticCloseIso(fechaApertura: string, now: Date = new Date()): string {
  const key = hermosilloDateKey(fechaApertura) || getHermosilloClock(now).dateKey;
  return `${key}T23:00:00-07:00`;
}

export function sessionNeedsAutomaticCorte(
  session: { estado?: string; sucursal_id?: string; fecha_apertura?: string } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!session || session.estado !== 'ABIERTA') return false;
  if (session.sucursal_id === 'b-bodega') return false;
  const openKey = hermosilloDateKey(session.fecha_apertura);
  const today = getHermosilloClock(now).dateKey;
  if (!openKey) return isAfterCashClose(now);
  if (openKey < today) return true;
  return openKey === today && isAfterCashClose(now);
}

export function loggedInBeforeCashClose(loggedInAtMs: number, now: Date = new Date()): boolean {
  return !isAfterCashClose(new Date(loggedInAtMs)) && isAfterCashClose(now);
}

export function msUntilCashClose(now: Date = new Date()): number {
  const clock = getHermosilloClock(now);
  if (clock.hour >= CASH_CLOSE_HOUR) return 0;
  const minutesLeft = (CASH_CLOSE_HOUR - clock.hour) * 60 - clock.minute;
  return Math.max(15_000, minutesLeft * 60 * 1000);
}

export class CashTillLockedError extends Error {
  constructor() {
    super('La caja cierra a las 11:00 p.m. El corte del día ya quedó registrado. El siguiente turno abre después de medianoche.');
    this.name = 'CashTillLockedError';
  }
}
