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

export async function clearDummyProductsFromFirestore() {
  // Intentionally a no-op: never delete or overwrite the live catalog.
  return;
}

export function subscribeToProducts(
  onProductsUpdate: (products: Product[]) => void,
  onError?: (err: any) => void
) {
  const productsCol = collection(db, PRODUCTS_COLLECTION);

  return onSnapshot(
    productsCol,
    (snapshot) => {
      if (snapshot.empty) {
        console.warn(
          '[Firestore] La colección products está vacía. No se siembran productos de demo para no pisar un catálogo de producción.',
        );
        onProductsUpdate([]);
        return;
      }
      const loaded: Product[] = [];
      snapshot.forEach((d) => {
        loaded.push({ ...(d.data() as Product), id: d.id });
      });
      onProductsUpdate(loaded);
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
    batch.set(ventasRef, cleanData, { merge: true });

    // 2. Compatibility Collection: /sales/{id}
    const salesRef = doc(db, SALES_COLLECTION, ticket.id);
    batch.set(salesRef, cleanData, { merge: true });

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
    batch.set(gastosRef, cleanData, { merge: true });

    // 2. Compatibility Collection: /expenses/{id}
    const expRef = doc(db, EXPENSES_COLLECTION, expense.id);
    batch.set(expRef, cleanData, { merge: true });

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
    (snapshot) => {
      if (snapshot.empty) {
        console.warn('[Firestore] La colección operators está vacía. No se siembran usuarios de demo.');
        onOperatorsUpdate([]);
      } else {
        const loaded: Operator[] = [];
        snapshot.forEach((d) => {
          loaded.push({ ...(d.data() as Operator), id: d.id });
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
    (snapshot) => {
      if (snapshot.empty) {
        console.warn('[Firestore] La colección repairPrices está vacía. No se siembra el catálogo de demo.');
        onPricesUpdate([]);
      } else {
        const loaded: RepairPriceItem[] = [];
        snapshot.forEach((d) => {
          loaded.push({ ...(d.data() as RepairPriceItem), id: d.id });
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
  console.warn('[Firestore] Depuración de cortes duplicados desactivada para conservar el historial de producción.');
  return { purgedCount: 0, remainingCount: 0, reconciledTicketsCount: 0 };
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
// 8. INVENTORY MOVEMENTS
// ----------------------------------------------------
const MOVEMENTS_COLLECTION = 'inventoryMovements';

/**
 * Conserva el kardex completo. Ya no se borran movimientos antiguos.
 */
export async function purgeOldInventoryMovementsFromFirestore(): Promise<number> {
  console.warn('[Firestore] Purga de movimientos de inventario desactivada para conservar el historial.');
  return 0;
}

export function subscribeToInventoryMovements(
  onMovementsUpdate: (movements: InventoryMovement[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, MOVEMENTS_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const movements: InventoryMovement[] = [];
      snapshot.forEach((d) => {
        movements.push({ ...(d.data() as InventoryMovement), id: d.id });
      });
      movements.sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      });
      onMovementsUpdate(movements);
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
  console.warn('[Firestore] Wipe of sales/expenses/cortes is disabled to protect production records.');
  return;
}

// ----------------------------------------------------
// 9. MIGRATION ENGINE (ZERO-DATA-LOSS TO SESSIONS)
// ----------------------------------------------------

/**
 * Conserva tickets, gastos y cortes tal como están en producción.
 * No reescribe documentos históricos ni crea sesiones inventadas.
 */
export async function runMigrationToSessionArchitecture(): Promise<{
  migratedTickets: number;
  migratedExpenses: number;
  createdSessions: number;
  totalProcessed: number;
}> {
  console.warn('[Firestore] Migración de sesiones desactivada para conservar los registros existentes.');
  return { migratedTickets: 0, migratedExpenses: 0, createdSessions: 0, totalProcessed: 0 };
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

