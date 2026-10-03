import assert from 'node:assert/strict';
import { corteShiftHours, formatCorteDayHeading } from './corteDayHours.ts';

assert.deepEqual(corteShiftHours({ id: 'CAL-ZERO-NAV-2026-10-01' }), { start: '—', end: '—' });

const live = corteShiftHours({
  id: 'CTX-TURNO-NAVOJOA-2026-10-03',
  timeStr: 'Inicia: 09:12 a.m. (Turno en Vivo / Tiempo Real)'
});
assert.equal(live.start, '09:12 a.m.');
assert.equal(live.end, 'En curso');

const official = corteShiftHours({
  id: 'SES-NAV-20261002-001',
  timeStr: '11:02 p.m.',
  timestamp: '2026-10-02T23:02:00-07:00',
  ticketsSnapshot: [{ timestamp: '2026-10-02T09:14:00-07:00' }, { timestamp: '2026-10-02T21:40:00-07:00' }]
});
assert.match(official.start, /9:14/);
assert.equal(official.end, '11:02 p.m.');

const recovered = corteShiftHours({
  id: 'CTX_b-navojoa_2026-09-28',
  timeStr: 'Cierre Oficial de Turno',
  timestamp: '2026-09-28T23:59:59.000Z',
  ticketsSnapshot: [{ timestamp: '2026-09-28T10:05:00-07:00' }, { timestamp: '2026-09-28T18:20:00-07:00' }]
});
assert.match(recovered.start, /10:05/);
assert.match(recovered.end, /6:20/);

assert.match(formatCorteDayHeading('2026-10-03', '2026-10-03'), /Hoy/);
assert.ok(!formatCorteDayHeading('2026-10-02', '2026-10-03').includes('Hoy'));

console.log('corteDayHours self-test ok');
