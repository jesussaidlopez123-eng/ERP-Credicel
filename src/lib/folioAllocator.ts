/**
 * Folios de ticket únicos, con o sin internet.
 *
 * En línea el equipo aparta un bloque de folios del contador de la nube
 * (por ejemplo del 41 al 65) y va gastando ese bloque. Así dos cajas nunca
 * repiten número, aunque una se quede sin señal a media venta.
 *
 * Si el equipo nunca alcanzó a apartar bloque, se emite un folio provisional
 * con la clave de esa caja. Sigue siendo único y se distingue a simple vista.
 */

import { branchFolioCode, normalizeBranchId } from '../data/initialBranches';
import { formatTicketFolio } from './ids';
import { getMeta, setMeta } from './localDb';
import { hermosilloDateKey } from './shiftHours';
import { trustedDateKey } from './clockGuard';
import { getDeviceCode } from './deviceId';
import { leaseFolioBlock } from './firebase';

export const FOLIO_BLOCK_SIZE = 25;
const REFILL_THRESHOLD = 5;

export type FolioLeaseProvider = (
  branchId: string,
  dateKey: string,
  size: number
) => Promise<{ start: number; end: number }>;

let leaseProvider: FolioLeaseProvider = leaseFolioBlock;

/** Permite sustituir el contador de la nube al simular un día de operación. */
export function setFolioLeaseProvider(fn: FolioLeaseProvider): void {
  leaseProvider = fn;
}

interface FolioLease {
  branchId: string;
  dateKey: string;
  next: number;
  end: number;
}

interface ProvisionalCounter {
  dateKey: string;
  seq: number;
}

function leaseKey(branchId: string, dateKey: string): string {
  return `folio_lease_${branchFolioCode(branchId)}_${dateKey}`;
}

function provisionalKey(branchId: string, dateKey: string): string {
  return `folio_provisional_${branchFolioCode(branchId)}_${dateKey}`;
}

async function readLease(branchId: string, dateKey: string): Promise<FolioLease | null> {
  const lease = await getMeta<FolioLease>(leaseKey(branchId, dateKey));
  if (!lease || lease.dateKey !== dateKey) return null;
  if (typeof lease.next !== 'number' || typeof lease.end !== 'number') return null;
  return lease;
}

/**
 * Dos llamadas al mismo tiempo (montaje doble, dos pestañas) apartaban dos
 * bloques y el contador del día saltaba de 25 en 25 sin vender nada.
 */
const inflightLeases = new Map<string, Promise<FolioLease | null>>();

/**
 * Sin internet, pedir bloque falla. Volver a intentarlo en cada venta metía la
 * espera de red en el cobro; con esto se emite folio provisional de inmediato y
 * se reintenta más tarde.
 */
const LEASE_RETRY_COOLDOWN_MS = 60_000;
const leaseCooldown = new Map<string, number>();

async function acquireLease(branchId: string, dateKey: string): Promise<FolioLease | null> {
  const key = leaseKey(branchId, dateKey);
  const pending = inflightLeases.get(key);
  if (pending) return pending;

  const cooldownUntil = leaseCooldown.get(key) || 0;
  if (Date.now() < cooldownUntil) return null;

  const work = (async (): Promise<FolioLease | null> => {
    // Otra llamada pudo dejar bloque disponible mientras esperábamos.
    const existing = await readLease(branchId, dateKey);
    if (existing && existing.next <= existing.end) return existing;
    try {
      const block = await leaseProvider(branchId, dateKey, FOLIO_BLOCK_SIZE);
      const lease: FolioLease = { branchId, dateKey, next: block.start, end: block.end };
      await setMeta(key, lease);
      leaseCooldown.delete(key);
      return lease;
    } catch (err) {
      leaseCooldown.set(key, Date.now() + LEASE_RETRY_COOLDOWN_MS);
      console.warn(
        '[Folios] Sin bloque de folios; se emiten folios provisionales por un minuto.',
        err instanceof Error ? err.message : err
      );
      return null;
    }
  })().finally(() => {
    if (inflightLeases.get(key) === work) inflightLeases.delete(key);
  });

  inflightLeases.set(key, work);
  return work;
}

/** El botón "Subir ahora" y el evento de reconexión no deben esperar el minuto. */
export function clearFolioLeaseCooldown(): void {
  leaseCooldown.clear();
}

