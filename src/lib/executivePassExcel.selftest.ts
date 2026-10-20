import assert from 'node:assert/strict';
import type { SaleTicket } from '../types.ts';
import { buildXlsxBytes } from './xlsxMinimal.ts';
import {
  buildExecutivePassExcelSheets,
  executivePassExcelFilename,
  financingLabel,
  listExecutivePassRows
} from './executivePassExcel.ts';

function ticket(over: Partial<SaleTicket> & { items: SaleTicket['items'] }): SaleTicket {
  return {
    id: 'TCK-1',
    folio: 'NAV-1310-001',
    timestamp: '2026-10-13T18:00:00.000Z',
    branchId: 'b-navojoa',
    operatorName: 'Teresa',
    total: 0,
    paymentMethod: 'Efectivo',
    ...over
  };
}

assert.equal(
  financingLabel({
    cartItemId: '1',
    quantity: 1,
    unitPrice: 500,
    totalPrice: 500,
    product: { id: 'p', code: 'CEL', name: 'Moto G', category: 'equipo_credito', price: 500, stock: 1 },
    metadata: { saleType: 'credito', financingPlatform: 'PayJoy', clientName: 'Ana', deviceModel: 'Moto G' }
  }),
  'PayJoy'
);
assert.equal(
  financingLabel({
    cartItemId: '2',
    quantity: 1,
    unitPrice: 400,
    totalPrice: 400,
    product: { id: 'a', code: 'ABO-1', name: 'Abono a crédito (CrediYa)', category: 'abono_credito', price: 400, stock: 0 },
    metadata: { saleType: 'abono', clientName: 'Luis' }
  }),
  'CrediYa'
);
assert.equal(
  financingLabel({
    cartItemId: '3',
    quantity: 1,
    unitPrice: 50,
    totalPrice: 50,
    product: { id: 'r', code: 'REC', name: 'Recarga', category: 'recarga', price: 50, stock: 0 },
    metadata: { phoneNumber: '6441112233', carrier: 'Telcel' }
  }),
  '—'
);

const tickets: SaleTicket[] = [
  ticket({
    total: 3500,
    items: [
      {
        cartItemId: 'e1',
        quantity: 1,
        unitPrice: 3500,
        totalPrice: 3500,
        product: { id: 'p1', code: 'CEL-1', name: 'A15', category: 'equipo_credito', price: 3500, stock: 1 },
        metadata: {
          saleType: 'credito',
          financingPlatform: 'CrediYa',
          clientName: 'María Trinidad',
          deviceModel: 'Samsung A15',
          imei: '351111111111111'
        }
      }
    ]
  }),
  ticket({
    id: 'TCK-2',
    folio: 'NAV-1410-002',
    timestamp: '2026-10-14T16:00:00.000Z',
    total: 400,
    items: [
      {
        cartItemId: 'a1',
        quantity: 1,
        unitPrice: 400,
        totalPrice: 400,
        product: { id: 'ab', code: 'ABO-2', name: 'Abono PayJoy', category: 'abono_credito', price: 400, stock: 0 },
        metadata: { saleType: 'abono', financingPlatform: 'PayJoy', clientName: 'José' }
      }
    ]
  }),
  ticket({
    id: 'TCK-3',
    folio: 'HUA-1410-003',
    timestamp: '2026-10-14T17:00:00.000Z',
    branchId: 'b-huatabampo',
    total: 100,
    items: [
      {
        cartItemId: 'r1',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
        product: { id: 'rc', code: 'REC-1', name: 'Recarga Telcel', category: 'recarga', price: 100, stock: 0 },
        metadata: { phoneNumber: '6440001111', carrier: 'Telcel' }
      }
    ]
  }),
  ticket({
    id: 'TCK-OUT',
    folio: 'NAV-2010-009',
    timestamp: '2026-10-20T12:00:00.000Z',
    total: 50,
    items: [
      {
        cartItemId: 'late',
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
        product: { id: 'rc2', code: 'REC-2', name: 'Recarga', category: 'recarga', price: 50, stock: 0 },
        metadata: { phoneNumber: '6449990000', carrier: 'Movistar' }
      }
    ]
  })
];

const weekAll = listExecutivePassRows({
  tickets,
  from: '2026-10-13',
  to: '2026-10-19',
  branchId: 'all'
});
assert.equal(weekAll.filter((r) => r.category === 'equipos').length, 1);
assert.equal(weekAll.filter((r) => r.category === 'abonos').length, 1);
assert.equal(weekAll.filter((r) => r.category === 'recargas').length, 1, 'recarga de otra semana no entra');
assert.equal(weekAll.find((r) => r.category === 'equipos')?.platform, 'CrediYa');
assert.equal(weekAll.find((r) => r.category === 'abonos')?.name, 'José');
assert.equal(weekAll.find((r) => r.category === 'abonos')?.platform, 'PayJoy');
assert.equal(weekAll.find((r) => r.category === 'recargas')?.name, '6440001111');

const onlyNav = listExecutivePassRows({
  tickets,
  from: '2026-10-13',
  to: '2026-10-19',
  branchId: 'b-navojoa'
});
assert.equal(onlyNav.length, 2, 'Navojoa no incluye Huatabampo');
assert.ok(onlyNav.every((row) => row.branchId === 'b-navojoa'));

const sheets = buildExecutivePassExcelSheets({
  tickets,
  from: '2026-10-13',
  to: '2026-10-19',
  branchId: 'b-navojoa',
  periodLabel: '13 – 19 oct 2026',
  branchLabel: 'Navojoa'
});
assert.equal(sheets.length, 3);
assert.deepEqual(
  sheets.map((s) => s.name),
  ['Abonos', 'Equipos', 'Recargas']
);
assert.ok(sheets[0].rows.some((row) => row.includes('José')));
assert.ok(sheets[1].rows.some((row) => row.includes('María Trinidad')));
assert.ok(sheets[1].rows.some((row) => row.includes('CrediYa')));
assert.ok(
  sheets[2].rows.some((row) => row[0] === 'Sin registros en este periodo'),
  'Recargas de Navojoa vacía en esa semana'
);
assert.ok(sheets[0].rows.some((row) => row[0] === 'Periodo' && row[1] === '13 – 19 oct 2026'));
assert.ok(sheets[0].rows.some((row) => row[0] === 'Sucursal' && row[1] === 'Navojoa'));

const bytes = buildXlsxBytes(sheets);
assert.equal(bytes[0], 0x50);
assert.ok(bytes.length > 400);
assert.equal(
  executivePassExcelFilename({ from: '2026-10-13', to: '2026-10-19', branchId: 'b-navojoa' }),
  'direccion-abonos-equipos-recargas-navojoa-2026-10-13-a-2026-10-19'
);

console.log('executivePassExcel self-test ok');
