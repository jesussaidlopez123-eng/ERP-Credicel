import type { CartItem, Expense, SaleTicket } from '../types';
import { getBranchDisplayName, normalizeBranchId } from '../data/initialBranches';
import { safeFormatDate, safeFormatTime } from './dateUtils';
import { money, ticketFolioLabel } from './ids';
import { classifySaleItem, paymentBucket, type SaleCategoryKey } from './saleClassification';

export const CORTE_CATEGORY_ORDER: SaleCategoryKey[] = [
  'accesorios',
  'abonos',
  'enganches',
  'reparaciones',
  'recargas'
];

export const CORTE_CATEGORY_META: Record<
  SaleCategoryKey | 'gastos',
  { label: string; countLabel: string; empty: string }
> = {
  accesorios: {
    label: 'Accesorios y Productos de Tienda',
    countLabel: 'pzs',
    empty: 'Sin ventas registradas en esta categoría.'
  },
  abonos: {
    label: 'Abonos a Crédito (CrediYa / PayJoy)',
    countLabel: 'ops',
    empty: 'Sin abonos registrados.'
  },
  enganches: {
    label: 'Enganches de Celular (Financiamiento / Contado)',
    countLabel: 'ops',
    empty: 'Sin enganches registrados.'
  },
  reparaciones: {
    label: 'Taller / Reparaciones',
    countLabel: 'ops',
    empty: 'Sin reparaciones cobradas.'
  },
  recargas: {
    label: 'Recargas de Tiempo Aire',
    countLabel: 'ops',
    empty: 'Sin recargas cobradas.'
  },
  gastos: {
    label: 'Gastos y Salidas de Caja',
    countLabel: 'regs',
    empty: 'Sin gastos registrados.'
  }
};

export type CorteConceptDetail = {
  id: string;
  ticketFolio: string;
  paymentMethod: string;
  time: string;
  dateLabel: string;
  branchId: string;
  branchName: string;
  productName: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  metadata?: CartItem['metadata'];
};

export type CorteConceptGroup = {
  name: string;
  count: number;
  total: number;
  details: CorteConceptDetail[];
};

export type CorteCategoryBreakdown = {
  cashSales: number;
  cardSales: number;
  transferSales: number;
  totalSales: number;
  totalExpenses: number;
  netIncome: number;
  counts: Record<SaleCategoryKey, number>;
  totals: Record<SaleCategoryKey, number>;
  groups: Record<SaleCategoryKey, CorteConceptGroup[]>;
  details: Record<SaleCategoryKey, CorteConceptDetail[]>;
  expenseGroups: CorteConceptGroup[];
  expenseCount: number;
};

function emptyCounts(): Record<SaleCategoryKey, number> {
  return { accesorios: 0, abonos: 0, enganches: 0, reparaciones: 0, recargas: 0 };
}

function emptyGroups(): Record<SaleCategoryKey, CorteConceptGroup[]> {
  return { accesorios: [], abonos: [], enganches: [], reparaciones: [], recargas: [] };
}

function emptyDetails(): Record<SaleCategoryKey, CorteConceptDetail[]> {
  return { accesorios: [], abonos: [], enganches: [], reparaciones: [], recargas: [] };
}

export function isCancelledSale(ticket?: SaleTicket | null): boolean {
  return String(ticket?.estado || '').toUpperCase() === 'CANCELADA';
}

export function corteConceptName(item: CartItem): string {
  const pName = (
    item.product?.name ||
    item.metadata?.repairType ||
    item.metadata?.deviceModel ||
    'Artículo'
  ).toString();
  const lower = pName.toLowerCase();
  if (lower.includes('abono')) {
    const match = pName.match(/Abono.*?\(([^)]+)\)/i);
    return match?.[1] ? `Abono a Crédito (${match[1]})` : 'Abono a Crédito';
  }
  return pName;
}

function itemMoney(item: CartItem): { qty: number; total: number; unit: number } {
  const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
  const total =
    typeof item.totalPrice === 'number'
      ? money(item.totalPrice)
      : money((typeof item.unitPrice === 'number' ? item.unitPrice : 0) * qty);
  const unit = typeof item.unitPrice === 'number' ? money(item.unitPrice) : qty > 0 ? money(total / qty) : total;
  return { qty, total, unit };
}

