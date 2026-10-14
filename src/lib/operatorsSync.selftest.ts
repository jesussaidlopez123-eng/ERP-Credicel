/**
 * La nube incompleta no puede borrar usuarios de la caja.
 *
 *   npx tsx src/lib/operatorsSync.selftest.ts
 */
import assert from 'node:assert/strict';
import type { Operator } from '../types.ts';
import { INITIAL_OPERATORS } from '../data/initialOperators.ts';
import {
  isDemoSeedList,
  mergeOperatorLists,
  operatorsNeedPersist,
  pickRicherOperator,
  visibleOperators
} from './operatorsSync.ts';

const admin: Operator = {
  id: 'op-admin',
  name: 'Saíd Administrador',
  username: 'said',
  password: 'secreto',
  branchIds: ['all'],
  role: 'admin',
  isMainAdmin: true
};

const cajera: Operator = {
  id: 'op-tere',
  name: 'Teresa',
  username: 'teresa',
  password: 'caja1',
  branchIds: ['b-matriz'],
  role: 'cashier'
};

const encargado: Operator = {
  id: 'op-gera',
  name: 'Geraldín',
  username: 'geraldin',
  password: 'nav1',
  branchIds: ['b-huatabampo'],
  role: 'manager'
};

assert.equal(isDemoSeedList(INITIAL_OPERATORS), true);
assert.equal(isDemoSeedList([admin, cajera]), false);
assert.equal(isDemoSeedList([{ ...INITIAL_OPERATORS[0], password: 'otra' }, ...INITIAL_OPERATORS.slice(1)]), false);

const incompleteCloud = [admin];
const localFull = [admin, cajera, encargado];
const recovered = mergeOperatorLists(localFull, incompleteCloud);
assert.equal(recovered.merged.length, 3, 'la caja conserva a Teresa y Geraldín');
assert.deepEqual(
  recovered.missingInCloud.map((o) => o.id).sort(),
  ['op-gera', 'op-tere'],
  'hay que resubir a quien la nube no tiene'
);
assert.equal(recovered.merged.find((o) => o.id === 'op-tere')?.password, 'caja1');

const emptyCloud = mergeOperatorLists(localFull, []);
assert.equal(emptyCloud.merged.length, 3, 'nube vacía no borra la lista local');
assert.equal(emptyCloud.missingInCloud.length, 3);

const seedVsCloud = mergeOperatorLists(INITIAL_OPERATORS, [admin, cajera]);
assert.equal(
  seedVsCloud.merged.some((o) => o.username === 'juan' || o.username === 'maria'),
  false,
  'no se inyectan usuarios de demostración en producción'
);
assert.equal(seedVsCloud.missingInCloud.length, 0, 'el seed no se sube a Firestore');

const cloudSinClave: Operator = { ...admin, password: '' };
const withPassword = pickRicherOperator(cloudSinClave, admin);
assert.equal(withPassword.password, 'secreto', 'si la nube llega sin clave, se conserva la de la caja');

const sessionOnly = mergeOperatorLists([admin], [admin], cajera);
assert.ok(sessionOnly.merged.some((o) => o.id === 'op-tere'), 'el usuario de la sesión vuelve a la lista');
assert.ok(sessionOnly.missingInCloud.some((o) => o.id === 'op-tere'));

const tombstoned: Operator = { ...cajera, removedAt: '2026-10-14T12:00:00.000Z' };
const afterDelete = mergeOperatorLists([admin, cajera], [admin, tombstoned]);
assert.equal(visibleOperators(afterDelete.merged).some((o) => o.id === 'op-tere'), false);
assert.equal(afterDelete.missingInCloud.some((o) => o.id === 'op-tere'), false);

const sameUserNewId = mergeOperatorLists(
  [{ ...cajera, id: 'op-tere-viejo' }],
  [{ ...cajera, password: '' }]
);
assert.equal(sameUserNewId.merged.length, 1);
assert.equal(sameUserNewId.merged[0].id, 'op-tere');
assert.equal(sameUserNewId.merged[0].password, 'caja1');
assert.equal(sameUserNewId.missingInCloud.length, 0);

assert.equal(operatorsNeedPersist(localFull, localFull), false);
assert.equal(operatorsNeedPersist([admin], recovered.merged), true);

console.log('operatorsSync.selftest: ok');
