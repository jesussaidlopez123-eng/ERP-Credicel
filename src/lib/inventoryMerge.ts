import type { Product } from '../types';
import {
  emptyBranchStock,
  sanitizeAccessoryProduct,
  visibleAccessoryStock
} from './accessoryInventory';
import {
  collectProductImeis,
  emptyBranchImeiMap,
  imeisAtBranch,
  isEquipmentProduct,
  normalizeImei,
  sanitizeEquipmentProduct,
  INVENTORY_BRANCH_IDS
} from './imeiInventory';

export type InventorySnapshot = {
  branchStock?: Record<string, number>;
  branchImeiMap?: Record<string, string[]>;
  imeiList?: string[];
  imeis?: string[];
  stock?: number;
};

export function snapshotInventory(product: Product): InventorySnapshot {
  return {
    branchStock: product.branchStock ? { ...product.branchStock } : undefined,
    branchImeiMap: product.branchImeiMap
      ? Object.fromEntries(Object.entries(product.branchImeiMap).map(([k, v]) => [k, [...(v || [])]]))
      : undefined,
    imeiList: product.imeiList ? [...product.imeiList] : undefined,
    imeis: product.imeis ? [...product.imeis] : undefined,
    stock: product.stock
  };
}

function asProductForStock(incoming: Product, snap: InventorySnapshot): Product {
  return {
    ...incoming,
    branchStock: snap.branchStock,
    branchImeiMap: snap.branchImeiMap,
    imeiList: snap.imeiList,
    imeis: snap.imeis,
    stock: snap.stock ?? incoming.stock
  };
}

function applyAccessoryWrite(server: Product, incoming: Product, base?: InventorySnapshot | null): Product {
  const catalog = { ...server, ...incoming };
  const serverVis = visibleAccessoryStock(server);
  const incomingVis = visibleAccessoryStock(incoming);
  const result = emptyBranchStock();

  if (base) {
    const baseVis = visibleAccessoryStock(asProductForStock(incoming, base));
    for (const branch of INVENTORY_BRANCH_IDS) {
      const delta = (incomingVis[branch] || 0) - (baseVis[branch] || 0);
      result[branch] = Math.max(0, (serverVis[branch] || 0) + delta);
    }
  } else {
    // Sin foto previa: no se acepta dejar una sucursal en 0 si la nube aún tiene piezas.
    // Así un guardado viejo de Huatabampo no vuelve a borrar Navojoa.
    for (const branch of INVENTORY_BRANCH_IDS) {
      const incomingQty = incomingVis[branch] || 0;
      const serverQty = serverVis[branch] || 0;
      result[branch] = incomingQty === 0 && serverQty > 0 ? serverQty : incomingQty;
    }
  }

  return sanitizeAccessoryProduct({
    ...catalog,
    branchStock: result,
    stock: result['b-bodega'] + result['b-navojoa'] + result['b-huatabampo']
  });
}

function applyEquipmentWrite(server: Product, incoming: Product, base?: InventorySnapshot | null): Product {
  const catalog = { ...server, ...incoming };
  if (!base) {
    const map = emptyBranchImeiMap();
    const keep = sanitizeEquipmentProduct(server);
    const incomingImeis = new Set(collectProductImeis(incoming).map(normalizeImei).filter(Boolean));
    for (const branch of INVENTORY_BRANCH_IDS) {
      for (const raw of keep.branchImeiMap?.[branch] || []) {
        const imei = normalizeImei(raw);
        if (!imei || incomingImeis.has(imei)) continue;
        map[branch].push(imei);
      }
    }
    for (const branch of INVENTORY_BRANCH_IDS) {
      for (const raw of imeisAtBranch(incoming, branch)) {
        const imei = normalizeImei(raw);
        if (!imei) continue;
        for (const key of INVENTORY_BRANCH_IDS) {
          map[key] = map[key].filter((im) => im !== imei);
        }
        map[branch].push(imei);
      }
    }
    return sanitizeEquipmentProduct({
      ...catalog,
      branchImeiMap: map,
      imeiList: [...map['b-bodega'], ...map['b-navojoa'], ...map['b-huatabampo']]
    });
  }

  const baseImeis = new Set(collectProductImeis(asProductForStock(incoming, base)).map(normalizeImei));
  const incomingImeis = new Set(collectProductImeis(incoming).map(normalizeImei));
  const removed = [...baseImeis].filter((im) => im && !incomingImeis.has(im));

  const map = emptyBranchImeiMap();
  const keep = sanitizeEquipmentProduct(server);
  for (const branch of INVENTORY_BRANCH_IDS) {
    for (const raw of keep.branchImeiMap?.[branch] || []) {
      const imei = normalizeImei(raw);
      if (!imei || removed.includes(imei) || incomingImeis.has(imei)) continue;
      map[branch].push(imei);
    }
  }

  for (const branch of INVENTORY_BRANCH_IDS) {
    for (const raw of imeisAtBranch(incoming, branch)) {
      const imei = normalizeImei(raw);
      if (!imei) continue;
      for (const key of INVENTORY_BRANCH_IDS) {
        map[key] = map[key].filter((im) => im !== imei);
      }
      map[branch].push(imei);
    }
  }

  return sanitizeEquipmentProduct({
    ...catalog,
    branchImeiMap: map,
    imeiList: [...map['b-bodega'], ...map['b-navojoa'], ...map['b-huatabampo']]
  });
}

/** Combina un guardado local con lo que ya está en la nube para no borrar stock de otra sucursal. */
export function applyInventoryWrite(
  server: Product | null | undefined,
  incoming: Product,
  base?: InventorySnapshot | null
): Product {
  if (!server) {
    return isEquipmentProduct(incoming) ? sanitizeEquipmentProduct(incoming) : sanitizeAccessoryProduct(incoming);
  }
  if (isEquipmentProduct(incoming) || isEquipmentProduct(server)) {
    return applyEquipmentWrite(server, incoming, base);
  }
  return applyAccessoryWrite(server, incoming, base);
}

