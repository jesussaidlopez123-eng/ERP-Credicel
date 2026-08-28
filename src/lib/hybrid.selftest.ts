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

// ---- firma del respaldo ----
const firmaA = computeChecksum(['t1', 't2'], ['g1'], 1307);
const firmaB = computeChecksum(['t2', 't1'], ['g1'], 1307);
const firmaC = computeChecksum(['t1', 't2', 't3'], ['g1'], 1307);
assert.equal(firmaA, firmaB, 'el orden de los tickets no cambia la firma');
assert.notEqual(firmaA, firmaC, 'si falta o sobra un ticket, la firma cambia');

console.log('hybrid self-test ok');
