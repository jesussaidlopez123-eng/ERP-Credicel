import type { Product, SaleTicket } from '../types';
import { getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { safeFormatDate, safeFormatTime } from './dateUtils';
import { ticketFolioLabel } from './ids';
import { imeisAtBranch, isCancelledSaleTicket, isEquipmentProduct } from './imeiInventory';
import { isPhoneUnitSale } from './saleClassification';
import { downloadXlsx, type ExcelSheet } from './xlsxMinimal';

export type EquipmentStockRow = {
  code: string;
  model: string;
  branchId: string;
  branchName: string;
  imei: string;
  price: number;
};

export type SoldEquipmentRow = {
  imei: string;
  model: string;
  branchId: string;
  branchName: string;
  folio: string;
  dateLabel: string;
  clientName: string;
  saleType: string;
};

const TILL_BRANCHES = ['b-matriz', 'b-navojoa', 'b-huatabampo'] as const;

function matchesBranchFilter(branchId: string, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  return normalizeBranchId(branchId) === normalizeBranchId(filter);
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

export function listExistingEquipmentRows(
  products: Product[] = [],
  branchId = 'all'
): EquipmentStockRow[] {
  const rows: EquipmentStockRow[] = [];
  const branches = branchId === 'all' ? TILL_BRANCHES : [normalizeBranchId(branchId)];
  for (const product of products) {
    if (!isEquipmentProduct(product)) continue;
    for (const bid of branches) {
      if (!hasCashTill(bid)) continue;
      for (const imei of imeisAtBranch(product, bid)) {
        rows.push({
          code: product.code || '',
          model: product.name,
          branchId: bid,
          branchName: getBranchDisplayName(bid),
          imei,
          price: Number(product.price) || 0
        });
      }
    }
  }
  rows.sort((a, b) => {
    const branch = a.branchName.localeCompare(b.branchName, 'es');
    if (branch) return branch;
    const model = a.model.localeCompare(b.model, 'es');
    if (model) return model;
    return a.imei.localeCompare(b.imei);
  });
  return rows;
}

function saleTypeLabel(item: SaleTicket['items'][number]): string {
  const meta = item.metadata || {};
  const blob = `${meta.financingPlatform || ''} ${item.product?.name || ''}`.toLowerCase();
  if (blob.includes('payjoy')) return 'PayJoy';
  if (blob.includes('crediya') || blob.includes('credi ya')) return 'CrediYa';
  if (meta.saleType === 'credito') return 'Crédito';
  if (meta.saleType === 'contado') return 'Contado';
  return 'Contado';
}

export function listSoldEquipmentRows(
  tickets: SaleTicket[] = [],
  branchId = 'all'
): SoldEquipmentRow[] {
  const rows: SoldEquipmentRow[] = [];
  for (const ticket of tickets) {
    if (isCancelledSaleTicket(ticket)) continue;
    const bid = normalizeBranchId(ticket.branchId);
    if (!matchesBranchFilter(bid, branchId)) continue;
    for (const item of ticket.items || []) {
      if (!isPhoneUnitSale(item)) continue;
      const imei = String(item.metadata?.imei || '').trim();
      if (!imei) continue;
      rows.push({
        imei,
        model: String(item.metadata?.deviceModel || item.product?.name || 'Celular').trim(),
        branchId: bid,
        branchName: getBranchDisplayName(bid),
        folio: ticketFolioLabel(ticket),
        dateLabel: `${safeFormatDate(ticket.timestamp)} ${safeFormatTime(ticket.timestamp)}`,
        clientName: String(item.metadata?.clientName || '').trim() || 'Mostrador',
        saleType: saleTypeLabel(item)
      });
    }
  }
  rows.sort((a, b) => b.dateLabel.localeCompare(a.dateLabel, 'es'));
  return rows;
}

export function buildEquipmentInventorySheet(params: {
  products: Product[];
  tickets?: SaleTicket[];
  branchId?: string;
  includeSold?: boolean;
}): ExcelSheet {
  const branchId = params.branchId || 'all';
  const existing = listExistingEquipmentRows(params.products, branchId);
  const sold = params.includeSold ? listSoldEquipmentRows(params.tickets || [], branchId) : [];
  const rows: ExcelSheet['rows'] = [
    ['EXISTENTES EN ANAQUEL', '', '', '', '', ''],
    ['Código', 'Modelo', 'Sucursal', 'IMEI', 'Precio', 'Estado'],
    ...existing.map((row) => [row.code, row.model, row.branchName, row.imei, row.price, 'Existente'])
  ];
  if (existing.length === 0) {
    rows.push(['', 'Sin equipos en existencia', '', '', '', '']);
  }
  rows.push(['', '', '', '', '', '']);
  rows.push(['Total existentes', existing.length, '', '', '', '']);

  if (params.includeSold) {
    rows.push(['', '', '', '', '', '']);
    rows.push(['IMEI REGISTRADOS COMO VENDIDOS', '', '', '', '', '']);
    rows.push(['Fecha', 'Folio', 'Sucursal', 'Modelo', 'IMEI', 'Tipo / Cliente']);
    if (sold.length === 0) {
      rows.push(['', 'Sin IMEI vendidos en esta vista', '', '', '', '']);
    } else {
      for (const row of sold) {
        rows.push([row.dateLabel, row.folio, row.branchName, row.model, row.imei, `${row.saleType} · ${row.clientName}`]);
      }
    }
    rows.push(['', '', '', '', '', '']);
    rows.push(['Total vendidos', sold.length, '', '', '', '']);
  }

  return { name: 'Equipos', rows };
}

export function downloadEquipmentInventoryExcel(params: {
  products: Product[];
  tickets?: SaleTicket[];
  branchId?: string;
  includeSold?: boolean;
}): void {
  const branchId = params.branchId || 'all';
  const branchTag = branchId === 'all' ? 'consolidado' : getBranchDisplayName(branchId).toLowerCase().replace(/\s+/g, '-');
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadXlsx(`inventario-equipos-${branchTag}-${dateTag}.xlsx`, [
    buildEquipmentInventorySheet(params)
  ]);
}

export function equipmentInventoryTsv(params: {
  products: Product[];
  tickets?: SaleTicket[];
  branchId?: string;
  includeSold?: boolean;
}): string {
  const sheet = buildEquipmentInventorySheet(params);
  return sheet.rows
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))).join('\t'))
    .join('\n');
}
