/**
 * Capa "primero local" del punto de venta.
 *
 * Cobrar guarda la venta en el equipo y la mete a la cola. La nube se actualiza
 * enseguida si hay señal, y si no, cuando vuelva. El mostrador nunca se queda
 * esperando a la red y ninguna venta del día se pierde.
 */

import { CorteXRecord, Expense, InventoryMovement, Product, SaleTicket } from '../types';
import { normalizeBranchId } from '../data/initialBranches';
import { hermosilloDateKey } from './shiftHours';
import { trustedDateKey, trustedIso } from './clockGuard';
import { getDeviceId, getDeviceLabel } from './deviceId';
import { LocalRecord, RecordKind, deleteRecord, getRecord, listRecords, putRecord } from './localDb';
import { drainOutbox, enqueue, listPendingOutbox } from './outbox';
import {
  EXPENSES_COLLECTION,
  GASTOS_COLLECTION,
  PRODUCTS_COLLECTION,
  SALES_COLLECTION,
  VENTAS_COLLECTION,
  cleanForFirestore,
  closeOpenShiftForBranch
} from './firebase';

const INVENTORY_MOVEMENTS_COLLECTION = 'inventoryMovements';

function kickDrain(): void {
  void drainOutbox().catch((err) => console.warn('[Cola] Error al enviar pendientes:', err));
}

function stamp<T extends Record<string, unknown>>(row: T): T & {
  deviceId: string;
  deviceLabel: string;
  savedAtLocal: string;
} {
  return {
    ...row,
    deviceId: getDeviceId(),
    deviceLabel: getDeviceLabel(),
    savedAtLocal: trustedIso()
  };
}

// ----------------------------------------------------
// Ventas
// ----------------------------------------------------

export async function saleAlreadyCommitted(ticketId: string): Promise<boolean> {
  const row = await getRecord<SaleTicket>('sale', ticketId);
  return !!row;
}

/**
 * Deja la venta guardada en el equipo y encolada para la nube.
 * Si esto no lanza error, la venta ya está a salvo aunque no haya internet.
 */
export async function commitSale(ticket: SaleTicket): Promise<SaleTicket> {
  const branchId = normalizeBranchId(ticket.branchId || ticket.sucursal_id || 'b-bodega');
  const enriched: SaleTicket = {
    ...ticket,
    branchId,
    sucursal_id: branchId,
    estado: ticket.estado || 'COMPLETADA'
  };
  const dateKey = hermosilloDateKey(enriched.timestamp) || trustedDateKey();
  const data = cleanForFirestore(stamp(enriched as unknown as Record<string, unknown>));

  await putRecord<SaleTicket>({
    kind: 'sale',
    id: enriched.id,
    branchId,
    dateKey,
    data: enriched,
    updatedAt: trustedIso()
  });

  await enqueue({
    kind: 'docWrite',
    groupKey: branchId,
    id: `sale-${enriched.id}`,
    label: `Venta ${enriched.folio || enriched.id}`,
    payload: {
      writes: [
        { collection: VENTAS_COLLECTION, id: enriched.id, data },
        { collection: SALES_COLLECTION, id: enriched.id, data }
      ]
    }
  });

  kickDrain();
  return enriched;
}

// ----------------------------------------------------
// Gastos
// ----------------------------------------------------

export async function commitExpense(expense: Expense): Promise<Expense> {
  const branchId = normalizeBranchId(expense.branchId || expense.sucursal_id || 'b-bodega');
  const enriched: Expense = { ...expense, branchId, sucursal_id: branchId };
  const dateKey = hermosilloDateKey(enriched.timestamp || enriched.date) || trustedDateKey();
  const data = cleanForFirestore(stamp(enriched as unknown as Record<string, unknown>));

  await putRecord<Expense>({
    kind: 'expense',
    id: enriched.id,
    branchId,
    dateKey,
    data: enriched,
    updatedAt: trustedIso()
  });

  await enqueue({
    kind: 'docWrite',
    groupKey: branchId,
    id: `expense-${enriched.id}`,
    label: `Gasto ${enriched.concept || enriched.id}`,
    payload: {
      writes: [
        { collection: GASTOS_COLLECTION, id: enriched.id, data },
        { collection: EXPENSES_COLLECTION, id: enriched.id, data }
      ]
    }
  });

  kickDrain();
  return enriched;
}

// ----------------------------------------------------
// Corte de caja
// ----------------------------------------------------

export type CorteCloseParams = Parameters<typeof closeOpenShiftForBranch>[0];

