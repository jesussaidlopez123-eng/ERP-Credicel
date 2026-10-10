import { AppNotification, RepairCostKind, RepairCostLine, RepairRecord, RepairWorkStage, SaleTicket } from '../types';
import { money, newUniqueId } from './ids';
import { addCashDays, safeDateIsoKey, safeFormatDate, safeFormatTime, todayCashDateKey } from './dateUtils';
import { getBranchDisplayName, normalizeBranchId } from '../data/initialBranches';
import { normalizeRole } from './roles';

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
  if (value === 'entregado' || value === 'entregada') return 'Entregado';
  if (value === 'cancelado' || value === 'cancelada' || value === 'baja') return 'Dado de baja';
  return 'En taller';
}

export function normalizeRepairStatus(status: string | undefined): RepairRecord['status'] {
  const value = String(status || '')
    .toLowerCase()
    .trim();
  if (value === 'entregado' || value === 'entregada' || value === 'delivered') return 'entregado';
  if (value === 'cancelado' || value === 'cancelada' || value === 'baja') return 'cancelado';
  // "listo" ya no existe como paso: el equipo se puede entregar en cuanto entra a taller.
  return 'en_taller';
}

export const REPAIR_WORK_STAGES: RepairWorkStage[] = [
  'recibido',
  'costo_refaccion',
  'para_entrega'
];

export const REPAIR_WORK_STAGE_META: Record<RepairWorkStage, { label: string; short: string }> = {
  recibido: { label: 'Recepción', short: 'Nuevo' },
  costo_refaccion: { label: 'Costo de refacción', short: 'Refacción' },
  para_entrega: { label: 'Entrega', short: 'Entregar' }
};

const MID_SHOP_STAGES = new Set([
  'costo_refaccion',
  'diagnostico',
  'espera_pieza',
  'en_proceso',
  'revision',
  'pieza'
]);

export function normalizeWorkStage(
  raw: unknown,
  status?: string
): RepairWorkStage {
  const value = String(raw || '')
    .toLowerCase()
    .trim();
  if (value === 'recibido' || value === 'recepcion' || value === 'nuevo') return 'recibido';
  if (MID_SHOP_STAGES.has(value)) return 'costo_refaccion';
  if (
    value === 'para_entrega' ||
    value === 'listo' ||
    value === 'ready' ||
    value === 'para_recoger' ||
    value === 'entrega'
  ) {
    return 'para_entrega';
  }
  if (normalizeRepairStatus(status) === 'entregado') return 'para_entrega';
  return 'recibido';
}

export function workStageOf(record: RepairRecord | null | undefined): RepairWorkStage {
  if (!record) return 'recibido';
  return normalizeWorkStage(record.workStage, record.status);
}

export function workStageLabel(stage: RepairWorkStage | string | undefined): string {
  return REPAIR_WORK_STAGE_META[normalizeWorkStage(stage)].label;
}

export function setRepairWorkStage(record: RepairRecord, stage: RepairWorkStage): RepairRecord {
  return { ...record, workStage: normalizeWorkStage(stage, record.status) };
}

export function shiftRepairWorkStage(record: RepairRecord, delta: -1 | 1): RepairRecord {
  const current = workStageOf(record);
  const idx = REPAIR_WORK_STAGES.indexOf(current);
  const next = REPAIR_WORK_STAGES[Math.max(0, Math.min(REPAIR_WORK_STAGES.length - 1, idx + delta))];
  return setRepairWorkStage(record, next);
}

