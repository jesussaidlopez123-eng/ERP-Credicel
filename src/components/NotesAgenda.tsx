import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { AgendaTask, Operator } from '../types';
import { formatCashDateLabel, todayCashDateKey } from '../lib/dateUtils';
import { trustedIso } from '../lib/clockGuard';
import {
  WEEKDAY_LABELS,
  buildMonthCells,
  emptyAgendaTask,
  formatMonthTitle,
  monthFromDateKey,
  normalizeAlarmTime,
  openTaskCountOnDate,
  shiftMonth,
  tasksOnDate,
  upcomingOpenTasks
} from '../lib/agenda';

interface NotesAgendaProps {
  tasks: AgendaTask[];
  currentOperator: Operator;
  onSaveTask: (task: AgendaTask) => void | Promise<void>;
  onDeleteTask: (task: AgendaTask) => void | Promise<void>;
  focusDateKey?: string | null;
  onFocusConsumed?: () => void;
  variant?: 'page' | 'popover';
  isOpen?: boolean;
  onClose?: () => void;
}

export default function NotesAgenda({
  tasks,
  currentOperator,
  onSaveTask,
  onDeleteTask,
  focusDateKey,
  onFocusConsumed,
  variant = 'page',
  isOpen = true,
  onClose
}: NotesAgendaProps) {
  const today = todayCashDateKey();
  const initial = monthFromDateKey(focusDateKey || today);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(focusDateKey || null);

  useEffect(() => {
    if (!focusDateKey) return;
    const next = monthFromDateKey(focusDateKey);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDate(focusDateKey);
    onFocusConsumed?.();
  }, [focusDateKey, onFocusConsumed]);

  const cells = useMemo(() => buildMonthCells(year, month, today), [year, month, today]);
  const upcoming = useMemo(() => upcomingOpenTasks(tasks, today, 5), [tasks, today]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.done) continue;
      map.set(task.dateKey, (map.get(task.dateKey) || 0) + 1);
    }
    return map;
  }, [tasks]);

  const goMonth = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  };

  if (variant === 'popover' && !isOpen) return null;

  const compact = variant === 'popover';
  const upcomingLimit = compact ? upcoming.slice(0, 3) : upcoming;

  const calendar = (
    <div className={compact ? 'p-3 space-y-3' : 'space-y-4'}>
      <div className={`flex items-center justify-between gap-2 ${compact ? '' : 'flex-col sm:flex-row'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {compact ? (
            <h2 className="text-sm font-black text-slate-900">Agenda</h2>
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Agenda</h2>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="min-w-[8.5rem] text-center text-xs font-black text-slate-900">
            {formatMonthTitle(year, month)}
          </p>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = monthFromDateKey(today);
              setYear(now.year);
              setMonth(now.month);
              setSelectedDate(today);
            }}
            className="ml-0.5 px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold cursor-pointer"
          >
            Hoy
          </button>
          {compact && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              aria-label="Cerrar agenda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-black uppercase tracking-wide text-slate-400 py-0.5">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const open = counts.get(cell.dateKey) || 0;
          const selected = selectedDate === cell.dateKey;
          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => setSelectedDate(cell.dateKey)}
              className={`relative ${compact ? 'min-h-[2.35rem]' : 'min-h-[3.15rem] sm:min-h-[3.6rem]'} rounded-lg border text-sm font-bold cursor-pointer transition-colors ${
                selected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-950'
                  : cell.isToday
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : cell.inMonth
                  ? 'border-slate-200 bg-white text-slate-900 hover:border-indigo-300 hover:bg-indigo-50/50'
                  : 'border-transparent bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              <span className={`absolute left-1/2 -translate-x-1/2 ${compact ? 'top-1 text-[12px]' : 'top-1.5 text-[13px]'}`}>
                {Number(cell.dateKey.slice(8, 10))}
              </span>
              {open > 0 && (
                <span
                  className={`absolute left-1/2 -translate-x-1/2 ${compact ? 'bottom-0.5' : 'bottom-1.5'} min-w-[0.95rem] h-3.5 px-1 rounded-full text-[8px] font-black leading-[14px] ${
                    cell.isToday && !selected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {open}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {upcomingLimit.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">Próximos</p>
          <ul className="space-y-1">
            {upcomingLimit.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => {
                    const next = monthFromDateKey(task.dateKey);
                    setYear(next.year);
                    setMonth(next.month);
                    setSelectedDate(task.dateKey);
                  }}
                  className="w-full text-left text-xs text-slate-700 hover:text-slate-900 cursor-pointer flex items-center justify-between gap-2"
                >
                  <span className="truncate font-semibold">{task.title}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {formatCashDateLabel(task.dateKey)}
                    {task.alarmTime ? ` · ${task.alarmTime}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return compact ? (
    <>
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose} />
      <div className="absolute right-0 top-12 z-50 w-[20.5rem] sm:w-[24rem] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
        {calendar}
      </div>
      {selectedDate && (
        <DayAgendaModal
          dateKey={selectedDate}
          tasks={tasksOnDate(tasks, selectedDate)}
          currentOperator={currentOperator}
          onClose={() => setSelectedDate(null)}
          onSaveTask={onSaveTask}
          onDeleteTask={onDeleteTask}
        />
      )}
    </>
  ) : (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      {calendar}
      {selectedDate && (
        <DayAgendaModal
          dateKey={selectedDate}
          tasks={tasksOnDate(tasks, selectedDate)}
          currentOperator={currentOperator}
          onClose={() => setSelectedDate(null)}
          onSaveTask={onSaveTask}
          onDeleteTask={onDeleteTask}
        />
      )}
    </section>
  );
}

function DayAgendaModal({
  dateKey,
  tasks,
  currentOperator,
  onClose,
  onSaveTask,
  onDeleteTask
}: {
  dateKey: string;
  tasks: AgendaTask[];
  currentOperator: Operator;
  onClose: () => void;
  onSaveTask: (task: AgendaTask) => void | Promise<void>;
  onDeleteTask: (task: AgendaTask) => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [alarmTime, setAlarmTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const openCount = openTaskCountOnDate(tasks, dateKey);
  const today = todayCashDateKey();

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Escribe la tarea o el recordatorio.');
      return;
    }
    const time = normalizeAlarmTime(alarmTime);
    if (alarmTime.trim() && !time) {
      setError('La alarma debe ser una hora válida, por ejemplo 09:30.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSaveTask(
        emptyAgendaTask({
          title: trimmed,
          notes,
          dateKey,
          alarmTime: time,
          authorName: currentOperator.name,
          authorId: currentOperator.id
        })
      );
      setTitle('');
      setAlarmTime('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tarea.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (task: AgendaTask) => {
    await onSaveTask({
      ...task,
      done: !task.done,
      doneAt: !task.done ? trustedIso() : undefined,
      updatedAt: trustedIso()
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-indigo-700">
              {dateKey === today ? 'Hoy' : dateKey < today ? 'Día pasado' : 'Próximo'}
            </p>
            <h3 className="text-base font-black text-slate-900">{formatCashDateLabel(dateKey)}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {openCount === 0
                ? 'Sin tareas pendientes este día.'
                : `${openCount} pendiente${openCount === 1 ? '' : 's'}. Al llegar el día, cada una sale en avisos.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">Aún no hay recordatorios en esta fecha.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    task.done ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => void toggleDone(task)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                        task.done
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-emerald-500 bg-white'
                      }`}
                      title={task.done ? 'Desmarcar' : 'Marcar como lista'}
                      aria-pressed={task.done}
                    >
                      {task.done && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${task.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
                        {task.alarmTime && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                            <Bell className="w-3 h-3" />
                            {task.alarmTime}
                          </span>
                        )}
                        {task.authorName && <span>{task.authorName}</span>}
                      </div>
                      {task.notes && (
                        <p className={`text-[11px] mt-1 ${task.done ? 'text-slate-400' : 'text-slate-600'}`}>{task.notes}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDeleteTask(task)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer shrink-0"
                      title="Quitar tarea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void handleAdd(e)} className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-indigo-800">Agregar tarea</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Qué hay que hacer o recordar…"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              autoFocus
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold text-slate-700">
                Alarma (opcional)
                <input
                  type="time"
                  value={alarmTime}
                  onChange={(e) => setAlarmTime(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </label>
              <label className="block text-[11px] font-bold text-slate-700">
                Nota
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalle corto"
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </label>
            </div>
            {error && (
              <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {saving ? 'Guardando…' : 'Agregar a este día'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
