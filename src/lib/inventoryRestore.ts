import type { InventoryMovement, Product, SaleTicket } from '../types';
import { getBranchDisplayName } from '../data/initialBranches';
import { accessoryStockAt, addAccessoryStock } from './accessoryInventory';
import {
  addImeisToProduct,
  collectProductImeis,
  collectSoldImeis,
  imeisAtBranch,
  imeisEqual,
  isEquipmentProduct,
  locateImeiOnProduct,
  normalizeImei,
  removeImeisFromProduct,
  toInventoryBranchId,
  type InventoryBranchId
} from './imeiInventory';
import { isVirtualPosProduct } from './inventoryRules';

export const RESTORE_BRANCH_IDS = ['b-huatabampo', 'b-navojoa', 'b-matriz'] as const;

export type RestoreBranchId = (typeof RESTORE_BRANCH_IDS)[number];

export type BranchStockTotals = Record<RestoreBranchId, { phones: number; accessories: number }>;

export type RestoreAction = {
  productId: string;
  productCode: string;
  productName: string;
  kind: 'equipo' | 'accesorio';
  branchId: RestoreBranchId;
  branchName: string;
  imeis: string[];
  accessoryQty: number;
  detail: string;
};

export type InventoryRestoreReport = {
  movementCount: number;
  ticketCount: number;
  current: BranchStockTotals;
  kardex: BranchStockTotals;
  actions: RestoreAction[];
};

const emptyTotals = (): BranchStockTotals => ({
  'b-huatabampo': { phones: 0, accessories: 0 },
  'b-navojoa': { phones: 0, accessories: 0 },
  'b-matriz': { phones: 0, accessories: 0 }
});

const emptyQty = (): Record<InventoryBranchId, number> => ({
  'b-matriz': 0,
  'b-navojoa': 0,
  'b-huatabampo': 0
});

export function isRestoreMovement(movement: InventoryMovement): boolean {
  if (String(movement.id || '').startsWith('mov-rest-')) return true;
  return String(movement.details || '').includes('Restauración de');
}

function movementKind(type?: string): string {
  const t = String(type || '')
    .toLowerCase()
    .trim();
  if (t === 'entrada' || t === 'ingreso' || t === 'creacion') return 'ingreso';
  if (t === 'traspaso') return 'traspaso';
  if (t === 'venta') return 'venta';
  if (t === 'ajuste' || t === 'baja') return 'ajuste';
  return t;
}

function asRestoreBranch(id?: string): RestoreBranchId | '' {
  if (!id) return '';
  const dest = toInventoryBranchId(id);
  if (dest === 'b-huatabampo' || dest === 'b-navojoa' || dest === 'b-matriz') return dest;
  return '';
}

function skipCatalogProduct(product?: Product | null): boolean {
  if (!product) return true;
  if (isVirtualPosProduct(product)) return true;
  if (product.code === 'REC-01' || product.code === 'REP-01') return true;
  return false;
}

function matchProduct(products: Product[], movement: InventoryMovement): Product | undefined {
  if (movement.productId) {
    const byId = products.find((p) => p.id === movement.productId);
    if (byId) return byId;
  }
  if (movement.productCode) {
    return products.find((p) => p.code && p.code === movement.productCode);
  }
  return undefined;
}

function locateImeiAnywhere(
  products: Product[],
  imei: string
): { product: Product; branchId: RestoreBranchId } | null {
  for (const product of products) {
    const hit = locateImeiOnProduct(product, imei);
    if (!hit) continue;
    const branchId = asRestoreBranch(hit.branchId);
    if (!branchId) continue;
    return { product, branchId };
  }
  return null;
}

function sortMovements(movements: InventoryMovement[]): InventoryMovement[] {
  return [...movements].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
}

function currentTotals(products: Product[]): BranchStockTotals {
  const totals = emptyTotals();
  for (const product of products) {
    if (skipCatalogProduct(product)) continue;
    if (isEquipmentProduct(product)) {
      for (const branch of RESTORE_BRANCH_IDS) {
        totals[branch].phones += imeisAtBranch(product, branch).length;
      }
      continue;
    }
    for (const branch of RESTORE_BRANCH_IDS) {
      totals[branch].accessories += accessoryStockAt(product, branch);
    }
  }
  return totals;
}

/**
 * Reconstruye existencias esperadas con el kardex completo.
 * No baja stock si el catálogo tiene más que el kardex: solo propone devolver lo que falte
 * o regresar un IMEI que quedó en otra sucursal.
 */
