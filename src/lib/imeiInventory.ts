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

export function imeiDigits(raw?: string | null): string {
  return String(raw || '').replace(/\D/g, '');
}

/** Prefijo AIM del lector (]C1, ]A0, ]C…). No come el primer dígito del IMEI. */
export function stripScannerImeiPrefix(raw?: string | null): string {
  const s = String(raw || '').replace(/\s+/g, '');
  const rest = (body: string) => body.replace(/^[^0-9]+/, '');
  const aim3 = s.match(/^(\][A-Za-z][0-9A-Za-z])([\s\S]*)$/);
  if (aim3 && imeiDigits(aim3[2]).length === 15) return rest(aim3[2]);
  const aim2 = s.match(/^(\][A-Za-z])([\s\S]*)$/);
  if (aim2) return rest(aim2[2]);
  return rest(s);
}

/** Dígito verificador IMEI (Luhn). Algunos equipos baratos no lo cumplen: solo es pista. */
export function imeiLuhnOk(digits?: string | null): boolean {
  const d = String(digits || '');
  if (!/^\d{15}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(d[14 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

function uniqueLuhnWindows(digits: string): string[] {
  const found: string[] = [];
  for (let i = 0; i + 15 <= digits.length; i++) {
    const w = digits.slice(i, i + 15);
    if (imeiLuhnOk(w) && !found.includes(w)) found.push(w);
  }
  return found;
}

/**
 * Elige 15 dígitos cuando el lector manda de más.
 * 16: si el primero no es IMEI y sobra un 0/1, toma los últimos 15.
 * Más de 17: no recorta a ciegas; solo si hay una ventana Luhn única.
 */
function pickFifteenFromDigits(digits: string): string {
  if (digits.length === 15) return digits;
  if (digits.length < 15) return digits;
  const first = digits.slice(0, 15);
  const last = digits.slice(-15);
  if (first === last) return first;
  const firstOk = imeiLuhnOk(first);
  const lastOk = imeiLuhnOk(last);
  const windows = uniqueLuhnWindows(digits);

  if (digits.length === 16) {
    if (firstOk) return first;
    if (lastOk && !firstOk && (digits[0] === '0' || digits[0] === '1')) return last;
    return first;
  }

  if (windows.length === 1) return windows[0];
  if (firstOk && !lastOk) return first;
  if (lastOk && !firstOk) return last;
  if (digits.length === 17) return first;
  return digits;
}

/** El lector a veces manda letras, 14 o 17 dígitos; el inventario guarda 15. */
export function imeisEqual(a?: string | null, b?: string | null): boolean {
  const na = normalizeImei(a);
  const nb = normalizeImei(b);
  if (na && nb && na === nb) return true;
  const ca = canonicalImei(a);
  const cb = canonicalImei(b);
  if (ca && cb && ca === cb) return true;
  const da = imeiDigits(stripScannerImeiPrefix(a));
  const db = imeiDigits(stripScannerImeiPrefix(b));
  if (!da || !db || da.length < 14 || db.length < 14) return false;
  if (da === db) return true;
  const longer = da.length > db.length ? da : db;
  const shorter = da.length > db.length ? db : da;
  return longer.length === 15 && shorter.length === 14 && longer.startsWith(shorter);
}

/**
 * Forma estable para guardar. Un IMEI de 15 dígitos no se recorta ni se reescribe.
 * Si el lector mandó ]C1 u otro prefijo, se quita y quedan los 15 del celular.
 */
export function canonicalImei(raw?: string | null): string {
  const trimmed = normalizeImei(raw);
  if (!trimmed) return '';
  const stripped = stripScannerImeiPrefix(trimmed);
  const digits = imeiDigits(stripped);
  if (digits.length >= 14) return pickFifteenFromDigits(digits);
  return trimmed;
}

/** True si el texto parece un IMEI (con o sin prefijo AIM), no un código de accesorio. */
export function looksLikeImeiScan(raw?: string | null): boolean {
  return imeiDigits(stripScannerImeiPrefix(raw)).length >= 8;
}

/**
 * Forma para guardar en anaquel. Vacío si vinieron dos IMEI pegados u otro recorte ambiguo.
 * Un código corto (HUA111) se conserva; un IMEI de 15 no se reescribe.
 */
export function imeiForStorage(raw?: string | null): string {
  const n = canonicalImei(raw);
  if (!n) return '';
  if (imeiDigits(n).length > 15) return '';
  return n;
}

/**
 * IMEI del ticket: el que ya está en el anaquel si coincide; si no, 15 dígitos limpios.
 * Nunca deja el prefijo del lector (]C1…).
 */
export function resolveSaleImei(raw?: string | null, product?: Product | null): string {
  const stored = product ? storedImeiInList(collectProductImeis(product), raw) : undefined;
  if (stored) return stored;
  return imeiForStorage(raw) || normalizeImei(raw);
}

export function listHasImei(list: Iterable<string> | undefined, raw?: string | null): boolean {
  if (!raw) return false;
  for (const im of list || []) {
    if (imeisEqual(im, raw)) return true;
  }
  return false;
}

export function storedImeiInList(list: Iterable<string> | undefined, raw?: string | null): string | undefined {
  if (!raw) return undefined;
  for (const im of list || []) {
    if (imeisEqual(im, raw)) return im;
  }
  return undefined;
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
  if (!listHasImei(list, imei)) list.push(imei);
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

export function locateImeiOnProduct(
  product: Product,
  rawImei: string
): { branchId: string; hidden: boolean; unassigned?: boolean } | null {
  const needle = normalizeImei(rawImei);
  if (!needle && !imeiDigits(rawImei)) return null;
  const grouped = canonicalBranchImeiMap(product);
  for (const branch of ['b-navojoa', 'b-huatabampo', 'b-matriz'] as const) {
    if ((grouped[branch] || []).some((im) => imeisEqual(im, rawImei))) {
      const rawHasCanonical = ((product.branchImeiMap || {})[branch] || []).some((im) => imeisEqual(im, rawImei));
      return { branchId: branch, hidden: !rawHasCanonical };
    }
  }
  const loose = [...(product.imeiList || []), ...(product.imeis || []), product.imei || ''];
  if (loose.some((im) => imeisEqual(im, rawImei))) {
    // Lista plana sin sucursal: no pertenece a ninguna tienda hasta que el encargado lo asigne.
    return { branchId: '', hidden: true, unassigned: true };
  }
  return null;
}

/** IMEIs por sucursal canónica. No mete a Matriz los que solo viven en imeiList. */
export function canonicalBranchImeiMap(product: Product): Record<InventoryBranchId, string[]> {
  const clean = emptyBranchImeiMap();
  const seen: string[] = [];
  const order: InventoryBranchId[] = ['b-navojoa', 'b-huatabampo', 'b-matriz'];
  const map = product.branchImeiMap || {};

  const ingest = (rawKey: string, list: string[]) => {
    const dest = toInventoryBranchId(rawKey);
    for (const raw of list || []) {
      const n = normalizeImei(raw);
      if (!n || listHasImei(seen, n)) continue;
      seen.push(n);
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
  const mapped: string[] = [];
  const grouped = canonicalBranchImeiMap(product);
  for (const branch of INVENTORY_BRANCH_IDS) {
    for (const im of grouped[branch]) mapped.push(im);
  }
  return collectProductImeis(product).filter((im) => !listHasImei(mapped, im));
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
    if (!n || seen.has(n) || listHasImei(seen, n) || listHasImei(extraClean, n)) continue;
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

/** Si el equipo ya vive en una sola sucursal, esa es la destino. No adivina Matriz. */
export function inferEquipmentDest(product: Product): InventoryBranchId | undefined {
  const grouped = canonicalBranchImeiMap(product);
  const filled = INVENTORY_BRANCH_IDS.filter((id) => (grouped[id] || []).length > 0);
  if (filled.length === 1) return filled[0];
  return undefined;
}

/**
 * Cierra altas nuevas: si hay IMEI sueltos y se sabe la sucursal, los asigna.
 * Sin destino no los manda a Matriz (eso era el desperfecto).
 */
export function sealEquipmentWrite(product: Product, destBranchId?: string): Product {
  if (!isEquipmentProduct(product)) return product;
  const next = sanitizeEquipmentProduct(product);
  const orphans = unmappedImeis(next);
  if (orphans.length === 0) return next;
  const dest = destBranchId ? toInventoryBranchId(destBranchId) : inferEquipmentDest(next);
  if (!dest) return next;
  return addImeisToProduct(next, dest, orphans);
}

export function addImeisToProduct(product: Product, branchId: string, rawImeis: string[]): Product {
  const dest = toInventoryBranchId(branchId);
  const map = canonicalBranchImeiMap(product);
  let extras = unmappedImeis(product);
  const added: string[] = [];
  for (const raw of rawImeis) {
    const n = imeiForStorage(raw);
    if (!n) continue;
    const stored =
      storedImeiInList(
        INVENTORY_BRANCH_IDS.flatMap((key) => map[key]),
        n
      ) || storedImeiInList(extras, n);
    const keep = stored && imeiDigits(stored).length === 15 ? stored : n;
    for (const key of INVENTORY_BRANCH_IDS) {
      map[key] = map[key].filter((im) => !imeisEqual(im, n));
    }
    extras = extras.filter((im) => !imeisEqual(im, n));
    if (!listHasImei(added, keep) && !listHasImei(map[dest], keep)) {
      added.push(keep);
      map[dest].push(keep);
    }
  }
  return rebuildEquipmentFromMap(product, map, extras);
}

export function removeImeisFromProduct(product: Product, rawImeis: string[]): Product {
  const needles = rawImeis.map(normalizeImei).filter(Boolean);
  if (needles.length === 0) return sanitizeEquipmentProduct(product);
  const matchesSold = (im: string) => needles.some((n) => imeisEqual(im, n));
  const map = canonicalBranchImeiMap(product);
  for (const key of INVENTORY_BRANCH_IDS) {
    map[key] = map[key].filter((im) => !matchesSold(im));
  }
  const extras = unmappedImeis(product).filter((im) => !matchesSold(im));
  return rebuildEquipmentFromMap(product, map, extras);
}

export function moveImeisOnProduct(product: Product, fromBranchId: string, toBranchId: string, rawImeis: string[]): Product {
  const dest = toInventoryBranchId(toBranchId);
  void fromBranchId;
  const map = canonicalBranchImeiMap(product);
  let extras = unmappedImeis(product);
  const moved: string[] = [];
  for (const raw of rawImeis) {
    const n = imeiForStorage(raw) || normalizeImei(raw);
    if (!n) continue;
    const stored =
      storedImeiInList(
        INVENTORY_BRANCH_IDS.flatMap((key) => map[key]),
        n
      ) || storedImeiInList(extras, n) || n;
    for (const key of INVENTORY_BRANCH_IDS) {
      map[key] = map[key].filter((im) => !imeisEqual(im, n));
    }
    extras = extras.filter((im) => !imeisEqual(im, n));
    if (!listHasImei(moved, stored) && !listHasImei(map[dest], stored)) {
      moved.push(stored);
      map[dest].push(stored);
    }
  }
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

/** Ticket anulado: no descuenta IMEI ni se trata como venta. */
export function isCancelledSaleTicket(ticket?: SaleTicket | null): boolean {
  return String(ticket?.estado || '').toUpperCase() === 'CANCELADA';
}

function ticketSellsPhoneImei(item: SaleTicket['items'][number]): string {
  const imei = canonicalImei(item.metadata?.imei) || normalizeImei(item.metadata?.imei);
  if (!imei) return '';
  if (item.metadata?.saleType === 'abono' || item.metadata?.repairType) return '';
  if (isPhoneUnitSale(item) || item.metadata?.saleType === 'contado' || item.metadata?.saleType === 'credito') {
    return imei;
  }
  return '';
}

export function collectSoldImeis(tickets: SaleTicket[]): Set<string> {
  const sold = new Set<string>();
  for (const ticket of tickets || []) {
    if (isCancelledSaleTicket(ticket)) continue;
    for (const item of ticket.items || []) {
      const imei = ticketSellsPhoneImei(item);
      if (imei) sold.add(imei);
    }
  }
  return sold;
}

/** IMEI que salieron por movimiento de venta (kardex reciente), además de tickets. */
export function collectSoldImeisFromMovements(movements: InventoryMovement[]): Set<string> {
  const sold = new Set<string>();
  for (const mov of movements || []) {
    const kind = String(mov.type || '')
      .toLowerCase()
      .trim();
    if (kind !== 'venta') continue;
    for (const raw of mov.imeis || []) {
      const n = canonicalImei(raw) || normalizeImei(raw);
      if (n) sold.add(n);
    }
  }
  return sold;
}

export function collectSoldImeisFromHistory(
  tickets: SaleTicket[] = [],
  movements: InventoryMovement[] = []
): Set<string> {
  const sold = collectSoldImeis(tickets);
  for (const imei of collectSoldImeisFromMovements(movements)) {
    if (![...sold].some((existing) => imeisEqual(existing, imei))) sold.add(imei);
  }
  return sold;
}

export function findImeiOnCatalog(
  products: Product[],
  rawImei: string
): { product: Product; branchId: string } | null {
  const needle = normalizeImei(rawImei);
  if (!needle) return null;
  for (const product of products || []) {
    const loc = locateImeiOnProduct(product, needle);
    if (loc) return { product, branchId: loc.unassigned ? '' : loc.branchId };
    if (collectProductImeis(product).some((im) => imeisEqual(im, rawImei))) {
      return { product, branchId: '' };
    }
  }
  return null;
}

export function findSoldImeiTicket(tickets: SaleTicket[] | undefined, rawImei: string): SaleTicket | undefined {
  const needle = normalizeImei(rawImei);
  if (!needle) return undefined;
  for (const ticket of tickets || []) {
    if (isCancelledSaleTicket(ticket)) continue;
    for (const item of ticket.items || []) {
      if (!imeisEqual(item.metadata?.imei, needle)) continue;
      if (ticketSellsPhoneImei(item)) return ticket;
    }
  }
  return undefined;
}

export type EquipmentAuditOrigin = 'humano' | 'sistema';
export type EquipmentAuditKind = 'unassigned' | 'duplicate' | 'sold_listed' | 'stock_mismatch';

export type EquipmentAuditIssue = {
  kind: EquipmentAuditKind;
  origin: EquipmentAuditOrigin;
  imei?: string;
  productId?: string;
  productName?: string;
  productCode?: string;
  detail: string;
};

export type EquipmentInventoryAudit = {
  totals: Record<InventoryBranchId, number>;
  listed: number;
  unassigned: number;
  soldListed: number;
  duplicates: number;
  stockMismatches: number;
  issues: EquipmentAuditIssue[];
  /** Duplicados, vendidos listados o stock ≠ IMEI: el sello no se rompió si esto es falso por huérfanos viejos. */
  imeisSealed: boolean;
};

function setHasImeiLoose(set: Set<string>, raw: string): boolean {
  if (set.has(raw)) return true;
  for (const value of set) {
    if (imeisEqual(value, raw)) return true;
  }
  return false;
}

/**
 * Diagnóstico de anaquel de equipos: IMEI sellados vs descuadre humano o residuo de sistema.
 * No muta el catálogo.
 */
export function auditEquipmentInventory(
  products: Product[],
  tickets: SaleTicket[] = [],
  movements: InventoryMovement[] = []
): EquipmentInventoryAudit {
  const totals: Record<InventoryBranchId, number> = { 'b-matriz': 0, 'b-navojoa': 0, 'b-huatabampo': 0 };
  const issues: EquipmentAuditIssue[] = [];
  const sold = collectSoldImeisFromHistory(tickets, movements);
  const owners = new Map<string, { product: Product; branchLabel: string }[]>();
  let listed = 0;
  let unassigned = 0;
  let soldListed = 0;
  let duplicates = 0;
  let stockMismatches = 0;

  const rememberOwner = (raw: string, product: Product, branchLabel: string) => {
    const key = canonicalImei(raw) || normalizeImei(raw);
    if (!key) return;
    const stored = storedImeiInList(owners.keys(), key) || key;
    const row = owners.get(stored) || [];
    row.push({ product, branchLabel });
    owners.set(stored, row);
  };

  for (const product of products || []) {
    if (!isEquipmentProduct(product) || product.id.startsWith('prod-abono-') || product.id.startsWith('prod-rep-')) {
      continue;
    }
    if (
      product.id === 'prod-equipo-credito-gen' ||
      product.id === 'prod-abono-gen' ||
      product.id === 'prod-recarga-gen' ||
      product.id === 'prod-reparacion-gen'
    ) {
      continue;
    }

    const grouped = canonicalBranchImeiMap(product);
    const orphans = unmappedImeis(product);
    const all = collectProductImeis(product);
    listed += all.length;
    unassigned += orphans.length;

    for (const branch of INVENTORY_BRANCH_IDS) {
      const imeis = grouped[branch] || [];
      totals[branch] += imeis.length;
      for (const imei of imeis) rememberOwner(imei, product, getBranchDisplayName(branch));
      const stockQty = Number(product.branchStock?.[branch] ?? imeis.length);
      if (stockQty !== imeis.length) {
        stockMismatches += 1;
        issues.push({
          kind: 'stock_mismatch',
          origin: 'sistema',
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          detail: `${product.code} ${product.name}: stock de ${getBranchDisplayName(branch)} es ${stockQty} y hay ${imeis.length} IMEI`
        });
      }
    }

    for (const imei of orphans) {
      rememberOwner(imei, product, 'Sin sucursal');
      issues.push({
        kind: 'unassigned',
        origin: 'humano',
        imei,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        detail: `${imei} está en ${product.name} sin tienda. No se perdió: hay que asignarlo a Matriz, Navojoa o Huatabampo.`
      });
    }

    for (const imei of all) {
      if (!setHasImeiLoose(sold, imei)) continue;
      soldListed += 1;
      issues.push({
        kind: 'sold_listed',
        origin: 'sistema',
        imei,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        detail: `${imei} sigue en ${product.name} pero ya hay venta. El anaquel en vivo debería haberlo bajado; se puede limpiar.`
      });
    }

    if (Number(product.stock) !== all.length) {
      stockMismatches += 1;
      issues.push({
        kind: 'stock_mismatch',
        origin: 'sistema',
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        detail: `${product.code} ${product.name}: stock total ${product.stock} vs ${all.length} IMEI`
      });
    }
  }

  for (const [imei, row] of owners) {
    const uniqueProducts = new Set(row.map((r) => r.product.id));
    if (uniqueProducts.size < 2 && row.length < 2) continue;
    if (uniqueProducts.size < 2) continue;
    duplicates += 1;
    issues.push({
      kind: 'duplicate',
      origin: 'humano',
      imei,
      productId: row[0]?.product.id,
      productName: row.map((r) => r.product.name).join(' / '),
      productCode: row[0]?.product.code,
      detail: `${imei} está en más de un modelo (${row.map((r) => `${r.product.code} · ${r.branchLabel}`).join(', ')}). Suele ser un alta o lote duplicado.`
    });
  }

  return {
    totals,
    listed,
    unassigned,
    soldListed,
    duplicates,
    stockMismatches,
    issues: issues.slice(0, 48),
    imeisSealed: soldListed === 0 && duplicates === 0 && stockMismatches === 0
  };
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
    const stillListed = collectProductImeis(updated).filter((im) =>
      [...soldImeis].some((sold) => imeisEqual(im, sold))
    );
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
  let loc: { branchId: string; hidden: boolean; unassigned?: boolean } | null = null;

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
    if (isCancelledSaleTicket(t)) continue;
    const item = (t.items || []).find((i) => imeisEqual(i.metadata?.imei, imei));
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

  if (ticket) {
    return {
      imei,
      status: 'vendido',
      product,
      branchId: loc?.branchId || ticket.branchId,
      branchName: loc
        ? loc.unassigned
          ? 'Sin sucursal asignada'
          : ALL_BRANCHES.find((b) => b.id === loc.branchId)?.name || getBranchDisplayName(loc.branchId)
        : getBranchDisplayName(ticket.branchId),
      wasHidden: Boolean(loc?.hidden),
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
      branchName: loc.unassigned
        ? 'Sin sucursal asignada'
        : ALL_BRANCHES.find((b) => b.id === loc.branchId)?.name || getBranchDisplayName(loc.branchId),
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
