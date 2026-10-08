import assert from 'node:assert/strict';
import { filterProductsByQuery, productMatchesQuery, productPickLabel } from './productSearch.ts';

const samsung = { id: '1', code: 'EQ-A16', name: 'Samsung Galaxy A16 128GB', category: 'equipo_credito', inventoryType: 'equipo' as const, price: 1, stock: 1 };
const moto = { id: '2', code: 'EQ-G06', name: 'Motorola G06', category: 'equipo_credito', inventoryType: 'equipo' as const, price: 1, stock: 1 };
const redmi = { id: '3', code: 'EQ-N13', name: 'Xiaomi Redmí Note 13', category: 'equipo_credito', inventoryType: 'equipo' as const, price: 1, stock: 1 };

assert.equal(productMatchesQuery(samsung, 'sam'), true);
assert.equal(productMatchesQuery(samsung, 'A16'), true);
assert.equal(productMatchesQuery(samsung, 'eq-a16'), true);
assert.equal(productMatchesQuery(samsung, 'moto'), false);
assert.equal(productMatchesQuery(redmi, 'redmi'), true, 'ignora acentos');
assert.equal(productMatchesQuery(samsung, 'sam a16'), true, 'varias letras/palabras');

const filtered = filterProductsByQuery([samsung, moto, redmi], 'g0');
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, '2');
assert.equal(filterProductsByQuery([samsung, moto], '').length, 2);
assert.equal(productPickLabel(samsung), '[EQ-A16] Samsung Galaxy A16 128GB');

console.log('productSearch self-test ok');
