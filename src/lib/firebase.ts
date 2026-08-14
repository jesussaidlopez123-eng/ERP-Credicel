import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { Product, SaleTicket, Expense, Operator, RepairPriceItem, AppNotification, Branch } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import { INITIAL_REPAIR_PRICES } from '../data/initialRepairPrices';

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
// 1. PRODUCTS (INVENTARIO)
// ----------------------------------------------------
const PRODUCTS_COLLECTION = 'products';

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
const SALES_COLLECTION = 'sales';

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
    const docRef = doc(db, SALES_COLLECTION, ticket.id);
    await setDoc(docRef, cleanForFirestore(ticket));
  } catch (err) {
    console.error('[Firestore] Error saving sale ticket:', err);
    throw err;
  }
}

// ----------------------------------------------------
// 3. EXPENSES (GASTOS DE CAJA)
// ----------------------------------------------------
const EXPENSES_COLLECTION = 'expenses';

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
    const docRef = doc(db, EXPENSES_COLLECTION, expense.id);
    await setDoc(docRef, cleanForFirestore(expense));
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
export interface CorteXRecord {
  id: string; // CTX-XXXXXX
  timestamp: string;
  dateStr: string;
  timeStr: string;
  branchId: string;
  branchName: string;
  operatorName: string;
  initialCashFund: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  totalSales: number;
  totalExpenses: number;
  netIncome: number;
  expectedCashInDrawer: number;
  ticketIds: string[];
  expenseIds: string[];
  breakdown: {
    accesoriosTotal: number;
    accesoriosCount: number;
    abonosTotal: number;
    abonosCount: number;
    enganchesTotal: number;
    enganchesCount: number;
    reparacionesTotal: number;
    reparacionesCount: number;
    recargasTotal: number;
    recargasCount: number;
  };
}

const CORTE_X_COLLECTION = 'corteXRecords';

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

export async function executeAndSaveCorteX(
  corte: CorteXRecord,
  ticketsToClose: SaleTicket[],
  expensesToClose: Expense[]
) {
  try {
    const batch = writeBatch(db);

    // 1. Save the Corte X Record
    const corteRef = doc(db, CORTE_X_COLLECTION, corte.id);
    batch.set(corteRef, cleanForFirestore(corte));

    // 2. Mark tickets with corteXId
    ticketsToClose.forEach((t) => {
      const ticketRef = doc(db, SALES_COLLECTION, t.id);
      batch.update(ticketRef, {
        corteXId: corte.id,
        corteXClosedAt: corte.timestamp
      });
    });

    // 3. Mark expenses with corteXId
    expensesToClose.forEach((e) => {
      const expRef = doc(db, EXPENSES_COLLECTION, e.id);
      batch.update(expRef, {
        corteXId: corte.id,
        corteXClosedAt: corte.timestamp
      });
    });

    await batch.commit();
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
