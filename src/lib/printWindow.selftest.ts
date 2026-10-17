import assert from 'node:assert/strict';
import { isRestrictedPrintHost, THERMAL_PAGE_CSS } from './printWindow.ts';

assert.match(THERMAL_PAGE_CSS, /print-color-adjust:\s*economy/, 'no forzar fondos de color en térmica');
assert.doesNotMatch(THERMAL_PAGE_CSS, /print-color-adjust:\s*exact/);
assert.match(THERMAL_PAGE_CSS, /background:\s*#fff\s*!important/, 'hoja blanca');
assert.match(THERMAL_PAGE_CSS, /\.inline-block[\s\S]*background:\s*transparent/, 'folio sin relleno negro');

assert.equal(isRestrictedPrintHost('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', 0), false);
assert.equal(
  isRestrictedPrintHost(
    'Mozilla/5.0 (Linux; Android 13; SM-T220) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    5
  ),
  true,
  'Android tablet'
);
assert.equal(
  isRestrictedPrintHost('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 5),
  true,
  'iPad'
);
assert.equal(
  isRestrictedPrintHost('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5),
  true,
  'iPadOS se reporta como Mac con touch'
);
assert.equal(
  isRestrictedPrintHost('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120', 0),
  false,
  'Mac de escritorio'
);

console.log('printWindow self-test ok');
