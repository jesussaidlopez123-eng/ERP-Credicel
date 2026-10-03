import { formatHermosilloTime } from './shiftHours';

type TicketStamp = { timestamp?: string };

export type CorteHoursSource = {
  id: string;
  timeStr?: string;
  timestamp?: string;
  closingNotes?: string;
  ticketsSnapshot?: TicketStamp[];
};

function ticketTimes(tickets?: TicketStamp[]): string[] {
  return (tickets || [])
    .map((t) => t.timestamp)
    .filter((ts): ts is string => Boolean(ts))
    .sort();
}

function parseInicia(timeStr?: string): string {
  const hit = String(timeStr || '').match(/Inicia:\s*([^(\n]+)/i);
  if (!hit) return '';
  return hit[1].replace(/\s*\(.*$/, '').trim();
}

/** Horas de turno para la fila compacta del módulo 3. */
export function corteShiftHours(corte: CorteHoursSource): { start: string; end: string } {
  if (corte.id.startsWith('CAL-ZERO')) {
    return { start: '—', end: '—' };
  }

  const stamps = ticketTimes(corte.ticketsSnapshot);
  const firstTicket = stamps[0] ? formatHermosilloTime(stamps[0]) : '';
  const lastTicket = stamps.length ? formatHermosilloTime(stamps[stamps.length - 1]) : '';
  const start = parseInicia(corte.timeStr) || firstTicket || '09:00 a.m.';

  if (corte.id.startsWith('CTX-TURNO')) {
    return { start, end: 'En curso' };
  }

  const rawTime = String(corte.timeStr || '').trim();
  const notes = String(corte.closingNotes || '');
  const ts = String(corte.timestamp || '');
  const syntheticClose = /T23:59:59|T00:00:00/.test(ts);

  if (rawTime && /^\d/.test(rawTime) && !/inicia/i.test(rawTime)) {
    return { start, end: rawTime };
  }
  if (ts.includes('T') && !syntheticClose) {
    return { start, end: formatHermosilloTime(ts) };
  }
  if (lastTicket) return { start, end: lastTicket };
  if (/Medianoche|23:00/.test(`${rawTime} ${notes}`)) {
    return { start, end: '11:00 p.m.' };
  }
  return { start, end: '11:00 p.m.' };
}

export function formatCorteDayHeading(dateKey: string, todayKey: string): string {
  if (!dateKey) return 'Sin fecha';
  const pretty = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Hermosillo',
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(`${dateKey}T12:00:00-07:00`));
  if (dateKey === todayKey) return `Hoy · ${pretty}`;
  return pretty;
}
