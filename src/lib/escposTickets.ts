import { EscPosBuilder } from './escpos';
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

function appendCartItem(esc: EscPosBuilder, item: CartItem): void {
  const meta = item.metadata;
  esc.align('left').bold(true);
  esc.pair(`${item.quantity}x ${item.product.name}`, money(item.totalPrice));
  esc.bold(false);

  if (item.product.code.startsWith('ABO-')) {
    esc.line('ABONO CREDITO');
    if (meta?.issueDescription) esc.wrapped(meta.issueDescription);
  }

  if (meta?.phoneNumber) {
    esc.line(`TEL ${meta.phoneNumber}`);
    if (meta.carrier) esc.line(meta.carrier.toUpperCase());
  }

  if (meta?.deviceModel && !item.product.code.startsWith('ABO-')) {
    const contado = meta.saleType === 'contado' || meta.financingPlatform === 'Contado';
    esc.line(contado ? 'CELULAR CONTADO' : `CREDITO ${meta.financingPlatform || ''}`.trim());
    if (meta.clientName) esc.wrapped(meta.clientName);
    if (meta.clientPhone) esc.line(meta.clientPhone);
    esc.wrapped(meta.deviceModel);
    if (meta.imei) esc.line(`IMEI ${meta.imei}`);
    if (meta.saleType === 'credito' && meta.financingPlatform !== 'Contado' && meta.fullPrice !== undefined) {
      esc.pair('Precio', money(meta.fullPrice));
      esc.pair('Enganche', money(meta.downPayment || item.totalPrice));
      esc.bold(true);
      esc.pair(
        'Saldo',
        money(meta.remainingBalance ?? Math.max(0, meta.fullPrice - (meta.downPayment || item.totalPrice)))
      );
      esc.bold(false);
    } else {
      esc.bold(true);
      esc.pair('Total', money(meta.fullPrice || item.totalPrice));
      esc.bold(false);
    }
  }

  if (meta?.repairId) {
    const entrega = meta.repairType === 'saldo_final';
    esc.line(`${entrega ? 'ENTREGA TALLER' : 'RECEPCION TALLER'} ${meta.repairId}`);
    if (meta.clientName) esc.wrapped(meta.clientName);
    if (meta.deviceModel) esc.wrapped(meta.deviceModel);
    if (!entrega && meta.issueDescription) esc.wrapped(meta.issueDescription);
    if (!entrega && meta.passcodePattern && meta.passcodePattern !== 'Sin contraseña / Desbloqueado') {
      esc.line(`PIN ${meta.passcodePattern}`);
    }
    if (meta.totalRepairCost !== undefined) {
      if (entrega) {
        esc.pair('Servicio', money(meta.totalRepairCost));
        esc.pair('Anticipo', money(meta.advancePayment || 0));
        esc.bold(true);
        esc.pair('Hoy', money(item.totalPrice));
        esc.bold(false);
        esc.line('ENTREGADO Y PAGADO');
      } else {
        esc.pair('Costo', money(meta.totalRepairCost));
        esc.pair('Anticipo', money(meta.advancePayment ?? item.totalPrice));
        esc.bold(true);
        esc.pair(
          'Resta',
          money(
            meta.pendingBalance ??
              Math.max(0, meta.totalRepairCost - (meta.advancePayment ?? item.totalPrice))
          )
        );
        esc.bold(false);
      }
    }
  }

  if (meta?.caseModel) esc.line(`Para ${meta.caseModel}`);
}

export function buildSaleTicketEscPos(ticket: SaleTicket, branch: Pick<Branch, 'name'>): Uint8Array {
  const folio = ticketFolioLabel(ticket);
  const esc = new EscPosBuilder().init();
  esc.double(true).bold(true).line('CREDI CEL').double(false).bold(false);
  esc.line(`${branch.name} · ${ticket.operatorName}`);
  esc.line(saleDateLabel(ticket));
  esc.bold(true).line(folio).bold(false);
  esc.dash();
  for (const item of ticket.items) appendCartItem(esc, item);
  esc.dash();
  esc.align('left').bold(true).pair('TOTAL', money(ticket.total)).bold(false);
  if (ticket.paymentMethod === 'Efectivo' && ticket.cashReceived !== undefined) {
    esc.pair(ticket.paymentMethod, `Rec ${money(ticket.cashReceived)}`);
    esc.pair('Cambio', money(ticket.change || 0));
  } else {
    esc.line(ticket.paymentMethod);
  }
  esc.dash();
  esc.align('center');
  esc.code39(folio);
  esc.line(`*${folio}*`);
  esc.line('Gracias por su compra!');
  esc.feed(4).cut();
  return esc.toBytes();
}

