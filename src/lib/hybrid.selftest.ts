/**
 * Pruebas del modo híbrido: almacén local, cola de envío, folios y respaldo.
 * Corre en Node sin IndexedDB, así que ejercita el camino de respaldo reducido.
 *
 *   npx tsx src/lib/hybrid.selftest.ts
 */
import assert from 'node:assert/strict';

class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const { trustedNow, trustedIso, observeTrustedIso, clockLooksWrong } = await import('./clockGuard.ts');
const { getDeviceCode, getDeviceId } = await import('./deviceId.ts');
const { putRecord, listRecords, getRecord, getMeta, setMeta } = await import('./localDb.ts');
const { enqueue, drainOutbox, listPendingOutbox, registerOutboxExecutor, refreshStatus } = await import(
  './outbox.ts'
);
const { computeChecksum } = await import('./dailyBackup.ts');
const { formatTicketFolio } = await import('./ids.ts');

// ---- reloj blindado ----
const first = trustedNow().getTime();
observeTrustedIso(new Date(first + 60 * 60 * 1000).toISOString());
const afterFuture = trustedNow().getTime();
assert.ok(afterFuture >= first, 'la marca de tiempo nunca retrocede');
assert.equal(clockLooksWrong(), true, 'un reloj atrasado frente a lo ya visto se detecta');
assert.match(trustedIso(), /^\d{4}-\d{2}-\d{2}T/);

// ---- identidad del equipo ----
assert.equal(getDeviceId(), getDeviceId(), 'el id del equipo es estable');
assert.equal(getDeviceCode().length, 3, 'la clave corta de caja cabe en un folio');

// ---- almacén local ----
await putRecord({
  kind: 'sale',
  id: 'TCK-1',
  branchId: 'b-navojoa',
  dateKey: '2026-08-28',
  data: { id: 'TCK-1', total: 120 },
  updatedAt: trustedIso()
});
const saved = await getRecord<{ total: number }>('sale', 'TCK-1');
assert.equal(saved?.data.total, 120, 'la venta queda guardada en el equipo');
assert.equal((await listRecords('sale')).length, 1);

await setMeta('prueba', { ok: true });
assert.deepEqual(await getMeta('prueba'), { ok: true });

// ---- cola: orden estricto por sucursal ----
const ejecutadas: string[] = [];
let fallaPrimera = true;

registerOutboxExecutor('prueba', async (payload) => {
  const { nombre } = payload as { nombre: string };
  if (nombre === 'venta-1' && fallaPrimera) {
    throw new Error('sin conexión simulada');
  }
  ejecutadas.push(nombre);
});

await enqueue({ kind: 'prueba', groupKey: 'b-navojoa', payload: { nombre: 'venta-1' } });
await enqueue({ kind: 'prueba', groupKey: 'b-navojoa', payload: { nombre: 'venta-2' } });
await enqueue({ kind: 'prueba', groupKey: 'b-navojoa', payload: { nombre: 'corte' } });
await enqueue({ kind: 'prueba', groupKey: 'b-huatabampo', payload: { nombre: 'otra-sucursal' } });

await drainOutbox();
assert.deepEqual(
  ejecutadas,
  ['otra-sucursal'],
  'si la primera venta falla, su corte espera; otra sucursal sí avanza'
);
assert.equal((await listPendingOutbox()).length, 3, 'nada se descarta al fallar');

fallaPrimera = false;
// El reintento respeta la espera creciente: lo forzamos como haría el botón "Subir ahora".
for (const row of await listPendingOutbox()) {
  const { putOutboxRow } = await import('./localDb.ts');
  await putOutboxRow({ ...row, nextAttemptAt: 0 });
}
await drainOutbox();

assert.deepEqual(
  ejecutadas,
  ['otra-sucursal', 'venta-1', 'venta-2', 'corte'],
  'al volver la conexión suben en orden: primero los tickets, luego el corte'
);
assert.equal((await listPendingOutbox()).length, 0, 'la cola queda limpia');
assert.equal((await refreshStatus()).pending, 0);

