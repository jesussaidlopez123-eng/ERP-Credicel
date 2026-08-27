import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationsPopover from './NotificationsPopover';
import CreateNoticeModal from './CreateNoticeModal';
import ExecutiveModule from './ExecutiveModule';
import PosModule from './PosModule';
import InventoryModule from './InventoryModule';
import PurchasesModule from './PurchasesModule';
import SalesModule from './SalesModule';
import SettingsModule from './SettingsModule';
import LabelsModule from './LabelsModule';
import { Branch, Operator, ModuleId, AppNotification, Product, SaleTicket, Expense, RepairPriceItem, CorteXRecord, InventoryMovement, CreditAccount, RepairRecord, SesionCaja } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_REPAIR_PRICES } from '../data/initialRepairPrices';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import RepairPriceCatalogModal from './RepairPriceCatalogModal';
import { Bell, Menu, Megaphone } from 'lucide-react';
import {
  subscribeToProducts,
  saveProductToFirestore,
  deleteProductFromFirestore,
  subscribeToSales,
  saveSaleTicketToFirestore,
  subscribeToExpenses,
  saveExpenseToFirestore,
  subscribeToRepairPrices,
  saveRepairPriceToFirestore,
  deleteRepairPriceFromFirestore,
  subscribeToNotifications,
  saveNotificationToFirestore,
  deleteNotificationFromFirestore,
  subscribeToCortesX,
  subscribeToInventoryMovements,
  saveInventoryMovementToFirestore,
  saveInventoryMovementsBatchToFirestore,
  subscribeToBranchFunds,
  getActiveCashSession,
  executeCorteSesionCajaTransaction,
  subscribeToCreditAccounts,
  saveCreditAccountToFirestore,
  applyCreditAbonoToAccount,
  subscribeToRepairRecords,
  saveRepairRecordToFirestore,
  deleteSaleTicketFromFirestore
} from '../lib/firebase';
import { belongsToOpenSession } from '../lib/saleClassification';
import { isNonInventorySaleItem } from '../lib/inventoryRules';
import { money, newUniqueId } from '../lib/ids';

