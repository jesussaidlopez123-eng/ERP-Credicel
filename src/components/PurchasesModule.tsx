import React, { useState } from 'react';
import { 
  FileText, Plus, Search, Copy, Check, Trash2, Edit3, Send, 
  PackagePlus, ShoppingBag, Store, AlertTriangle, CheckCircle2, 
  Clock, ArrowUpRight, DollarSign, Layers, ChevronRight, X, Sparkles, Filter,
  Archive, History, Eye, XCircle, RotateCcw, Printer, Calendar, CheckCircle
} from 'lucide-react';
import { PurchaseDraft, PurchaseDraftItem, BranchStockRequest, AppNotification, Product, Branch } from '../types';

interface PurchasesModuleProps {
  notifications: AppNotification[];
  products: Product[];
  currentBranch: Branch;
  onUpdateNotificationStatus?: (notifId: string, status: 'pendiente' | 'en_camino' | 'cumplido') => void;
  onOpenNoticeModal: () => void;
}

// Sample Initial Purchase Drafts & Archived Orders
const INITIAL_DRAFTS: PurchaseDraft[] = [
  {
    id: 'draft-1',
    title: 'Cotización Micas Cristal Templado y Fundas TPU',
    supplierName: 'Distribuidora Celular MX',
    createdAt: '2026-07-28',
    updatedAt: '2026-07-28',
    status: 'enviado_proveedor',
    archivedAt: '2026-07-28',
    totalAmount: 4850.00,
    notes: 'Precios de mayoreo negociados por lote de 100 piezas.',
    items: [
      { id: 'item-1', code: 'MICA-IP13', productName: 'Mica Cristal Templado iPhone 13', quantity: 50, wholesalePrice: 35.00, notes: 'Empaque individual' },
      { id: 'item-2', code: 'FUNDA-SAM-A54', productName: 'Funda TPU Transparente Samsung A54', quantity: 30, wholesalePrice: 45.00, notes: 'Reforzada en esquinas' },
      { id: 'item-3', code: 'CARG-20W', productName: 'Cargador Carga Rápida 20W USB-C', quantity: 20, wholesalePrice: 87.50, notes: 'Marca 100% compatible' }
    ]
  },
  {
    id: 'draft-2',
    title: 'Pedido Equipos Xiaomi y Samsung Mayoreo',
    supplierName: 'Importaciones Tech Sol',
    createdAt: '2026-07-29',
    updatedAt: '2026-07-29',
    status: 'borrador',
    totalAmount: 34200.00,
    notes: 'Revisar garantía de 1 año directo con distribuidor.',
    items: [
      { id: 'item-4', code: 'EQ-XIA-NOTE13', productName: 'Xiaomi Redmi Note 13 256GB', quantity: 5, wholesalePrice: 3800.00, notes: 'Color Negro / Azul' },
      { id: 'item-5', code: 'EQ-SAM-A15', productName: 'Samsung Galaxy A15 128GB', quantity: 4, wholesalePrice: 3800.00, notes: 'Color Gris' }
    ]
  },
  {
    id: 'draft-3',
    title: 'Surtido de Refacciones Pantallas iPhone & Motorola',
    supplierName: 'Refaccionaria Móvil Express',
    createdAt: '2026-07-20',
    updatedAt: '2026-07-22',
    status: 'entregado',
    archivedAt: '2026-07-20',
    deliveredAt: '2026-07-22',
    totalAmount: 12400.00,
    notes: 'Recibido en almacén central y verificado sin defectos.',
    items: [
      { id: 'item-6', code: 'REF-DISP-IP11', productName: 'Display Calidad Original iPhone 11', quantity: 6, wholesalePrice: 1100.00, notes: 'Probado en recepción' },
      { id: 'item-7', code: 'REF-DISP-G60', productName: 'Display Completo Moto G60', quantity: 5, wholesalePrice: 850.00, notes: 'Con marco' },
      { id: 'item-8', code: 'REF-BAT-IP12', productName: 'Batería Alta Capacidad iPhone 12', quantity: 5, wholesalePrice: 310.00, notes: 'Cinta adhesiva incluida' }
    ]
  },
  {
    id: 'draft-4',
    title: 'Lote Adaptadores Carga Rápida & Cables Genéricos',
    supplierName: 'Mayorista Tech MX',
    createdAt: '2026-07-24',
    updatedAt: '2026-07-25',
    status: 'pendiente',
    archivedAt: '2026-07-24',
    totalAmount: 6350.00,
    notes: 'Pendiente de llegada por guía DHL #98421039.',
    items: [
      { id: 'item-9', code: 'CAB-USB-C', productName: 'Cable USB-C a USB-C 2m 60W', quantity: 40, wholesalePrice: 45.00, notes: 'Trenzado nylon' },
      { id: 'item-10', code: 'ADAP-30W', productName: 'Cargador de Pared 30W Dual USB', quantity: 30, wholesalePrice: 151.66, notes: 'Certificación CE' }
    ]
  }
];

