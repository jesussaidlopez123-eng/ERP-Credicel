/**
 * Respaldo diario por sucursal.
 *
 * Al cierre (o cuando el encargado lo pida) se arma una foto del día:
 * ventas, gastos y corte, con totales y una firma de verificación. Queda
 * guardada en el equipo, se encola para la nube y se puede descargar como
 * archivo para el archivero del negocio.
 */

import { CorteXRecord, Expense, SaleTicket } from '../types';
import { getBranchDisplayName, normalizeBranchId } from '../data/initialBranches';
import { hermosilloDateKey } from './shiftHours';
import { money } from './ids';
import { summarizeTickets } from './saleClassification';
import { trustedDateKey, trustedIso } from './clockGuard';
import { getDeviceId, getDeviceLabel } from './deviceId';
import { getRecord, putRecord } from './localDb';
import { enqueue, drainOutbox } from './outbox';

export interface DailyBackup {
  id: string;
  branchId: string;
  branchName: string;
  dateKey: string;
  generatedAt: string;
  deviceId: string;
  deviceLabel: string;
  ticketCount: number;
  expenseCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  totalExpenses: number;
  corteIds: string[];
  ticketIds: string[];
  expenseIds: string[];
  tickets: SaleTicket[];
  expenses: Expense[];
  cortes: CorteXRecord[];
  checksum: string;
}

export function backupId(branchId: string, dateKey: string): string {
  return `${normalizeBranchId(branchId)}-${dateKey}`;
}

/** Firma corta para notar si un respaldo se alteró o quedó incompleto. */
export function computeChecksum(ticketIds: string[], expenseIds: string[], totalSales: number): string {
  const source = `${[...ticketIds].sort().join('|')}#${[...expenseIds].sort().join('|')}#${totalSales.toFixed(2)}`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    h1 ^= source.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return `${h1.toString(16).toUpperCase().padStart(8, '0')}-${source.length}`;
}

export function buildDailyBackup(params: {
  branchId: string;
  branchName?: string;
  dateKey?: string;
  tickets: SaleTicket[];
  expenses: Expense[];
  cortes: CorteXRecord[];
}): DailyBackup {
  const branchId = normalizeBranchId(params.branchId);
  const dateKey = params.dateKey || trustedDateKey();

  const tickets = params.tickets.filter(
    (t) =>
      t &&
      normalizeBranchId(t.branchId || t.sucursal_id) === branchId &&
      hermosilloDateKey(t.timestamp) === dateKey
  );
  const expenses = params.expenses.filter(
    (e) =>
      e &&
      normalizeBranchId(e.branchId || e.sucursal_id) === branchId &&
      hermosilloDateKey(e.timestamp || e.date) === dateKey
  );
  const cortes = params.cortes.filter(
    (c) =>
      c &&
      !c.reverted &&
      normalizeBranchId(c.branchId) === branchId &&
      hermosilloDateKey(c.timestamp || c.dateStr) === dateKey
  );

  const totals = summarizeTickets(tickets);
  const totalExpenses = money(expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  const ticketIds = tickets.map((t) => t.id);
  const expenseIds = expenses.map((e) => e.id);

  return {
    id: backupId(branchId, dateKey),
    branchId,
    branchName: params.branchName || getBranchDisplayName(branchId),
    dateKey,
    generatedAt: trustedIso(),
    deviceId: getDeviceId(),
    deviceLabel: getDeviceLabel(),
    ticketCount: tickets.length,
    expenseCount: expenses.length,
    totalSales: totals.totalSales,
    cashSales: totals.cashSales,
    cardSales: totals.cardSales,
    transferSales: totals.transferSales,
    totalExpenses,
    corteIds: cortes.map((c) => c.id),
    ticketIds,
    expenseIds,
    tickets,
    expenses,
    cortes,
    checksum: computeChecksum(ticketIds, expenseIds, totals.totalSales)
  };
}

/**
 * Un documento de Firestore no puede pasar de ~1 MB. En un día muy movido el
 * detalle completo no cabe, así que a la nube sube el resumen con la lista de
 * folios; el detalle completo se queda en el equipo y en el archivo descargable
 * (las ventas ya viven una por una en `ventas`, no se pierde nada).
 */
const MAX_EMBEDDED_ROWS = 250;

export function backupForCloud(backup: DailyBackup): DailyBackup & { truncated?: boolean } {
  const tooBig = backup.tickets.length + backup.expenses.length > MAX_EMBEDDED_ROWS;
  if (!tooBig) return backup;
  return { ...backup, tickets: [], expenses: [], cortes: [], truncated: true };
}

export async function saveDailyBackup(backup: DailyBackup): Promise<void> {
  await putRecord<DailyBackup>({
    kind: 'backup',
    id: backup.id,
    branchId: backup.branchId,
    dateKey: backup.dateKey,
    data: backup,
    updatedAt: backup.generatedAt
  });

  await enqueue({
    kind: 'dailyBackup',
    groupKey: `respaldo-${backup.branchId}`,
    id: `backup-${backup.id}`,
    label: `Respaldo ${backup.branchName} ${backup.dateKey}`,
    payload: backupForCloud(backup)
  });

  void drainOutbox().catch(() => {});
}

export async function getLocalBackup(branchId: string, dateKey: string): Promise<DailyBackup | null> {
  const row = await getRecord<DailyBackup>('backup', backupId(branchId, dateKey));
  return row?.data || null;
}

/**
 * Genera el respaldo del día si aún no existe o si cambió el contenido.
 * Es seguro llamarlo muchas veces.
 */
export async function ensureDailyBackup(params: {
  branchId: string;
  branchName?: string;
  dateKey?: string;
  tickets: SaleTicket[];
  expenses: Expense[];
  cortes: CorteXRecord[];
}): Promise<DailyBackup | null> {
  const fresh = buildDailyBackup(params);
  if (fresh.ticketCount === 0 && fresh.expenseCount === 0 && fresh.corteIds.length === 0) {
    return null;
  }
  const existing = await getLocalBackup(fresh.branchId, fresh.dateKey);
  if (existing && existing.checksum === fresh.checksum && existing.corteIds.length === fresh.corteIds.length) {
    return existing;
  }
  await saveDailyBackup(fresh);
  return fresh;
}

export function downloadBackupFile(backup: DailyBackup): void {
  try {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo-${backup.branchName.toLowerCase()}-${backup.dateKey}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('[Respaldo] No se pudo descargar el archivo:', err);
  }
}
