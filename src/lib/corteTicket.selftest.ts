import assert from 'node:assert/strict';
import { buildCorteThermalInnerHtml } from './corteTicket.ts';

const html = buildCorteThermalInnerHtml({
  folio: 'SES-NAV-TEST',
  branchName: 'Navojoa',
  operatorName: 'Said',
  dateStr: '05/09/2026',
  timeStr: '10:00 p.m.',
  accesoriosTotal: 350,
  accesoriosCount: 2,
  abonosTotal: 200,
  abonosCount: 1,
  enganchesTotal: 1500,
  enganchesCount: 1,
  reparacionesTotal: 0,
  reparacionesCount: 0,
  recargasTotal: 50,
  recargasCount: 1,
  totalSales: 2100,
  totalExpenses: 80,
  netIncome: 2020,
  cashSales: 1800,
  cardSales: 200,
  transferSales: 100,
  initialCashFund: 0,
  expectedCashInDrawer: 1720,
  fundLeft: 0,
  cashWithdrawn: 1720,
  items: [
    {
      quantity: 1,
      productName: 'Mica 15',
      ticketFolio: 'NAV-0509-003',
      paymentMethod: 'Efectivo',
      time: '11:20 a.m.',
      totalPrice: 150
    }
  ],
  expenses: [{ concept: 'Gasolina', amount: 80 }]
});

assert.match(html, /\$2100\.00/);
assert.match(html, /\$1800\.00/);
assert.match(html, /NAV-0509-003/);
assert.match(html, /Mica 15/);
assert.match(html, /Gasolina/);
assert.match(html, /TOTAL VENTAS<\/span><span class="font-bold">\$2100\.00/);
console.log('corteTicket self-test ok');
