import { authorizeWithOperatorPassword } from './inventoryAuth';
import type { Operator } from '../types';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const op: Operator = {
  id: '1',
  name: 'Admin',
  username: 'admin',
  password: 'clave-real',
  branchIds: ['all'],
  role: 'admin'
};

assert(
  authorizeWithOperatorPassword('clave-real', op) === null,
  'la contraseña correcta autoriza'
);
assert(
  authorizeWithOperatorPassword('otra', op) === 'Contraseña incorrecta. No se aplicó ningún cambio.',
  'la incorrecta no autoriza'
);
assert(
  authorizeWithOperatorPassword('  clave-real  ', op) === null,
  'se aceptan espacios alrededor'
);
assert(
  authorizeWithOperatorPassword('', op)?.includes('ingresa') === true,
  'vacía no autoriza'
);
assert(
  authorizeWithOperatorPassword('x', { ...op, password: '' })?.includes('no tiene contraseña') === true,
  'sin contraseña configurada no autoriza'
);

console.log('inventoryAuth.selftest ok');