// ---- reencolar el mismo registro no lo duplica ----
await enqueue({ kind: 'prueba', groupKey: 'b-navojoa', id: 'fijo', payload: { nombre: 'x' } });
await enqueue({ kind: 'prueba', groupKey: 'b-navojoa', id: 'fijo', payload: { nombre: 'x' } });
assert.equal((await listPendingOutbox()).length, 1, 'un id fijo reemplaza, no duplica');

// ---- folios ----
assert.equal(formatTicketFolio('b-navojoa', '2026-08-28', 7), 'NAV-2808-007');
assert.equal(formatTicketFolio('b-huatabampo', '2026-08-28', 142), 'HUA-2808-142');
const folios = new Set<string>();
for (let seq = 1; seq <= 200; seq++) {
  folios.add(formatTicketFolio('b-navojoa', '2026-08-28', seq));
}
assert.equal(folios.size, 200, 'los folios del bloque no se repiten');

// ---- limpieza del historial viejo, sin tocar lo pendiente ----
const { pruneOldLocalRecords, forgetLocalSale } = await import('./syncQueue.ts');

await putRecord({
  kind: 'sale',
  id: 'TCK-VIEJO',
  branchId: 'b-navojoa',
  dateKey: '2020-01-01',
  data: { id: 'TCK-VIEJO', total: 10 },
  updatedAt: '2020-01-01T12:00:00-07:00'
});
await putRecord({
  kind: 'sale',
  id: 'TCK-VIEJO-PENDIENTE',
  branchId: 'b-navojoa',
  dateKey: '2020-01-01',
  data: { id: 'TCK-VIEJO-PENDIENTE', total: 10 },
  updatedAt: '2020-01-01T12:00:00-07:00'
});
await enqueue({
  kind: 'prueba',
  groupKey: 'b-navojoa',
  id: 'sale-TCK-VIEJO-PENDIENTE',
  payload: { nombre: 'pendiente-viejo' }
});

await pruneOldLocalRecords();
assert.equal(
  await getRecord('sale', 'TCK-VIEJO'),
  null,
  'lo viejo ya confirmado se suelta para no llenar el equipo'
);
assert.ok(
  await getRecord('sale', 'TCK-VIEJO-PENDIENTE'),
  'lo viejo que sigue en la cola nunca se borra'
);
assert.ok(await getRecord('sale', 'TCK-1'), 'lo reciente se conserva');

await forgetLocalSale('TCK-1');
assert.equal(
  await getRecord('sale', 'TCK-1'),
  null,
  'un ticket cancelado no revive desde el respaldo local'
);

// ---- respaldo diario: no rebasar el tamaño de un documento ----
const { backupForCloud } = await import('./dailyBackup.ts');
const baseBackup = {
  id: 'b-navojoa-2026-08-28',
  branchId: 'b-navojoa',
  branchName: 'Navojoa',
  dateKey: '2026-08-28',
  generatedAt: trustedIso(),
  deviceId: getDeviceId(),
  deviceLabel: 'Caja',
  ticketCount: 3,
  expenseCount: 0,
  totalSales: 300,
  cashSales: 300,
  cardSales: 0,
  transferSales: 0,
  totalExpenses: 0,
  corteIds: [],
  ticketIds: ['a', 'b', 'c'],
  expenseIds: [],
  tickets: [],
  expenses: [],
  cortes: [],
  checksum: 'X'
};
const chico = backupForCloud({ ...baseBackup, tickets: new Array(10).fill({ id: 'x' }) } as never);
assert.equal(chico.tickets.length, 10, 'un día normal sube con su detalle');
const grande = backupForCloud({ ...baseBackup, tickets: new Array(600).fill({ id: 'x' }) } as never);
assert.equal(grande.truncated, true, 'un día enorme sube como resumen');
assert.equal(grande.ticketIds.length, 3, 'el resumen conserva la lista de folios');