// Sample Branch Requests
const INITIAL_BRANCH_REQUESTS: BranchStockRequest[] = [
  {
    id: 'req-101',
    branchId: 'b-navojoa',
    branchName: 'Navojoa',
    operatorName: 'Juan Pérez',
    productName: 'Micas de Cristal Templado iPhone 14 Pro',
    code: 'MIC-IP14P',
    currentStock: 0,
    requestedQty: 15,
    urgency: 'urgente',
    notes: 'Sin stock en exhibición. Clientes preguntando diariamente.',
    createdAt: 'Hace 40 min',
    status: 'pendiente'
  },
  {
    id: 'req-102',
    branchId: 'b-huatabampo',
    branchName: 'Huatabampo',
    operatorName: 'María García',
    productName: 'Cargador Tipo-C 20W Carga Rápida',
    code: 'CARG-20W',
    currentStock: 1,
    requestedQty: 10,
    urgency: 'normal',
    notes: 'Queda solo 1 pieza en exhibidor.',
    createdAt: 'Hace 2 horas',
    status: 'en_camino'
  },
  {
    id: 'req-103',
    branchId: 'b-navojoa',
    branchName: 'Navojoa',
    operatorName: 'Carlos López',
    productName: 'Cables Lightning a USB-C 1m',
    code: 'CAB-LGT-1M',
    currentStock: 2,
    requestedQty: 20,
    urgency: 'normal',
    notes: 'Se entregaron 10 piezas el martes.',
    createdAt: 'Ayer',
    status: 'cumplido'
  }
];

