import assert from 'node:assert/strict';
import type { Product, SaleTicket } from '../types.ts';
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

const counts = countEquipmentByBranch([a16, mica]);
assert.equal(counts['b-matriz'], 1);
assert.equal(counts['b-navojoa'], 1);
assert.equal(counts.total, 2);

const existing = listExistingEquipmentRows([a16, mica], 'b-matriz');
assert.equal(existing.length, 1);
assert.equal(existing[0].imei, '351111111111111');
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
assert.equal(listSoldEquipmentRows([ticket], 'b-navojoa').length, 0);

const onlyStock = buildEquipmentInventorySheet({ products: [a16], tickets: [ticket], includeSold: false });
const joined = onlyStock.rows.map((row) => row.join('|')).join('\n');
assert.match(joined, /351111111111111/);
assert.ok(!joined.includes('353333333333333'), 'sin la opción, el Excel no lista vendidos');
assert.match(joined, /EXISTENTES/);

const withSold = buildEquipmentInventorySheet({
  products: [a16],
  tickets: [ticket],
  includeSold: true
});
const soldBlock = withSold.rows.map((row) => row.join('|')).join('\n');
assert.match(soldBlock, /IMEI REGISTRADOS COMO VENDIDOS/);
assert.match(soldBlock, /353333333333333/);
assert.match(soldBlock, /PayJoy/);

console.log('inventoryEquipmentExcel self-test ok');
