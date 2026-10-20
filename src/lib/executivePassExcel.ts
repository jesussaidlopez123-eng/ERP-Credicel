import type { CartItem, SaleTicket } from '../types';
import { getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { isCancelledSale } from './corteCategories';
import { safeDateIsoKey, safeFormatDate, safeFormatTime } from './dateUtils';
import { matchesExecutiveBranch } from './executiveArea';
import { money, ticketFolioLabel } from './ids';
import { classifyExecutiveItem } from './saleClassification';
import { downloadXlsx, type ExcelSheet } from './xlsxMinimal';

export type ExecutivePassCategory = 'abonos' | 'equipos' | 'recargas';

export type ExecutivePassRow = {
  category: ExecutivePassCategory;
  dateKey: string;
  dateLabel: string;
  branchId: string;
  branchName: string;
  name: string;
  platform: string;
  concept: string;
  folio: string;
  operatorName: string;
  amount: number;
};

const SHEETS: { id: ExecutivePassCategory; name: string }[] = [
  { id: 'abonos', name: 'Abonos' },
  { id: 'equipos', name: 'Equipos' },
  { id: 'recargas', name: 'Recargas' }
];

function fold(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ü/g, 'u');
}

/** CrediYa / PayJoy / Contado, según lo capturado o el nombre del producto. */
export function financingLabel(item: CartItem): string {
  const meta = item.metadata || {};
  const blob = `${meta.financingPlatform || ''} ${item.product?.name || ''} ${meta.issueDescription || ''}`;
  const n = fold(blob);
  if (n.includes('payjoy') || n.includes('pay joy')) return 'PayJoy';
  if (n.includes('crediya') || n.includes('credi ya')) return 'CrediYa';
  if (meta.saleType === 'contado' || fold(meta.financingPlatform || '') === 'contado') return 'Contado';
  const raw = String(meta.financingPlatform || '').trim();
  if (raw && fold(raw) !== 'credito') return raw;
  if (meta.saleType === 'credito' || meta.saleType === 'abono' || classifyExecutiveItem(item) === 'abonos') {
    return 'Crédito';
  }
  if (classifyExecutiveItem(item) === 'recargas') return '—';
  return 'Contado';
}

function rowName(item: CartItem, category: ExecutivePassCategory): string {
  const meta = item.metadata || {};
  if (category === 'recargas') {
    return String(meta.phoneNumber || meta.clientName || item.product?.name || 'Recarga').trim();
  }
  return String(meta.clientName || item.product?.name || 'Mostrador').trim() || 'Mostrador';
}

function rowConcept(item: CartItem, category: ExecutivePassCategory): string {
  const meta = item.metadata || {};
  if (category === 'equipos') {
    return String(meta.deviceModel || item.product?.name || 'Celular').trim();
  }
  if (category === 'recargas') {
    return String(meta.carrier || item.product?.name || 'Recarga').trim();
  }
  return String(meta.issueDescription || item.product?.name || 'Abono').trim();
}

function inRange(dateKey: string, from: string, to: string): boolean {
  if (!dateKey || !from || !to) return false;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return dateKey >= start && dateKey <= end;
}

export function listExecutivePassRows(params: {
  tickets: SaleTicket[] | undefined;
  from: string;
  to: string;
  branchId: string;
}): ExecutivePassRow[] {
  const rows: ExecutivePassRow[] = [];

  for (const ticket of params.tickets || []) {
    if (isCancelledSale(ticket)) continue;
    const bid = normalizeBranchId(ticket.branchId);
    if (!hasCashTill(bid)) continue;
    if (!matchesExecutiveBranch(bid, params.branchId)) continue;
    const day = safeDateIsoKey(ticket.timestamp);
    if (!day || !inRange(day, params.from, params.to)) continue;
    const folio = ticketFolioLabel(ticket);
    const dateLabel = `${safeFormatDate(ticket.timestamp)} ${safeFormatTime(ticket.timestamp)}`;
    const branchName = getBranchDisplayName(bid);
    const operatorName = String(ticket.operatorName || '').trim() || 'Cajero';

    (ticket.items || []).forEach((item) => {
      const category = classifyExecutiveItem(item);
      if (category !== 'abonos' && category !== 'equipos' && category !== 'recargas') return;
      const amount = money(Number(item.totalPrice) || 0);
      rows.push({
        category,
        dateKey: day,
        dateLabel,
        branchId: bid,
        branchName,
        name: rowName(item, category),
        platform: financingLabel(item),
        concept: rowConcept(item, category),
        folio,
        operatorName,
        amount
      });
    });
  }

  rows.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
    if (a.dateLabel !== b.dateLabel) return a.dateLabel < b.dateLabel ? -1 : 1;
    return a.folio < b.folio ? -1 : a.folio > b.folio ? 1 : 0;
  });
  return rows;
}

const HEADERS = ['Fecha', 'Sucursal', 'Nombre', 'Plataforma', 'Concepto', 'Folio', 'Vendedor', 'Monto'];

function sheetFor(
  category: ExecutivePassCategory,
  name: string,
  rows: ExecutivePassRow[],
  meta: { periodLabel: string; branchLabel: string }
): ExcelSheet {
  const scoped = rows.filter((row) => row.category === category);
  const total = money(scoped.reduce((sum, row) => sum + row.amount, 0));
  const body =
    scoped.length === 0
      ? [['Sin registros en este periodo']]
      : scoped.map((row) => [
          row.dateLabel,
          row.branchName,
          row.name,
          row.platform,
          row.concept,
          row.folio,
          row.operatorName,
          row.amount
        ]);

  return {
    name,
    rows: [
      [`CREDI CEL — ${name}`],
      ['Periodo', meta.periodLabel],
      ['Sucursal', meta.branchLabel],
      ['Registros', scoped.length],
      [],
      HEADERS,
      ...body,
      [],
      ['TOTAL', '', '', '', '', '', '', scoped.length ? total : 0]
    ]
  };
}

export function buildExecutivePassExcelSheets(params: {
  tickets: SaleTicket[] | undefined;
  from: string;
  to: string;
  branchId: string;
  periodLabel: string;
  branchLabel: string;
}): ExcelSheet[] {
  const rows = listExecutivePassRows(params);
  const meta = { periodLabel: params.periodLabel, branchLabel: params.branchLabel };
  return SHEETS.map((sheet) => sheetFor(sheet.id, sheet.name, rows, meta));
}

export function executivePassExcelFilename(params: { from: string; to: string; branchId: string }): string {
  const branch =
    !params.branchId || params.branchId === 'all'
      ? 'todas'
      : getBranchDisplayName(params.branchId).toLowerCase().replace(/\s+/g, '-');
  return `direccion-abonos-equipos-recargas-${branch}-${params.from}-a-${params.to}`;
}

export function downloadExecutivePassExcel(params: {
  tickets: SaleTicket[] | undefined;
  from: string;
  to: string;
  branchId: string;
  periodLabel: string;
  branchLabel: string;
}): void {
  downloadXlsx(
    executivePassExcelFilename(params),
    buildExecutivePassExcelSheets(params)
  );
}
