import type { AppNotification, InventoryMovement, MerchandiseReceiptDetails, MerchandiseReceiptLine, Operator } from '../types';
import { getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { safeFormatDate, safeFormatTime } from './dateUtils';
import { newUniqueId } from './ids';
import { normalizeRole } from './roles';

export function isMerchandiseReceiptNotice(
  n: Pick<AppNotification, 'type'> | null | undefined
): boolean {
  return n?.type === 'ingreso_mercancia';
}

export function isPendingMerchandiseReceipt(
  n: Pick<AppNotification, 'type' | 'receiptDetails'> | null | undefined
): boolean {
  return isMerchandiseReceiptNotice(n) && n?.receiptDetails?.status !== 'confirmado';
}

export function formatReceiptWhen(iso: string): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(iso)) {
    return `${safeFormatDate(iso)} ${safeFormatTime(iso)}`;
  }
  return iso;
}

function foldLineKey(line: MerchandiseReceiptLine): string {
  return `${String(line.productName || '').trim().toLowerCase()}::${(line.imeis || []).join(',')}`;
}

export function mergeReceiptLines(
  previous: MerchandiseReceiptLine[] = [],
  incoming: MerchandiseReceiptLine[] = []
): MerchandiseReceiptLine[] {
  const map = new Map<string, MerchandiseReceiptLine>();
  for (const line of [...previous, ...incoming]) {
    if (!line?.productName || !(Number(line.quantity) > 0)) continue;
    const key = foldLineKey(line);
    const current = map.get(key);
    if (!current) {
      const next: MerchandiseReceiptLine = {
        productName: String(line.productName).trim(),
        quantity: Number(line.quantity) || 0
      };
      if (line.imeis?.length) next.imeis = [...line.imeis];
      map.set(key, next);
      continue;
    }
    current.quantity += Number(line.quantity) || 0;
    if (line.imeis?.length) {
      current.imeis = Array.from(new Set([...(current.imeis || []), ...line.imeis]));
    }
  }
  return Array.from(map.values());
}

export function receiptLineLabel(line: MerchandiseReceiptLine): string {
  const qty = Number(line.quantity) || 0;
  const imeis = (line.imeis || []).filter(Boolean);
  if (imeis.length === 1) return `${qty}× ${line.productName} · IMEI ${imeis[0]}`;
  if (imeis.length > 1) return `${qty}× ${line.productName} · ${imeis.length} IMEI`;
  return `${qty}× ${line.productName}`;
}

export function buildReceiptMessage(details: MerchandiseReceiptDetails, authorName: string): string {
  const dest = details.destBranchName || getBranchDisplayName(details.destBranchId);
  const sourceLabel =
    details.source === 'traspaso'
      ? details.originBranchName
        ? `Traspaso desde ${details.originBranchName}`
        : 'Traspaso'
      : details.source === 'compra'
        ? 'Recepción de compra'
        : 'Ingreso a inventario';
  const lines = (details.lines || []).map((line) => `• ${receiptLineLabel(line)}`).join('\n');
  if (details.status === 'confirmado') {
    const who = details.confirmedBy || 'Caja';
    const when = formatReceiptWhen(details.confirmedAt || '');
    return `${dest} ya confirmó esta mercancía.\n${lines}\nConfirmó ${who}${when ? ` · ${when}` : ''}.`;
  }
  return `Entró mercancía a ${dest}. Confirma que ya está en anaquel.\n${lines}\n${sourceLabel} · envió ${authorName || 'Administración'}.`;
}

export function buildReceiptTitle(details: MerchandiseReceiptDetails): string {
  const dest = details.destBranchName || getBranchDisplayName(details.destBranchId);
  if (details.status === 'confirmado') return `Mercancía confirmada · ${dest}`;
  return `Mercancía en ${dest} · por confirmar`;
}

export type MerchandiseArrival = {
  source: MerchandiseReceiptDetails['source'];
  destBranchId: string;
  destBranchName?: string;
  originBranchId?: string;
  originBranchName?: string;
  authorName: string;
  lines: MerchandiseReceiptLine[];
  movementIds?: string[];
  at?: string;
};

