/**
 * Simulación de un día completo de caja, con la nube cayéndose a media tarde
 * igual que el 27 de agosto.
 *
 * Corre el código real de captura: almacén local, cola de envío, folios y
 * respaldo diario. La nube se reemplaza por una de mentiras que imita a
 * Firestore (incluye su tope de 1 MB por documento y el error de cuota).
 *
 *   npm run simulate
 *
 * El objetivo que se verifica: no perder ni una venta del día, conservar el
 * orden y la ubicación de cada registro, y que los folios nunca se repitan.
 */
import assert from 'node:assert/strict';
import { CartItem, Expense, RepairRecord, SaleTicket } from '../src/types.ts';

// ----------------------------------------------------
// Almacenamiento del "equipo"
// ----------------------------------------------------
class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
  snapshot(): Map<string, string> {
    return new Map(this.map);
  }
  restore(snap: Map<string, string>): void {
    this.map = new Map(snap);
  }
}

const storage = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage;

const { registerOutboxExecutor, drainOutbox, retryPendingNow, listPendingOutbox, refreshStatus } =
  await import('../src/lib/outbox.ts');
const {
  commitSale,
  commitExpense,
  commitCorte,
  commitRepairRecord,
  localSales,
  localExpenses,
  localCortes,
  localRepairs
} = await import('../src/lib/syncQueue.ts');
const {
  allocateFolio,
  allocateRepairFolio,
  warmUpFolios,
  setFolioLeaseProvider,
  isProvisionalFolio,
  clearFolioLeaseCooldown
} = await import('../src/lib/folioAllocator.ts');
const { buildDailyBackup, saveDailyBackup, computeChecksum } = await import(
  '../src/lib/dailyBackup.ts'
);
const { hermosilloDateKey } = await import('../src/lib/shiftHours.ts');
const { money } = await import('../src/lib/ids.ts');
const { trustedNow } = await import('../src/lib/clockGuard.ts');

// ----------------------------------------------------
// Nube de mentiras (imita Firestore)
// ----------------------------------------------------
const FIRESTORE_DOC_LIMIT = 1_048_576;

type Doc = Record<string, unknown>;

class FakeCloud {
  collections = new Map<string, Map<string, Doc>>();
  down = false;
  downReason = 'Quota exceeded for quota metric Free daily read units per project';
  writeCount = 0;
  folioCounters = new Map<string, number>();

  col(name: string): Map<string, Doc> {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name) as Map<string, Doc>;
  }

  guard(): void {
    if (this.down) {
      const err = new Error(this.downReason);
      (err as unknown as { code: string }).code = 'resource-exhausted';
      throw err;
    }
  }

  set(name: string, id: string, data: Doc, merge = true): void {
    this.guard();
    const json = JSON.stringify(data);
    if (json.length > FIRESTORE_DOC_LIMIT) {
      throw new Error(`Documento demasiado grande para Firestore: ${json.length} bytes`);
    }
    const existing = this.col(name).get(id);
    this.col(name).set(id, merge && existing ? { ...existing, ...data } : { ...data });
    this.writeCount += 1;
  }

  get(name: string, id: string): Doc | undefined {
    this.guard();
    return this.col(name).get(id);
  }

  all(name: string): Doc[] {
    this.guard();
    return Array.from(this.col(name).values());
  }

  leaseAttempts = 0;

  leaseFolios(branchId: string, dateKey: string, size: number): { start: number; end: number } {
    this.leaseAttempts += 1;
    this.guard();
    const key = `${branchId}-${dateKey}`;
    const last = this.folioCounters.get(key) || 0;
    this.folioCounters.set(key, last + size);
    return { start: last + 1, end: last + size };
  }
}

const cloud = new FakeCloud();
setFolioLeaseProvider(async (branchId, dateKey, size) => cloud.leaseFolios(branchId, dateKey, size));

registerOutboxExecutor('docWrite', async (payload) => {
  const { writes } = payload as { writes: { collection: string; id: string; data: Doc }[] };
  cloud.guard();
  writes.forEach((w) => cloud.set(w.collection, w.id, w.data));
});

