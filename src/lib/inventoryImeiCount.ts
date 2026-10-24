import type { InventoryMovement, Product, SaleTicket } from '../types';
import { getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { safeFormatDate } from './dateUtils';
import {
  canonicalImei,
  collectSoldImeisFromHistory,
  findImeiOnCatalog,
  imeisEqual,
  normalizeImei
} from './imeiInventory';
import { listExistingEquipmentRows, type EquipmentCountRow } from './inventoryEquipmentExcel';
import { downloadXlsx, type ExcelSheet } from './xlsxMinimal';

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

export function extraKindLabel(row: ImeiCountExtra): string {
  if (row.kind === 'other_branch') {
    return `Está en ${row.branchName || 'otra sucursal'}`;
  }
  if (row.kind === 'sold') return 'Ya vendido';
  return 'En físico, no está en el sistema';
}

export function buildImeiCountReportSheet(params: {
  result: ImeiCountResult;
  branchId?: string;
}): ExcelSheet {
  const branchName = getBranchDisplayName(params.branchId || 'b-matriz');
  const missing = params.result.rows.filter((row) => !row.found);
  const extras = params.result.extras;
  const rows: ExcelSheet['rows'] = [
    ['Informe de conteo IMEI', '', '', ''],
    ['Sucursal', branchName, '', ''],
    ['Fecha', safeFormatDate(new Date().toISOString()), '', ''],
    ['En sistema', params.result.rows.length, '', ''],
    ['Contados', params.result.foundCount, '', ''],
    ['No marcados', params.result.missingCount, '', ''],
    ['No detectados', extras.length, '', ''],
    ['', '', '', ''],
    ['NO MARCADOS (en sistema, no en físico)', '', '', ''],
    ['Modelo', 'Código interno', 'Fecha de ingreso', 'IMEI']
  ];
  if (missing.length === 0) {
    rows.push(['Sin IMEI sin marcar', '', '', '']);
  } else {
    for (const row of missing) {
      rows.push([row.model, row.code, row.enteredAtLabel, row.imei]);
    }
  }
  rows.push(['', '', '', '']);
  rows.push(['NO DETECTADOS (en físico, no en esta sucursal)', '', '', '']);
  rows.push(['IMEI', 'Motivo', 'Modelo', '']);
  if (extras.length === 0) {
    rows.push(['Sin IMEI no detectados', '', '', '']);
  } else {
    for (const row of extras) {
      rows.push([row.imei, extraKindLabel(row), row.model || '', '']);
    }
  }
  return { name: 'Informe', rows };
}

export function downloadImeiCountReport(params: {
  result: ImeiCountResult;
  branchId?: string;
}): void {
  const branchId = params.branchId || 'b-matriz';
  const branchTag = getBranchDisplayName(branchId).toLowerCase().replace(/\s+/g, '-');
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadXlsx(`informe-conteo-imei-${branchTag}-${dateTag}.xlsx`, [
    buildImeiCountReportSheet(params)
  ]);
}