export function buildExpenseTicketEscPos(expense: Expense, branch: Pick<Branch, 'name'>): Uint8Array {
  const esc = new EscPosBuilder().init();
  esc.double(true).bold(true).line('CREDI CEL').double(false).bold(false);
  esc.line(`${branch.name} · ${expense.operatorName}`);
  esc.line(expense.timestamp);
  esc.bold(true).line('VALE DE SALIDA').line(expense.id).bold(false);
  esc.dash();
  esc.align('left').line('CONCEPTO');
  esc.wrapped(expense.concept);
  esc.dash();
  esc.bold(true).pair('SALIDA', `-${money(expense.amount)}`).bold(false);
  esc.dash();
  esc.align('center');
  esc.code39(expense.id);
  esc.line(`*${expense.id}*`);
  esc.line('Salida de efectivo autorizada');
  esc.feed(4).cut();
  return esc.toBytes();
}

export function buildCorteTicketEscPos(view: CorteTicketView): Uint8Array {
  const esc = new EscPosBuilder().init();
  const moneyView = (n: number) => `$${n.toFixed(2)}`;
  esc.double(true).bold(true).line('CREDI CEL').double(false);
  esc.line('CORTE DE CAJA (X)').bold(false);
  esc.line(`${view.branchName} · ${view.operatorName}`);
  esc.line(`${view.dateStr} · ${view.timeStr}`);
  esc.bold(true).line(view.folio).bold(false);
  esc.dash();
  esc.align('left').bold(true).line('RESUMEN').bold(false);
  esc.pair(`Accesorios (${view.accesoriosCount})`, moneyView(view.accesoriosTotal));
  esc.pair(`Abonos (${view.abonosCount})`, moneyView(view.abonosTotal));
  esc.pair(`Enganches (${view.enganchesCount})`, moneyView(view.enganchesTotal));
  esc.pair(`Reparaciones (${view.reparacionesCount})`, moneyView(view.reparacionesTotal));
  esc.pair(`Recargas (${view.recargasCount})`, moneyView(view.recargasTotal));
  esc.bold(true).pair('TOTAL VENTAS', moneyView(view.totalSales)).bold(false);
  esc.pair('(-) Gastos', `-${moneyView(view.totalExpenses).slice(1)}`);
  esc.bold(true).pair('UTILIDAD', moneyView(view.netIncome)).bold(false);
  esc.dash();
  esc.bold(true).line(`ARTICULOS (${view.items.length})`).bold(false);
  if (view.items.length === 0) {
    esc.align('center').line('Sin ventas').align('left');
  } else {
    for (const item of view.items) {
      esc.pair(`${item.quantity}x ${item.productName}`, moneyView(item.totalPrice));
      esc.pair(item.ticketFolio, `${item.paymentMethod} ${item.time}`);
    }
  }
  if (view.expenses.length > 0) {
    esc.dash();
    esc.bold(true).line(`GASTOS (${view.expenses.length})`).bold(false);
    for (const exp of view.expenses) {
      esc.pair(exp.concept, `-${moneyView(exp.amount).slice(1)}`);
    }
  }
  esc.dash();
  esc.bold(true).line('PAGOS').bold(false);
  esc.pair('Efectivo', moneyView(view.cashSales));
  esc.pair('Tarjeta', moneyView(view.cardSales));
  esc.pair('Transferencia', moneyView(view.transferSales));
  esc.dash();
  esc.bold(true).line('CAJON').bold(false);
  esc.pair('(+) Fondo', moneyView(view.initialCashFund));
  esc.pair('(+) Efectivo', `+${moneyView(view.cashSales).slice(1)}`);
  esc.pair('(-) Gastos', `-${moneyView(view.totalExpenses).slice(1)}`);
  esc.bold(true).pair('TOTAL CAJA', moneyView(view.expectedCashInDrawer)).bold(false);
  if (view.fundLeft !== undefined) {
    esc.pair('Fondo sig. turno', moneyView(view.fundLeft));
    if (view.cashWithdrawn !== undefined) esc.pair('A entregar', moneyView(view.cashWithdrawn));
    if (view.notes) esc.wrapped(`Obs: ${view.notes}`);
  }
  esc.dash();
  esc.align('center').bold(true).line('FIN DE CORTE').bold(false);
  esc.feed(4).cut();
  return esc.toBytes();
}