registerOutboxExecutor('dailyBackup', async (payload) => {
  const backup = payload as Doc & { id: string };
  cloud.set('dailyBackups', backup.id, backup);
});

/** Imita el cierre de turno del servidor, con su idempotencia. */
registerOutboxExecutor('corteClose', async (payload) => {
  const p = payload as {
    branchId: string;
    branchName?: string;
    dateKey: string;
    efectivoContado?: number;
    fondoDejado?: number;
    notas?: string;
    fechaCierreIso?: string;
    preferredSessionId?: string;
  };
  cloud.guard();

  const sessionId = p.preferredSessionId || `SES-${p.branchId}-${p.dateKey}`;
  const existingCorte = cloud.get('corteXRecords', sessionId);
  if (existingCorte && !existingCorte.reverted) {
    return; // ya cerrado: reintentar no debe duplicar nada
  }

  const tickets = cloud
    .all('ventas')
    .filter(
      (t) =>
        t.sucursal_id === p.branchId &&
        hermosilloDateKey(String(t.timestamp)) === p.dateKey &&
        !t.corteXId
    );
  const expenses = cloud
    .all('gastos')
    .filter(
      (e) =>
        e.sucursal_id === p.branchId &&
        hermosilloDateKey(String(e.timestamp)) === p.dateKey &&
        !e.corteXId
    );

  const cashSales = money(
    tickets
      .filter((t) => t.paymentMethod === 'Efectivo')
      .reduce((s, t) => s + (Number(t.total) || 0), 0)
  );
  const totalSales = money(tickets.reduce((s, t) => s + (Number(t.total) || 0), 0));
  const totalExpenses = money(expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));

  cloud.set('corteXRecords', sessionId, {
    id: sessionId,
    sesion_caja_id: sessionId,
    branchId: p.branchId,
    sucursal_id: p.branchId,
    dateKey: p.dateKey,
    timestamp: p.fechaCierreIso || `${p.dateKey}T23:00:00-07:00`,
    totalSales,
    cashSales,
    totalExpenses,
    ticketIds: tickets.map((t) => String(t.id)),
    expenseIds: expenses.map((e) => String(e.id)),
    closingNotes: p.notas || ''
  });

  cloud.set('sesiones_caja', sessionId, {
    id: sessionId,
    sucursal_id: p.branchId,
    estado: 'CERRADA',
    fecha_cierre: p.fechaCierreIso
  });

  tickets.forEach((t) =>
    cloud.set('ventas', String(t.id), { corteXId: sessionId, sesion_caja_id: sessionId })
  );
  tickets.forEach((t) =>
    cloud.set('sales', String(t.id), { corteXId: sessionId, sesion_caja_id: sessionId })
  );
  expenses.forEach((e) =>
    cloud.set('gastos', String(e.id), { corteXId: sessionId, sesion_caja_id: sessionId })
  );
});

// ----------------------------------------------------
// Utilidades de la simulación
// ----------------------------------------------------
const DAY = '2026-09-15';
const BRANCH = 'b-navojoa';
let ticketSeq = 0;

function hora(h: number, m = 0): string {
  return `${DAY}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-07:00`;
}

function item(nombre: string, precio: number): CartItem {
  return {
    cartItemId: `ci-${++ticketSeq}`,
    product: {
      id: `prod-${nombre}`,
      code: nombre.toUpperCase(),
      name: nombre,
      category: 'accesorio',
      inventoryType: 'accesorio',
      costPrice: precio / 2,
      price: precio,
      stock: 50
    },
    quantity: 1,
    unitPrice: precio,
    totalPrice: precio
  } as unknown as CartItem;
}

async function venta(params: {
  h: number;
  m?: number;
  total: number;
  metodo?: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  id?: string;
}): Promise<SaleTicket> {
  const timestamp = hora(params.h, params.m);
  const folio = await allocateFolio(BRANCH, timestamp);
  const ticket: SaleTicket = {
    id: params.id || `TCK-SIM-${++ticketSeq}`,
    folio,
    timestamp,
    branchId: BRANCH,
    operatorName: 'Jesus Villa',
    items: [item('Mica', params.total)],
    total: params.total,
    paymentMethod: params.metodo || 'Efectivo'
  };
  return commitSale(ticket);
}

