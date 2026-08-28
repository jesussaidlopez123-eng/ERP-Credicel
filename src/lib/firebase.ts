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
  deleteField,
  onSnapshot,
  writeBatch,
  query,
  where,
  runTransaction
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { Product, SaleTicket, Expense, Operator, RepairPriceItem, AppNotification, InventoryMovement, SesionCaja, CorteXRecord, CreditAccount, RepairRecord, PurchaseDraft } from '../types';
import { formatTicketFolio, money, newSessionId } from './ids';
import { branchFolioCode, COMMERCIAL_BRANCHES, normalizeBranchId, getBranchDisplayName } from '../data/initialBranches';
import { summarizeTickets } from './saleClassification';
import { isNonInventorySaleItem } from './inventoryRules';
import {
  AUTO_CORTE_NOTE,
  CashTillLockedError,
  automaticCloseIso,
  canOpenNewCashSession,
  daysNeedingCatchUpClose,
  formatHermosilloDate,
  formatHermosilloTime,
  getHermosilloClock,
  hermosilloDateKey,
  isAfterCashClose,
  isPrematureAutoCorte,
  sessionNeedsAutomaticCorte
} from './shiftHours';
import { loadLastSessionId } from './localCloudCache';
import { registerOutboxExecutor } from './outbox';

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
export const FOLIO_COUNTERS_COLLECTION = 'folioCounters';
export const PURCHASE_DRAFTS_COLLECTION = 'purchaseDrafts';

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
    sucursal_nombre: 'Bodega',
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

const inflightSessionByBranch = new Map<string, Promise<SesionCaja>>();

async function readOpenSessionFromPointer(
  branchId: string
): Promise<SesionCaja | null> {
  const stateRef = doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, branchId);
  const stateSnap = await getDoc(stateRef);
  const pointedId = String(stateSnap.data()?.openSessionId || '');
  if (!pointedId) return null;
  const pointedSes = await getDoc(doc(db, SESIONES_CAJA_COLLECTION, pointedId));
  if (!pointedSes.exists()) return null;
  const data = pointedSes.data() as SesionCaja;
  if (data.estado !== 'ABIERTA') return null;
  return { ...data, id: pointedId };
}

async function findExistingOpenSession(branchId: string, fund: number): Promise<SesionCaja | null> {
  const pointed = await readOpenSessionFromPointer(branchId);
  if (pointed) return pointed;

  const qOpen = query(
    collection(db, SESIONES_CAJA_COLLECTION),
    where('sucursal_id', '==', branchId),
    where('estado', '==', 'ABIERTA')
  );
  const snap = await getDocs(qOpen);
  if (snap.empty) return null;

  const sessions = snap.docs
    .map((d) => ({ ...(d.data() as SesionCaja), id: d.id }))
    .sort((a, b) => (a.fecha_apertura || '').localeCompare(b.fecha_apertura || ''));
  const chosen = sessions[0];
  await setDoc(
    doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, branchId),
    { branchId, openSessionId: chosen.id, fundAmount: fund, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  return chosen;
}

/**
 * Una sola sesión ABIERTA por sucursal de venta.
 * Recargar o entrar en otra computadora se engancha al mismo turno; no crea otro.
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

  const pending = inflightSessionByBranch.get(normBId);
  if (pending) return pending;

  const work = resolveActiveCashSession(normBId, branchName, operatorName, initialFund, operatorUid)
    .finally(() => {
      if (inflightSessionByBranch.get(normBId) === work) {
        inflightSessionByBranch.delete(normBId);
      }
    });
  inflightSessionByBranch.set(normBId, work);
  return work;
}

async function resolveActiveCashSession(
  normBId: string,
  branchName: string,
  operatorName: string,
  initialFund: number,
  operatorUid: string
): Promise<SesionCaja> {
  const displayName = branchName || getBranchDisplayName(normBId);
  const stateRef = doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, normBId);
  const fund = await readBranchFundAmount(normBId, initialFund);
  const lastError: unknown[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const existing = await findExistingOpenSession(normBId, fund);
      if (existing) return existing;

      if (!canOpenNewCashSession()) {
        throw new CashTillLockedError();
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
      if (err instanceof CashTillLockedError || (err as { name?: string })?.name === 'CashTillLockedError') {
        throw err;
      }
      lastError.push(err);
      console.error('[Firestore] Error getting active cash session:', err);
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }

  throw lastError[lastError.length - 1] || new Error('No se pudo abrir o recuperar la sesión de caja');
}

function sessionFromSnap(
  snap: { exists(): boolean; id: string; data(): unknown }
): SesionCaja | null {
  if (!snap.exists()) return null;
  const data = snap.data() as SesionCaja;
  if (data.estado !== 'ABIERTA') return null;
  return { ...data, id: snap.id };
}

/**
 * Escucha el turno abierto de la sucursal. Si otro equipo hace corte, este se entera al momento.
 */
export function subscribeToOpenCashSession(
  branchId: string,
  onSession: (session: SesionCaja | null) => void,
  onError?: (err: unknown) => void
): () => void {
  const normBId = normalizeBranchId(branchId);
  if (normBId === 'b-bodega') {
    onSession(bodegaPlaceholderSession('Bodega'));
    return () => {};
  }

  const stateRef = doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, normBId);
  let unsubSession: (() => void) | null = null;

  const attachSession = (sessionId: string | null) => {
    if (unsubSession) {
      unsubSession();
      unsubSession = null;
    }
    if (!sessionId) {
      onSession(null);
      return;
    }
    unsubSession = onSnapshot(
      doc(db, SESIONES_CAJA_COLLECTION, sessionId),
      (sesSnap) => {
        onSession(sessionFromSnap(sesSnap));
      },
      (err) => {
        console.error('[Firestore] subscribeToOpenCashSession session:', err);
        if (onError) onError(err);
      }
    );
  };

  const unsubPointer = onSnapshot(
    stateRef,
    (stateSnap) => {
      const pointedId = String(stateSnap.data()?.openSessionId || '');
      attachSession(pointedId || null);
    },
    (err) => {
      console.error('[Firestore] subscribeToOpenCashSession pointer:', err);
      if (onError) onError(err);
    }
  );

  return () => {
    unsubPointer();
    if (unsubSession) unsubSession();
  };
}