export function repairDaysInShop(record: RepairRecord, todayKey: string = todayCashDateKey()): number {
  const start = safeDateIsoKey(record.receivedAtIso) || safeDateIsoKey(record.receivedAt);
  if (!start || !todayKey) return 0;
  let days = 0;
  let cursor = start;
  while (cursor < todayKey && days < 365) {
    cursor = addCashDays(cursor, 1);
    days += 1;
  }
  return days;
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

/** Entrega hecha en caja y todavía sin refacción / mano de obra capturada. */
export function needsRepairCostCapture(record: RepairRecord | null | undefined): boolean {
  if (!record) return false;
  return record.status === 'entregado' && repairInternalCost(record) <= 0;
}

export function repairCostDueNotificationId(repairId: string): string {
  return `notif-rep-${repairId}`;
}

export function buildRepairCostDueNotification(
  record: RepairRecord,
  cashierName: string
): Omit<AppNotification, 'id' | 'createdAt' | 'read'> {
  const branch = getBranchDisplayName(record.branchId);
  return {
    urgency: 'urgente',
    title: `Falta gasto de reparación · ${record.id}`,
    message: `${cashierName} entregó ${record.deviceModel} de ${record.clientName} en ${branch}. El costo de refacción está en $0. Captúrelo en Reparaciones → Costo de refacción. La caja ya no espera ese dato.`,
    authorName: cashierName,
    branchId: 'all',
    targetOperatorId: 'all',
    type: 'gasto_reparacion',
    repairId: record.id
  };
}

export function repairCostDueNotificationPlan(
  previous: RepairRecord | undefined,
  next: RepairRecord,
  existing: AppNotification[],
  cashierName: string
): {
  add: Omit<AppNotification, 'id' | 'createdAt' | 'read'> | null;
  dismissIds: string[];
} {
  const related = (existing || []).filter(
    (n) =>
      n.type === 'gasto_reparacion' &&
      (n.repairId === next.id || n.id === repairCostDueNotificationId(next.id))
  );
  const relatedIds = Array.from(new Set([...related.map((n) => n.id), repairCostDueNotificationId(next.id)]));

  if (next.status !== 'entregado') {
    return { add: null, dismissIds: related.map((n) => n.id) };
  }
  if (repairInternalCost(next) > 0) {
    return { add: null, dismissIds: relatedIds };
  }

  const justDelivered = !previous || previous.status !== 'entregado';
  if (!justDelivered || related.length > 0) {
    return { add: null, dismissIds: [] };
  }
  return { add: buildRepairCostDueNotification(next, cashierName), dismissIds: [] };
}

export function notificationVisibleToOperator(
  n: AppNotification,
  opts: { role?: string; branchId?: string; operatorId?: string }
): boolean {
  if (n.type === 'gasto_reparacion') {
    return normalizeRole(opts.role) === 'admin';
  }
  if (n.type === 'agenda_tarea') {
    const role = normalizeRole(opts.role);
    return role === 'admin' || role === 'manager';
  }
  const matchesBranch = !n.branchId || n.branchId === 'all' || n.branchId === opts.branchId;
  const matchesOperator =
    !n.targetOperatorId || n.targetOperatorId === 'all' || n.targetOperatorId === opts.operatorId;
  return Boolean(matchesBranch && matchesOperator);
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
  if (!line) throw new Error('No se pudo guardar el costo de refacción.');
  const next: RepairRecord = { ...record, costLines: [...(record.costLines || []), line] };
  if (workStageOf(next) === 'recibido') {
    return setRepairWorkStage(next, 'costo_refaccion');
  }
  return next;
}

export function removeRepairCostLine(record: RepairRecord, lineId: string): RepairRecord {
  return {
    ...record,
    costLines: (record.costLines || []).filter((line) => line.id !== lineId)
  };
}

export function hasRefaccionCost(record: RepairRecord | null | undefined): boolean {
  return (record?.costLines || []).some(
    (line) => line.kind === 'refaccion' && money(line.amount) > 0
  );
}

export function markRepairReadyForDelivery(record: RepairRecord): RepairRecord {
  return setRepairWorkStage(record, 'para_entrega');
}

export function markRepairDelivered(
  record: RepairRecord,
  operatorName: string,
  atIso: string,
  deliveredLabel: string
): RepairRecord {
  if (money(record.pendingBalance) > 0) {
    throw new Error('Cobra el saldo en el punto de venta para entregar este equipo.');
  }
  return {
    ...record,
    status: 'entregado',
    pendingBalance: 0,
    workStage: 'para_entrega',
    deliveredAt: deliveredLabel,
    deliveredAtIso: atIso,
    deliveredByName: operatorName
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
    workStage: normalizeWorkStage(raw.workStage, raw.status as string),
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

function repairStatusRank(status: RepairRecord['status'] | string | undefined): number {
  const value = normalizeRepairStatus(status);
  if (value === 'cancelado') return 3;
  if (value === 'entregado') return 2;
  return 1;
}

function repairStageRank(stage: RepairWorkStage | string | undefined): number {
  const idx = REPAIR_WORK_STAGES.indexOf(normalizeWorkStage(stage));
  return idx < 0 ? 0 : idx;
}

function mergeRepairCostLines(
  a?: RepairCostLine[],
  b?: RepairCostLine[]
): RepairCostLine[] | undefined {
  if (!a?.length) return b?.length ? b : a ?? b;
  if (!b?.length) return a;
  const map = new Map<string, RepairCostLine>();
  for (const line of [...a, ...b]) {
    if (!line?.id) continue;
    map.set(line.id, line);
  }
  return Array.from(map.values());
}

function mergeRepairCostUpdates(
  a?: RepairRecord['costUpdates'],
  b?: RepairRecord['costUpdates']
): RepairRecord['costUpdates'] {
  const rows = [...(a || []), ...(b || [])];
  if (rows.length === 0) return a ?? b;
  const seen = new Set<string>();
  const out: NonNullable<RepairRecord['costUpdates']> = [];
  for (const row of rows) {
    const key = `${row.at}|${row.by}|${row.previousTotal}|${row.newTotal}|${row.note || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Une dos fichas del mismo folio: gana el ciclo más avanzado, no el snapshot más nuevo. */
export function combineRepairRecords(prev: RepairRecord, incoming: RepairRecord): RepairRecord {
  const status =
    repairStatusRank(incoming.status) >= repairStatusRank(prev.status) ? incoming.status : prev.status;
  const workStage =
    status === 'entregado'
      ? 'para_entrega'
      : repairStageRank(incoming.workStage) >= repairStageRank(prev.workStage)
        ? workStageOf(incoming)
        : workStageOf(prev);
  return {
    ...prev,
    ...incoming,
    id: incoming.id || prev.id,
    status,
    workStage,
    costLines: mergeRepairCostLines(prev.costLines, incoming.costLines),
    costUpdates: mergeRepairCostUpdates(prev.costUpdates, incoming.costUpdates),
    deliveredAt: incoming.deliveredAt || prev.deliveredAt,
    deliveredAtIso: incoming.deliveredAtIso || prev.deliveredAtIso,
    deliveredByName: incoming.deliveredByName || prev.deliveredByName,
    deliveryTicketId: incoming.deliveryTicketId || prev.deliveryTicketId,
    cancelledAt: incoming.cancelledAt || prev.cancelledAt,
    cancelledByName: incoming.cancelledByName || prev.cancelledByName,
    cancelReason: incoming.cancelReason || prev.cancelReason,
    passcodePattern: incoming.passcodePattern || prev.passcodePattern,
    issueDescription: incoming.issueDescription || prev.issueDescription,
    deviceId: incoming.deviceId || prev.deviceId,
    deviceLabel: incoming.deviceLabel || prev.deviceLabel
  };
}

export function repairPhoneDigits(phone: string | undefined): string {
  return String(phone || '').replace(/\D/g, '');
}

export function repairDeviceKey(model: string | undefined): string {
  return String(model || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function repairReceivedKey(
  record: Partial<Pick<RepairRecord, 'receivedAtIso' | 'receivedAt'>>
): string {
  return (
    safeDateIsoKey(record.receivedAtIso) ||
    safeDateIsoKey(record.receivedAt) ||
    String(record.receivedAtIso || record.receivedAt || '').slice(0, 10)
  );
}

/** Sucursal + teléfono + equipo. Un celular que sigue en taller no se da de alta otra vez. */
export function repairShopIdentity(
  record: Pick<RepairRecord, 'branchId' | 'clientPhone' | 'deviceModel'>
): string {
  const phone = repairPhoneDigits(record.clientPhone);
  const device = repairDeviceKey(record.deviceModel);
  if (!phone || !device) return '';
  return `${normalizeBranchId(record.branchId)}|${phone}|${device}`;
}

/** Misma sucursal + teléfono + equipo + día de recepción. */
export function repairFingerprint(
  record: Pick<RepairRecord, 'branchId' | 'clientPhone' | 'deviceModel'> &
    Partial<Pick<RepairRecord, 'receivedAtIso' | 'receivedAt'>>
): string {
  const identity = repairShopIdentity(record);
  if (!identity) return '';
  return `${identity}|${repairReceivedKey(record)}`;
}

function repairCompleteness(record: RepairRecord): number {
  let n = 0;
  if (record.passcodePattern) n += 1;
  if (record.issueDescription) n += 1;
  if (record.deviceId) n += 2;
  if (money(record.totalCost) > 0) n += 1;
  if (record.costLines?.length) n += 2;
  if (workStageOf(record) !== 'recibido') n += 2;
  if (!isPendingRepair(record)) n += 3;
  return n;
}

function preferRepairRecord(a: RepairRecord, b: RepairRecord): RepairRecord {
  if (repairStatusRank(b.status) !== repairStatusRank(a.status)) {
    return repairStatusRank(b.status) > repairStatusRank(a.status) ? b : a;
  }
  if (repairStageRank(b.workStage) !== repairStageRank(a.workStage)) {
    return repairStageRank(b.workStage) > repairStageRank(a.workStage) ? b : a;
  }
  if (repairCompleteness(b) !== repairCompleteness(a)) {
    return repairCompleteness(b) > repairCompleteness(a) ? b : a;
  }
  const ta = a.receivedAtIso || '';
  const tb = b.receivedAtIso || '';
  if (ta && tb && ta !== tb) return ta < tb ? a : b;
  return a.id <= b.id ? a : b;
}

/**
 * Fuentes más a la derecha actualizan datos, pero no bajan un folio
 * ya entregado o cancelado, ni tiran costos internos.
 */
export function mergeRepairSources(...lists: Array<RepairRecord[] | undefined>): RepairRecord[] {
  const map = new Map<string, RepairRecord>();
  for (const list of lists) {
    if (!list) continue;
    for (const raw of list) {
      const rec = normalizeRepairRecord(raw as RepairRecord & Record<string, unknown>);
      if (!rec) continue;
      const prev = map.get(rec.id);
      map.set(rec.id, prev ? combineRepairRecords(prev, rec) : rec);
    }
  }
  return Array.from(map.values());
}

/**
 * Un mismo celular a veces queda con dos folios: el oficial y uno reconstruido
 * del ticket, o un segundo alta si la recepción se reintentó. Se deja una ficha.
 */
export function foldRepairDuplicates(records: RepairRecord[]): RepairRecord[] {
  const unique = mergeRepairSources(records);
  const leftover: RepairRecord[] = [];
  const pendingByShop = new Map<string, RepairRecord[]>();

  for (const rec of unique) {
    if (!isPendingRepair(rec)) {
      leftover.push(rec);
      continue;
    }
    const identity = repairShopIdentity(rec);
    if (!identity) {
      leftover.push(rec);
      continue;
    }
    const group = pendingByShop.get(identity) || [];
    group.push(rec);
    pendingByShop.set(identity, group);
  }

  const closedFingerprints = new Set(
    leftover.map((row) => repairFingerprint(row)).filter(Boolean)
  );

  for (const group of pendingByShop.values()) {
    const winner = group.reduce((best, row) => {
      const pick = preferRepairRecord(best, row);
      const other = pick.id === best.id ? row : best;
      return combineRepairRecords(other, pick);
    });
    const fp = repairFingerprint(winner);
    if (fp && closedFingerprints.has(fp)) continue;
    leftover.push(winner);
  }

  return leftover;
}

export function assembleRepairRecords(...lists: Array<RepairRecord[] | undefined>): RepairRecord[] {
  return foldRepairDuplicates(mergeRepairSources(...lists));
}

export function findPendingDuplicate(
  records: RepairRecord[],
  candidate: Pick<RepairRecord, 'branchId' | 'clientPhone' | 'deviceModel'> &
    Partial<Pick<RepairRecord, 'id' | 'receivedAtIso' | 'receivedAt'>>
): RepairRecord | null {
  const identity = repairShopIdentity(candidate);
  if (!identity) return null;
  return (
    records.find(
      (row) =>
        isPendingRepair(row) &&
        row.id !== (candidate.id || '') &&
        repairShopIdentity(row) === identity
    ) || null
  );
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
    if (ticket.estado === 'CANCELADA') continue;
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
        status: prev?.status || 'en_taller',
        workStage: prev?.workStage || 'recibido',
        receivedAt: meta?.receivedAt || prev?.receivedAt || '',
        receivedAtIso: prev?.receivedAtIso || ticket.timestamp,
        operatorName: ticket.operatorName || prev?.operatorName || '',
        branchId: normalizeBranchId(ticket.branchId || prev?.branchId),
        deliveredAt: prev?.deliveredAt,
        deliveredAtIso: prev?.deliveredAtIso,
        deliveredByName: prev?.deliveredByName,
        deliveryTicketId: prev?.deliveryTicketId
      };

      if (meta?.repairType === 'saldo_final' || meta?.repairType === 'pago_total') {
        rec.status = 'entregado';
        rec.workStage = 'para_entrega';
        rec.pendingBalance = 0;
        rec.deliveredAt = meta.deliveredAt || prev?.deliveredAt;
        rec.deliveredAtIso = ticket.timestamp;
        rec.deliveredByName = ticket.operatorName;
        rec.deliveryTicketId = ticket.folio || ticket.id;
      }

      byId.set(id, prev ? combineRepairRecords(prev, rec) : rec);
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
