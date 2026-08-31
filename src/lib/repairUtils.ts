import { RepairRecord } from '../types';
import { money } from './ids';
import { safeFormatDate, safeFormatTime } from './dateUtils';

export function isPendingRepair(record: RepairRecord | null | undefined): boolean {
  if (!record) return false;
  return record.status !== 'entregado' && record.status !== 'cancelado';
}

export function stampRepairLabel(iso: string | undefined, fallback: string | undefined): string {
  if (iso) return `${safeFormatDate(iso)} ${safeFormatTime(iso)}`;
  return fallback || '—';
}

export function repairStatusLabel(status: RepairRecord['status']): string {
  if (status === 'listo') return 'Listo para entregar';
  if (status === 'entregado') return 'Entregado';
  if (status === 'cancelado') return 'Dado de baja';
  return 'En taller';
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
    throw new Error('El costo debe ser un número válido.');
  }
  if (total < advance) {
    throw new Error('El costo no puede ser menor que el anticipo ya cobrado.');
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
