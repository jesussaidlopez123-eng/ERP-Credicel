/**
 * 11 oct 2026: Geraldín cobró en Huatabampo desde el inicio, pero su usuario
 * todavía apuntaba a Matriz. Esos 3 tickets y el corte SES-MTZ-…-MV40TO74
 * se pasan a su turno abierto de Huatabampo. Teresa ya tiene el turno de Matriz.
 *
 *   npx tsx scripts/repair-oct11-geraldin-huatabampo.ts
 */
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import {
  db,
  VENTAS_COLLECTION,
  SALES_COLLECTION,
  CORTE_X_COLLECTION,
  SESIONES_CAJA_COLLECTION,
  PRODUCTS_COLLECTION,
  cleanForFirestore,
  saveProductToFirestore
} from '../src/lib/firebase.ts';
import { addAccessoryStock, removeAccessoryStock } from '../src/lib/accessoryInventory.ts';
import { snapshotInventory } from '../src/lib/inventoryMerge.ts';
import { newUniqueId } from '../src/lib/ids.ts';
import type { Product, SaleTicket } from '../src/types.ts';
import {
  FALSE_MTZ_SESSION_20261011,
  HUA_OPEN_SESSION_20261011,
  MISPLACED_GERALDIN_TICKET_IDS_20261011,
  retargetOpenShiftTicket,
  ticketNeedsHuatabampoRetarget
} from '../src/lib/shiftBranchRepair.ts';

const MICA_ID = 'prod-1786738280914';
const MICA_TICKET = 'TCK-MV42CSLB-P9KFWO';
const MOVEMENTS = 'inventoryMovements';

async function loadTicket(id: string): Promise<SaleTicket | null> {
  const venta = await getDoc(doc(db, VENTAS_COLLECTION, id));
  if (venta.exists()) return { id, ...(venta.data() as SaleTicket) };
  const sales = await getDoc(doc(db, SALES_COLLECTION, id));
  if (sales.exists()) return { id, ...(sales.data() as SaleTicket) };
  return null;
}

async function writeTicket(ticket: SaleTicket): Promise<void> {
  const payload = {
    ...cleanForFirestore(ticket),
    corteXId: deleteField(),
    corteXClosedAt: deleteField()
  };
  await setDoc(doc(db, VENTAS_COLLECTION, ticket.id), payload, { merge: true });
  await setDoc(doc(db, SALES_COLLECTION, ticket.id), payload, { merge: true });
}

async function revertFalseMatrizCorte(): Promise<void> {
  const ref = doc(db, CORTE_X_COLLECTION, FALSE_MTZ_SESSION_20261011);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.log('corte falso no existe, nada que revertir');
    return;
  }
  const current = snap.data() as { reverted?: boolean };
  if (current.reverted) {
    console.log('corte falso ya estaba revertido');
    return;
  }
  await setDoc(
    ref,
    {
      reverted: true,
      revertedAt: new Date().toISOString(),
      closingNotes: 'Revertido: esas ventas eran de Huatabampo (Geraldín). El usuario aún no estaba cambiado de sucursal.'
    },
    { merge: true }
  );
  console.log('corte falso revertido', FALSE_MTZ_SESSION_20261011);
}

async function stampCashiers(): Promise<void> {
  await updateDoc(doc(db, SESIONES_CAJA_COLLECTION, HUA_OPEN_SESSION_20261011), {
    operador_actual: { uid: 'op-1791489772894', nombre: 'GERALDIN FLORES' }
  });
  await updateDoc(doc(db, SESIONES_CAJA_COLLECTION, 'SES-MTZ-20261011-MV43UET6'), {
    operador_actual: { uid: 'op-1786693519553', nombre: 'Teresa Lopez' }
  });
  console.log('cajeros del turno abierto: Huatabampo=Geraldín, Matriz=Teresa');
}

async function moveMicaStock(): Promise<void> {
  const snap = await getDoc(doc(db, PRODUCTS_COLLECTION, MICA_ID));
  if (!snap.exists()) {
    console.warn('no está el producto Micas');
    return;
  }
  const current = { id: snap.id, ...(snap.data() as Product) };
  const restored = addAccessoryStock(current, 'b-matriz', 1);
  const moved = removeAccessoryStock(restored, 'b-huatabampo', 1);
  await saveProductToFirestore(moved, snapshotInventory(current));
  const now = new Date().toISOString();
  const inId = `mov-fix-mtz-${newUniqueId()}`;
  const outId = `mov-fix-hua-${newUniqueId()}`;
  await setDoc(
    doc(db, MOVEMENTS, inId),
    cleanForFirestore({
      id: inId,
      timestamp: now,
      date: now,
      type: 'ENTRADA',
      productId: MICA_ID,
      productCode: 'CA01',
      productName: 'Micas',
      category: 'accesorio',
      inventoryType: 'accesorio',
      quantity: 1,
      targetBranchId: 'b-matriz',
      targetBranchName: 'Matriz',
      operatorName: 'Administrador',
      ticketId: MICA_TICKET,
      details: 'Reversa: mica cobrada en Huatabampo quedó descontada de Matriz (sucursal del usuario atrasada).'
    })
  );
  await setDoc(
    doc(db, MOVEMENTS, outId),
    cleanForFirestore({
      id: outId,
      timestamp: now,
      date: now,
      type: 'SALIDA',
      productId: MICA_ID,
      productCode: 'CA01',
      productName: 'Micas',
      category: 'accesorio',
      inventoryType: 'accesorio',
      quantity: 1,
      targetBranchId: 'b-huatabampo',
      targetBranchName: 'Huatabampo',
      operatorName: 'GERALDIN FLORES',
      ticketId: MICA_TICKET,
      details: 'Venta real en Huatabampo (ticket MTZ-1110-003 pasado al turno de Geraldín).'
    })
  );
  console.log('mica: +1 Matriz, -1 Huatabampo');
}

let moved = 0;
let micaMoved = false;
for (const id of MISPLACED_GERALDIN_TICKET_IDS_20261011) {
  const ticket = await loadTicket(id);
  if (!ticket) {
    console.warn('no está el ticket', id);
    continue;
  }
  if (!ticketNeedsHuatabampoRetarget(ticket)) {
    console.log('ya estaba en Huatabampo', ticket.folio || id);
    continue;
  }
  const next = retargetOpenShiftTicket(ticket, {
    branchId: 'b-huatabampo',
    sessionId: HUA_OPEN_SESSION_20261011
  });
  await writeTicket(next);
  moved += 1;
  console.log('movido', next.folio || id, '→ Huatabampo', HUA_OPEN_SESSION_20261011);
  if (id === MICA_TICKET) micaMoved = true;
}

if (micaMoved) {
  await moveMicaStock();
}

await revertFalseMatrizCorte();
await stampCashiers();
console.log('listo. tickets movidos:', moved);
process.exit(0);
