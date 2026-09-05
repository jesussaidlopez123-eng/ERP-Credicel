import assert from 'node:assert/strict';
import type { Product } from '../types';
import {
  accessoryStockAt,
  accessoryTotalStock,
  addAccessoryStock,
  applyAccessoryIntegrity,
  moveAccessoryStock,
  removeAccessoryStock,
  sanitizeAccessoryProduct
} from './accessoryInventory.ts';

const mica = (over: Partial<Product> = {}): Product => ({
  id: 'prod-mica',
  code: 'CA-01',
  name: 'Mica 15',
  category: 'accesorio',
  inventoryType: 'accesorio',
  price: 150,
  stock: 10,
  ...over
});

const hidden = sanitizeAccessoryProduct(
  mica({
    stock: 8,
    branchStock: { all: 5, 'b-nav': 3, 'b-navojoa': 2 }
  })
);
assert.equal(accessoryStockAt(hidden, 'b-bodega'), 5);
assert.equal(accessoryStockAt(hidden, 'b-navojoa'), 5);
assert.equal(hidden.stock, 10);
assert.ok(!hidden.branchStock?.all);

const legacy = sanitizeAccessoryProduct(mica({ stock: 4 }));
assert.equal(accessoryStockAt(legacy, 'b-bodega'), 4);
assert.equal(accessoryStockAt(legacy, 'b-navojoa'), 0);

const soldLocal = removeAccessoryStock(
  mica({
    stock: 6,
    branchStock: { 'b-bodega': 1, 'b-navojoa': 4, 'b-huatabampo': 1 }
  }),
  'b-navojoa',
  4
);
assert.equal(accessoryStockAt(soldLocal, 'b-navojoa'), 0);
assert.equal(soldLocal.stock, 2);

const soldFromHidden = removeAccessoryStock(
  mica({
    stock: 10,
    branchStock: { all: 10 }
  }),
  'b-navojoa',
  3
);
assert.equal(accessoryTotalStock(soldFromHidden), 7);
assert.equal(accessoryStockAt(soldFromHidden, 'b-bodega'), 7);

const moved = moveAccessoryStock(
  mica({
    stock: 5,
    branchStock: { 'b-bodega': 5, 'b-navojoa': 0, 'b-huatabampo': 0 }
  }),
  'b-bodega',
  'b-huatabampo',
  2
);
assert.equal(accessoryStockAt(moved, 'b-bodega'), 3);
assert.equal(accessoryStockAt(moved, 'b-huatabampo'), 2);

const added = addAccessoryStock(mica({ stock: 0, branchStock: emptyLike() }), 'all', 6);
assert.equal(accessoryStockAt(added, 'b-bodega'), 6);

const reconciled = applyAccessoryIntegrity([
  mica({ stock: 3, branchStock: { all: 3, 'b-navojoa': 1 } })
]);
assert.equal(reconciled.changed.length, 1);
assert.equal(reconciled.changed[0].stock, 4);

console.log('accessoryInventory self-test ok');

function emptyLike(): Record<string, number> {
  return { 'b-bodega': 0, 'b-navojoa': 0, 'b-huatabampo': 0 };
}
