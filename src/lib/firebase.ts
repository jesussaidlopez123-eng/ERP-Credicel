import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  runTransaction
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { Product, SaleTicket, Expense, Operator, RepairPriceItem, AppNotification, InventoryMovement, SesionCaja, CorteXRecord, CreditAccount, RepairRecord } from '../types';
import { safeDateIsoKey, safeFormatDate, safeFormatTime, parseSafeDate } from './dateUtils';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import { INITIAL_REPAIR_PRICES } from '../data/initialRepairPrices';
import { getInitialInventoryMovements } from '../data/initialMovements';
import { normalizeBranchId, getBranchDisplayName } from '../data/initialBranches';
import { money, newSessionId } from './ids';
import { summarizeTickets } from './saleClassification';

// Initialize Firebase App
const firebaseConfig = {
  projectId: firebaseConfigData.projectId,
  appId: firebaseConfigData.appId,
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId || '(default)');

// Root Collections Definitions
export const SESIONES_CAJA_COLLECTION = 'sesiones_caja';
export const VENTAS_COLLECTION = 'ventas';
export const GASTOS_COLLECTION = 'gastos';
export const PRODUCTS_COLLECTION = 'products';
export const SALES_COLLECTION = 'sales'; // Kept in sync for 100% backward-compatibility
export const EXPENSES_COLLECTION = 'expenses'; // Kept in sync for 100% backward-compatibility
export const CORTE_X_COLLECTION = 'corteXRecords';
export const BRANCH_FUNDS_COLLECTION = 'branchCashFunds';
export const BRANCH_OPEN_SESSIONS_COLLECTION = 'branchOpenSessions';
export const CREDIT_ACCOUNTS_COLLECTION = 'creditAccounts';
export const REPAIR_RECORDS_COLLECTION = 'repairRecords';
export const META_COLLECTION = 'meta';

// Helper to remove undefined properties for Firestore compatibility
export function cleanForFirestore<T>(data: T): Record<string, any> {
  const clean = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(clean);
    if (typeof obj === 'object') {
      const res: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          res[key] = clean(value);
        }
      }
      return res;
    }
    return obj;
  };
  return clean(data);
}

// ----------------------------------------------------
// 0. SESIONES DE CAJA (ROOT COLLECTION: sesiones_caja)
// ----------------------------------------------------

function bodegaPlaceholderSession(operatorName: string): SesionCaja {
  return {
    id: 'SES-BODEGA-CENTRAL',
    sucursal_id: 'b-bodega',
    sucursal_nombre: 'Bodega Central',
    operador_apertura: { uid: 'usr-bodega', nombre: operatorName },
    estado: 'ABIERTA',
    fecha_apertura: new Date().toISOString(),
    monto_inicial_efectivo: 0
  };
}

