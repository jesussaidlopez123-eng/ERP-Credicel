import type { Product } from '../types';
import {
  emptyBranchStock,
  sanitizeAccessoryProduct,
  visibleAccessoryStock
} from './accessoryInventory';
import {
  collectProductImeis,
  emptyBranchImeiMap,
  canonicalBranchImeiMap,
  isEquipmentProduct,
  normalizeImei,
  sanitizeEquipmentProduct,
  unmappedImeis,
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
    // Sin foto previa no se baja stock: un guardado viejo con 10 piezas
    // no puede dejar Navojoa en 10 si la nube tiene 155.
    for (const branch of INVENTORY_BRANCH_IDS) {
      result[branch] = Math.max(incomingVis[branch] || 0, serverVis[branch] || 0);
    }
  }

  return sanitizeAccessoryProduct({
    ...catalog,
    branchStock: result,
    stock: INVENTORY_BRANCH_IDS.reduce((n, id) => n + (result[id] || 0), 0)
  });
}

function locationsFromMap(map: Record<string, string[]>): Map<string, (typeof INVENTORY_BRANCH_IDS)[number]> {
  const loc = new Map<string, (typeof INVENTORY_BRANCH_IDS)[number]>();
  for (const branch of INVENTORY_BRANCH_IDS) {
    for (const imei of map[branch] || []) {
      if (!loc.has(imei)) loc.set(imei, branch);
    }
  }
  return loc;
}

function applyEquipmentWrite(server: Product, incoming: Product, base?: InventorySnapshot | null): Product {
  const catalog = { ...server, ...incoming };
  const keep = sanitizeEquipmentProduct(server);
  const serverMap = canonicalBranchImeiMap(keep);
  const incomingMap = canonicalBranchImeiMap(incoming);
  const incomingAll = new Set(collectProductImeis(incoming).map(normalizeImei).filter(Boolean));
  const serverAll = new Set(collectProductImeis(keep).map(normalizeImei).filter(Boolean));
  const serverLoc = locationsFromMap(serverMap);
  const incomingLoc = locationsFromMap(incomingMap);

  let baseLoc: Map<string, (typeof INVENTORY_BRANCH_IDS)[number]> | null = null;
  let baseAll = new Set<string>();
  if (base) {
    const baseProd = asProductForStock(incoming, base);
    baseLoc = locationsFromMap(canonicalBranchImeiMap(baseProd));
    baseAll = new Set(collectProductImeis(baseProd).map(normalizeImei).filter(Boolean));
  }

  const result = emptyBranchImeiMap();
  const placed = new Set<string>();
  const place = (imei: string, branch: (typeof INVENTORY_BRANCH_IDS)[number]) => {
    if (!imei || placed.has(imei)) return;
    placed.add(imei);
    result[branch].push(imei);
  };

  const removed = (imei: string) => Boolean(baseLoc && baseAll.has(imei) && !incomingAll.has(imei));

  for (const imei of new Set([...serverAll, ...incomingAll])) {
    if (removed(imei)) continue;
    const onServer = serverLoc.get(imei);
    const onIncoming = incomingLoc.get(imei);
    const onBase = baseLoc?.get(imei);

    if (!baseLoc) {
      if (onServer) place(imei, onServer);
      else if (onIncoming) place(imei, onIncoming);
      continue;
    }

    if (onBase && onIncoming && onBase !== onIncoming) {
      // Traspaso de este cliente: solo si la nube todavía tiene el IMEI.
      // Si otra caja ya lo vendió, no lo revivimos en el destino.
      if (onServer) place(imei, onIncoming);
      continue;
    }
    if (onServer) {
      place(imei, onServer);
      continue;
    }
    if (onIncoming) {
      // Este cliente no lo movió (sigue donde lo vio). Si la nube ya no lo tiene,
      // otra caja lo descontó: no lo volvemos a escribir.
      if (onBase && onBase === onIncoming) continue;
      place(imei, onIncoming);
    }
  }

  const extras = [
    ...unmappedImeis(keep).filter((im) => !placed.has(im) && !removed(im)),
    ...unmappedImeis(incoming).filter((im) => !placed.has(im) && !removed(im))
  ];

  return sanitizeEquipmentProduct({
    ...catalog,
    branchImeiMap: result,
    imeiList: [...result['b-matriz'], ...result['b-navojoa'], ...result['b-huatabampo'], ...extras],
    imeis: [...result['b-matriz'], ...result['b-navojoa'], ...result['b-huatabampo'], ...extras],
    imei: result['b-matriz'][0] || result['b-navojoa'][0] || result['b-huatabampo'][0] || extras[0] || ''
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

