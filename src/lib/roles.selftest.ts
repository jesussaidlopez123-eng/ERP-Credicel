import assert from 'node:assert/strict';
import type { Operator } from '../types.ts';
import {
  canOpenModule,
  defaultModuleForOperator,
  defaultModuleForRole,
  defaultModulesForRole,
  resolveOperatorWorkspace,
  resolvedModuleIds,
  sanitizeModuleIds
} from './roles.ts';

assert.equal(canOpenModule('admin', 'credicelDashboard'), true);
assert.equal(canOpenModule('manager', 'credicelDashboard'), true);
assert.equal(canOpenModule('manager', 'repairs'), true);
assert.equal(canOpenModule('cashier', 'credicelDashboard'), false);
assert.equal(canOpenModule('cashier', 'repairs'), false);
assert.equal(canOpenModule('cashier', 'settings'), false);
assert.equal(defaultModuleForRole('admin'), 'credicelDashboard');
assert.equal(defaultModuleForRole('manager'), 'credicelDashboard');
assert.equal(defaultModuleForRole('cashier'), 'pos');

const cashier: Operator = {
  id: 'c1',
  name: 'Caja',
  username: 'caja',
  branchIds: ['b-navojoa'],
  role: 'cashier'
};

assert.equal(canOpenModule(cashier, 'pos'), true);
assert.equal(canOpenModule(cashier, 'inventory'), false);
assert.deepEqual(resolvedModuleIds(cashier), ['pos']);

const cashierWithInventory: Operator = {
  ...cashier,
  moduleIds: ['pos', 'inventory', 'repairs']
};
assert.equal(canOpenModule(cashierWithInventory, 'inventory'), true);
assert.equal(canOpenModule(cashierWithInventory, 'repairs'), true);
assert.equal(canOpenModule(cashierWithInventory, 'sales'), false);
assert.equal(canOpenModule(cashierWithInventory, 'settings'), false);
assert.equal(defaultModuleForOperator(cashierWithInventory), 'pos');

const notesOnly: Operator = {
  ...cashier,
  moduleIds: ['credicelDashboard', 'inventory']
};
assert.equal(defaultModuleForOperator(notesOnly), 'credicelDashboard');

const strippedSettings = sanitizeModuleIds(['pos', 'settings', 'inventory'], 'cashier');
assert.deepEqual(strippedSettings, ['pos', 'inventory']);

const manager: Operator = {
  id: 'm1',
  name: 'Encargada',
  username: 'encargada',
  branchIds: ['b-huatabampo', 'b-matriz'],
  role: 'manager',
  moduleIds: ['pos', 'sales']
};
assert.equal(canOpenModule(manager, 'sales'), true);
assert.equal(canOpenModule(manager, 'inventory'), false);
assert.equal(canOpenModule(manager, 'executive'), false);

const moved = resolveOperatorWorkspace(cashier, { id: 'b-matriz', name: 'Matriz' });
assert.equal(moved.id, 'b-navojoa');

const stillThere = resolveOperatorWorkspace(cashierWithInventory, {
  id: 'b-navojoa',
  name: 'Navojoa'
});
assert.equal(stillThere.id, 'b-navojoa');

const admin: Operator = {
  id: 'a1',
  name: 'Admin',
  username: 'admin',
  branchIds: ['b-navojoa'],
  role: 'admin'
};
assert.equal(resolveOperatorWorkspace(admin, { id: 'b-navojoa', name: 'Navojoa' }).id, 'all');
assert.equal(canOpenModule(admin, 'settings'), true);
assert.ok(defaultModulesForRole('admin').includes('purchases'));

console.log('roles.selftest ok');
