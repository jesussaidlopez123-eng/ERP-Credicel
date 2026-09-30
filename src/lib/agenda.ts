import { AgendaTask, AppNotification } from '../types';
import { addCashDays, formatCashDateLabel, safeDateIsoKey, todayCashDateKey, weekStartDateKey } from './dateUtils';
import { newUniqueId } from './ids';
import { getHermosilloClock, type HermosilloClock } from './shiftHours';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'] as const;

export interface AgendaMonthCell {
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
}

export function normalizeAlarmTime(raw: unknown): string | undefined {
  const value = String(raw || '').trim();
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return undefined;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function normalizeAgendaTask(raw: unknown): AgendaTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<AgendaTask> & Record<string, unknown>;
  const id = String(row.id || '').trim();
  const title = String(row.title || '').trim();
  const dateKey = safeDateIsoKey(row.dateKey);
  if (!id || !title || !DATE_KEY.test(dateKey)) return null;
  const done = Boolean(row.done);
  return {
    id,
    title,
    notes: String(row.notes || '').trim() || undefined,
    dateKey,
    alarmTime: normalizeAlarmTime(row.alarmTime),
    done,
    doneAt: row.doneAt ? String(row.doneAt) : undefined,
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || row.createdAt || ''),
    authorName: String(row.authorName || ''),
    authorId: row.authorId ? String(row.authorId) : undefined
  };
}

export function emptyAgendaTask(partial: Partial<AgendaTask> = {}): AgendaTask {
  const now = new Date().toISOString();
  return {
    id: partial.id || newUniqueId('AG'),
    title: (partial.title || '').trim(),
    notes: partial.notes?.trim() || undefined,
    dateKey: DATE_KEY.test(String(partial.dateKey || '')) ? String(partial.dateKey) : todayCashDateKey(),
    alarmTime: normalizeAlarmTime(partial.alarmTime),
    done: Boolean(partial.done),
    doneAt: partial.doneAt,
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    authorName: partial.authorName || '',
    authorId: partial.authorId
  };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthFromDateKey(dateKey: string): { year: number; month: number } {
  if (!DATE_KEY.test(dateKey)) {
    const today = todayCashDateKey();
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  }
  return { year: Number(dateKey.slice(0, 4)), month: Number(dateKey.slice(5, 7)) };
}

export function monthStartKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function formatMonthTitle(year: number, month: number): string {
  const key = monthStartKey(year, month);
  const label = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Hermosillo',
    month: 'long',
    year: 'numeric'
  }).format(new Date(`${key}T12:00:00-07:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildMonthCells(year: number, month: number, today = todayCashDateKey()): AgendaMonthCell[] {
  const start = weekStartDateKey(monthStartKey(year, month));
  const prefix = monthStartKey(year, month).slice(0, 7);
  const cells: AgendaMonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dateKey = addCashDays(start, i);
    cells.push({
      dateKey,
      inMonth: dateKey.startsWith(prefix),
      isToday: dateKey === today
    });
  }
  return cells;
}

export function tasksOnDate(tasks: AgendaTask[], dateKey: string): AgendaTask[] {
  return (tasks || [])
    .filter((task) => task.dateKey === dateKey)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return String(a.alarmTime || '99:99').localeCompare(String(b.alarmTime || '99:99'))
        || a.createdAt.localeCompare(b.createdAt);
    });
}

export function openTaskCountOnDate(tasks: AgendaTask[], dateKey: string): number {
  return (tasks || []).filter((task) => task.dateKey === dateKey && !task.done).length;
}

export function upcomingOpenTasks(tasks: AgendaTask[], today = todayCashDateKey(), limit = 6): AgendaTask[] {
  return (tasks || [])
    .filter((task) => !task.done && task.dateKey >= today)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || String(a.alarmTime || '').localeCompare(String(b.alarmTime || '')))
    .slice(0, limit);
}

export function isAgendaTaskDue(task: AgendaTask, clock: HermosilloClock = getHermosilloClock()): boolean {
  if (task.done) return false;
  return task.dateKey <= clock.dateKey;
}

export function isAgendaAlarmReached(task: AgendaTask, clock: HermosilloClock = getHermosilloClock()): boolean {
  if (task.done) return false;
  if (task.dateKey < clock.dateKey) return true;
  if (task.dateKey > clock.dateKey) return false;
  const time = normalizeAlarmTime(task.alarmTime);
  if (!time) return false;
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3, 5));
  return clock.hour > hour || (clock.hour === hour && clock.minute >= minute);
}

export function agendaNotificationId(taskId: string): string {
  return `notif-agenda-${taskId}`;
}

export function buildAgendaTaskNotification(
  task: AgendaTask,
  clock: HermosilloClock = getHermosilloClock()
): Omit<AppNotification, 'id' | 'createdAt' | 'read'> {
  const overdue = task.dateKey < clock.dateKey;
  const alarmReached = isAgendaAlarmReached(task, clock);
  const when = task.alarmTime ? ` a las ${task.alarmTime}` : '';
  const dayLabel = overdue ? formatCashDateLabel(task.dateKey) : 'hoy';
  return {
    urgency: overdue || alarmReached ? 'urgente' : 'normal',
    title: overdue ? `Tarea atrasada · ${task.title}` : `Agenda de hoy · ${task.title}`,
    message: overdue
      ? `${task.title} quedó pendiente del ${dayLabel}${when}. Ábrala en el calendario, al lado de avisos, y márquela cuando esté hecha.`
      : `${task.title} toca ${dayLabel}${when}. Ábrala en el calendario, al lado de avisos.`,
    authorName: task.authorName || 'Agenda',
    branchId: 'all',
    targetOperatorId: 'all',
    type: 'agenda_tarea',
    agendaTaskId: task.id,
    agendaDateKey: task.dateKey
  };
}

export function agendaNotificationPlan(
  tasks: AgendaTask[],
  existing: AppNotification[],
  clock: HermosilloClock = getHermosilloClock()
): {
  add: Array<Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id: string }>;
  dismissIds: string[];
} {
  const related = (existing || []).filter((n) => n.type === 'agenda_tarea');
  const byTaskId = new Map<string, AppNotification>();
  for (const n of related) {
    const key = n.agendaTaskId || (n.id.startsWith('notif-agenda-') ? n.id.slice('notif-agenda-'.length) : '');
    if (key) byTaskId.set(key, n);
  }

  const add: Array<Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id: string }> = [];
  const dismissIds: string[] = [];
  const seen = new Set<string>();

  for (const task of tasks || []) {
    seen.add(task.id);
    const existingNote = byTaskId.get(task.id);
    if (!isAgendaTaskDue(task, clock)) {
      if (existingNote) dismissIds.push(existingNote.id);
      continue;
    }
    if (existingNote) continue;
    add.push({
      ...buildAgendaTaskNotification(task, clock),
      id: agendaNotificationId(task.id)
    });
  }

  for (const n of related) {
    const taskId = n.agendaTaskId || n.id.replace(/^notif-agenda-/, '');
    if (!seen.has(taskId) && !dismissIds.includes(n.id)) dismissIds.push(n.id);
  }

  return { add, dismissIds };
}

export function notificationIsSticky(n: Pick<AppNotification, 'type'>): boolean {
  return n.type === 'gasto_reparacion' || n.type === 'agenda_tarea';
}
