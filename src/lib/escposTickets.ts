import { TicketDraft, clipLine } from './escpos';
import type { CorteTicketView } from './corteTicket';
import { formatMoney, ticketFolioLabel } from './ids';
import type { Branch, CartItem, Expense, SaleTicket } from '../types';

function money(n: number | undefined): string {
  return `$${formatMoney(n ?? 0)}`;
}

function ticketClockLabel(iso: string | undefined): string {
  const raw = String(iso || '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return clipLine(raw);
  try {
    return d
      .toLocaleString('es-MX', {
        timeZone: 'America/Hermosillo',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      .replace(',', '');
  } catch {
    return clipLine(raw);
  }
}

function folioTail(folio: string | undefined): string {
  const parts = String(folio || '').split('-').filter(Boolean);
  return parts[parts.length - 1] || String(folio || '');
}

function itemName(item: CartItem): string {
  const meta = item.metadata;
  const name = String(item.product?.name || '').trim();
  if (meta?.caseModel && !name.toLowerCase().includes(meta.caseModel.toLowerCase())) {
    return `${name} ${meta.caseModel}`.trim();
  }
  return name;
}

function appendCartItem(draft: TicketDraft, item: CartItem): void {
  const meta = item.metadata;
  draft.pair(`${item.quantity}x ${itemName(item)}`, money(item.totalPrice));

  if (item.product.code.startsWith('ABO-') && meta?.issueDescription) {
    draft.left(meta.issueDescription);
  }

  if (meta?.phoneNumber) {
    draft.left(`TEL ${meta.phoneNumber}`);
  }

  const isPhone =
    Boolean(meta?.deviceModel || meta?.imei) &&
    !item.product.code.startsWith('ABO-') &&
    !meta?.repairId;
  if (isPhone) {
    const contado = meta?.saleType === 'contado' || meta?.financingPlatform === 'Contado';
    if (!contado && meta?.financingPlatform) {
      const resto =
        meta.remainingBalance ??
        Math.max(0, (meta.fullPrice || 0) - (meta.downPayment || item.totalPrice));
      draft.pair(meta.financingPlatform, `Saldo ${money(resto)}`);
    }
    if (meta?.imei) draft.left(`IMEI ${meta.imei}`);
  }

  if (meta?.repairId) {
    draft.left([meta.repairId, meta.clientName].filter(Boolean).join(' '));
    const entrega = meta.repairType === 'saldo_final' || meta.repairType === 'pago_total';
    if (!entrega && meta.totalRepairCost !== undefined) {
      const resta =
        meta.pendingBalance ??
        Math.max(0, meta.totalRepairCost - (meta.advancePayment ?? item.totalPrice));
      if (resta > 0) draft.pair('Resta', money(resta));
    }
  }
}

export function buildSaleTicketDraft(ticket: SaleTicket, branch: Pick<Branch, 'name'>): TicketDraft {
  const folio = ticketFolioLabel(ticket);
  const draft = new TicketDraft();
  draft.center('CREDI CEL');
  draft.center(`${branch.name} ${ticket.operatorName}`);
  draft.center(ticketClockLabel(ticket.timestamp));
  draft.center(folio);
  draft.dash();
  for (const item of ticket.items) appendCartItem(draft, item);
  draft.dash();
  draft.pair('TOTAL', money(ticket.total));
  if (ticket.paymentMethod === 'Efectivo' && ticket.cashReceived !== undefined) {
    draft.pair('Efectivo', `Rec ${money(ticket.cashReceived)} Cam ${money(ticket.change || 0)}`);
  } else {
    draft.left(ticket.paymentMethod);
  }
  draft.dash();
  draft.center('Gracias por su compra!');
  return draft;
}

export function buildSaleTicketPlainText(ticket: SaleTicket, branch: Pick<Branch, 'name'>): string {
  return buildSaleTicketDraft(ticket, branch).toPlainText();
}

export function buildSaleTicketEscPos(ticket: SaleTicket, branch: Pick<Branch, 'name'>): Uint8Array {
  return buildSaleTicketDraft(ticket, branch).toEscPos();
}

export function buildExpenseTicketDraft(expense: Expense, branch: Pick<Branch, 'name'>): TicketDraft {
  const draft = new TicketDraft();
  draft.center('CREDI CEL');
  draft.center(`${branch.name} ${expense.operatorName}`);
  draft.center(ticketClockLabel(expense.timestamp));
  draft.center('VALE DE SALIDA');
  draft.center(expense.id);
  draft.dash();
  draft.left(expense.concept);
  draft.dash();
  draft.pair('SALIDA', `-${money(expense.amount)}`);
  return draft;
}

export function buildExpenseTicketPlainText(expense: Expense, branch: Pick<Branch, 'name'>): string {
  return buildExpenseTicketDraft(expense, branch).toPlainText();
}

export function buildExpenseTicketEscPos(expense: Expense, branch: Pick<Branch, 'name'>): Uint8Array {
  return buildExpenseTicketDraft(expense, branch).toEscPos();
}

function corteItemLeft(item: CorteTicketView['items'][number]): string {
  const tail = item.imei ? ` ${item.imei.slice(-4)}` : '';
  const folio = folioTail(item.ticketFolio);
  return `${folio} ${item.quantity}x ${item.productName}${tail}`;
}

export function buildCorteTicketDraft(view: CorteTicketView): TicketDraft {
  const moneyView = (n: number) => `$${n.toFixed(2)}`;
  const draft = new TicketDraft();
  draft.center('CREDI CEL');
  draft.center('CORTE DE CAJA');
  draft.center(`${view.branchName} ${view.operatorName}`);
  draft.center(`${view.dateStr} ${view.timeStr}`);
  draft.center(view.folio);
  draft.dash();
  const resumen: Array<[string, number, number]> = [
    ['Acc', view.accesoriosCount, view.accesoriosTotal],
    ['Abono', view.abonosCount, view.abonosTotal],
    ['Eng', view.enganchesCount, view.enganchesTotal],
    ['Taller', view.reparacionesCount, view.reparacionesTotal],
    ['Recarga', view.recargasCount, view.recargasTotal]
  ];
  for (const [label, count, total] of resumen) {
    if (count <= 0 && total <= 0) continue;
    draft.pair(`${label} (${count})`, moneyView(total));
  }
  draft.pair('VENTAS', moneyView(view.totalSales));
  if (view.totalExpenses > 0) draft.pair('Gastos', `-${moneyView(view.totalExpenses).slice(1)}`);
  draft.pair('UTILIDAD', moneyView(view.netIncome));
  draft.dash();
  if (view.items.length === 0) {
    draft.center('Sin ventas');
  } else {
    for (const item of view.items) {
      draft.pair(corteItemLeft(item), moneyView(item.totalPrice));
    }
  }
  if (view.expenses.length > 0) {
    draft.dash();
    for (const exp of view.expenses) {
      draft.pair(exp.concept, `-${moneyView(exp.amount).slice(1)}`);
    }
  }
  draft.dash();
  if (view.cashSales > 0) draft.pair('Efectivo', moneyView(view.cashSales));
  if (view.cardSales > 0) draft.pair('Tarjeta', moneyView(view.cardSales));
  if (view.transferSales > 0) draft.pair('Transferencia', moneyView(view.transferSales));
  draft.pair('Fondo', moneyView(view.initialCashFund));
  draft.pair('CAJA', moneyView(view.expectedCashInDrawer));
  if (view.fundLeft !== undefined) {
    draft.pair('Fondo sig', moneyView(view.fundLeft));
    if (view.cashWithdrawn !== undefined) draft.pair('Entregar', moneyView(view.cashWithdrawn));
    if (view.notes) draft.left(view.notes);
  }
  draft.dash();
  draft.center('FIN DE CORTE');
  return draft;
}

export function buildCorteTicketPlainText(view: CorteTicketView): string {
  return buildCorteTicketDraft(view).toPlainText();
}

export function buildCorteTicketEscPos(view: CorteTicketView): Uint8Array {
  return buildCorteTicketDraft(view).toEscPos();
}
