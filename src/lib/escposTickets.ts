import { TicketDraft, clipLine } from './escpos';
import type { CorteTicketView } from './corteTicket';
import { formatMoney, ticketFolioLabel } from './ids';
import type { Branch, CartItem, Expense, SaleTicket } from '../types';

function money(n: number | undefined): string {
  return `$${formatMoney(n ?? 0)}`;
}

function saleDateLabel(ticket: SaleTicket): string {
  if (!ticket.timestamp) return '';
  try {
    const d = new Date(ticket.timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  } catch {
    /* keep raw */
  }
  return ticket.timestamp;
}

function appendCartItem(draft: TicketDraft, item: CartItem): void {
  const meta = item.metadata;
  draft.pair(`${item.quantity}x ${item.product.name}`, money(item.totalPrice));

  if (item.product.code.startsWith('ABO-')) {
    draft.left('ABONO CREDITO');
    if (meta?.issueDescription) draft.wrapped(meta.issueDescription);
  }

  if (meta?.phoneNumber) {
    draft.left(`TEL ${meta.phoneNumber}`);
    if (meta.carrier) draft.left(meta.carrier.toUpperCase());
  }

  if (meta?.deviceModel && !item.product.code.startsWith('ABO-')) {
    const contado = meta.saleType === 'contado' || meta.financingPlatform === 'Contado';
    draft.left(contado ? 'CELULAR CONTADO' : `CREDITO ${meta.financingPlatform || ''}`.trim());
    if (meta.clientName) draft.wrapped(meta.clientName);
    if (meta.clientPhone) draft.left(meta.clientPhone);
    draft.wrapped(meta.deviceModel);
    if (meta.imei) draft.left(`IMEI ${meta.imei}`);
    if (meta.saleType === 'credito' && meta.financingPlatform !== 'Contado' && meta.fullPrice !== undefined) {
      draft.pair('Precio', money(meta.fullPrice));
      draft.pair('Enganche', money(meta.downPayment || item.totalPrice));
      draft.pair(
        'Saldo',
        money(meta.remainingBalance ?? Math.max(0, meta.fullPrice - (meta.downPayment || item.totalPrice)))
      );
    } else {
      draft.pair('Total', money(meta.fullPrice || item.totalPrice));
    }
  }

  if (meta?.repairId) {
    const entrega = meta.repairType === 'saldo_final';
    draft.left(`${entrega ? 'ENTREGA TALLER' : 'RECEPCION TALLER'} ${meta.repairId}`);
    if (meta.clientName) draft.wrapped(meta.clientName);
    if (meta.deviceModel) draft.wrapped(meta.deviceModel);
    if (!entrega && meta.issueDescription) draft.wrapped(meta.issueDescription);
    if (!entrega && meta.passcodePattern && meta.passcodePattern !== 'Sin contraseña / Desbloqueado') {
      draft.left(`PIN ${meta.passcodePattern}`);
    }
    if (meta.totalRepairCost !== undefined) {
      if (entrega) {
        draft.pair('Servicio', money(meta.totalRepairCost));
        draft.pair('Anticipo', money(meta.advancePayment || 0));
        draft.pair('Hoy', money(item.totalPrice));
        draft.left('ENTREGADO Y PAGADO');
      } else {
        draft.pair('Costo', money(meta.totalRepairCost));
        draft.pair('Anticipo', money(meta.advancePayment ?? item.totalPrice));
        draft.pair(
          'Resta',
          money(
            meta.pendingBalance ??
              Math.max(0, meta.totalRepairCost - (meta.advancePayment ?? item.totalPrice))
          )
        );
      }
    }
  }

  if (meta?.caseModel) draft.left(`Para ${meta.caseModel}`);
}

export function buildSaleTicketDraft(ticket: SaleTicket, branch: Pick<Branch, 'name'>): TicketDraft {
  const folio = ticketFolioLabel(ticket);
  const draft = new TicketDraft();
  draft.center('CREDI CEL');
  draft.center(`${branch.name} · ${ticket.operatorName}`);
  draft.center(saleDateLabel(ticket));
  draft.center(folio);
  draft.dash();
  for (const item of ticket.items) appendCartItem(draft, item);
  draft.dash();
  draft.pair('TOTAL', money(ticket.total));
  if (ticket.paymentMethod === 'Efectivo' && ticket.cashReceived !== undefined) {
    draft.pair(ticket.paymentMethod, `Rec ${money(ticket.cashReceived)}`);
    draft.pair('Cambio', money(ticket.change || 0));
  } else {
    draft.left(ticket.paymentMethod);
  }
  draft.dash();
  draft.center(`*${folio}*`);
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
  draft.center(`${branch.name} · ${expense.operatorName}`);
  draft.center(expense.timestamp);
  draft.center('VALE DE SALIDA');
  draft.center(expense.id);
  draft.dash();
  draft.left('CONCEPTO');
  draft.wrapped(expense.concept);
  draft.dash();
  draft.pair('SALIDA', `-${money(expense.amount)}`);
  draft.dash();
  draft.center(`*${expense.id}*`);
  draft.center('Salida de efectivo autorizada');
  return draft;
}

export function buildExpenseTicketPlainText(expense: Expense, branch: Pick<Branch, 'name'>): string {
  return buildExpenseTicketDraft(expense, branch).toPlainText();
}

export function buildExpenseTicketEscPos(expense: Expense, branch: Pick<Branch, 'name'>): Uint8Array {
  return buildExpenseTicketDraft(expense, branch).toEscPos();
}

function folioTail(folio: string | undefined): string {
  const parts = String(folio || '').split('-').filter(Boolean);
  return parts[parts.length - 1] || String(folio || '');
}

function corteItemLeft(item: CorteTicketView['items'][number]): string {
  const tail = item.imei ? ` ${item.imei.slice(-4)}` : '';
  return `${folioTail(item.ticketFolio)} ${item.quantity}x ${item.productName}${tail}`;
}

export function buildCorteTicketDraft(view: CorteTicketView): TicketDraft {
  const moneyView = (n: number) => `$${n.toFixed(2)}`;
  const draft = new TicketDraft();
  draft.center('CREDI CEL');
  draft.center('CORTE DE CAJA');
  draft.center(clipLine(`${view.branchName} ${view.operatorName}`));
  draft.center(clipLine(`${view.dateStr} ${view.timeStr}`));
  draft.center(clipLine(view.folio));
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
    if (view.notes) draft.left(clipLine(view.notes));
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
