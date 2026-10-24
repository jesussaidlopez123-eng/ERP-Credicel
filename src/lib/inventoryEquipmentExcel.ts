import type { InventoryMovement, Product, SaleTicket } from '../types';
import { getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { safeFormatDate } from './dateUtils';
import { canonicalImei, imeisAtBranch, isCancelledSaleTicket, isEquipmentProduct, normalizeImei } from './imeiInventory';
import { isPhoneUnitSale } from './saleClassification';
import { downloadXlsx, type ExcelSheet } from './xlsxMinimal';

export type EquipmentCountRow = {
  model: string;
  code: string;
  enteredAt: string;
  enteredAtLabel: string;
  imei: string;
};

const TILL_BRANCHES = ['b-matriz', 'b-navojoa', 'b-huatabampo'] as const;
const COUNT_HEADERS = ['Modelo', 'Código interno', 'Fecha de ingreso', 'IMEI'] as const;

function imeiKey(raw?: string | null): string {
  return canonicalImei(raw) || normalizeImei(raw);
}

function matchesBranchFilter(branchId: string, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  return normalizeBranchId(branchId) === normalizeBranchId(filter);
}

function formatIngresoDate(iso?: string): string {
  if (!iso) return '—';
  const label = safeFormatDate(iso);
  return label && label !== '--/--/----' ? label : '—';
}

/** Primera fecha de ingreso/creación del IMEI; si no hay, el movimiento más viejo que no sea venta. */
export function ingresoDatesByImei(movements: InventoryMovement[] = []): Map<string, string> {
  const preferred = new Map<string, string>();
  const fallback = new Map<string, string>();
  for (const mov of movements) {
    const ts = String(mov.timestamp || '');
    if (!ts) continue;
    const isIngreso = mov.type === 'ingreso' || mov.type === 'creacion';
    const isSale = mov.type === 'venta' || mov.type === 'baja';
    for (const raw of mov.imeis || []) {
      const key = imeiKey(raw);
      if (!key) continue;
      if (isIngreso) {
        const prev = preferred.get(key);
        if (!prev || ts.localeCompare(prev) < 0) preferred.set(key, ts);
      } else if (!isSale) {
        const prev = fallback.get(key);
        if (!prev || ts.localeCompare(prev) < 0) fallback.set(key, ts);
      }
    }
  }
  const out = new Map(fallback);
  for (const [key, ts] of preferred) out.set(key, ts);
  return out;
}

export function countEquipmentByBranch(products: Product[] = []): {
  'b-matriz': number;
  'b-navojoa': number;
  'b-huatabampo': number;
  total: number;
} {
  const counts = { 'b-matriz': 0, 'b-navojoa': 0, 'b-huatabampo': 0, total: 0 };
  for (const product of products) {
    if (!isEquipmentProduct(product)) continue;
    for (const branchId of TILL_BRANCHES) {
      const n = imeisAtBranch(product, branchId).length;
      counts[branchId] += n;
      counts.total += n;
    }
  }
  return counts;
}

function toCountRow(
  product: Pick<Product, 'name' | 'code'>,
  imei: string,
  dates: Map<string, string>
): EquipmentCountRow {
  const enteredAt = dates.get(imeiKey(imei)) || '';
  return {
    model: product.name,
    code: product.code || '',
    enteredAt,
    enteredAtLabel: formatIngresoDate(enteredAt),
    imei
  };
}

function sortCountRows(rows: EquipmentCountRow[]): EquipmentCountRow[] {
  return rows.sort((a, b) => {
    const model = a.model.localeCompare(b.model, 'es');
    if (model) return model;
    const code = a.code.localeCompare(b.code, 'es');
    if (code) return code;
    const date = (a.enteredAt || '').localeCompare(b.enteredAt || '');
    if (date) return date;
    return a.imei.localeCompare(b.imei);
  });
}

export function listExistingEquipmentRows(
  products: Product[] = [],
  branchId = 'all',
  movements: InventoryMovement[] = []
): EquipmentCountRow[] {
  const dates = ingresoDatesByImei(movements);
  const rows: EquipmentCountRow[] = [];
  const branches = branchId === 'all' ? TILL_BRANCHES : [normalizeBranchId(branchId)];
  for (const product of products) {
    if (!isEquipmentProduct(product)) continue;
    for (const bid of branches) {
      if (!hasCashTill(bid)) continue;
      for (const imei of imeisAtBranch(product, bid)) {
        rows.push(toCountRow(product, imei, dates));
      }
    }
  }
  return sortCountRows(rows);
}

export function listSoldEquipmentRows(
  tickets: SaleTicket[] = [],
  branchId = 'all',
  movements: InventoryMovement[] = []
): EquipmentCountRow[] {
  const dates = ingresoDatesByImei(movements);
  const rows: EquipmentCountRow[] = [];
  for (const ticket of tickets) {
    if (isCancelledSaleTicket(ticket)) continue;
    const bid = normalizeBranchId(ticket.branchId);
    if (!matchesBranchFilter(bid, branchId)) continue;
    for (const item of ticket.items || []) {
      if (!isPhoneUnitSale(item)) continue;
      const imei = String(item.metadata?.imei || '').trim();
      if (!imei) continue;
      rows.push(
        toCountRow(
          {
            name: String(item.metadata?.deviceModel || item.product?.name || 'Celular').trim(),
            code: String(item.product?.code || '').trim()
          },
          imei,
          dates
        )
      );
    }
  }
  return sortCountRows(rows);
}

function countRowCells(row: EquipmentCountRow): ExcelSheet['rows'][number] {
  return [row.model, row.code, row.enteredAtLabel, row.imei];
}

export function buildEquipmentInventorySheet(params: {
  products: Product[];
  tickets?: SaleTicket[];
  movements?: InventoryMovement[];
  branchId?: string;
  includeSold?: boolean;
}): ExcelSheet {
  const branchId = params.branchId || 'all';
  const movements = params.movements || [];
  const existing = listExistingEquipmentRows(params.products, branchId, movements);
  const sold = params.includeSold ? listSoldEquipmentRows(params.tickets || [], branchId, movements) : [];
  const rows: ExcelSheet['rows'] = [
    [...COUNT_HEADERS],
    ...existing.map(countRowCells)
  ];
  if (existing.length === 0) {
    rows.push(['Sin equipos en existencia', '', '', '']);
  }

  if (params.includeSold) {
    rows.push(['', '', '', '']);
    rows.push(['IMEI REGISTRADOS COMO VENDIDOS', '', '', '']);
    rows.push([...COUNT_HEADERS]);
    if (sold.length === 0) {
      rows.push(['Sin IMEI vendidos en esta vista', '', '', '']);
    } else {
      for (const row of sold) rows.push(countRowCells(row));
    }
  }

  return { name: 'Equipos', rows };
}

export function downloadEquipmentInventoryExcel(params: {
  products: Product[];
  tickets?: SaleTicket[];
  movements?: InventoryMovement[];
  branchId?: string;
  includeSold?: boolean;
}): void {
  const branchId = params.branchId || 'all';
  const branchTag = branchId === 'all' ? 'consolidado' : getBranchDisplayName(branchId).toLowerCase().replace(/\s+/g, '-');
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadXlsx(`conteo-equipos-${branchTag}-${dateTag}.xlsx`, [
    buildEquipmentInventorySheet(params)
  ]);
}

export function equipmentInventoryTsv(params: {
  products: Product[];
  tickets?: SaleTicket[];
  movements?: InventoryMovement[];
  branchId?: string;
  includeSold?: boolean;
}): string {
  const sheet = buildEquipmentInventorySheet(params);
  return sheet.rows
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))).join('\t'))
    .join('\n');
}
