import assert from 'node:assert/strict';
import {
  fillCashDateSpan,
  formatCashDateLabel,
  formatMonthLabel,
  listCashDays,
  chunkInclusiveRange,
  monthEndDateKey,
  monthStartDateKey,
  isoWeekAndYear,
  naturalWeekTitle,
  weekdayShortEs,
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

const span = fillCashDateSpan(['2026-09-01'], '2026-10-03', 14);
assert.equal(span[0], '2026-10-03');
assert.equal(span[span.length - 1], '2026-09-01');
assert.equal(span.includes('2026-09-15'), true, 'no se saltan días entre el corte viejo y hoy');

assert.match(formatCashDateLabel('2026-09-10'), /10/);
assert.equal(workedDatesLabel('', ''), 'Sin movimiento');
assert.match(workedDatesLabel('2026-09-10', '2026-09-10'), /Trabajada el/);
assert.match(workedDatesLabel('2026-09-08', '2026-09-10'), /Trabajada /);

assert.equal(monthStartDateKey('2026-10-14'), '2026-10-01');
assert.equal(monthEndDateKey('2026-10-14'), '2026-10-31');
assert.equal(monthEndDateKey('2026-02-10'), '2026-02-28');
assert.match(formatMonthLabel('2026-10-14'), /octubre/i);
assert.deepEqual(listCashDays('2026-10-12', '2026-10-14'), ['2026-10-12', '2026-10-13', '2026-10-14']);
assert.deepEqual(listCashDays('2026-10-14', '2026-10-12'), ['2026-10-12', '2026-10-13', '2026-10-14']);
assert.ok(weekdayShortEs('2026-10-14'));
assert.deepEqual(chunkInclusiveRange('2026-10-01', '2026-10-10', 7), [
  { from: '2026-10-01', to: '2026-10-07' },
  { from: '2026-10-08', to: '2026-10-10' }
]);

console.log('dateUtils self-test ok');
