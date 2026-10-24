import assert from 'node:assert/strict';
import type { InventoryMovement, Product, SaleTicket } from '../types.ts';
import {
  buildEquipmentInventorySheet,
  countEquipmentByBranch,
  listExistingEquipmentRows
} from './inventoryEquipmentExcel.ts';

const a16: Product = {
  id: 'p-a16',
  code: 'EQ-A16',
  name: 'Samsung A16',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 3500,
  stock: 2,
  branchImeiMap: {
    'b-matriz': ['351111111111111', '353333333333333'],
    'b-navojoa': ['352222222222222']
  }
};

const mica: Product = {
  id: 'p-mica',
  code: 'CA01',
  name: 'Mica 15D',
  category: 'accesorio',
  price: 50,
  stock: 10,
  branchStock: { 'b-matriz': 10 }
};

const ingreso: InventoryMovement = {
  id: 'mov-1',
  timestamp: '2026-10-12T15:00:00-07:00',
  type: 'ingreso',
  productId: 'p-a16',
  productCode: 'EQ-A16',
  productName: 'Samsung A16',
  quantity: 1,
  operatorName: 'Teresa',
  details: 'Ingreso Matriz',
  imeis: ['351111111111111']
};

const ticket: SaleTicket = {
  id: 'TCK-1',
  folio: 'MTZ-2410-001',
  timestamp: '2026-10-20T18:00:00-07:00',
  branchId: 'b-matriz',
  operatorName: 'Teresa',
  total: 3500,
  paymentMethod: 'Efectivo',
  items: [
    {
      cartItemId: 'c1',
      quantity: 1,
      unitPrice: 3500,
      totalPrice: 3500,
      product: a16,
      metadata: {
        saleType: 'credito',
        financingPlatform: 'PayJoy',
        imei: '353333333333333',
        deviceModel: 'Samsung A16',
        clientName: 'María'
      }
    }
  ]
};

const rawCounts = countEquipmentByBranch([a16, mica]);
assert.equal(rawCounts['b-matriz'], 2);
assert.equal(rawCounts['b-navojoa'], 1);

const stockCounts = countEquipmentByBranch([a16, mica], [ticket]);
assert.equal(stockCounts['b-matriz'], 1, 'el IMEI vendido no cuenta en Matriz');
assert.equal(stockCounts.total, 2);

const existing = listExistingEquipmentRows([a16, mica], 'b-matriz', [ingreso], [ticket]);
assert.equal(existing.length, 1);
assert.equal(existing[0].imei, '351111111111111');
assert.equal(existing[0].code, 'EQ-A16');
assert.equal(existing[0].model, 'Samsung A16');
assert.match(existing[0].enteredAtLabel, /12\/10\/2026/);
assert.ok(!existing.some((row) => row.imei === '353333333333333'));

const sheet = buildEquipmentInventorySheet({
  products: [a16],
  tickets: [ticket],
  movements: [ingreso]
});
const joined = sheet.rows.map((row) => row.join('|')).join('\n');
assert.match(joined, /351111111111111/);
assert.match(joined, /Samsung A16\|EQ-A16\|/);
assert.match(joined, /Fecha de ingreso/);
assert.ok(!joined.includes('353333333333333'), 'el Excel no lista IMEI vendidos');
assert.ok(!joined.includes('IMEI REGISTRADOS COMO VENDIDOS'));
assert.ok(!joined.includes('Precio'));
assert.ok(!joined.includes('PayJoy'));
assert.ok(!joined.includes('María'));

console.log('inventoryEquipmentExcel self-test ok');