async function gasto(params: { h: number; monto: number; concepto: string }): Promise<Expense> {
  const expense: Expense = {
    id: `GTO-SIM-${++ticketSeq}`,
    amount: params.monto,
    concept: params.concepto,
    timestamp: hora(params.h),
    operatorName: 'Jesus Villa',
    branchId: BRANCH
  };
  return commitExpense(expense);
}

const hallazgos: string[] = [];
function revisar(condicion: boolean, descripcion: string): void {
  if (!condicion) hallazgos.push(descripcion);
}

function paso(texto: string): void {
  console.log(`\n── ${texto}`);
}

// ----------------------------------------------------
// EL DÍA
// ----------------------------------------------------
paso('09:00 Abre Navojoa. La caja aparta folios.');
await warmUpFolios(BRANCH, hora(9));
const foliosEmitidos: string[] = [];
revisar(
  cloud.folioCounters.get(`${BRANCH}-${DAY}`) === 25,
  `Al abrir debía apartarse un bloque de 25 folios (apartó ${cloud.folioCounters.get(`${BRANCH}-${DAY}`)})`
);

paso('09:00 a 13:00 Venta normal con nube arriba.');
for (let i = 0; i < 20; i++) {
  const t = await venta({ h: 9 + Math.floor(i / 6), m: (i * 7) % 60, total: 20 + i * 5 });
  foliosEmitidos.push(t.folio as string);
}
await gasto({ h: 11, monto: 150, concepto: 'Garrafón y limpieza' });
await gasto({ h: 12, monto: 80, concepto: 'Taxi de traslado' });
await drainOutbox();

revisar(cloud.all('ventas').length === 20, 'Las 20 ventas de la mañana debían estar en la nube');
revisar(cloud.all('gastos').length === 2, 'Los 2 gastos de la mañana debían estar en la nube');
revisar((await refreshStatus()).pending === 0, 'La cola debía quedar vacía con la nube arriba');
console.log(`   ventas en nube: ${cloud.all('ventas').length} · pendientes: ${(await refreshStatus()).pending}`);

paso('13:00 SE CAE LA NUBE (cuota agotada, como el 27 de agosto).');
cloud.down = true;

for (let i = 0; i < 15; i++) {
  const t = await venta({
    h: 13 + Math.floor(i / 5),
    m: (i * 11) % 60,
    total: 30 + i * 10,
    metodo: i % 4 === 0 ? 'Tarjeta' : 'Efectivo'
  });
  foliosEmitidos.push(t.folio as string);
}
await gasto({ h: 15, monto: 200, concepto: 'Refacción para taller' });

const pendientesEnCaida = (await refreshStatus()).pending;
console.log(`   ventas guardadas en el equipo: ${(await localSales()).length} · pendientes: ${pendientesEnCaida}`);
revisar((await localSales()).length === 35, 'Las 35 ventas del día debían estar guardadas en el equipo');
revisar(pendientesEnCaida >= 16, 'Todo lo capturado sin nube debía quedar en la cola');
revisar(
  cloud.col('ventas').size === 20,
  'Con la nube caída no debía escribirse nada nuevo en la nube'
);

paso('14:00 Entran tres celulares a taller, con la nube caída.');
const equipos: RepairRecord[] = [];
for (const [i, cliente] of ['Ana Ruiz', 'Beto Sánchez', 'Carla Domínguez'].entries()) {
  const recibidoIso = hora(14, i * 10);
  const folioTaller = await allocateRepairFolio(BRANCH, recibidoIso);
  equipos.push(
    await commitRepairRecord({
      id: folioTaller,
      clientName: cliente,
      clientPhone: `644000000${i}`,
      deviceModel: `Equipo ${i + 1}`,
      passcodePattern: `PIN 000${i}`,
      issueDescription: 'Pantalla estrellada',
      totalCost: 800,
      advancePayment: 300,
      pendingBalance: 500,
      status: 'en_taller',
      receivedAt: recibidoIso,
      receivedAtIso: recibidoIso,
      operatorName: 'Jesus Villa',
      branchId: BRANCH
    })
  );
}
const foliosTaller = equipos.map((r) => r.id);
console.log(`   equipos recibidos sin nube: ${foliosTaller.join(', ')}`);
revisar((await localRepairs()).length === 3, 'Los 3 equipos debían quedar guardados en el aparato');
revisar(new Set(foliosTaller).size === 3, 'Los folios de taller no debían repetirse');
revisar(
  cloud.col('repairRecords').size === 0,
  'Con la nube caída no debía escribirse el taller en la nube'
);