export function arrivalFromMovement(movement: InventoryMovement): MerchandiseArrival | null {
  if (!movement) return null;
  if (movement.type !== 'ingreso' && movement.type !== 'traspaso') return null;
  const dest = normalizeBranchId(movement.targetBranchId);
  if (!dest || !hasCashTill(dest)) return null;
  const qty = Math.abs(Number(movement.quantity) || 0);
  if (qty <= 0) return null;
  const reason = `${movement.reason || ''} ${movement.details || ''}`.toLowerCase();
  const source: MerchandiseReceiptDetails['source'] =
    movement.type === 'traspaso' ? 'traspaso' : reason.includes('compra') ? 'compra' : 'ingreso';
  return {
    source,
    destBranchId: dest,
    destBranchName: movement.targetBranchName || getBranchDisplayName(dest),
    originBranchId: movement.sourceBranchId ? normalizeBranchId(movement.sourceBranchId) : undefined,
    originBranchName: movement.sourceBranchName,
    authorName: movement.operatorName || 'Administración',
    lines: [
      {
        productName: movement.productName,
        quantity: qty,
        imeis: movement.imeis?.length ? movement.imeis : undefined
      }
    ],
    movementIds: movement.id ? [movement.id] : undefined,
    at: movement.timestamp
  };
}

function sameOpenReceipt(notice: AppNotification, arrival: MerchandiseArrival): boolean {
  if (!isPendingMerchandiseReceipt(notice)) return false;
  const details = notice.receiptDetails;
  if (!details) return false;
  if (details.source !== arrival.source) return false;
  if (normalizeBranchId(details.destBranchId) !== normalizeBranchId(arrival.destBranchId)) return false;
  const prevOrigin = normalizeBranchId(details.originBranchId);
  const nextOrigin = normalizeBranchId(arrival.originBranchId);
  return prevOrigin === nextOrigin;
}

export function upsertMerchandiseReceiptNotice(
  existing: AppNotification[],
  arrival: MerchandiseArrival
): AppNotification {
  const dest = normalizeBranchId(arrival.destBranchId);
  const destName = arrival.destBranchName || getBranchDisplayName(dest);
  const open = (existing || []).find((row) => sameOpenReceipt(row, arrival));
  const details: MerchandiseReceiptDetails = {
    source: arrival.source,
    destBranchId: dest,
    destBranchName: destName,
    originBranchId: arrival.originBranchId ? normalizeBranchId(arrival.originBranchId) : undefined,
    originBranchName: arrival.originBranchName,
    lines: mergeReceiptLines(open?.receiptDetails?.lines, arrival.lines),
    status: 'pendiente',
    movementIds: Array.from(
      new Set([...(open?.receiptDetails?.movementIds || []), ...(arrival.movementIds || [])])
    )
  };
  const authorName = arrival.authorName || open?.authorName || 'Administración';
  return {
    id: open?.id || newUniqueId('NOTIF'),
    urgency: 'urgente',
    title: buildReceiptTitle(details),
    message: buildReceiptMessage(details, authorName),
    createdAt: open?.createdAt || arrival.at || new Date().toISOString(),
    read: false,
    authorName,
    branchId: dest,
    targetOperatorId: 'all',
    type: 'ingreso_mercancia',
    receiptDetails: details
  };
}

export function confirmMerchandiseReceipt(
  notice: AppNotification,
  operator: Pick<Operator, 'id' | 'name'>,
  at: string = new Date().toISOString()
): AppNotification {
  const destId = notice.receiptDetails?.destBranchId || notice.branchId;
  const details: MerchandiseReceiptDetails = {
    source: notice.receiptDetails?.source || 'ingreso',
    destBranchId: normalizeBranchId(destId),
    destBranchName: notice.receiptDetails?.destBranchName || getBranchDisplayName(destId),
    originBranchId: notice.receiptDetails?.originBranchId,
    originBranchName: notice.receiptDetails?.originBranchName,
    lines: notice.receiptDetails?.lines || [],
    status: 'confirmado',
    confirmedAt: at,
    confirmedBy: operator.name,
    confirmedById: operator.id,
    movementIds: notice.receiptDetails?.movementIds
  };
  return {
    ...notice,
    urgency: 'normal',
    title: buildReceiptTitle(details),
    message: buildReceiptMessage(details, notice.authorName),
    read: true,
    receiptDetails: details
  };
}

export function merchandiseReceiptVisibleTo(
  n: AppNotification,
  opts: { role?: string; branchId?: string }
): boolean {
  if (!isMerchandiseReceiptNotice(n)) return false;
  if (normalizeRole(opts.role) === 'admin') return true;
  const dest = n.receiptDetails?.destBranchId || n.branchId;
  return normalizeBranchId(dest) === normalizeBranchId(opts.branchId);
}
