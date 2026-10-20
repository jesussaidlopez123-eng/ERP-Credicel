/**
 * Tickets sin sesión del día siguen contando en el cierre.
 *
 *   npx tsx src/lib/shiftDocs.selftest.ts
 */
import assert from 'node:assert/strict';
import { cajaRangeQueryBounds, cashDayQueryBounds, docBelongsToOpenShift } from './shiftDocs.ts';

const session = {
  id: 'SES-HUA-20261014-MV8B3FY4',
  branchId: 'b-huatabampo',
  dateKey: '2026-10-14'
};

assert.equal(
  docBelongsToOpenShift(
    {
      branchId: 'b-huatabampo',
      timestamp: '2026-10-14T23:11:26.164Z',
      sesion_caja_id: undefined
    },
    session
  ),
  true,
  'ticket huérfano de hoy entra al corte'
);

assert.equal(
  docBelongsToOpenShift(
    {
      branchId: 'b-huatabampo',
      sucursal_id: 'b-huatabampo',
      timestamp: '2026-10-14T16:25:00.948Z',
      sesion_caja_id: session.id
    },
    session
  ),
  true,
  'ticket ya ligado al turno entra'
);

assert.equal(
  docBelongsToOpenShift(
    {
      branchId: 'b-navojoa',
      timestamp: '2026-10-14T19:45:09.623Z'
    },
    session
  ),
  false,
  'otra sucursal no se mezcla'
);

assert.equal(
  docBelongsToOpenShift(
    {
      branchId: 'b-huatabampo',
      timestamp: '2026-10-13T18:00:00.000Z'
    },
    session
  ),
  false,
  'ayer no entra al corte de hoy'
);

assert.equal(
  docBelongsToOpenShift(
    {
      branchId: 'b-huatabampo',
      timestamp: '2026-10-14T12:00:00.000Z',
      corteXId: 'SES-OTRO'
    },
    session
  ),
  false,
  'ya cerrado en otro corte no se vuelve a contar'
);

assert.equal(
  docBelongsToOpenShift(
    {
      branchId: 'b-huatabampo',
      timestamp: '2026-10-14T12:00:00.000Z',
      estado: 'CANCELADA'
    },
    session
  ),
  false,
  'cancelada no suma'
);

const bounds = cashDayQueryBounds('2026-10-14');
assert.equal(bounds.start, '2026-10-14T00:00:00.000Z');
assert.ok(bounds.end.startsWith('2026-10-15'));

const weekBounds = cajaRangeQueryBounds('2026-10-12', '2026-10-14');
assert.equal(weekBounds.start, '2026-10-12T00:00:00.000Z');
assert.ok(weekBounds.end.startsWith('2026-10-15'));

console.log('shiftDocs.selftest: ok');
