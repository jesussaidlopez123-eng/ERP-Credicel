/**
 * Capa "primero local" del punto de venta.
 *
 * Cobrar guarda la venta en el equipo y la mete a la cola. La nube se actualiza
 * enseguida si hay señal, y si no, cuando vuelva. El mostrador nunca se queda
 * esperando a la red y ninguna venta del día se pierde.
 */

import { CorteXRecord, Expense, InventoryMovement, Product, RepairRecord, SaleTicket } from '../types';
import { snapshotInventory, type InventorySnapshot } from './inventoryMerge';
import { normalizeBranchId } from '../data/initialBranches';
import { hermosilloDateKey } from './shiftHours';
import { trustedDateKey, trustedIso } from './clockGuard';
import { getDeviceId, getDeviceLabel } from './deviceId';
import { LocalRecord, RecordKind, deleteOutboxRow, deleteRecord, getRecord, listRecords, putRecord, putRecords } from './localDb';
import { drainOutbox, enqueue, listPendingOutbox } from './outbox';
import {
  CORTE_X_COLLECTION,
  EXPENSES_COLLECTION,
  GASTOS_COLLECTION,
  PRODUCTS_COLLECTION,
  REPAIR_RECORDS_COLLECTION,
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
export async function commitSale(
  ticket: SaleTicket,
  extras?: {
    products?: Array<{ product: Product; base?: Product | InventorySnapshot | null }>;
    movements?: InventoryMovement[];
  }
): Promise<SaleTicket> {
  const branchId = normalizeBranchId(ticket.branchId || ticket.sucursal_id);
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

  const writes: Array<{
    collection: string;
    id: string;
    data: Record<string, unknown>;
    inventoryBase?: InventorySnapshot;
  }> = [];

  for (const row of extras?.products || []) {
    writes.push({
      collection: PRODUCTS_COLLECTION,
      id: row.product.id,
      data: cleanForFirestore(row.product as unknown as Record<string, unknown>),
      inventoryBase: row.base ? snapshotInventory(row.base as Product) : undefined
    });
  }

  writes.push(
    { collection: VENTAS_COLLECTION, id: enriched.id, data },
    { collection: SALES_COLLECTION, id: enriched.id, data }
  );

  for (const movement of extras?.movements || []) {
    writes.push({
      collection: INVENTORY_MOVEMENTS_COLLECTION,
      id: movement.id,
      data: cleanForFirestore(stamp(movement as unknown as Record<string, unknown>))
    });
  }

  await enqueue({
    kind: 'docWrite',
    groupKey: branchId,
    id: `sale-${enriched.id}`,
    label: `Venta ${enriched.folio || enriched.id}`,
    payload: { writes }
  });

  kickDrain();
  return enriched;
}

// ----------------------------------------------------
// Gastos
// ----------------------------------------------------

export async function commitExpense(expense: Expense): Promise<Expense> {
  const branchId = normalizeBranchId(expense.branchId || expense.sucursal_id);
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

/** Actualiza un corte ya cerrado (venta atrasada o ticket eliminado) sin reabrir el turno. */
export async function commitCorteSnapshot(corteRecord: CorteXRecord): Promise<void> {
  const branchId = normalizeBranchId(corteRecord.branchId);
  const dateKey = hermosilloDateKey(corteRecord.timestamp) || trustedDateKey();
  const data = cleanForFirestore(stamp(corteRecord as unknown as Record<string, unknown>));

  await putRecord<CorteXRecord>({
    kind: 'corte',
    id: corteRecord.id,
    branchId,
    dateKey,
    data: corteRecord,
    updatedAt: trustedIso()
  });

  await enqueue({
    kind: 'docWrite',
    groupKey: branchId,
    id: `corte-snap-${corteRecord.id}`,
    label: `Corte ${corteRecord.branchName || branchId} ${dateKey}`,
    payload: {
      writes: [{ collection: CORTE_X_COLLECTION, id: corteRecord.id, data, merge: true }]
    }
  });

  kickDrain();
}

// ----------------------------------------------------
// Taller
// ----------------------------------------------------

/**
 * Recepción, entrega y cancelación de un equipo en taller.
 *
 * Un celular ajeno en el mostrador no puede depender de que haya internet:
 * el registro queda en el equipo y sube cuando se pueda. Reenviarlo no
 * duplica nada porque el folio es el id del documento.
 */
export async function commitRepairRecord(record: RepairRecord): Promise<RepairRecord> {
  const branchId = normalizeBranchId(record.branchId);
  const enriched: RepairRecord = {
    ...record,
    branchId,
    receivedAtIso: record.receivedAtIso || trustedIso(),
    deviceId: record.deviceId || getDeviceId(),
    deviceLabel: record.deviceLabel || getDeviceLabel()
  };
  const dateKey = hermosilloDateKey(enriched.receivedAtIso) || trustedDateKey();

  await putRecord<RepairRecord>({
    kind: 'repair',
    id: enriched.id,
    branchId,
    dateKey,
    data: enriched,
    updatedAt: trustedIso()
  });

  await enqueue({
    kind: 'docWrite',
    groupKey: `taller-${branchId}`,
    id: `repair-${enriched.id}`,
    label: `Taller ${enriched.id} · ${enriched.clientName}`,
    payload: {
      writes: [
        {
          collection: REPAIR_RECORDS_COLLECTION,
          id: enriched.id,
          data: cleanForFirestore(enriched as unknown as Record<string, unknown>)
        }
      ]
    }
  });

  kickDrain();
  return enriched;
}

export async function localRepairs(): Promise<RepairRecord[]> {
  return unwrap(await listRecords<RepairRecord>('repair'));
}

// ----------------------------------------------------
// Inventario y catálogo
// ----------------------------------------------------

export async function commitProduct(product: Product, base?: Product | InventorySnapshot | null): Promise<void> {
  await enqueue({
    kind: 'docWrite',
    groupKey: 'catalogo',
    label: `Inventario ${product.name || product.id}`,
    payload: {
      writes: [
        {
          collection: PRODUCTS_COLLECTION,
          id: product.id,
          data: cleanForFirestore(product as unknown as Record<string, unknown>),
          inventoryBase: base ? snapshotInventory(base as Product) : undefined
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

function historyDateKey(row: {
  timestamp?: string;
  date?: string;
  dateStr?: string;
}): string {
  return hermosilloDateKey(row.timestamp || row.date || row.dateStr) || trustedDateKey();
}

/**
 * Guarda en este equipo lo que Dirección ya trajo de la nube.
 * No encola nada: esos documentos ya existen en Firestore.
 */
export async function rememberCloudHistory(input: {
  tickets?: SaleTicket[];
  expenses?: Expense[];
  cortes?: CorteXRecord[];
}): Promise<number> {
  const rows: Array<Omit<LocalRecord<SaleTicket | Expense | CorteXRecord>, 'pk'>> = [];
  const now = trustedIso();

  for (const ticket of input.tickets || []) {
    if (!ticket?.id) continue;
    const branchId = normalizeBranchId(ticket.branchId || ticket.sucursal_id);
    rows.push({
      kind: 'sale',
      id: ticket.id,
      branchId,
      dateKey: historyDateKey(ticket),
      data: ticket,
      updatedAt: now
    });
  }
  for (const expense of input.expenses || []) {
    if (!expense?.id) continue;
    const branchId = normalizeBranchId(expense.branchId || expense.sucursal_id);
    rows.push({
      kind: 'expense',
      id: expense.id,
      branchId,
      dateKey: historyDateKey(expense),
      data: expense,
      updatedAt: now
    });
  }
  for (const corte of input.cortes || []) {
    if (!corte?.id) continue;
    const branchId = normalizeBranchId(corte.branchId || corte.sucursal_id);
    rows.push({
      kind: 'corte',
      id: corte.id,
      branchId,
      dateKey: historyDateKey(corte),
      data: corte,
      updatedAt: now
    });
  }

  if (rows.length === 0) return 0;
  await putRecords(rows);
  return rows.length;
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

async function dropPendingWrite(outboxId: string): Promise<void> {
  try {
    await deleteOutboxRow(outboxId);
  } catch {
    // si no había fila en cola, el movimiento ya estaba en la nube
  }
}

/** Un ticket cancelado no debe revivir desde el respaldo del equipo. */
export async function forgetLocalSale(ticketId: string): Promise<void> {
  await deleteRecord('sale', ticketId);
  await dropPendingWrite(`sale-${ticketId}`);
}

/** Un gasto cancelado no debe volver a subir desde la cola local. */
export async function forgetLocalExpense(expenseId: string): Promise<void> {
  await deleteRecord('expense', expenseId);
  await dropPendingWrite(`expense-${expenseId}`);
}

/** Una reparación eliminada por el admin no debe volver a subir desde este equipo. */
export async function forgetLocalRepair(repairId: string): Promise<void> {
  await deleteRecord('repair', repairId);
  await dropPendingWrite(`repair-${repairId}`);
}

/** El equipo guarda el historial que Dirección ya pidió (mismo horizonte que Ventas). */
export const LOCAL_RETENTION_DAYS = 180;

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
