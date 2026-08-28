/**
 * Cola de mensajes del punto de venta ("outbox").
 *
 * Toda escritura importante (venta, gasto, corte, movimiento de inventario)
 * se guarda primero aquí, en el equipo. Un trabajador la va enviando a la nube
 * en orden y con reintentos. Nada se borra hasta que la nube confirma.
 *
 * Reglas:
 *  - Orden estricto por sucursal: los tickets suben antes que su corte.
 *  - Reintento con espera creciente; un error no descarta el registro.
 *  - Reenviar dos veces es inofensivo: cada documento va con su id fijo.
 */

import {
  OutboxRow,
  deleteOutboxRow,
  getMeta,
  listOutboxRows,
  putOutboxRow,
  setMeta
} from './localDb';
import { trustedIso, trustedNow } from './clockGuard';
import { getDeviceId } from './deviceId';

const SEQ_META_KEY = 'outbox_seq';
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const DONE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** A partir de aquí avisamos al operador, pero seguimos reintentando. */
export const STUCK_ATTEMPTS = 5;

export type OutboxExecutor = (payload: unknown, row: OutboxRow) => Promise<void>;

const executors = new Map<string, OutboxExecutor>();

export function registerOutboxExecutor(kind: string, fn: OutboxExecutor): void {
  executors.set(kind, fn);
}

export interface OutboxStatus {
  pending: number;
  stuck: number;
  oldestPendingIso: string | null;
  lastError: string | null;
  lastSyncIso: string | null;
  draining: boolean;
}

let cachedStatus: OutboxStatus = {
  pending: 0,
  stuck: 0,
  oldestPendingIso: null,
  lastError: null,
  lastSyncIso: null,
  draining: false
};

const listeners = new Set<(status: OutboxStatus) => void>();

export function subscribeOutboxStatus(listener: (status: OutboxStatus) => void): () => void {
  listeners.add(listener);
  listener(cachedStatus);
  return () => {
    listeners.delete(listener);
  };
}

function emit(patch: Partial<OutboxStatus>): void {
  cachedStatus = { ...cachedStatus, ...patch };
  listeners.forEach((fn) => {
    try {
      fn(cachedStatus);
    } catch {
      // un listener roto no debe tumbar la cola
    }
  });
}

export function getOutboxStatus(): OutboxStatus {
  return cachedStatus;
}

async function nextSeq(): Promise<number> {
  const current = (await getMeta<number>(SEQ_META_KEY)) || 0;
  const next = current + 1;
  await setMeta(SEQ_META_KEY, next);
  return next;
}

export interface EnqueueParams {
  kind: string;
  groupKey: string;
  payload: unknown;
  /** Texto corto para que el operador entienda qué falta subir. */
  label?: string;
  /** Id fijo: reencolar el mismo registro lo reemplaza en vez de duplicarlo. */
  id?: string;
}

export async function enqueue(params: EnqueueParams): Promise<OutboxRow> {
  const seq = await nextSeq();
  const row: OutboxRow = {
    id: params.id || `OBX-${seq}-${getDeviceId().slice(-6)}`,
    seq,
    groupKey: params.groupKey || 'global',
    kind: params.kind,
    payload: params.payload,
    createdAt: trustedIso(),
    attempts: 0,
    nextAttemptAt: 0,
    state: 'pending',
    label: params.label
  };
  await putOutboxRow(row);
  await refreshStatus();
  return row;
}

function backoffMs(attempts: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 2000 * Math.pow(2, Math.max(0, attempts - 1)));
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

export async function refreshStatus(): Promise<OutboxStatus> {
  const rows = await listOutboxRows();
  const pendingRows = rows.filter((r) => r.state === 'pending');
  const oldest = pendingRows
    .slice()
    .sort((a, b) => a.seq - b.seq)[0];
  const failing = pendingRows.filter((r) => r.attempts >= STUCK_ATTEMPTS);
  emit({
    pending: pendingRows.length,
    stuck: failing.length,
    oldestPendingIso: oldest?.createdAt || null,
    lastError: failing[0]?.lastError || null
  });
  return cachedStatus;
}

let draining = false;
let drainQueuedAgain = false;

/**
 * Envía lo pendiente. Devuelve cuántos registros quedaron confirmados.
 * Dentro de una sucursal respeta el orden: si uno falla, los siguientes de esa
 * misma sucursal esperan para no adelantar un corte a sus tickets.
 */
export async function drainOutbox(): Promise<number> {
  if (draining) {
    drainQueuedAgain = true;
    return 0;
  }
  draining = true;
  emit({ draining: true });

  let confirmed = 0;
  try {
    const rows = await listOutboxRows();
    const now = trustedNow().getTime();

    await pruneDoneRows(rows, now);

    const pending = rows.filter((r) => r.state === 'pending').sort((a, b) => a.seq - b.seq);
    const byGroup = new Map<string, OutboxRow[]>();
    pending.forEach((row) => {
      const list = byGroup.get(row.groupKey) || [];
      list.push(row);
      byGroup.set(row.groupKey, list);
    });

    for (const [, groupRows] of byGroup) {
      for (const row of groupRows) {
        if (row.nextAttemptAt > now) break;

        const executor = executors.get(row.kind);
        if (!executor) {
          console.warn(`[Outbox] Sin ejecutor para "${row.kind}"; se conserva el registro.`);
          break;
        }

        try {
          await executor(row.payload, row);
          await putOutboxRow({ ...row, state: 'done', doneAt: trustedIso(), lastError: undefined });
          confirmed += 1;
          emit({ lastSyncIso: trustedIso() });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const attempts = row.attempts + 1;
          await putOutboxRow({
            ...row,
            attempts,
            nextAttemptAt: trustedNow().getTime() + backoffMs(attempts),
            lastError: message,
            lastErrorAt: trustedIso()
          });
          console.warn(`[Outbox] "${row.kind}" no subió (intento ${attempts}):`, message);
          break;
        }
      }
    }
  } finally {
    draining = false;
    emit({ draining: false });
    await refreshStatus();
  }

  if (drainQueuedAgain) {
    drainQueuedAgain = false;
    return confirmed + (await drainOutbox());
  }
  return confirmed;
}

async function pruneDoneRows(rows: OutboxRow[], nowMs: number): Promise<void> {
  const stale = rows.filter(
    (r) => r.state === 'done' && r.doneAt && nowMs - new Date(r.doneAt).getTime() > DONE_RETENTION_MS
  );
  for (const row of stale) {
    await deleteOutboxRow(row.id);
  }
}

export async function listPendingOutbox(): Promise<OutboxRow[]> {
  const rows = await listOutboxRows();
  return rows.filter((r) => r.state === 'pending').sort((a, b) => a.seq - b.seq);
}

/** Reintento inmediato pedido por el operador. */
export async function retryPendingNow(): Promise<number> {
  const rows = await listPendingOutbox();
  for (const row of rows) {
    if (row.nextAttemptAt > 0) {
      await putOutboxRow({ ...row, nextAttemptAt: 0 });
    }
  }
  return drainOutbox();
}

let workerStarted = false;

export function startOutboxWorker(intervalMs = 15000): () => void {
  if (workerStarted) return () => {};
  workerStarted = true;

  const tick = () => {
    void drainOutbox();
  };

  const interval = window.setInterval(tick, intervalMs);
  const onOnline = () => tick();
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void refreshStatus().then(tick);

  return () => {
    workerStarted = false;
    window.clearInterval(interval);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
