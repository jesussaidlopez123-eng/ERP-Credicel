import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import {
  createInventoryLabelPdf,
  isLabelSizeId,
  LABEL_SIZES,
  labelPageInches,
  labelPrintCss,
  pdfMediaBoxPoints
} from './inventoryLabels.ts';

assert.equal(isLabelSizeId('in35x25'), true);
assert.equal(isLabelSizeId('4x6'), false);
assert.equal(LABEL_SIZES.in35x25.page, '3.5in 2.5in');
assert.equal(labelPageInches('in35x25').widthIn, 3.5);
assert.equal(labelPageInches('in35x25').heightIn, 2.5);
assert.ok(labelPageInches('in35x25').widthIn > labelPageInches('in35x25').heightIn);

const sheet = labelPrintCss('in35x25');
assert.equal(sheet.includes('3.5in 2.5in'), true);
assert.equal(sheet.includes('landscape'), false);
assert.equal(sheet.includes('4in 6in'), false);

const roll = labelPrintCss('roll58');
assert.equal(roll.includes('58mm auto'), true);
assert.equal(roll.includes('landscape'), false);

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pdf = createInventoryLabelPdf([
  { code: 'ACC-1', name: 'Funda', price: '149.00', barcodeDataUrl: pixel },
  { code: 'ACC-1', name: 'Funda', price: '149.00', barcodeDataUrl: pixel }
]);
assert.ok(pdf.byteLength > 500);
const box = pdfMediaBoxPoints(pdf);
assert.ok(Math.abs(box.widthPt - 252) < 1, `ancho ${box.widthPt}`);
assert.ok(Math.abs(box.heightPt - 180) < 1, `alto ${box.heightPt}`);
assert.ok(box.widthPt > box.heightPt, 'la página debe ser horizontal 3.5×2.5, no vertical 2.5×3.5');
const pdfText = new TextDecoder('latin1').decode(pdf);
assert.equal(pdfText.includes('PrintScaling'), true);
assert.equal(pdfText.includes('None'), true);

const probe = new jsPDF({ unit: 'in', format: [3.5, 2.5], orientation: 'landscape' });
assert.equal(probe.internal.pageSize.getWidth(), 3.5);
assert.equal(probe.internal.pageSize.getHeight(), 2.5);
const vertical = new jsPDF({ unit: 'in', format: [3.5, 2.5], orientation: 'portrait' });
assert.equal(vertical.internal.pageSize.getWidth(), 2.5);
assert.equal(vertical.internal.pageSize.getHeight(), 3.5);

console.log('inventoryLabels self-test ok');