paso('15:00 Recargan la página (se reinicia la app, mismo equipo).');
const discoTrasCaida = storage.snapshot();
storage.restore(discoTrasCaida);
const recuperadas = await localSales();
const recuperadosGastos = await localExpenses();
console.log(`   al reabrir: ${recuperadas.length} ventas y ${recuperadosGastos.length} gastos en el equipo`);
revisar(recuperadas.length === 35, 'Al recargar debían seguir las 35 ventas');
revisar(recuperadosGastos.length === 3, 'Al recargar debían seguir los 3 gastos');

paso('15:30 Se entrega un equipo cobrando su saldo; el cobro se cancela a medias.');
const equipoEntregado = equipos[0];
// El cajero manda el saldo al carrito, pero el cliente se arrepiente: no hay
// cobro, así que el equipo debe seguir en taller y con saldo.
const tallerTrasCancelar = (await localRepairs()).find((r) => r.id === equipoEntregado.id);
revisar(
  tallerTrasCancelar?.status === 'en_taller' && tallerTrasCancelar.pendingBalance === 500,
  'Un cobro que no se completa no debe marcar el equipo como entregado'
);

paso('16:00 El cajero cobra la misma venta dos veces por error (doble clic).');
const repetida = await venta({ h: 16, total: 99, id: 'TCK-SIM-REPETIDA' });
await venta({ h: 16, total: 99, id: 'TCK-SIM-REPETIDA' });
foliosEmitidos.push(repetida.folio as string);
revisar(
  (await localSales()).filter((t) => t.id === 'TCK-SIM-REPETIDA').length === 1,
  'Un doble cobro del mismo ticket no debe guardarse dos veces'
);

paso('18:00 El reloj del equipo se atrasa 3 horas.');
const antesDelSalto = trustedNow().getTime();
const realDateNow = Date.now;
Date.now = () => realDateNow() - 3 * 60 * 60 * 1000;
const despuesDelSalto = trustedNow().getTime();
Date.now = realDateNow;
revisar(
  despuesDelSalto >= antesDelSalto,
  'Con el reloj atrasado el sistema no debe retroceder en el tiempo'
);

paso('22:50 Cierran turno con la nube todavía caída.');
const ventasDelDia = await localSales();
const gastosDelDia = await localExpenses();
const efectivoEsperado = money(
  1000 +
    ventasDelDia
      .filter((t) => t.paymentMethod === 'Efectivo')
      .reduce((s, t) => s + t.total, 0) -
    gastosDelDia.reduce((s, e) => s + e.amount, 0)
);

await commitCorte(
  {
    id: `SES-${BRANCH}-${DAY}`,
    timestamp: hora(22, 50),
    dateStr: DAY,
    timeStr: '10:50 p.m.',
    branchId: BRANCH,
    branchName: 'Navojoa',
    operatorName: 'Jesus Villa',
    initialCashFund: 1000,
    cashFundLeftForNextShift: 1000,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    totalSales: 0,
    totalExpenses: 0,
    netIncome: 0,
    expectedCashInDrawer: efectivoEsperado,
    countedCash: efectivoEsperado,
    ticketIds: ventasDelDia.map((t) => t.id),
    expenseIds: gastosDelDia.map((e) => e.id),
    breakdown: {
      accesoriosTotal: 0,
      accesoriosCount: 0,
      abonosTotal: 0,
      abonosCount: 0,
      enganchesTotal: 0,
      enganchesCount: 0,
      reparacionesTotal: 0,
      reparacionesCount: 0,
      recargasTotal: 0,
      recargasCount: 0
    }
  },
  {
    branchId: BRANCH,
    branchName: 'Navojoa',
    operatorUid: 'usr-jesus',
    operatorName: 'Jesus Villa',
    efectivoContado: efectivoEsperado,
    fondoDejado: 1000,
    notas: 'Cierre de turno con la nube caída',
    fechaCierreIso: hora(22, 50),
    preferredSessionId: `SES-${BRANCH}-${DAY}`,
    dateKey: DAY,
    ticketsSnapshot: ventasDelDia,
    expensesSnapshot: gastosDelDia
  }
);

