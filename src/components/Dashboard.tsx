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
import { Branch, Operator, ModuleId, AppNotification, Product, SaleTicket, Expense, RepairPriceItem, CorteXRecord, InventoryMovement } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_REPAIR_PRICES } from '../data/initialRepairPrices';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import RepairPriceCatalogModal from './RepairPriceCatalogModal';
import { Bell, Megaphone, Plus, Calculator, TrendingDown, Wrench, Cloud, CheckCircle2, Menu } from 'lucide-react';
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
  executeAndSaveCorteX,
  subscribeToInventoryMovements,
  saveInventoryMovementToFirestore,
  saveInventoryMovementsBatchToFirestore
} from '../lib/firebase';

const ALL_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    urgency: 'urgente',
    title: 'Aviso Importante: Arqueo de Caja a las 15:00 hrs',
    message: 'Favor de realizar el corte de caja intermedio y verificar comprobantes de pago con tarjeta.',
    createdAt: 'Hace 10 min',
    read: false,
    authorName: 'Admin Principal',
    branchId: 'all',
    targetOperatorId: 'all'
  },
  {
    id: 'notif-2',
    urgency: 'normal',
    title: 'Nuevos Insumos Disponibles en Almacén',
    message: 'Se recibieron micas de cristal templado para serie iPhone y Samsung Galaxy.',
    createdAt: 'Hace 35 min',
    read: false,
    authorName: 'Admin Principal',
    branchId: 'b1',
    targetOperatorId: 'all'
  },
  {
    id: 'notif-3',
    urgency: 'urgente',
    title: 'Verificación de Stock Mínimo',
    message: 'Favor de confirmar cantidad de cargadores Tipo-C disponibles en mostrador.',
    createdAt: 'Hace 1 hora',
    read: false,
    authorName: 'Admin Principal',
    branchId: 'b2',
    targetOperatorId: 'o3',
    targetOperatorName: 'María García'
  }
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
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
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
  const [cloudSynced, setCloudSynced] = useState(true);

  // -----------------------------------------------------------
  // Real-time Firestore Subscriptions
  // -----------------------------------------------------------
  useEffect(() => {
    const unsubProducts = subscribeToProducts((prods) => {
      if (prods && prods.length > 0) {
        setProducts(prods);
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
      if (notifs && notifs.length > 0) {
        setNotifications(notifs);
      }
    });

    const unsubMovements = subscribeToInventoryMovements((movs) => {
      setInventoryMovements(movs);
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubExpenses();
      unsubRepairPrices();
      unsubCortes();
      unsubNotifs();
      unsubMovements();
    };
  }, []);

  const isAdmin = currentOperator.role === 'admin';

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
    // 1. Optimistically add to local sales tickets
    setSalesTickets((prev) => [ticket, ...prev]);

    // 2. Persist ticket to Firebase Firestore
    try {
      await saveSaleTicketToFirestore(ticket);
    } catch (err) {
      console.error('Error saving sale ticket to Firestore:', err);
    }

    // 3. Register inventory movements for sold products
    const branchName = ALL_BRANCHES.find((b) => b.id === ticket.branchId)?.name || ticket.branchId;
    const saleMovements: InventoryMovement[] = [];

    ticket.items.forEach((item) => {
      const prodId = item.product?.id || '';
      if (
        prodId === 'prod-recarga-gen' ||
        prodId === 'prod-abono-gen' ||
        prodId === 'prod-reparacion-gen'
      ) {
        return;
      }
      const prod = products.find((p) => p.id === prodId) || item.product;
      const prodName = prod?.name || 'Artículo';
      const prodCode = prod?.code || 'S/C';

      const mov: InventoryMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        type: 'venta',
        productId: prod?.id || prodId,
        productCode: prodCode,
        productName: prodName,
        category: prod?.category,
        inventoryType: prod?.inventoryType,
        quantity: -item.quantity,
        targetBranchId: ticket.branchId,
        targetBranchName: branchName,
        operatorName: ticket.operatorName || currentOperator.name,
        operatorId: currentOperator.id,
        ticketId: ticket.folio || ticket.id,
        unitPrice: item.unitPrice,
        details: `Venta POS en Ticket #${ticket.folio || ticket.id.slice(-6)}: ${item.quantity} pza(s) vendida(s) en ${branchName}`,
        imeis: item.metadata?.imei ? [item.metadata.imei] : undefined
      };
      saleMovements.push(mov);
    });

    if (saleMovements.length > 0) {
      setInventoryMovements((prev) => [...saleMovements, ...prev]);
      saveInventoryMovementsBatchToFirestore(saleMovements).catch((err) =>
        console.error('Error saving sale inventory movements batch:', err)
      );
    }

    // 4. Update product stock and remove sold IMEIs in state and in Firestore
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        // Find matching item in ticket
        const itemInTicket = ticket.items.find(
          (i) => i.product.id === p.id || (i.metadata?.imei && (p.imeiList?.includes(i.metadata.imei) || p.imei === i.metadata.imei))
        );

        if (!itemInTicket) return p;

        // Skip non-stock virtual items
        if (p.id === 'prod-recarga-gen' || p.id === 'prod-abono-gen' || p.id === 'prod-reparacion-gen') {
          return p;
        }

        const currentBStock = p.branchStock || {
          'b-bodega': 0,
          'b-navojoa': 0,
          'b-huatabampo': 0
        };

        const currentBranchQty = currentBStock[ticket.branchId] || 0;
        const newBranchQty = Math.max(0, currentBranchQty - itemInTicket.quantity);
        const newBranchStock = { ...currentBStock, [ticket.branchId]: newBranchQty };
        const newTotalStock = Math.max(0, p.stock - itemInTicket.quantity);

        // Deduct sold IMEI if applicable
        const soldImei = itemInTicket.metadata?.imei;
        let updatedImeiMap = p.branchImeiMap ? { ...p.branchImeiMap } : {};

        if (soldImei && updatedImeiMap[ticket.branchId]) {
          updatedImeiMap[ticket.branchId] = updatedImeiMap[ticket.branchId].filter((im) => im.toUpperCase() !== soldImei.toUpperCase());
        }

        const updatedImeiList = p.imeiList
          ? (soldImei ? p.imeiList.filter((im) => im.toUpperCase() !== soldImei.toUpperCase()) : p.imeiList)
          : undefined;

        const updatedProduct: Product = {
          ...p,
          stock: newTotalStock,
          branchStock: newBranchStock,
          branchImeiMap: Object.keys(updatedImeiMap).length > 0 ? updatedImeiMap : p.branchImeiMap,
          imeiList: updatedImeiList,
          imei: updatedImeiList && updatedImeiList.length > 0 ? updatedImeiList[0] : (soldImei && p.imei?.toUpperCase() === soldImei.toUpperCase() ? '' : p.imei)
        };

        // Persist updated product stock to Firestore
        saveProductToFirestore(updatedProduct).catch((err) =>
          console.error('Error updating product stock in Firestore:', err)
        );

        return updatedProduct;
      })
    );
  };

  // Add Expense Handler
  const handleAddExpense = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
    saveExpenseToFirestore(expense).catch((err) => console.error('Error saving expense:', err));
  };

  // Inventory Handlers
  const handleAddProduct = (newProd: Product) => {
    setProducts((prev) => [...prev, newProd]);
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

  // Finalize Corte X Handler (Saves snapshot and flags shift tickets/expenses as closed)
  const handleFinalizeCorteX = async (corteRecord: CorteXRecord) => {
    const unclosedTickets = salesTickets.filter((t) => t.branchId === currentBranch.id && !t.corteXId);
    const unclosedExpenses = expenses.filter((e) => e.branchId === currentBranch.id && !e.corteXId);

    try {
      await executeAndSaveCorteX(corteRecord, unclosedTickets, unclosedExpenses);
      setCortesX((prev) => [corteRecord, ...prev]);
    } catch (err) {
      console.error('Error finalizing Corte X in Firestore:', err);
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
    setNotifications((prev) => 
      prev.filter((n) => {
        const matchesBranch = !n.branchId || n.branchId === 'all' || n.branchId === currentBranch.id;
        const matchesOperator = !n.targetOperatorId || n.targetOperatorId === 'all' || n.targetOperatorId === currentOperator.id;
        return !(matchesBranch && matchesOperator);
      })
    );
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
            cortesX={cortesX}
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
            onFinalizeCorteX={handleFinalizeCorteX}
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

    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
      
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shrink-0 relative z-30">
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Hamburger Button on Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Abrir Menú de Navegación"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h2 className="text-base sm:text-xl font-black text-slate-800 capitalize tracking-tight">
              {activeModule === 'pos' ? 'Punto de Venta (POS)' : 
               activeModule === 'inventory' ? 'Inventario' : 
               activeModule === 'purchases' ? 'Compras' : 
               activeModule === 'sales' ? 'Ventas' : 
               activeModule === 'executive' ? 'Dirección General' : 'Configuración'}
            </h2>
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 text-[11px] font-bold">
              <Cloud className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Nube Firebase Activa</span>
            </div>
          </div>

          
          <div className="flex items-center gap-2.5">
            {/* Quick POS Operations Buttons in Header (Only in Module 1: POS) */}
            {activeModule === 'pos' && (
              <>
                <button
                  onClick={() => {
                    setIsCorteXOpen(true);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all border border-slate-700 cursor-pointer"
                  title="Abrir Corte X Parcial de Caja"
                >
                  <Calculator className="w-3.5 h-3.5 text-yellow-400" />
                  Corte X
                </button>

                <button
                  onClick={() => {
                    setIsExpenseModalOpen(true);
                  }}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200/80 transition-all shadow-xs cursor-pointer"
                  title="Registrar Salida de Efectivo"
                >
                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                  Registrar Gasto
                </button>

                <button
                  onClick={() => {
                    setIsRepairPriceCatalogOpen(true);
                  }}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 transition-all shadow-xs cursor-pointer"
                  title="Lista de Precios y Cotización de Reparaciones"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                  Precios Reparaciones
                </button>

                <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
              </>
            )}


            {/* Bell Icon Button */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors relative ${
                  isNotificationsOpen ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'
                }`}
                title="Avisos y Alertas"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold rounded-full text-black bg-yellow-400 border-2 border-white shadow-sm ${
                    isNotificationsOpen ? 'border-blue-600' : ''
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Popover */}
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
