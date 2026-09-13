import { CreditAccount, InventoryMovement, Product, SaleTicket } from '../types';
import {
  ALL_BRANCHES,
  BRANCH_IDS,
  getBranchDisplayName,
  isAdminWorkspace,
  normalizeBranchId,
  type BranchId
} from '../data/initialBranches';
import { isPhoneUnitSale } from './saleClassification';

export const INVENTORY_BRANCH_IDS = BRANCH_IDS;
export type InventoryBranchId = BranchId;

export function normalizeImei(raw?: string | null): string {
  return String(raw || '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function isEquipmentProduct(product?: Product | null): boolean {
  if (!product) return false;
  return (
    product.inventoryType === 'equipo' ||
    product.category === 'equipo_credito' ||
    product.category === 'telefonia'
  );
}

/** Solo Matriz, Navojoa o Huatabampo. Administración y claves raras van a Matriz. */
export function toInventoryBranchId(id?: string): InventoryBranchId {
  if (!id || !String(id).trim() || isAdminWorkspace(id)) return 'b-matriz';
  const norm = normalizeBranchId(id);
  if (norm === 'b-matriz' || norm === 'b-navojoa' || norm === 'b-huatabampo') return norm;
  return 'b-matriz';
}

export function emptyBranchImeiMap(): Record<InventoryBranchId, string[]> {
  return { 'b-matriz': [], 'b-navojoa': [], 'b-huatabampo': [] };
}

function uniquePush(list: string[], imei: string): void {
  if (!list.includes(imei)) list.push(imei);
}

/** Todos los IMEI que el producto tiene, en cualquier campo o sucursal (incluso oculta). */
export function collectProductImeis(product: Product): string[] {
  const found: string[] = [];
  const push = (raw?: string | null) => {
    const n = normalizeImei(raw);
    if (n) uniquePush(found, n);
  };
  (product.imeiList || []).forEach(push);
  (product.imeis || []).forEach(push);
  push(product.imei);
  Object.values(product.branchImeiMap || {}).forEach((list) => (list || []).forEach(push));
  return found;
}

export function locateImeiOnProduct(product: Product, rawImei: string): { branchId: string; hidden: boolean } | null {
  const needle = normalizeImei(rawImei);
  if (!needle) return null;
  const grouped = canonicalBranchImeiMap(product);
  for (const branch of ['b-navojoa', 'b-huatabampo', 'b-matriz'] as const) {
    if ((grouped[branch] || []).includes(needle)) {
      const rawHasCanonical = ((product.branchImeiMap || {})[branch] || []).some(
        (im) => normalizeImei(im) === needle
      );
      return { branchId: branch, hidden: !rawHasCanonical };
    }
  }
  const loose = [...(product.imeiList || []), ...(product.imeis || []), product.imei || ''];
  if (loose.some((im) => normalizeImei(im) === needle)) {
    return { branchId: 'b-matriz', hidden: true };
  }
  return null;
}

/** IMEIs por sucursal canónica. No mete a Matriz los que solo viven en imeiList. */
export function canonicalBranchImeiMap(product: Product): Record<InventoryBranchId, string[]> {
  const clean = emptyBranchImeiMap();
  const seen = new Set<string>();
  const order: InventoryBranchId[] = ['b-navojoa', 'b-huatabampo', 'b-matriz'];
  const map = product.branchImeiMap || {};

  const ingest = (rawKey: string, list: string[]) => {
    const dest = toInventoryBranchId(rawKey);
    for (const raw of list || []) {
      const n = normalizeImei(raw);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      clean[dest].push(n);
    }
  };

  for (const key of order) ingest(key, map[key] || []);
  for (const [key, list] of Object.entries(map)) {
    if (order.includes(key as InventoryBranchId)) continue;
    ingest(key, list || []);
  }
  return clean;
}

/** IMEIs que están en la lista plana pero no en ninguna sucursal del mapa. */
/** Claves viejas (Bodega, all, typos) que Firestore deja al hacer merge. */
export function staleInventoryMapKeys(map?: Record<string, unknown> | null): string[] {
  return Object.keys(map || {}).filter((key) => !INVENTORY_BRANCH_IDS.includes(key as InventoryBranchId));
}

export function unmappedImeis(product: Product): string[] {
  const mapped = new Set<string>();
  const grouped = canonicalBranchImeiMap(product);
  for (const branch of INVENTORY_BRANCH_IDS) {
    for (const im of grouped[branch]) mapped.add(im);
  }
  return collectProductImeis(product).filter((im) => !mapped.has(im));
}

function rebuildEquipmentFromMap(
  product: Product,
  map: Record<string, string[]>,
  extras: string[] = []
): Product {
  const clean = canonicalBranchImeiMap({ ...product, branchImeiMap: map });
  const seen = new Set<string>();
  for (const branch of INVENTORY_BRANCH_IDS) {
    for (const im of clean[branch]) seen.add(im);
  }
  const extraClean: string[] = [];
  for (const raw of extras) {
    const n = normalizeImei(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    extraClean.push(n);
  }

  const located = [...clean['b-matriz'], ...clean['b-navojoa'], ...clean['b-huatabampo']];
  const imeiList = [...located, ...extraClean];
  const prevStock = product.branchStock || {};
  const branchStock = {
    ...prevStock,
    'b-matriz': clean['b-matriz'].length,
    'b-navojoa': clean['b-navojoa'].length,
    'b-huatabampo': clean['b-huatabampo'].length
  };

  return {
    ...product,
    branchImeiMap: clean,
    imeiList,
    imeis: imeiList,
    imei: imeiList[0] || '',
    branchStock,
    stock: imeiList.length
  };
}

/**
 * Normaliza claves de sucursal. Los IMEI que solo están en imeiList se conservan
 * en la lista, no se mudan a Matriz.
 */
export function sanitizeEquipmentProduct(product: Product): Product {
  if (!isEquipmentProduct(product)) return product;
  return rebuildEquipmentFromMap(product, product.branchImeiMap || {}, unmappedImeis(product));
}

export function addImeisToProduct(product: Product, branchId: string, rawImeis: string[]): Product {
  const dest = toInventoryBranchId(branchId);
  const map = canonicalBranchImeiMap(product);
  const extras = unmappedImeis(product);
  const added = new Set<string>();
  for (const raw of rawImeis) {
    const n = normalizeImei(raw);
    if (!n) continue;
    added.add(n);
    for (const key of INVENTORY_BRANCH_IDS) {
      map[key] = map[key].filter((im) => im !== n);
    }
    map[dest].push(n);
  }
  return rebuildEquipmentFromMap(product, map, extras.filter((im) => !added.has(im)));
}

export function removeImeisFromProduct(product: Product, rawImeis: string[]): Product {
  const needles = new Set(rawImeis.map(normalizeImei).filter(Boolean));
  if (needles.size === 0) return sanitizeEquipmentProduct(product);
  const map = canonicalBranchImeiMap(product);
  for (const key of INVENTORY_BRANCH_IDS) {
    map[key] = map[key].filter((im) => !needles.has(im));
  }
  const extras = unmappedImeis(product).filter((im) => !needles.has(im));
  return rebuildEquipmentFromMap(product, map, extras);
}

export function moveImeisOnProduct(product: Product, fromBranchId: string, toBranchId: string, rawImeis: string[]): Product {
  const dest = toInventoryBranchId(toBranchId);
  const needles = new Set(rawImeis.map(normalizeImei).filter(Boolean));
  const map = canonicalBranchImeiMap(product);
  for (const key of INVENTORY_BRANCH_IDS) {
    map[key] = map[key].filter((im) => !needles.has(im));
  }
  map[dest] = [...map[dest], ...Array.from(needles)];
  const extras = unmappedImeis(product).filter((im) => !needles.has(im));
  return rebuildEquipmentFromMap(product, map, extras);
}

export function imeisAtBranch(product: Product, branchId: string): string[] {
  const dest = toInventoryBranchId(branchId);
  return canonicalBranchImeiMap(product)[dest] || [];
}

export function imeisGroupedByBranch(product: Product): Record<InventoryBranchId, string[]> {
  const clean = canonicalBranchImeiMap(product);
  return {
    'b-matriz': [...clean['b-matriz']],
    'b-navojoa': [...clean['b-navojoa']],
    'b-huatabampo': [...clean['b-huatabampo']]
  };
}

export function collectSoldImeis(tickets: SaleTicket[]): Set<string> {
  const sold = new Set<string>();
  for (const ticket of tickets || []) {
    for (const item of ticket.items || []) {
      const imei = normalizeImei(item.metadata?.imei);
      if (!imei) continue;
      if (item.metadata?.saleType === 'abono' || item.metadata?.repairType) continue;
      if (isPhoneUnitSale(item) || item.metadata?.saleType === 'contado' || item.metadata?.saleType === 'credito') {
        sold.add(imei);
      }
    }
  }
  return sold;
}

export function applyEquipmentIntegrity(
  products: Product[],
  soldImeis: Set<string>
): { next: Product[]; changed: Product[] } {
  const next: Product[] = [];
  const changed: Product[] = [];
  for (const product of products) {
    if (!isEquipmentProduct(product)) {
      next.push(product);
      continue;
    }
    let updated = sanitizeEquipmentProduct(product);
    const stillListed = collectProductImeis(updated).filter((im) => soldImeis.has(im));
    if (stillListed.length > 0) {
      updated = removeImeisFromProduct(updated, stillListed);
    }
    const dirty =
      JSON.stringify(updated.branchImeiMap) !== JSON.stringify(product.branchImeiMap) ||
      JSON.stringify(updated.imeiList || []) !== JSON.stringify(product.imeiList || []) ||
      updated.stock !== product.stock;
    next.push(updated);
    if (dirty) changed.push(updated);
  }
  return { next, changed };
}

export type ImeiTraceStatus = 'disponible' | 'vendido' | 'baja' | 'no_encontrado';

export type ImeiTraceEvent = {
  at: string;
  type: string;
  label: string;
  branchId?: string;
  branchName?: string;
  ticketId?: string;
  operatorName?: string;
};

export type ImeiTraceResult = {
  imei: string;
  status: ImeiTraceStatus;
  product?: Product;
  branchId?: string;
  branchName?: string;
  wasHidden: boolean;
  ticket?: SaleTicket;
  credit?: CreditAccount;
  events: ImeiTraceEvent[];
};

export function traceImei(
  rawImei: string,
  ctx: {
    products: Product[];
    tickets?: SaleTicket[];
    movements?: InventoryMovement[];
    credits?: CreditAccount[];
  }
): ImeiTraceResult {
  const imei = normalizeImei(rawImei);
  const empty: ImeiTraceResult = { imei, status: 'no_encontrado', wasHidden: false, events: [] };
  if (!imei) return empty;

  const events: ImeiTraceEvent[] = [];
  let product: Product | undefined;
  let loc: { branchId: string; hidden: boolean } | null = null;

  for (const p of ctx.products || []) {
    const hit = locateImeiOnProduct(p, imei);
    if (hit) {
      product = p;
      loc = hit;
      break;
    }
  }

  let ticket: SaleTicket | undefined;
  for (const t of ctx.tickets || []) {
    const item = (t.items || []).find((i) => normalizeImei(i.metadata?.imei) === imei);
    if (!item) continue;
    if (item.metadata?.saleType === 'abono' || item.metadata?.repairType) continue;
    ticket = t;
    events.push({
      at: t.timestamp,
      type: 'venta',
      label: `Vendido en ticket ${t.folio || t.id} · ${item.product?.name || 'Equipo'}`,
      branchId: t.branchId,
      branchName: getBranchDisplayName(t.branchId),
      ticketId: t.folio || t.id,
      operatorName: t.operatorName
    });
    break;
  }

  for (const mov of ctx.movements || []) {
    if (!(mov.imeis || []).some((im) => normalizeImei(im) === imei)) continue;
    const branchId = mov.targetBranchId || mov.sourceBranchId;
    events.push({
      at: mov.timestamp,
      type: mov.type,
      label: mov.details || mov.type,
      branchId,
      branchName: mov.targetBranchName || mov.sourceBranchName || getBranchDisplayName(branchId),
      ticketId: mov.ticketId,
      operatorName: mov.operatorName
    });
  }

  const credit = (ctx.credits || []).find((c) => normalizeImei(c.imei) === imei);

  events.sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  if (ticket && !loc) {
    return {
      imei,
      status: 'vendido',
      product,
      branchId: ticket.branchId,
      branchName: getBranchDisplayName(ticket.branchId),
      wasHidden: false,
      ticket,
      credit,
      events
    };
  }

  if (loc && product) {
    const baja = events.some((e) => e.type === 'ajuste' || e.type === 'baja');
    return {
      imei,
      status: baja && collectProductImeis(product).every((im) => im !== imei) ? 'baja' : 'disponible',
      product,
      branchId: loc.branchId,
      branchName: ALL_BRANCHES.find((b) => b.id === loc.branchId)?.name || getBranchDisplayName(loc.branchId),
      wasHidden: loc.hidden,
      ticket,
      credit,
      events
    };
  }

  if (events.length > 0) {
    const last = events[0];
    const isBaja = last.type === 'ajuste' || last.type === 'baja';
    return {
      imei,
      status: isBaja ? 'baja' : ticket ? 'vendido' : 'no_encontrado',
      product,
      branchId: last.branchId,
      branchName: last.branchName,
      wasHidden: false,
      ticket,
      credit,
      events
    };
  }

  return empty;
}