// ---- firma del respaldo ----
const firmaA = computeChecksum(['t1', 't2'], ['g1'], 1307);
const firmaB = computeChecksum(['t2', 't1'], ['g1'], 1307);
const firmaC = computeChecksum(['t1', 't2', 't3'], ['g1'], 1307);
assert.equal(firmaA, firmaB, 'el orden de los tickets no cambia la firma');
assert.notEqual(firmaA, firmaC, 'si falta o sobra un ticket, la firma cambia');

// ---- costos de taller ----
const { applyRepairCost, isPendingRepair } = await import('./repairUtils.ts');
const taller = {
  id: 'REP-3108-K3M01',
  clientName: 'Ana',
  clientPhone: '6441234567',
  deviceModel: 'iPhone 12',
  issueDescription: 'Pantalla',
  totalCost: 0,
  advancePayment: 200,
  pendingBalance: 200,
  status: 'en_taller' as const,
  receivedAt: '31/08/2026',
  operatorName: 'Juan',
  branchId: 'b-navojoa'
};
assert.equal(isPendingRepair(taller), true, 'en taller cuenta como pendiente');
const conCosto = applyRepairCost(taller, 1800, 'Admin Principal', '2026-08-31T18:00:00.000Z', 'Cambio de display');
assert.equal(conCosto.totalCost, 1800);
assert.equal(conCosto.pendingBalance, 1600, 'el saldo es costo menos anticipo');
assert.equal(conCosto.costUpdates?.length, 1);
assert.throws(
  () => applyRepairCost(taller, 100, 'Admin Principal', '2026-08-31T18:00:00.000Z'),
  /anticipo/,
  'no se puede bajar el costo debajo del anticipo cobrado'
);
assert.equal(isPendingRepair({ ...taller, status: 'entregado' }), false);

const { inferRepairsFromTickets, mergeRepairSources } = await import('./repairUtils.ts');
const inferidos = inferRepairsFromTickets([
  {
    id: 'TCK-1',
    timestamp: '2026-08-27T16:58:30.972Z',
    branchId: 'b-huatabampo',
    operatorName: 'Teresa',
    total: 0,
    paymentMethod: 'Efectivo',
    items: [
      {
        cartItemId: 'i1',
        product: { id: 'p', code: 'REP-1082', name: 'Recepción', category: 'servicio', price: 0, stock: 1 },
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        metadata: {
          repairId: 'REP-1082',
          clientName: 'ana guadalupe',
          clientPhone: '6471086212',
          deviceModel: 'motola g06',
          issueDescription: 'cambio de pantalla',
          repairType: 'anticipo',
          totalRepairCost: 700,
          pendingBalance: 700,
          receivedAt: '27 ago 2026 09:58'
        }
      }
    ]
  }
]);
assert.equal(inferidos.length, 1);
assert.equal(inferidos[0].status, 'en_taller');
assert.equal(inferidos[0].clientName, 'ana guadalupe');
const oficiales = mergeRepairSources(inferidos, [
  { ...inferidos[0], clientName: 'Ana Guadalupe', totalCost: 750, pendingBalance: 750 }
]);
assert.equal(oficiales[0].clientName, 'Ana Guadalupe', 'la ficha oficial no se pisa con la reconstruida');
assert.equal(
  mergeRepairSources([], inferidos).length,
  1,
  'si la nube no trae la ficha, el pendiente reconstruido se conserva'
);

const { mergeByIdKeep, oldestTimestamp } = await import('./listMerge.ts');
const kept = mergeByIdKeep(
  [
    { id: 'a', timestamp: '2026-08-01' },
    { id: 'b', timestamp: '2026-08-20' }
  ],
  [{ id: 'b', timestamp: '2026-09-01' }, { id: 'c', timestamp: '2026-09-01' }]
);
assert.equal(kept.length, 3, 'las páginas viejas no se tiran al llegar el recorte en vivo');
assert.equal(kept.find((r) => r.id === 'b')?.timestamp, '2026-09-01', 'el id vivo pisa al viejo');
assert.equal(oldestTimestamp(kept, 'timestamp'), '2026-08-01', 'el cursor de historial es el más viejo');

console.log('hybrid self-test ok');
