import assert from 'node:assert/strict';
import type { SaleTicket } from '../types';
import { dropAbsentFromLiveWindow, mergeByIdKeep } from './listMerge.ts';
import { excludeDeletedSales, rememberDeletedSaleIds } from './saleTombstones.ts';

const ticket = (id: string, timestamp: string, over: Partial<SaleTicket> = {}): SaleTicket =>
  ({
    id,
    timestamp,
    branchId: 'b-matriz',
    operatorName: 'Teresa',
    items: [],
    total: 1,
    paymentMethod: 'Efectivo',
    ...over
  }) as SaleTicket;

const today = ticket('TCK-HOY', '2026-11-07T21:00:00.000Z');
const alsoToday = ticket('TCK-BORRADA', '2026-11-07T22:00:00.000Z');
const older = ticket('TCK-AYER', '2026-11-06T12:00:00.000Z');

const afterDelete = dropAbsentFromLiveWindow([today, alsoToday, older], [today]);
assert.deepEqual(
  afterDelete.map((row) => row.id).sort(),
  ['TCK-AYER', 'TCK-HOY'],
  'la venta de hoy que ya no viene en vivo no debe quedarse en el caché'
);

const merged = mergeByIdKeep(afterDelete, [today]);
assert.equal(
  merged.some((row) => row.id === 'TCK-BORRADA'),
  false,
  'el merge no debe resucitar el folio borrado'
);

const pendingLocal = dropAbsentFromLiveWindow([today, alsoToday], [today], {
  keepIds: ['TCK-BORRADA']
});
assert.equal(
  pendingLocal.some((row) => row.id === 'TCK-BORRADA'),
  true,
  'un ticket que este equipo todavía no sube sí se conserva'
);

const completeLive = dropAbsentFromLiveWindow([today, older], [today], { liveIsComplete: true });
assert.deepEqual(
  completeLive.map((row) => row.id),
  ['TCK-HOY'],
  'si la nube ya mandó todas las ventas, no se conservan folios ausentes'
);

const cancelled = ticket('TCK-CANC', '2026-11-07T18:00:00.000Z', { estado: 'CANCELADA' });
assert.deepEqual(
  excludeDeletedSales([today, cancelled, alsoToday], ['TCK-BORRADA']).map((row) => row.id),
  ['TCK-HOY']
);

const ids = rememberDeletedSaleIds(['TCK-1'], ['TCK-2', 'TCK-1', '']);
assert.deepEqual(ids.sort(), ['TCK-1', 'TCK-2']);

console.log('saleTombstones self-test ok');