const ALL_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

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
  const [activeModule, setActiveModule] = useState<ModuleId>('pos');
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
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [repairPrices, setRepairPrices] = useState<RepairPriceItem[]>(INITIAL_REPAIR_PRICES);
  const [salesTickets, setSalesTickets] = useState<SaleTicket[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cortesX, setCortesX] = useState<CorteXRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [branchCashFunds, setBranchCashFunds] = useState<Record<string, number>>({});
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [repairRecords, setRepairRecords] = useState<RepairRecord[]>([]);
  const [activeCashSession, setActiveCashSession] = useState<SesionCaja | null>(null);
  const [cloudSynced, setCloudSynced] = useState(true);

  // -----------------------------------------------------------
  // Real-time Firestore Subscriptions
  // -----------------------------------------------------------
  useEffect(() => {
    const unsubProducts = subscribeToProducts((prods) => {
      if (prods && prods.length > 0) {
        const byId = new Map(prods.map((p) => [p.id, p]));
        INITIAL_PRODUCTS.forEach((p) => {
          if (!byId.has(p.id)) byId.set(p.id, p);
        });
        setProducts(Array.from(byId.values()));
      }
    });

    const unsubSales = subscribeToSales((sales) => {
      setSalesTickets(sales);
    });

    const unsubExpenses = subscribeToExpenses((exps) => {
      setExpenses(exps);
    });

    const unsubRepairPrices = subscribeToRepairPrices((prices) => {
      if (prices && prices.length > 0) {
        setRepairPrices(prices);
      }
    });

    const unsubCortes = subscribeToCortesX((cortes) => {
      setCortesX(cortes);
    });

    const unsubNotifs = subscribeToNotifications((notifs) => {
      setNotifications(Array.isArray(notifs) ? notifs : []);
    });

    const unsubMovements = subscribeToInventoryMovements((movs) => {
      setInventoryMovements(movs);
    });

    const unsubFunds = subscribeToBranchFunds((funds) => {
      if (funds && typeof funds === 'object') {
        setBranchCashFunds(funds);
      }
    });

    const unsubCredits = subscribeToCreditAccounts((accounts) => {
      setCreditAccounts(accounts || []);
    });

    const unsubRepairs = subscribeToRepairRecords((records) => {
      setRepairRecords(records || []);
    });

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

  const isAdmin = currentOperator.role === 'admin';

  useEffect(() => {
    if (currentBranch.id === 'b-bodega') {
      setActiveCashSession(null);
      return;
    }
    let cancelled = false;
    getActiveCashSession(
      currentBranch.id,
      currentBranch.name,
      currentOperator.name,
      branchCashFunds[currentBranch.id] ?? 1000,
      currentOperator.id
    )
      .then((ses) => {
        if (!cancelled) setActiveCashSession(ses);
      })
      .catch((err) => console.error('Error loading cash session:', err));
    return () => {
      cancelled = true;
    };
  }, [currentBranch.id, currentBranch.name, currentOperator.id, currentOperator.name, branchCashFunds]);

  // Non-admin operators only have access to POS module
  useEffect(() => {
    if (!isAdmin && activeModule !== 'pos') {
      setActiveModule('pos');
    }
  }, [isAdmin, activeModule]);

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
  const handleCompleteSale = async (ticket: SaleTicket) => {
    let session = activeCashSession;
    if ((!session || session.sucursal_id !== ticket.branchId) && ticket.branchId !== 'b-bodega') {
      try {
        session = await getActiveCashSession(
          ticket.branchId,
          currentBranch.name,
          currentOperator.name,
          branchCashFunds[ticket.branchId] ?? 1000,
          currentOperator.id
        );
        setActiveCashSession(session);
      } catch {
        session = null;
      }
    }

    const enrichedTicket: SaleTicket = {
      ...ticket,
      sucursal_id: ticket.branchId,
      sesion_caja_id: session?.id || ticket.sesion_caja_id
    };

    setSalesTickets((prev) => [enrichedTicket, ...prev]);

    try {
      await saveSaleTicketToFirestore(enrichedTicket);
    } catch (err) {
      console.error('Error saving sale ticket to Firestore:', err);
    }

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
      saveInventoryMovementsBatchToFirestore(saleMovements).catch((err) =>
        console.error('Error saving sale inventory movements batch:', err)
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

        saveProductToFirestore(updatedProduct).catch((err) =>
          console.error('Error updating product stock in Firestore:', err)
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

      if (meta?.saleType === 'abono' && meta.creditAccountId) {
        applyCreditAbonoToAccount(meta.creditAccountId, item.totalPrice || item.unitPrice || 0)
          .then((updated) => {
            if (!updated) return;
            setCreditAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          })
          .catch((err) => console.error('Error applying credit payment:', err));
      }
    }
  };

  const handleDeleteSaleTicket = async (ticket: SaleTicket | string, reason?: string) => {
    const ticketId = typeof ticket === 'string' ? ticket : ticket.id;
    setSalesTickets((prev) => prev.filter((t) => t.id !== ticketId));
    await deleteSaleTicketFromFirestore(ticket, {
      reason: reason || 'Error de captura de operador',
      operatorName: currentOperator.name
    });
  };

  const handleAddRepairRecord = (record: RepairRecord) => {
    setRepairRecords((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
    saveRepairRecordToFirestore(record).catch((err) => console.error('Error saving repair record:', err));
  };

  const handleUpdateRepairRecord = (record: RepairRecord) => {
    setRepairRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
    saveRepairRecordToFirestore(record).catch((err) => console.error('Error updating repair record:', err));
  };

  // Add Expense Handler
  const handleAddExpense = async (expense: Expense) => {
    let activeSessionId = expense.sesion_caja_id || activeCashSession?.id;
    if (!activeSessionId && expense.branchId !== 'b-bodega') {
      try {
        const activeSes = await getActiveCashSession(
          expense.branchId,
          currentBranch.name,
          currentOperator.name,
          branchCashFunds[expense.branchId] ?? 1000,
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

    setExpenses((prev) => [enrichedExpense, ...prev]);
    saveExpenseToFirestore(enrichedExpense).catch((err) => console.error('Error saving expense:', err));
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
    saveProductToFirestore(newProd).catch((err) => console.error('Error saving new product:', err));
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProd.id ? updatedProd : p)));
    saveProductToFirestore(updatedProd).catch((err) => console.error('Error updating product:', err));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    deleteProductFromFirestore(id).catch((err) => console.error('Error deleting product:', err));
  };

  // Finalize Corte X Handler (Saves snapshot, closes session and flags shift tickets/expenses as closed)
  const handleFinalizeCorteX = async (corteRecord: CorteXRecord) => {
    if (currentBranch.id === 'b-bodega' || corteRecord.branchId === 'b-bodega') {
      console.warn('[CorteX] La Bodega Central no genera cortes de caja.');
      return;
    }

    try {
      const session = await getActiveCashSession(
        currentBranch.id,
        currentBranch.name,
        currentOperator.name,
        corteRecord.initialCashFund,
        currentOperator.id
      );

      const sessionFilter = {
        branchId: currentBranch.id,
        sessionId: session.id,
        sessionOpenedAt: session.fecha_apertura
      };

      const idSet = new Set(corteRecord.ticketIds || []);
      const expIdSet = new Set(corteRecord.expenseIds || []);

      const unclosedTickets = salesTickets.filter((t) => {
        if (t.branchId !== currentBranch.id) return false;
        if (t.corteXId && t.corteXId !== session.id) return false;
        if (idSet.size > 0) return idSet.has(t.id);
        return belongsToOpenSession(t, sessionFilter);
      });

      const unclosedExpenses = expenses.filter((e) => {
        if (e.branchId !== currentBranch.id) return false;
        if (e.corteXId && e.corteXId !== session.id) return false;
        if (expIdSet.size > 0) return expIdSet.has(e.id);
        return belongsToOpenSession(
          { branchId: e.branchId, corteXId: e.corteXId, sesion_caja_id: e.sesion_caja_id, timestamp: e.timestamp },
          sessionFilter
        );
      });

      const counted = Number.isFinite(corteRecord.countedCash)
        ? Number(corteRecord.countedCash)
        : corteRecord.expectedCashInDrawer;

      const result = await executeCorteSesionCajaTransaction({
        sesionId: session.id,
        sucursalId: currentBranch.id,
        sucursalNombre: currentBranch.name,
        operadorCierre: { uid: currentOperator.id, nombre: currentOperator.name },
        efectivoContado: counted,
        fondoDejado: corteRecord.cashFundLeftForNextShift ?? 0,
        notas: corteRecord.closingNotes || '',
        ticketsSnapshot: unclosedTickets,
        expensesSnapshot: unclosedExpenses
      });

      const savedCorte = result.corteRecord;
      setCortesX((prev) => [savedCorte, ...prev.filter((c) => c.id !== savedCorte.id)]);

      const closedTicketIds = new Set(unclosedTickets.map((t) => t.id));
      const closedExpenseIds = new Set(unclosedExpenses.map((e) => e.id));
      setSalesTickets((prev) =>
        prev.map((t) =>
          closedTicketIds.has(t.id)
            ? { ...t, corteXId: savedCorte.id, sesion_caja_id: session.id, corteXClosedAt: savedCorte.timestamp }
            : t
        )
      );
      setExpenses((prev) =>
        prev.map((e) =>
          closedExpenseIds.has(e.id)
            ? { ...e, corteXId: savedCorte.id, sesion_caja_id: session.id, corteXClosedAt: savedCorte.timestamp }
            : e
        )
      );

      const nextSession = await getActiveCashSession(
        currentBranch.id,
        currentBranch.name,
        currentOperator.name,
        savedCorte.cashFundLeftForNextShift ?? 0,
        currentOperator.id
      );
      setActiveCashSession(nextSession);
    } catch (err) {
      console.error('Error finalizing Corte X and Sesion in Firestore:', err);
    }
  };

  // Filter notifications for current user/branch
  const visibleNotifications = notifications.filter((n) => {
    const matchesBranch = !n.branchId || n.branchId === 'all' || n.branchId === currentBranch.id;
    const matchesOperator = !n.targetOperatorId || n.targetOperatorId === 'all' || n.targetOperatorId === currentOperator.id;
    return matchesBranch && matchesOperator;
  });

  const unreadCount = visibleNotifications.length;

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

  // Render Module Content based on activeModule
  const renderModuleContent = () => {
    switch (activeModule) {
      case 'pos':
        return (
          <PosModule 
            products={products}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            salesTickets={salesTickets}
            expenses={expenses}
            onCompleteSale={handleCompleteSale}
            onAddExpense={handleAddExpense}
            isCorteXOpen={isCorteXOpen}
            setIsCorteXOpen={setIsCorteXOpen}
            isExpenseModalOpen={isExpenseModalOpen}
            setIsExpenseModalOpen={setIsExpenseModalOpen}
            isRepairModalOpen={isRepairModalOpen}
            setIsRepairModalOpen={setIsRepairModalOpen}
            repairPrices={repairPrices}
            onAddRepairPrice={handleAddRepairPrice}
            onUpdateRepairPrice={handleUpdateRepairPrice}
            onDeleteRepairPrice={handleDeleteRepairPrice}
            isRepairPriceCatalogOpen={isRepairPriceCatalogOpen}
            setIsRepairPriceCatalogOpen={setIsRepairPriceCatalogOpen}
            cortesX={cortesX}
            initialCashFund={branchCashFunds[currentBranch.id]}
            activeCashSession={activeCashSession}
            creditAccounts={creditAccounts.filter((a) => a.branchId === currentBranch.id && a.status === 'activo')}
            repairRecords={repairRecords.filter((r) => r.branchId === currentBranch.id)}
            onAddRepairRecord={handleAddRepairRecord}
            onUpdateRepairRecord={handleUpdateRepairRecord}
            onFinalizeCorteX={handleFinalizeCorteX}
            onLogout={onLogout}
          />
        );
      case 'inventory':
        return (
          <InventoryModule 
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            allBranches={ALL_BRANCHES}
            inventoryMovements={inventoryMovements}
            onRecordMovement={handleRecordInventoryMovement}
          />
        );
      case 'purchases':
        return (
          <PurchasesModule 
            notifications={notifications}
            products={products}
            currentBranch={currentBranch}
            onUpdateNotificationStatus={handleUpdateNotificationStatus}
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
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
            onFinalizeCorteX={handleFinalizeCorteX}
            onDeleteSaleTicket={handleDeleteSaleTicket}
          />
        );
      case 'executive':
        return (
          <ExecutiveModule 
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
            salesTickets={salesTickets}
            expenses={expenses}
            products={products}
          />
        );
      case 'labels':
        return (
          <LabelsModule 
            products={products}
            currentBranch={currentBranch}
            currentOperator={currentOperator}
            allBranches={ALL_BRANCHES}
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
        onModuleChange={setActiveModule}
        onLogout={onLogout}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
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
                 activeModule === 'labels' ? 'Etiquetas' :
                 activeModule === 'purchases' ? 'Compras' :
                 activeModule === 'sales' ? 'Ventas y cortes' :
                 activeModule === 'executive' ? 'Dirección' : 'Usuarios'}
              </h2>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              {currentBranch.name}
            </span>
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
              notifications={notifications}
              onDismissNotification={handleDismissNotification}
              onClearAllNotifications={handleClearAllNotifications}
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
          <div className="max-w-[1600px] mx-auto h-full">
            {renderModuleContent()}
          </div>
        </main>

      </div>

      {/* Modal for Creating New Notice/Notification */}
      <CreateNoticeModal
        isOpen={isCreateNoticeOpen}
        onClose={() => setIsCreateNoticeOpen(false)}
        onAddNotification={handleAddNotification}
        currentOperator={currentOperator}
        currentBranch={currentBranch}
        branches={ALL_BRANCHES}
        operators={operators}
      />

      {/* Repair Price Catalog Modal */}
      <RepairPriceCatalogModal
        isOpen={isRepairPriceCatalogOpen}
        onClose={() => setIsRepairPriceCatalogOpen(false)}
        isAdmin={isAdmin}
        repairPrices={repairPrices}
        onAddRepairPrice={handleAddRepairPrice}
        onUpdateRepairPrice={handleUpdateRepairPrice}
        onDeleteRepairPrice={handleDeleteRepairPrice}
      />

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