function sortGroups(groups: CorteConceptGroup[]): CorteConceptGroup[] {
  return [...groups].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
}

export function buildCorteCategoryBreakdown(
  tickets: SaleTicket[] = [],
  expenses: Expense[] = []
): CorteCategoryBreakdown {
  const counts = emptyCounts();
  const totals = emptyCounts();
  const details = emptyDetails();
  const groupMaps: Record<SaleCategoryKey, Map<string, CorteConceptGroup>> = {
    accesorios: new Map(),
    abonos: new Map(),
    enganches: new Map(),
    reparaciones: new Map(),
    recargas: new Map()
  };

  let cashSales = 0;
  let cardSales = 0;
  let transferSales = 0;

  for (const ticket of tickets || []) {
    if (!ticket || isCancelledSale(ticket)) continue;
    const ticketTotal = money(Number(ticket.total) || 0);
    if (ticketTotal > 0) {
      const bucket = paymentBucket(ticket.paymentMethod);
      if (bucket === 'card') cardSales = money(cardSales + ticketTotal);
      else if (bucket === 'transfer') transferSales = money(transferSales + ticketTotal);
      else cashSales = money(cashSales + ticketTotal);
    }

    const folio = ticketFolioLabel(ticket);
    const time = safeFormatTime(ticket.timestamp);
    const dateLabel = `${safeFormatDate(ticket.timestamp)} ${time}`;
    const branchId = normalizeBranchId(ticket.branchId);
    const branchName = getBranchDisplayName(ticket.branchId);

    (ticket.items || []).forEach((item, itemIdx) => {
      if (!item) return;
      const cat = classifySaleItem(item);
      const { qty, total, unit } = itemMoney(item);
      const name = corteConceptName(item);
      const detail: CorteConceptDetail = {
        id: `${ticket.id || 't'}_${itemIdx}_${item.product?.id || itemIdx}`,
        ticketFolio: folio,
        paymentMethod: ticket.paymentMethod || 'Efectivo',
        time,
        dateLabel,
        branchId,
        branchName,
        productName: name,
        qty,
        unitPrice: unit,
        totalPrice: total,
        metadata: item.metadata
      };

      counts[cat] += qty;
      totals[cat] = money(totals[cat] + total);
      details[cat].push(detail);

      const map = groupMaps[cat];
      const existing = map.get(name) || { name, count: 0, total: 0, details: [] };
      existing.count += qty;
      existing.total = money(existing.total + total);
      existing.details.push(detail);
      map.set(name, existing);
    });
  }

  const expenseMap = new Map<string, CorteConceptGroup>();
  let totalExpenses = 0;
  let expenseCount = 0;
  for (const exp of expenses || []) {
    if (!exp) continue;
    const amount = money(Number(exp.amount) || 0);
    const concept = String(exp.concept || 'Gasto general').trim() || 'Gasto general';
    const existing = expenseMap.get(concept) || { name: concept, count: 0, total: 0, details: [] };
    existing.count += 1;
    existing.total = money(existing.total + amount);
    existing.details.push({
      id: exp.id || `${concept}-${expenseCount}`,
      ticketFolio: 'Gasto',
      paymentMethod: '',
      time: safeFormatTime(exp.timestamp || exp.date),
      dateLabel: `${safeFormatDate(exp.timestamp || exp.date)} ${safeFormatTime(exp.timestamp || exp.date)}`,
      branchId: normalizeBranchId(exp.branchId),
      branchName: getBranchDisplayName(exp.branchId),
      productName: concept,
      qty: 1,
      unitPrice: amount,
      totalPrice: amount
    });
    expenseMap.set(concept, existing);
    totalExpenses = money(totalExpenses + amount);
    expenseCount += 1;
  }

  const groups = emptyGroups();
  for (const key of CORTE_CATEGORY_ORDER) {
    groups[key] = sortGroups(Array.from(groupMaps[key].values()));
  }

  const totalSales = money(cashSales + cardSales + transferSales);
  return {
    cashSales,
    cardSales,
    transferSales,
    totalSales,
    totalExpenses,
    netIncome: money(totalSales - totalExpenses),
    counts,
    totals,
    groups,
    details,
    expenseGroups: sortGroups(Array.from(expenseMap.values())),
    expenseCount
  };
}
