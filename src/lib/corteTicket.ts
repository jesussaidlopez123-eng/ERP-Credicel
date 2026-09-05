import { escapeHtml } from './printWindow';

export type CorteTicketLine = {
  quantity: number;
  productName: string;
  ticketFolio: string;
  paymentMethod: string;
  time: string;
  totalPrice: number;
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

function row(label: string, value: string, extra = ''): string {
  return `<div class="flex"${extra}><span>${escapeHtml(label)}</span><span class="font-bold">${escapeHtml(value)}</span></div>`;
}

/** HTML del ticket de 58 mm a partir de los totales ya calculados. No lee el DOM. */
export function buildCorteThermalInnerHtml(view: CorteTicketView): string {
  const itemsHtml =
    view.items.length === 0
      ? `<div class="text-center">Sin ventas</div>`
      : view.items
          .map(
            (item) => `<div>
        <div class="flex"><span class="truncate">${escapeHtml(`${item.quantity}x ${item.productName}`)}</span><span class="shrink-0">${money(item.totalPrice)}</span></div>
        <div class="flex"><span>${escapeHtml(item.ticketFolio)}</span><span>${escapeHtml(`${item.paymentMethod} ${item.time}`)}</span></div>
      </div>`
          )
          .join('');

  const expensesHtml =
    view.expenses.length === 0
      ? ''
      : `<div class="border-b">
        <div class="font-black">GASTOS (${view.expenses.length})</div>
        ${view.expenses
          .map((exp) => row(exp.concept, `-${money(exp.amount).slice(1)}`))
          .join('')}
      </div>`;

  const fundBlock =
    view.fundLeft === undefined
      ? ''
      : `${row('Fondo sig. turno', money(view.fundLeft))}
      ${view.cashWithdrawn === undefined ? '' : row('A entregar', money(view.cashWithdrawn))}
      ${view.notes ? `<div>Obs: ${escapeHtml(view.notes)}</div>` : ''}`;

  return `
    <div class="text-center border-b">
      <h2>CrediCel</h2>
      <p class="font-black">CORTE DE CAJA (X)</p>
      <p>${escapeHtml(view.branchName)} · ${escapeHtml(view.operatorName)}</p>
      <p>${escapeHtml(view.dateStr)} · ${escapeHtml(view.timeStr)}</p>
      <div class="inline-block">${escapeHtml(view.folio)}</div>
    </div>
    <div class="border-b">
      <div class="font-black">RESUMEN</div>
      ${row(`Accesorios (${view.accesoriosCount})`, money(view.accesoriosTotal))}
      ${row(`Abonos (${view.abonosCount})`, money(view.abonosTotal))}
      ${row(`Enganches (${view.enganchesCount})`, money(view.enganchesTotal))}
      ${row(`Reparaciones (${view.reparacionesCount})`, money(view.reparacionesTotal))}
      ${row(`Recargas (${view.recargasCount})`, money(view.recargasTotal))}
      ${row('TOTAL VENTAS', money(view.totalSales))}
      ${row('(-) Gastos', `-${money(view.totalExpenses).slice(1)}`)}
      ${row('UTILIDAD', money(view.netIncome))}
    </div>
    <div class="border-b">
      <div class="font-black">ARTICULOS (${view.items.length})</div>
      ${itemsHtml}
    </div>
    ${expensesHtml}
    <div class="border-b">
      <div class="font-black">PAGOS</div>
      ${row('Efectivo', money(view.cashSales))}
      ${row('Tarjeta', money(view.cardSales))}
      ${row('Transferencia', money(view.transferSales))}
    </div>
    <div>
      <div class="font-black">CAJON</div>
      ${row('(+) Fondo', money(view.initialCashFund))}
      ${row('(+) Efectivo', `+${money(view.cashSales).slice(1)}`)}
      ${row('(-) Gastos', `-${money(view.totalExpenses).slice(1)}`)}
      ${row('TOTAL CAJA', money(view.expectedCashInDrawer))}
      ${fundBlock}
    </div>
    <p class="text-center font-black">FIN DE CORTE</p>
  `;
}
