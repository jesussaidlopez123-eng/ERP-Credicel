/**
 * Almacén local durable del punto de venta (IndexedDB).
 *
 * Aquí queda la venta en el momento del cobro, aunque no haya internet.
 * IndexedDB aguanta mucho más que localStorage y sobrevive a recargas y
 * cierres del navegador. Si el equipo no lo soporta, cae a localStorage
 * para no dejar la caja sin respaldo.
 */

const DB_NAME = 'credicel_pos';
const DB_VERSION = 1;

export const RECORDS_STORE = 'records';
export const OUTBOX_STORE = 'outbox';
export const META_STORE = 'meta';

export type RecordKind =
  | 'sale'
  | 'expense'
  | 'corte'
  | 'session'
  | 'movement'
  | 'repair'
  | 'backup';

export interface LocalRecord<T = unknown> {
  pk: string;
  kind: RecordKind;
  id: string;
  branchId: string;
  dateKey: string;
  data: T;
  updatedAt: string;
}

export interface OutboxRow {
  id: string;
  seq: number;
  groupKey: string;
  kind: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  lastErrorAt?: string;
  state: 'pending' | 'done';
  doneAt?: string;
  label?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let indexedDbBroken = false;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        const store = db.createObjectStore(RECORDS_STORE, { keyPath: 'pk' });
        store.createIndex('kind', 'kind', { unique: false });
        store.createIndex('kind_branch_date', ['kind', 'branchId', 'dateKey'], { unique: false });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
        store.createIndex('seq', 'seq', { unique: false });
        store.createIndex('state', 'state', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la base local'));
    request.onblocked = () => reject(new Error('Base local bloqueada por otra pestaña'));
  }).catch((err) => {
    indexedDbBroken = true;
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

export function localDbUsesFallback(): boolean {
  return indexedDbBroken;
}

// ----------------------------------------------------
// Respaldo en localStorage cuando IndexedDB no existe
// ----------------------------------------------------
const FALLBACK_PREFIX = 'erp_localdb_v1';

function fallbackKey(store: string): string {
  return `${FALLBACK_PREFIX}_${store}`;
}

function fallbackReadAll<T>(store: string): T[] {
  try {
    const raw = localStorage.getItem(fallbackKey(store));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function fallbackWriteAll<T>(store: string, rows: T[]): void {
  try {
    localStorage.setItem(fallbackKey(store), JSON.stringify(rows));
  } catch {
    // sin espacio: no podemos hacer más
  }
}

function fallbackPut<T extends Record<string, unknown>>(store: string, keyProp: string, row: T): void {
  const rows = fallbackReadAll<T>(store);
  const idx = rows.findIndex((r) => r[keyProp] === row[keyProp]);
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  fallbackWriteAll(store, rows);
}

function fallbackDelete(store: string, keyProp: string, key: string): void {
  const rows = fallbackReadAll<Record<string, unknown>>(store);
  fallbackWriteAll(
    store,
    rows.filter((r) => r[keyProp] !== key)
  );
}

// ----------------------------------------------------
// API
// ----------------------------------------------------
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest | IDBRequest[]
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result: unknown;
    const requests = work(store);
    const list = Array.isArray(requests) ? requests : [requests];
    list.forEach((req) => {
      req.onsuccess = () => {
        result = req.result;
      };
    });
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error || new Error('Error en la base local'));
    tx.onabort = () => reject(tx.error || new Error('Transacción local cancelada'));
  });
}

export function recordPk(kind: RecordKind, id: string): string {
  return `${kind}:${id}`;
}

export async function putRecord<T>(row: Omit<LocalRecord<T>, 'pk'>): Promise<void> {
  const full: LocalRecord<T> = { ...row, pk: recordPk(row.kind, row.id) };
  if (indexedDbBroken) {
    fallbackPut(RECORDS_STORE, 'pk', full as unknown as Record<string, unknown>);
    return;
  }
  try {
    await withStore<void>(RECORDS_STORE, 'readwrite', (store) => store.put(full));
  } catch {
    indexedDbBroken = true;
    fallbackPut(RECORDS_STORE, 'pk', full as unknown as Record<string, unknown>);
  }
}

export async function putRecords<T>(rows: Omit<LocalRecord<T>, 'pk'>[]): Promise<void> {
  for (const row of rows) {
    await putRecord(row);
  }
}

