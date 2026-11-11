import { escapeHtml } from './printWindow';

export type CorteTicketLine = {
  quantity: number;
  productName: string;
  ticketFolio: string;
  paymentMethod: string;
  time: string;
  totalPrice: number;
  imei?: string;
};

export type CorteTicketExpense = {
  concept: string;
  amount: number;
};

export type CorteTicketView = {
  folio: string;
  branchName: string;
  operatorName: string;
  dateStr: string;
  timeStr: string;
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
  totalSales: number;
  totalExpenses: number;
  netIncome: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  initialCashFund: number;
  expectedCashInDrawer: number;
  fundLeft?: number;
  cashWithdrawn?: number;
  notes?: string;
  items: CorteTicketLine[];
  expenses: CorteTicketExpense[];
};

function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

function row(label: string, value: string): string {
  return `<div class="flex"><span class="truncate">${escapeHtml(label)}</span><span class="shrink-0 font-bold">${escapeHtml(value)}</span></div>`;
}

function folioTail(folio: string | undefined): string {
  const parts = String(folio || '').split('-').filter(Boolean);
  return parts[parts.length - 1] || String(folio || '');
}

function itemLabel(item: CorteTicketLine): string {
  const tail = item.imei ? ` ${item.imei.slice(-4)}` : '';
  return `${folioTail(item.ticketFolio)} ${item.quantity}x ${item.productName}${tail}`;
}

/** HTML del ticket de 58 mm: un renglón por dato, sin texto de más. */
export function buildCorteThermalInnerHtml(view: CorteTicketView): string {
  const resumen: Array<[string, number, number]> = [
    ['Acc', view.accesoriosCount, view.accesoriosTotal],
    ['Abono', view.abonosCount, view.abonosTotal],
    ['Eng', view.enganchesCount, view.enganchesTotal],
    ['Taller', view.reparacionesCount, view.reparacionesTotal],
    ['Recarga', view.recargasCount, view.recargasTotal]
  ];
  const resumenHtml = resumen
    .filter(([, count, total]) => count > 0 || total > 0)
    .map(([label, count, total]) => row(`${label} (${count})`, money(total)))
    .join('');

  const itemsHtml =
    view.items.length === 0
      ? `<div class="text-center">Sin ventas</div>`
      : view.items.map((item) => row(itemLabel(item), money(item.totalPrice))).join('');

  const expensesHtml =
    view.expenses.length === 0
      ? ''
      : `<div class="border-b">${view.expenses.map((exp) => row(exp.concept, `-${money(exp.amount).slice(1)}`)).join('')}</div>`;

  const pagosHtml = [
    view.cashSales > 0 ? row('Efectivo', money(view.cashSales)) : '',
    view.cardSales > 0 ? row('Tarjeta', money(view.cardSales)) : '',
    view.transferSales > 0 ? row('Transferencia', money(view.transferSales)) : ''
  ].join('');

  const fundBlock =
    view.fundLeft === undefined
      ? ''
      : `${row('Fondo sig', money(view.fundLeft))}
      ${view.cashWithdrawn === undefined ? '' : row('Entregar', money(view.cashWithdrawn))}
      ${view.notes ? `<div class="truncate">Obs: ${escapeHtml(view.notes)}</div>` : ''}`;

  return `
    <div class="text-center border-b">
      <h2>CREDI CEL</h2>
      <p class="font-black">CORTE DE CAJA</p>
      <p class="truncate">${escapeHtml(view.branchName)} ${escapeHtml(view.operatorName)}</p>
      <p class="truncate">${escapeHtml(view.dateStr)} ${escapeHtml(view.timeStr)}</p>
      <div class="inline-block truncate">${escapeHtml(view.folio)}</div>
    </div>
    <div class="border-b">
      ${resumenHtml}
      ${row('VENTAS', money(view.totalSales))}
      ${view.totalExpenses > 0 ? row('Gastos', `-${money(view.totalExpenses).slice(1)}`) : ''}
      ${row('UTILIDAD', money(view.netIncome))}
    </div>
    <div class="border-b">
      ${itemsHtml}
    </div>
    ${expensesHtml}
    <div class="border-b">
      ${pagosHtml}
      ${row('Fondo', money(view.initialCashFund))}
      ${row('CAJA', money(view.expectedCashInDrawer))}
      ${fundBlock}
    </div>
    <p class="text-center font-black">FIN DE CORTE</p>
  `;
}
