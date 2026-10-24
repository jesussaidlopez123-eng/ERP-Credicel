import assert from 'node:assert/strict';
import type { InventoryMovement, Product, SaleTicket } from '../types.ts';
import {
  buildEquipmentInventorySheet,
  countEquipmentByBranch,
  listExistingEquipmentRows,
  listSoldEquipmentRows
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
    'b-matriz': ['351111111111111'],
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

const counts = countEquipmentByBranch([a16, mica]);
assert.equal(counts['b-matriz'], 1);
assert.equal(counts['b-navojoa'], 1);
assert.equal(counts.total, 2);

const existing = listExistingEquipmentRows([a16, mica], 'b-matriz', [ingreso]);
assert.equal(existing.length, 1);
assert.equal(existing[0].imei, '351111111111111');
assert.equal(existing[0].code, 'EQ-A16');
assert.equal(existing[0].model, 'Samsung A16');
assert.match(existing[0].enteredAtLabel, /12\/10\/2026/);
assert.equal(listExistingEquipmentRows([a16], 'all').length, 2);

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

const sold = listSoldEquipmentRows([ticket], 'b-matriz');
assert.equal(sold.length, 1);
assert.equal(sold[0].imei, '353333333333333');
assert.equal(sold[0].code, 'EQ-A16');
assert.equal(listSoldEquipmentRows([ticket], 'b-navojoa').length, 0);

const onlyStock = buildEquipmentInventorySheet({
  products: [a16],
  tickets: [ticket],
  movements: [ingreso],
  includeSold: false
});
const joined = onlyStock.rows.map((row) => row.join('|')).join('\n');
assert.match(joined, /351111111111111/);
assert.match(joined, /Samsung A16\|EQ-A16\|/);
assert.match(joined, /Fecha de ingreso/);
assert.ok(!joined.includes('353333333333333'), 'sin la opción, el Excel no lista vendidos');
assert.ok(!joined.includes('Precio'), 'sin precio');
assert.ok(!joined.includes('PayJoy'), 'sin tipo de venta');
assert.ok(!joined.includes('María'), 'sin cliente');

const withSold = buildEquipmentInventorySheet({
  products: [a16],
  tickets: [ticket],
  movements: [ingreso],
  includeSold: true
});
const soldBlock = withSold.rows.map((row) => row.join('|')).join('\n');
assert.match(soldBlock, /IMEI REGISTRADOS COMO VENDIDOS/);
assert.match(soldBlock, /353333333333333/);
assert.ok(!soldBlock.includes('PayJoy'), 'vendidos también van solo con modelo, código, fecha e IMEI');

console.log('inventoryEquipmentExcel self-test ok');
