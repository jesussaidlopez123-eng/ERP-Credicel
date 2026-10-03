import assert from 'node:assert/strict';
import type { Product } from '../types';
import { accessoryStockAt } from './accessoryInventory.ts';
import { imeisAtBranch, unmappedImeis } from './imeiInventory.ts';
import {
  applyAccessoryLote,
  applyEquipmentLote,
  emptyAccessoryLine,
  emptyEquipmentLine,
  loteImeiFormatError,
  nextEquipmentCode,
  validateAccessoryLote,
  validateEquipmentLote
} from './inventoryLote.ts';

const mica = (over: Partial<Product> = {}): Product => ({
  id: 'acc-mica',
  code: 'CA-01',
  name: 'Mica 15',
  category: 'accesorio',
  inventoryType: 'accesorio',
  price: 150,
  stock: 4,
  branchStock: { 'b-navojoa': 4, 'b-huatabampo': 0, 'b-matriz': 0 },
  ...over
});

const funda = (over: Partial<Product> = {}): Product => ({
  id: 'acc-funda',
  code: 'CA-02',
  name: 'Funda A16',
  category: 'accesorio',
  inventoryType: 'accesorio',
  price: 80,
  stock: 0,
  branchStock: { 'b-navojoa': 0, 'b-huatabampo': 0, 'b-matriz': 0 },
  ...over
});

const phone = (over: Partial<Product> = {}): Product => ({
  id: 'eq-a16',
  code: 'EQ-A16',
  name: 'Samsung A16',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 4200,
  stock: 0,
  branchImeiMap: { 'b-matriz': [], 'b-navojoa': [], 'b-huatabampo': [] },
  ...over
});

const accLines = [
  { ...emptyAccessoryLine(), productId: 'acc-mica', qty: 10 },
  { ...emptyAccessoryLine(), productId: 'acc-funda', qty: 6 },
  { ...emptyAccessoryLine(), productId: 'acc-mica', qty: 2 }
];
assert.equal(validateAccessoryLote([mica(), funda()], accLines).length, 0);

const acc = applyAccessoryLote({
  products: [mica(), funda()],
  lines: accLines,
  destBranchId: 'b-navojoa',
  operatorName: 'Said',
  newProductId: () => 'prod-new'
});
assert.equal(acc.ok, true);
if (acc.ok) {
  assert.equal(acc.updated.length, 2);
  assert.equal(acc.created.length, 0);
  assert.equal(acc.pieceCount, 18);
  const micaNext = acc.updated.find((p) => p.id === 'acc-mica');
  const fundaNext = acc.updated.find((p) => p.id === 'acc-funda');
  assert.equal(accessoryStockAt(micaNext!, 'b-navojoa'), 16);
  assert.equal(accessoryStockAt(fundaNext!, 'b-navojoa'), 6);
  assert.equal(accessoryStockAt(micaNext!, 'b-huatabampo'), 0);
  assert.equal(acc.movements.length, 2);
}

const noBranch = applyAccessoryLote({
  products: [mica()],
  lines: [{ ...emptyAccessoryLine(), productId: 'acc-mica', qty: 1 }],
  destBranchId: '',
  operatorName: 'Said'
});
assert.equal(noBranch.ok, false);

const newAcc = applyAccessoryLote({
  products: [mica()],
  lines: [
    {
      ...emptyAccessoryLine(),
      productId: '',
      code: 'CA-99',
      name: 'Cargador 25W',
      qty: 8,
      costPrice: 40,
      price: 99
    }
  ],
  destBranchId: 'Huatabampo',
  operatorName: 'Said',
  newProductId: () => 'prod-cargador'
});
assert.equal(newAcc.ok, true);
if (newAcc.ok) {
  assert.equal(newAcc.created[0].id, 'prod-cargador');
  assert.equal(accessoryStockAt(newAcc.created[0], 'b-huatabampo'), 8);
  assert.equal(newAcc.movements[0].type, 'creacion');
}

const dupCode = validateAccessoryLote(
  [mica()],
  [{ ...emptyAccessoryLine(), productId: '', code: 'CA-01', name: 'Otra mica', qty: 1 }]
);
assert.ok(dupCode.some((e) => e.message.includes('CA-01')));

const eqLines = [
  {
    ...emptyEquipmentLine(),
    productId: 'eq-a16',
    imeis: ['351299123456789', ']A351299123456780']
  },
  {
    ...emptyEquipmentLine(),
    productId: '',
    name: 'Redmi Note 14',
    code: '',
    imeis: ['352088111111111'],
    price: 3900
  }
];
assert.equal(validateEquipmentLote([phone()], [], eqLines).length, 0);

const eq = applyEquipmentLote({
  products: [phone()],
  tickets: [],
  lines: eqLines,
  destBranchId: 'b-navojoa',
  operatorName: 'Said',
  newProductId: () => 'prod-redmi'
});
assert.equal(eq.ok, true);
if (eq.ok) {
  assert.equal(eq.pieceCount, 3);
  const a16 = eq.updated[0];
  assert.deepEqual(imeisAtBranch(a16, 'b-navojoa').sort(), ['351299123456780', '351299123456789']);
  assert.deepEqual(imeisAtBranch(a16, 'b-matriz'), []);
  assert.deepEqual(unmappedImeis(a16), []);
  const redmi = eq.created[0];
  assert.equal(redmi.id, 'prod-redmi');
  assert.ok(redmi.code.startsWith('EQ-'));
  assert.deepEqual(imeisAtBranch(redmi, 'b-navojoa'), ['352088111111111']);
  assert.deepEqual(unmappedImeis(redmi), []);
}

const dupImei = validateEquipmentLote(
  [phone({ branchImeiMap: { 'b-huatabampo': ['351299123456789'], 'b-navojoa': [], 'b-matriz': [] } })],
  [],
  [{ ...emptyEquipmentLine(), productId: 'eq-a16', imeis: ['351299123456789'] }]
);
assert.ok(dupImei.some((e) => e.message.includes('ya está en inventario')));

const sameLote = validateEquipmentLote(
  [phone()],
  [],
  [
    { ...emptyEquipmentLine(), productId: 'eq-a16', imeis: ['351299123456789'] },
    { ...emptyEquipmentLine(), productId: 'eq-a16', imeis: ['351299123456789'] }
  ]
);
assert.ok(sameLote.some((e) => e.message.includes('repetido')));

assert.equal(nextEquipmentCode([phone()], 'Samsung A16'), 'EQ-SAMS-100');
assert.ok(nextEquipmentCode([phone({ code: 'EQ-SAMS-100' })], 'Samsung A16') !== 'EQ-SAMS-100');

const missingImei = validateEquipmentLote(
  [phone()],
  [],
  [{ ...emptyEquipmentLine(), productId: 'eq-a16', imeis: [] }]
);
assert.ok(missingImei.some((e) => e.message.includes('no tiene IMEI')));

assert.equal(loteImeiFormatError(']C1351299123456789'), null);
assert.equal(loteImeiFormatError(']A0351299123456789'), null);
assert.ok(loteImeiFormatError('351299123456789351299123456780'));

const twoStuck = validateEquipmentLote(
  [phone()],
  [],
  [{ ...emptyEquipmentLine(), productId: 'eq-a16', imeis: ['351299123456789352088111111111'] }]
);
assert.ok(twoStuck.some((e) => e.message.includes('15') || e.message.includes('escanear')));

console.log('inventoryLote self-test ok');
