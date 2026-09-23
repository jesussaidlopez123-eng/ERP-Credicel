import { CartItem, Product } from '../types';
import { isAdminWorkspace } from '../data/initialBranches';
import { accessoryStockAt, accessoryTotalStock } from './accessoryInventory';
import {
  collectProductImeis,
  imeisAtBranch,
  isEquipmentProduct,
  locateImeiOnProduct,
  normalizeImei,
  toInventoryBranchId,
  unmappedImeis
} from './imeiInventory';

export const VIRTUAL_POS_PRODUCT_IDS = new Set([
  'prod-equipo-credito-gen',
  'prod-abono-gen',
  'prod-recarga-gen',
  'prod-reparacion-gen',
]);

export function isVirtualPosProduct(product?: Product | null): boolean {
  if (!product) return true;
  if (VIRTUAL_POS_PRODUCT_IDS.has(product.id)) return true;
  if (product.id.startsWith('prod-abono-')) return true;
  if (product.id.startsWith('prod-rep-')) return true;
  return false;
}

export function isNonInventorySaleItem(item: CartItem): boolean {
  const product = item.product;
  if (isVirtualPosProduct(product)) return true;
  if (item.metadata?.repairType) return true;
  if (item.metadata?.rechargeAmount != null || item.metadata?.carrier) return true;
  if (item.metadata?.saleType === 'abono') return true;
  const name = (product?.name || '').toLowerCase();
  if (name.includes('abono a crédito') || name.includes('abono a credito')) return true;
  if (product?.category === 'recarga' || product?.category === 'servicio') return true;
  return false;
}

export function getBranchStockQty(product: Product, branchId: string): number {
  if (isAdminWorkspace(branchId) || branchId === 'all') {
    if (isEquipmentProduct(product)) {
      return collectProductImeis(product).length;
    }
    return accessoryTotalStock(product);
  }
  if (isEquipmentProduct(product)) {
    return imeisAtBranch(product, branchId).length;
  }
  return accessoryStockAt(product, branchId);
}

/** Celulares reales en una sucursal. El botón EQ-VENTA no tiene IMEI propio. */
export function realEquipmentStockAt(products: Product[], branchId: string): number {
  return (products || []).reduce((sum, product) => {
    if (isVirtualPosProduct(product) || !isEquipmentProduct(product)) return sum;
    return sum + getBranchStockQty(product, branchId);
  }, 0);
}

export type ImeiLookup =
  | { status: 'found'; product: Product; branchId: string }
  | { status: 'other_branch'; product: Product; branchId: string }
  | { status: 'unassigned'; product: Product }
  | { status: 'missing' };

export function findImeiInInventory(
  products: Product[],
  rawImei: string,
  currentBranchId: string
): ImeiLookup {
  const needle = normalizeImei(rawImei);
  if (!needle) return { status: 'missing' };

  let otherBranchHit: { product: Product; branchId: string } | null = null;
  let unassignedHit: Product | null = null;
  const adminView = isAdminWorkspace(currentBranchId) || currentBranchId === 'all';
  const want = adminView ? '' : toInventoryBranchId(currentBranchId);

  for (const p of products) {
    const loc = locateImeiOnProduct(p, rawImei);
    if (!loc) continue;
    if (loc.unassigned) {
      // No pertenece a ninguna tienda. No se finge que está en el PDV que lo escanea.
      unassignedHit = p;
      continue;
    }
    if (adminView || loc.branchId === want) {
      return { status: 'found', product: p, branchId: loc.branchId };
    }
    if (loc.branchId) otherBranchHit = { product: p, branchId: loc.branchId };
  }

  if (otherBranchHit) {
    return { status: 'other_branch', product: otherBranchHit.product, branchId: otherBranchHit.branchId };
  }
  if (unassignedHit) {
    return { status: 'unassigned', product: unassignedHit };
  }

  return { status: 'missing' };
}

export function unassignedEquipmentCount(products: Product[]): number {
  return (products || []).reduce((sum, product) => {
    if (!isEquipmentProduct(product) || isVirtualPosProduct(product)) return sum;
    return sum + unmappedImeis(product).length;
  }, 0);
}

export function branchDisplayShort(branchId: string): string {
  if (branchId === 'b-matriz') return 'Matriz';
  if (branchId === 'b-navojoa') return 'Navojoa';
  if (branchId === 'b-huatabampo') return 'Huatabampo';
  return branchId;
}

/** Al borrar una venta, el IMEI vuelve a esta sucursal (la de origen, no la del ticket si difieren). */
export function restoreBranchForSaleItem(
  item: { metadata?: { stockBranchId?: string } | null },
  ticketBranchId?: string
): string {
  return toInventoryBranchId(item.metadata?.stockBranchId || ticketBranchId);
}
