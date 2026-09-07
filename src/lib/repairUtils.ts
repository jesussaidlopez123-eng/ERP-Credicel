import { RepairCostKind, RepairCostLine, RepairRecord, SaleTicket } from '../types';
import { money, newUniqueId } from './ids';
import { safeFormatDate, safeFormatTime } from './dateUtils';
import { normalizeBranchId } from '../data/initialBranches';

const LEGACY_PREFIX = 'erp_repair_records_';

const CLOSED_STATUSES = new Set(['entregado', 'entregada', 'delivered', 'cancelado', 'cancelada', 'baja']);

export function isPendingRepair(record: RepairRecord | null | undefined): boolean {
  if (!record) return false;
  const status = String(record.status || '').toLowerCase();
  return !CLOSED_STATUSES.has(status);
}

export function stampRepairLabel(iso: string | undefined, fallback: string | undefined): string {
  if (iso) return `${safeFormatDate(iso)} ${safeFormatTime(iso)}`;
  return fallback || '—';
}

export function repairStatusLabel(status: RepairRecord['status'] | string | undefined): string {
  const value = String(status || '').toLowerCase();
  if (value === 'listo') return 'Listo para entregar';
  if (value === 'entregado' || value === 'entregada') return 'Entregado';
  if (value === 'cancelado' || value === 'cancelada' || value === 'baja') return 'Dado de baja';
  return 'En taller';
}

export function normalizeRepairStatus(status: string | undefined): RepairRecord['status'] {
  const value = String(status || '').toLowerCase().trim();
  if (value === 'listo' || value === 'ready') return 'listo';
  if (value === 'entregado' || value === 'entregada' || value === 'delivered') return 'entregado';
  if (value === 'cancelado' || value === 'cancelada' || value === 'baja') return 'cancelado';
  return 'en_taller';
}

function normalizeCostKind(raw: unknown): RepairCostKind {
  const value = String(raw || '').toLowerCase().trim();
  if (value === 'mano_obra' || value === 'mano de obra' || value === 'labor') return 'mano_obra';
  if (value === 'otro' || value === 'other') return 'otro';
  return 'refaccion';
}

export function normalizeRepairCostLine(
  raw: Partial<RepairCostLine> & Record<string, unknown>
): RepairCostLine | null {
  const amount = money(Number(raw.amount) || 0);
  if (amount < 0) return null;
  const concept = String(raw.concept || '').trim();
  if (!concept && amount === 0) return null;
  return {
    id: String(raw.id || '').trim() || newUniqueId('RC'),
    kind: normalizeCostKind(raw.kind),
    concept: concept || 'Costo de taller',
    amount,
    at: String(raw.at || ''),
    by: String(raw.by || '').trim()
  };
}

export function repairInternalCost(record: RepairRecord | null | undefined): number {
  return money((record?.costLines || []).reduce((sum, line) => sum + money(line.amount), 0));
}

export function addRepairCostLine(
  record: RepairRecord,
  input: { kind: RepairCostKind; concept: string; amount: number; at: string; by: string }
): RepairRecord {
  const amount = money(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El costo interno debe ser mayor a cero.');
  }
  const concept = input.concept.trim();
  if (!concept) {
    throw new Error('Escribe de qué es el costo (refacción, mano de obra, etc.).');
  }
  const line = normalizeRepairCostLine({
    id: newUniqueId('RC'),
    kind: input.kind,
    concept,
    amount,
    at: input.at,
    by: input.by
  });
  if (!line) throw new Error('No se pudo guardar el costo interno.');
  return { ...record, costLines: [...(record.costLines || []), line] };
}

export function removeRepairCostLine(record: RepairRecord, lineId: string): RepairRecord {
  return {
    ...record,
    costLines: (record.costLines || []).filter((line) => line.id !== lineId)
  };
}

export function normalizeRepairRecord(
  raw: Partial<RepairRecord> & Record<string, unknown>
): RepairRecord | null {
  const id = String(raw.id || '').trim();
  if (!id) return null;
  const totalCost = money(Number(raw.totalCost) || 0);
  const advancePayment = money(Number(raw.advancePayment) || 0);
  const pendingBalance = money(
    raw.pendingBalance === undefined || raw.pendingBalance === null
      ? Math.max(0, totalCost - advancePayment)
      : Number(raw.pendingBalance) || 0
  );
  const costLines = Array.isArray(raw.costLines)
    ? (raw.costLines as Array<Partial<RepairCostLine> & Record<string, unknown>>)
        .map((line) => normalizeRepairCostLine(line || {}))
        .filter((line): line is RepairCostLine => Boolean(line))
    : undefined;
  return {
    id,
    clientName: String(raw.clientName || '').trim() || 'Sin nombre',
    clientPhone: String(raw.clientPhone || '').trim(),
    deviceModel: String(raw.deviceModel || '').trim() || 'Equipo',
    passcodePattern: raw.passcodePattern ? String(raw.passcodePattern) : undefined,
    issueDescription: String(raw.issueDescription || '').trim(),
    totalCost,
    advancePayment,
    pendingBalance,
    status: normalizeRepairStatus(raw.status),
    receivedAt: String(raw.receivedAt || ''),
    deliveredAt: raw.deliveredAt ? String(raw.deliveredAt) : undefined,
    receivedAtIso: raw.receivedAtIso ? String(raw.receivedAtIso) : undefined,
    deliveredAtIso: raw.deliveredAtIso ? String(raw.deliveredAtIso) : undefined,
    operatorName: String(raw.operatorName || ''),
    deliveredByName: raw.deliveredByName ? String(raw.deliveredByName) : undefined,
    branchId: normalizeBranchId(String(raw.branchId || '')),
    deviceId: raw.deviceId ? String(raw.deviceId) : undefined,
    deviceLabel: raw.deviceLabel ? String(raw.deviceLabel) : undefined,
    cancelledAt: raw.cancelledAt ? String(raw.cancelledAt) : undefined,
    cancelledByName: raw.cancelledByName ? String(raw.cancelledByName) : undefined,
    cancelReason: raw.cancelReason ? String(raw.cancelReason) : undefined,
    deliveryTicketId: raw.deliveryTicketId ? String(raw.deliveryTicketId) : undefined,
    costUpdates: Array.isArray(raw.costUpdates) ? raw.costUpdates : undefined,
    costLines
  };
}

