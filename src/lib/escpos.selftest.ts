import assert from 'node:assert/strict';
import { bytesToBase64, encodeCp850, EscPosBuilder, isCode39Safe, pairLine, wrapLine } from './escpos.ts';
import { buildCorteTicketEscPos, buildExpenseTicketEscPos, buildSaleTicketEscPos } from './escposTickets.ts';
import { buildRawBtIntentUrl, prefersEscPosText } from './printEscpos.ts';
import { isAndroidPrintHost } from './printWindow.ts';
import type { Expense, SaleTicket } from '../types.ts';
import type { CorteTicketView } from './corteTicket.ts';

assert.deepEqual(wrapLine('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10), [
  'ABCDEFGHIJ',
  'KLMNOPQRST',
  'UVWXYZ0123',
  '456789'
]);
assert.equal(pairLine('TOTAL', '$12.00', 16), 'TOTAL     $12.00');
assert.equal(isCode39Safe('NAV-1910-042'), true);
assert.equal(isCode39Safe('hola!'), false);

const nTilde = encodeCp850('niño');
assert.equal(nTilde[2], 0xa4, 'ñ en CP850');
assert.equal(encodeCp850('¡Hola!')[0], 0xad);

const built = new EscPosBuilder().init().align('left').bold(true).line('CREDI CEL').bold(false).code39('NAV-1910-042').feed(3).cut().toBytes();
assert.ok(built[0] === 0x1b && built[1] === 0x40, 'ESC @ init');
assert.ok(Array.from(built).includes(0x1d), 'incluye GS (código de barras o corte)');
assert.ok(bytesToBase64(built).length > 8);

const ticket: SaleTicket = {
  id: 'TCK-1',
  folio: 'HUA-1910-007',
  timestamp: '2026-10-19T12:00:00.000Z',
  branchId: 'b-huatabampo',
  operatorName: 'Geraldín',
  total: 499,
  paymentMethod: 'Efectivo',
  cashReceived: 500,
  change: 1,
  items: [
    {
      cartItemId: 'c1',
      quantity: 1,
      unitPrice: 499,
      totalPrice: 499,
      product: { id: 'p1', code: 'CEL-1', name: 'Moto G', category: 'equipo_credito', price: 499, stock: 1 },
      metadata: {
        saleType: 'contado',
        financingPlatform: 'Contado',
        deviceModel: 'Moto G 32',
        imei: '351111111111111',
        clientName: 'María',
        fullPrice: 499
      }
    }
  ]
};

const saleBytes = buildSaleTicketEscPos(ticket, { name: 'Huatabampo' });
const saleText = String.fromCharCode(...saleBytes.filter((b) => b >= 32 && b < 127));
assert.match(saleText, /CREDI CEL/);
assert.match(saleText, /HUA-1910-007/);
assert.match(saleText, /CELULAR CONTADO/);
assert.match(saleText, /IMEI 351111111111111/);
assert.match(saleText, /TOTAL/);
assert.ok(!saleText.includes('<div'), 'ESC/POS no es HTML');

const expense: Expense = {
  id: 'EXP-ABC-1',
  amount: 80,
  concept: 'Pasajes Navojoa',
  timestamp: '2026-10-19T13:00:00.000Z',
  operatorName: 'Teresa',
  branchId: 'b-matriz'
};
const expBytes = buildExpenseTicketEscPos(expense, { name: 'Matriz' });
const expText = String.fromCharCode(...expBytes.filter((b) => b >= 32 && b < 127));
assert.match(expText, /VALE DE SALIDA/);
assert.match(expText, /Pasajes Navojoa/);

const corte: CorteTicketView = {
  folio: 'CTX-TURNO',
  branchName: 'Matriz',
  operatorName: 'Teresa',
  dateStr: '19/10/2026',
  timeStr: '11:00 a. m.',
  accesoriosTotal: 100,
  accesoriosCount: 1,
  abonosTotal: 0,
  abonosCount: 0,
  enganchesTotal: 0,
  enganchesCount: 0,
  reparacionesTotal: 0,
  reparacionesCount: 0,
  recargasTotal: 0,
  recargasCount: 0,
  totalSales: 100,
  totalExpenses: 20,
  netIncome: 80,
  cashSales: 100,
  cardSales: 0,
  transferSales: 0,
  initialCashFund: 80,
  expectedCashInDrawer: 160,
  items: [{ quantity: 1, productName: 'Mica', ticketFolio: 'MTZ-1910-001', paymentMethod: 'Efectivo', time: '10:00', totalPrice: 100 }],
  expenses: [{ concept: 'Agua', amount: 20 }]
};
const corteBytes = buildCorteTicketEscPos(corte);
const corteText = String.fromCharCode(...corteBytes.filter((b) => b >= 32 && b < 127));
assert.match(corteText, /CORTE DE CAJA/);
assert.match(corteText, /FIN DE CORTE/);
assert.match(corteText, /Mica/);

const intent = buildRawBtIntentUrl(saleBytes);
assert.match(intent, /^intent:/);
assert.match(intent, /scheme=rawbt/);
assert.match(intent, /package=ru\.a402d\.rawbtprinter/);
assert.ok(!intent.includes('<'), 'intent sin HTML');

assert.equal(isAndroidPrintHost('Mozilla/5.0 (Linux; Android 13; SM-T220) Chrome/120'), true);
assert.equal(isAndroidPrintHost('Mozilla/5.0 (iPad; CPU OS 17_0)'), false);
assert.equal(
  prefersEscPosText('Mozilla/5.0 (Linux; Android 13; SM-T220) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36', 5),
  true
);
assert.equal(prefersEscPosText('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', 0), false);

console.log('escpos self-test ok');
