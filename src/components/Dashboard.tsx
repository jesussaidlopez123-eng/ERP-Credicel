import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense, startTransition } from 'react';
import Sidebar from './Sidebar';
import NotificationsPopover from './NotificationsPopover';
import { Branch, Operator, ModuleId, AppNotification, Product, SaleTicket, Expense, RepairPriceItem, CorteXRecord, InventoryMovement, CreditAccount, RepairRecord, SesionCaja, PurchaseDraft } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_REPAIR_PRICES } from '../data/initialRepairPrices';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import { ALL_BRANCHES, getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { canOpenModule, defaultModuleForRole, normalizeRole } from '../lib/roles';
import { Bell, Menu, Megaphone } from 'lucide-react';
import {
  subscribeToProducts,
  saveProductToFirestore,
  deleteProductFromFirestore,
  subscribeToSales,
  subscribeToExpenses,
  subscribeToRepairPrices,
  saveRepairPriceToFirestore,
  deleteRepairPriceFromFirestore,
  subscribeToNotifications,
  saveNotificationToFirestore,
  deleteNotificationFromFirestore,
  subscribeToCortesX,
  subscribeToInventoryMovements,
  saveInventoryMovementToFirestore,
  subscribeToBranchFunds,
  ensureBranchFundsZeroedOnce,
  getActiveCashSession,
  subscribeToOpenCashSession,
  closeCashSessionIfDue,
  syncPosCashSession,
  closeOpenShiftForBranch,
  recoverMissingDailyCortes,
  subscribeToCreditAccounts,
  saveCreditAccountToFirestore,
  applyCreditAbonoToAccount,
  subscribeToRepairRecords,
  deleteSaleTicketFromFirestore,
  savePurchaseDraftToFirestore,
  fetchOlderSales,
  fetchOlderExpenses,
  fetchOlderCortes,
  fetchOlderInventoryMovements,
  fetchOlderRepairRecords
} from '../lib/firebase';
import { isNonInventorySaleItem } from '../lib/inventoryRules';
import { safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import { money, newUniqueId } from '../lib/ids';
import {
  canOpenNewCashSession,
  getHermosilloClock,
  hermosilloDateKey,
  isAfterCashClose,
  loggedInBeforeCashClose,
  msUntilCashClose,
  sessionNeedsAutomaticCorte,
  CashTillLockedError
} from '../lib/shiftHours';
import {
  keepIfCloudEmpty,
  loadAllPendingCortes,
  loadCachedList,
  loadCachedProducts,
  rememberLastSession,
  removePendingCorte,
  saveCachedList,
  scheduleSaveCachedList
} from '../lib/localCloudCache';
import { enqueue, startOutboxWorker } from '../lib/outbox';
import {
  commitCorte,
  commitExpense,
  commitInventoryMovements,
  commitProduct,
  commitRepairRecord,
  commitSale,
  forgetLocalSale,
  localCortes,
  localExpenses,
  localRepairs,
  localSales,
  mergeWithLocal,
  pruneOldLocalRecords,
  saleAlreadyCommitted,
  sortByTimestampDesc
} from '../lib/syncQueue';
import { allocateFolio, clearFolioLeaseCooldown, warmUpFolios } from '../lib/folioAllocator';
import { ensureDailyBackup } from '../lib/dailyBackup';
import { observeTrustedIso, trustedIso } from '../lib/clockGuard';
import {
  inferRepairsFromTickets,
  isPendingRepair,
  loadLegacyRepairRecords,
  mergeRepairSources
} from '../lib/repairUtils';
import SyncStatusChip from './SyncStatusChip';
import LazyWhen, { ModuleLoading } from './LazyWhen';
import { mergeByIdKeep, oldestTimestamp } from '../lib/listMerge';
import { HISTORY_PAGE, LIVE_LIMIT } from '../lib/queryLimits';
import { useStableCallback } from '../hooks/useStableCallback';

const CreateNoticeModal = lazy(() => import('./CreateNoticeModal'));
const RepairPriceCatalogModal = lazy(() => import('./RepairPriceCatalogModal'));
const PosModule = lazy(() => import('./PosModule'));
const InventoryModule = lazy(() => import('./InventoryModule'));
const PurchasesModule = lazy(() => import('./PurchasesModule'));
const SalesModule = lazy(() => import('./SalesModule'));
const RepairsModule = lazy(() => import('./RepairsModule'));
const ExecutiveModule = lazy(() => import('./ExecutiveModule'));
const SettingsModule = lazy(() => import('./SettingsModule'));

interface DashboardProps {
  currentBranch: Branch;
  currentOperator: Operator;
  operators?: Operator[];
  onUpdateOperators?: (newOps: Operator[]) => void;
  onLogout: () => void;
}

export default function Dashboard({ 
  currentBranch, 
  currentOperator, 
  operators = INITIAL_OPERATORS,
  onUpdateOperators = () => {},
  onLogout 
}: DashboardProps) {
  const [activeModule, setActiveModule] = useState<ModuleId>(() => defaultModuleForRole(currentOperator.role));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateNoticeOpen, setIsCreateNoticeOpen] = useState(false);

  // POS Quick Modal States
  const [isCorteXOpen, setIsCorteXOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isRepairPriceCatalogOpen, setIsRepairPriceCatalogOpen] = useState(false);

  // Shared Data States synced with Firebase Firestore
  const [products, setProducts] = useState<Product[]>(() => loadCachedProducts(INITIAL_PRODUCTS));
  const [repairPrices, setRepairPrices] = useState<RepairPriceItem[]>(INITIAL_REPAIR_PRICES);
  const [salesTickets, setSalesTickets] = useState<SaleTicket[]>(() => loadCachedList<SaleTicket>('sales'));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadCachedList<Expense>('expenses'));
  const [cortesX, setCortesX] = useState<CorteXRecord[]>(() => loadCachedList<CorteXRecord>('cortes'));
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [branchCashFunds, setBranchCashFunds] = useState<Record<string, number>>({});
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [repairRecords, setRepairRecords] = useState<RepairRecord[]>(() =>
    loadCachedList<RepairRecord>('repairs')
  );
  const [repairsCloudReady, setRepairsCloudReady] = useState(false);
  const [activeCashSession, setActiveCashSession] = useState<SesionCaja | null>(null);
  const [cloudSynced, setCloudSynced] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [tillLocked, setTillLocked] = useState(false);
  const [nightClosing, setNightClosing] = useState(false);
  const [historyBusy, setHistoryBusy] = useState<string | null>(null);
  const [salesHasMore, setSalesHasMore] = useState(true);
  const [expensesHasMore, setExpensesHasMore] = useState(true);
  const [cortesHasMore, setCortesHasMore] = useState(true);
  const [movementsHasMore, setMovementsHasMore] = useState(true);
  const [repairsHasMore, setRepairsHasMore] = useState(true);
  const corteInFlightRef = useRef(false);
  const saleInFlightIdsRef = useRef(new Set<string>());
  const loggedInAtRef = useRef(Date.now());
  const nightCloseRanRef = useRef(false);
  const salesTicketsRef = useRef(salesTickets);
  const expensesRef = useRef(expenses);
  const cortesRef = useRef(cortesX);
  /** Lo capturado en este equipo que la nube todavía no confirma. */
  const localOnlyRef = useRef<{
    sales: SaleTicket[];
    expenses: Expense[];
    cortes: CorteXRecord[];
    repairs: RepairRecord[];
  }>({
    sales: [],
    expenses: [],
    cortes: [],
    repairs: []
  });
  const cloudRepairIdsRef = useRef<Set<string> | null>(null);
  const rescuedRepairIdsRef = useRef(new Set<string>());
  salesTicketsRef.current = salesTickets;
  expensesRef.current = expenses;
  cortesRef.current = cortesX;

  const markCloudDown = (message?: string) => {
    setCloudSynced(false);
    setSessionError(
      message ||
        'No hay conexión con la nube en este momento. El catálogo y las ventas de este equipo no se borraron. El corte se puede guardar aquí y se sube cuando vuelva la conexión.'
    );
  };

  // -----------------------------------------------------------
  // Real-time Firestore Subscriptions
  // -----------------------------------------------------------
  useEffect(() => {
    const unsubProducts = subscribeToProducts(
      (prods) => {
        if (prods && prods.length > 0) {
          const byId = new Map(prods.map((p) => [p.id, p]));
          INITIAL_PRODUCTS.forEach((p) => {
            if (!byId.has(p.id)) byId.set(p.id, p);
          });
          const next = Array.from(byId.values());
          setProducts(next);
          scheduleSaveCachedList('products', next);
          setCloudSynced(true);
        }
      },
      () => markCloudDown()
    );

    const unsubSales = subscribeToSales(
      (sales) => {
        setSalesTickets((prev) => {
          const fromCloud = keepIfCloudEmpty(sales, prev);
          const next = sortByTimestampDesc(
            mergeWithLocal(mergeByIdKeep(prev, fromCloud), localOnlyRef.current.sales)
          );
          scheduleSaveCachedList('sales', next);
          return next;
        });
        if (sales.length < LIVE_LIMIT.sales) setSalesHasMore(false);
      },
      () => markCloudDown()
    );

    const unsubExpenses = subscribeToExpenses(
      (exps) => {
        setExpenses((prev) => {
          const fromCloud = keepIfCloudEmpty(exps, prev);
          const next = sortByTimestampDesc(
            mergeWithLocal(mergeByIdKeep(prev, fromCloud), localOnlyRef.current.expenses)
          );
          scheduleSaveCachedList('expenses', next);
          return next;
        });
        if (exps.length < LIVE_LIMIT.expenses) setExpensesHasMore(false);
      },
      () => markCloudDown()
    );

    const unsubRepairPrices = subscribeToRepairPrices((prices) => {
      if (prices && prices.length > 0) {
        setRepairPrices(prices);
      }
    });

    const unsubCortes = subscribeToCortesX(
      (cortes) => {
        setCortesX((prev) => {
          const fromCloud = keepIfCloudEmpty(cortes, prev);
          const next = sortByTimestampDesc(
            mergeWithLocal(mergeByIdKeep(prev, fromCloud), localOnlyRef.current.cortes)
          );
          scheduleSaveCachedList('cortes', next);
          return next;
        });
        if (cortes.length < LIVE_LIMIT.cortes) setCortesHasMore(false);
      },
      () => markCloudDown()
    );

    const unsubNotifs = subscribeToNotifications((notifs) => {
      setNotifications(Array.isArray(notifs) ? notifs : []);
    });

    const unsubMovements = subscribeToInventoryMovements((movs) => {
      setInventoryMovements((prev) => mergeByIdKeep(prev, movs));
      if (movs.length < LIVE_LIMIT.movements) setMovementsHasMore(false);
    });

    const unsubFunds = subscribeToBranchFunds((funds) => {
      if (funds && typeof funds === 'object') {
        setBranchCashFunds(funds);
      }
    });
    void ensureBranchFundsZeroedOnce();

    const unsubCredits = subscribeToCreditAccounts((accounts) => {
      setCreditAccounts(accounts || []);
    });

    const unsubRepairs = subscribeToRepairRecords(
      (records) => {
        if (Array.isArray(records)) {
          cloudRepairIdsRef.current = new Set(records.map((r) => r.id));
          setRepairsCloudReady(true);
        }
        setRepairRecords((prev) => {
          const fromCloud = keepIfCloudEmpty(records, prev);
          const next = mergeRepairSources(
            loadLegacyRepairRecords(),
            prev,
            localOnlyRef.current.repairs,
            fromCloud
          );
          scheduleSaveCachedList('repairs', next);
          return next;
        });
      },
      () => markCloudDown()
    );

    return () => {
      unsubProducts();
      unsubSales();
      unsubExpenses();
      unsubRepairPrices();
      unsubCortes();
      unsubNotifs();
      unsubMovements();
      unsubFunds();
      unsubCredits();
      unsubRepairs();
    };
  }, []);

  const loadOlderSales = useCallback(async () => {
    if (historyBusy) return;
    const before = oldestTimestamp(salesTicketsRef.current, 'timestamp');
    if (!before) {
      setSalesHasMore(false);
      return;
    }
    setHistoryBusy('sales');
    try {
      const extra = await fetchOlderSales(before, HISTORY_PAGE);
      if (extra.length < HISTORY_PAGE) setSalesHasMore(false);
      if (extra.length > 0) {
        setSalesTickets((prev) => {
          const next = sortByTimestampDesc(mergeByIdKeep(prev, extra));
          scheduleSaveCachedList('sales', next);
          return next;
        });
      }
    } catch (err) {
      console.warn('[Historial] ventas:', err);
    } finally {
      setHistoryBusy(null);
    }
  }, [historyBusy]);

  const loadOlderExpenses = useCallback(async () => {
    if (historyBusy) return;
    const before = oldestTimestamp(expensesRef.current, 'timestamp');
    if (!before) {
      setExpensesHasMore(false);
      return;
    }
    setHistoryBusy('expenses');
    try {
      const extra = await fetchOlderExpenses(before, HISTORY_PAGE);
      if (extra.length < HISTORY_PAGE) setExpensesHasMore(false);
      if (extra.length > 0) {
        setExpenses((prev) => {
          const next = sortByTimestampDesc(mergeByIdKeep(prev, extra));
          scheduleSaveCachedList('expenses', next);
          return next;
        });
      }
    } catch (err) {
      console.warn('[Historial] gastos:', err);
    } finally {
      setHistoryBusy(null);
    }
  }, [historyBusy]);

  const loadOlderCortes = useCallback(async () => {
    if (historyBusy) return;
    const before = oldestTimestamp(cortesRef.current, 'timestamp');
    if (!before) {
      setCortesHasMore(false);
      return;
    }
    setHistoryBusy('cortes');
    try {
      const extra = await fetchOlderCortes(before, HISTORY_PAGE);
      if (extra.length < HISTORY_PAGE) setCortesHasMore(false);
      if (extra.length > 0) {
        setCortesX((prev) => {
          const next = sortByTimestampDesc(mergeByIdKeep(prev, extra));
          scheduleSaveCachedList('cortes', next);
          return next;
        });
      }
    } catch (err) {
      console.warn('[Historial] cortes:', err);
    } finally {
      setHistoryBusy(null);
    }
  }, [historyBusy]);

  const loadOlderMovements = useCallback(async () => {
    if (historyBusy) return;
    const before = oldestTimestamp(inventoryMovements, 'timestamp');
    if (!before) {
      setMovementsHasMore(false);
      return;
    }
    setHistoryBusy('movements');
    try {
      const extra = await fetchOlderInventoryMovements(before, HISTORY_PAGE);
      if (extra.length < HISTORY_PAGE) setMovementsHasMore(false);
      if (extra.length > 0) {
        setInventoryMovements((prev) => mergeByIdKeep(prev, extra));
      }
    } catch (err) {
      console.warn('[Historial] kardex:', err);
    } finally {
      setHistoryBusy(null);
    }
  }, [historyBusy, inventoryMovements]);

  const loadOlderRepairs = useCallback(async () => {
    if (historyBusy) return;
    const before = oldestTimestamp(
      repairRecords.map((r) => ({ id: r.id, receivedAtIso: r.receivedAtIso || r.receivedAt || '' })),
      'receivedAtIso'
    );
    if (!before) {
      setRepairsHasMore(false);
      return;
    }
    setHistoryBusy('repairs');
    try {
      const extra = await fetchOlderRepairRecords(before, HISTORY_PAGE);
      if (extra.length < HISTORY_PAGE) setRepairsHasMore(false);
      if (extra.length > 0) {
        setRepairRecords((prev) => {
          const next = mergeRepairSources(prev, extra);
          scheduleSaveCachedList('repairs', next);
          return next;
        });
      }
    } catch (err) {
      console.warn('[Historial] taller:', err);
    } finally {
      setHistoryBusy(null);
    }
  }, [historyBusy, repairRecords]);

  const handleModuleChange = useCallback((id: ModuleId) => {
    if (!canOpenModule(currentOperator.role, id)) return;
    startTransition(() => setActiveModule(id));
  }, [currentOperator.role]);

  // Cola de envío: lo capturado aquí sube solo, en orden y con reintentos.
  useEffect(() => startOutboxWorker(), []);

  // Folios apartados por adelantado: sin esto, una caja que pierde la red
  // tendría que emitir folios provisionales.
  useEffect(() => {
    if (!hasCashTill(currentBranch.id)) return;
    const warm = (immediate = false) => {
      if (immediate) clearFolioLeaseCooldown();
      void warmUpFolios(currentBranch.id).catch((err) =>
        console.warn('[Folios] No se pudo apartar el bloque de folios:', err)
      );
    };
    warm();
    const interval = window.setInterval(() => warm(), 5 * 60 * 1000);
    const onOnline = () => warm(true);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
    };
  }, [currentBranch.id]);

  // Al abrir, recuperamos del disco lo que este equipo alcanzó a guardar.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const [sales, exps, cortes, repairs] = await Promise.all([
          localSales(),
          localExpenses(),
          localCortes(),
          localRepairs()
        ]);
        if (cancelled) return;
        localOnlyRef.current = { sales, expenses: exps, cortes, repairs };
        const legacy = loadLegacyRepairRecords();
        if (repairs.length > 0 || legacy.length > 0) {
          setRepairRecords((prev) => {
            const next = mergeRepairSources(legacy, repairs, prev);
            saveCachedList('repairs', next);
            return next;
          });
        }
        if (sales.length > 0) {
          setSalesTickets((prev) => sortByTimestampDesc(mergeWithLocal(prev, sales)));
        }
        if (exps.length > 0) {
          setExpenses((prev) => sortByTimestampDesc(mergeWithLocal(prev, exps)));
        }
        if (cortes.length > 0) {
          setCortesX((prev) => sortByTimestampDesc(mergeWithLocal(prev, cortes)));
        }
        void pruneOldLocalRecords().catch((err) =>
          console.warn('[Local] No se pudo limpiar el historial viejo:', err)
        );
      } catch (err) {
        console.warn('[Local] No se pudo leer el respaldo del equipo:', err);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cortes que quedaron pendientes con el esquema anterior pasan a la cola.
  useEffect(() => {
    let cancelled = false;
    const migrateAndRecover = async () => {
      for (const item of loadAllPendingCortes()) {
        if (cancelled) return;
        try {
          await commitCorte(
            {
              id: item.preferredSessionId || `${item.branchId}-${item.dateKey}`,
              timestamp: item.fechaCierreIso,
              dateStr: item.dateKey,
              timeStr: '',
              branchId: item.branchId,
              branchName: item.branchName,
              operatorName: item.operatorName,
              initialCashFund: 0,
              cashSales: 0,
              cardSales: 0,
              transferSales: 0,
              totalSales: 0,
              totalExpenses: 0,
              netIncome: 0,
              expectedCashInDrawer: item.efectivoContado,
              ticketIds: item.tickets.map((t) => t.id),
              expenseIds: item.expenses.map((e) => e.id),
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
              branchId: item.branchId,
              branchName: item.branchName,
              operatorUid: item.operatorUid || currentOperator.id,
              operatorName: item.operatorName || currentOperator.name,
              efectivoContado: item.efectivoContado,
              fondoDejado: item.fondoDejado,
              notas: item.notas,
              fechaCierreIso: item.fechaCierreIso,
              preferredSessionId: item.preferredSessionId,
              dateKey: item.dateKey,
              ticketsSnapshot: item.tickets,
              expensesSnapshot: item.expenses
            }
          );
          removePendingCorte(item.branchId, item.dateKey);
        } catch (err) {
          console.warn('[CorteX] No se pudo migrar el corte pendiente:', err);
        }
      }

      try {
        await recoverMissingDailyCortes({
          operatorUid: currentOperator.id,
          operatorName: currentOperator.name,
          ticketsSnapshot: salesTicketsRef.current,
          expensesSnapshot: expensesRef.current
        });
      } catch (err) {
        console.warn('[CorteX] Recuperación de cortes del día:', err);
      }
    };
    void migrateAndRecover();
    return () => {
      cancelled = true;
    };
  }, [currentOperator.id, currentOperator.name]);

  // Respaldo del día: se rearma solo conforme entran ventas y gastos.
  useEffect(() => {
    if (!hasCashTill(currentBranch.id)) return;
    const run = () => {
      void ensureDailyBackup({
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        tickets: salesTicketsRef.current,
        expenses: expensesRef.current,
        cortes: cortesRef.current
      }).catch((err) => console.warn('[Respaldo] No se pudo guardar el respaldo del día:', err));
    };
    const timer = window.setTimeout(run, 4000);
    const interval = window.setInterval(run, 120_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [currentBranch.id, currentBranch.name]);

  const isAdmin = normalizeRole(currentOperator.role) === 'admin';

  useEffect(() => {
    if (!hasCashTill(currentBranch.id)) {
      setActiveCashSession(null);
      setSessionError(null);
      setTillLocked(false);
      return;
    }

    let cancelled = false;
    const applySync = async () => {
      try {
        const result = await syncPosCashSession({
          branchId: currentBranch.id,
          branchName: currentBranch.name,
          operatorUid: currentOperator.id,
          operatorName: currentOperator.name,
          initialFund: branchCashFunds[currentBranch.id] ?? 0,
          ticketsSnapshot: salesTicketsRef.current,
          expensesSnapshot: expensesRef.current
        });
        if (cancelled) return;
        setActiveCashSession(result.session);
        rememberLastSession(currentBranch.id, result.session);
        void warmUpFolios(currentBranch.id);
        setTillLocked(result.tillLocked);
        if (result.closeFailed) {
          setSessionError(
            'La caja ya no cobra ventas después de las 11:00 p.m., pero el corte aún no se guardó en la nube. Abra Corte y ciérrelo; no se vaya hasta ver “corte guardado”.'
          );
        } else if (result.tillLocked) {
          setSessionError(
            'Caja cerrada a las 11:00 p.m. El siguiente turno abre después de medianoche.'
          );
        } else {
          setSessionError(null);
        }
      } catch (err) {
        console.error('Error loading cash session:', err);
        if (!cancelled) {
          markCloudDown(
            'No se pudo conectar el turno de caja con la nube. Las ventas de este equipo siguen aquí. No cobre más hasta ver el turno, pero sí puede intentar cerrar el corte.'
          );
        }
      }
    };

    const unsub = subscribeToOpenCashSession(
      currentBranch.id,
      (ses) => {
        if (cancelled) return;
        if (ses && ses.estado === 'ABIERTA' && !sessionNeedsAutomaticCorte(ses) && canOpenNewCashSession()) {
          setActiveCashSession(ses);
          setTillLocked(false);
          setSessionError(null);
          return;
        }
        void applySync();
      },
      (err) => {
        console.error('Error subscribing to cash session:', err);
        if (!cancelled) setCloudSynced(false);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentBranch.id, currentBranch.name, currentOperator.id, currentOperator.name]);

  useEffect(() => {
    const runNightClose = async () => {
      if (nightCloseRanRef.current) return;
      if (!loggedInBeforeCashClose(loggedInAtRef.current)) return;

      nightCloseRanRef.current = true;
      setNightClosing(true);
      try {
        if (hasCashTill(currentBranch.id)) {
          const due = await closeCashSessionIfDue({
            branchId: currentBranch.id,
            branchName: currentBranch.name,
            operatorUid: currentOperator.id,
            operatorName: currentOperator.name,
            initialFund: branchCashFunds[currentBranch.id] ?? 0,
            ticketsSnapshot: salesTicketsRef.current,
            expensesSnapshot: expensesRef.current
          });
          const unstampedTickets = salesTicketsRef.current.filter(
            (t) =>
              normalizeBranchId(t.branchId) === normalizeBranchId(currentBranch.id) &&
              !t.corteXId &&
              hermosilloDateKey(t.timestamp) === getHermosilloClock().dateKey
          );
          if (!due.closed && (due.session?.estado === 'ABIERTA' || unstampedTickets.length > 0)) {
            await closeOpenShiftForBranch({
              branchId: currentBranch.id,
              branchName: currentBranch.name,
              operatorUid: currentOperator.id,
              operatorName: currentOperator.name,
              ticketsSnapshot: salesTicketsRef.current,
              expensesSnapshot: expensesRef.current,
              preferredSessionId: due.session?.id || activeCashSession?.id,
              notas: 'Cierre automático 23:00 (hora Sonora). Efectivo contado = esperado porque no hubo arqueo en mostrador.',
              persistOperatorFund: false,
              createIfMissing: unstampedTickets.length > 0
            });
          }
        }
      } catch (err) {
        console.error('Error en cierre automático 23:00:', err);
        const dateKey = getHermosilloClock().dateKey;
        const branchTicketsToday = salesTicketsRef.current.filter(
          (t) =>
            normalizeBranchId(t.branchId) === normalizeBranchId(currentBranch.id) &&
            hermosilloDateKey(t.timestamp) === dateKey
        );
        await enqueue({
          kind: 'corteClose',
          groupKey: normalizeBranchId(currentBranch.id),
          id: `corte-${normalizeBranchId(currentBranch.id)}-${dateKey}`,
          label: `Cierre 11 p.m. ${currentBranch.name} ${dateKey}`,
          payload: {
            branchId: currentBranch.id,
            branchName: currentBranch.name,
            operatorUid: currentOperator.id,
            operatorName: currentOperator.name,
            fondoDejado: branchCashFunds[currentBranch.id] ?? 0,
            persistOperatorFund: false,
            notas: 'Cierre automático 23:00 (hora Sonora). Se reintenta desde la cola del equipo.',
            fechaCierreIso: `${dateKey}T23:00:00-07:00`,
            preferredSessionId: activeCashSession?.id,
            dateKey,
            // Sin ventas ni turno que cerrar, no inventamos un corte vacío.
            createIfMissing: branchTicketsToday.length > 0,
            ticketsSnapshot: salesTicketsRef.current.filter(
              (t) => normalizeBranchId(t.branchId) === normalizeBranchId(currentBranch.id)
            ),
            expensesSnapshot: expensesRef.current.filter(
              (e) => normalizeBranchId(e.branchId) === normalizeBranchId(currentBranch.id)
            )
          }
        });
        nightCloseRanRef.current = false;
        setNightClosing(false);
        setSessionError(
          'No se pudo guardar el corte de las 11:00 p.m. en la nube. No cierre esta ventana: abra Corte y ciérrelo. El siguiente intento se hará solo.'
        );
        return;
      }
      window.setTimeout(() => onLogout(), 1400);
    };

    const interval = window.setInterval(() => {
      void runNightClose();
    }, 20_000);
    const timeout = window.setTimeout(() => {
      void runNightClose();
    }, msUntilCashClose());
    void runNightClose();

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [currentBranch.id, currentBranch.name, currentOperator.id, currentOperator.name, onLogout]);

  useEffect(() => {
    if (!canOpenModule(currentOperator.role, activeModule)) {
      setActiveModule(defaultModuleForRole(currentOperator.role));
    }
  }, [currentOperator.role, activeModule]);

  // Inventory Movement Recording Helper
  const handleRecordInventoryMovement = (movementData: Omit<InventoryMovement, 'id' | 'timestamp'> | InventoryMovement) => {
    const newMovement: InventoryMovement = {
      ...movementData,
      id: (movementData as any).id || `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: (movementData as any).timestamp || new Date().toISOString()
    };

    setInventoryMovements((prev) => [newMovement, ...prev]);
    saveInventoryMovementToFirestore(newMovement).catch((err) =>
      console.error('Error saving inventory movement to Firestore:', err)
    );
  };

  // Repair Price Catalog Handlers
  const handleAddRepairPrice = (newItem: RepairPriceItem) => {
    setRepairPrices((prev) => [newItem, ...prev]);
    saveRepairPriceToFirestore(newItem).catch((err) => console.error('Error saving repair price:', err));
  };

  const handleUpdateRepairPrice = (updatedItem: RepairPriceItem) => {
    setRepairPrices((prev) => prev.map((p) => (p.id === updatedItem.id ? updatedItem : p)));
    saveRepairPriceToFirestore(updatedItem).catch((err) => console.error('Error updating repair price:', err));
  };

  const handleDeleteRepairPrice = (id: string) => {
    setRepairPrices((prev) => prev.filter((p) => p.id !== id));
    deleteRepairPriceFromFirestore(id).catch((err) => console.error('Error deleting repair price:', err));
  };

  // Complete Sale Handler (Deducts stock & records ticket with strict IMEI removal, inventory movement log and Firestore Sync)
  const handleCompleteSale = async (ticket: SaleTicket): Promise<SaleTicket | void> => {
    if (saleInFlightIdsRef.current.has(ticket.id)) {
      return;
    }
    saleInFlightIdsRef.current.add(ticket.id);

    try {
      if (isAfterCashClose() && ticket.branchId !== 'b-bodega') {
        await closeCashSessionIfDue({
          branchId: ticket.branchId,
          branchName: currentBranch.name,
          operatorUid: currentOperator.id,
          operatorName: currentOperator.name,
          initialFund: branchCashFunds[ticket.branchId] ?? 0
        });
        throw new CashTillLockedError();
      }

      if (await saleAlreadyCommitted(ticket.id)) {
        return;
      }

      let session = activeCashSession;
      if (
        (!session || session.sucursal_id !== ticket.branchId || session.estado !== 'ABIERTA') &&
        ticket.branchId !== 'b-bodega'
      ) {
        try {
          session = await getActiveCashSession(
            ticket.branchId,
            currentBranch.name,
            currentOperator.name,
            branchCashFunds[ticket.branchId] ?? 0,
            currentOperator.id
          );
          setActiveCashSession(session);
        } catch (sessionErr) {
          if (sessionErr instanceof CashTillLockedError) throw sessionErr;
          // Sin nube seguimos cobrando: el turno se resuelve al subir la venta.
          console.warn('Turno no confirmado en la nube; la venta se guarda en el equipo.', sessionErr);
        }
      }

      const enrichedTicket: SaleTicket = {
        ...ticket,
        total: money(Number(ticket.total) || 0),
        folio: ticket.folio,
        sucursal_id: ticket.branchId,
        sesion_caja_id: session?.id || ticket.sesion_caja_id
      };
      if (!enrichedTicket.folio) {
        enrichedTicket.folio = await allocateFolio(enrichedTicket.branchId, enrichedTicket.timestamp);
      }

      await commitSale(enrichedTicket);
      localOnlyRef.current.sales = [
        enrichedTicket,
        ...localOnlyRef.current.sales.filter((t) => t.id !== enrichedTicket.id)
      ];
      setSalesTickets((prev) => {
        const next = [enrichedTicket, ...prev.filter((t) => t.id !== enrichedTicket.id)];
        saveCachedList('sales', next);
        return next;
      });
      observeTrustedIso(enrichedTicket.timestamp);
      if (session) rememberLastSession(ticket.branchId, session);

    const branchName = ALL_BRANCHES.find((b) => b.id === enrichedTicket.branchId)?.name || enrichedTicket.branchId;
    const saleMovements: InventoryMovement[] = [];
    const qtyByProduct = new Map<string, number>();
    const imeisByProduct = new Map<string, string[]>();

    enrichedTicket.items.forEach((item) => {
      if (isNonInventorySaleItem(item)) return;
      const catalog = products.find((p) => p.id === item.product.id)
        || products.find((p) => item.metadata?.imei && (
          p.imeiList?.some((im) => im.toUpperCase() === item.metadata!.imei!.toUpperCase())
          || p.imei?.toUpperCase() === item.metadata!.imei!.toUpperCase()
          || Object.values(p.branchImeiMap || {}).some((list) => list.some((im) => im.toUpperCase() === item.metadata!.imei!.toUpperCase()))
        ));
      const prod = catalog || item.product;
      const prodId = prod.id;
      qtyByProduct.set(prodId, (qtyByProduct.get(prodId) || 0) + (item.quantity || 1));
      if (item.metadata?.imei) {
        imeisByProduct.set(prodId, [...(imeisByProduct.get(prodId) || []), item.metadata.imei]);
      }

      saleMovements.push({
        id: newUniqueId('mov'),
        timestamp: new Date().toISOString(),
        type: 'venta',
        productId: prodId,
        productCode: prod.code || 'S/C',
        productName: catalog?.name || prod.name || 'Artículo',
        category: prod.category,
        inventoryType: prod.inventoryType,
        quantity: -(item.quantity || 1),
        targetBranchId: enrichedTicket.branchId,
        targetBranchName: branchName,
        operatorName: enrichedTicket.operatorName || currentOperator.name,
        operatorId: currentOperator.id,
        ticketId: enrichedTicket.folio || enrichedTicket.id,
        unitPrice: item.unitPrice,
        details: `Venta POS en Ticket #${enrichedTicket.folio || enrichedTicket.id}: ${item.quantity} pza(s) en ${branchName}`,
        imeis: item.metadata?.imei ? [item.metadata.imei] : undefined
      });
    });

    if (saleMovements.length > 0) {
      setInventoryMovements((prev) => [...saleMovements, ...prev]);
      commitInventoryMovements(saleMovements).catch((err) =>
        console.error('Error encolando movimientos de inventario:', err)
      );
    }

    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const qty = qtyByProduct.get(p.id) || 0;
        const soldImeis = (imeisByProduct.get(p.id) || []).map((im) => im.toUpperCase());
        if (qty <= 0 && soldImeis.length === 0) return p;

        const currentBStock = p.branchStock || { 'b-bodega': 0, 'b-navojoa': 0, 'b-huatabampo': 0 };
        const currentBranchQty = currentBStock[enrichedTicket.branchId] || 0;
        const deductQty = qty || soldImeis.length;
        const newBranchQty = Math.max(0, currentBranchQty - deductQty);
        const newBranchStock = { ...currentBStock, [enrichedTicket.branchId]: newBranchQty };
        const newTotalStock = Math.max(0, (p.stock || 0) - deductQty);

        let updatedImeiMap = p.branchImeiMap ? { ...p.branchImeiMap } : {};
        if (soldImeis.length > 0) {
          const currentList = updatedImeiMap[enrichedTicket.branchId] || [];
          updatedImeiMap[enrichedTicket.branchId] = currentList.filter((im) => !soldImeis.includes(im.toUpperCase()));
        }

        const updatedImeiList = p.imeiList
          ? (soldImeis.length ? p.imeiList.filter((im) => !soldImeis.includes(im.toUpperCase())) : p.imeiList)
          : undefined;

        const updatedProduct: Product = {
          ...p,
          stock: newTotalStock,
          branchStock: newBranchStock,
          branchImeiMap: Object.keys(updatedImeiMap).length > 0 ? updatedImeiMap : p.branchImeiMap,
          imeiList: updatedImeiList,
          imei: updatedImeiList && updatedImeiList.length > 0
            ? updatedImeiList[0]
            : (p.imei && soldImeis.includes(p.imei.toUpperCase()) ? '' : p.imei)
        };

        commitProduct(updatedProduct).catch((err) =>
          console.error('Error encolando el descuento de inventario:', err)
        );
        return updatedProduct;
      })
    );

    const nowIso = new Date().toISOString();
    for (const item of enrichedTicket.items) {
      const meta = item.metadata;
      if (meta?.saleType === 'credito' && (meta.remainingBalance || 0) > 0 && meta.imei) {
        const account: CreditAccount = {
          id: newUniqueId('cred'),
          clientName: meta.clientName || 'Cliente',
          clientPhone: meta.clientPhone,
          imei: meta.imei,
          deviceModel: meta.deviceModel || item.product.name,
          fullPrice: money(meta.fullPrice || 0),
          downPayment: money(meta.downPayment || item.totalPrice || 0),
          remainingBalance: money(meta.remainingBalance || 0),
          financingPlatform: meta.financingPlatform || 'Crédito',
          branchId: enrichedTicket.branchId,
          branchName,
          operatorName: enrichedTicket.operatorName,
          originTicketId: enrichedTicket.id,
          status: 'activo',
          createdAt: nowIso,
          updatedAt: nowIso
        };
        setCreditAccounts((prev) => [account, ...prev]);
        saveCreditAccountToFirestore(account).catch((err) => console.error('Error saving credit account:', err));
      }

      // El equipo se marca entregado solo cuando el saldo quedó cobrado.
      if (meta?.repairId && meta.repairType === 'saldo_final') {
        const pending = repairRecords.find((r) => r.id === meta.repairId);
        if (pending && pending.status !== 'entregado') {
          void persistRepairRecord({
            ...pending,
            status: 'entregado',
            pendingBalance: 0,
            deliveredAt: safeFormatDate(nowIso) + ' ' + safeFormatTime(nowIso),
            deliveredAtIso: nowIso,
            deliveredByName: currentOperator.name,
            deliveryTicketId: enrichedTicket.folio || enrichedTicket.id
          }).catch((err) => console.error('Error marcando la entrega del equipo:', err));
        }
      }

      if (meta?.saleType === 'abono' && meta.creditAccountId) {
        applyCreditAbonoToAccount(meta.creditAccountId, item.totalPrice || item.unitPrice || 0)
          .then((updated) => {
            if (!updated) return;
            setCreditAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          })
          .catch((err) => console.error('Error applying credit payment:', err));
      }
    }

    return enrichedTicket;
    } catch (err) {
      console.error('Error completing sale:', err);
      throw err instanceof Error
        ? err
        : new Error('No se pudo guardar la venta. El ticket sigue en pantalla; inténtalo de nuevo.');
    } finally {
      saleInFlightIdsRef.current.delete(ticket.id);
    }
  };

  const handleDeleteSaleTicket = async (ticket: SaleTicket | string, reason?: string) => {
    const ticketId = typeof ticket === 'string' ? ticket : ticket.id;
    setSalesTickets((prev) => prev.filter((t) => t.id !== ticketId));
    // Sin esto el ticket cancelado reaparecía al recargar, desde el respaldo local.
    localOnlyRef.current.sales = localOnlyRef.current.sales.filter((t) => t.id !== ticketId);
    await forgetLocalSale(ticketId);
    await deleteSaleTicketFromFirestore(ticket, {
      reason: reason || 'Error de captura de operador',
      operatorName: currentOperator.name
    });
  };

  /** Guarda el equipo en taller en este aparato y lo encola para la nube. */
  const persistRepairRecord = async (record: RepairRecord): Promise<RepairRecord> => {
    const saved = await commitRepairRecord(record);
    localOnlyRef.current.repairs = [
      saved,
      ...localOnlyRef.current.repairs.filter((r) => r.id !== saved.id)
    ];
    setRepairRecords((prev) => {
      const next = [saved, ...prev.filter((r) => r.id !== saved.id)];
      saveCachedList('repairs', next);
      return next;
    });
    return saved;
  };

  useEffect(() => {
    const inferred = inferRepairsFromTickets(salesTickets);
    if (inferred.length === 0) return;

    setRepairRecords((prev) => {
      const next = mergeRepairSources(inferred, prev);
      const prevIds = new Set(prev.map((r) => r.id));
      if (next.length === prev.length && next.every((r) => prevIds.has(r.id))) return prev;
      saveCachedList('repairs', next);
      return next;
    });

    if (!repairsCloudReady) return;
    const cloudIds = cloudRepairIdsRef.current;
    if (!cloudIds) return;
    inferred.forEach((rec) => {
      if (!isPendingRepair(rec)) return;
      if (cloudIds.has(rec.id) || rescuedRepairIdsRef.current.has(rec.id)) return;
      rescuedRepairIdsRef.current.add(rec.id);
      void persistRepairRecord(rec).catch((err) =>
        console.warn('[Taller] No se pudo rescatar la ficha', rec.id, err)
      );
    });
  }, [salesTickets, repairsCloudReady]);

  const handleAddRepairRecord = async (record: RepairRecord) => {
    await persistRepairRecord(record);
  };

  const handleUpdateRepairRecord = async (record: RepairRecord) => {
    await persistRepairRecord(record);
  };

  /**
   * Baja de un registro de taller. Se conserva como cancelado para que quede
   * constancia de quién lo dio de baja y por qué.
   */
  const handleCancelRepairRecord = async (record: RepairRecord, reason: string) => {
    await persistRepairRecord({
      ...record,
      status: 'cancelado',
      cancelledAt: trustedIso(),
      cancelledByName: currentOperator.name,
      cancelReason: reason.trim() || 'Sin motivo capturado'
    });
  };

  // Add Expense Handler
  const handleAddExpense = async (expense: Expense) => {
    if (isAfterCashClose() && expense.branchId !== 'b-bodega') {
      setSessionError('La caja ya cerró a las 11:00 p.m. No se registran gastos en este turno.');
      return;
    }
    let activeSessionId = expense.sesion_caja_id || activeCashSession?.id;
    if (!activeSessionId && expense.branchId !== 'b-bodega') {
      try {
        const activeSes = await getActiveCashSession(
          expense.branchId,
          currentBranch.name,
          currentOperator.name,
          branchCashFunds[expense.branchId] ?? 0,
          currentOperator.id
        );
        activeSessionId = activeSes.id;
        setActiveCashSession(activeSes);
      } catch {}
    }

    const enrichedExpense: Expense = {
      ...expense,
      sucursal_id: expense.branchId,
      sesion_caja_id: activeSessionId || expense.sesion_caja_id
    };

    await commitExpense(enrichedExpense);
    localOnlyRef.current.expenses = [
      enrichedExpense,
      ...localOnlyRef.current.expenses.filter((e) => e.id !== enrichedExpense.id)
    ];
    setExpenses((prev) => {
      const next = [enrichedExpense, ...prev.filter((e) => e.id !== enrichedExpense.id)];
      saveCachedList('expenses', next);
      return next;
    });
  };

  // Inventory Handlers
  const handleAddProduct = (newProd: Product) => {
    setProducts((prev) => {
      // Check if product with this ID or Code already exists
      const existingIdx = prev.findIndex(p => p.id === newProd.id || p.code.trim().toUpperCase() === newProd.code.trim().toUpperCase());
      if (existingIdx !== -1) {
        const updatedList = [...prev];
        updatedList[existingIdx] = { ...prev[existingIdx], ...newProd };
        return updatedList;
      }
      return [...prev, newProd];
    });
    commitProduct(newProd).catch((err) => console.error('Error encolando el producto nuevo:', err));
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProd.id ? updatedProd : p)));
    commitProduct(updatedProd).catch((err) => console.error('Error encolando el cambio de producto:', err));
  };

  const handleReceivePurchase = async (draft: PurchaseDraft) => {
    if (draft.inventoryApplied) return;
    const targetBranchId = 'b-bodega';
    const targetBranchName = getBranchDisplayName(targetBranchId);
    draft.items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return;
      const code = (item.code || '').trim().toUpperCase();
      const name = (item.productName || '').trim().toLowerCase();
      const prod = products.find((p) => {
        if (code && (p.code || '').trim().toUpperCase() === code) return true;
        return name && (p.name || '').trim().toLowerCase() === name;
      });
      if (!prod) return;
      const branchStock = { ...(prod.branchStock || {}) };
      branchStock[targetBranchId] = money((Number(branchStock[targetBranchId]) || 0) + qty);
      const newTotal =
        (branchStock['b-bodega'] || 0) + (branchStock['b-navojoa'] || 0) + (branchStock['b-huatabampo'] || 0);
      const updated: Product = {
        ...prod,
        branchStock,
        stock: newTotal,
        costPrice: item.wholesalePrice > 0 ? money(item.wholesalePrice) : prod.costPrice
      };
      handleUpdateProduct(updated);
      handleRecordInventoryMovement({
        type: 'ingreso',
        productId: prod.id,
        productCode: prod.code || item.code || 'S/C',
        productName: prod.name,
        category: prod.category,
        inventoryType: prod.inventoryType,
        quantity: qty,
        previousStock: prod.stock,
        newStock: newTotal,
        targetBranchId,
        targetBranchName,
        operatorName: currentOperator.name,
        operatorId: currentOperator.id,
        reason: 'Recepción de compra',
        details: `Pedido ${draft.title} · ${draft.supplierName} · +${qty} a ${targetBranchName}`
      });
    });
    const received: PurchaseDraft = {
      ...draft,
      status: 'recibido',
      inventoryApplied: true,
      receivedBranchId: targetBranchId,
      deliveredAt: draft.deliveredAt || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    await savePurchaseDraftToFirestore(received);
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    deleteProductFromFirestore(id).catch((err) => console.error('Error deleting product:', err));
  };

  // Finalize Corte X Handler (Saves snapshot, closes session and flags shift tickets/expenses as closed)
  const handleFinalizeCorteX = async (corteRecord: CorteXRecord) => {
    const targetBranchId = normalizeBranchId(corteRecord.branchId || currentBranch.id);
    const targetBranchName = corteRecord.branchName || getBranchDisplayName(targetBranchId);
    if (targetBranchId === 'b-bodega') {
      console.warn('[CorteX] Bodega no genera cortes de caja.');
      return;
    }
    if (corteInFlightRef.current) {
      return;
    }
    corteInFlightRef.current = true;

    const dateKey =
      hermosilloDateKey(corteRecord.timestamp) ||
      getHermosilloClock().dateKey;
    const preferredSessionId =
      corteRecord.sesion_caja_id ||
      (corteRecord.id && String(corteRecord.id).startsWith('SES-') ? corteRecord.id : undefined) ||
      (normalizeBranchId(currentBranch.id) === targetBranchId ? activeCashSession?.id : undefined);
    const counted = Number.isFinite(corteRecord.countedCash)
      ? Number(corteRecord.countedCash)
      : corteRecord.expectedCashInDrawer;
    const localTickets =
      corteRecord.ticketsSnapshot && corteRecord.ticketsSnapshot.length > 0
        ? corteRecord.ticketsSnapshot
        : salesTickets.filter((t) => normalizeBranchId(t.branchId || t.sucursal_id) === targetBranchId);
    const localExpenses =
      corteRecord.expensesSnapshot && corteRecord.expensesSnapshot.length > 0
        ? corteRecord.expensesSnapshot
        : expenses.filter((e) => normalizeBranchId(e.branchId) === targetBranchId);

    const closeParams = {
      branchId: targetBranchId,
      branchName: targetBranchName,
      operatorUid: currentOperator.id,
      operatorName: currentOperator.name,
      efectivoContado: counted,
      fondoDejado: corteRecord.cashFundLeftForNextShift ?? 0,
      notas: corteRecord.closingNotes || '',
      ticketsSnapshot: localTickets,
      expensesSnapshot: localExpenses,
      fechaCierreIso: corteRecord.timestamp,
      preferredSessionId,
      dateKey,
      initialFund: corteRecord.initialCashFund
    };

    try {
      // El corte queda guardado en el equipo y en la cola antes de tocar la red:
      // aunque la nube falle, el turno ya está cerrado y nada se pierde.
      const localCorte: CorteXRecord = {
        ...corteRecord,
        branchId: targetBranchId,
        branchName: targetBranchName,
        sesion_caja_id: preferredSessionId || corteRecord.sesion_caja_id,
        ticketsSnapshot: localTickets,
        expensesSnapshot: localExpenses
      };
      await commitCorte(localCorte, closeParams);
      localOnlyRef.current.cortes = [
        localCorte,
        ...localOnlyRef.current.cortes.filter((c) => c.id !== localCorte.id)
      ];
      setCortesX((prev) => {
        const next = [localCorte, ...prev.filter((c) => c.id !== localCorte.id)];
        saveCachedList('cortes', next);
        return next;
      });
      removePendingCorte(targetBranchId, dateKey);

      await ensureDailyBackup({
        branchId: targetBranchId,
        branchName: targetBranchName,
        dateKey,
        tickets: salesTicketsRef.current,
        expenses: expensesRef.current,
        cortes: [localCorte, ...cortesRef.current]
      });

      let savedCorte: CorteXRecord | null = null;
      let sessionId = preferredSessionId || localCorte.id;
      try {
        const result = await closeOpenShiftForBranch(closeParams);
        savedCorte = result.corteRecord || null;
        sessionId = result.sesion?.id || sessionId;
        if (savedCorte?.id) {
          const confirmed = savedCorte;
          localOnlyRef.current.cortes = localOnlyRef.current.cortes.filter(
            (c) => c.id !== confirmed.id && c.id !== localCorte.id
          );
          setCortesX((prev) => {
            const next = [confirmed, ...prev.filter((c) => c.id !== confirmed.id && c.id !== localCorte.id)];
            saveCachedList('cortes', next);
            return next;
          });
        }
      } catch (cloudErr) {
        console.warn('[CorteX] El corte quedó guardado aquí y subirá solo:', cloudErr);
        setSessionError(
          'El corte quedó guardado en este equipo. Se subirá a la nube en cuanto vuelva la conexión; no borre los datos del navegador.'
        );
      }

      const closedTicketIds = new Set(
        savedCorte?.ticketIds?.length ? savedCorte.ticketIds : localTickets.map((t) => t.id)
      );
      const closedExpenseIds = new Set(
        savedCorte?.expenseIds?.length ? savedCorte.expenseIds : localExpenses.map((e) => e.id)
      );
      setSalesTickets((prev) => {
        const next = prev.map((t) =>
          closedTicketIds.has(t.id)
            ? {
                ...t,
                corteXId: sessionId,
                sesion_caja_id: sessionId,
                corteXClosedAt: savedCorte?.timestamp || new Date().toISOString()
              }
            : t
        );
        saveCachedList('sales', next);
        return next;
      });
      setExpenses((prev) => {
        const next = prev.map((e) =>
          closedExpenseIds.has(e.id)
            ? {
                ...e,
                corteXId: sessionId,
                sesion_caja_id: sessionId,
                corteXClosedAt: savedCorte?.timestamp || new Date().toISOString()
              }
            : e
        );
        saveCachedList('expenses', next);
        return next;
      });

      if (canOpenNewCashSession() && normalizeBranchId(currentBranch.id) === targetBranchId) {
        try {
          const nextSession = await getActiveCashSession(
            targetBranchId,
            targetBranchName,
            currentOperator.name,
            savedCorte?.cashFundLeftForNextShift ?? corteRecord.cashFundLeftForNextShift ?? 0,
            currentOperator.id
          );
          setActiveCashSession(nextSession);
          rememberLastSession(targetBranchId, nextSession);
          setTillLocked(false);
        } catch (nextErr) {
          console.warn('[CorteX] No se pudo abrir el siguiente turno todavía:', nextErr);
          setActiveCashSession(null);
        }
      } else {
        setActiveCashSession(null);
        setTillLocked(true);
      }
    } catch (err) {
      console.error('Error al guardar el corte en el equipo:', err);
      throw err instanceof Error
        ? err
        : new Error('No se pudo guardar el corte en este equipo. Anote los totales antes de cerrar el navegador.');
    } finally {
      corteInFlightRef.current = false;
    }
  };

  // Filter notifications for current user/branch
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((n) => {
        const matchesBranch = !n.branchId || n.branchId === 'all' || n.branchId === currentBranch.id;
        const matchesOperator = !n.targetOperatorId || n.targetOperatorId === 'all' || n.targetOperatorId === currentOperator.id;
        return matchesBranch && matchesOperator;
      }),
    [notifications, currentBranch.id, currentOperator.id]
  );

  const unreadCount = visibleNotifications.length;
  const repairPendingCount = useMemo(
    () => repairRecords.filter(isPendingRepair).length,
    [repairRecords]
  );

  // Clicking an alert marks it as read and clears/dismisses it
  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationFromFirestore(id).catch((err) => console.error('Error dismissing notification:', err));
  };

  const handleClearAllNotifications = () => {
    const toClear = notifications.filter((n) => {
      const matchesBranch = !n.branchId || n.branchId === 'all' || n.branchId === currentBranch.id;
      const matchesOperator = !n.targetOperatorId || n.targetOperatorId === 'all' || n.targetOperatorId === currentOperator.id;
      return matchesBranch && matchesOperator;
    });
    setNotifications((prev) => prev.filter((n) => !toClear.some((c) => c.id === n.id)));
    toClear.forEach((n) => {
      deleteNotificationFromFirestore(n.id).catch((err) => console.error('Error dismissing notification:', err));
    });
  };

  const handleAddNotification = (newNotif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    const notification: AppNotification = {
      ...newNotif,
      id: `notif-${Date.now()}`,
      createdAt: 'Justo ahora',
      read: false,
    };

    setNotifications((prev) => [notification, ...prev]);
    saveNotificationToFirestore(notification).catch((err) => console.error('Error saving notification:', err));
  };

  const handleUpdateNotificationStatus = (notifId: string, status: 'pendiente' | 'en_camino' | 'cumplido') => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === notifId && n.requestDetails) {
          const updated = {
            ...n,
            requestDetails: {
              ...n.requestDetails,
              status
            }
          };
          saveNotificationToFirestore(updated).catch((err) => console.error('Error updating notification status:', err));
          return updated;
        }
        return n;
      })
    );
  };

  const posCreditAccounts = useMemo(
    () => creditAccounts.filter((a) => a.branchId === currentBranch.id && a.status === 'activo'),
    [creditAccounts, currentBranch.id]
  );

  const stableCompleteSale = useStableCallback(handleCompleteSale);
  const stableAddExpense = useStableCallback(handleAddExpense);
  const stableAddRepairPrice = useStableCallback(handleAddRepairPrice);
  const stableUpdateRepairPrice = useStableCallback(handleUpdateRepairPrice);
  const stableDeleteRepairPrice = useStableCallback(handleDeleteRepairPrice);
  const stableAddRepairRecord = useStableCallback(handleAddRepairRecord);
  const stableUpdateRepairRecord = useStableCallback(handleUpdateRepairRecord);
  const stableCancelRepairRecord = useStableCallback(handleCancelRepairRecord);
  const stableFinalizeCorteX = useStableCallback(handleFinalizeCorteX);
  const stableAddProduct = useStableCallback(handleAddProduct);
  const stableUpdateProduct = useStableCallback(handleUpdateProduct);
  const stableDeleteProduct = useStableCallback(handleDeleteProduct);
  const stableRecordMovement = useStableCallback(handleRecordInventoryMovement);
  const stableReceivePurchase = useStableCallback(handleReceivePurchase);
  const stableDeleteSaleTicket = useStableCallback(handleDeleteSaleTicket);
  const stableAddNotification = useStableCallback(handleAddNotification);
  const stableDismissNotification = useStableCallback(handleDismissNotification);
  const stableClearNotifications = useStableCallback(handleClearAllNotifications);
  const stableUpdateNotifStatus = useStableCallback(handleUpdateNotificationStatus);

  // Render Module Content based on activeModule
  const renderModuleContent = () => {
    if (!canOpenModule(currentOperator.role, activeModule)) {
      return null;
    }
    switch (activeModule) {
      case 'pos':
        return (
          <PosModule 
            products={products}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            salesTickets={salesTickets}
            expenses={expenses}
            onCompleteSale={stableCompleteSale}
            onAddExpense={stableAddExpense}
            isCorteXOpen={isCorteXOpen}
            setIsCorteXOpen={setIsCorteXOpen}
            isExpenseModalOpen={isExpenseModalOpen}
            setIsExpenseModalOpen={setIsExpenseModalOpen}
            isRepairModalOpen={isRepairModalOpen}
            setIsRepairModalOpen={setIsRepairModalOpen}
            repairPrices={repairPrices}
            onAddRepairPrice={stableAddRepairPrice}
            onUpdateRepairPrice={stableUpdateRepairPrice}
            onDeleteRepairPrice={stableDeleteRepairPrice}
            isRepairPriceCatalogOpen={isRepairPriceCatalogOpen}
            setIsRepairPriceCatalogOpen={setIsRepairPriceCatalogOpen}
            cortesX={cortesX}
            initialCashFund={branchCashFunds[currentBranch.id]}
            activeCashSession={activeCashSession}
            tillLocked={tillLocked}
            creditAccounts={posCreditAccounts}
            repairRecords={repairRecords}
            onAddRepairRecord={stableAddRepairRecord}
            onUpdateRepairRecord={stableUpdateRepairRecord}
            onCancelRepairRecord={stableCancelRepairRecord}
            onFinalizeCorteX={stableFinalizeCorteX}
            onLogout={onLogout}
          />
        );
      case 'inventory':
        return (
          <InventoryModule 
            products={products}
            onAddProduct={stableAddProduct}
            onUpdateProduct={stableUpdateProduct}
            onDeleteProduct={stableDeleteProduct}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            allBranches={ALL_BRANCHES}
            inventoryMovements={inventoryMovements}
            onRecordMovement={stableRecordMovement}
            onLoadOlderMovements={loadOlderMovements}
            movementsHasMore={movementsHasMore}
            movementsLoading={historyBusy === 'movements'}
          />
        );
      case 'purchases':
        return (
          <PurchasesModule 
            notifications={notifications}
            products={products}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            onUpdateNotificationStatus={stableUpdateNotifStatus}
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
            onReceivePurchase={stableReceivePurchase}
          />
        );
      case 'sales':
        return (
          <SalesModule 
            salesTickets={salesTickets}
            expenses={expenses}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            allBranches={ALL_BRANCHES}
            cortesX={cortesX}
            branchCashFunds={branchCashFunds}
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
            onFinalizeCorteX={stableFinalizeCorteX}
            onDeleteSaleTicket={stableDeleteSaleTicket}
            activeCashSession={activeCashSession}
            onLoadOlderSales={loadOlderSales}
            onLoadOlderExpenses={loadOlderExpenses}
            onLoadOlderCortes={loadOlderCortes}
            salesHasMore={salesHasMore}
            expensesHasMore={expensesHasMore}
            cortesHasMore={cortesHasMore}
            historyBusy={historyBusy}
          />
        );
      case 'repairs':
        return (
          <RepairsModule
            repairRecords={repairRecords}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            onUpdateRepairRecord={stableUpdateRepairRecord}
            onCancelRepairRecord={stableCancelRepairRecord}
            onLoadOlderRepairs={loadOlderRepairs}
            repairsHasMore={repairsHasMore}
            repairsLoading={historyBusy === 'repairs'}
          />
        );
      case 'executive':
        return (
          <ExecutiveModule 
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            operators={operators}
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
            salesTickets={salesTickets}
            expenses={expenses}
            products={products}
            onLoadOlderSales={loadOlderSales}
            salesHasMore={salesHasMore}
            historyBusy={historyBusy}
          />
        );
      case 'settings':
        return (
          <SettingsModule 
            operators={operators}
            onUpdateOperators={onUpdateOperators}
            currentOperator={currentOperator}
            currentBranch={currentBranch}
            allBranches={ALL_BRANCHES}
          />
        );
      default:
        return <div>Módulo no encontrado</div>;
    }
  };

  return (

    <div className="flex h-screen bg-[#f4f6f9] overflow-hidden font-sans text-slate-900">
      
      {/* Left Sidebar Section */}
      <Sidebar 
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onLogout={onLogout}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        repairPendingCount={repairPendingCount}
      />

      {/* Main Workspace Section */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 shrink-0 relative z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                {activeModule === 'pos' ? 'Punto de venta' :
                 activeModule === 'inventory' ? 'Inventario' :
                 activeModule === 'purchases' ? 'Compras' :
                 activeModule === 'sales' ? 'Ventas y cortes' :
                 activeModule === 'repairs' ? 'Reparaciones' :
                 activeModule === 'executive' ? 'Dirección' : 'Usuarios'}
              </h2>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              {currentBranch.name}
            </span>
            {activeCashSession?.id && hasCashTill(currentBranch.id) && (
              <span className="hidden md:inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800" title={activeCashSession.id}>
                Turno abierto
              </span>
            )}
            {tillLocked && hasCashTill(currentBranch.id) && (
              <span className="hidden md:inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                Caja cerrada 11:00 p.m.
              </span>
            )}
            <SyncStatusChip
              currentBranch={currentBranch}
              salesTickets={salesTickets}
              expenses={expenses}
              cortesX={cortesX}
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors relative ${
                isNotificationsOpen ? 'bg-[#0047AB] text-white' : 'hover:bg-slate-100 text-slate-600'
              }`}
              title="Avisos"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-semibold rounded-full text-white bg-red-600">
                  {unreadCount}
                </span>
              )}
            </button>

            <NotificationsPopover
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
              notifications={visibleNotifications}
              onDismissNotification={stableDismissNotification}
              onClearAllNotifications={stableClearNotifications}
              onOpenCreateModal={() => {
                setIsNotificationsOpen(false);
                setIsCreateNoticeOpen(true);
              }}
              currentBranch={currentBranch}
              currentOperator={currentOperator}
            />
          </div>
        </header>

        {/* Workspace Content Area */}
        <main className="flex-1 overflow-y-auto p-4">
          {sessionError && (
            <div className={`max-w-[1600px] mx-auto mb-3 rounded-xl border px-3 py-2 text-sm ${
              cloudSynced ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-rose-300 bg-rose-50 text-rose-900'
            }`}>
              {sessionError}
            </div>
          )}
          <div className="max-w-[1600px] mx-auto h-full">
            <Suspense fallback={<ModuleLoading />}>
              {renderModuleContent()}
            </Suspense>
          </div>
        </main>

      </div>

      {/* Modal for Creating New Notice/Notification */}
      <LazyWhen when={isCreateNoticeOpen}>
        <CreateNoticeModal
          isOpen={isCreateNoticeOpen}
          onClose={() => setIsCreateNoticeOpen(false)}
          onAddNotification={stableAddNotification}
          currentOperator={currentOperator}
          currentBranch={currentBranch}
          branches={ALL_BRANCHES}
          operators={operators}
        />
      </LazyWhen>

      <LazyWhen when={isRepairPriceCatalogOpen}>
        <RepairPriceCatalogModal
          isOpen={isRepairPriceCatalogOpen}
          onClose={() => setIsRepairPriceCatalogOpen(false)}
          isAdmin={isAdmin}
          repairPrices={repairPrices}
          onAddRepairPrice={stableAddRepairPrice}
          onUpdateRepairPrice={stableUpdateRepairPrice}
          onDeleteRepairPrice={stableDeleteRepairPrice}
        />
      </LazyWhen>

      {nightClosing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center border border-slate-200 shadow-xl space-y-3">
            <h4 className="text-base font-semibold text-slate-900">Cierre automático 11:00 p.m.</h4>
            <p className="text-sm text-slate-600">
              Se está registrando el corte del turno y se cerrará la sesión. Mañana entra con su contraseña para abrir caja de nuevo.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}


// Module Placeholder
function ModulePlaceholder({ 
  title, 
  description,
  onOpenNoticeModal,
  isAdmin
}: { 
  title: string; 
  description: string;
  onOpenNoticeModal: () => void;
  isAdmin: boolean;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-yellow-400"></div>
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
          <span className="text-2xl text-blue-400">🏗️</span>
        </div>
        <h3 className="text-2xl font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 max-w-md">{description}</p>
        
        {isAdmin && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenNoticeModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Megaphone className="w-4 h-4 text-yellow-300" />
              Publicar Aviso
            </button>
          </div>
        )}

        <div className="mt-6 px-4 py-2 bg-yellow-50 text-yellow-800 rounded-lg text-xs font-medium border border-yellow-200">
          Módulo listo para integración de funciones
        </div>
      </div>
    </div>
  );
}
