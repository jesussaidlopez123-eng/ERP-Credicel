import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { Product, SaleTicket, Expense, Operator, RepairPriceItem, AppNotification, Branch, InventoryMovement, SesionCaja, CorteXRecord } from '../types';
import { safeDateIsoKey, safeFormatDate, safeFormatTime, parseSafeDate } from './dateUtils';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import { INITIAL_REPAIR_PRICES } from '../data/initialRepairPrices';
import { getInitialInventoryMovements } from '../data/initialMovements';
import { normalizeBranchId, getBranchDisplayName } from '../data/initialBranches';

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

/**
 * Obtiene la sesión de caja activa (estado == 'ABIERTA') para la sucursal.
 * Si no existe una sesión abierta, crea una automáticamente con el fondo inicial configurado.
 */
export async function getActiveCashSession(
  branchId: string,
  branchName: string = '',
  operatorName: string = 'Cajero',
  initialFund: number = 1000
): Promise<SesionCaja> {
  const normBId = normalizeBranchId(branchId);
  if (normBId === 'b-bodega') {
    return {
      id: `SES-${normBId.toUpperCase()}-BODEGA`,
      sucursal_id: normBId,
      sucursal_nombre: 'Bodega Central',
      operador_apertura: { uid: 'usr-bodega', nombre: operatorName },
      estado: 'ABIERTA',
      fecha_apertura: new Date().toISOString(),
      monto_inicial_efectivo: 0
    };
  }

  try {
    const colRef = collection(db, SESIONES_CAJA_COLLECTION);
    const q = query(
      colRef,
      where('sucursal_id', '==', normBId),
      where('estado', '==', 'ABIERTA')
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const session = snap.docs[0].data() as SesionCaja;
      return session;
    }

    // No existe sesión abierta: generar una nueva sesión inmutable
    const todayIso = safeDateIsoKey(new Date()) || '20260826';
    const cleanDateStr = todayIso.replace(/-/g, '');
    const newSesionId = `SES-${normBId.replace('b-', '').toUpperCase()}-${cleanDateStr}-${Math.floor(100 + Math.random() * 900)}`;

    const newSession: SesionCaja = {
      id: newSesionId,
      sucursal_id: normBId,
      sucursal_nombre: branchName || getBranchDisplayName(normBId),
      operador_apertura: {
        uid: `usr-${Date.now().toString(36)}`,
        nombre: operatorName
      },
      estado: 'ABIERTA',
      fecha_apertura: new Date().toISOString(),
      monto_inicial_efectivo: Math.max(0, initialFund)
    };

    const docRef = doc(db, SESIONES_CAJA_COLLECTION, newSesionId);
    await setDoc(docRef, cleanForFirestore(newSession));
    console.log(`[Firestore] 🟢 Nueva Sesión de Caja abierta: ${newSesionId} para ${normBId}`);
    return newSession;
  } catch (err) {
    console.error('[Firestore] Error getting active cash session:', err);
    // Fallback in-memory session if network error
    return {
      id: `SES-${normBId.replace('b-', '').toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      sucursal_id: normBId,
      sucursal_nombre: branchName || getBranchDisplayName(normBId),
      operador_apertura: { uid: 'usr-local', nombre: operatorName },
      estado: 'ABIERTA',
      fecha_apertura: new Date().toISOString(),
      monto_inicial_efectivo: Math.max(0, initialFund)
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
 * Ejecuta el Corte de Caja transaccional blindado en Firestore.
 * Calcula los totales atómicamente y congela la sesión.
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

  // 1. Cálculos matemáticos rigurosos de todas las transacciones vinculadas
  let cashSales = 0;
  let cardSales = 0;
  let transferSales = 0;
  let accTot = 0, accCnt = 0;
  let aboTot = 0, aboCnt = 0;
  let engTot = 0, engCnt = 0;
  let repTot = 0, repCnt = 0;
  let recTot = 0, recCnt = 0;

  ticketsSnapshot.forEach((t) => {
    const met = (t.paymentMethod || '').toLowerCase();
    const tot = t.total || 0;
    if (met.includes('efectivo') || met === 'cash') cashSales += tot;
    else if (met.includes('tarjeta') || met === 'card') cardSales += tot;
    else if (met.includes('transfer')) transferSales += tot;
    else cashSales += tot; // default

    (t.items || []).forEach((item) => {
      const pName = (item.product?.name || '').toLowerCase();
      const cat = item.product?.category;
      const iTot = item.totalPrice || 0;
      const qty = item.quantity || 1;
      if (pName.includes('abono') || cat === 'abono_credito') { aboTot += iTot; aboCnt += qty; }
      else if (pName.includes('enganche') || cat === 'equipo_credito') { engTot += iTot; engCnt += qty; }
      else if (pName.includes('anticipo') || cat === 'servicio' || item.metadata?.repairType) { repTot += iTot; repCnt += qty; }
      else if (cat === 'recarga' || pName.includes('recarga')) { recTot += iTot; recCnt += qty; }
      else { accTot += iTot; accCnt += qty; }
    });
  });

  const totalSales = cashSales + cardSales + transferSales;
  const totalExpenses = expensesSnapshot.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Leer fondo inicial de la sesión
  let initialFund = 1000;
  try {
    const sDoc = await getDoc(doc(db, SESIONES_CAJA_COLLECTION, sesionId));
    if (sDoc.exists()) {
      initialFund = Number(sDoc.data()?.monto_inicial_efectivo) || 1000;
    }
  } catch {}

  const expectedCashInDrawer = initialFund + cashSales - totalExpenses;
  const difference = efectivoContado - expectedCashInDrawer;
  const cashWithdrawn = Math.max(0, efectivoContado - fondoDejado);

  const breakdown = {
    accesoriosTotal: accTot,
    accesoriosCount: accCnt,
    abonosTotal: aboTot,
    abonosCount: aboCnt,
    enganchesTotal: engTot,
    enganchesCount: engCnt,
    reparacionesTotal: repTot,
    reparacionesCount: repCnt,
    recargasTotal: recTot,
    recargasCount: recCnt
  };

  // 2. Construir objeto SesionCaja consolidado
  const sesionCerrada: SesionCaja = {
    id: sesionId,
    sucursal_id: normBId,
    sucursal_nombre: sucursalNombre || getBranchDisplayName(normBId),
    operador_apertura: { uid: operadorCierre.uid, nombre: operadorCierre.nombre },
    operador_cierre: operadorCierre,
    estado: 'CERRADA',
    fecha_apertura: (ticketsSnapshot[0]?.timestamp || fechaCierre),
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
        accesorios: accTot,
        abonos: aboTot,
        enganches: engTot,
        reparaciones: repTot,
        recargas: recTot
      }
    },
    arqueo_cierre: {
      efectivo_contado_declarado: efectivoContado,
      diferencia_sobrante_faltante: difference,
      fondo_dejado_siguiente_turno: fondoDejado,
      efectivo_retirado_entregar: cashWithdrawn,
      notas_observaciones: notas
    },
    auditoria: {
      version: 'v2.0-session-architecture'
    }
  };

  // 3. Construir objeto CorteXRecord compatible
  const corteRecord: CorteXRecord = {
    id: sesionId,
    timestamp: fechaCierre,
    dateStr: safeFormatDate(targetDate),
    timeStr: safeFormatTime(targetDate),
    branchId: normBId,
    sucursal_id: normBId,
    sesion_caja_id: sesionId,
    branchName: sucursalNombre || getBranchDisplayName(normBId),
    operatorName: operadorCierre.nombre,
    initialCashFund: initialFund,
    cashFundLeftForNextShift: fondoDejado,
    cashWithdrawn,
    closingNotes: notas,
    cashSales,
    cardSales,
    transferSales,
    totalSales,
    totalExpenses,
    netIncome: totalSales - totalExpenses,
    expectedCashInDrawer,
    ticketIds: ticketsSnapshot.map((t) => t.id),
    expenseIds: expensesSnapshot.map((e) => e.id),
    ticketsSnapshot,
    expensesSnapshot,
    breakdown
  };

  // 4. Batch write para congelar sesión, guardar corte, marcar tickets/gastos y actualizar fondo
  const operations: { ref: any; data: any; isMerge?: boolean }[] = [];

  // Sesión en /sesiones_caja
  operations.push({
    ref: doc(db, SESIONES_CAJA_COLLECTION, sesionId),
    data: cleanForFirestore(sesionCerrada),
    isMerge: true
  });

  // Corte en /corteXRecords
  operations.push({
    ref: doc(db, CORTE_X_COLLECTION, sesionId),
    data: cleanForFirestore(corteRecord),
    isMerge: false
  });

  // Fondo para siguiente turno
  operations.push({
    ref: doc(db, BRANCH_FUNDS_COLLECTION, normBId),
    data: {
      branchId: normBId,
      fundAmount: Math.max(0, fondoDejado),
      updatedAt: fechaCierre
    },
    isMerge: true
  });

  // Marcar todos los tickets
  ticketsSnapshot.forEach((t) => {
    // Sync to /sales
    operations.push({
      ref: doc(db, SALES_COLLECTION, t.id),
      data: {
        sesion_caja_id: sesionId,
        corteXId: sesionId,
        corteXClosedAt: fechaCierre,
        sucursal_id: normBId
      },
      isMerge: true
    });
    // Sync to /ventas
    operations.push({
      ref: doc(db, VENTAS_COLLECTION, t.id),
      data: {
        sesion_caja_id: sesionId,
        corteXId: sesionId,
        corteXClosedAt: fechaCierre,
        sucursal_id: normBId
      },
      isMerge: true
    });
  });

  // Marcar todos los gastos
  expensesSnapshot.forEach((e) => {
    // Sync to /expenses
    operations.push({
      ref: doc(db, EXPENSES_COLLECTION, e.id),
      data: {
        sesion_caja_id: sesionId,
        corteXId: sesionId,
        corteXClosedAt: fechaCierre,
        sucursal_id: normBId
      },
      isMerge: true
    });
    // Sync to /gastos
    operations.push({
      ref: doc(db, GASTOS_COLLECTION, e.id),
      data: {
        sesion_caja_id: sesionId,
        corteXId: sesionId,
        corteXClosedAt: fechaCierre,
        sucursal_id: normBId
      },
      isMerge: true
    });
  });

  // Ejecutar en chunks de 400
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

  console.log(`[Firestore] 🔒 Corte de Caja y Sesión congelados exitosamente: ${sesionId}`);
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

  // Auto clean dummy products if any exist
  clearDummyProductsFromFirestore().catch(() => {});

  return onSnapshot(
    productsCol,
    async (snapshot) => {
      if (snapshot.empty) {
        // First run: Seed INITIAL_PRODUCTS into Firestore
        console.log('[Firestore] Seeding initial clean generic actions to cloud...');
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
          // Filter out any mock dummy items if they lingered
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
 * Auto-depuración y reconciliación de tickets y abonos de días anteriores:
 * Si existen tickets o abonos de días pasados (timestamp anterior a hoy) que no tengan corteXId,
 * genera automáticamente el Corte X Oficial y los asocia atómicamente,
 * garantizando que ningún turno previo quede abierto ni desaparezca.
 */
export async function autoReconcilePastTicketsAndExpenses(): Promise<number> {
  try {
    const todayIso = safeDateIsoKey(new Date());
    const salesCol = collection(db, SALES_COLLECTION);
    const expensesCol = collection(db, EXPENSES_COLLECTION);
    const cortesCol = collection(db, CORTE_X_COLLECTION);

    const [salesSnap, expensesSnap, cortesSnap] = await Promise.all([
      getDocs(salesCol),
      getDocs(expensesCol),
      getDocs(cortesCol)
    ]);

    const cortesMap: Record<string, string> = {}; // branchId_dateIso -> corteId
    cortesSnap.forEach((d) => {
      const data = d.data() as CorteXRecord;
      const normBId = normalizeBranchId(data.branchId);
      const dKey = safeDateIsoKey(data.timestamp) || safeDateIsoKey(data.dateStr);
      if (dKey) {
        cortesMap[`${normBId}_${dKey}`] = data.id;
      }
    });

    // Agrupar tickets y gastos pasados sin corteXId por sucursal y fecha
    const pastPendingGroups: Record<string, { branchId: string; dateIso: string; tickets: { docRef: any; data: SaleTicket }[]; expenses: { docRef: any; data: Expense }[] }> = {};

    salesSnap.forEach((d) => {
      const ticket = d.data() as SaleTicket;
      const normBId = normalizeBranchId(ticket.branchId);
      if (normBId === 'b-bodega') return; // Bodega is not a sales branch
      const ticketDateIso = safeDateIsoKey(ticket.timestamp);
      if (ticketDateIso && ticketDateIso < todayIso && !ticket.corteXId) {
        const groupKey = `${normBId}_${ticketDateIso}`;
        if (!pastPendingGroups[groupKey]) {
          pastPendingGroups[groupKey] = { branchId: normBId, dateIso: ticketDateIso, tickets: [], expenses: [] };
        }
        pastPendingGroups[groupKey].tickets.push({ docRef: d.ref, data: ticket });
      }
    });

    expensesSnap.forEach((d) => {
      const exp = d.data() as Expense;
      const normBId = normalizeBranchId(exp.branchId);
      if (normBId === 'b-bodega') return; // Bodega is not a sales branch
      const expDateIso = safeDateIsoKey(exp.timestamp || exp.date);
      if (expDateIso && expDateIso < todayIso && !exp.corteXId) {
        const groupKey = `${normBId}_${expDateIso}`;
        if (!pastPendingGroups[groupKey]) {
          pastPendingGroups[groupKey] = { branchId: normBId, dateIso: expDateIso, tickets: [], expenses: [] };
        }
        pastPendingGroups[groupKey].expenses.push({ docRef: d.ref, data: exp });
      }
    });

    const operations: { ref: any; data: any; isMerge?: boolean }[] = [];
    let patchedCount = 0;

    for (const [groupKey, group] of Object.entries(pastPendingGroups)) {
      const existingCorteId = cortesMap[groupKey];
      const targetCorteId = existingCorteId || `CTX_${group.branchId}_${group.dateIso}`;

      // Si no existe un documento de corte previo para esta fecha y sucursal, crearlo automáticamente
      if (!existingCorteId) {
        let cash = 0, card = 0, transfer = 0;
        let accTot = 0, accCnt = 0, aboTot = 0, aboCnt = 0, engTot = 0, engCnt = 0, repTot = 0, repCnt = 0, recTot = 0, recCnt = 0;

        group.tickets.forEach(({ data: t }) => {
          if (t.paymentMethod === 'Efectivo') cash += (t.total || 0);
          if (t.paymentMethod === 'Tarjeta') card += (t.total || 0);
          if (t.paymentMethod === 'Transferencia') transfer += (t.total || 0);

          (t.items || []).forEach(item => {
            const pName = (item.product?.name || '').toLowerCase();
            const cat = item.product?.category;
            const tot = item.totalPrice || 0;
            const qty = item.quantity || 1;
            if (pName.includes('abono') || cat === 'abono_credito') { aboTot += tot; aboCnt += qty; }
            else if (pName.includes('enganche') || cat === 'equipo_credito') { engTot += tot; engCnt += qty; }
            else if (pName.includes('anticipo') || cat === 'servicio' || item.metadata?.repairType) { repTot += tot; repCnt += qty; }
            else if (cat === 'recarga' || pName.includes('recarga')) { recTot += tot; recCnt += qty; }
            else { accTot += tot; accCnt += qty; }
          });
        });

        const totalExp = group.expenses.reduce((sum, { data: e }) => sum + (e.amount || 0), 0);
        const totalSales = cash + card + transfer;
        const targetDate = parseSafeDate(group.dateIso);

        const autoCorteRecord: CorteXRecord = {
          id: targetCorteId,
          timestamp: `${group.dateIso}T23:59:59.000Z`,
          dateStr: safeFormatDate(targetDate),
          timeStr: 'Cierre Oficial de Turno',
          branchId: group.branchId,
          branchName: getBranchDisplayName(group.branchId),
          operatorName: group.tickets[0]?.data.operatorName || 'Cajero en Turno',
          initialCashFund: 1000,
          cashSales: cash,
          cardSales: card,
          transferSales: transfer,
          totalSales,
          totalExpenses: totalExp,
          netIncome: totalSales - totalExp,
          expectedCashInDrawer: 1000 + cash - totalExp,
          ticketIds: group.tickets.map(t => t.data.id),
          expenseIds: group.expenses.map(e => e.data.id),
          ticketsSnapshot: group.tickets.map(t => t.data),
          expensesSnapshot: group.expenses.map(e => e.data),
          breakdown: {
            accesoriosTotal: accTot,
            accesoriosCount: accCnt,
            abonosTotal: aboTot,
            abonosCount: aboCnt,
            enganchesTotal: engTot,
            enganchesCount: engCnt,
            reparacionesTotal: repTot,
            reparacionesCount: repCnt,
            recargasTotal: recTot,
            recargasCount: recCnt
          }
        };

        const newCorteRef = doc(db, CORTE_X_COLLECTION, targetCorteId);
        operations.push({ ref: newCorteRef, data: cleanForFirestore(autoCorteRecord), isMerge: false });
        cortesMap[groupKey] = targetCorteId;
      }

      // Marcar todos los tickets con el ID de corte finalizado
      group.tickets.forEach(({ docRef, data: t }) => {
        operations.push({
          ref: docRef,
          data: {
            corteXId: targetCorteId,
            corteXClosedAt: `${group.dateIso}T23:59:59.000Z`
          },
          isMerge: true
        });
        patchedCount++;
      });

      // Marcar todos los gastos con el ID de corte finalizado
      group.expenses.forEach(({ docRef, data: e }) => {
        operations.push({
          ref: docRef,
          data: {
            corteXId: targetCorteId,
            corteXClosedAt: `${group.dateIso}T23:59:59.000Z`
          },
          isMerge: true
        });
        patchedCount++;
      });
    }

    if (operations.length > 0) {
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
      console.log(`[Firestore] 🛡️ Auto-Cierre Oficial: Se finalizaron y aseguraron ${patchedCount} movimientos de turnos anteriores.`);
    }

    return patchedCount;
  } catch (err) {
    console.error('[Firestore] Error reconciliando tickets anteriores:', err);
    return 0;
  }
}

/**
 * Limpia y consolida automáticamente registros duplicados de cortes de caja en Firestore.
 * Asegura que por cada sucursal y por cada fecha (día) exista únicamente el corte oficial registrado.
 */
export async function cleanDuplicateCortesFromFirestore(): Promise<{ purgedCount: number; remainingCount: number; reconciledTicketsCount?: number }> {
  try {
    // 1. Reconciliar tickets/abonos de días anteriores para que no queden turnos huérfanos
    const reconciledCount = await autoReconcilePastTicketsAndExpenses();

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
          // Si son idénticos o múltiples copias del mismo corte, conservar el más reciente con más datos
          items.sort((a, b) => {
            const ticketsA = a.data?.ticketIds?.length || 0;
            const ticketsB = b.data?.ticketIds?.length || 0;
            if (ticketsB !== ticketsA) return ticketsB - ticketsA;
            const tA = a.data?.timestamp || '';
            const tB = b.data?.timestamp || '';
            return tB.localeCompare(tA);
          });

          // Solo eliminar si el segundo es idéntico en fecha y sucursal y tiene menos o iguales datos
          for (let i = 1; i < items.length; i++) {
            if (items[i].id.startsWith('CAL-ZERO') || (items[i].data?.totalSales === items[0].data?.totalSales)) {
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

      // Si es de hoy y no tiene un corte cerrado explícito (CTX_...), conservar corteXId vacío para mantenerlo abierto
      const hasRealClosedCorte = !!t.corteXId && t.corteXId.startsWith('CTX_');
      const assignedSessionId = t.sesion_caja_id || sessionObj.id;
      const assignedCorteXId = isToday ? (hasRealClosedCorte ? t.corteXId : undefined) : (t.corteXId || sessionObj.id);

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
      const hasRealClosedCorte = !!e.corteXId && e.corteXId.startsWith('CTX_');
      const assignedSessionId = e.sesion_caja_id || (sessionObj ? sessionObj.id : `SES-${normBId.toUpperCase()}-${dateIso.replace(/-/g, '')}-001`);
      const assignedCorteXId = isToday ? (hasRealClosedCorte ? e.corteXId : undefined) : (e.corteXId || sessionObj?.id);

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
