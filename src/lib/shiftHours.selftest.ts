import assert from 'node:assert/strict';
import {
  AUTO_CORTE_NOTE,
  automaticCloseIso,
  getHermosilloClock,
  hermosilloDateKey,
  isPrematureAutoCorte,
  isPrematureAutoCorteRecord,
  parseSessionInstant,
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

console.log('shiftHours self-test ok');
