import { CartItem, SaleTicket } from '../types';
import { money } from './ids';
import { safeDateIsoKey } from './dateUtils';
import { normalizeBranchId } from '../data/initialBranches';

export type SaleCategoryKey = 'accesorios' | 'abonos' | 'enganches' | 'reparaciones' | 'recargas';

export interface CategoryTotals {
  accesoriosTotal: number;
  accesoriosCount: number;
  abonosTotal: number;
  abonosCount: number;
  enganchesTotal: number;
  enganchesCount: number;
  reparacionesTotal: number;
  reparacionesCount: number;
  recargasTotal: number;
  recargasCount: number;
}

export function emptyCategoryTotals(): CategoryTotals {
  return {
    accesoriosTotal: 0,
    accesoriosCount: 0,
    abonosTotal: 0,
    abonosCount: 0,
    enganchesTotal: 0,
    enganchesCount: 0,
    reparacionesTotal: 0,
    reparacionesCount: 0,
    recargasTotal: 0,
    recargasCount: 0,
  };
}

export type ExecutiveCatKey = 'accesorios' | 'equipos' | 'abonos' | 'reparaciones' | 'recargas';

export interface ExecutiveCatTotals {
  accesorios: number;
  equipos: number;
  abonos: number;
  reparaciones: number;
  recargas: number;
  countAccesorios: number;
  countEquipos: number;
  countAbonos: number;
  countReparaciones: number;
  countRecargas: number;
}

export function emptyExecutiveCats(): ExecutiveCatTotals {
  return {
    accesorios: 0,
    equipos: 0,
    abonos: 0,
    reparaciones: 0,
    recargas: 0,
    countAccesorios: 0,
    countEquipos: 0,
    countAbonos: 0,
    countReparaciones: 0,
    countRecargas: 0
  };
}

export function classifyExecutiveItem(item: CartItem): ExecutiveCatKey {
  const sale = classifySaleItem(item);
  if (sale === 'abonos') return 'abonos';
  if (sale === 'recargas') return 'recargas';
  if (sale === 'reparaciones') return 'reparaciones';
  if (sale === 'enganches') return 'equipos';
  const cat = (item.product?.category || '').toLowerCase();
  const inv = (item.product?.inventoryType || '').toLowerCase();
  if (inv === 'equipo' || cat === 'equipo' || cat === 'equipo_credito' || cat === 'telefonia') {
    return 'equipos';
  }
  if (item.metadata?.imei && !item.metadata?.repairType) return 'equipos';
  return 'accesorios';
}

export function addExecutiveItem(totals: ExecutiveCatTotals, item: CartItem): void {
  const key = classifyExecutiveItem(item);
  const tot = money(Number(item.totalPrice) || 0);
  const qty = item.quantity > 0 ? item.quantity : 1;
  totals[key] = money(totals[key] + tot);
  if (key === 'abonos') totals.countAbonos += qty;
  else if (key === 'equipos') totals.countEquipos += qty;
  else if (key === 'reparaciones') totals.countReparaciones += qty;
  else if (key === 'recargas') totals.countRecargas += qty;
  else totals.countAccesorios += qty;
}

export function executiveVentas(totals: ExecutiveCatTotals): number {
  return money(
    totals.accesorios + totals.equipos + totals.abonos + totals.reparaciones + totals.recargas
  );
}

/** Un celular vendido (contado o crédito). No cuenta abonos ni taller. */
export function isPhoneUnitSale(item: CartItem): boolean {
  const sale = classifySaleItem(item);
  if (sale === 'abonos' || sale === 'recargas' || sale === 'reparaciones') return false;
  return classifyExecutiveItem(item) === 'equipos';
}

export function phoneUnitsSold(item: CartItem): number {
  if (!isPhoneUnitSale(item)) return 0;
  return item.quantity > 0 ? item.quantity : 1;
}