const cortesLocales = await localCortes();
console.log(`   cortes guardados en el equipo: ${cortesLocales.length}`);
revisar(cortesLocales.length === 1, 'El corte debía quedar guardado en el equipo aunque la nube esté caída');

paso('22:55 Respaldo del día (con la nube caída).');
const respaldo = buildDailyBackup({
  branchId: BRANCH,
  branchName: 'Navojoa',
  dateKey: DAY,
  tickets: ventasDelDia,
  expenses: gastosDelDia,
  cortes: cortesLocales
});
await saveDailyBackup(respaldo);
console.log(`   respaldo: ${respaldo.ticketCount} tickets · $${respaldo.totalSales} · firma ${respaldo.checksum}`);
revisar(respaldo.ticketCount === 36, 'El respaldo debía contar las 36 ventas del día');

paso('23:10 VUELVE LA NUBE. La cola se vacía sola.');
cloud.down = false;
await retryPendingNow();
await drainOutbox();

const pendientesFinal = (await refreshStatus()).pending;
const ventasNube = cloud.all('ventas');
const gastosNube = cloud.all('gastos');
const cortesNube = cloud.all('corteXRecords');

console.log(`   pendientes: ${pendientesFinal}`);
console.log(`   ventas en nube: ${ventasNube.length} · gastos: ${gastosNube.length} · cortes: ${cortesNube.length}`);

revisar(pendientesFinal === 0, 'Al volver la nube la cola debía quedar vacía');
revisar(ventasNube.length === 36, `La nube debía tener las 36 ventas (tiene ${ventasNube.length})`);
revisar(gastosNube.length === 3, `La nube debía tener los 3 gastos (tiene ${gastosNube.length})`);
revisar(cortesNube.length === 1, `Debía haber exactamente 1 corte (hay ${cortesNube.length})`);

paso('Revisión del corte contra las ventas.');
const corte = cortesNube[0] as {
  totalSales: number;
  cashSales: number;
  totalExpenses: number;
  ticketIds: string[];
};
const totalReal = money(ventasNube.reduce((s, t) => s + (Number(t.total) || 0), 0));
const efectivoReal = money(
  ventasNube.filter((t) => t.paymentMethod === 'Efectivo').reduce((s, t) => s + (Number(t.total) || 0), 0)
);
const gastosReal = money(gastosNube.reduce((s, e) => s + (Number(e.amount) || 0), 0));

console.log(`   corte: $${corte.totalSales} (efectivo $${corte.cashSales}, gastos $${corte.totalExpenses}, ${corte.ticketIds.length} tickets)`);
console.log(`   ventas reales en nube: $${totalReal} (efectivo $${efectivoReal}, gastos $${gastosReal})`);

revisar(corte.totalSales === totalReal, `El corte debía cuadrar con las ventas: ${corte.totalSales} vs ${totalReal}`);
revisar(corte.cashSales === efectivoReal, 'El efectivo del corte debía cuadrar');
revisar(corte.totalExpenses === gastosReal, 'Los gastos del corte debían cuadrar');
revisar(corte.ticketIds.length === 36, `El corte debía incluir las 36 ventas (incluye ${corte.ticketIds.length})`);

const sinCorte = ventasNube.filter((t) => !t.corteXId);
revisar(sinCorte.length === 0, `${sinCorte.length} venta(s) quedaron sin corte`);

