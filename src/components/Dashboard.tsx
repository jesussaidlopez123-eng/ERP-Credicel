import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationsPopover from './NotificationsPopover';
import CreateNoticeModal from './CreateNoticeModal';
import ExecutiveModule from './ExecutiveModule';
import PosModule from './PosModule';
import InventoryModule from './InventoryModule';
import PurchasesModule from './PurchasesModule';
import SalesModule from './SalesModule';
import { Branch, Operator, ModuleId, AppNotification, Product, SaleTicket, Expense, RepairPriceItem } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_REPAIR_PRICES } from '../data/initialRepairPrices';
import RepairPriceCatalogModal from './RepairPriceCatalogModal';
import { Bell, Megaphone, Plus, Calculator, TrendingDown, Wrench } from 'lucide-react';

const ALL_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

const ALL_OPERATORS: Operator[] = [
  { id: 'o1', name: 'Admin Principal', branchIds: ['b-bodega', 'b-navojoa', 'b-huatabampo'], role: 'admin' },
  { id: 'o2', name: 'Juan Pérez', branchIds: ['b-bodega', 'b-navojoa'], role: 'manager' },
  { id: 'o3', name: 'María García', branchIds: ['b-huatabampo'], role: 'cashier' },
  { id: 'o4', name: 'Carlos López', branchIds: ['b-bodega', 'b-navojoa', 'b-huatabampo'], role: 'cashier' },
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
  onLogout: () => void;
}

export default function Dashboard({ currentBranch, currentOperator, onLogout }: DashboardProps) {
  const [activeModule, setActiveModule] = useState<ModuleId>('pos');
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateNoticeOpen, setIsCreateNoticeOpen] = useState(false);

  // POS Quick Modal States
  const [isCorteXOpen, setIsCorteXOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isRepairPriceCatalogOpen, setIsRepairPriceCatalogOpen] = useState(false);

  // Shared Data States for POS and Inventory
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [repairPrices, setRepairPrices] = useState<RepairPriceItem[]>(INITIAL_REPAIR_PRICES);
  const [salesTickets, setSalesTickets] = useState<SaleTicket[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const isAdmin = currentOperator.role === 'admin';

  // Non-admin operators only have access to POS module
  useEffect(() => {
    if (!isAdmin && activeModule !== 'pos') {
      setActiveModule('pos');
    }
  }, [isAdmin, activeModule]);

  // Repair Price Catalog Handlers
  const handleAddRepairPrice = (newItem: RepairPriceItem) => {
    setRepairPrices((prev) => [newItem, ...prev]);
  };

  const handleUpdateRepairPrice = (updatedItem: RepairPriceItem) => {
    setRepairPrices((prev) => prev.map((p) => (p.id === updatedItem.id ? updatedItem : p)));
  };

  const handleDeleteRepairPrice = (id: string) => {
    setRepairPrices((prev) => prev.filter((p) => p.id !== id));
  };

  // Complete Sale Handler (Deducts stock & records ticket with strict IMEI removal)
  const handleCompleteSale = (ticket: SaleTicket) => {
    setSalesTickets((prev) => [ticket, ...prev]);

    // Update product stock and remove sold IMEIs
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

        return {
          ...p,
          stock: newTotalStock,
          branchStock: newBranchStock,
          branchImeiMap: Object.keys(updatedImeiMap).length > 0 ? updatedImeiMap : p.branchImeiMap,
          imeiList: updatedImeiList,
          imei: updatedImeiList && updatedImeiList.length > 0 ? updatedImeiList[0] : (soldImei && p.imei?.toUpperCase() === soldImei.toUpperCase() ? '' : p.imei)
        };
      })
    );
  };

  // Add Expense Handler
  const handleAddExpense = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  // Inventory Handlers
  const handleAddProduct = (newProd: Product) => {
    setProducts((prev) => [newProd, ...prev]);
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProd.id ? updatedProd : p)));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
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
  };

  const handleUpdateNotificationStatus = (notifId: string, status: 'pendiente' | 'en_camino' | 'cumplido') => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === notifId && n.requestDetails) {
          return {
            ...n,
            requestDetails: {
              ...n.requestDetails,
              status
            }
          };
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
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
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
      case 'users':
        return (
          <ModulePlaceholder 
            title="Usuarios" 
            description="Administración de operadores, roles, permisos y asignación a sucursales." 
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
            isAdmin={isAdmin}
          />
        );
      case 'settings':
        return (
          <ModulePlaceholder 
            title="Configuración" 
            description="Preferencias del sistema, información de la sucursal, tickets y periféricos." 
            onOpenNoticeModal={() => setIsCreateNoticeOpen(true)}
            isAdmin={isAdmin}
          />
        );
      default:
        return <div>Módulo no encontrado</div>;
    }
  };

  return (
    <div className="flex h-screen bg-neutral-100 overflow-hidden font-sans text-neutral-900">
      
      {/* Left Sidebar Section */}
      <Sidebar 
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        onLogout={onLogout}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
      />

      {/* Main Workspace Section */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 shrink-0 relative z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-neutral-800 capitalize tracking-tight">
              {activeModule === 'pos' ? 'Punto de Venta (POS)' : 
               activeModule === 'inventory' ? 'Inventario' : 
               activeModule === 'purchases' ? 'Compras' : 
               activeModule === 'sales' ? 'Ventas' : 
               activeModule === 'executive' ? 'Dirección General' : 
               activeModule === 'users' ? 'Usuarios' : 'Configuración'}
            </h2>
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
        operators={ALL_OPERATORS}
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
