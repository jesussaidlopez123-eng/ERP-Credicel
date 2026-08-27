import { CartItem, Product } from '../types';

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
  if (product.branchStock && product.branchStock[branchId] !== undefined) {
    return Number(product.branchStock[branchId]) || 0;
  }
  return Number(product.stock) || 0;
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
  const needle = (rawImei || '').trim().toUpperCase();
  if (!needle) return { status: 'missing' };

  let otherBranchHit: { product: Product; branchId: string } | null = null;

  for (const p of products) {
    if (p.inventoryType !== 'equipo' && p.category !== 'equipo_credito' && p.category !== 'telefonia') {
      continue;
    }

    const map = p.branchImeiMap || {};
    const currentList = map[currentBranchId] || [];
    if (currentList.some((im) => String(im).toUpperCase() === needle)) {
      return { status: 'found', product: p, branchId: currentBranchId };
    }

    for (const [bId, list] of Object.entries(map)) {
      if (bId === currentBranchId) continue;
      if ((list || []).some((im) => String(im).toUpperCase() === needle)) {
        otherBranchHit = { product: p, branchId: bId };
      }
    }
  }

  if (otherBranchHit) {
    return { status: 'other_branch', product: otherBranchHit.product, branchId: otherBranchHit.branchId };
  }

  // Legacy records without per-branch IMEI map: only accept if listed globally
  // AND there is no evidence it belongs to another branch.
  for (const p of products) {
    if (p.inventoryType !== 'equipo' && p.category !== 'equipo_credito' && p.category !== 'telefonia') {
      continue;
    }
    if (p.branchImeiMap && Object.keys(p.branchImeiMap).length > 0) continue;
    const allImeis = p.imeiList || (p.imei ? [p.imei] : []);
    if (allImeis.some((im) => String(im).toUpperCase() === needle)) {
      return { status: 'found', product: p, branchId: currentBranchId };
    }
  }

  return { status: 'missing' };
}

export function branchDisplayShort(branchId: string): string {
  if (branchId === 'b-bodega') return 'Bodega';
  if (branchId === 'b-navojoa') return 'Navojoa';
  if (branchId === 'b-huatabampo') return 'Huatabampo';
  return branchId;
}