/** Línea de corte: equipo de contado va a accesorios/productos, no a enganche. */
export function classifySaleItem(item: CartItem): SaleCategoryKey {
  const pName = (item.product?.name || '').toLowerCase();
  const cat = (item.product?.category || '').toLowerCase();
  const meta = item.metadata;
  const saleType = meta?.saleType;

  if (saleType === 'abono' || pName.includes('abono') || cat === 'abono_credito') {
    return 'abonos';
  }
  if (saleType === 'credito' || pName.includes('enganche')) {
    return 'enganches';
  }
  if (cat === 'recarga' || pName.includes('recarga') || meta?.rechargeAmount != null || meta?.carrier) {
    return 'recargas';
  }
  if (
    meta?.repairType ||
    cat === 'servicio' ||
    pName.includes('anticipo') ||
    pName.includes('reparac') ||
    pName.includes('taller') ||
    pName.includes('liquidaci') ||
    pName.includes('saldo final')
  ) {
    return 'reparaciones';
  }
  return 'accesorios';
}

export function addItemToBreakdown(breakdown: CategoryTotals, item: CartItem): void {
  const key = classifySaleItem(item);
  const tot = money(Number(item.totalPrice) || 0);
  const qty = item.quantity > 0 ? item.quantity : 1;
  if (key === 'abonos') {
    breakdown.abonosTotal = money(breakdown.abonosTotal + tot);
    breakdown.abonosCount += qty;
  } else if (key === 'enganches') {
    breakdown.enganchesTotal = money(breakdown.enganchesTotal + tot);
    breakdown.enganchesCount += qty;
  } else if (key === 'recargas') {
    breakdown.recargasTotal = money(breakdown.recargasTotal + tot);
    breakdown.recargasCount += qty;
  } else if (key === 'reparaciones') {
    breakdown.reparacionesTotal = money(breakdown.reparacionesTotal + tot);
    breakdown.reparacionesCount += qty;
  } else {
    breakdown.accesoriosTotal = money(breakdown.accesoriosTotal + tot);
    breakdown.accesoriosCount += qty;
  }
}

export function paymentBucket(method?: string): 'cash' | 'card' | 'transfer' {
  const met = (method || '').toLowerCase();
  if (met.includes('tarjeta') || met === 'card') return 'card';
  if (met.includes('transfer')) return 'transfer';
  return 'cash';
}

export function summarizeTickets(tickets: SaleTicket[]): {
  cashSales: number;
  cardSales: number;
  transferSales: number;
  totalSales: number;
  breakdown: CategoryTotals;
} {
  let cashSales = 0;
  let cardSales = 0;
  let transferSales = 0;
  const breakdown = emptyCategoryTotals();

  tickets.forEach((t) => {
    const tot = money(Number(t.total) || 0);
    if (tot <= 0) {
      (t.items || []).forEach((item) => addItemToBreakdown(breakdown, item));
      return;
    }
    const bucket = paymentBucket(t.paymentMethod);
    if (bucket === 'card') cardSales = money(cardSales + tot);
    else if (bucket === 'transfer') transferSales = money(transferSales + tot);
    else cashSales = money(cashSales + tot);
    (t.items || []).forEach((item) => addItemToBreakdown(breakdown, item));
  });

  return {
    cashSales,
    cardSales,
    transferSales,
    totalSales: money(cashSales + cardSales + transferSales),
    breakdown,
  };
}

export function belongsToOpenSession(
  ticket: { branchId?: string; sucursal_id?: string; corteXId?: string; sesion_caja_id?: string; timestamp?: string },
  params: { branchId: string; sessionId: string; sessionOpenedAt: string; ignoreCorteIds?: Set<string> }
): boolean {
  const ticketBranch = ticket.branchId || ticket.sucursal_id || '';
  if (ticketBranch && normalizeBranchId(ticketBranch) !== normalizeBranchId(params.branchId)) return false;
  if (ticket.corteXId && !params.ignoreCorteIds?.has(ticket.corteXId)) return false;
  if (ticket.sesion_caja_id) {
    if (ticket.sesion_caja_id === params.sessionId) return true;
    if (params.ignoreCorteIds?.has(ticket.sesion_caja_id)) return true;
    return false;
  }
  // Tickets de producción anteriores a sesiones de caja: mismo día, aún abiertos.
  const ticketDay = safeDateIsoKey(ticket.timestamp);
  const sessionDay = safeDateIsoKey(params.sessionOpenedAt);
  if (ticketDay && sessionDay) return ticketDay === sessionDay;
  const ts = ticket.timestamp || '';
  return !params.sessionOpenedAt || ts >= params.sessionOpenedAt;
}
