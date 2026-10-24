import type { InventoryMovement, Product, SaleTicket } from '../types';
import { getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import {
  canonicalImei,
  collectSoldImeisFromHistory,
  findImeiOnCatalog,
  imeisEqual,
  normalizeImei
} from './imeiInventory';
import { listExistingEquipmentRows, type EquipmentCountRow } from './inventoryEquipmentExcel';

export type ImeiCountExpected = EquipmentCountRow & { found: boolean };

export type ImeiCountExtraKind = 'unknown' | 'other_branch' | 'sold';

export type ImeiCountExtra = {
  imei: string;
  kind: ImeiCountExtraKind;
  model?: string;
  branchName?: string;
};

export type ImeiCountResult = {
  rows: ImeiCountExpected[];
  extras: ImeiCountExtra[];
  foundCount: number;
  missingCount: number;
};

export function normalizeScannedImei(raw: string): string {
  return canonicalImei(raw) || normalizeImei(raw);
}

export function expectedImeisForCount(
  products: Product[],
  branchId: string,
  movements: InventoryMovement[] = [],
  tickets: SaleTicket[] = []
): EquipmentCountRow[] {
  const bid = hasCashTill(branchId) ? normalizeBranchId(branchId) : 'b-matriz';
  return listExistingEquipmentRows(products, bid, movements, tickets);
}

function matchesAny(needle: string, list: string[]): boolean {
  return list.some((item) => imeisEqual(item, needle));
}

export function applyImeiCountScan(params: {
  expected: EquipmentCountRow[];
  scanned: string[];
  products?: Product[];
  tickets?: SaleTicket[];
  movements?: InventoryMovement[];
  branchId?: string;
}): ImeiCountResult {
  const scannedKeys = params.scanned.map(normalizeScannedImei).filter(Boolean);
  const uniqueScanned: string[] = [];
  for (const imei of scannedKeys) {
    if (!matchesAny(imei, uniqueScanned)) uniqueScanned.push(imei);
  }

  const rows = params.expected.map((row) => ({
    ...row,
    found: matchesAny(row.imei, uniqueScanned)
  }));

  const sold = collectSoldImeisFromHistory(params.tickets || [], params.movements || []);
  const extras: ImeiCountExtra[] = [];
  const branchId = params.branchId ? normalizeBranchId(params.branchId) : '';

  for (const imei of uniqueScanned) {
    if (rows.some((row) => imeisEqual(row.imei, imei))) continue;
    const loc = findImeiOnCatalog(params.products || [], imei);
    const soldHit = [...sold].some((value) => imeisEqual(value, imei));
    if (soldHit) {
      extras.push({ imei, kind: 'sold', model: loc?.product.name });
      continue;
    }
    if (loc && loc.branchId && loc.branchId !== branchId) {
      extras.push({
        imei,
        kind: 'other_branch',
        model: loc.product.name,
        branchName: getBranchDisplayName(loc.branchId)
      });
      continue;
    }
    extras.push({ imei, kind: 'unknown', model: loc?.product.name });
  }

  return {
    rows,
    extras,
    foundCount: rows.filter((row) => row.found).length,
    missingCount: rows.filter((row) => !row.found).length
  };
}

export function isInventoryHistoryMovement(type?: string): boolean {
  return type === 'ingreso' || type === 'creacion' || type === 'traspaso';
}
