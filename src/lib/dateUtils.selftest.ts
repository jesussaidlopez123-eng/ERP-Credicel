import assert from 'node:assert/strict';
import {
  formatCashDateLabel,
  isoWeekAndYear,
  naturalWeekTitle,
  weekStartDateKey,
  workedDatesLabel
} from './dateUtils.ts';

assert.equal(weekStartDateKey('2026-09-10'), '2026-09-07');
assert.deepEqual(isoWeekAndYear('2026-09-07'), { week: 37, year: 2026 });
assert.deepEqual(isoWeekAndYear('2026-09-13'), { week: 37, year: 2026 });
assert.equal(naturalWeekTitle('2026-09-07'), 'Semana 37 de 2026');

assert.deepEqual(isoWeekAndYear('2026-01-01'), { week: 1, year: 2026 });
assert.deepEqual(isoWeekAndYear('2025-12-29'), { week: 1, year: 2026 });
assert.equal(naturalWeekTitle('2025-12-29'), 'Semana 1 de 2026');

assert.match(formatCashDateLabel('2026-09-10'), /10/);
assert.equal(workedDatesLabel('', ''), 'Sin movimiento');
assert.match(workedDatesLabel('2026-09-10', '2026-09-10'), /Trabajada el/);
assert.match(workedDatesLabel('2026-09-08', '2026-09-10'), /Trabajada /);

console.log('dateUtils self-test ok');
