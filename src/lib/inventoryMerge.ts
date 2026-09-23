import type { Product, SaleTicket } from '../types';
import {
  applyCatalogIntegrity,
  emptyBranchStock,
  sanitizeAccessoryProduct,
  visibleAccessoryStock
} from './accessoryInventory';
import {
  collectProductImeis,
  collectSoldImeis,
  emptyBranchImeiMap,
  canonicalBranchImeiMap,
  canonicalImei,
  imeisEqual,
  isEquipmentProduct,
  listHasImei,
  normalizeImei,
  sanitizeEquipmentProduct,
  sealEquipmentWrite,
  inferEquipmentDest,
  storedImeiInList,
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
      if (!storedImeiInList([...loc.keys()], imei)) loc.set(imei, branch);
    }
  }
  return loc;
}

function locationOf(
  loc: Map<string, (typeof INVENTORY_BRANCH_IDS)[number]> | null | undefined,
  imei: string
): (typeof INVENTORY_BRANCH_IDS)[number] | undefined {
  if (!loc) return undefined;
  const exact = loc.get(imei);
  if (exact) return exact;
  for (const [stored, branch] of loc) {
    if (imeisEqual(stored, imei)) return branch;
  }
  return undefined;
}

function setHasImei(set: Set<string>, imei: string): boolean {
  if (set.has(imei)) return true;
  for (const value of set) {
    if (imeisEqual(value, imei)) return true;
  }
  return false;
}

function foldImeis(imeis: Iterable<string>): string[] {
  const out: string[] = [];
  for (const raw of imeis) {
    const n = canonicalImei(raw) || normalizeImei(raw);
    if (!n) continue;
    const existing = storedImeiInList(out, n);
    if (!existing) {
      out.push(n);
      continue;
    }
    const digits = canonicalImei(existing);
    if (existing !== digits && n === digits) {
      out[out.indexOf(existing)] = n;
    }
  }
  return out;
}

