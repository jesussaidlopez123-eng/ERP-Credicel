import { TicketDraft } from './escpos';
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

export function buildCorteTicketDraft(view: CorteTicketView): TicketDraft {
  const moneyView = (n: number) => `$${n.toFixed(2)}`;
  const draft = new TicketDraft();
  draft.center('CREDI CEL');
  draft.center('CORTE DE CAJA (X)');
  draft.center(`${view.branchName} · ${view.operatorName}`);
  draft.center(`${view.dateStr} · ${view.timeStr}`);
  draft.center(view.folio);
  draft.dash();
  draft.left('RESUMEN');
  draft.pair(`Accesorios (${view.accesoriosCount})`, moneyView(view.accesoriosTotal));
  draft.pair(`Abonos (${view.abonosCount})`, moneyView(view.abonosTotal));
  draft.pair(`Enganches (${view.enganchesCount})`, moneyView(view.enganchesTotal));
  draft.pair(`Reparaciones (${view.reparacionesCount})`, moneyView(view.reparacionesTotal));
  draft.pair(`Recargas (${view.recargasCount})`, moneyView(view.recargasTotal));
  draft.pair('TOTAL VENTAS', moneyView(view.totalSales));
  draft.pair('(-) Gastos', `-${moneyView(view.totalExpenses).slice(1)}`);
  draft.pair('UTILIDAD', moneyView(view.netIncome));
  draft.dash();
  draft.left(`ARTICULOS (${view.items.length})`);
  if (view.items.length === 0) {
    draft.center('Sin ventas');
  } else {
    for (const item of view.items) {
      draft.pair(`${item.quantity}x ${item.productName}`, moneyView(item.totalPrice));
      draft.pair(item.ticketFolio, `${item.paymentMethod} ${item.time}`);
    }
  }
  if (view.expenses.length > 0) {
    draft.dash();
    draft.left(`GASTOS (${view.expenses.length})`);
    for (const exp of view.expenses) {
      draft.pair(exp.concept, `-${moneyView(exp.amount).slice(1)}`);
    }
  }
  draft.dash();
  draft.left('PAGOS');
  draft.pair('Efectivo', moneyView(view.cashSales));
  draft.pair('Tarjeta', moneyView(view.cardSales));
  draft.pair('Transferencia', moneyView(view.transferSales));
  draft.dash();
  draft.left('CAJON');
  draft.pair('(+) Fondo', moneyView(view.initialCashFund));
  draft.pair('(+) Efectivo', `+${moneyView(view.cashSales).slice(1)}`);
  draft.pair('(-) Gastos', `-${moneyView(view.totalExpenses).slice(1)}`);
  draft.pair('TOTAL CAJA', moneyView(view.expectedCashInDrawer));
  if (view.fundLeft !== undefined) {
    draft.pair('Fondo sig. turno', moneyView(view.fundLeft));
    if (view.cashWithdrawn !== undefined) draft.pair('A entregar', moneyView(view.cashWithdrawn));
    if (view.notes) draft.wrapped(`Obs: ${view.notes}`);
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
