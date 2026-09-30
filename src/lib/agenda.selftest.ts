import assert from 'node:assert/strict';
import type { AgendaTask, AppNotification } from '../types';
import {
  agendaNotificationId,
  agendaNotificationPlan,
  buildMonthCells,
  emptyAgendaTask,
  formatMonthTitle,
  isAgendaAlarmReached,
  isAgendaTaskDue,
  monthFromDateKey,
  normalizeAgendaTask,
  normalizeAlarmTime,
  openTaskCountOnDate,
  shiftMonth,
  tasksOnDate,
  upcomingOpenTasks
} from './agenda.ts';
import { notificationVisibleToOperator } from './repairUtils.ts';

assert.equal(normalizeAlarmTime('9:05'), '09:05');
assert.equal(normalizeAlarmTime('23:59'), '23:59');
assert.equal(normalizeAlarmTime('24:00'), undefined);
assert.equal(normalizeAlarmTime(''), undefined);

const raw = normalizeAgendaTask({
  id: 'AG-1',
  title: '  Llamar a proveedor  ',
  dateKey: '2026-09-30',
  alarmTime: '8:30',
  done: false,
  createdAt: '2026-09-29T10:00:00.000Z',
  authorName: 'Admin'
});
assert.ok(raw);
assert.equal(raw?.title, 'Llamar a proveedor');
assert.equal(raw?.alarmTime, '08:30');
assert.equal(normalizeAgendaTask({ id: 'x', title: '', dateKey: '2026-09-30' }), null);

assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
assert.deepEqual(monthFromDateKey('2026-09-30'), { year: 2026, month: 9 });
assert.match(formatMonthTitle(2026, 9), /septiembre/i);

const cells = buildMonthCells(2026, 9, '2026-09-30');
assert.equal(cells.length, 42);
assert.equal(cells[0].dateKey, '2026-08-31');
assert.equal(cells[0].inMonth, false);
assert.equal(cells.find((c) => c.dateKey === '2026-09-01')?.inMonth, true);
assert.equal(cells.find((c) => c.dateKey === '2026-09-30')?.isToday, true);
assert.equal(cells[41].dateKey, '2026-10-11');

const open: AgendaTask = emptyAgendaTask({
  id: 'AG-1',
  title: 'Pagar CFE',
  dateKey: '2026-09-30',
  alarmTime: '10:00',
  authorName: 'Luis'
});
const done: AgendaTask = { ...open, id: 'AG-2', title: 'Ya hecha', done: true };
const later: AgendaTask = { ...open, id: 'AG-3', title: 'Mañana', dateKey: '2026-10-01', alarmTime: undefined };

assert.equal(tasksOnDate([open, done, later], '2026-09-30').length, 2);
assert.equal(openTaskCountOnDate([open, done, later], '2026-09-30'), 1);
assert.equal(upcomingOpenTasks([open, later], '2026-09-30', 5)[0].id, 'AG-1');

const morning = { dateKey: '2026-09-30', hour: 9, minute: 0 };
const noon = { dateKey: '2026-09-30', hour: 10, minute: 0 };
assert.equal(isAgendaTaskDue(open, morning), true);
assert.equal(isAgendaTaskDue(later, morning), false);
assert.equal(isAgendaTaskDue(done, morning), false);
assert.equal(isAgendaAlarmReached(open, morning), false);
assert.equal(isAgendaAlarmReached(open, noon), true);
assert.equal(isAgendaTaskDue({ ...open, dateKey: '2026-09-29' }, morning), true);

const first = agendaNotificationPlan([open, later, done], [], morning);
assert.equal(first.add.length, 1);
assert.equal(first.add[0].id, agendaNotificationId('AG-1'));
assert.equal(first.add[0].type, 'agenda_tarea');
assert.equal(first.add[0].urgency, 'normal');
assert.equal(first.dismissIds.length, 0);

const existing: AppNotification[] = [
  {
    ...first.add[0],
    createdAt: 'ahora',
    read: false
  }
];
const again = agendaNotificationPlan([open], existing, morning);
assert.equal(again.add.length, 0);
assert.equal(again.dismissIds.length, 0);

const afterDone = agendaNotificationPlan([{ ...open, done: true }], existing, morning);
assert.equal(afterDone.add.length, 0);
assert.ok(afterDone.dismissIds.includes(agendaNotificationId('AG-1')));

const moved = agendaNotificationPlan([{ ...open, dateKey: '2026-10-02' }], existing, morning);
assert.ok(moved.dismissIds.includes(agendaNotificationId('AG-1')));

const overdue = agendaNotificationPlan(
  [{ ...open, dateKey: '2026-09-29' }],
  [],
  morning
);
assert.equal(overdue.add[0].urgency, 'urgente');

assert.equal(
  notificationVisibleToOperator(
    { ...first.add[0], createdAt: '', read: false },
    { role: 'admin' }
  ),
  true
);
assert.equal(
  notificationVisibleToOperator(
    { ...first.add[0], createdAt: '', read: false },
    { role: 'manager' }
  ),
  true
);
assert.equal(
  notificationVisibleToOperator(
    { ...first.add[0], createdAt: '', read: false },
    { role: 'cashier' }
  ),
  false
);

console.log('agenda.selftest ok');