function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const map = new Map<string, T>();
  extra.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  primary.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

async function queryDocsBySession<T extends { id: string }>(
  collectionName: string,
  sessionId: string
): Promise<T[]> {
  try {
    const qSession = query(
      collection(db, collectionName),
      where('sesion_caja_id', '==', sessionId)
    );
    const snap = await getDocs(qSession);
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
  } catch (err) {
    console.warn(`[Firestore] query ${collectionName} by session failed:`, err);
    return [];
  }
}

async function queryDocsByField<T extends { id: string }>(
  collectionName: string,
  field: string,
  value: string
): Promise<T[]> {
  if (!value) return [];
  try {
    const qField = query(collection(db, collectionName), where(field, '==', value));
    const snap = await getDocs(qField);
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
  } catch (err) {
    console.warn(`[Firestore] query ${collectionName}.${field} failed:`, err);
    return [];
  }
}

/**
 * Tickets y gastos reales de este turno (todos los equipos), no solo lo que ve una pantalla.
 */
export async function loadUnclosedDocsForSession(
  sessionId: string,
  branchId: string,
  localTickets: SaleTicket[] = [],
  localExpenses: Expense[] = []
): Promise<{ tickets: SaleTicket[]; expenses: Expense[] }> {
  const normBId = normalizeBranchId(branchId);
  const [salesA, salesB, expA, expB] = await Promise.all([
    queryDocsBySession<SaleTicket>(SALES_COLLECTION, sessionId),
    queryDocsBySession<SaleTicket>(VENTAS_COLLECTION, sessionId),
    queryDocsBySession<Expense>(EXPENSES_COLLECTION, sessionId),
    queryDocsBySession<Expense>(GASTOS_COLLECTION, sessionId)
  ]);

  const tickets = mergeById(mergeById(salesA, salesB), localTickets).filter((t) => {
    const b = normalizeBranchId(t.branchId || t.sucursal_id || '');
    if (b && b !== normBId) return false;
    if (t.corteXId && t.corteXId !== sessionId) return false;
    if (t.sesion_caja_id && t.sesion_caja_id !== sessionId) return false;
    return true;
  });

  const expenses = mergeById(mergeById(expA, expB), localExpenses).filter((e) => {
    const b = normalizeBranchId(e.branchId || e.sucursal_id || '');
    if (b && b !== normBId) return false;
    if (e.corteXId && e.corteXId !== sessionId) return false;
    if (e.sesion_caja_id && e.sesion_caja_id !== sessionId) return false;
    return true;
  });

  return { tickets, expenses };
}

