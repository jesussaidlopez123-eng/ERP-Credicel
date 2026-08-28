import { CorteXRecord, Expense, Product, SaleTicket, SesionCaja } from '../types';

const PREFIX = 'erp_cloud_cache_v1';
const PENDING_PREFIX = 'erp_pending_corte_v1';
const SESSION_PREFIX = 'erp_last_session_v1';

export type PendingCortePayload = {
  branchId: string;
  branchName: string;
  operatorUid: string;
  operatorName: string;
  dateKey: string;
  efectivoContado: number;
  fondoDejado: number;
  notas: string;
  fechaCierreIso: string;
  preferredSessionId?: string;
  tickets: SaleTicket[];
  expenses: Expense[];
  savedAt: string;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode / quota
  }
}

export function loadCachedList<T>(name: string): T[] {
  const parsed = readJson<T[]>(`${PREFIX}_${name}`);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveCachedList<T>(name: string, rows: T[]): void {
  if (!Array.isArray(rows)) return;
  writeJson(`${PREFIX}_${name}`, rows);
}

export function loadCachedProducts(fallback: Product[]): Product[] {
  const cached = loadCachedList<Product>('products');
  if (cached.length === 0) return fallback;
  const byId = new Map(cached.map((p) => [p.id, p]));
  fallback.forEach((p) => {
    if (!byId.has(p.id)) byId.set(p.id, p);
  });
  return Array.from(byId.values());
}

export function rememberLastSession(branchId: string, session: SesionCaja | null): void {
  if (!branchId) return;
  const key = `${SESSION_PREFIX}_${branchId}`;
  if (!session?.id) return;
  writeJson(key, { id: session.id, fecha_apertura: session.fecha_apertura, estado: session.estado });
}

export function loadLastSessionId(branchId: string): string {
  if (!branchId) return '';
  const parsed = readJson<{ id?: string }>(`${SESSION_PREFIX}_${branchId}`);
  return String(parsed?.id || '');
}

export function savePendingCorte(payload: PendingCortePayload): void {
  if (!payload.branchId || !payload.dateKey) return;
  writeJson(`${PENDING_PREFIX}_${payload.branchId}_${payload.dateKey}`, payload);
}

export function removePendingCorte(branchId: string, dateKey: string): void {
  try {
    localStorage.removeItem(`${PENDING_PREFIX}_${branchId}_${dateKey}`);
  } catch {
    // ignore
  }
}

export function loadAllPendingCortes(): PendingCortePayload[] {
  const rows: PendingCortePayload[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PENDING_PREFIX)) continue;
      const parsed = readJson<PendingCortePayload>(key);
      if (parsed?.branchId && parsed.dateKey) rows.push(parsed);
    }
  } catch {
    // ignore
  }
  return rows;
}

export function keepIfCloudEmpty<T>(cloud: T[] | undefined, previous: T[]): T[] {
  if (!cloud || cloud.length === 0) return previous;
  return cloud;
}