/**
 * Guarda el corte en el equipo y lo encola. El cajero puede imprimir y cerrar
 * turno aunque la nube esté caída; el corte sube después, con sus tickets.
 */
export async function commitCorte(
  corteRecord: CorteXRecord,
  closeParams: CorteCloseParams
): Promise<void> {
  const branchId = normalizeBranchId(corteRecord.branchId || closeParams.branchId);
  const dateKey = closeParams.dateKey || hermosilloDateKey(corteRecord.timestamp) || trustedDateKey();

  await putRecord<CorteXRecord>({
    kind: 'corte',
    id: corteRecord.id,
    branchId,
    dateKey,
    data: corteRecord,
    updatedAt: trustedIso()
  });

  await enqueue({
    kind: 'corteClose',
    groupKey: branchId,
    id: `corte-${branchId}-${dateKey}`,
    label: `Corte ${closeParams.branchName || branchId} ${dateKey}`,
    payload: { ...closeParams, branchId, dateKey }
  });

  kickDrain();
}

// ----------------------------------------------------
// Inventario y catálogo
// ----------------------------------------------------

export async function commitProduct(product: Product): Promise<void> {
  await enqueue({
    kind: 'docWrite',
    groupKey: 'catalogo',
    id: `product-${product.id}`,
    label: `Inventario ${product.name || product.id}`,
    payload: {
      writes: [
        {
          collection: PRODUCTS_COLLECTION,
          id: product.id,
          data: cleanForFirestore(product as unknown as Record<string, unknown>)
        }
      ]
    }
  });
  kickDrain();
}

export async function commitInventoryMovements(movements: InventoryMovement[]): Promise<void> {
  if (!movements.length) return;
  await enqueue({
    kind: 'docWrite',
    groupKey: 'kardex',
    id: `movs-${movements[0].id}`,
    label: `Kardex (${movements.length})`,
    payload: {
      writes: movements.map((m) => ({
        collection: INVENTORY_MOVEMENTS_COLLECTION,
        id: m.id,
        data: cleanForFirestore(stamp(m as unknown as Record<string, unknown>))
      }))
    }
  });
  kickDrain();
}

// ----------------------------------------------------
// Lectura local para no depender de la nube en pantalla
// ----------------------------------------------------

function unwrap<T>(rows: LocalRecord<T>[]): T[] {
  return rows.map((r) => r.data);
}

export async function localSales(): Promise<SaleTicket[]> {
  return unwrap(await listRecords<SaleTicket>('sale'));
}

export async function localExpenses(): Promise<Expense[]> {
  return unwrap(await listRecords<Expense>('expense'));
}

export async function localCortes(): Promise<CorteXRecord[]> {
  return unwrap(await listRecords<CorteXRecord>('corte'));
}

/** La nube manda, pero lo que solo existe aquí no se pierde de vista. */
export function mergeWithLocal<T extends { id: string }>(cloud: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  local.forEach((row) => {
    if (row?.id) map.set(row.id, row);
  });
  cloud.forEach((row) => {
    if (row?.id) map.set(row.id, row);
  });
  return Array.from(map.values());
}

export function sortByTimestampDesc<T extends { timestamp?: string }>(rows: T[]): T[] {
  return rows
    .slice()
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
}

/** Un ticket cancelado no debe revivir desde el respaldo del equipo. */
export async function forgetLocalSale(ticketId: string): Promise<void> {
  await deleteRecord('sale', ticketId);
}

const LOCAL_RETENTION_DAYS = 45;

/**
 * Suelta lo viejo del equipo para que la caja no se llene con meses de historia.
 * Nunca borra algo que siga esperando en la cola.
 */
export async function pruneOldLocalRecords(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - LOCAL_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffKey = hermosilloDateKey(cutoff.toISOString());
  if (!cutoffKey) return 0;

  const pending = await listPendingOutbox();
  const protectedIds = new Set<string>();
  pending.forEach((row) => {
    const raw = row.id.split('-').slice(1).join('-');
    if (raw) protectedIds.add(raw);
  });

  const kinds: RecordKind[] = ['sale', 'expense', 'corte', 'backup'];
  let removed = 0;
  for (const kind of kinds) {
    const rows = await listRecords(kind);
    for (const row of rows) {
      if (!row.dateKey || row.dateKey >= cutoffKey) continue;
      if (protectedIds.has(row.id)) continue;
      await deleteRecord(kind, row.id);
      removed += 1;
    }
  }
  return removed;
}