export default function PurchasesModule({
  notifications,
  products,
  currentBranch,
  onUpdateNotificationStatus,
  onOpenNoticeModal
}: PurchasesModuleProps) {
  const [activeTab, setActiveTab] = useState<'drive' | 'solicitudes' | 'historial'>('drive');
  
  // State for Purchase Drafts Drive
  const [drafts, setDrafts] = useState<PurchaseDraft[]>([]);
  const [searchDraftQuery, setSearchDraftQuery] = useState('');
  
  // State for Branch Requests
  const [branchRequests, setBranchRequests] = useState<BranchStockRequest[]>([]);
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // State for Historial & Archivo de Pedidos
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [viewingHistoryDraft, setViewingHistoryDraft] = useState<PurchaseDraft | null>(null);

  // Modal New / Edit Purchase Draft
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftItems, setDraftItems] = useState<PurchaseDraftItem[]>([]);

  // Toast / Feedback Copying
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Function to update status of an archived/active draft order
  const handleUpdateDraftStatus = (draftId: string, newStatus: PurchaseDraft['status']) => {
    const today = new Date().toISOString().split('T')[0];
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id === draftId) {
          const updated: PurchaseDraft = {
            ...d,
            status: newStatus,
            updatedAt: today,
            archivedAt: d.archivedAt || (newStatus !== 'borrador' ? today : undefined),
            deliveredAt: (newStatus === 'entregado' || newStatus === 'recibido') ? today : d.deliveredAt
          };

          // Also sync viewing modal if open
          if (viewingHistoryDraft && viewingHistoryDraft.id === draftId) {
            setViewingHistoryDraft(updated);
          }
          return updated;
        }
        return d;
      })
    );
  };

  // Function to explicitly archive a draft to history
  const handleArchiveDraft = (draft: PurchaseDraft) => {
    const today = new Date().toISOString().split('T')[0];
    const newStatus = draft.status === 'borrador' ? 'enviado_proveedor' : draft.status;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draft.id
          ? {
              ...d,
              status: newStatus,
              archivedAt: today,
              updatedAt: today
            }
          : d
      )
    );
  };

  // Duplicate order into a new draft
  const handleDuplicateDraft = (draft: PurchaseDraft) => {
    const newDraft: PurchaseDraft = {
      id: `draft-${Date.now()}`,
      title: `${draft.title} (Reorden)`,
      supplierName: draft.supplierName,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      items: draft.items.map((item) => ({ ...item, id: `item-${Date.now()}-${Math.random()}` })),
      totalAmount: draft.totalAmount,
      status: 'borrador',
      notes: `Duplicado a partir de pedido #${draft.id}`
    };
    setDrafts((prev) => [newDraft, ...prev]);
    setActiveTab('drive');
  };

  // Combine real notifications of type 'pedido_stock' into branchRequests list
  const combinedRequests = React.useMemo(() => {
    const list = [...branchRequests];
    // Add stock requests from AppNotifications if not already present
    notifications.forEach((n) => {
      if (n.type === 'pedido_stock' && n.requestDetails) {
        const exists = list.some((r) => r.notificationId === n.id);
        if (!exists) {
          list.unshift({
            id: `req-notif-${n.id}`,
            notificationId: n.id,
            branchId: n.branchId,
            branchName: n.title.includes('(') ? n.title.split('(')[1].replace(')', '') : 'Sucursal',
            operatorName: n.authorName,
            productName: n.requestDetails.productName,
            currentStock: n.requestDetails.currentStock,
            requestedQty: n.requestDetails.requestedQty,
            urgency: n.urgency,
            notes: n.message,
            createdAt: n.createdAt,
            status: n.requestDetails.status
          });
        }
      }
    });
    return list;
  }, [notifications, branchRequests]);

  // Open New Draft Modal
  const handleOpenNewDraft = (prefillItem?: { name: string; qty: number }) => {
    setCurrentDraftId(null);
    setDraftTitle(`Cotización de Pedido - ${new Date().toLocaleDateString('es-MX')}`);
    setSupplierName('');
    setDraftNotes('');
    if (prefillItem) {
      setDraftItems([
        {
          id: `item-${Date.now()}`,
          productName: prefillItem.name,
          quantity: prefillItem.qty,
          wholesalePrice: 0,
          notes: 'Generado desde solicitud de sucursal'
        }
      ]);
    } else {
      setDraftItems([
        {
          id: `item-1`,
          productName: '',
          quantity: 1,
          wholesalePrice: 0,
          notes: ''
        }
      ]);
    }
    setIsDraftModalOpen(true);
  };

  // Edit Existing Draft Modal
  const handleEditDraft = (draft: PurchaseDraft) => {
    setCurrentDraftId(draft.id);
    setDraftTitle(draft.title);
    setSupplierName(draft.supplierName);
    setDraftNotes(draft.notes || '');
    setDraftItems(draft.items.map(i => ({ ...i })));
    setIsDraftModalOpen(true);
  };

  // Add Item Row to Draft Modal
  const handleAddItemRow = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        productName: '',
        quantity: 1,
        wholesalePrice: 0,
        notes: ''
      }
    ]);
  };

  // Quick autofill from existing Product Catalog
  const handleAutofillFromProduct = (index: number, prodId: string) => {
    const p = products.find((x) => x.id === prodId);
    if (!p) return;
    setDraftItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        code: p.code,
        productName: p.name,
        wholesalePrice: p.costPrice || 0,
        supplier: p.supplier || ''
      };
      return copy;
    });
  };

  // Remove Item Row from Draft Modal
  const handleRemoveItemRow = (index: number) => {
    if (draftItems.length === 1) return;
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Draft Handler
  const handleSaveDraft = (status: PurchaseDraft['status'] = 'borrador') => {
    if (!draftTitle.trim()) return;

    const validItems = draftItems.filter((i) => i.productName.trim() !== '');
    if (validItems.length === 0) return;

    const total = validItems.reduce((acc, item) => acc + (item.quantity * item.wholesalePrice), 0);
    const today = new Date().toISOString().split('T')[0];

    if (currentDraftId) {
      // Update existing
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === currentDraftId
            ? {
                ...d,
                title: draftTitle.trim(),
                supplierName: supplierName.trim() || 'Proveedor General',
                notes: draftNotes.trim(),
                items: validItems,
                totalAmount: total,
                status,
                updatedAt: today,
                archivedAt: status !== 'borrador' ? (d.archivedAt || today) : d.archivedAt
              }
            : d
        )
      );
    } else {
      // Create new
      const newDraft: PurchaseDraft = {
        id: `draft-${Date.now()}`,
        title: draftTitle.trim(),
        supplierName: supplierName.trim() || 'Proveedor General',
        createdAt: today,
        updatedAt: today,
        archivedAt: status !== 'borrador' ? today : undefined,
        items: validItems,
        totalAmount: total,
        status,
        notes: draftNotes.trim()
      };
      setDrafts((prev) => [newDraft, ...prev]);
    }

    setIsDraftModalOpen(false);
    if (status !== 'borrador') {
      setActiveTab('historial');
    }
  };

  // Delete Draft
  const handleDeleteDraft = (id: string) => {
    if (window.confirm('¿Deseas eliminar este borrador de pedido?')) {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    }
  };

  // Generate WhatsApp / Email Clean Text
  const formatDraftForWhatsApp = (draft: PurchaseDraft): string => {
    let text = `📋 *SOLICITUD DE PEDIDO / COTIZACIÓN*\n`;
    text += `*Proveedor:* ${draft.supplierName || 'General'}\n`;
    text += `*Fecha:* ${draft.createdAt}\n`;
    if (draft.title) text += `*Asunto:* ${draft.title}\n`;
    text += `-----------------------------------\n`;
    text += `*LISTA DE PRODUCTOS SOLICITADOS:*\n\n`;

    draft.items.forEach((item, idx) => {
      const codeStr = item.code ? `[${item.code}] ` : '';
      const priceStr = item.wholesalePrice > 0 ? ` @ $${item.wholesalePrice.toFixed(2)} c/u` : '';
      const subtotalStr = item.wholesalePrice > 0 ? ` = *$${(item.quantity * item.wholesalePrice).toFixed(2)}*` : '';
      text += `${idx + 1}. ${codeStr}${item.productName}\n   • Cantidad: *${item.quantity} pzs*${priceStr}${subtotalStr}\n`;
      if (item.notes) text += `   • Nota: _${item.notes}_\n`;
    });

    text += `-----------------------------------\n`;
    if (draft.totalAmount > 0) {
      text += `💰 *TOTAL ESTIMADO:* $${draft.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n`;
    }
    if (draft.notes) {
      text += `📌 *Observaciones:* ${draft.notes}\n`;
    }
    text += `\nFavor de confirmar disponibilidad y tiempo de entrega. ¡Gracias!`;
    return text;
  };

  // Copy WhatsApp Text to Clipboard
  const handleCopyDraftWhatsApp = (draft: PurchaseDraft) => {
    const text = formatDraftForWhatsApp(draft);
    navigator.clipboard.writeText(text);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Change Request Status in Branch Requests List
  const handleUpdateStatus = (reqId: string, notifId: string | undefined, newStatus: 'pendiente' | 'en_camino' | 'cumplido') => {
    setBranchRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: newStatus } : r))
    );
    if (notifId && onUpdateNotificationStatus) {
      onUpdateNotificationStatus(notifId, newStatus);
    }
  };

  // Filtered Drafts
  const filteredDrafts = drafts;

  // Filtered Branch Requests
  const filteredRequests = combinedRequests.filter((r) => {
    const matchesBranch = filterBranch === 'all' || r.branchId === filterBranch || r.branchName.toLowerCase().includes(filterBranch.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesBranch && matchesStatus;
  });

  const pendingRequestsCount = combinedRequests.filter((r) => r.status === 'pendiente').length;

  // Archived / Sent / Historical Purchase Orders
  const archivedDrafts = React.useMemo(() => {
    return drafts.filter((d) => {
      const isArchived = d.status !== 'borrador' || Boolean(d.archivedAt);

      const matchesStatus =
        historyStatusFilter === 'all'
          ? true
          : historyStatusFilter === 'entregado'
          ? d.status === 'entregado' || d.status === 'recibido'
          : d.status === historyStatusFilter;

      return isArchived && matchesStatus;
    });
  }, [drafts, historyStatusFilter]);

  // History Metrics & Summary
  const historyStats = React.useMemo(() => {
    const allArchived = drafts.filter((d) => d.status !== 'borrador' || Boolean(d.archivedAt));
    const totalCount = allArchived.length;

    const deliveredOrders = allArchived.filter((d) => d.status === 'entregado' || d.status === 'recibido');
    const deliveredCount = deliveredOrders.length;
    const deliveredAmount = deliveredOrders.reduce((sum, d) => sum + d.totalAmount, 0);

    const pendingOrders = allArchived.filter((d) => d.status === 'enviado_proveedor' || d.status === 'pendiente');
    const pendingCount = pendingOrders.length;
    const pendingAmount = pendingOrders.reduce((sum, d) => sum + d.totalAmount, 0);

    const uniqueSuppliers = new Set(allArchived.map((d) => d.supplierName.trim()).filter(Boolean)).size;

    return {
      totalCount,
      deliveredCount,
      deliveredAmount,
      pendingCount,
      pendingAmount,
      uniqueSuppliers
    };
  }, [drafts]);

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Primary Navigation Tabs */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-b border-slate-200 pb-2 pt-1">
        <div className="flex flex-wrap gap-2 bg-slate-200/60 p-1 rounded-2xl border border-slate-300/60">
          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              activeTab === 'drive'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            Borradores & Cotizaciones
            <span className="ml-1 px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-700">
              {drafts.filter(d => d.status === 'borrador').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('solicitudes')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'solicitudes'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            Pedidos de Mis Sucursales
            {pendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-600 text-white animate-pulse">
                {pendingRequestsCount} pendientes
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'historial'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-amber-400" />
            Historial de Pedidos & Archivo
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-slate-950">
              {historyStats.totalCount}
            </span>
          </button>
        </div>

        {/* Tab Controls Right Filter Bar */}
        {activeTab === 'solicitudes' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-extrabold">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Estado:
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900"
            >
              <option value="all">Todos los Estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_camino">En Camino</option>
              <option value="cumplido">Cumplidos</option>
            </select>
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-extrabold">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Estado:
            </div>
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900"
            >
              <option value="all">Todos los Estados</option>
              <option value="enviado_proveedor">🚀 Enviados a Proveedor</option>
              <option value="pendiente">⏳ Pendientes de Entrega</option>
              <option value="entregado">✅ Entregados / Surtidos</option>
              <option value="cancelado">❌ Cancelados</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: BORRADORES & COTIZACIONES (DRIVE FORMAT) */}
      {activeTab === 'drive' && (
        <div className="space-y-4">
          
          {filteredDrafts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm">No hay borradores ni cotizaciones guardadas</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                Crea listas de pedido organizadas en columnas para cotizar con proveedores y enviarlas directamente por WhatsApp.
              </p>
              <button
                onClick={() => handleOpenNewDraft()}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                Crear Mi Primer Pedido
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDrafts.map((draft) => (
                <div 
                  key={draft.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          draft.status === 'borrador'
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : draft.status === 'enviado_proveedor'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : draft.status === 'pendiente'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : draft.status === 'cancelado'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {draft.status === 'borrador'
                            ? '📁 Borrador'
                            : draft.status === 'enviado_proveedor'
                            ? '🚀 Enviado a Proveedor'
                            : draft.status === 'pendiente'
                            ? '⏳ Pendiente'
                            : draft.status === 'cancelado'
                            ? '❌ Cancelado'
                            : '✅ Recibido / Surtido'}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                          {draft.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleArchiveDraft(draft)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Archivar en Historial"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditDraft(draft)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Editar Cotización"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Borrador"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold pt-1 border-t border-slate-100">
                      <span>Proveedor: <strong className="text-slate-800">{draft.supplierName}</strong></span>
                      <span className="text-[11px] font-mono text-slate-400">{draft.createdAt}</span>
                    </div>

                    {/* Preview of Items Table */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 pb-1 border-b border-slate-200">
                        <span>{draft.items.length} producto(s) en lista</span>
                        <span className="font-mono">Subtotales</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {draft.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[190px] font-semibold text-slate-800">
                              <span className="text-blue-600 font-extrabold">{item.quantity}x</span> {item.productName}
                            </span>
                            <span className="font-mono font-bold text-slate-700">
                              ${(item.quantity * item.wholesalePrice).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Estimado</span>
                      <span className="text-sm font-black text-slate-900 font-mono">
                        ${draft.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyDraftWhatsApp(draft)}
                        className={`p-2 rounded-xl transition-all cursor-pointer shadow-xs ${
                          copiedId === draft.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        }`}
                        title="Copiar texto listo para enviar por WhatsApp al proveedor"
                      >
                        {copiedId === draft.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* TAB CONTENT 2: PEDIDOS DE MIS SUCURSALES (LISTA INTERACTIVA) */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-4">
          
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-extrabold text-slate-800 text-sm">No hay solicitudes de sucursal en este filtro</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Los operadores pueden enviar solicitudes de productos o alertas de stock agotado desde la sección de recados.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    Control de Requerimientos de Stock por Sucursal ({filteredRequests.length})
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  Selecciona el estado para dar seguimiento en tiempo real
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredRequests.map((req) => {
                  const isStockZero = req.currentStock === 0;
                  return (
                    <div 
                      key={req.id} 
                      className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                        req.status === 'cumplido' ? 'bg-slate-50/60 opacity-80' : 'hover:bg-amber-50/30'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-slate-900 text-white">
                            📍 {req.branchName}
                          </span>

                          <span className="text-xs font-bold text-slate-600">
                            Solicita: <strong className="text-slate-900 font-extrabold">{req.requestedQty} pzs</strong> de <span className="text-blue-700 font-black">{req.productName}</span>
                          </span>

                          {isStockZero ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              STOCK NULO (0 PZS)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                              Stock actual: {req.currentStock} pzs
                            </span>
                          )}

                          {req.urgency === 'urgente' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white animate-pulse">
                              🔥 URGENTE
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 font-medium pl-1">
                          {req.notes || 'Sin observaciones adicionales.'}
                        </p>

                        <div className="text-[11px] text-slate-400 font-bold pl-1 flex items-center gap-3">
                          <span>Operador: {req.operatorName}</span>
                          <span>•</span>
                          <span>{req.createdAt}</span>
                        </div>
                      </div>

                      {/* Controls & Actions */}
                      <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenNewDraft({ name: req.productName, qty: req.requestedQty })}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                          title="Convertir esta solicitud en un nuevo borrador de pedido al proveedor"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Crear Cotización
                        </button>

                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() => handleUpdateStatus(req.id, req.notificationId, 'pendiente')}
                            className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                              req.status === 'pendiente'
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Pendiente
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req.id, req.notificationId, 'en_camino')}
                            className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                              req.status === 'en_camino'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            En Camino
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req.id, req.notificationId, 'cumplido')}
                            className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                              req.status === 'cumplido'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Cumplido
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB CONTENT 3: HISTORIAL & ARCHIVO DE PEDIDOS (TRACKING Y SEGUIMIENTO) */}
      {activeTab === 'historial' && (
        <div className="space-y-6">
          
          {/* Metrics Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Total Archivados</span>
                <Archive className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{historyStats.totalCount}</p>
              <p className="text-[11px] text-slate-500 font-medium">Pedidos y cotizaciones registradas</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Entregados / Surtidos</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-600">
                ${historyStats.deliveredAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {historyStats.deliveredCount} pedido(s) recibido(s)
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Pendientes / En Camino</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-amber-600">
                ${historyStats.pendingAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {historyStats.pendingCount} pedido(s) en seguimiento
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Proveedores Activos</span>
                <Store className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{historyStats.uniqueSuppliers}</p>
              <p className="text-[11px] text-slate-500 font-medium">Distribuidoras en catálogo</p>
            </div>
          </div>

          {/* History Orders List */}
          {archivedDrafts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <History className="w-7 h-7 text-slate-500" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm">No hay pedidos archivados con este criterio</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                Al enviar una cotización a proveedor o cambiar su estado a "Enviado" o "Entregado", se archivará automáticamente aquí para su historial.
              </p>
              <button
                onClick={() => setActiveTab('drive')}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                Ir a Borradores & Cotizaciones
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">
                  Historial Cronológico de Pedidos ({archivedDrafts.length})
                </h3>
                <span className="text-[11px] text-slate-500 font-bold">
                  Haz clic en el estado para actualizarlo en tiempo real
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {archivedDrafts.map((draft) => {
                  const isDelivered = draft.status === 'entregado' || draft.status === 'recibido';
                  const isPending = draft.status === 'enviado_proveedor' || draft.status === 'pendiente';
                  const isCancelled = draft.status === 'cancelado';

                  return (
                    <div 
                      key={draft.id} 
                      className={`bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col md:flex-row items-stretch justify-between ${
                        isDelivered ? 'border-l-4 border-l-emerald-500' : isPending ? 'border-l-4 border-l-amber-500' : isCancelled ? 'border-l-4 border-l-red-500' : ''
                      }`}
                    >
                      {/* Left Block: Basic Info */}
                      <div className="p-5 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-slate-900 text-amber-400">
                              #{draft.id.toUpperCase().replace('DRAFT-', 'ORD-')}
                            </span>
                            <h4 className="font-extrabold text-sm text-slate-900">{draft.title}</h4>
                          </div>

                          {/* Quick Status Pill Picker */}
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                              onClick={() => handleUpdateDraftStatus(draft.id, 'enviado_proveedor')}
                              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                draft.status === 'enviado_proveedor'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Enviado
                            </button>
                            <button
                              onClick={() => handleUpdateDraftStatus(draft.id, 'pendiente')}
                              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                draft.status === 'pendiente'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Pendiente
                            </button>
                            <button
                              onClick={() => handleUpdateDraftStatus(draft.id, 'entregado')}
                              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                isDelivered
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Entregado
                            </button>
                            <button
                              onClick={() => handleUpdateDraftStatus(draft.id, 'cancelado')}
                              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                isCancelled
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Cancelado
                            </button>
                          </div>
                        </div>

                        {/* Meta Details */}
                        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 font-medium">
                          <div className="flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            Proveedor: <strong className="text-slate-800 font-bold">{draft.supplierName}</strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Pedido: <span className="font-mono font-bold text-slate-700">{draft.createdAt}</span>
                          </div>
                          {draft.deliveredAt && (
                            <div className="flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Entregado: <span className="font-mono">{draft.deliveredAt}</span>
                            </div>
                          )}
                        </div>

                        {/* Items Snapshot Table */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                          <div className="text-[11px] font-extrabold text-slate-500 flex items-center justify-between pb-1 border-b border-slate-200 uppercase tracking-wider">
                            <span>Artículos en Lista ({draft.items.length})</span>
                            <span>Cant. & Subtotales</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {draft.items.slice(0, 4).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className="truncate max-w-[200px] text-slate-800 font-semibold">
                                  <span className="font-extrabold text-blue-600">{item.quantity}x</span> {item.productName}
                                </span>
                                <span className="font-mono font-bold text-slate-700">
                                  ${(item.quantity * item.wholesalePrice).toFixed(2)}
                                </span>
                              </div>
                            ))}
                            {draft.items.length > 4 && (
                              <div className="text-[11px] font-extrabold text-blue-600 pt-1">
                                + {draft.items.length - 4} productos más...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Amount & Actions */}
                      <div className="bg-slate-50/80 p-5 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col justify-between gap-4 md:w-64 shrink-0">
                        <div>
                          <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Importe Total</span>
                          <span className="text-xl font-black text-slate-900 font-mono">
                            ${draft.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                          </span>
                        </div>

                        <div className="space-y-2">
                          <button
                            onClick={() => setViewingHistoryDraft(draft)}
                            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            Ver Detalle Completo
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleCopyDraftWhatsApp(draft)}
                              className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                              title="Copiar texto para WhatsApp"
                            >
                              {copiedId === draft.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                            </button>

                            <button
                              onClick={() => handleDuplicateDraft(draft)}
                              className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all"
                              title="Reutilizar / Duplicar como nuevo pedido"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                              Duplicar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL: VER DETALLE COMPLETO DE PEDIDO EN HISTORIAL */}
      {viewingHistoryDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-base leading-none">
                    Detalle de Pedido #{viewingHistoryDraft.id.toUpperCase().replace('DRAFT-', 'ORD-')}
                  </h3>
                  <span className="text-[11px] text-slate-300 font-medium">
                    Proveedor: {viewingHistoryDraft.supplierName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingHistoryDraft(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Status Timeline */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Línea de Tiempo del Pedido
                </h4>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                      1
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-800 block">Cotización Creada</span>
                      <span className="text-[11px] text-slate-500 font-mono">{viewingHistoryDraft.createdAt}</span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />

                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-extrabold flex items-center justify-center text-xs">
                      2
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-800 block">Enviado / Archivo</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {viewingHistoryDraft.archivedAt || viewingHistoryDraft.createdAt}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />

                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-full font-extrabold flex items-center justify-center text-xs ${
                      viewingHistoryDraft.deliveredAt ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                    }`}>
                      3
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-800 block">Surtido & Entrega</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {viewingHistoryDraft.deliveredAt || 'Pendiente de llegada'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Desglose de Productos ({viewingHistoryDraft.items.length})
                </h4>

                <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-300 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5 w-28">Código</th>
                        <th className="p-2.5">Descripción del Producto</th>
                        <th className="p-2.5 text-center w-20">Cant.</th>
                        <th className="p-2.5 text-right w-28">Precio U. ($)</th>
                        <th className="p-2.5 text-right w-28">Subtotal ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {viewingHistoryDraft.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-700 uppercase">{item.code || '-'}</td>
                          <td className="p-2.5">
                            <span className="font-extrabold text-slate-900 block">{item.productName}</span>
                            {item.notes && <span className="text-[11px] text-slate-500 italic">{item.notes}</span>}
                          </td>
                          <td className="p-2.5 text-center font-extrabold text-blue-700">{item.quantity} pzs</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-700">
                            ${item.wholesalePrice.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-slate-900">
                            ${(item.quantity * item.wholesalePrice).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes & Total Banner */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Observaciones del Pedido</span>
                  <p className="text-xs text-slate-300 font-medium italic">
                    {viewingHistoryDraft.notes || 'Sin notas adicionales asociadas a este pedido.'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-amber-400 font-extrabold block uppercase">Importe Total Calculado</span>
                  <span className="text-xl font-black font-mono text-white">
                    ${viewingHistoryDraft.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateDraftStatus(viewingHistoryDraft.id, 'entregado')}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Marcar como Entregado / Surtido
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateDraft(viewingHistoryDraft)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Duplicar Pedido
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyDraftWhatsApp(viewingHistoryDraft)}
                  className="p-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-white cursor-pointer flex items-center justify-center"
                  title="Copiar texto para WhatsApp"
                >
                  {copiedId === viewingHistoryDraft.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-emerald-600" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewingHistoryDraft(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer shadow-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR COTIZACIÓN DE PEDIDO (GRID / TABLA EN CELDAS Y COLUMNAS) */}
      {isDraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base">
                  {currentDraftId ? 'Editar Cotización / Pedido' : 'Nueva Cotización de Pedido'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with Table Form */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Meta Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Título o Asunto de la Cotización *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pedido Micas y Cargadores Mayo"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Nombre del Proveedor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Distribuidora Celular MX"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Table Grid of Products */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Renglones del Pedido / Productos Solicitados
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    + Agregar Renglón
                  </button>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-300 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5 w-32">Código</th>
                        <th className="p-2.5">Producto / Descripción</th>
                        <th className="p-2.5 text-center w-24">Cant. (pzs)</th>
                        <th className="p-2.5 text-right w-28">P. Mayoreo ($)</th>
                        <th className="p-2.5 text-right w-28">Subtotal ($)</th>
                        <th className="p-2.5 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {draftItems.map((item, idx) => {
                        const subtotal = item.quantity * item.wholesalePrice;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 text-center font-extrabold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Ej. MIC-IP13"
                                value={item.code || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftItems((prev) => {
                                    const copy = [...prev];
                                    copy[idx].code = val;
                                    return copy;
                                  });
                                }}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-blue-600"
                              />
                            </td>
                            <td className="p-2 space-y-1">
                              <input
                                type="text"
                                required
                                placeholder="Ej. Mica Cristal Templado iPhone 13"
                                value={item.productName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftItems((prev) => {
                                    const copy = [...prev];
                                    copy[idx].productName = val;
                                    return copy;
                                  });
                                }}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-blue-600"
                              />
                              {/* Quick Autofill Selector from Catalog */}
                              <select
                                onChange={(e) => {
                                  if (e.target.value) handleAutofillFromProduct(idx, e.target.value);
                                }}
                                defaultValue=""
                                className="w-full text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded py-0.5 px-1 cursor-pointer"
                              >
                                <option value="" disabled>⚡ Autocompletar desde mi inventario...</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} (Costo: ${p.costPrice || 0})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 1;
                                  setDraftItems((prev) => {
                                    const copy = [...prev];
                                    copy[idx].quantity = val;
                                    return copy;
                                  });
                                }}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-extrabold text-center text-slate-900 focus:ring-2 focus:ring-blue-600"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.wholesalePrice || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setDraftItems((prev) => {
                                    const copy = [...prev];
                                    copy[idx].wholesalePrice = val;
                                    return copy;
                                  });
                                }}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right text-slate-900 focus:ring-2 focus:ring-blue-600"
                              />
                            </td>
                            <td className="p-2.5 text-right font-mono font-black text-slate-900 text-xs">
                              ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                disabled={draftItems.length === 1}
                                className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Summary Footer */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block uppercase">Total General Calculado</span>
                  <span className="text-xl font-black font-mono text-amber-400">
                    ${draftItems.reduce((acc, i) => acc + (i.quantity * i.wholesalePrice), 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>

                <div className="w-full sm:w-1/2">
                  <input
                    type="text"
                    placeholder="Notas / Observaciones generales..."
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSaveDraft('enviado_proveedor')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Marcar como Enviado a Proveedor
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDraftModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDraft('borrador')}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer shadow-sm"
                >
                  Guardar Borrador
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) - Nuevo Pedido */}
      <button
        onClick={() => handleOpenNewDraft()}
        title="Crear Nuevo Pedido / Cotización"
        className="fixed bottom-6 right-6 z-40 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border-2 border-amber-300/80 transition-all cursor-pointer group"
      >
        <Plus className="w-8 h-8 stroke-[3] transition-transform group-hover:rotate-90" />
      </button>

    </div>
  );
}
