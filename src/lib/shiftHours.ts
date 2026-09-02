/** Cash day for CREDI CEL: America/Hermosillo (Sonora, no DST). Till closes at 23:00. */

export const CASH_TIME_ZONE = 'America/Hermosillo';
export const CASH_CLOSE_HOUR = 23;

export const AUTO_CORTE_NOTE =
  'Cierre automático 23:00 (hora Sonora). Efectivo contado = esperado porque no hubo arqueo en mostrador.';

/** Cierre de las 11 p.m. o recuperación: no pisa el fondo que dejó el cajero. */
export function isAutomaticCloseNote(notas?: string): boolean {
  const n = String(notas || '');
  return n === AUTO_CORTE_NOTE || n.includes('Cierre automático 23:00');
}

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

/**
 * Parse a session instant. A date-only `YYYY-MM-DD` is noon in Sonora, not UTC midnight
 * (UTC midnight is the previous evening in Hermosillo and used to trigger a false auto-corte).
 */
export function parseSessionInstant(isoOrDate: string | Date | undefined): Date | null {
  if (!isoOrDate) return null;
  if (isoOrDate instanceof Date) {
    return Number.isNaN(isoOrDate.getTime()) ? null : isoOrDate;
  }
  const raw = String(isoOrDate).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const noon = new Date(`${raw}T12:00:00-07:00`);
    return Number.isNaN(noon.getTime()) ? null : noon;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function hermosilloDateKey(isoOrDate: string | Date | undefined): string {
  const d = parseSessionInstant(isoOrDate);
  if (!d) return '';
  return getHermosilloClock(d).dateKey;
}

/** 23:00 Sonora of the calendar day the session was opened. */
export function sessionCloseDeadline(fechaApertura: string | undefined, now: Date = new Date()): Date {
  const opened = parseSessionInstant(fechaApertura);
  const key = opened ? getHermosilloClock(opened).dateKey : getHermosilloClock(now).dateKey;
  return new Date(`${key}T${String(CASH_CLOSE_HOUR).padStart(2, '0')}:00:00-07:00`);
}

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
  return now.getTime() >= sessionCloseDeadline(session.fecha_apertura, now).getTime();
}

export function notesLookLikeAuto23Close(notes: string | undefined): boolean {
  return (notes || '').includes('Cierre automático 23:00');
}

export function isPrematureAutoCorte(
  session: { estado?: string; fecha_apertura?: string; arqueo_cierre?: { notas_observaciones?: string } } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!session || session.estado !== 'CERRADA') return false;
  if (!notesLookLikeAuto23Close(session.arqueo_cierre?.notas_observaciones)) return false;
  const openedKey = hermosilloDateKey(session.fecha_apertura);
  const today = getHermosilloClock(now).dateKey;
  if (openedKey && openedKey !== today) return false;
  return now.getTime() < sessionCloseDeadline(session.fecha_apertura, now).getTime();
}

export function isPrematureAutoCorteRecord(
  corte: { timestamp?: string; dateStr?: string; closingNotes?: string; operatorName?: string } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!corte) return false;
  const notes = `${corte.closingNotes || ''} ${corte.operatorName || ''}`;
  if (!notesLookLikeAuto23Close(notes)) return false;
  return now.getTime() < sessionCloseDeadline(corte.timestamp || corte.dateStr, now).getTime();
}

export function formatHermosilloDate(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : parseSessionInstant(isoOrDate) || new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '--/--/----';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: CASH_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

export function formatHermosilloTime(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : parseSessionInstant(isoOrDate) || new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: CASH_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
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

export function previousHermosilloDateKey(now: Date = new Date()): string {
  const today = getHermosilloClock(now).dateKey;
  const noon = new Date(`${today}T12:00:00-07:00`);
  return getHermosilloClock(new Date(noon.getTime() - 24 * 60 * 60 * 1000)).dateKey;
}

export function daysNeedingCatchUpClose(now: Date = new Date()): string[] {
  const days = [previousHermosilloDateKey(now)];
  if (isAfterCashClose(now)) days.unshift(getHermosilloClock(now).dateKey);
  return days;
}

export function isActiveCorteRecord(
  corte: {
    reverted?: boolean;
    timestamp?: string;
    dateStr?: string;
    closingNotes?: string;
    operatorName?: string;
  } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!corte || corte.reverted) return false;
  return !isPrematureAutoCorteRecord(corte, now);
}

export class CashTillLockedError extends Error {
  constructor() {
    super(
      'Después de las 11:00 p.m. ya no se cobran ventas. Si el corte no se guardó, ábralo y ciérrelo; el siguiente turno abre después de medianoche.'
    );
    this.name = 'CashTillLockedError';
  }
}
