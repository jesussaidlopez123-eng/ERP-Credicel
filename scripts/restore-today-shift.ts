/**
 * 14 oct 2026: tickets que se cobraron con la nube caída quedaron sin
 * sesion_caja_id. Los engancha al turno abierto de esa sucursal para que
 * el Corte X de hoy los cuente.
 *
 *   npx tsx scripts/restore-today-shift.ts
 */
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import {
  BRANCH_OPEN_SESSIONS_COLLECTION,
  cleanForFirestore,
  db,
  loadUnclosedDocsForSession,
  SALES_COLLECTION,
  SESIONES_CAJA_COLLECTION,
  VENTAS_COLLECTION
} from '../src/lib/firebase.ts';
import { hermosilloDateKey } from '../src/lib/shiftHours.ts';
import { normalizeBranchId } from '../src/data/initialBranches.ts';
import type { SaleTicket, SesionCaja } from '../src/types.ts';

const TODAY = '2026-10-14';
const START = '2026-10-14T00:00:00.000Z';
const END = '2026-10-15T12:00:00.000Z';

async function main() {
  const openSnap = await getDocs(
    query(collection(db, SESIONES_CAJA_COLLECTION), where('estado', '==', 'ABIERTA'))
  );
  const openByBranch = new Map<string, SesionCaja>();
  for (const d of openSnap.docs) {
    const row = { id: d.id, ...(d.data() as SesionCaja) };
    const branch = normalizeBranchId(row.sucursal_id);
    if (hermosilloDateKey(row.fecha_apertura) !== TODAY) continue;
    openByBranch.set(branch, row);
    console.log('turno abierto', branch, row.id, row.operador_actual?.nombre || row.operador_apertura?.nombre);
  }

  const ptrSnap = await getDocs(collection(db, BRANCH_OPEN_SESSIONS_COLLECTION));
  for (const d of ptrSnap.docs) {
    const pointed = String(d.data()?.openSessionId || '');
    const have = openByBranch.get(normalizeBranchId(d.id));
    if (pointed && have && pointed !== have.id) {
      console.warn('puntero distinto', d.id, pointed, 'vs', have.id);
    }
  }

  const ventasSnap = await getDocs(
    query(collection(db, VENTAS_COLLECTION), where('timestamp', '>=', START), where('timestamp', '<', END))
  );
  const tickets = ventasSnap.docs.map((d) => ({ id: d.id, ...(d.data() as SaleTicket) }));
  const orphans = tickets.filter((t) => {
    if (hermosilloDateKey(t.timestamp) !== TODAY) return false;
    if (t.corteXId) return false;
    if (String(t.estado || '').toUpperCase() === 'CANCELADA') return false;
    return !String(t.sesion_caja_id || '').trim();
  });

  console.log('ventas de hoy', tickets.length, 'sin turno', orphans.length);

  let attached = 0;
  for (const ticket of orphans) {
    const branch = normalizeBranchId(ticket.branchId || ticket.sucursal_id);
    const session = openByBranch.get(branch);
    if (!session) {
      console.warn('sin turno abierto para', ticket.folio || ticket.id, branch);
      continue;
    }
    const payload = cleanForFirestore({
      ...ticket,
      branchId: branch,
      sucursal_id: branch,
      sesion_caja_id: session.id
    });
    await setDoc(doc(db, VENTAS_COLLECTION, ticket.id), payload, { merge: true });
    await setDoc(doc(db, SALES_COLLECTION, ticket.id), payload, { merge: true });
    attached += 1;
    console.log('enganchado', ticket.folio || ticket.id, '→', session.id, ticket.total);
  }

  console.log('\ncorte que verá cada caja al cerrar:');
  for (const [branch, session] of openByBranch) {
    const docs = await loadUnclosedDocsForSession(session.id, branch);
    const total = docs.tickets.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
    console.log(
      branch,
      session.id,
      'tickets',
      docs.tickets.length,
      'total',
      total,
      'gastos',
      docs.expenses.length
    );
  }

  console.log(`listo: ${attached} tickets ligados al turno de hoy`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
