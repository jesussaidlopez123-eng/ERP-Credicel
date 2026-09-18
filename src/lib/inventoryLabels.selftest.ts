import assert from 'node:assert/strict';
import { isLabelSizeId, LABEL_SIZES, labelPrintCss } from './inventoryLabels.ts';

assert.equal(isLabelSizeId('in35x25'), true);
assert.equal(isLabelSizeId('4x6'), false);
assert.equal(LABEL_SIZES.in35x25.page, '3.5in 2.5in');
assert.equal(LABEL_SIZES.in35x25.width, '3.5in');
assert.equal(LABEL_SIZES.in35x25.height, '2.5in');

const sheet = labelPrintCss('in35x25');
assert.equal(sheet.includes('3.5in 2.5in'), true);
assert.equal(sheet.includes('4in 6in'), false);
assert.equal(sheet.includes('4x6'), false);
assert.equal(/page-break-after:\s*page/.test(sheet), true);
assert.equal(sheet.includes('margin: 0'), true);

const roll = labelPrintCss('roll58');
assert.equal(roll.includes('58mm auto'), true);
assert.equal(/page-break-after:\s*auto/.test(roll), true);
assert.equal(roll.includes('4in 6in'), false);

console.log('inventoryLabels self-test ok');