function applyEquipmentWrite(server: Product, incoming: Product, base?: InventorySnapshot | null): Product {
  const catalog = { ...server, ...incoming };
  const keep = sanitizeEquipmentProduct(server);
  const serverMap = canonicalBranchImeiMap(keep);
  const incomingMap = canonicalBranchImeiMap(incoming);
  const incomingAll = new Set(collectProductImeis(incoming).map((im) => canonicalImei(im) || normalizeImei(im)).filter(Boolean));
  const serverAll = new Set(collectProductImeis(keep).map((im) => canonicalImei(im) || normalizeImei(im)).filter(Boolean));
  const serverLoc = locationsFromMap(serverMap);
  const incomingLoc = locationsFromMap(incomingMap);

  let baseLoc: Map<string, (typeof INVENTORY_BRANCH_IDS)[number]> | null = null;
  let baseAll = new Set<string>();
  if (base) {
    const baseProd = asProductForStock(incoming, base);
    baseLoc = locationsFromMap(canonicalBranchImeiMap(baseProd));
    baseAll = new Set(
      collectProductImeis(baseProd)
        .map((im) => canonicalImei(im) || normalizeImei(im))
        .filter(Boolean)
    );
  }

  const result = emptyBranchImeiMap();
  const placed: string[] = [];
  const place = (imei: string, branch: (typeof INVENTORY_BRANCH_IDS)[number]) => {
    const form = storedImeiInList([...serverLoc.keys()], imei) || canonicalImei(imei) || imei;
    if (!form || listHasImei(placed, form)) return;
    placed.push(form);
    result[branch].push(form);
  };

  const removed = (imei: string) => Boolean(baseLoc && setHasImei(baseAll, imei) && !setHasImei(incomingAll, imei));

  for (const imei of foldImeis([...serverAll, ...incomingAll])) {
    if (removed(imei)) continue;
    const onServer = locationOf(serverLoc, imei);
    const onIncoming = locationOf(incomingLoc, imei);
    const onBase = locationOf(baseLoc, imei);

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

  const serverOrphans = unmappedImeis(keep).filter((im) => !listHasImei(placed, im) && !removed(im));
  const incomingOrphans = unmappedImeis(incoming).filter((im) => !listHasImei(placed, im) && !removed(im));
  const newOrphans = incomingOrphans.filter((im) => !setHasImei(serverAll, im));

  let destForNew = inferEquipmentDest(incoming);
  if (!destForNew && baseLoc) {
    const addedBranches = INVENTORY_BRANCH_IDS.filter((id) =>
      (incomingMap[id] || []).some((im) => !locationOf(baseLoc, im))
    );
    if (addedBranches.length === 1) destForNew = addedBranches[0];
  }
  if (!destForNew) {
    const addedVsServer = INVENTORY_BRANCH_IDS.filter((id) =>
      (incomingMap[id] || []).some((im) => !locationOf(serverLoc, im))
    );
    if (addedVsServer.length === 1) destForNew = addedVsServer[0];
  }
  if (destForNew) {
    for (const im of newOrphans) place(im, destForNew);
  }

  // Huérfanos viejos de la nube se conservan. Un guardado nuevo sin sucursal ya no se pega suelto.
  const extras = [
    ...serverOrphans.filter((im) => !listHasImei(placed, im)),
    ...incomingOrphans.filter((im) => !listHasImei(placed, im) && setHasImei(serverAll, im))
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
    return isEquipmentProduct(incoming) ? sealEquipmentWrite(incoming) : sanitizeAccessoryProduct(incoming);
  }
  if (isEquipmentProduct(incoming) || isEquipmentProduct(server)) {
    return applyEquipmentWrite(server, incoming, base);
  }
  return applyAccessoryWrite(server, incoming, base);
}

export type PendingInventoryWrite = {
  incoming: Product;
  base?: InventorySnapshot | null;
};

/** Aplica las bajas/altas que este equipo todavía no confirma en la nube. */
export function applyPendingInventoryWrites(
  catalog: Product[],
  writes: PendingInventoryWrite[]
): Product[] {
  if (!writes.length) return catalog;
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const order = catalog.map((p) => p.id);
  for (const write of writes) {
    const incoming = write.incoming;
    if (!incoming?.id) continue;
    const server = byId.get(incoming.id);
    const merged = applyInventoryWrite(server, incoming, write.base);
    if (!byId.has(incoming.id)) order.push(incoming.id);
    byId.set(incoming.id, merged);
  }
  return order.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export function pendingProductWritesFromOutboxPayload(payload: unknown): PendingInventoryWrite[] {
  const writes = (
    payload as {
      writes?: Array<{
        collection?: string;
        id?: string;
        data?: Record<string, unknown>;
        inventoryBase?: InventorySnapshot;
      }>;
    }
  )?.writes;
  if (!Array.isArray(writes)) return [];
  const out: PendingInventoryWrite[] = [];
  for (const write of writes) {
    if (write.collection !== 'products' || !write.id) continue;
    out.push({
      incoming: { id: write.id, ...(write.data || {}) } as Product,
      base: write.inventoryBase || null
    });
  }
  return out;
}

/**
 * Catálogo que ve el mostrador: nube + cola pendiente + IMEI ya vendidos en tickets.
 * Evita que un snapshot viejo vuelva a poner en venta lo que esta caja ya cobró.
 */
export function applyLiveCatalog(params: {
  cloud: Product[];
  pendingWrites?: PendingInventoryWrite[];
  tickets?: SaleTicket[];
  extraSoldImeis?: Iterable<string>;
}): Product[] {
  const overlaid = applyPendingInventoryWrites(params.cloud, params.pendingWrites || []);
  const sold = collectSoldImeis(params.tickets || []);
  for (const raw of params.extraSoldImeis || []) {
    const imei = canonicalImei(raw) || normalizeImei(raw);
    if (imei) sold.add(imei);
  }
  return applyCatalogIntegrity(overlaid, sold).next;
}