export async function saleTicketExistsInFirestore(ticketId: string): Promise<boolean> {
  if (!ticketId) return false;
  const salesSnap = await getDoc(doc(db, SALES_COLLECTION, ticketId));
  if (salesSnap.exists()) return true;
  const ventasSnap = await getDoc(doc(db, VENTAS_COLLECTION, ticketId));
  return ventasSnap.exists();
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
        loaded.push({ ...(d.data() as SesionCaja), id: d.id });
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
  fechaCierreIso?: string;
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
    expensesSnapshot = [],
    fechaCierreIso
  } = params;

  const normBId = normalizeBranchId(sucursalId);
  const sessionRef = doc(db, SESIONES_CAJA_COLLECTION, sesionId);
  const existingSnap = await getDoc(sessionRef);
  if (existingSnap.exists()) {
    const already = { ...(existingSnap.data() as SesionCaja), id: existingSnap.id };
    if (already.estado === 'CERRADA') {
      const corteSnap = await getDoc(doc(db, CORTE_X_COLLECTION, sesionId));
      const existingCorte = corteSnap.exists()
        ? ({ ...(corteSnap.data() as CorteXRecord), id: corteSnap.id } as CorteXRecord)
        : null;
      if (existingCorte && !existingCorte.reverted) {
        return { success: true, sesion: already, corteRecord: existingCorte };
      }
      // Sesión cerrada sin documento de corte: hay que escribirlo, no devolver vacío.
    }
  }

  let ticketsForCorte = ticketsSnapshot;
  let expensesForCorte = expensesSnapshot;
  try {
    const cloudDocs = await loadUnclosedDocsForSession(
      sesionId,
      normBId,
      ticketsSnapshot,
      expensesSnapshot
    );
    ticketsForCorte = cloudDocs.tickets;
    expensesForCorte = cloudDocs.expenses;
  } catch (err) {
    console.warn('[Firestore] No se pudieron leer tickets de la nube al cerrar; se usa el corte de esta pantalla.', err);
  }

  const fechaCierre = fechaCierreIso || new Date().toISOString();
  const dateStr = formatHermosilloDate(fechaCierre);
  const timeStr = formatHermosilloTime(fechaCierre);

  const totals = summarizeTickets(ticketsForCorte);
  const cashSales = totals.cashSales;
  const cardSales = totals.cardSales;
  const transferSales = totals.transferSales;
  const totalSales = totals.totalSales;
  const breakdown = totals.breakdown;
  const totalExpenses = money(expensesForCorte.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));

  const existing: SesionCaja | null = existingSnap.exists()
    ? { ...(existingSnap.data() as SesionCaja), id: existingSnap.id }
    : null;

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
        tickets_venta: ticketsForCorte.length,
        gastos: expensesForCorte.length
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
      version: notas.includes('23:00') ? 'v3.1-cierre-23' : 'v3.0-session-lock'
    }
  };

  const corteRecord: CorteXRecord = {
    id: sesionId,
    timestamp: fechaCierre,
    dateStr,
    timeStr,
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
    ticketIds: ticketsForCorte.map((t) => t.id),
    expenseIds: expensesForCorte.map((e) => e.id),
    ticketsSnapshot: ticketsForCorte,
    expensesSnapshot: expensesForCorte,
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

  ticketsForCorte.forEach((t) => {
    operations.push({ ref: doc(db, SALES_COLLECTION, t.id), data: closeStamp, isMerge: true });
    operations.push({ ref: doc(db, VENTAS_COLLECTION, t.id), data: closeStamp, isMerge: true });
  });
  expensesForCorte.forEach((e) => {
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

const UNSTAMP_FIELDS = {
  corteXId: deleteField(),
  corteXClosedAt: deleteField()
};

async function loadDocsTiedToSession(
  sessionId: string
): Promise<{ tickets: SaleTicket[]; expenses: Expense[] }> {
  const [salesA, salesB, ventasCorte, salesCorte, expA, expB, gastosCorte, expensesCorte] =
    await Promise.all([
      queryDocsBySession<SaleTicket>(SALES_COLLECTION, sessionId),
      queryDocsBySession<SaleTicket>(VENTAS_COLLECTION, sessionId),
      queryDocsByField<SaleTicket>(VENTAS_COLLECTION, 'corteXId', sessionId),
      queryDocsByField<SaleTicket>(SALES_COLLECTION, 'corteXId', sessionId),
      queryDocsBySession<Expense>(EXPENSES_COLLECTION, sessionId),
      queryDocsBySession<Expense>(GASTOS_COLLECTION, sessionId),
      queryDocsByField<Expense>(GASTOS_COLLECTION, 'corteXId', sessionId),
      queryDocsByField<Expense>(EXPENSES_COLLECTION, 'corteXId', sessionId)
    ]);
  return {
    tickets: mergeById(mergeById(mergeById(salesA, salesB), ventasCorte), salesCorte),
    expenses: mergeById(mergeById(mergeById(expA, expB), gastosCorte), expensesCorte)
  };
}

async function unstampAndRetargetDocs(
  sessionId: string,
  liveSessionId?: string
): Promise<void> {
  const { tickets, expenses } = await loadDocsTiedToSession(sessionId);
  const stamp = liveSessionId
    ? { ...UNSTAMP_FIELDS, sesion_caja_id: liveSessionId }
    : UNSTAMP_FIELDS;
  const operations: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];
  tickets.forEach((t) => {
    operations.push({ ref: doc(db, SALES_COLLECTION, t.id), data: stamp });
    operations.push({ ref: doc(db, VENTAS_COLLECTION, t.id), data: stamp });
  });
  expenses.forEach((e) => {
    operations.push({ ref: doc(db, EXPENSES_COLLECTION, e.id), data: stamp });
    operations.push({ ref: doc(db, GASTOS_COLLECTION, e.id), data: stamp });
  });
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((op) => batch.set(op.ref, op.data, { merge: true }));
    await batch.commit();
  }
}

async function restoreOpenSessionPointer(session: SesionCaja): Promise<void> {
  const fund = money(Number(session.monto_inicial_efectivo || 0));
  await setDoc(
    doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, session.sucursal_id),
    {
      branchId: session.sucursal_id,
      openSessionId: session.id,
      fundAmount: fund,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

async function markCorteReverted(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    const ref = doc(db, CORTE_X_COLLECTION, sessionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await setDoc(
      ref,
      { reverted: true, revertedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] No se pudo marcar el corte como revertido:', err);
  }
}

async function reopenClosedSession(session: SesionCaja): Promise<void> {
  await updateDoc(doc(db, SESIONES_CAJA_COLLECTION, session.id), {
    estado: 'ABIERTA',
    fecha_cierre: deleteField(),
    operador_cierre: deleteField(),
    arqueo_cierre: deleteField(),
    totales_calculados: deleteField()
  });
  await restoreOpenSessionPointer(session);
  await unstampAndRetargetDocs(session.id);
  await markCorteReverted(session.id);
}

/**
 * If an automatic 23:00 corte ran before 23:00 Sonora on the same calendar day
 * the till opened, put that shift back to ABIERTA so Navojoa/Huatabampo keep
 * working the real turno. Does not scan the whole session history and never
 * deletes corte documents.
 */
export async function reopenPrematureAutoCorteIfNeeded(branchId: string): Promise<boolean> {
  try {
    const normBId = normalizeBranchId(branchId);
    if (normBId === 'b-bodega') return false;
    if (!canOpenNewCashSession()) return false;

    const fund = await readBranchFundAmount(normBId, 1000);
    const live = await findExistingOpenSession(normBId, fund);
    if (live) return false;

    const stateSnap = await getDoc(doc(db, BRANCH_OPEN_SESSIONS_COLLECTION, normBId));
    const pointedId = String(stateSnap.data()?.openSessionId || '');
    if (!pointedId) return false;
    const sesSnap = await getDoc(doc(db, SESIONES_CAJA_COLLECTION, pointedId));
    if (!sesSnap.exists()) return false;
    const session = { ...(sesSnap.data() as SesionCaja), id: sesSnap.id };
    if (!isPrematureAutoCorte(session)) return false;

    await reopenClosedSession(session);
    console.log(`[Firestore] Se reabrió el corte automático prematuro de ${normBId} (${session.id})`);
    return true;
  } catch (err) {
    console.warn('[Firestore] reopenPrematureAutoCorteIfNeeded:', err);
    return false;
  }
}

export async function healPrematureAutoCortesForCommercialBranches(): Promise<void> {
  await Promise.all(
    COMMERCIAL_BRANCHES.map((branch) =>
      reopenPrematureAutoCorteIfNeeded(branch.id).catch((err) => {
        console.warn(`[Firestore] No se pudo revisar el corte prematuro de ${branch.id}:`, err);
        return false;
      })
    )
  );
}

function localDocsForCashDay(
  branchId: string,
  dateKey: string,
  localTickets: SaleTicket[] = [],
  localExpenses: Expense[] = []
): { tickets: SaleTicket[]; expenses: Expense[] } {
  const normBId = normalizeBranchId(branchId);
  return {
    tickets: localTickets.filter((t) => {
      if (!t?.id) return false;
      if (normalizeBranchId(t.branchId || t.sucursal_id || '') !== normBId) return false;
      if (hermosilloDateKey(t.timestamp) !== dateKey) return false;
      return true;
    }),
    expenses: localExpenses.filter((e) => {
      if (!e?.id) return false;
      if (normalizeBranchId(e.branchId || e.sucursal_id || '') !== normBId) return false;
      if (hermosilloDateKey(e.timestamp || e.date) !== dateKey) return false;
      return true;
    })
  };
}

async function readSessionById(sessionId: string): Promise<SesionCaja | null> {
  if (!sessionId) return null;
  try {
    const snap = await getDoc(doc(db, SESIONES_CAJA_COLLECTION, sessionId));
    if (!snap.exists()) return null;
    return { ...(snap.data() as SesionCaja), id: snap.id };
  } catch {
    return null;
  }
}

/**
 * Finds the shift to close after 23:00 without opening a new one.
 */
export async function findSessionForCorteClose(
  branchId: string,
  dateKey?: string,
  preferredSessionId?: string
): Promise<SesionCaja | null> {
  const normBId = normalizeBranchId(branchId);
  if (normBId === 'b-bodega') return null;
  const key = dateKey || getHermosilloClock().dateKey;

  const preferred = await readSessionById(preferredSessionId || loadLastSessionId(normBId));
  if (preferred && normalizeBranchId(preferred.sucursal_id) === normBId) {
    const openedKey = hermosilloDateKey(preferred.fecha_apertura);
    if (!openedKey || openedKey === key) return preferred;
  }

  const fund = await readBranchFundAmount(normBId, 1000);
  try {
    const open = await findExistingOpenSession(normBId, fund);
    if (open && (!key || hermosilloDateKey(open.fecha_apertura) === key || !hermosilloDateKey(open.fecha_apertura))) {
      return open;
    }
  } catch (err) {
    console.warn('[Firestore] No se pudo leer la sesión abierta al cerrar:', err);
  }

  try {
    const snap = await getDocs(
      query(collection(db, SESIONES_CAJA_COLLECTION), where('sucursal_id', '==', normBId))
    );
    const ofDay = snap.docs
      .map((d) => ({ ...(d.data() as SesionCaja), id: d.id }))
      .filter((s) => hermosilloDateKey(s.fecha_apertura) === key)
      .sort((a, b) => (b.fecha_apertura || '').localeCompare(a.fecha_apertura || ''));
    if (ofDay.length > 0) {
      const openOfDay = ofDay.find((s) => s.estado === 'ABIERTA');
      return openOfDay || ofDay[0];
    }
  } catch (err) {
    console.warn('[Firestore] No se pudo buscar la sesión del día al cerrar:', err);
  }

  return preferred;
}

async function ensureSessionForClose(
  branchId: string,
  branchName: string,
  operator: { uid: string; nombre: string },
  dateKey: string,
  preferredSessionId?: string,
  initialFund = 0,
  createIfMissing = true
): Promise<SesionCaja> {
  const existing = await findSessionForCorteClose(branchId, dateKey, preferredSessionId);
  if (existing) return existing;
  if (!createIfMissing) {
    throw new Error('No hay turno de caja de ese día para cerrar.');
  }

  const openedAt = new Date(`${dateKey}T09:00:00-07:00`);
  const newSesionId = newSessionId(branchId, openedAt);
  const session: SesionCaja = {
    id: newSesionId,
    sucursal_id: branchId,
    sucursal_nombre: branchName || getBranchDisplayName(branchId),
    operador_apertura: operator,
    estado: 'ABIERTA',
    fecha_apertura: openedAt.toISOString(),
    monto_inicial_efectivo: money(initialFund)
  };
  await setDoc(doc(db, SESIONES_CAJA_COLLECTION, newSesionId), cleanForFirestore(session));
  return session;
}

/**
 * Cierra el turno de una sucursal aunque ya pasaron las 11:00 p.m. o la sesión
 * quedó CERRADA sin documento de corte. No abre un turno nuevo de ventas.
 */
export async function closeOpenShiftForBranch(params: {
  branchId: string;
  branchName?: string;
  operatorUid: string;
  operatorName: string;
  efectivoContado?: number;
  fondoDejado?: number;
  notas?: string;
  ticketsSnapshot?: SaleTicket[];
  expensesSnapshot?: Expense[];
  fechaCierreIso?: string;
  preferredSessionId?: string;
  dateKey?: string;
  initialFund?: number;
  createIfMissing?: boolean;
}): Promise<{ success: boolean; sesion: SesionCaja; corteRecord: CorteXRecord }> {
  const normBId = normalizeBranchId(params.branchId);
  if (normBId === 'b-bodega') {
    throw new Error('Bodega no genera cortes de caja.');
  }

  const dateKey =
    params.dateKey ||
    hermosilloDateKey(params.fechaCierreIso) ||
    getHermosilloClock().dateKey;
  const displayName = params.branchName || getBranchDisplayName(normBId);
  const fund = await readBranchFundAmount(normBId, params.initialFund ?? params.fondoDejado ?? 1000);
  const session = await ensureSessionForClose(
    normBId,
    displayName,
    { uid: params.operatorUid, nombre: params.operatorName },
    dateKey,
    params.preferredSessionId,
    fund,
    params.createIfMissing !== false
  );

  const localDay = localDocsForCashDay(
    normBId,
    hermosilloDateKey(session.fecha_apertura) || dateKey,
    params.ticketsSnapshot,
    params.expensesSnapshot
  );
  const totals = summarizeTickets(localDay.tickets);
  const totalExpenses = money(localDay.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  const expected = money(Number(session.monto_inicial_efectivo || fund) + totals.cashSales - totalExpenses);

  return executeCorteSesionCajaTransaction({
    sesionId: session.id,
    sucursalId: normBId,
    sucursalNombre: session.sucursal_nombre || displayName,
    operadorCierre: { uid: params.operatorUid, nombre: params.operatorName },
    efectivoContado: params.efectivoContado ?? expected,
    fondoDejado: params.fondoDejado ?? fund,
    notas: params.notas || '',
    ticketsSnapshot: localDay.tickets,
    expensesSnapshot: localDay.expenses,
    fechaCierreIso: params.fechaCierreIso
  });
}

export async function closeCashSessionIfDue(params: {
  branchId: string;
  branchName?: string;
  operatorUid: string;
  operatorName: string;
  initialFund?: number;
  ticketsSnapshot?: SaleTicket[];
  expensesSnapshot?: Expense[];
}): Promise<{ closed: boolean; session: SesionCaja | null; corteRecord?: CorteXRecord }> {
  const normBId = normalizeBranchId(params.branchId);
  if (normBId === 'b-bodega') {
    return { closed: false, session: null };
  }

  const fund = await readBranchFundAmount(normBId, params.initialFund ?? 1000);
  let existing: SesionCaja | null = null;
  try {
    existing = await findExistingOpenSession(normBId, fund);
  } catch (err) {
    console.warn('[Firestore] closeCashSessionIfDue no pudo leer la sesión abierta:', err);
  }
  if (!existing) return { closed: false, session: null };
  if (!sessionNeedsAutomaticCorte(existing)) {
    return { closed: false, session: existing };
  }

  let tickets = params.ticketsSnapshot || [];
  let expenses = params.expensesSnapshot || [];
  try {
    const cloudDocs = await loadUnclosedDocsForSession(existing.id, normBId, tickets, expenses);
    tickets = cloudDocs.tickets;
    expenses = cloudDocs.expenses;
  } catch (err) {
    console.warn('[Firestore] closeCashSessionIfDue sin lectura de tickets en la nube:', err);
  }

  const totals = summarizeTickets(tickets);
  const totalExpenses = money(expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  const expected = money(Number(existing.monto_inicial_efectivo || 0) + totals.cashSales - totalExpenses);

  const result = await executeCorteSesionCajaTransaction({
    sesionId: existing.id,
    sucursalId: normBId,
    sucursalNombre: params.branchName || existing.sucursal_nombre,
    operadorCierre: { uid: params.operatorUid, nombre: params.operatorName },
    efectivoContado: expected,
    fondoDejado: fund,
    notas: AUTO_CORTE_NOTE,
    ticketsSnapshot: tickets,
    expensesSnapshot: expenses,
    fechaCierreIso: automaticCloseIso(existing.fecha_apertura)
  });

  return { closed: true, session: result.sesion, corteRecord: result.corteRecord };
}

export async function recoverMissingDailyCortes(params: {
  operatorUid: string;
  operatorName: string;
  ticketsSnapshot?: SaleTicket[];
  expensesSnapshot?: Expense[];
}): Promise<void> {
  const days = daysNeedingCatchUpClose();
  for (const branch of COMMERCIAL_BRANCHES) {
    for (const dateKey of days) {
      const localDay = localDocsForCashDay(
        branch.id,
        dateKey,
        params.ticketsSnapshot,
        params.expensesSnapshot
      );
      const unstampedTickets = localDay.tickets.filter((t) => !t.corteXId);
      const unstampedExpenses = localDay.expenses.filter((e) => !e.corteXId);
      try {
        const fund = await readBranchFundAmount(branch.id, 1000);
        const open = await findExistingOpenSession(branch.id, fund);
        const needsAuto = !!(open && sessionNeedsAutomaticCorte(open));
        const finishedDay = dateKey !== getHermosilloClock().dateKey || isAfterCashClose();
        if (!needsAuto && unstampedTickets.length === 0 && unstampedExpenses.length === 0) {
          continue;
        }
        if (!finishedDay && !needsAuto) continue;
        await closeOpenShiftForBranch({
          branchId: branch.id,
          branchName: branch.name,
          operatorUid: params.operatorUid,
          operatorName: params.operatorName,
          ticketsSnapshot: unstampedTickets,
          expensesSnapshot: unstampedExpenses,
          dateKey,
          notas: AUTO_CORTE_NOTE,
          fechaCierreIso: `${dateKey}T23:00:00-07:00`,
          fondoDejado: fund,
          createIfMissing: unstampedTickets.length > 0 || unstampedExpenses.length > 0,
          efectivoContado: money(
            Number(open?.monto_inicial_efectivo || fund) +
              summarizeTickets(unstampedTickets).cashSales -
              money(unstampedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))
          )
        });
      } catch (err) {
        console.warn(`[Firestore] No se pudo recuperar el corte de ${branch.id} ${dateKey}:`, err);
      }
    }
  }
}

export async function syncPosCashSession(params: {
  branchId: string;
  branchName: string;
  operatorUid: string;
  operatorName: string;
  initialFund?: number;
  ticketsSnapshot?: SaleTicket[];
  expensesSnapshot?: Expense[];
}): Promise<{ session: SesionCaja | null; tillLocked: boolean; autoClosed: boolean; closeFailed?: boolean }> {
  if (canOpenNewCashSession()) {
    await reopenPrematureAutoCorteIfNeeded(params.branchId);
  }
  const due = await closeCashSessionIfDue(params);
  if (!canOpenNewCashSession()) {
    let autoClosed = due.closed;
    let closeFailed = false;
    if (!due.closed) {
      const localDay = localDocsForCashDay(
        params.branchId,
        getHermosilloClock().dateKey,
        params.ticketsSnapshot,
        params.expensesSnapshot
      );
      const hasWork = localDay.tickets.length > 0 || localDay.expenses.length > 0 || due.session?.estado === 'ABIERTA';
      if (hasWork) {
        try {
          const recovered = await closeOpenShiftForBranch({
            branchId: params.branchId,
            branchName: params.branchName,
            operatorUid: params.operatorUid,
            operatorName: params.operatorName,
            ticketsSnapshot: params.ticketsSnapshot,
            expensesSnapshot: params.expensesSnapshot,
            notas: AUTO_CORTE_NOTE,
            fechaCierreIso: automaticCloseIso(due.session?.fecha_apertura || new Date().toISOString()),
            initialFund: params.initialFund
          });
          autoClosed = !!recovered.corteRecord?.id;
        } catch (err) {
          console.warn('[Firestore] No se pudo guardar el corte después de las 11:00 p.m.:', err);
          closeFailed = true;
        }
      }
    }
    let stillOpen: SesionCaja | null = null;
    try {
      const fund = await readBranchFundAmount(params.branchId, params.initialFund ?? 1000);
      stillOpen = await findExistingOpenSession(params.branchId, fund);
    } catch {
      stillOpen = due.session?.estado === 'ABIERTA' ? due.session : null;
    }
    return { session: stillOpen, tillLocked: true, autoClosed, closeFailed };
  }
  const session = await getActiveCashSession(
    params.branchId,
    params.branchName,
    params.operatorName,
    params.initialFund ?? 1000,
    params.operatorUid
  );
  return { session, tillLocked: false, autoClosed: due.closed };
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
          '[Firestore] La colección products está vacía. No se reemplaza el catálogo local.',
        );
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
function subscribeMergedCollection<T extends { id: string }>(
  primaryName: string,
  secondaryName: string,
  onUpdate: (rows: T[]) => void,
  onError?: (err: any) => void
) {
  let primary: T[] = [];
  let secondary: T[] = [];
  let primaryReady = false;
  let secondaryFetched = false;

  const emit = () => {
    if (!primaryReady) return;
    const map = new Map<string, T>();
    secondary.forEach((row) => {
      if (row?.id) map.set(row.id, row);
    });
    primary.forEach((row) => {
      if (row?.id) map.set(row.id, row);
    });
    const loaded = Array.from(map.values());
    loaded.sort((a, b) =>
      String((b as { timestamp?: string }).timestamp || '').localeCompare(
        String((a as { timestamp?: string }).timestamp || '')
      )
    );
    onUpdate(loaded);
  };

  const pullSecondaryOnce = () => {
    if (secondaryFetched) return;
    secondaryFetched = true;
    if (primary.length > 0) {
      emit();
      return;
    }
    getDocs(collection(db, secondaryName))
      .then((snapshot) => {
        secondary = snapshot.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
        emit();
      })
      .catch((err) => {
        console.warn(`[Firestore] one-shot ${secondaryName} failed:`, err);
        emit();
      });
  };

  const unsubPrimary = onSnapshot(
    collection(db, primaryName),
    (snapshot) => {
      primary = snapshot.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
      primaryReady = true;
      emit();
      pullSecondaryOnce();
    },
    (err) => {
      console.error(`[Firestore] subscribe ${primaryName} error:`, err);
      if (onError) onError(err);
      if (primaryReady) return;
      getDocs(collection(db, secondaryName))
        .then((snapshot) => {
          secondaryFetched = true;
          secondary = snapshot.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
          if (secondary.length === 0) return;
          primaryReady = true;
          emit();
        })
        .catch((secondaryErr) => {
          console.warn(`[Firestore] one-shot ${secondaryName} failed:`, secondaryErr);
        });
    }
  );

  return () => {
    unsubPrimary();
  };
}

export function subscribeToSales(
  onSalesUpdate: (sales: SaleTicket[]) => void,
  onError?: (err: any) => void
) {
  return subscribeMergedCollection<SaleTicket>(SALES_COLLECTION, VENTAS_COLLECTION, onSalesUpdate, onError);
}

export async function allocateSaleFolio(branchId: string): Promise<string> {
  const normBId = normalizeBranchId(branchId);
  const dateKey = getHermosilloClock().dateKey;
  const code = branchFolioCode(normBId);
  const counterRef = doc(db, FOLIO_COUNTERS_COLLECTION, `${code}-${dateKey}`);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const last = Number(snap.data()?.lastSeq || 0) + 1;
    tx.set(
      counterRef,
      {
        branchId: normBId,
        dateKey,
        lastSeq: last,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return last;
  });
  return formatTicketFolio(normBId, dateKey, seq);
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
  return subscribeMergedCollection<Expense>(EXPENSES_COLLECTION, GASTOS_COLLECTION, onExpensesUpdate, onError);
}

export async function saveExpenseToFirestore(expense: Expense) {
  try {
    const normBId = normalizeBranchId(expense.branchId || expense.sucursal_id || 'b-bodega');
    const enrichedExpense: Expense = {
      ...expense,
      amount: money(Number(expense.amount) || 0),
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
        loaded.push({ ...(d.data() as CorteXRecord), id: d.id });
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

/**
 * Cancela un ticket por error de operador: restaura stock/IMEI y borra solo ese folio.
 * No toca el resto de ventas, gastos ni cortes.
 */
export async function deleteSaleTicketFromFirestore(
  ticket: SaleTicket | string,
  options?: {
    reason?: string;
    operatorName?: string;
  }
): Promise<void> {
  const ticketId = typeof ticket === 'string' ? ticket : ticket.id;
  if (!ticketId) throw new Error('ID de ticket no proporcionado');

  let ticketData: SaleTicket | null = typeof ticket === 'object' ? ticket : null;

  if (!ticketData || !ticketData.items) {
    try {
      const ventaSnap = await getDoc(doc(db, VENTAS_COLLECTION, ticketId));
      if (ventaSnap.exists()) {
        ticketData = ventaSnap.data() as SaleTicket;
      } else {
        const salesSnap = await getDoc(doc(db, SALES_COLLECTION, ticketId));
        if (salesSnap.exists()) {
          ticketData = salesSnap.data() as SaleTicket;
        }
      }
    } catch (err) {
      console.warn('[Firestore] Error al buscar ticket para eliminar:', err);
    }
  }

  const normBId = normalizeBranchId(ticketData?.branchId || ticketData?.sucursal_id || 'b-bodega');
  const branchName = getBranchDisplayName(normBId);
  const operator = options?.operatorName || ticketData?.operatorName || 'Administrador';
  const reason = options?.reason || 'Error de captura de operador';

  if (ticketData?.items && Array.isArray(ticketData.items)) {
    for (const item of ticketData.items) {
      if (isNonInventorySaleItem(item)) continue;
      const prodId = item.product?.id;
      if (!prodId) continue;

      try {
        const prodRef = doc(db, PRODUCTS_COLLECTION, prodId);
        const prodSnap = await getDoc(prodRef);
        if (!prodSnap.exists()) continue;

        const currentProd = prodSnap.data() as Product;
        const currentBranchStock = currentProd.branchStock?.[normBId] ?? 0;
        const currentTotalStock = currentProd.stock ?? 0;
        const qty = item.quantity || 1;
        const newBranchStock = currentBranchStock + qty;
        const newTotalStock = currentTotalStock + qty;
        const imeiSold = item.metadata?.imei;
        const updatedImeiMap = { ...(currentProd.branchImeiMap || {}) };
        const updatedImeis = [...(currentProd.imeis || currentProd.imeiList || [])];

        if (imeiSold) {
          const currentBranchImeis = updatedImeiMap[normBId] || [];
          if (!currentBranchImeis.includes(imeiSold)) {
            updatedImeiMap[normBId] = [...currentBranchImeis, imeiSold];
          }
          if (!updatedImeis.includes(imeiSold)) {
            updatedImeis.push(imeiSold);
          }
        }

        await updateDoc(prodRef, {
          stock: newTotalStock,
          branchStock: {
            ...(currentProd.branchStock || {}),
            [normBId]: newBranchStock
          },
          branchImeiMap: updatedImeiMap,
          imeis: updatedImeis
        });

        const movId = `mov-rev-${ticketId}-${Math.random().toString(36).slice(2, 7)}`;
        await setDoc(doc(db, MOVEMENTS_COLLECTION, movId), cleanForFirestore({
          id: movId,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString(),
          type: 'ENTRADA',
          productId: currentProd.id,
          productCode: currentProd.code || 'S/C',
          productName: currentProd.name,
          category: currentProd.category,
          inventoryType: currentProd.inventoryType,
          quantity: qty,
          previousStock: currentBranchStock,
          newStock: newBranchStock,
          targetBranchId: normBId,
          targetBranchName: branchName,
          operatorName: operator,
          ticketId,
          details: `Reversa de inventario por eliminación de Ticket #${ticketId.slice(-6)} (${reason})`,
          imeis: imeiSold ? [imeiSold] : undefined
        }));
      } catch (err) {
        console.warn(`[Firestore] No se pudo restaurar stock de ${prodId}:`, err);
      }
    }
  }

  try {
    await deleteDoc(doc(db, VENTAS_COLLECTION, ticketId));
  } catch (err) {
    console.warn('[Firestore] deleteDoc ventas err:', err);
  }
  try {
    await deleteDoc(doc(db, SALES_COLLECTION, ticketId));
  } catch (err) {
    console.warn('[Firestore] deleteDoc sales err:', err);
  }
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

export function subscribeToPurchaseDrafts(
  onUpdate: (drafts: PurchaseDraft[]) => void,
  onError?: (err: any) => void
) {
  const col = collection(db, PURCHASE_DRAFTS_COLLECTION);
  return onSnapshot(
    col,
    (snapshot) => {
      const loaded: PurchaseDraft[] = snapshot.docs.map((d) => ({ ...(d.data() as PurchaseDraft), id: d.id }));
      loaded.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
      onUpdate(loaded);
    },
    (err) => {
      console.error('[Firestore] subscribeToPurchaseDrafts error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePurchaseDraftToFirestore(draft: PurchaseDraft) {
  const docRef = doc(db, PURCHASE_DRAFTS_COLLECTION, draft.id);
  await setDoc(docRef, cleanForFirestore(draft), { merge: true });
}

export async function deletePurchaseDraftFromFirestore(draftId: string) {
  await deleteDoc(doc(db, PURCHASE_DRAFTS_COLLECTION, draftId));
}

// ----------------------------------------------------
// 10. RESPALDO DIARIO Y COLA DE ENVÍO
// ----------------------------------------------------
export const DAILY_BACKUPS_COLLECTION = 'dailyBackups';

/**
 * Aparta un rango de folios para este equipo. Devuelve el primero y el último.
 * Mientras el equipo tenga rango, puede cobrar sin internet sin repetir folio.
 */
export async function leaseFolioBlock(
  branchId: string,
  dateKey: string,
  size: number
): Promise<{ start: number; end: number }> {
  const normBId = normalizeBranchId(branchId);
  const code = branchFolioCode(normBId);
  const block = Math.max(1, Math.floor(size));
  const counterRef = doc(db, FOLIO_COUNTERS_COLLECTION, `${code}-${dateKey}`);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const last = Number(snap.data()?.lastSeq || 0);
    const start = last + 1;
    const end = last + block;
    tx.set(
      counterRef,
      {
        branchId: normBId,
        dateKey,
        lastSeq: end,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return { start, end };
  });
}

export interface QueuedDocWrite {
  collection: string;
  id: string;
  data: Record<string, unknown>;
  merge?: boolean;
}

export async function commitDocWrites(writes: QueuedDocWrite[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    const chunk = writes.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((w) => {
      const ref = doc(db, w.collection, w.id);
      if (w.merge === false) batch.set(ref, w.data);
      else batch.set(ref, w.data, { merge: true });
    });
    await batch.commit();
  }
}

export async function saveDailyBackupToFirestore(backup: {
  id: string;
  branchId: string;
  dateKey: string;
  [key: string]: unknown;
}): Promise<void> {
  await setDoc(doc(db, DAILY_BACKUPS_COLLECTION, backup.id), cleanForFirestore(backup), {
    merge: true
  });
}

registerOutboxExecutor('docWrite', async (payload) => {
  const { writes } = payload as { writes: QueuedDocWrite[] };
  if (!Array.isArray(writes) || writes.length === 0) return;
  await commitDocWrites(writes);
});

registerOutboxExecutor('corteClose', async (payload) => {
  const params = payload as Parameters<typeof closeOpenShiftForBranch>[0];
  if (!params?.branchId) return;
  await closeOpenShiftForBranch(params);
});

registerOutboxExecutor('dailyBackup', async (payload) => {
  const backup = payload as { id: string; branchId: string; dateKey: string };
  if (!backup?.id) return;
  await saveDailyBackupToFirestore(backup);
});

