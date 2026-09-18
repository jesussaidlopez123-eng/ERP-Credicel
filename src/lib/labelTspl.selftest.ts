import assert from 'node:assert/strict';
import { createInventoryLabelTspl, createRt420PrintBat } from './labelTspl.ts';

const items = [
  { code: 'ACC-1', name: 'Funda niño', price: '149.00', barcodeDataUrl: '' },
  { code: 'ACC-1', name: 'Funda niño', price: '149.00', barcodeDataUrl: '' },
  { code: 'ACC-2', name: 'Mica', price: '80.00', barcodeDataUrl: '' }
];

const tspl = createInventoryLabelTspl(items);
assert.equal(tspl.includes('SIZE 35 mm,25 mm'), true);
assert.equal(tspl.includes('GAP 2 mm,0'), true);
assert.equal(tspl.includes('PRINT 2'), true);
assert.equal(tspl.includes('PRINT 1'), true);
assert.equal(tspl.includes('BARCODE'), true);
assert.equal(tspl.includes('Funda nino') || tspl.includes('Funda nino'), true);
assert.equal(tspl.includes('4 x 6') || tspl.includes('4x6') || tspl.includes('Letter'), false);
assert.equal(tspl.includes('90 mm'), false);
assert.equal(tspl.includes('SIZE 35 mm,25 mm\r\n'), true);

const bat = createRt420PrintBat(items);
assert.equal(bat.includes('@echo off'), true);
assert.equal(bat.includes('__CREDICEL_PS1_B64__'), true);
assert.equal(bat.length > 800, true);
assert.equal(bat.includes('SIZE 35 mm,25 mm') || bat.includes('__CREDICEL_PS1_B64__'), true);

console.log('labelTspl self-test ok');
