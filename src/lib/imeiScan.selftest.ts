import assert from 'node:assert/strict';
import type { Product } from '../types';
import {
  addImeisToProduct,
  canonicalImei,
  imeiDigits,
  imeiForStorage,
  imeiLuhnOk,
  imeisAtBranch,
  imeisEqual,
  looksLikeImeiScan,
  resolveSaleImei,
  stripScannerImeiPrefix
} from './imeiInventory.ts';
import { findImeiInInventory } from './inventoryRules.ts';
import { loteImeiFormatError } from './inventoryLote.ts';

/** Completa 14 dígitos con el verificador Luhn que usa el inventario. */
function imeiWithCheck(body14: string): string {
  const d = `${body14}0`;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(d[14 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${body14}${check}`;
}

const IMEI = imeiWithCheck('35345678901234');
const IMEI_B = imeiWithCheck('35876543210987');
/** 15 dígitos sin Luhn, empieza en 3: un extra al final no debe tomar los últimos 15. */
const CHEAP = '351111111111111';

assert.equal(IMEI.length, 15);
assert.equal(imeiLuhnOk(IMEI), true);
assert.equal(imeiLuhnOk(IMEI_B), true);
assert.notEqual(IMEI, IMEI_B);

// Prefijos AIM: no se come el primer dígito del celular.
assert.equal(stripScannerImeiPrefix(`]C1${IMEI}`), IMEI);
assert.equal(canonicalImei(`]C1${IMEI}`), IMEI);
assert.equal(canonicalImei(`]C${IMEI}`), IMEI);
assert.equal(canonicalImei(`]A0${IMEI}`), IMEI);
assert.equal(canonicalImei(`]C1${IMEI}`), IMEI);
assert.notEqual(canonicalImei(`]C1${IMEI}`), `1${IMEI.slice(0, 14)}`);
assert.equal(imeisEqual(IMEI, `]C1${IMEI}`), true);
assert.equal(imeisEqual(IMEI, `]A0${IMEI}`), true);

// 14 vs 15: el de 15 que empieza igual sigue coincidiendo.
assert.equal(imeisEqual(IMEI, IMEI.slice(0, 14)), true);

// 16 dígitos: IMEI + 0 extra al final no cambia el IMEI.
assert.equal(canonicalImei(`${IMEI}0`), IMEI);
assert.equal(imeisEqual(IMEI, `${IMEI}0`), true);

// 16 dígitos: 0 o 1 sobrante delante de un IMEI Luhn (resto del lector).
assert.equal(canonicalImei(`0${IMEI}`), IMEI);
assert.equal(canonicalImei(`1${IMEI}`), IMEI);
assert.notEqual(canonicalImei(`1${IMEI}`), `1${IMEI.slice(0, 14)}`);
assert.equal(imeisEqual(IMEI, `1${IMEI}`), true);

// Un IMEI barato de 15 (sin Luhn) no se reescribe al guardar.
assert.equal(canonicalImei(CHEAP), CHEAP);
assert.equal(imeiForStorage(CHEAP), CHEAP);
assert.equal(canonicalImei(`${CHEAP}0`), CHEAP);

// Códigos cortos de sucursal no se vuelven solo dígitos.
assert.equal(canonicalImei('HUA111'), 'HUA111');
assert.equal(canonicalImei('NAV111'), 'NAV111');
assert.equal(imeisEqual('HUA111', 'NAV111'), false);
assert.equal(imeiForStorage('DDD'), 'DDD');

// Un dígito distinto = otro IMEI. Guardar no “arregla” el typo.
const typo = `${IMEI.slice(0, 14)}${(Number(IMEI[14]) + 1) % 10}`;
assert.notEqual(typo, IMEI);
assert.equal(canonicalImei(typo), typo);
assert.equal(imeisEqual(IMEI, typo), false);

// Dos IMEI pegados: no se toma el primero a ciegas.
const stuck = `${IMEI}${IMEI_B}`;
assert.equal(stuck.length, 30);
assert.equal(canonicalImei(stuck), stuck);
assert.equal(imeiForStorage(stuck), '');
assert.ok(loteImeiFormatError(stuck));
assert.equal(looksLikeImeiScan(stuck), true);

// El mismo IMEI dos veces pegado sí se puede leer (una sola ventana).
const sameTwice = canonicalImei(`${IMEI}${IMEI}`);
assert.ok(sameTwice === IMEI || sameTwice === `${IMEI}${IMEI}`);
if (sameTwice !== IMEI) assert.equal(imeiForStorage(`${IMEI}${IMEI}`), '');

// 17 dígitos con una sola ventana Luhn (GS1 01 + IMEI).
assert.equal(canonicalImei(`01${IMEI}`), IMEI);

const phone = (over: Partial<Product> = {}): Product => ({
  id: 'prod-scan',
  code: 'EQ-SCAN',
  name: 'Samsung A16',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 4200,
  stock: 0,
  branchImeiMap: { 'b-matriz': [], 'b-navojoa': [], 'b-huatabampo': [] },
  ...over
});

// Alta con AIM: se guarda el IMEI de 15, no 1 + 14.
const fromAim = addImeisToProduct(phone(), 'b-navojoa', [`]C1${IMEI}`]);
assert.deepEqual(imeisAtBranch(fromAim, 'b-navojoa'), [IMEI]);
assert.notEqual(imeisAtBranch(fromAim, 'b-navojoa')[0], `1${IMEI.slice(0, 14)}`);

// Re-escanear el mismo equipo no cambia ni un dígito.
const again = addImeisToProduct(fromAim, 'b-huatabampo', [`]A0${IMEI}`]);
assert.deepEqual(imeisAtBranch(again, 'b-huatabampo'), [IMEI]);
assert.equal(again.stock, 1);

// 1 sobrante + IMEI Luhn entra como el IMEI real.
const fromLeftover = addImeisToProduct(phone(), 'b-matriz', [`1${IMEI}`]);
assert.deepEqual(imeisAtBranch(fromLeftover, 'b-matriz'), [IMEI]);

// Dos IMEI pegados no se dan de alta.
const fromStuck = addImeisToProduct(phone(), 'b-navojoa', [stuck]);
assert.deepEqual(imeisAtBranch(fromStuck, 'b-navojoa'), []);
assert.equal(fromStuck.stock, 0);

// Lote: AIM vale; 30 dígitos no.
assert.equal(loteImeiFormatError(`]C1${IMEI}`), null);
assert.ok(loteImeiFormatError(stuck));

// POS: el lector con ]C1 encuentra el de anaquel.
const onShelf = phone({
  stock: 1,
  imeiList: [IMEI],
  branchImeiMap: { 'b-navojoa': [IMEI], 'b-huatabampo': [], 'b-matriz': [] }
});
assert.equal(findImeiInInventory([onShelf], `]C1${IMEI}`, 'b-navojoa').status, 'found');
assert.equal(findImeiInInventory([onShelf], `1${IMEI}`, 'b-navojoa').status, 'found');
assert.equal(findImeiInInventory([onShelf], typo, 'b-navojoa').status, 'missing');
assert.equal(looksLikeImeiScan(`]C1${IMEI}`), true);
assert.equal(looksLikeImeiScan('CA-01'), false);

// Ticket: se guarda el del anaquel, nunca el prefijo del lector.
assert.equal(resolveSaleImei(`]C1${IMEI}`, onShelf), IMEI);
assert.equal(resolveSaleImei(`]C1${IMEI}`), IMEI);
assert.equal(resolveSaleImei(`1${IMEI}`, onShelf), IMEI);
assert.equal(resolveSaleImei(`]C1${IMEI}`, onShelf).startsWith(']'), false);
assert.equal(imeiDigits(resolveSaleImei(`]C1${IMEI}`, onShelf)).length, 15);

// Espacios y minúsculas no cambian dígitos.
assert.equal(canonicalImei(` ${IMEI.slice(0, 5)} ${IMEI.slice(5)} `), IMEI);

console.log('imeiScan self-test ok');