async function readBranchFundAmount(branchId: string, fallback: number): Promise<number> {
  try {
    const fundSnap = await getDoc(doc(db, BRANCH_FUNDS_COLLECTION, branchId));
    if (fundSnap.exists()) {
      const amount = Number(fundSnap.data()?.fundAmount);
      if (Number.isFinite(amount) && amount >= 0) return amount;
    }
  } catch {
    // ignore
  }
  try {
    const saved = localStorage.getItem(`erp_branch_fund_${branchId}`);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {
    // ignore
  }
  return Math.max(0, fallback);
}

/**
 * Returns the single open cash session for a sales branch.
 * Uses a per-branch pointer so two cashiers cannot open two ABIERTA sessions.
 */
export async function getActiveCashSession(
  branchId: string,
  branchName: string = '',
  operatorName: string = 'Cajero',
  initialFund: number = 1000,
  operatorUid: string = ''
): Promise<SesionCaja> {
  const normBId = normalizeBranchId(branchId);
  if (normBId === 'b-bodega') {
    return bodegaPlaceholderSession(operatorName);
  }

  const displayName = branchName || getBranchDisplayName(normBId);
  const stateRef = doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, normBId);
  const fund = await readBranchFundAmount(normBId, initialFund);

  try {
    const stateSnap = await getDoc(stateRef);
    const pointedId = String(stateSnap.data()?.openSessionId || '');
    if (pointedId) {
      const pointedSes = await getDoc(doc(db, SESIONES_CAJA_COLLECTION, pointedId));
      if (pointedSes.exists()) {
        const data = pointedSes.data() as SesionCaja;
        if (data.estado === 'ABIERTA') {
          return { ...data, id: pointedId };
        }
      }
    }

    const q = query(
      collection(db, SESIONES_CAJA_COLLECTION),
      where('sucursal_id', '==', normBId),
      where('estado', '==', 'ABIERTA')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const sessions = snap.docs
        .map((d) => ({ ...(d.data() as SesionCaja), id: d.id }))
        .sort((a, b) => (a.fecha_apertura || '').localeCompare(b.fecha_apertura || ''));
      const chosen = sessions[0];
      await setDoc(
        stateRef,
        { branchId: normBId, openSessionId: chosen.id, fundAmount: fund, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      return chosen;
    }

    return await runTransaction(db, async (tx) => {
      const again = await tx.get(stateRef);
      const pid = String(again.data()?.openSessionId || '');
      if (pid) {
        const ses = await tx.get(doc(db, SESIONES_CAJA_COLLECTION, pid));
        if (ses.exists() && (ses.data() as SesionCaja).estado === 'ABIERTA') {
          return { ...(ses.data() as SesionCaja), id: pid };
        }
      }

      const openedAt = new Date();
      const newSesionId = newSessionId(normBId, openedAt);
      const newSession: SesionCaja = {
        id: newSesionId,
        sucursal_id: normBId,
        sucursal_nombre: displayName,
        operador_apertura: {
          uid: operatorUid || `usr-${Date.now().toString(36)}`,
          nombre: operatorName
        },
        estado: 'ABIERTA',
        fecha_apertura: openedAt.toISOString(),
        monto_inicial_efectivo: money(fund)
      };

      tx.set(doc(db, SESIONES_CAJA_COLLECTION, newSesionId), cleanForFirestore(newSession));
      tx.set(
        stateRef,
        {
          branchId: normBId,
          openSessionId: newSesionId,
          fundAmount: money(fund),
          updatedAt: openedAt.toISOString()
        },
        { merge: true }
      );
      return newSession;
    });
  } catch (err) {
    console.error('[Firestore] Error getting active cash session:', err);
    return {
      id: newSessionId(normBId),
      sucursal_id: normBId,
      sucursal_nombre: displayName,
      operador_apertura: { uid: operatorUid || 'usr-local', nombre: operatorName },
      estado: 'ABIERTA',
      fecha_apertura: new Date().toISOString(),
      monto_inicial_efectivo: money(fund)
    };
  }
}

/**
 * Escucha en tiempo real todas las sesiones de caja registradas
 */
export function subscribeToSesionesCaja(
  onSesionesUpdate: (sesiones: SesionCaja[]) => void,
  onError?: (err: any) => void
) {
  const col = collection(db, SESIONES_CAJA_COLLECTION);
  return onSnapshot(
    col,
    (snapshot) => {
      const loaded: SesionCaja[] = [];
      snapshot.forEach((d) => {
        loaded.push(d.data() as SesionCaja);
      });
      loaded.sort((a, b) => (b.fecha_apertura || '').localeCompare(a.fecha_apertura || ''));
      onSesionesUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToSesionesCaja error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Cierra la sesión de caja: conserva apertura, compara efectivo contado vs esperado
 * y marca solo los tickets/gastos de ESA sesión.
 */
export async function executeCorteSesionCajaTransaction(params: {
  sesionId: string;
  sucursalId: string;
  sucursalNombre: string;
  operadorCierre: { uid: string; nombre: string };
  efectivoContado: number;
  fondoDejado: number;
  notas?: string;
  ticketsSnapshot?: SaleTicket[];
  expensesSnapshot?: Expense[];
}): Promise<{ success: boolean; sesion: SesionCaja; corteRecord: CorteXRecord }> {
  const {
    sesionId,
    sucursalId,
    sucursalNombre,
    operadorCierre,
    efectivoContado,
    fondoDejado,
    notas = '',
    ticketsSnapshot = [],
    expensesSnapshot = []
  } = params;

  const normBId = normalizeBranchId(sucursalId);
  const fechaCierre = new Date().toISOString();
  const targetDate = parseSafeDate(fechaCierre);

  const totals = summarizeTickets(ticketsSnapshot);
  const cashSales = totals.cashSales;
  const cardSales = totals.cardSales;
  const transferSales = totals.transferSales;
  const totalSales = totals.totalSales;
  const breakdown = totals.breakdown;
  const totalExpenses = money(expensesSnapshot.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));

  let existing: SesionCaja | null = null;
  try {
    const sDoc = await getDoc(doc(db, SESIONES_CAJA_COLLECTION, sesionId));
    if (sDoc.exists()) {
      existing = { ...(sDoc.data() as SesionCaja), id: sDoc.id };
    }
  } catch {}

  const initialFund = money(
    existing && Number.isFinite(Number(existing.monto_inicial_efectivo))
      ? Number(existing.monto_inicial_efectivo)
      : 0
  );
  const counted = money(efectivoContado);
  const leftFund = money(Math.max(0, fondoDejado));
  const expectedCashInDrawer = money(initialFund + cashSales - totalExpenses);
  const difference = money(counted - expectedCashInDrawer);
  const cashWithdrawn = money(Math.max(0, counted - leftFund));

  const sesionCerrada: SesionCaja = {
    id: sesionId,
    sucursal_id: normBId,
    sucursal_nombre: existing?.sucursal_nombre || sucursalNombre || getBranchDisplayName(normBId),
    operador_apertura: existing?.operador_apertura || { uid: operadorCierre.uid, nombre: operadorCierre.nombre },
    operador_cierre: operadorCierre,
    estado: 'CERRADA',
    fecha_apertura: existing?.fecha_apertura || fechaCierre,
    fecha_cierre: fechaCierre,
    monto_inicial_efectivo: initialFund,
    totales_calculados: {
      ventas_total: totalSales,
      ventas_efectivo: cashSales,
      ventas_tarjeta: cardSales,
      ventas_transferencia: transferSales,
      gastos_efectivo: totalExpenses,
      efectivo_esperado_cajon: expectedCashInDrawer,
      conteo_transacciones: {
        tickets_venta: ticketsSnapshot.length,
        gastos: expensesSnapshot.length
      },
      desglose_categorias: {
        accesorios: breakdown.accesoriosTotal,
        abonos: breakdown.abonosTotal,
        enganches: breakdown.enganchesTotal,
        reparaciones: breakdown.reparacionesTotal,
        recargas: breakdown.recargasTotal
      }
    },
    arqueo_cierre: {
      efectivo_contado_declarado: counted,
      diferencia_sobrante_faltante: difference,
      fondo_dejado_siguiente_turno: leftFund,
      efectivo_retirado_entregar: cashWithdrawn,
      notas_observaciones: notas
    },
    auditoria: {
      version: 'v3.0-session-lock'
    }
  };

  const corteRecord: CorteXRecord = {
    id: sesionId,
    timestamp: fechaCierre,
    dateStr: safeFormatDate(targetDate),
    timeStr: safeFormatTime(targetDate),
    branchId: normBId,
    sucursal_id: normBId,
    sesion_caja_id: sesionId,
    branchName: sesionCerrada.sucursal_nombre,
    operatorName: operadorCierre.nombre,
    initialCashFund: initialFund,
    cashFundLeftForNextShift: leftFund,
    cashWithdrawn,
    closingNotes: notas,
    cashSales,
    cardSales,
    transferSales,
    totalSales,
    totalExpenses,
    netIncome: money(totalSales - totalExpenses),
    expectedCashInDrawer,
    countedCash: counted,
    cashDifference: difference,
    ticketIds: ticketsSnapshot.map((t) => t.id),
    expenseIds: expensesSnapshot.map((e) => e.id),
    ticketsSnapshot,
    expensesSnapshot,
    breakdown
  };

  const closeStamp = {
    sesion_caja_id: sesionId,
    corteXId: sesionId,
    corteXClosedAt: fechaCierre,
    sucursal_id: normBId
  };

  const operations: { ref: any; data: any; isMerge?: boolean }[] = [
    { ref: doc(db, SESIONES_CAJA_COLLECTION, sesionId), data: cleanForFirestore(sesionCerrada), isMerge: true },
    { ref: doc(db, CORTE_X_COLLECTION, sesionId), data: cleanForFirestore(corteRecord), isMerge: false },
    {
      ref: doc(db, BRANCH_FUNDS_COLLECTION, normBId),
      data: { branchId: normBId, fundAmount: leftFund, updatedAt: fechaCierre },
      isMerge: true
    },
    {
      ref: doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, normBId),
      data: { branchId: normBId, openSessionId: null, fundAmount: leftFund, updatedAt: fechaCierre },
      isMerge: true
    }
  ];

  ticketsSnapshot.forEach((t) => {
    operations.push({ ref: doc(db, SALES_COLLECTION, t.id), data: closeStamp, isMerge: true });
    operations.push({ ref: doc(db, VENTAS_COLLECTION, t.id), data: closeStamp, isMerge: true });
  });
  expensesSnapshot.forEach((e) => {
    operations.push({ ref: doc(db, EXPENSES_COLLECTION, e.id), data: closeStamp, isMerge: true });
    operations.push({ ref: doc(db, GASTOS_COLLECTION, e.id), data: closeStamp, isMerge: true });
  });

  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((op) => {
      if (op.isMerge) batch.set(op.ref, op.data, { merge: true });
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
  }

  try {
    localStorage.setItem(`erp_branch_fund_${normBId}`, String(leftFund));
  } catch {}

  console.log(`[Firestore] Corte de caja cerrado: ${sesionId} (contado ${counted} vs esperado ${expectedCashInDrawer})`);
  return { success: true, sesion: sesionCerrada, corteRecord };
}

// ----------------------------------------------------
// 1. PRODUCTS (INVENTARIO)
// ----------------------------------------------------
const DUMMY_PRODUCT_IDS = [
  'prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6',
  'prod-eq-1', 'prod-eq-2', 'prod-eq-3', 'prod-eq-4', 'prod-eq-5'
];

export async function clearDummyProductsFromFirestore() {
  try {
    const batch = writeBatch(db);
    DUMMY_PRODUCT_IDS.forEach((id) => {
      const docRef = doc(db, PRODUCTS_COLLECTION, id);
      batch.delete(docRef);
    });
    // Also make sure the generic items exist
    INITIAL_PRODUCTS.forEach((p) => {
      const docRef = doc(db, PRODUCTS_COLLECTION, p.id);
      batch.set(docRef, cleanForFirestore(p), { merge: true });
    });
    await batch.commit();
    console.log('[Firestore] Cleaned all dummy products from cloud successfully.');
  } catch (err) {
    console.error('[Firestore] Error clearing dummy products:', err);
  }
}

export function subscribeToProducts(
  onProductsUpdate: (products: Product[]) => void,
  onError?: (err: any) => void
) {
  const productsCol = collection(db, PRODUCTS_COLLECTION);

  return onSnapshot(
    productsCol,
    async (snapshot) => {
      if (snapshot.empty) {
        console.log('[Firestore] Seeding initial POS action buttons...');
        try {
          const batch = writeBatch(db);
          INITIAL_PRODUCTS.forEach((prod) => {
            const ref = doc(db, PRODUCTS_COLLECTION, prod.id);
            batch.set(ref, cleanForFirestore(prod));
          });
          await batch.commit();
          onProductsUpdate(INITIAL_PRODUCTS);
        } catch (seedErr) {
          console.error('[Firestore] Error seeding initial products:', seedErr);
          onProductsUpdate(INITIAL_PRODUCTS);
        }
      } else {
        const loaded: Product[] = [];
        snapshot.forEach((d) => {
          const p = d.data() as Product;
          if (!DUMMY_PRODUCT_IDS.includes(p.id)) {
            loaded.push(p);
          }
        });
        onProductsUpdate(loaded);
      }
    },
    (err) => {
      console.error('[Firestore] subscribeToProducts error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveProductToFirestore(product: Product) {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, product.id);
    await setDoc(docRef, cleanForFirestore(product), { merge: true });
  } catch (err) {
    console.error('[Firestore] Error saving product:', err);
    throw err;
  }
}

export async function saveProductsBatchToFirestore(products: Product[]) {
  try {
    const batch = writeBatch(db);
    products.forEach((p) => {
      const ref = doc(db, PRODUCTS_COLLECTION, p.id);
      batch.set(ref, cleanForFirestore(p), { merge: true });
    });
    await batch.commit();
  } catch (err) {
    console.error('[Firestore] Error saving products batch:', err);
    throw err;
  }
}

export async function deleteProductFromFirestore(productId: string) {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('[Firestore] Error deleting product:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 2. SALES TICKETS (VENTAS)
// ----------------------------------------------------
export function subscribeToSales(
  onSalesUpdate: (sales: SaleTicket[]) => void,
  onError?: (err: any) => void
) {
  const salesCol = collection(db, SALES_COLLECTION);
  return onSnapshot(
    salesCol,
    (snapshot) => {
      const loaded: SaleTicket[] = [];
      snapshot.forEach((d) => {
        loaded.push(d.data() as SaleTicket);
      });
      // Sort descending by timestamp / id
      loaded.sort((a, b) => {
        const tA = a.timestamp || '';
        const tB = b.timestamp || '';
        return tB.localeCompare(tA);
      });
      onSalesUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToSales error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveSaleTicketToFirestore(ticket: SaleTicket) {
  try {
    const normBId = normalizeBranchId(ticket.branchId || ticket.sucursal_id || 'b-bodega');
    const enrichedTicket: SaleTicket = {
      ...ticket,
      branchId: normBId,
      sucursal_id: normBId,
      estado: ticket.estado || 'COMPLETADA'
    };

    const cleanData = cleanForFirestore(enrichedTicket);
    const batch = writeBatch(db);

    // 1. Root Collection: /ventas/{id}
    const ventasRef = doc(db, VENTAS_COLLECTION, ticket.id);
    batch.set(ventasRef, cleanData);

    // 2. Compatibility Collection: /sales/{id}
    const salesRef = doc(db, SALES_COLLECTION, ticket.id);
    batch.set(salesRef, cleanData);

    await batch.commit();
  } catch (err) {
    console.error('[Firestore] Error saving sale ticket:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 3. EXPENSES (GASTOS DE CAJA)
// ----------------------------------------------------
export function subscribeToExpenses(
  onExpensesUpdate: (expenses: Expense[]) => void,
  onError?: (err: any) => void
) {
  const expCol = collection(db, EXPENSES_COLLECTION);
  return onSnapshot(
    expCol,
    (snapshot) => {
      const loaded: Expense[] = [];
      snapshot.forEach((d) => {
        loaded.push(d.data() as Expense);
      });
      loaded.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      onExpensesUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToExpenses error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveExpenseToFirestore(expense: Expense) {
  try {
    const normBId = normalizeBranchId(expense.branchId || expense.sucursal_id || 'b-bodega');
    const enrichedExpense: Expense = {
      ...expense,
      branchId: normBId,
      sucursal_id: normBId
    };

    const cleanData = cleanForFirestore(enrichedExpense);
    const batch = writeBatch(db);

    // 1. Root Collection: /gastos/{id}
    const gastosRef = doc(db, GASTOS_COLLECTION, expense.id);
    batch.set(gastosRef, cleanData);

    // 2. Compatibility Collection: /expenses/{id}
    const expRef = doc(db, EXPENSES_COLLECTION, expense.id);
    batch.set(expRef, cleanData);

    await batch.commit();
  } catch (err) {
    console.error('[Firestore] Error saving expense:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 4. OPERATORS / USUARIOS Y CONTRASEÑAS
// ----------------------------------------------------
const OPERATORS_COLLECTION = 'operators';

export function subscribeToOperators(
  onOperatorsUpdate: (operators: Operator[]) => void,
  onError?: (err: any) => void
) {
  const opCol = collection(db, OPERATORS_COLLECTION);
  return onSnapshot(
    opCol,
    async (snapshot) => {
      if (snapshot.empty) {
        console.log('[Firestore] Seeding initial operators to cloud...');
        try {
          const batch = writeBatch(db);
          INITIAL_OPERATORS.forEach((op) => {
            const ref = doc(db, OPERATORS_COLLECTION, op.id);
            batch.set(ref, cleanForFirestore(op));
          });
          await batch.commit();
          onOperatorsUpdate(INITIAL_OPERATORS);
        } catch (seedErr) {
          console.error('[Firestore] Error seeding operators:', seedErr);
          onOperatorsUpdate(INITIAL_OPERATORS);
        }
      } else {
        const loaded: Operator[] = [];
        snapshot.forEach((d) => {
          loaded.push(d.data() as Operator);
        });
        onOperatorsUpdate(loaded);
      }
    },
    (err) => {
      console.error('[Firestore] subscribeToOperators error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveOperatorToFirestore(operator: Operator) {
  try {
    const docRef = doc(db, OPERATORS_COLLECTION, operator.id);
    await setDoc(docRef, cleanForFirestore(operator), { merge: true });
  } catch (err) {
    console.error('[Firestore] Error saving operator:', err);
    throw err;
  }
}

export async function deleteOperatorFromFirestore(operatorId: string) {
  try {
    const docRef = doc(db, OPERATORS_COLLECTION, operatorId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('[Firestore] Error deleting operator:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 5. REPAIR PRICES CATALOG
// ----------------------------------------------------
const REPAIR_PRICES_COLLECTION = 'repairPrices';

export function subscribeToRepairPrices(
  onPricesUpdate: (prices: RepairPriceItem[]) => void,
  onError?: (err: any) => void
) {
  const col = collection(db, REPAIR_PRICES_COLLECTION);
  return onSnapshot(
    col,
    async (snapshot) => {
      if (snapshot.empty) {
        try {
          const batch = writeBatch(db);
          INITIAL_REPAIR_PRICES.forEach((item) => {
            const ref = doc(db, REPAIR_PRICES_COLLECTION, item.id);
            batch.set(ref, cleanForFirestore(item));
          });
          await batch.commit();
          onPricesUpdate(INITIAL_REPAIR_PRICES);
        } catch (seedErr) {
          console.error('[Firestore] Error seeding repair prices:', seedErr);
          onPricesUpdate(INITIAL_REPAIR_PRICES);
        }
      } else {
        const loaded: RepairPriceItem[] = [];
        snapshot.forEach((d) => {
          loaded.push(d.data() as RepairPriceItem);
        });
        onPricesUpdate(loaded);
      }
    },
    (err) => {
      console.error('[Firestore] subscribeToRepairPrices error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveRepairPriceToFirestore(item: RepairPriceItem) {
  try {
    const docRef = doc(db, REPAIR_PRICES_COLLECTION, item.id);
    await setDoc(docRef, cleanForFirestore(item), { merge: true });
  } catch (err) {
    console.error('[Firestore] Error saving repair price:', err);
    throw err;
  }
}

export async function deleteRepairPriceFromFirestore(id: string) {
  try {
    const docRef = doc(db, REPAIR_PRICES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('[Firestore] Error deleting repair price:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 6. CORTE X RECORDS & SHIFT MANAGEMENT
// ----------------------------------------------------
// 6. CORTE X RECORDS & BRANCH CASH FUNDS
// ----------------------------------------------------

/**
 * Guarda en Firestore el fondo en efectivo asignado para el siguiente turno de una sucursal
 */
export async function saveBranchFundToFirestore(branchId: string, fundAmount: number): Promise<void> {
  try {
    const normId = normalizeBranchId(branchId);
    if (!normId || normId === 'b-bodega') return;
    const docRef = doc(db, BRANCH_FUNDS_COLLECTION, normId);
    await setDoc(docRef, {
      branchId: normId,
      fundAmount: Math.max(0, fundAmount),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    try {
      localStorage.setItem(`erp_branch_fund_${normId}`, String(fundAmount));
    } catch {}
    console.log(`[Firestore] 💵 Fondo inicial sincronizado para ${normId}: $${fundAmount}`);
  } catch (err) {
    console.error('[Firestore] Error saving branch fund:', err);
  }
}

/**
 * Escucha en tiempo real los fondos iniciales configurados para cada sucursal
 */
export function subscribeToBranchFunds(
  onFundsUpdate: (funds: Record<string, number>) => void,
  onError?: (err: any) => void
) {
  const col = collection(db, BRANCH_FUNDS_COLLECTION);
  return onSnapshot(
    col,
    (snapshot) => {
      const fundsMap: Record<string, number> = {};
      snapshot.forEach((d) => {
        const data = d.data();
        if (data && data.branchId && typeof data.fundAmount === 'number') {
          fundsMap[data.branchId] = data.fundAmount;
          try {
            localStorage.setItem(`erp_branch_fund_${data.branchId}`, String(data.fundAmount));
          } catch {}
        }
      });
      onFundsUpdate(fundsMap);
    },
    (err) => {
      console.error('[Firestore] subscribeToBranchFunds error:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToCortesX(
  onCortesUpdate: (cortes: CorteXRecord[]) => void,
  onError?: (err: any) => void
) {
  const col = collection(db, CORTE_X_COLLECTION);
  return onSnapshot(
    col,
    (snapshot) => {
      const loaded: CorteXRecord[] = [];
      snapshot.forEach((d) => {
        loaded.push(d.data() as CorteXRecord);
      });
      loaded.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      onCortesUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToCortesX error:', err);
      if (onError) onError(err);
    }
  );
}

export async function deleteCorteXFromFirestore(corteId: string) {
  try {
    const docRef = doc(db, CORTE_X_COLLECTION, corteId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('[Firestore] Error deleting Corte X:', err);
    throw err;
  }
}

/**
 * Historical auto-close invented cortes with a hardcoded $1000 fund and
 * split overnight shifts. It is intentionally a no-op: open tickets stay
 * open until a cashier closes the real session.
 */
export async function autoReconcilePastTicketsAndExpenses(): Promise<number> {
  return 0;
}

export async function cleanDuplicateCortesFromFirestore(): Promise<{ purgedCount: number; remainingCount: number; reconciledTicketsCount?: number }> {
  try {
    const reconciledCount = 0;

    const colRef = collection(db, CORTE_X_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return { purgedCount: 0, remainingCount: 0, reconciledTicketsCount: reconciledCount };

    // Agrupar por branchId normalizado y dateKey ISO seguro
    const grouped: Record<string, any[]> = {};
    const batch = writeBatch(db);
    let purgedCount = 0;

    snapshot.forEach((d) => {
      const data = d.data() as CorteXRecord;
      const normBId = normalizeBranchId(data.branchId);
      // If corte belongs to bodega, delete it immediately as bodega is not a sales branch
      if (normBId === 'b-bodega') {
        batch.delete(d.ref);
        purgedCount++;
        return;
      }
      // Use strictly safe ISO date parsing
      const dateKey = safeDateIsoKey(data.timestamp) || safeDateIsoKey(data.dateStr);
      if (!dateKey) return;
      const groupKey = `${normBId}_${dateKey}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push({ id: d.id, ref: d.ref, data });
    });

    let remainingCount = 0;

    for (const [key, items] of Object.entries(grouped)) {
      remainingCount++;
      if (items.length > 1) {
        // Solo purgar duplicados exactos o registros vacíos si existe otro con tickets completos
        const withTickets = items.filter(it => (it.data?.ticketIds?.length || 0) > 0 || (it.data?.totalSales || 0) > 0);
        
        if (withTickets.length > 0 && withTickets.length < items.length) {
          // Purgar solo los que están completamente vacíos
          const emptyOnes = items.filter(it => (it.data?.ticketIds?.length || 0) === 0 && (it.data?.totalSales || 0) === 0);
          emptyOnes.forEach(emptyIt => {
            batch.delete(emptyIt.ref);
            purgedCount++;
          });
        } else if (items.length > 1) {
          // Only drop empty CAL-ZERO placeholders; never delete two real cortes of the same day
          for (let i = 0; i < items.length; i++) {
            const isEmptyPlaceholder =
              String(items[i].id).startsWith('CAL-ZERO') &&
              (items[i].data?.ticketIds?.length || 0) === 0 &&
              (items[i].data?.totalSales || 0) === 0;
            if (isEmptyPlaceholder) {
              batch.delete(items[i].ref);
              purgedCount++;
            }
          }
        }
      }
    }

    if (purgedCount > 0) {
      await batch.commit();
      console.log(`[Firestore] 🛡️ Blindaje de Cortes: Se purgaron ${purgedCount} cortes duplicados en la base de datos.`);
    }

    return { purgedCount, remainingCount, reconciledTicketsCount: reconciledCount };
  } catch (err) {
    console.error('[Firestore] Error limpiando cortes duplicados:', err);
    return { purgedCount: 0, remainingCount: 0 };
  }
}

export async function executeAndSaveCorteX(
  corte: CorteXRecord,
  ticketsToClose: SaleTicket[],
  expensesToClose: Expense[]
) {
  try {
    // Firestore batch limit is 500 operations. We chunk operations into batches of max 400.
    const operations: { ref: any; data: any; isMerge?: boolean }[] = [];

    // 1. Corte X Record
    const corteRef = doc(db, CORTE_X_COLLECTION, corte.id);
    operations.push({ ref: corteRef, data: cleanForFirestore(corte), isMerge: false });

    // 2. Tickets
    ticketsToClose.forEach((t) => {
      const ticketRef = doc(db, SALES_COLLECTION, t.id);
      operations.push({
        ref: ticketRef,
        data: {
          corteXId: corte.id,
          corteXClosedAt: corte.timestamp
        },
        isMerge: true
      });
    });

    // 3. Expenses
    expensesToClose.forEach((e) => {
      const expRef = doc(db, EXPENSES_COLLECTION, e.id);
      operations.push({
        ref: expRef,
        data: {
          corteXId: corte.id,
          corteXClosedAt: corte.timestamp
        },
        isMerge: true
      });
    });

    // Chunk in batches of 400
    const CHUNK_SIZE = 400;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((op) => {
        if (op.isMerge) {
          batch.set(op.ref, op.data, { merge: true });
        } else {
          batch.set(op.ref, op.data);
        }
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('[Firestore] Error executing Corte X:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 7. NOTIFICATIONS / AVISOS
// ----------------------------------------------------
const NOTIFICATIONS_COLLECTION = 'notifications';

export function subscribeToNotifications(
  onNotifsUpdate: (notifs: AppNotification[]) => void,
  onError?: (err: any) => void
) {
  const col = collection(db, NOTIFICATIONS_COLLECTION);
  return onSnapshot(
    col,
    (snapshot) => {
      const loaded: AppNotification[] = [];
      snapshot.forEach((d) => {
        loaded.push(d.data() as AppNotification);
      });
      onNotifsUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToNotifications error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveNotificationToFirestore(notif: AppNotification) {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notif.id);
    await setDoc(docRef, cleanForFirestore(notif));
  } catch (err) {
    console.error('[Firestore] Error saving notification:', err);
    throw err;
  }
}

export async function deleteNotificationFromFirestore(id: string) {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('[Firestore] Error deleting notification:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 8. INVENTORY MOVEMENTS (HISTORIAL DE 15 DÍAS CON AUTO-PURGA)
// ----------------------------------------------------
const MOVEMENTS_COLLECTION = 'inventoryMovements';
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000; // 15 días exactos en milisegundos

/**
 * Purga de manera automática registros en Firestore que tengan más de 15 días de antigüedad
 */
export async function purgeOldInventoryMovementsFromFirestore(): Promise<number> {
  try {
    const colRef = collection(db, MOVEMENTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return 0;

    const now = Date.now();
    const cutoffTime = now - FIFTEEN_DAYS_MS;
    const batch = writeBatch(db);
    let purgedCount = 0;

    snapshot.forEach((d) => {
      const data = d.data() as InventoryMovement;
      const docTime = data.timestamp ? new Date(data.timestamp).getTime() : 0;
      if (isNaN(docTime) || docTime < cutoffTime) {
        batch.delete(d.ref);
        purgedCount++;
      }
    });

    if (purgedCount > 0) {
      await batch.commit();
      console.log(`[Firestore] 🧹 Se purgaron automáticamente ${purgedCount} movimientos obsoletos (> 15 días).`);
    }

    return purgedCount;
  } catch (err) {
    console.error('[Firestore] Error purgando movimientos antiguos:', err);
    return 0;
  }
}

export function subscribeToInventoryMovements(
  onMovementsUpdate: (movements: InventoryMovement[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, MOVEMENTS_COLLECTION);

  return onSnapshot(
    colRef,
    async (snapshot) => {
      const now = Date.now();
      const cutoffTime = now - FIFTEEN_DAYS_MS;

      if (snapshot.empty) {
        // Inicializar con movimientos de ejemplo de los últimos 15 días
        const initialMovs = getInitialInventoryMovements();
        try {
          const batch = writeBatch(db);
          initialMovs.forEach((m) => {
            const ref = doc(db, MOVEMENTS_COLLECTION, m.id);
            batch.set(ref, cleanForFirestore(m));
          });
          await batch.commit();
          onMovementsUpdate(initialMovs);
        } catch (seedErr) {
          console.error('[Firestore] Error inicializando movimientos:', seedErr);
          onMovementsUpdate(initialMovs);
        }
      } else {
        const validMovements: InventoryMovement[] = [];
        const expiredRefs: any[] = [];

        snapshot.forEach((d) => {
          const item = d.data() as InventoryMovement;
          const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : 0;

          if (isNaN(itemTime) || itemTime < cutoffTime) {
            // Documento expirado (> 15 días)
            expiredRefs.push(d.ref);
          } else {
            validMovements.push(item);
          }
        });

        // Purgar en segundo plano los documentos expirados sin bloquear la UI
        if (expiredRefs.length > 0) {
          try {
            const batch = writeBatch(db);
            expiredRefs.forEach((ref) => batch.delete(ref));
            batch.commit().catch((err) => console.error('[Firestore] Error en purga automática:', err));
          } catch (e) {
            console.error('[Firestore] Error creando batch de purga:', e);
          }
        }

        // Ordenar cronológicamente del más reciente al más antiguo
        validMovements.sort((a, b) => {
          const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tB - tA;
        });

        onMovementsUpdate(validMovements);
      }
    },
    (err) => {
      console.error('[Firestore] subscribeToInventoryMovements error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveInventoryMovementToFirestore(movement: InventoryMovement) {
  try {
    const docRef = doc(db, MOVEMENTS_COLLECTION, movement.id);
    await setDoc(docRef, cleanForFirestore(movement));
  } catch (err) {
    console.error('[Firestore] Error saving inventory movement:', err);
    throw err;
  }
}

export async function saveInventoryMovementsBatchToFirestore(movements: InventoryMovement[]) {
  if (movements.length === 0) return;
  try {
    const batch = writeBatch(db);
    movements.forEach((m) => {
      const ref = doc(db, MOVEMENTS_COLLECTION, m.id);
      batch.set(ref, cleanForFirestore(m));
    });
    await batch.commit();
  } catch (err) {
    console.error('[Firestore] Error saving batch inventory movements:', err);
    throw err;
  }
}

export async function clearTestSalesAndExpensesFromFirestore() {
  try {
    const salesSnap = await getDocs(collection(db, SALES_COLLECTION));
    for (const d of salesSnap.docs) {
      await deleteDoc(d.ref);
    }
    const expSnap = await getDocs(collection(db, EXPENSES_COLLECTION));
    for (const d of expSnap.docs) {
      await deleteDoc(d.ref);
    }
    const cortesSnap = await getDocs(collection(db, CORTE_X_COLLECTION));
    for (const d of cortesSnap.docs) {
      await deleteDoc(d.ref);
    }
    console.log('[Firestore] Test sales, expenses and cortes cleared successfully.');
  } catch (err) {
    console.error('Error clearing test sales:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 9. MIGRATION ENGINE (ZERO-DATA-LOSS TO SESSIONS)
// ----------------------------------------------------

/**
 * Ejecuta la migración no destructiva de todos los datos históricos existentes
 * hacia la nueva arquitectura de Sesiones de Caja y Root Collections.
 */
export async function runMigrationToSessionArchitecture(): Promise<{
  migratedTickets: number;
  migratedExpenses: number;
  createdSessions: number;
  totalProcessed: number;
}> {
  console.log('[Migration] 🚀 Iniciando verificación y migración hacia arquitectura de Sesiones...');

  try {
    const flagRef = doc(db, META_COLLECTION, 'sessionArchitectureV3');
    const flagSnap = await getDoc(flagRef);
    if (flagSnap.exists()) {
      return { migratedTickets: 0, migratedExpenses: 0, createdSessions: 0, totalProcessed: 0 };
    }

    const [salesSnap, expensesSnap, cortesSnap] = await Promise.all([
      getDocs(collection(db, SALES_COLLECTION)),
      getDocs(collection(db, EXPENSES_COLLECTION)),
      getDocs(collection(db, CORTE_X_COLLECTION))
    ]);

    const sessionsMap = new Map<string, SesionCaja>();
    const operations: { ref: any; data: any; isMerge?: boolean }[] = [];
    let migratedTickets = 0;
    let migratedExpenses = 0;

    const todayIso = safeDateIsoKey(new Date());

    // 1. Mapear Cortes X existentes a Sesiones de Caja
    cortesSnap.forEach((docSnap) => {
      const c = docSnap.data() as CorteXRecord;
      const normBId = normalizeBranchId(c.branchId || c.sucursal_id || 'b-bodega');
      const dateIso = safeDateIsoKey(c.timestamp) || safeDateIsoKey(c.dateStr) || '2026-08-01';
      const sessionKey = `${normBId}_${dateIso}`;
      const sessionId = c.id || `SES-${normBId.replace('b-', '').toUpperCase()}-${dateIso.replace(/-/g, '')}-001`;

      const sessionObj: SesionCaja = {
        id: sessionId,
        sucursal_id: normBId,
        sucursal_nombre: c.branchName || getBranchDisplayName(normBId),
        operador_apertura: { uid: 'usr-migrated', nombre: c.operatorName || 'Cajero' },
        operador_cierre: { uid: 'usr-migrated', nombre: c.operatorName || 'Cajero' },
        estado: 'CERRADA',
        fecha_apertura: c.timestamp ? `${dateIso}T09:00:00.000Z` : new Date().toISOString(),
        fecha_cierre: c.timestamp || new Date().toISOString(),
        monto_inicial_efectivo: Number(c.initialCashFund) || 1000,
        totales_calculados: {
          ventas_total: Number(c.totalSales) || 0,
          ventas_efectivo: Number(c.cashSales) || 0,
          ventas_tarjeta: Number(c.cardSales) || 0,
          ventas_transferencia: Number(c.transferSales) || 0,
          gastos_efectivo: Number(c.totalExpenses) || 0,
          efectivo_esperado_cajon: Number(c.expectedCashInDrawer) || 0,
          conteo_transacciones: {
            tickets_venta: Array.isArray(c.ticketIds) ? c.ticketIds.length : (c.ticketsSnapshot?.length || 0),
            gastos: Array.isArray(c.expenseIds) ? c.expenseIds.length : (c.expensesSnapshot?.length || 0)
          },
          desglose_categorias: {
            accesorios: c.breakdown?.accesoriosTotal || 0,
            abonos: c.breakdown?.abonosTotal || 0,
            enganches: c.breakdown?.enganchesTotal || 0,
            reparaciones: c.breakdown?.reparacionesTotal || 0,
            recargas: c.breakdown?.recargasTotal || 0
          }
        },
        arqueo_cierre: {
          efectivo_contado_declarado: Number(c.expectedCashInDrawer) || 0,
          diferencia_sobrante_faltante: 0,
          fondo_dejado_siguiente_turno: Number(c.cashFundLeftForNextShift) || 1000,
          efectivo_retirado_entregar: Number(c.cashWithdrawn) || 0,
          notas_observaciones: c.closingNotes || 'Migrado desde histórico'
        },
        auditoria: {
          version: 'v2.0-migrated'
        }
      };

      sessionsMap.set(sessionKey, sessionObj);
      operations.push({
        ref: doc(db, SESIONES_CAJA_COLLECTION, sessionId),
        data: cleanForFirestore(sessionObj),
        isMerge: true
      });
    });

    // 2. Procesar y normalizar todas las ventas
    salesSnap.forEach((docSnap) => {
      const t = docSnap.data() as SaleTicket;
      const normBId = normalizeBranchId(t.branchId || t.sucursal_id || 'b-bodega');
      const dateIso = safeDateIsoKey(t.timestamp) || '2026-08-01';
      const sessionKey = `${normBId}_${dateIso}`;
      const isToday = dateIso === todayIso;

      let sessionObj = sessionsMap.get(sessionKey);
      if (!sessionObj) {
        const sessionId = `SES-${normBId.replace('b-', '').toUpperCase()}-${dateIso.replace(/-/g, '')}-001`;
        sessionObj = {
          id: sessionId,
          sucursal_id: normBId,
          sucursal_nombre: getBranchDisplayName(normBId),
          operador_apertura: { uid: 'usr-migrated', nombre: t.operatorName || 'Cajero' },
          estado: isToday ? 'ABIERTA' : 'CERRADA',
          fecha_apertura: `${dateIso}T09:00:00.000Z`,
          fecha_cierre: isToday ? undefined : `${dateIso}T21:00:00.000Z`,
          monto_inicial_efectivo: 1000
        };
        sessionsMap.set(sessionKey, sessionObj);
        operations.push({
          ref: doc(db, SESIONES_CAJA_COLLECTION, sessionId),
          data: cleanForFirestore(sessionObj),
          isMerge: true
        });
      }

      // Keep any existing corte id (SES-... or CTX_...). Never reopen a closed ticket.
      const assignedSessionId = t.sesion_caja_id || sessionObj.id;
      const assignedCorteXId = t.corteXId || (!isToday ? sessionObj.id : undefined);

      const enrichedTicket: SaleTicket = {
        ...t,
        branchId: normBId,
        sucursal_id: normBId,
        sesion_caja_id: assignedSessionId,
        corteXId: assignedCorteXId,
        estado: t.estado || 'COMPLETADA'
      };

      const cleanData = cleanForFirestore(enrichedTicket);

      // Escribir a /ventas (Root Collection)
      operations.push({
        ref: doc(db, VENTAS_COLLECTION, t.id),
        data: cleanData,
        isMerge: true
      });

      // Actualizar /sales (Compatibility Collection)
      operations.push({
        ref: doc(db, SALES_COLLECTION, t.id),
        data: cleanData,
        isMerge: true
      });

      migratedTickets++;
    });

    // 3. Procesar y normalizar todos los gastos
    expensesSnap.forEach((docSnap) => {
      const e = docSnap.data() as Expense;
      const normBId = normalizeBranchId(e.branchId || e.sucursal_id || 'b-bodega');
      const dateIso = safeDateIsoKey(e.timestamp || e.date) || '2026-08-01';
      const sessionKey = `${normBId}_${dateIso}`;
      const isToday = dateIso === todayIso;

      const sessionObj = sessionsMap.get(sessionKey);
      const assignedSessionId = e.sesion_caja_id || (sessionObj ? sessionObj.id : `SES-${normBId.toUpperCase()}-${dateIso.replace(/-/g, '')}-001`);
      const assignedCorteXId = e.corteXId || (!isToday ? sessionObj?.id : undefined);

      const enrichedExpense: Expense = {
        ...e,
        branchId: normBId,
        sucursal_id: normBId,
        sesion_caja_id: assignedSessionId,
        corteXId: assignedCorteXId
      };

      const cleanData = cleanForFirestore(enrichedExpense);

      // Escribir a /gastos (Root Collection)
      operations.push({
        ref: doc(db, GASTOS_COLLECTION, e.id),
        data: cleanData,
        isMerge: true
      });

      // Actualizar /expenses (Compatibility Collection)
      operations.push({
        ref: doc(db, EXPENSES_COLLECTION, e.id),
        data: cleanData,
        isMerge: true
      });

      migratedExpenses++;
    });

    // 4. Ejecutar todas las operaciones en Chunks de 400
    const CHUNK_SIZE = 400;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((op) => {
        if (op.isMerge) {
          batch.set(op.ref, op.data, { merge: true });
        } else {
          batch.set(op.ref, op.data);
        }
      });
      await batch.commit();
    }

    await setDoc(flagRef, { completedAt: new Date().toISOString(), version: 'v3.0-session-lock' }, { merge: true });

    console.log(`[Migration] ✅ Migración completada exitosamente: ${migratedTickets} ventas, ${migratedExpenses} gastos y ${sessionsMap.size} sesiones.`);

    return {
      migratedTickets,
      migratedExpenses,
      createdSessions: sessionsMap.size,
      totalProcessed: operations.length
    };
  } catch (err) {
    console.error('[Migration] Error ejecutando migración:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 10. CREDIT ACCOUNTS (CARTERA)
// ----------------------------------------------------
export function subscribeToCreditAccounts(
  onUpdate: (accounts: CreditAccount[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, CREDIT_ACCOUNTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const loaded: CreditAccount[] = [];
      snapshot.forEach((d) => loaded.push({ ...(d.data() as CreditAccount), id: d.id }));
      loaded.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
      onUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToCreditAccounts error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveCreditAccountToFirestore(account: CreditAccount) {
  const docRef = doc(db, CREDIT_ACCOUNTS_COLLECTION, account.id);
  await setDoc(docRef, cleanForFirestore(account), { merge: true });
}

export async function applyCreditAbonoToAccount(accountId: string, amount: number): Promise<CreditAccount | null> {
  const ref = doc(db, CREDIT_ACCOUNTS_COLLECTION, accountId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const current = snap.data() as CreditAccount;
    const pay = money(Math.max(0, amount));
    const remaining = money(Math.max(0, Number(current.remainingBalance) - pay));
    const updated: CreditAccount = {
      ...current,
      id: accountId,
      remainingBalance: remaining,
      status: remaining <= 0.009 ? 'liquidado' : 'activo',
      updatedAt: new Date().toISOString()
    };
    tx.set(ref, cleanForFirestore(updated), { merge: true });
    return updated;
  });
}

// ----------------------------------------------------
// 11. REPAIR RECORDS (TALLER)
// ----------------------------------------------------
export function subscribeToRepairRecords(
  onUpdate: (records: RepairRecord[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, REPAIR_RECORDS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const loaded: RepairRecord[] = [];
      snapshot.forEach((d) => loaded.push({ ...(d.data() as RepairRecord), id: d.id }));
      onUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToRepairRecords error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveRepairRecordToFirestore(record: RepairRecord) {
  const docRef = doc(db, REPAIR_RECORDS_COLLECTION, record.id);
  await setDoc(docRef, cleanForFirestore(record), { merge: true });
}