export async function getRecord<T>(kind: RecordKind, id: string): Promise<LocalRecord<T> | null> {
  if (indexedDbBroken) {
    const rows = fallbackReadAll<LocalRecord<T>>(RECORDS_STORE);
    return rows.find((r) => r.pk === recordPk(kind, id)) || null;
  }
  try {
    const row = await withStore<LocalRecord<T> | undefined>(RECORDS_STORE, 'readonly', (store) =>
      store.get(recordPk(kind, id))
    );
    return row || null;
  } catch {
    indexedDbBroken = true;
    return null;
  }
}

export async function listRecords<T>(kind: RecordKind): Promise<LocalRecord<T>[]> {
  if (indexedDbBroken) {
    return fallbackReadAll<LocalRecord<T>>(RECORDS_STORE).filter((r) => r.kind === kind);
  }
  try {
    const rows = await withStore<LocalRecord<T>[]>(RECORDS_STORE, 'readonly', (store) =>
      store.index('kind').getAll(kind)
    );
    return rows || [];
  } catch {
    indexedDbBroken = true;
    return fallbackReadAll<LocalRecord<T>>(RECORDS_STORE).filter((r) => r.kind === kind);
  }
}

export async function listRecordsForDay<T>(
  kind: RecordKind,
  branchId: string,
  dateKey: string
): Promise<LocalRecord<T>[]> {
  const all = await listRecords<T>(kind);
  return all.filter((r) => r.branchId === branchId && r.dateKey === dateKey);
}

export async function deleteRecord(kind: RecordKind, id: string): Promise<void> {
  if (indexedDbBroken) {
    fallbackDelete(RECORDS_STORE, 'pk', recordPk(kind, id));
    return;
  }
  try {
    await withStore<void>(RECORDS_STORE, 'readwrite', (store) => store.delete(recordPk(kind, id)));
  } catch {
    indexedDbBroken = true;
    fallbackDelete(RECORDS_STORE, 'pk', recordPk(kind, id));
  }
}

// ---- outbox ----

export async function putOutboxRow(row: OutboxRow): Promise<void> {
  if (indexedDbBroken) {
    fallbackPut(OUTBOX_STORE, 'id', row as unknown as Record<string, unknown>);
    return;
  }
  try {
    await withStore<void>(OUTBOX_STORE, 'readwrite', (store) => store.put(row));
  } catch {
    indexedDbBroken = true;
    fallbackPut(OUTBOX_STORE, 'id', row as unknown as Record<string, unknown>);
  }
}

export async function listOutboxRows(): Promise<OutboxRow[]> {
  if (indexedDbBroken) {
    return fallbackReadAll<OutboxRow>(OUTBOX_STORE);
  }
  try {
    const rows = await withStore<OutboxRow[]>(OUTBOX_STORE, 'readonly', (store) => store.getAll());
    return rows || [];
  } catch {
    indexedDbBroken = true;
    return fallbackReadAll<OutboxRow>(OUTBOX_STORE);
  }
}

export async function deleteOutboxRow(id: string): Promise<void> {
  if (indexedDbBroken) {
    fallbackDelete(OUTBOX_STORE, 'id', id);
    return;
  }
  try {
    await withStore<void>(OUTBOX_STORE, 'readwrite', (store) => store.delete(id));
  } catch {
    indexedDbBroken = true;
    fallbackDelete(OUTBOX_STORE, 'id', id);
  }
}

// ---- meta ----

export async function getMeta<T>(key: string): Promise<T | null> {
  if (indexedDbBroken) {
    const rows = fallbackReadAll<{ key: string; value: T }>(META_STORE);
    return rows.find((r) => r.key === key)?.value ?? null;
  }
  try {
    const row = await withStore<{ key: string; value: T } | undefined>(META_STORE, 'readonly', (store) =>
      store.get(key)
    );
    return row?.value ?? null;
  } catch {
    indexedDbBroken = true;
    const rows = fallbackReadAll<{ key: string; value: T }>(META_STORE);
    return rows.find((r) => r.key === key)?.value ?? null;
  }
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const row = { key, value };
  if (indexedDbBroken) {
    fallbackPut(META_STORE, 'key', row as unknown as Record<string, unknown>);
    return;
  }
  try {
    await withStore<void>(META_STORE, 'readwrite', (store) => store.put(row));
  } catch {
    indexedDbBroken = true;
    fallbackPut(META_STORE, 'key', row as unknown as Record<string, unknown>);
  }
}
