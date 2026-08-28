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
import { trustedDateKey } from './clockGuard';
import { getDeviceCode } from './deviceId';
import { leaseFolioBlock } from './firebase';

export const FOLIO_BLOCK_SIZE = 25;
const REFILL_THRESHOLD = 5;

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

async function acquireLease(branchId: string, dateKey: string): Promise<FolioLease | null> {
  try {
    const block = await leaseFolioBlock(branchId, dateKey, FOLIO_BLOCK_SIZE);
    const lease: FolioLease = { branchId, dateKey, next: block.start, end: block.end };
    await setMeta(leaseKey(branchId, dateKey), lease);
    return lease;
  } catch (err) {
    console.warn('[Folios] No se pudo apartar bloque de folios (se sigue sin internet):', err);
    return null;
  }
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
 */
export async function allocateFolio(branchId: string): Promise<string> {
  const normBId = normalizeBranchId(branchId);
  const dateKey = trustedDateKey();

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
  try {
    const block = await leaseFolioBlock(branchId, dateKey, FOLIO_BLOCK_SIZE);
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
    // sin conexión: seguimos con lo que queda del bloque
  }
}

/** Aparta folios al abrir la caja para poder vender aunque luego se caiga la red. */
export async function warmUpFolios(branchId: string): Promise<void> {
  const normBId = normalizeBranchId(branchId);
  const dateKey = trustedDateKey();
  const lease = await readLease(normBId, dateKey);
  if (lease && lease.next <= lease.end) return;
  await acquireLease(normBId, dateKey);
}

export async function folioLeaseRemaining(branchId: string): Promise<number> {
  const lease = await readLease(normalizeBranchId(branchId), trustedDateKey());
  if (!lease) return 0;
  return Math.max(0, lease.end - lease.next + 1);
}

export function isProvisionalFolio(folio: string | undefined): boolean {
  if (!folio) return false;
  const parts = folio.split('-');
  if (parts.length !== 3) return false;
  return !/^\d+$/.test(parts[2]);
}