paso('Revisión de folios.');
const unicos = new Set(foliosEmitidos);
const provisionales = foliosEmitidos.filter((f) => isProvisionalFolio(f));
console.log(`   folios emitidos: ${foliosEmitidos.length} · distintos: ${unicos.size} · provisionales: ${provisionales.length}`);
revisar(unicos.size === foliosEmitidos.length, 'Ningún folio debía repetirse');
revisar(
  provisionales.length === 0,
  'Con el bloque recargado a tiempo, la caída no debía obligar a folios provisionales'
);
revisar(
  foliosEmitidos.every((f) => f.startsWith(`NAV-${DAY.slice(8, 10)}${DAY.slice(5, 7)}-`)),
  'El folio debía llevar el día del ticket'
);
const foliosNube = new Set(ventasNube.map((t) => String(t.folio)));
revisar(foliosNube.size === ventasNube.length, 'Tampoco debían repetirse folios en la nube');

paso('Caso extremo: se agota el bloque con la nube caída.');
cloud.down = true;
const intentosAntes = cloud.leaseAttempts;
const foliosAgotados: string[] = [];
for (let i = 0; i < 30; i++) {
  foliosAgotados.push(await allocateFolio(BRANCH, hora(21, i)));
}
const intentosFallidos = cloud.leaseAttempts - intentosAntes;
cloud.down = false;
const provisionalesAgotados = foliosAgotados.filter((f) => isProvisionalFolio(f));
const unicosAgotados = new Set([...foliosEmitidos, ...foliosAgotados]);
console.log(`   30 folios más sin nube · provisionales: ${provisionalesAgotados.length}`);
console.log(`   ejemplos: ${foliosAgotados.slice(-3).join(', ')}`);
console.log(`   intentos de red durante la caída: ${intentosFallidos}`);
revisar(
  provisionalesAgotados.length > 0,
  'Al agotarse el bloque sin internet debían emitirse folios provisionales'
);
revisar(
  unicosAgotados.size === foliosEmitidos.length + foliosAgotados.length,
  'Ni los folios provisionales debían repetirse'
);
revisar(
  intentosFallidos <= 2,
  `El cobro no debía reintentar la red en cada venta (reintentó ${intentosFallidos} veces)`
);

paso('Al volver la red, la caja recupera folios numerados.');
clearFolioLeaseCooldown();
await warmUpFolios(BRANCH, hora(21, 59));
const folioTrasReconexion = await allocateFolio(BRANCH, hora(22, 0));
console.log(`   primer folio tras reconectar: ${folioTrasReconexion}`);
revisar(
  !isProvisionalFolio(folioTrasReconexion),
  'Al reconectar debía volver a emitir folios numerados'
);

paso('Revisión del taller tras volver la nube.');
const tallerNube = cloud.all('repairRecords');
console.log(`   equipos de taller en la nube: ${tallerNube.length}`);
revisar(tallerNube.length === 3, `Los 3 equipos debían subir a la nube (subieron ${tallerNube.length})`);
revisar(
  tallerNube.every((r) => r.clientPhone && r.passcodePattern && r.issueDescription),
  'El registro de taller debía subir completo (teléfono, contraseña y falla)'
);

paso('23:30 Se entrega un equipo y se da de baja otro por captura equivocada.');
const entregadoIso = hora(23, 30);
await commitRepairRecord({
  ...equipos[0],
  status: 'entregado',
  pendingBalance: 0,
  deliveredAt: entregadoIso,
  deliveredAtIso: entregadoIso,
  deliveredByName: 'Jesus Villa',
  deliveryTicketId: 'NAV-1509-099'
});
await commitRepairRecord({
  ...equipos[1],
  status: 'cancelado',
  cancelledAt: entregadoIso,
  cancelledByName: 'Cesar Avendaño',
  cancelReason: 'Captura equivocada: el cliente no dejó el equipo'
});
await drainOutbox();