export function planInventoryRestore(
  products: Product[],
  movements: InventoryMovement[],
  tickets: SaleTicket[]
): InventoryRestoreReport {
  const soldImeis = collectSoldImeis(tickets);
  const replayQty = new Map<string, Record<InventoryBranchId, number>>();
  const replayImei = new Map<string, { branchId: RestoreBranchId; productId: string; productCode: string; productName: string }>();
  const ordered = sortMovements(movements).filter((m) => !isRestoreMovement(m));

  const bump = (productId: string, branch: RestoreBranchId | '', n: number) => {
    if (!branch || !productId) return;
    if (!replayQty.has(productId)) replayQty.set(productId, emptyQty());
    const row = replayQty.get(productId)!;
    row[branch] = Math.max(0, Math.round(((row[branch] || 0) + n) * 100) / 100);
  };

  for (const movement of ordered) {
    const catalog = matchProduct(products, movement);
    if (skipCatalogProduct(catalog)) continue;
    const kind = movementKind(movement.type);
    if (kind === 'precio') continue;

    const dest = asRestoreBranch(movement.targetBranchId);
    const origin = asRestoreBranch(movement.sourceBranchId);
    const qty = Number(movement.quantity) || 0;
    const productId = catalog!.id;

    if (kind === 'traspaso') {
      bump(productId, origin, -Math.abs(qty));
      bump(productId, dest, Math.abs(qty));
    } else if (kind === 'venta') {
      bump(productId, dest || origin, -Math.abs(qty));
    } else if (kind === 'ajuste') {
      if (dest) bump(productId, dest, qty);
      else if (origin) bump(productId, origin, qty);
    } else if (kind === 'ingreso') {
      bump(productId, dest, Math.abs(qty));
    }

    for (const raw of movement.imeis || []) {
      const imei = normalizeImei(raw);
      if (!imei) continue;
      if (kind === 'venta' || (kind === 'ajuste' && qty < 0)) {
        replayImei.delete(imei);
        continue;
      }
      const nextBranch = dest || (kind === 'traspaso' ? dest : origin);
      if (!nextBranch) continue;
      replayImei.set(imei, {
        branchId: nextBranch,
        productId,
        productCode: catalog!.code,
        productName: catalog!.name
      });
    }
  }

  const actions: RestoreAction[] = [];
  const kardex = emptyTotals();

  for (const [imei, state] of replayImei.entries()) {
    if (soldImeis.has(imei)) continue;
    kardex[state.branchId].phones += 1;
    const found = locateImeiAnywhere(products, imei);
    if (found && found.branchId === state.branchId) continue;

    const target =
      (found && products.find((p) => p.id === found.product.id)) ||
      products.find((p) => p.id === state.productId);
    if (!target || skipCatalogProduct(target)) continue;

    const already = actions.find(
      (a) => a.productId === target.id && a.branchId === state.branchId && a.kind === 'equipo'
    );
    if (already) {
      if (!already.imeis.includes(imei)) already.imeis.push(imei);
      already.detail = `${found && found.branchId !== state.branchId ? 'regresar' : 'devolver'} ${already.imeis.length} IMEI a ${getBranchDisplayName(state.branchId)}`;
      continue;
    }

    actions.push({
      productId: target.id,
      productCode: target.code,
      productName: target.name,
      kind: 'equipo',
      branchId: state.branchId,
      branchName: getBranchDisplayName(state.branchId),
      imeis: [imei],
      accessoryQty: 0,
      detail: found
        ? `regresar 1 IMEI de ${getBranchDisplayName(found.branchId)} a ${getBranchDisplayName(state.branchId)}`
        : `devolver 1 IMEI a ${getBranchDisplayName(state.branchId)}`
    });
  }

  for (const product of products) {
    if (skipCatalogProduct(product) || isEquipmentProduct(product)) continue;
    const replay = replayQty.get(product.id) || emptyQty();
    for (const branch of RESTORE_BRANCH_IDS) {
      const expected = replay[branch] || 0;
      kardex[branch].accessories += expected;
      const current = accessoryStockAt(product, branch);
      const missing = Math.round((expected - current) * 100) / 100;
      if (missing <= 0) continue;
      actions.push({
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        kind: 'accesorio',
        branchId: branch,
        branchName: getBranchDisplayName(branch),
        imeis: [],
        accessoryQty: missing,
        detail: `kardex ${expected} · actual ${current} · devolver ${missing}`
      });
    }
  }

  return {
    movementCount: ordered.length,
    ticketCount: tickets.length,
    current: currentTotals(products),
    kardex,
    actions
  };
}

export function applyRestoreActionsToProducts(products: Product[], actions: RestoreAction[]): Product[] {
  const next = new Map(products.map((p) => [p.id, p]));

  for (const action of actions) {
    if (action.kind === 'equipo' && action.imeis.length > 0) {
      for (const product of next.values()) {
        const listed = collectProductImeis(product).filter((im) =>
          action.imeis.some((needle) => imeisEqual(im, needle) || normalizeImei(im) === normalizeImei(needle))
        );
        if (listed.length === 0) continue;
        if (product.id === action.productId) continue;
        next.set(product.id, removeImeisFromProduct(product, listed));
      }
      const target = next.get(action.productId);
      if (!target) continue;
      next.set(action.productId, addImeisToProduct(target, action.branchId, action.imeis));
      continue;
    }

    if (action.kind === 'accesorio' && action.accessoryQty > 0) {
      const target = next.get(action.productId);
      if (!target) continue;
      next.set(action.productId, addAccessoryStock(target, action.branchId, action.accessoryQty));
    }
  }

  return products.map((p) => next.get(p.id) || p);
}

export function summarizeRestoreActions(actions: RestoreAction[]): Record<RestoreBranchId, number> {
  const count: Record<RestoreBranchId, number> = {
    'b-huatabampo': 0,
    'b-navojoa': 0,
    'b-matriz': 0
  };
  for (const action of actions) {
    count[action.branchId] += 1;
  }
  return count;
}