async function nextProvisional(branchId: string, dateKey: string): Promise<string> {
  const key = provisionalKey(branchId, dateKey);
  const current = await getMeta<ProvisionalCounter>(key);
  const seq = current && current.dateKey === dateKey ? current.seq + 1 : 1;
  await setMeta<ProvisionalCounter>(key, { dateKey, seq });
  const code = branchFolioCode(branchId);
  const dd = dateKey.slice(8, 10);
  const mm = dateKey.slice(5, 7);
  return `${code}-${dd}${mm}-${getDeviceCode()}${String(seq).padStart(2, '0')}`;
}

/**
 * Entrega el siguiente folio de la sucursal. Nunca falla ni bloquea el cobro.
 *
 * El folio se numera con el día del ticket, no con el del reloj al momento de
 * pedirlo, para que folio y corte hablen siempre del mismo día.
 */
export async function allocateFolio(branchId: string, ticketIso?: string): Promise<string> {
  const normBId = normalizeBranchId(branchId);
  const dateKey = hermosilloDateKey(ticketIso) || trustedDateKey();

  let lease = await readLease(normBId, dateKey);
  if (!lease || lease.next > lease.end) {
    lease = await acquireLease(normBId, dateKey);
  }

  if (lease && lease.next <= lease.end) {
    const seq = lease.next;
    await setMeta<FolioLease>(leaseKey(normBId, dateKey), { ...lease, next: seq + 1 });
    void maybeRefillLease(normBId, dateKey);
    return formatTicketFolio(normBId, dateKey, seq);
  }

  return nextProvisional(normBId, dateKey);
}

/** Pide el siguiente bloque antes de quedarse sin folios. */
async function maybeRefillLease(branchId: string, dateKey: string): Promise<void> {
  const lease = await readLease(branchId, dateKey);
  if (!lease) return;
  const left = lease.end - lease.next + 1;
  if (left > REFILL_THRESHOLD) return;
  const key = leaseKey(branchId, dateKey);
  if (Date.now() < (leaseCooldown.get(key) || 0)) return;
  try {
    const block = await leaseProvider(branchId, dateKey, FOLIO_BLOCK_SIZE);
    // Solo extendemos si el bloque nuevo continúa después del actual.
    if (block.start === lease.end + 1) {
      await setMeta<FolioLease>(leaseKey(branchId, dateKey), { ...lease, end: block.end });
    } else {
      await setMeta<FolioLease>(leaseKey(branchId, dateKey), {
        branchId,
        dateKey,
        next: block.start,
        end: block.end
      });
    }
  } catch {
    leaseCooldown.set(key, Date.now() + LEASE_RETRY_COOLDOWN_MS);
  }
}

/** Aparta folios al abrir la caja para poder vender aunque luego se caiga la red. */
export async function warmUpFolios(branchId: string, atIso?: string): Promise<void> {
  const normBId = normalizeBranchId(branchId);
  const dateKey = hermosilloDateKey(atIso) || trustedDateKey();
  const lease = await readLease(normBId, dateKey);
  if (lease && lease.next <= lease.end) return;
  await acquireLease(normBId, dateKey);
}

export async function folioLeaseRemaining(branchId: string): Promise<number> {
  const lease = await readLease(normalizeBranchId(branchId), trustedDateKey());
  if (!lease) return 0;
  return Math.max(0, lease.end - lease.next + 1);
}

/**
 * Folio de taller. No pasa por la nube: la recepción de un equipo no puede
 * esperar a la red. La clave de la caja lo hace único entre sucursales.
 */
export async function allocateRepairFolio(branchId: string, atIso?: string): Promise<string> {
  const normBId = normalizeBranchId(branchId);
  const dateKey = hermosilloDateKey(atIso) || trustedDateKey();
  const key = `repair_folio_${branchFolioCode(normBId)}_${dateKey}`;
  const current = await getMeta<ProvisionalCounter>(key);
  const seq = current && current.dateKey === dateKey ? current.seq + 1 : 1;
  await setMeta<ProvisionalCounter>(key, { dateKey, seq });
  const dd = dateKey.slice(8, 10);
  const mm = dateKey.slice(5, 7);
  return `REP-${dd}${mm}-${getDeviceCode()}${String(seq).padStart(2, '0')}`;
}

export function isProvisionalFolio(folio: string | undefined): boolean {
  if (!folio) return false;
  const parts = folio.split('-');
  if (parts.length !== 3) return false;
  return !/^\d+$/.test(parts[2]);
}