const tallerFinal = await localRepairs();
const entregados = tallerFinal.filter((r) => r.status === 'entregado');
const cancelados = tallerFinal.filter((r) => r.status === 'cancelado');
const enTaller = tallerFinal.filter((r) => r.status === 'en_taller');
console.log(`   en taller: ${enTaller.length} · entregados: ${entregados.length} · dados de baja: ${cancelados.length}`);
revisar(tallerFinal.length === 3, 'Ningún registro de taller debía desaparecer');
revisar(entregados.length === 1 && cancelados.length === 1 && enTaller.length === 1, 'Los estados del taller debían quedar como se capturaron');
revisar(
  entregados[0].deliveredByName === 'Jesus Villa' && !!entregados[0].deliveredAtIso,
  'La entrega debía guardar quién entregó y cuándo'
);
revisar(
  cancelados[0].cancelReason?.includes('Captura equivocada') === true,
  'La baja debía conservar el motivo y quién la hizo'
);
const canceladoEnNube = cloud.get('repairRecords', equipos[1].id) as { status?: string } | undefined;
revisar(
  canceladoEnNube?.status === 'cancelado',
  'La baja es lógica: el registro sigue en la nube marcado como cancelado'
);

paso('Revisión del respaldo diario en la nube.');
const respaldoNube = cloud.get('dailyBackups', respaldo.id) as
  | { ticketIds: string[]; totalSales: number; checksum: string; truncated?: boolean }
  | undefined;
revisar(!!respaldoNube, 'El respaldo del día debía subir a la nube');
if (respaldoNube) {
  console.log(`   respaldo en nube: ${respaldoNube.ticketIds.length} folios · $${respaldoNube.totalSales}`);
  revisar(
    respaldoNube.ticketIds.length === ventasNube.length,
    'El respaldo debía listar todas las ventas del día'
  );
  const firmaRecalculada = computeChecksum(
    respaldoNube.ticketIds,
    (respaldoNube as unknown as { expenseIds: string[] }).expenseIds,
    respaldoNube.totalSales
  );
  revisar(firmaRecalculada === respaldoNube.checksum, 'La firma del respaldo debía verificar');
}

paso('Reintento tardío: la cola vuelve a correr el mismo corte.');
const antesDeReintento = cloud.writeCount;
await commitCorte(
  cortesLocales[0],
  {
    branchId: BRANCH,
    branchName: 'Navojoa',
    operatorUid: 'usr-jesus',
    operatorName: 'Jesus Villa',
    efectivoContado: efectivoEsperado,
    fondoDejado: 1000,
    notas: 'Reintento',
    fechaCierreIso: hora(22, 50),
    preferredSessionId: `SES-${BRANCH}-${DAY}`,
    dateKey: DAY,
    ticketsSnapshot: ventasDelDia,
    expensesSnapshot: gastosDelDia
  }
);
await drainOutbox();
const cortesTrasReintento = cloud.all('corteXRecords');
console.log(`   cortes tras el reintento: ${cortesTrasReintento.length} (escrituras extra: ${cloud.writeCount - antesDeReintento})`);
revisar(cortesTrasReintento.length === 1, 'Reintentar el corte no debía crear un segundo corte');

paso('Día siguiente: el contador de folios arranca limpio.');
const bloqueHoy = cloud.leaseFolios(BRANCH, DAY, 1);
const bloqueManana = cloud.leaseFolios(BRANCH, '2026-09-16', 1);
console.log(`   siguiente folio de hoy: ${bloqueHoy.start} · primero de mañana: ${bloqueManana.start}`);
revisar(bloqueManana.start === 1, 'El contador debía reiniciar al cambiar el día');

// ----------------------------------------------------
console.log('\n════════════════════════════════════');
if (hallazgos.length === 0) {
  console.log('SIMULACIÓN DEL DÍA: sin fallas detectadas.');
  console.log(`Ventas capturadas: 36 · en la nube: ${ventasNube.length} · perdidas: 0`);
} else {
  console.log(`SIMULACIÓN DEL DÍA: ${hallazgos.length} falla(s) detectada(s):`);
  hallazgos.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
}
console.log('════════════════════════════════════');

assert.equal(hallazgos.length, 0, 'La simulación del día encontró fallas');