/**
 * Fuentes más a la derecha ganan en el mismo folio.
 * Un folio que solo existe en una fuente anterior (p. ej. un pendiente
 * rescatado de un ticket) no se tira.
 */
export function mergeRepairSources(...lists: Array<RepairRecord[] | undefined>): RepairRecord[] {
  const map = new Map<string, RepairRecord>();
  for (const list of lists) {
    if (!list) continue;
    for (const raw of list) {
      const rec = normalizeRepairRecord(raw as RepairRecord & Record<string, unknown>);
      if (!rec) continue;
      const prev = map.get(rec.id);
      map.set(
        rec.id,
        prev
          ? {
              ...prev,
              ...rec,
              id: rec.id,
              costUpdates: rec.costUpdates ?? prev.costUpdates,
              costLines: rec.costLines ?? prev.costLines
            }
          : rec
      );
    }
  }
  return Array.from(map.values());
}

export function loadLegacyRepairRecords(): RepairRecord[] {
  if (typeof localStorage === 'undefined') return [];
  const rows: RepairRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LEGACY_PREFIX)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        const rec = normalizeRepairRecord(item || {});
        if (rec) rows.push(rec);
      }
    }
  } catch {
    // ignore
  }
  return rows;
}

/** Reconstruye fichas a partir de tickets de anticipo/liquidación. */
export function inferRepairsFromTickets(tickets: SaleTicket[]): RepairRecord[] {
  const byId = new Map<string, RepairRecord>();
  const ordered = tickets.slice().sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

  for (const ticket of ordered) {
    for (const item of ticket.items || []) {
      const meta = item.metadata;
      const id = String(meta?.repairId || '').trim();
      if (!id) continue;

      const prev = byId.get(id);
      const totalCost = money(meta?.totalRepairCost ?? prev?.totalCost ?? 0);
      const advancePayment = money(meta?.advancePayment ?? prev?.advancePayment ?? 0);
      const rec: RepairRecord = {
        id,
        clientName: meta?.clientName || prev?.clientName || 'Sin nombre',
        clientPhone: meta?.clientPhone || prev?.clientPhone || '',
        deviceModel: meta?.deviceModel || prev?.deviceModel || item.product?.name || 'Equipo',
        passcodePattern: meta?.passcodePattern || prev?.passcodePattern,
        issueDescription: meta?.issueDescription || prev?.issueDescription || '',
        totalCost,
        advancePayment,
        pendingBalance: money(meta?.pendingBalance ?? prev?.pendingBalance ?? Math.max(0, totalCost - advancePayment)),
        status: 'en_taller',
        receivedAt: meta?.receivedAt || prev?.receivedAt || '',
        receivedAtIso: prev?.receivedAtIso || ticket.timestamp,
        operatorName: ticket.operatorName || prev?.operatorName || '',
        branchId: normalizeBranchId(ticket.branchId || prev?.branchId)
      };

      if (meta?.repairType === 'saldo_final') {
        rec.status = 'entregado';
        rec.pendingBalance = 0;
        rec.deliveredAt = meta.deliveredAt || prev?.deliveredAt;
        rec.deliveredAtIso = ticket.timestamp;
        rec.deliveredByName = ticket.operatorName;
        rec.deliveryTicketId = ticket.folio || ticket.id;
      }

      byId.set(id, rec);
    }
  }

  return Array.from(byId.values());
}

export function applyRepairCost(
  record: RepairRecord,
  newTotal: number,
  operatorName: string,
  atIso: string,
  note?: string
): RepairRecord {
  const previousTotal = money(record.totalCost);
  const total = money(newTotal);
  const advance = money(record.advancePayment);

  if (!Number.isFinite(total) || total < 0) {
    throw new Error('El precio debe ser un número válido.');
  }
  if (total < advance) {
    throw new Error('El precio no puede ser menor que el anticipo ya cobrado.');
  }

  const pending = money(Math.max(0, total - advance));
  const trimmedNote = note?.trim();
  const costUpdates = [...(record.costUpdates || [])];
  if (total !== previousTotal) {
    costUpdates.push({
      previousTotal,
      newTotal: total,
      at: atIso,
      by: operatorName,
      note: trimmedNote || undefined
    });
  }

  return {
    ...record,
    totalCost: total,
    pendingBalance: pending,
    costUpdates
  };
}

export function matchesRepairSearch(record: RepairRecord, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return (
    record.id.toLowerCase().includes(q) ||
    record.clientName.toLowerCase().includes(q) ||
    record.deviceModel.toLowerCase().includes(q) ||
    record.clientPhone.includes(q) ||
    (record.issueDescription || '').toLowerCase().includes(q)
  );
}
