import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import {
  createInventoryLabelPdf,
  isLabelSizeId,
  LABEL_SIZES,
  labelPageMm,
  labelPrintCss,
  pdfMediaBoxPoints,
  STICKER_HEIGHT_MM,
  STICKER_WIDTH_MM,
  RT420BE_PRINT_SETTINGS
} from './inventoryLabels.ts';

assert.equal(isLabelSizeId('cm35x25'), true);
assert.equal(isLabelSizeId('in35x25'), false);
assert.equal(isLabelSizeId('4x6'), false);
assert.equal(LABEL_SIZES.cm35x25.page, '35mm 25mm');
assert.equal(LABEL_SIZES.cm35x25.title, '3.5 × 2.5 cm');
assert.equal(RT420BE_PRINT_SETTINGS.find((r) => r.label === 'Ancho (escribe)')?.value, '35 mm');
assert.equal(RT420BE_PRINT_SETTINGS.find((r) => r.label === 'Alto (escribe)')?.value, '25 mm');
assert.equal(RT420BE_PRINT_SETTINGS.find((r) => r.label === 'Dónde escribirlo')?.value, 'Driver RT420BE, no Chrome');
assert.equal(labelPageMm('cm35x25').widthMm, 35);
assert.equal(labelPageMm('cm35x25').heightMm, 25);
assert.ok(labelPageMm('cm35x25').widthMm > labelPageMm('cm35x25').heightMm);

const sheet = labelPrintCss('cm35x25');
assert.equal(sheet.includes('35mm 25mm'), true);
assert.equal(sheet.includes('3.5in'), false);
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
const expectedW = (STICKER_WIDTH_MM * 72) / 25.4;
const expectedH = (STICKER_HEIGHT_MM * 72) / 25.4;
assert.ok(Math.abs(box.widthPt - expectedW) < 1.5, `ancho ${box.widthPt}`);
assert.ok(Math.abs(box.heightPt - expectedH) < 1.5, `alto ${box.heightPt}`);
assert.ok(box.widthPt > box.heightPt, 'la página debe ser 35×25 mm, no 25×35 mm vertical');
const pdfText = new TextDecoder('latin1').decode(pdf);
assert.equal(pdfText.includes('PrintScaling'), true);
assert.equal(pdfText.includes('None'), true);
assert.equal(pdfText.includes('3.5x2.5 cm'), true);

const probe = new jsPDF({ unit: 'mm', format: [35, 25], orientation: 'landscape' });
assert.ok(Math.abs(probe.internal.pageSize.getWidth() - 35) < 0.02);
assert.ok(Math.abs(probe.internal.pageSize.getHeight() - 25) < 0.02);
const vertical = new jsPDF({ unit: 'mm', format: [35, 25], orientation: 'portrait' });
assert.ok(Math.abs(vertical.internal.pageSize.getWidth() - 25) < 0.02);
assert.ok(Math.abs(vertical.internal.pageSize.getHeight() - 35) < 0.02);

console.log('inventoryLabels self-test ok');
