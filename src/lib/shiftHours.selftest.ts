import assert from 'node:assert/strict';
import {
  AUTO_CORTE_NOTE,
  AUTO_CORTE_RETRY_NOTE,
  autoCloseMayCreateSession,
  automaticCloseIso,
  daysNeedingCatchUpClose,
  getHermosilloClock,
  hermosilloDateKey,
  isActiveCorteRecord,
  isAutomaticCloseNote,
  isHollowAutoCloseCorte,
  isHumanCorteForDay,
  shouldPersistCorteRecord,
  withoutHollowAutoCloseCortes,
  isPrematureAutoCorte,
  isPrematureAutoCorteRecord,
  parseSessionInstant,
  previousHermosilloDateKey,
  sessionCloseDeadline,
  sessionNeedsAutomaticCorte
} from './shiftHours.ts';

const todayKey = getHermosilloClock().dateKey;

const dateOnly = parseSessionInstant(todayKey);
assert.ok(dateOnly);
assert.equal(hermosilloDateKey(todayKey), todayKey, 'YYYY-MM-DD is the Sonora calendar day, not the previous evening');

const utcMidnight = new Date(`${todayKey}T00:00:00.000Z`);
const utcKey = hermosilloDateKey(utcMidnight.toISOString());
assert.notEqual(utcKey, todayKey, 'UTC midnight of today is still yesterday evening in Hermosillo');

const morning = new Date(`${todayKey}T10:00:00-07:00`);
const evening = new Date(`${todayKey}T23:00:00-07:00`);
const openSession = {
  estado: 'ABIERTA' as const,
  sucursal_id: 'b-navojoa',
  fecha_apertura: `${todayKey}T09:15:00-07:00`
};

assert.equal(sessionNeedsAutomaticCorte(openSession, morning), false);
assert.equal(sessionNeedsAutomaticCorte(openSession, evening), true);
assert.equal(automaticCloseIso(openSession.fecha_apertura), `${todayKey}T23:00:00-07:00`);
assert.equal(sessionCloseDeadline(todayKey, morning).toISOString(), evening.toISOString());

const prematureClosed = {
  estado: 'CERRADA' as const,
  fecha_apertura: `${todayKey}T09:15:00-07:00`,
  arqueo_cierre: { notas_observaciones: AUTO_CORTE_NOTE }
};
assert.equal(isPrematureAutoCorte(prematureClosed, morning), true);
assert.equal(isPrematureAutoCorte(prematureClosed, evening), false);

const leftoverYesterday = {
  estado: 'CERRADA' as const,
  fecha_apertura: '2020-01-01T09:00:00-07:00',
  arqueo_cierre: { notas_observaciones: AUTO_CORTE_NOTE }
};
assert.equal(isPrematureAutoCorte(leftoverYesterday, morning), false);

const autoRecord = {
  timestamp: `${todayKey}T23:00:00-07:00`,
  closingNotes: AUTO_CORTE_NOTE,
  operatorName: 'Cierre automático 23:00'
};
assert.equal(isPrematureAutoCorteRecord(autoRecord, morning), true);
assert.equal(isPrematureAutoCorteRecord(autoRecord, evening), false);

const prev = previousHermosilloDateKey(new Date(`${todayKey}T18:00:00-07:00`));
assert.match(prev, /^\d{4}-\d{2}-\d{2}$/);
assert.notEqual(prev, todayKey);

const beforeClose = daysNeedingCatchUpClose(morning);
assert.equal(beforeClose.includes(todayKey), false);
assert.equal(beforeClose.includes(prev), true);
const afterClose = daysNeedingCatchUpClose(evening);
assert.equal(afterClose[0], todayKey);

assert.equal(isActiveCorteRecord({ reverted: true, timestamp: `${todayKey}T23:00:00-07:00` }, evening), false);
assert.equal(isActiveCorteRecord(autoRecord, evening), true);
assert.equal(isActiveCorteRecord(autoRecord, morning), false);
assert.equal(isAutomaticCloseNote(AUTO_CORTE_NOTE), true);
assert.equal(isAutomaticCloseNote(AUTO_CORTE_RETRY_NOTE), true);
assert.equal(isAutomaticCloseNote('Fondo de $200 en monedas'), false);
assert.equal(
  autoCloseMayCreateSession({ notas: AUTO_CORTE_NOTE, requested: undefined, hasUnstampedDocs: false }),
  false,
  'el 23:00 no inventa un turno vacío'
);
assert.equal(
  autoCloseMayCreateSession({ notas: AUTO_CORTE_NOTE, requested: true, hasUnstampedDocs: false }),
  false,
  'aunque pidan crear, sin tickets no hay corte fantasma'
);
assert.equal(
  autoCloseMayCreateSession({ notas: AUTO_CORTE_NOTE, requested: true, hasUnstampedDocs: true }),
  true,
  'si sí hubo ventas sin sello, el 23:00 sí puede abrir para guardarlas'
);
assert.equal(
  autoCloseMayCreateSession({ notas: 'Cierre de Teresa', requested: undefined, hasUnstampedDocs: false }),
  true,
  'un arqueo de mostrador sí puede crear el documento'
);
assert.equal(
  isHollowAutoCloseCorte({
    id: 'SES-MTZ-EMPTY',
    closingNotes: AUTO_CORTE_NOTE,
    totalSales: 0,
    ticketIds: []
  }),
  true,
  'el cierre 23:00 sin tickets no debe contar como corte del día'
);
assert.equal(
  isHollowAutoCloseCorte({
    id: 'SES-MTZ-REAL',
    closingNotes: AUTO_CORTE_NOTE,
    totalSales: 1578,
    ticketIds: ['TCK-1']
  }),
  false,
  'si el automático sí llevó ventas, se conserva'
);
assert.deepEqual(
  withoutHollowAutoCloseCortes([
    { id: 'SES-HUA-REAL', totalSales: 7704, ticketIds: ['TCK-H'] },
    { id: 'SES-HUA-EMPTY', closingNotes: AUTO_CORTE_NOTE, totalSales: 0, ticketIds: [] }
  ]).map((row) => row.id),
  ['SES-HUA-REAL']
);
assert.equal(
  shouldPersistCorteRecord({
    id: 'SES-HUA-EMPTY',
    closingNotes: AUTO_CORTE_NOTE,
    totalSales: 0,
    ticketIds: []
  }),
  false
);
assert.equal(
  shouldPersistCorteRecord({
    id: 'SES-HUA-REAL',
    closingNotes: AUTO_CORTE_NOTE,
    totalSales: 3278,
    ticketIds: ['TCK-H']
  }),
  true
);

assert.equal(
  isHumanCorteForDay(
    {
      timestamp: '2026-11-08T22:00:00.000Z',
      totalSales: 4500,
      ticketIds: ['HUA-0811-001']
    },
    '2026-11-08'
  ),
  true
);
assert.equal(
  isHumanCorteForDay(
    {
      timestamp: '2026-11-08T22:00:00.000Z',
      closingNotes: AUTO_CORTE_NOTE,
      totalSales: 0,
      ticketIds: []
    },
    '2026-11-08'
  ),
  false
);

console.log('shiftHours self-test ok');
