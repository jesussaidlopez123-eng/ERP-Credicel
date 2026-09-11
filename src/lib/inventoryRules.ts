import { CartItem, Product } from '../types';
import { isAdminWorkspace } from '../data/initialBranches';
import { accessoryStockAt, accessoryTotalStock } from './accessoryInventory';
import {
  collectProductImeis,
  imeisAtBranch,
  isEquipmentProduct,
  locateImeiOnProduct,
  normalizeImei
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

export type ImeiLookup =
  | { status: 'found'; product: Product; branchId: string }
  | { status: 'other_branch'; product: Product; branchId: string }
  | { status: 'missing' };

export function findImeiInInventory(
  products: Product[],
  rawImei: string,
  currentBranchId: string
): ImeiLookup {
  const needle = normalizeImei(rawImei);
  if (!needle) return { status: 'missing' };

  let otherBranchHit: { product: Product; branchId: string } | null = null;
  const adminView = isAdminWorkspace(currentBranchId) || currentBranchId === 'all';

  for (const p of products) {
    if (!isEquipmentProduct(p)) continue;
    const loc = locateImeiOnProduct(p, needle);
    if (!loc) continue;
    if (adminView || loc.branchId === currentBranchId) {
      return { status: 'found', product: p, branchId: loc.branchId };
    }
    otherBranchHit = { product: p, branchId: loc.branchId };
  }

  if (otherBranchHit) {
    return { status: 'other_branch', product: otherBranchHit.product, branchId: otherBranchHit.branchId };
  }

  return { status: 'missing' };
}

export function branchDisplayShort(branchId: string): string {
  if (branchId === 'b-matriz') return 'Matriz';
  if (branchId === 'b-navojoa') return 'Navojoa';
  if (branchId === 'b-huatabampo') return 'Huatabampo';
  return branchId;
}
