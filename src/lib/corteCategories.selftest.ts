import assert from 'node:assert/strict';
import type { Expense, Product, SaleTicket } from '../types';
import { buildCorteCategoryBreakdown, corteConceptName } from './corteCategories.ts';

const mica: Product = {
  id: 'p-mica',
  code: 'CA01',
  name: 'Mica 15D',
  category: 'accesorio',
  price: 50,
  stock: 10
};

const phone: Product = {
  id: 'p-a16',
  code: 'EQ-A16',
  name: 'Samsung A16',
  category: 'equipo_credito',
  price: 4000,
  stock: 1
};

function ticket(over: Partial<SaleTicket> & { items: SaleTicket['items'] }): SaleTicket {
  return {
    id: over.id || 't1',
    folio: over.folio || 'NAV-0101-001',
    timestamp: over.timestamp || '2026-09-28T18:00:00-07:00',
    branchId: over.branchId || 'b-navojoa',
    operatorName: 'Said',
    items: over.items,
    total: over.total ?? over.items.reduce((n, i) => n + (i.totalPrice || 0), 0),
    paymentMethod: over.paymentMethod || 'Efectivo',
    estado: over.estado
  };
}

const monday = ticket({
  id: 'mon',
  folio: 'NAV-2809-001',
  timestamp: '2026-09-28T10:00:00-07:00',
  items: [
    {
      cartItemId: 'c1',
      product: mica,
      quantity: 2,
      unitPrice: 50,
      totalPrice: 100,
      metadata: {}
    }
  ],
  total: 100
});

const friday = ticket({
  id: 'fri',
  folio: 'NAV-0210-008',
  timestamp: '2026-10-02T16:00:00-07:00',
  items: [
    {
      cartItemId: 'c2',
      product: phone,
      quantity: 1,
      unitPrice: 1500,
      totalPrice: 1500,
      metadata: { saleType: 'credito', deviceModel: 'Samsung A16', imei: '351299123456789' }
    },
    {
      cartItemId: 'c3',
      product: { id: 'ab', code: 'AB', name: 'Abono a crédito (PayJoy)', category: 'servicio', price: 400, stock: 0 },
      quantity: 1,
      unitPrice: 400,
      totalPrice: 400,
      metadata: { saleType: 'abono' }
    }
  ],
  total: 1900,
  paymentMethod: 'Tarjeta'
});

const cancelled = ticket({
  id: 'can',
  folio: 'NAV-0210-009',
  timestamp: '2026-10-02T17:00:00-07:00',
  estado: 'CANCELADA',
  items: [
    {
      cartItemId: 'c4',
      product: mica,
      quantity: 10,
      unitPrice: 50,
      totalPrice: 500,
      metadata: {}
    }
  ],
  total: 500
});

const gasto: Expense = {
  id: 'g1',
  amount: 80,
  concept: 'Gasolina',
  timestamp: '2026-09-30T12:00:00-07:00',
  operatorName: 'Said',
  branchId: 'b-navojoa'
};

const week = buildCorteCategoryBreakdown([monday, friday, cancelled], [gasto]);
assert.equal(week.totals.accesorios, 100);
assert.equal(week.counts.accesorios, 2);
assert.equal(week.totals.enganches, 1500);
assert.equal(week.counts.enganches, 1);
assert.equal(week.totals.abonos, 400);
assert.equal(week.cashSales, 100);
assert.equal(week.cardSales, 1900);
assert.equal(week.totalSales, 2000);
assert.equal(week.totalExpenses, 80);
assert.equal(week.netIncome, 1920);
assert.equal(week.groups.accesorios[0]?.name, 'Mica 15D');
assert.equal(week.groups.accesorios[0]?.count, 2);
assert.equal(week.expenseGroups[0]?.name, 'Gasolina');
assert.equal(corteConceptName({
  cartItemId: 'cx',
  product: { id: 'x', code: 'x', name: 'Abono a crédito (DMI)', category: 'servicio', price: 1, stock: 0 },
  quantity: 1,
  unitPrice: 1,
  totalPrice: 1
}), 'Abono a Crédito (DMI)');

console.log('corteCategories self-test ok');
