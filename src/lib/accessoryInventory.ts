import { Product } from '../types';
import {
  INVENTORY_BRANCH_IDS,
  applyEquipmentIntegrity,
  isEquipmentProduct,
  toInventoryBranchId,
  type InventoryBranchId
} from './imeiInventory';

export function emptyBranchStock(): Record<InventoryBranchId, number> {
  return { 'b-bodega': 0, 'b-navojoa': 0, 'b-huatabampo': 0 };
}

function sumVisible(stock: Record<InventoryBranchId, number>): number {
  return (stock['b-bodega'] || 0) + (stock['b-navojoa'] || 0) + (stock['b-huatabampo'] || 0);
}

function withStock(product: Product, branchStock: Record<InventoryBranchId, number>): Product {
  return {
    ...product,
    branchStock: {
      'b-bodega': Math.max(0, branchStock['b-bodega'] || 0),
      'b-navojoa': Math.max(0, branchStock['b-navojoa'] || 0),
      'b-huatabampo': Math.max(0, branchStock['b-huatabampo'] || 0)
    },
    stock: sumVisible(branchStock)
  };
}

/** Reúne piezas de claves ocultas (`all`, typos) en Bodega, Navojoa o Huatabampo. */
export function visibleAccessoryStock(product: Product): Record<InventoryBranchId, number> {
  const clean = emptyBranchStock();
  const map = product.branchStock || {};
  const keys = Object.keys(map);
  if (keys.length === 0) {
    const leftover = Math.max(0, Number(product.stock) || 0);
    if (leftover > 0) clean['b-bodega'] = leftover;
    return clean;
  }
  for (const [raw, qty] of Object.entries(map)) {
    const n = Math.max(0, Math.round((Number(qty) || 0) * 100) / 100);
    if (n <= 0) continue;
    clean[toInventoryBranchId(raw)] += n;
  }
  return clean;
}

export function accessoryStockAt(product: Product, branchId: string): number {
  return visibleAccessoryStock(product)[toInventoryBranchId(branchId)] || 0;
}

export function accessoryTotalStock(product: Product): number {
  return sumVisible(visibleAccessoryStock(product));
}

export function sanitizeAccessoryProduct(product: Product): Product {
  if (isEquipmentProduct(product)) return product;
  return withStock(product, visibleAccessoryStock(product));
}

export function addAccessoryStock(product: Product, branchId: string, qty: number): Product {
  const dest = toInventoryBranchId(branchId);
  const base = sanitizeAccessoryProduct(product);
  const branchStock = { ...emptyBranchStock(), ...(base.branchStock as Record<InventoryBranchId, number>) };
  branchStock[dest] = (branchStock[dest] || 0) + Math.max(0, qty);
  return withStock(base, branchStock);
}

export function removeAccessoryStock(product: Product, branchId: string, qty: number): Product {
  const dest = toInventoryBranchId(branchId);
  const base = sanitizeAccessoryProduct(product);
  const branchStock = { ...emptyBranchStock(), ...(base.branchStock as Record<InventoryBranchId, number>) };
  let left = Math.max(0, qty);
  const take = (key: InventoryBranchId) => {
    if (left <= 0) return;
    const have = branchStock[key] || 0;
    const n = Math.min(have, left);
    branchStock[key] = have - n;
    left -= n;
  };
  take(dest);
  for (const key of INVENTORY_BRANCH_IDS) {
    if (key === dest) continue;
    take(key);
  }
  return withStock(base, branchStock);
}

export function moveAccessoryStock(
  product: Product,
  fromBranchId: string,
  toBranchId: string,
  qty: number
): Product {
  const from = toInventoryBranchId(fromBranchId);
  const to = toInventoryBranchId(toBranchId);
  const n = Math.max(0, qty);
  const afterOut = removeAccessoryStock(product, from, n);
  return addAccessoryStock(afterOut, to, n);
}

export function applyAccessoryIntegrity(products: Product[]): { next: Product[]; changed: Product[] } {
  const next: Product[] = [];
  const changed: Product[] = [];
  for (const product of products) {
    if (isEquipmentProduct(product)) {
      next.push(product);
      continue;
    }
    const updated = sanitizeAccessoryProduct(product);
    const dirty =
      updated.stock !== product.stock ||
      JSON.stringify(updated.branchStock) !== JSON.stringify(product.branchStock);
    next.push(updated);
    if (dirty) changed.push(updated);
  }
  return { next, changed };
}

export function applyCatalogIntegrity(
  products: Product[],
  soldImeis: Set<string>
): { next: Product[]; changed: Product[] } {
  const equipment = applyEquipmentIntegrity(products, soldImeis);
  const accessories = applyAccessoryIntegrity(equipment.next);
  return { next: accessories.next, changed: [...equipment.changed, ...accessories.changed] };
}
