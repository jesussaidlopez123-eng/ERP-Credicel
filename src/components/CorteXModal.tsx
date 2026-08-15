import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  CreditCard, 
  TrendingDown, 
  Printer, 
  X, 
  Store, 
  Clock, 
  User, 
  PackageCheck, 
  Zap, 
  Receipt, 
  ShoppingBag, 
  Wrench, 
  Tag, 
  LogOut,
  ChevronDown, 
  ChevronUp,
  FileCheck2,
  Copy,
  Check,
  Share2,
  CheckSquare,
  Square,
  ListChecks,
  Search,
  SlidersHorizontal,
  FileText,
  Smartphone,
  Send,
  DollarSign,
  Wallet,
  AlertCircle,
  Coins,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  Sparkles,
  Download,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { SaleTicket, Expense, Branch, Operator, CorteXRecord, CartItemMetadata } from '../types';
import { parseSafeDate, safeDateIsoKey, safeFormatDate, safeFormatTime } from '../lib/dateUtils';

interface CorteXModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: SaleTicket[];
  expenses: Expense[];
  currentBranch: Branch;
  currentOperator: Operator;
  initialCashFund?: number;
  existingCorteRecord?: CorteXRecord | null;
  onFinalizeCorteX?: (corteRecord: CorteXRecord) => void;
  onLogout?: () => void;
}

interface ConceptDetail {
  ticketFolio: string;
  paymentMethod: string;
  time: string;
  qty: number;
  totalPrice: number;
  metadata?: CartItemMetadata;
}

interface ConceptGroup {
  name: string;
  count: number;
  total: number;
  category: string;
  details: ConceptDetail[];
}

export interface DetailedSoldItem {
  id: string; // unique item key
  ticketId: string;
  ticketFolio: string;
  time: string;
  productName: string;
  category: string;
  categoryLabel: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: string;
  metadata?: CartItemMetadata;
}

export default function CorteXModal({
  isOpen,
  onClose,
  tickets,
  expenses,
  currentBranch,
  currentOperator,
  initialCashFund = 1000.00,
  existingCorteRecord,
  onFinalizeCorteX,
  onLogout
}: CorteXModalProps) {

  // Main navigation tab
  const [activeTab, setActiveTab] = useState<'arqueo' | 'copiar_lista' | 'reporte_pdf'>('arqueo');
  const [printMode, setPrintMode] = useState<'thermal' | 'pdf'>('pdf');

  // Accordion state in arqueo view
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    accesorios: false,
    abonos: false,
    enganches: false,
    reparaciones: false,
    recargas: false,
    gastos: false,
  });

  // Copy & Selection State
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Shift Finalization & Fondo Left state
  const [isClosingShiftDialog, setIsClosingShiftDialog] = useState(false);
  const [nextCashFundInput, setNextCashFundInput] = useState<string>('');
  const [shiftClosureNotes, setShiftClosureNotes] = useState<string>('');

  // Options for what to include when copying
  const [copySettings, setCopySettings] = useState({
    includeHeader: true,
    includeFinancialSummary: true,
    includeSoldList: true,
    includeExpenseList: true,
    includeDrawerBalance: true,
    includePaymentMethods: true,
    showTicketFolios: true,
    showPaymentDetails: true,
  });

  // Track selected items and expenses for custom export
  const [selectedSoldItemIds, setSelectedSoldItemIds] = useState<Set<string>>(new Set());
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  if (!isOpen) return null;

  const isHistoric = !!existingCorteRecord;

  // Determine branch info
  const effectiveBranchName = isHistoric ? existingCorteRecord.branchName : currentBranch.name;
  const effectiveBranchId = isHistoric ? existingCorteRecord.branchId : currentBranch.id;
  const effectiveOperatorName = isHistoric ? existingCorteRecord.operatorName : currentOperator.name;
  
  // Stored branch initial cash fund (from previous shift's left fund, or default)
  const storedBranchFund = useMemo(() => {
    try {
      const saved = localStorage.getItem(`erp_branch_fund_${effectiveBranchId}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // ignore
    }
    return initialCashFund !== undefined ? initialCashFund : 1000.00;
  }, [effectiveBranchId, initialCashFund]);

  const effectiveInitialCash = isHistoric ? existingCorteRecord.initialCashFund : storedBranchFund;

  // Filter for effective branch / tickets
  let branchTickets: SaleTicket[] = [];
  let branchExpenses: Expense[] = [];

  if (isHistoric) {
    if (existingCorteRecord.ticketsSnapshot && Array.isArray(existingCorteRecord.ticketsSnapshot) && existingCorteRecord.ticketsSnapshot.length > 0) {
      branchTickets = existingCorteRecord.ticketsSnapshot;
    } else {
      const historicDateKey = safeDateIsoKey(existingCorteRecord.timestamp);
      branchTickets = (tickets || []).filter((t) => 
        t && (
          existingCorteRecord.ticketIds?.includes(t.id) || 
          (t.corteXId === existingCorteRecord.id) ||
          (t.branchId === effectiveBranchId && safeDateIsoKey(t.timestamp) === historicDateKey)
        )
      );
    }

    if (existingCorteRecord.expensesSnapshot && Array.isArray(existingCorteRecord.expensesSnapshot) && existingCorteRecord.expensesSnapshot.length > 0) {
      branchExpenses = existingCorteRecord.expensesSnapshot;
    } else {
      const historicDateKey = safeDateIsoKey(existingCorteRecord.timestamp);
      branchExpenses = (expenses || []).filter((e) => 
        e && (
          existingCorteRecord.expenseIds?.includes(e.id) || 
          (e.corteXId === existingCorteRecord.id) ||
          (e.branchId === effectiveBranchId && safeDateIsoKey(e.timestamp || e.date) === historicDateKey)
        )
      );
    }
  } else {
    // Active current shift: only unclosed tickets/expenses for current branch
    branchTickets = (tickets || []).filter((t) => t && t.branchId === effectiveBranchId && !t.corteXId);
    branchExpenses = (expenses || []).filter((e) => e && e.branchId === effectiveBranchId && !e.corteXId);
  }

  // Payment totals
  let cashSalesTotal = 0;
  let cardSalesTotal = 0;
  let transferSalesTotal = 0;

  // Categorized Income Breakdown Counters
  let totalAccesoriosProductos = 0;
  let countAccesoriosProductos = 0;

  let totalAbonos = 0;
  let countAbonos = 0;

  let totalEnganches = 0;
  let countEnganches = 0;

  let totalReparaciones = 0;
  let countReparaciones = 0;

  let totalRecargas = 0;
  let countRecargas = 0;

  // Group items by category and concept name
  const categoryConceptMaps: Record<string, Record<string, ConceptGroup>> = {
    accesorios: {},
    abonos: {},
    enganches: {},
    reparaciones: {},
    recargas: {},
  };

  // Build a flat list of individual sold line items
  const allDetailedSoldItems: DetailedSoldItem[] = [];

  branchTickets.forEach((ticket) => {
    if (!ticket) return;
    const ticketTotal = typeof ticket.total === 'number' ? ticket.total : parseFloat((ticket.total as any) || '0') || 0;
    const paymentMethod = ticket.paymentMethod || 'Efectivo';
    if (paymentMethod === 'Efectivo') cashSalesTotal += ticketTotal;
    if (paymentMethod === 'Tarjeta') cardSalesTotal += ticketTotal;
    if (paymentMethod === 'Transferencia') transferSalesTotal += ticketTotal;

    const items = Array.isArray(ticket.items) ? ticket.items : [];
    items.forEach((item, itemIdx) => {
      if (!item) return;
      const pName = (item?.product?.name || item?.metadata?.repairType || (item?.metadata as any)?.planName || 'Artículo').toString();
      const pNameLower = pName.toLowerCase();
      const cat = (item?.product?.category || 'accesorio').toString();
      const qty = typeof item?.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
      const itemTotal = typeof item?.totalPrice === 'number' 
        ? item.totalPrice 
        : (typeof item?.unitPrice === 'number' ? item.unitPrice * qty : parseFloat((item?.totalPrice as any) || '0') || 0);
      const unitPrice = typeof item?.unitPrice === 'number' ? item.unitPrice : (qty > 0 ? itemTotal / qty : itemTotal);
      const timeStr = safeFormatTime(ticket.timestamp);

      let catKey = 'accesorios';
      let categoryLabel = 'Accesorios y Productos';

      // Categorize Income Type
      if (pNameLower.includes('abono')) {
        totalAbonos += itemTotal;
        countAbonos += qty;
        catKey = 'abonos';
        categoryLabel = 'Abonos a Crédito';
      } else if (pNameLower.includes('enganche') || (cat === 'equipo_credito' && !pNameLower.includes('abono'))) {
        totalEnganches += itemTotal;
        countEnganches += qty;
        catKey = 'enganches';
        categoryLabel = 'Enganches de Celular';
      } else if (pNameLower.includes('anticipo') || pNameLower.includes('liquidaci') || pNameLower.includes('saldo final') || cat === 'servicio' || item?.metadata?.repairType) {
        totalReparaciones += itemTotal;
        countReparaciones += qty;
        catKey = 'reparaciones';
        categoryLabel = 'Taller / Reparaciones';
      } else if (cat === 'recarga' || pNameLower.includes('recarga')) {
        totalRecargas += itemTotal;
        countRecargas += qty;
        catKey = 'recargas';
        categoryLabel = 'Recargas Tiempo Aire';
      } else {
        totalAccesoriosProductos += itemTotal;
        countAccesoriosProductos += qty;
        catKey = 'accesorios';
        categoryLabel = 'Accesorios y Productos';
      }

      // Group for specific breakdown table
      let conceptName = pName;
      if (pNameLower.includes('abono')) {
        const match = conceptName.match(/Abono.*?\(([^)]+)\)/i);
        if (match && match[1]) {
          conceptName = `Abono a Crédito (${match[1]})`;
        } else {
          conceptName = 'Abono a Crédito';
        }
      }

      const detailObj: ConceptDetail = {
        ticketFolio: ticket.folio || ticket.id || 'S/F',
        paymentMethod: paymentMethod,
        time: timeStr,
        qty,
        totalPrice: itemTotal,
        metadata: item?.metadata
      };

      if (!categoryConceptMaps[catKey]) {
        categoryConceptMaps[catKey] = {};
      }

      if (!categoryConceptMaps[catKey][conceptName]) {
        categoryConceptMaps[catKey][conceptName] = {
          name: conceptName,
          count: 0,
          total: 0,
          category: cat,
          details: []
        };
      }

      categoryConceptMaps[catKey][conceptName].count += qty;
      categoryConceptMaps[catKey][conceptName].total += itemTotal;
      categoryConceptMaps[catKey][conceptName].details.push(detailObj);

      allDetailedSoldItems.push({
        id: `${ticket.id || 't'}_${itemIdx}_${item?.product?.id || itemIdx}`,
        ticketId: ticket.id || '',
        ticketFolio: ticket.folio || ticket.id || 'S/F',
        time: timeStr,
        productName: pName,
        category: catKey,
        categoryLabel,
        quantity: qty,
        unitPrice,
        totalPrice: itemTotal,
        paymentMethod: paymentMethod,
        metadata: item?.metadata
      });
    });
  });

  // Group Expenses by concept
  const expenseMap: Record<string, { concept: string; count: number; total: number }> = {};
  branchExpenses.forEach((exp) => {
    if (!exp) return;
    const key = (exp.concept || 'Gasto general').toString().trim() || 'Gasto general';
    const amount = typeof exp.amount === 'number' ? exp.amount : parseFloat((exp.amount as any) || '0') || 0;
    if (!expenseMap[key]) {
      expenseMap[key] = { concept: key, count: 0, total: 0 };
    }
    expenseMap[key].count += 1;
    expenseMap[key].total += amount;
  });

  const groupedExpenseList = Object.values(expenseMap).sort((a, b) => b.total - a.total);

  const categoryItems = {
    accesorios: Object.values(categoryConceptMaps.accesorios || {}).sort((a, b) => b.total - a.total),
    abonos: Object.values(categoryConceptMaps.abonos || {}).sort((a, b) => b.total - a.total),
    enganches: Object.values(categoryConceptMaps.enganches || {}).sort((a, b) => b.total - a.total),
    reparaciones: Object.values(categoryConceptMaps.reparaciones || {}).sort((a, b) => b.total - a.total),
    recargas: Object.values(categoryConceptMaps.recargas || {}).sort((a, b) => b.total - a.total),
    gastos: groupedExpenseList,
  };

  // If historic and had stored breakdown totals, use them as authoritative
  if (isHistoric && existingCorteRecord) {
    if (existingCorteRecord.cashSales !== undefined) cashSalesTotal = existingCorteRecord.cashSales;
    if (existingCorteRecord.cardSales !== undefined) cardSalesTotal = existingCorteRecord.cardSales;
    if (existingCorteRecord.transferSales !== undefined) transferSalesTotal = existingCorteRecord.transferSales;
    if (existingCorteRecord.breakdown) {
      if (existingCorteRecord.breakdown.accesoriosTotal) totalAccesoriosProductos = existingCorteRecord.breakdown.accesoriosTotal;
      if (existingCorteRecord.breakdown.accesoriosCount) countAccesoriosProductos = existingCorteRecord.breakdown.accesoriosCount;
      if (existingCorteRecord.breakdown.abonosTotal) totalAbonos = existingCorteRecord.breakdown.abonosTotal;
      if (existingCorteRecord.breakdown.abonosCount) countAbonos = existingCorteRecord.breakdown.abonosCount;
      if (existingCorteRecord.breakdown.enganchesTotal) totalEnganches = existingCorteRecord.breakdown.enganchesTotal;
      if (existingCorteRecord.breakdown.enganchesCount) countEnganches = existingCorteRecord.breakdown.enganchesCount;
      if (existingCorteRecord.breakdown.reparacionesTotal) totalReparaciones = existingCorteRecord.breakdown.reparacionesTotal;
      if (existingCorteRecord.breakdown.reparacionesCount) countReparaciones = existingCorteRecord.breakdown.reparacionesCount;
      if (existingCorteRecord.breakdown.recargasTotal) totalRecargas = existingCorteRecord.breakdown.recargasTotal;
      if (existingCorteRecord.breakdown.recargasCount) countRecargas = existingCorteRecord.breakdown.recargasCount;
    }
  }

  const totalSalesAll = isHistoric ? existingCorteRecord.totalSales : (cashSalesTotal + cardSalesTotal + transferSalesTotal);
  const totalExpenses = isHistoric ? existingCorteRecord.totalExpenses : branchExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netIncome = isHistoric ? existingCorteRecord.netIncome : (totalSalesAll - totalExpenses);
  const expectedCashInDrawer = isHistoric ? existingCorteRecord.expectedCashInDrawer : (effectiveInitialCash + cashSalesTotal - totalExpenses);
  const cardAndTransferTotal = cardSalesTotal + transferSalesTotal;

  const corteFolio = isHistoric ? existingCorteRecord.id : `CTX-${Date.now().toString().slice(-6)}`;
  const currentDateStr = isHistoric ? existingCorteRecord.dateStr : new Date().toLocaleDateString('es-MX');
  const currentTimeStr = isHistoric ? existingCorteRecord.timeStr : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  // Initialize selected items if not yet set
  if (!hasInitializedSelection && (allDetailedSoldItems.length > 0 || branchExpenses.length > 0)) {
    setSelectedSoldItemIds(new Set(allDetailedSoldItems.map(i => i.id)));
    setSelectedExpenseIds(new Set(branchExpenses.map(e => e.id)));
    setHasInitializedSelection(true);
  }

  // Filter items in custom selection view
  const filteredSoldItems = useMemo(() => {
    return allDetailedSoldItems.filter(item => {
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
      const matchSearch = !searchFilter.trim() || 
        item.productName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.ticketFolio.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (item.metadata?.clientName && item.metadata.clientName.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (item.metadata?.imei && item.metadata.imei.toLowerCase().includes(searchFilter.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [allDetailedSoldItems, categoryFilter, searchFilter]);

  const filteredExpenses = useMemo(() => {
    if (categoryFilter !== 'all' && categoryFilter !== 'gastos') return [];
    return branchExpenses.filter(e => {
      return !searchFilter.trim() || e.concept.toLowerCase().includes(searchFilter.toLowerCase());
    });
  }, [branchExpenses, categoryFilter, searchFilter]);

  // Selection helpers
  const handleToggleSoldItem = (id: string) => {
    setSelectedSoldItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleExpense = (id: string) => {
    setSelectedExpenseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedSoldItemIds(prev => {
      const next = new Set(prev);
      filteredSoldItems.forEach(i => next.add(i.id));
      return next;
    });
    setSelectedExpenseIds(prev => {
      const next = new Set(prev);
      filteredExpenses.forEach(e => next.add(e.id));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedSoldItemIds(prev => {
      const next = new Set(prev);
      filteredSoldItems.forEach(i => next.delete(i.id));
      return next;
    });
    setSelectedExpenseIds(prev => {
      const next = new Set(prev);
      filteredExpenses.forEach(e => next.delete(e.id));
      return next;
    });
  };

  // --- TEXT GENERATION FOR CLIPBOARD / WHATSAPP ---
  const generateCorteText = (mode: 'full' | 'sold_only' | 'expenses_only' | 'custom' = 'custom') => {
    const lines: string[] = [];

    const isFull = mode === 'full';
    const isSoldOnly = mode === 'sold_only';
    const isExpensesOnly = mode === 'expenses_only';

    const incHeader = isFull || (!isSoldOnly && !isExpensesOnly && copySettings.includeHeader);
    const incSummary = isFull || (!isSoldOnly && !isExpensesOnly && copySettings.includeFinancialSummary);
    const incSold = isFull || isSoldOnly || (!isExpensesOnly && copySettings.includeSoldList);
    const incExpenses = isFull || isExpensesOnly || (!isSoldOnly && copySettings.includeExpenseList);
    const incDrawer = isFull || (!isSoldOnly && !isExpensesOnly && copySettings.includeDrawerBalance);
    const incPayment = isFull || (!isSoldOnly && !isExpensesOnly && copySettings.includePaymentMethods);

    // 1. ENCABEZADO
    if (incHeader) {
      lines.push(`========================================`);
      lines.push(`📊 CORTE X / PARCIAL • PUNTO DE VENTA`);
      lines.push(`========================================`);
      lines.push(`🏢 Sucursal: ${effectiveBranchName}`);
      lines.push(`👤 Cajero(a): ${effectiveOperatorName}`);
      lines.push(`📅 Fecha: ${currentDateStr}  |  ⏰ Hora: ${currentTimeStr}`);
      lines.push(`🏷️ Folio de Corte: ${corteFolio}`);
      lines.push(``);
    }

    // 2. RESUMEN FINANCIERO Y FORMAS DE PAGO
    if (incSummary) {
      lines.push(`💰 RESUMEN FINANCIERO:`);
      lines.push(`----------------------------------------`);
      lines.push(`• Accesorios y Artículos: $${totalAccesoriosProductos.toFixed(2)} (${countAccesoriosProductos} pzs)`);
      lines.push(`• Abonos a Crédito: $${totalAbonos.toFixed(2)} (${countAbonos} ops)`);
      lines.push(`• Enganches de Celulares: $${totalEnganches.toFixed(2)} (${countEnganches} ops)`);
      lines.push(`• Taller / Reparaciones: $${totalReparaciones.toFixed(2)} (${countReparaciones} ops)`);
      lines.push(`• Recargas Tiempo Aire: $${totalRecargas.toFixed(2)} (${countRecargas} ops)`);
      lines.push(`----------------------------------------`);
      lines.push(`💵 TOTAL VENTAS BRUTAS: $${totalSalesAll.toFixed(2)}`);
      lines.push(`🔻 TOTAL GASTOS DE CAJA: -$${totalExpenses.toFixed(2)}`);
      lines.push(`📈 UTILIDAD NETA DEL TURNO: $${netIncome.toFixed(2)}`);
      lines.push(``);
    }

    // 3. MEDIOS DE PAGO RECIBIDOS
    if (incPayment) {
      lines.push(`💳 FORMAS DE PAGO RECIBIDAS:`);
      lines.push(`• (+) Efectivo: $${cashSalesTotal.toFixed(2)}`);
      lines.push(`• (+) Tarjeta Débito/Crédito: $${cardSalesTotal.toFixed(2)}`);
      lines.push(`• (+) Transferencias SPEI: $${transferSalesTotal.toFixed(2)}`);
      lines.push(``);
    }

    // 4. LISTA DETALLADA DE TODO LO VENDIDO
    if (incSold) {
      const targetItems = mode === 'full' || mode === 'sold_only'
        ? allDetailedSoldItems
        : allDetailedSoldItems.filter(i => selectedSoldItemIds.has(i.id));

      const totalSoldSelectedAmount = targetItems.reduce((s, i) => s + i.totalPrice, 0);
      const totalSoldSelectedQty = targetItems.reduce((s, i) => s + i.quantity, 0);

      lines.push(`📦 LISTA DETALLADA DE LO VENDIDO (${totalSoldSelectedQty} pzs - $${totalSoldSelectedAmount.toFixed(2)}):`);
      lines.push(`----------------------------------------`);

      if (targetItems.length === 0) {
        lines.push(`  (Ningún artículo seleccionado o registrado)`);
      } else {
        // Group by category for clear readability
        const categoriesOrder = [
          { key: 'accesorios', title: '🔹 ACCESORIOS Y ARTÍCULOS' },
          { key: 'abonos', title: '🔹 ABONOS A CRÉDITO' },
          { key: 'enganches', title: '🔹 ENGANCHES DE CELULAR' },
          { key: 'reparaciones', title: '🔹 TALLER / REPARACIONES' },
          { key: 'recargas', title: '🔹 RECARGAS TIEMPO AIRE' },
        ];

        categoriesOrder.forEach(cat => {
          const catItems = targetItems.filter(i => i.category === cat.key);
          if (catItems.length > 0) {
            const catSum = catItems.reduce((s, i) => s + i.totalPrice, 0);
            lines.push(`${cat.title} ($${catSum.toFixed(2)}):`);
            catItems.forEach((item, idx) => {
              let extraDetails = '';
              if (item.metadata?.financingPlatform) extraDetails += ` [Plat: ${item.metadata.financingPlatform}]`;
              if (item.metadata?.clientName) extraDetails += ` [Cliente: ${item.metadata.clientName}]`;
              if (item.metadata?.imei) extraDetails += ` [IMEI: ${item.metadata.imei}]`;

              const folioPart = copySettings.showTicketFolios ? ` [${item.ticketFolio}]` : '';
              const paymentPart = copySettings.showPaymentDetails ? ` (${item.paymentMethod} • ${item.time})` : '';

              lines.push(`  ${idx + 1}. ${item.productName} - Cant: ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.totalPrice.toFixed(2)}${extraDetails}${folioPart}${paymentPart}`);
            });
            lines.push(``);
          }
        });
      }
    }

    // 5. LISTA DETALLADA DE GASTOS
    if (incExpenses) {
      const targetExpenses = mode === 'full' || mode === 'expenses_only'
        ? branchExpenses
        : branchExpenses.filter(e => selectedExpenseIds.has(e.id));

      const totalExpensesSelectedAmount = targetExpenses.reduce((s, e) => s + e.amount, 0);

      lines.push(`💸 LISTA DETALLADA DE GASTOS Y RETIROS (${targetExpenses.length} regs - $${totalExpensesSelectedAmount.toFixed(2)}):`);
      lines.push(`----------------------------------------`);

      if (targetExpenses.length === 0) {
        lines.push(`  (Sin gastos registrados o seleccionados)`);
      } else {
        targetExpenses.forEach((exp, idx) => {
          const time = safeFormatTime(exp.timestamp || exp.date);
          lines.push(`  ${idx + 1}. ${exp.concept} - Monto: -$${exp.amount.toFixed(2)} [${time} • Op: ${exp.operatorName || effectiveOperatorName}]`);
        });
      }
      lines.push(``);
    }

    // 6. BALANCE FINAL DE CAJÓN Y FONDO
    if (incDrawer) {
      lines.push(`💵 ARQUEO DE EFECTIVO EN CAJÓN:`);
      lines.push(`----------------------------------------`);
      lines.push(`• (+) Fondo Inicial: $${effectiveInitialCash.toFixed(2)}`);
      lines.push(`• (+) Efectivo por Ventas: +$${cashSalesTotal.toFixed(2)}`);
      lines.push(`• (-) Gastos en Efectivo: -$${totalExpenses.toFixed(2)}`);
      lines.push(`----------------------------------------`);
      lines.push(`👉 EFECTIVO TOTAL EN CAJA: $${expectedCashInDrawer.toFixed(2)} MXN`);
      
      if (isHistoric && existingCorteRecord.cashFundLeftForNextShift !== undefined) {
        lines.push(`📌 FONDO DEJADO PARA SIG. TURNO: $${existingCorteRecord.cashFundLeftForNextShift.toFixed(2)}`);
        lines.push(`💵 EFECTIVO RETIRADO / A RESGUARDAR: $${(existingCorteRecord.cashWithdrawn ?? 0).toFixed(2)}`);
        if (existingCorteRecord.closingNotes) {
          lines.push(`📝 NOTAS DE CIERRE: ${existingCorteRecord.closingNotes}`);
        }
      }
      lines.push(``);
    }

    lines.push(`========================================`);
    lines.push(`Reporte generado automáticamente • POS ERP`);
    return lines.join('\n');
  };

  const handleCopyClipboard = (mode: 'full' | 'sold_only' | 'expenses_only' | 'custom' = 'custom', labelText = 'Corte X copiado al portapapeles') => {
    const text = generateCorteText(mode);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification(labelText);
      setTimeout(() => {
        setCopiedNotification(null);
      }, 3000);
    });
    setQuickMenuOpen(false);
  };

  const handleShareWhatsApp = (mode: 'full' | 'sold_only' | 'expenses_only' | 'custom' = 'custom') => {
    const text = generateCorteText(mode);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setQuickMenuOpen(false);
  };

  const handlePrintThermal = () => {
    setPrintMode('thermal');
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintPDFReport = () => {
    setPrintMode('pdf');
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrint = () => {
    handlePrintThermal();
  };

  const handleOpenClosureDialog = () => {
    // Default next shift fund to the same initial fund, bounded by expected drawer cash if lower
    const defaultFund = Math.min(expectedCashInDrawer, effectiveInitialCash);
    setNextCashFundInput(defaultFund.toString());
    setShiftClosureNotes('');
    setIsClosingShiftDialog(true);
  };

  const handleFinalizeShift = (nextFundVal: number, notesVal: string = '') => {
    const cashWithdrawnVal = Math.max(0, expectedCashInDrawer - nextFundVal);

    // 1. Build official CorteXRecord snapshot
    const corteRecord: CorteXRecord = {
      id: corteFolio,
      timestamp: new Date().toISOString(),
      dateStr: currentDateStr,
      timeStr: currentTimeStr,
      branchId: currentBranch.id,
      branchName: currentBranch.name,
      operatorName: currentOperator.name,
      initialCashFund: effectiveInitialCash,
      cashFundLeftForNextShift: nextFundVal,
      cashWithdrawn: cashWithdrawnVal,
      closingNotes: notesVal.trim() || undefined,
      cashSales: cashSalesTotal,
      cardSales: cardSalesTotal,
      transferSales: transferSalesTotal,
      totalSales: totalSalesAll,
      totalExpenses,
      netIncome,
      expectedCashInDrawer,
      ticketIds: branchTickets.map((t) => t.id),
      expenseIds: branchExpenses.map((e) => e.id),
      ticketsSnapshot: branchTickets,
      expensesSnapshot: branchExpenses,
      breakdown: {
        accesoriosTotal: totalAccesoriosProductos,
        accesoriosCount: countAccesoriosProductos,
        abonosTotal: totalAbonos,
        abonosCount: countAbonos,
        enganchesTotal: totalEnganches,
        enganchesCount: countEnganches,
        reparacionesTotal: totalReparaciones,
        reparacionesCount: countReparaciones,
        recargasTotal: totalRecargas,
        recargasCount: countRecargas
      }
    };

    // Save the fund left for the next shift at this branch in localStorage
    try {
      localStorage.setItem(`erp_branch_fund_${currentBranch.id}`, nextFundVal.toString());
    } catch (e) {
      console.error('Error saving branch fund to localStorage', e);
    }

    if (onFinalizeCorteX) {
      onFinalizeCorteX(corteRecord);
    }

    // Trigger print
    window.print();

    setIsClosingShiftDialog(false);
    onClose();

    // Automatically close the session immediately after finalizing shift
    if (onLogout) {
      setTimeout(() => {
        onLogout();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      
      {/* Print Styles for both Thermal (80mm) and Executive PDF (Letter/A4) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .corte-print-active, .corte-print-active * {
            visibility: visible !important;
          }
          .corte-print-active {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            background: white !important;
            color: black !important;
            display: block !important;
          }
          .corte-print-thermal {
            width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
          }
          .corte-print-pdf {
            width: 100% !important;
            max-width: 210mm !important;
            margin: 0 auto !important;
            padding: 24px !important;
            box-sizing: border-box !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Hidden Thermal Receipt for POS Thermal Printer (80mm) */}
      <div 
        id="thermal-corte-x-receipt" 
        className={`${printMode === 'thermal' ? 'corte-print-active corte-print-thermal' : 'hidden'} hidden print:block text-black font-mono text-[11px] leading-tight space-y-2`}
      >
        <div className="text-center border-b border-black pb-2 mb-2">
          <h2 className="font-black text-sm uppercase">PUNTO DE VENTA ERP</h2>
          <p className="text-[10px] uppercase">{effectiveBranchName}</p>
          <p className="text-[12px] font-black my-1 uppercase">*** CORTE X / PARCIAL ***</p>
          <p className="text-[10px]">DOCUMENTO DE CONTROL INTERNO</p>
          <p className="font-bold">FOLIO: {corteFolio}</p>
        </div>

        <div className="space-y-0.5 text-[10px] border-b border-black pb-2">
          <div className="flex justify-between">
            <span>Fecha y Hora:</span>
            <span>{currentDateStr} {currentTimeStr}</span>
          </div>
          <div className="flex justify-between">
            <span>Cajero / Operador:</span>
            <span className="font-bold">{effectiveOperatorName}</span>
          </div>
          <div className="flex justify-between">
            <span>Tickets de Venta:</span>
            <span>{branchTickets.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Gastos Registrados:</span>
            <span>{branchExpenses.length}</span>
          </div>
        </div>

        {/* Desglose por Conceptos */}
        <div className="border-b border-black pb-2 space-y-1">
          <p className="font-bold uppercase text-[10px] border-b border-dashed border-black pb-0.5">
            RESUMEN POR CATEGORÍAS
          </p>

          <div className="flex justify-between">
            <span>Accesorios ({countAccesoriosProductos} pzs):</span>
            <span className="font-bold">${totalAccesoriosProductos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Abonos a Crédito ({countAbonos}):</span>
            <span className="font-bold">${totalAbonos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Enganches ({countEnganches}):</span>
            <span className="font-bold">${totalEnganches.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Reparaciones / Taller ({countReparaciones}):</span>
            <span className="font-bold">${totalReparaciones.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Recargas Tiempo Aire ({countRecargas}):</span>
            <span className="font-bold">${totalRecargas.toFixed(2)}</span>
          </div>

          <div className="border-t border-dashed border-black pt-1 flex justify-between font-bold text-[11px]">
            <span>TOTAL VENTAS BRUTAS:</span>
            <span>${totalSalesAll.toFixed(2)}</span>
          </div>
        </div>

        {/* Desglose Métodos de Pago */}
        <div className="border-b border-black pb-2 space-y-0.5 text-[10px]">
          <p className="font-bold uppercase border-b border-dashed border-black pb-0.5">
            FORMAS DE PAGO RECIBIDAS
          </p>
          <div className="flex justify-between">
            <span>( + ) Efectivo en Ventas:</span>
            <span>${cashSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>( + ) Tarjeta Débito/Crédito:</span>
            <span>${cardSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>( + ) Transferencia SPEI:</span>
            <span>${transferSalesTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Gastos y Retiros */}
        <div className="border-b border-black pb-2 space-y-0.5 text-[10px]">
          <p className="font-bold uppercase border-b border-dashed border-black pb-0.5">
            GASTOS Y RETIROS DE CAJA
          </p>
          {branchExpenses.length === 0 ? (
            <p className="text-center italic text-[9px]">Sin gastos registrados en el turno</p>
          ) : (
            branchExpenses.map((g) => (
              <div key={g.id} className="flex justify-between">
                <span className="truncate max-w-[150px]">{g.concept}:</span>
                <span className="font-bold">-${g.amount.toFixed(2)}</span>
              </div>
            ))
          )}
          <div className="flex justify-between font-bold border-t border-dashed border-black pt-1">
            <span>TOTAL GASTOS DE CAJA:</span>
            <span>-${totalExpenses.toFixed(2)}</span>
          </div>
        </div>

        {/* Balance Final y Dinero en Caja */}
        <div className="border-b-2 border-black pb-2 space-y-1 text-[11px]">
          <div className="flex justify-between text-[10px]">
            <span>( + ) Fondo Inicial de Turno:</span>
            <span>${effectiveInitialCash.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>( + ) Efectivo de Ventas:</span>
            <span>${cashSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>( - ) Gastos en Efectivo:</span>
            <span>-${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="border-t border-black pt-1 flex justify-between font-black text-[12px]">
            <span>TOTAL EFECTIVO EN CAJÓN:</span>
            <span>${expectedCashInDrawer.toFixed(2)}</span>
          </div>

          {/* Si es histórico o al cerrarse, mostrar Fondo Dejado y Retiro */}
          {isHistoric && existingCorteRecord.cashFundLeftForNextShift !== undefined && (
            <div className="border-t border-dashed border-black pt-1 mt-1 space-y-0.5 text-[10px]">
              <div className="flex justify-between font-bold">
                <span>📌 FONDO DEJADO SIG. TURNO:</span>
                <span>${existingCorteRecord.cashFundLeftForNextShift.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>💵 EFECTIVO RETIRADO/SOBRE:</span>
                <span>${(existingCorteRecord.cashWithdrawn ?? 0).toFixed(2)}</span>
              </div>
              {existingCorteRecord.closingNotes && (
                <div className="text-[9px] italic mt-0.5">
                  Notas: {existingCorteRecord.closingNotes}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between font-bold text-[10px] text-gray-700 pt-1">
            <span>Utilidad Neta del Turno:</span>
            <span>${netIncome.toFixed(2)}</span>
          </div>
        </div>

        {/* Firmas de Audit */}
        <div className="pt-4 text-center space-y-4 text-[9px]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="border-b border-black h-6 mb-1"></div>
              <span>Firma Cajero</span>
            </div>
            <div>
              <div className="border-b border-black h-6 mb-1"></div>
              <span>Firma Supervisor</span>
            </div>
          </div>
          <p>Reporte Oficial de Corte de Caja (Corte X)</p>
        </div>
      </div>

      {/* Hidden Full-Page Executive Report for PDF / Letter / A4 Print */}
      <div 
        id="executive-corte-x-pdf"
        className={`${printMode === 'pdf' ? 'corte-print-active corte-print-pdf' : 'hidden'} hidden print:block text-slate-900 font-sans text-xs bg-white space-y-5`}
      >
        {/* Banner Membretado */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
              PUNTO DE VENTA ERP & SERVICIOS
            </h1>
            <p className="text-sm font-bold text-slate-700">
              REPORTE OFICIAL DE ARQUEO Y CORTE DE CAJA (CORTE X)
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Control Interno de Sucursal • Documento de Arqueo y Cierre de Turno
            </p>
          </div>
          <div className="text-right border-l-2 border-slate-300 pl-4">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Folio de Corte</span>
            <span className="text-base font-black font-mono text-blue-900">{corteFolio}</span>
            <span className="text-[10px] font-bold text-slate-600 block mt-0.5">
              {currentDateStr} • {currentTimeStr}
            </span>
          </div>
        </div>

        {/* Datos de Cabecera */}
        <div className="grid grid-cols-3 gap-3 bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Sucursal:</span>
            <span className="font-extrabold text-slate-900">{effectiveBranchName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Cajero(a) Responsable:</span>
            <span className="font-extrabold text-slate-900">{effectiveOperatorName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Resumen de Actividad:</span>
            <span className="font-extrabold text-slate-900">{branchTickets.length} tickets • {branchExpenses.length} gastos</span>
          </div>
        </div>

        {/* Tabla de Resumen por Categorías y Finanzas */}
        <div className="space-y-1.5">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 border-b border-slate-400 pb-1">
            1. Desglose de Ventas por Categoría
          </h3>
          <table className="w-full text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-black">
                <th className="border border-slate-300 p-1.5 text-left">Categoría de Venta</th>
                <th className="border border-slate-300 p-1.5 text-center">Cantidad / Operaciones</th>
                <th className="border border-slate-300 p-1.5 text-right">Importe Total ($ MXN)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 p-1.5">Accesorios y Artículos de Tienda</td>
                <td className="border border-slate-300 p-1.5 text-center font-bold">{countAccesoriosProductos} pzs</td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">${totalAccesoriosProductos.toFixed(2)}</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-300 p-1.5">Abonos a Crédito (Pagos Recibidos)</td>
                <td className="border border-slate-300 p-1.5 text-center font-bold">{countAbonos} ops</td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">${totalAbonos.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-1.5">Enganches de Teléfonos Celulares</td>
                <td className="border border-slate-300 p-1.5 text-center font-bold">{countEnganches} ops</td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">${totalEnganches.toFixed(2)}</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-300 p-1.5">Taller / Reparaciones y Servicios</td>
                <td className="border border-slate-300 p-1.5 text-center font-bold">{countReparaciones} ops</td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">${totalReparaciones.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-1.5">Recargas de Tiempo Aire</td>
                <td className="border border-slate-300 p-1.5 text-center font-bold">{countRecargas} ops</td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">${totalRecargas.toFixed(2)}</td>
              </tr>
              <tr className="bg-slate-200 font-black">
                <td className="border border-slate-400 p-2 uppercase" colSpan={2}>TOTAL VENTAS BRUTAS DEL TURNO:</td>
                <td className="border border-slate-400 p-2 text-right font-mono text-sm">${totalSalesAll.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2 Columnas: Formas de Pago y Balance de Cajón */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Formas de Pago */}
          <div className="border border-slate-300 rounded-lg p-3 space-y-2 bg-slate-50">
            <h4 className="font-black text-xs uppercase text-slate-800 border-b border-slate-300 pb-1">
              2. Formas de Pago Recibidas
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>( + ) Efectivo en Ventas:</span>
                <span className="font-mono font-bold">${cashSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>( + ) Tarjetas Débito / Crédito:</span>
                <span className="font-mono font-bold">${cardSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>( + ) Transferencias SPEI:</span>
                <span className="font-mono font-bold">${transferSalesTotal.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-300 pt-1 flex justify-between font-black">
                <span>Total Ingresos Turno:</span>
                <span className="font-mono">${totalSalesAll.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Balance y Arqueo de Efectivo en Cajón */}
          <div className="border-2 border-slate-800 rounded-lg p-3 space-y-2 bg-slate-100">
            <h4 className="font-black text-xs uppercase text-slate-900 border-b border-slate-400 pb-1">
              3. Arqueo y Balance de Efectivo Físico
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>( + ) Fondo Inicial de Turno:</span>
                <span className="font-mono font-bold">${effectiveInitialCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>( + ) Efectivo Ingresado por Ventas:</span>
                <span className="font-mono font-bold">+${cashSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-800">
                <span>( - ) Gastos Pagados en Efectivo:</span>
                <span className="font-mono font-bold">-${totalExpenses.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-slate-800 pt-1 flex justify-between font-black text-sm">
                <span>EFECTIVO TOTAL EN CAJÓN:</span>
                <span className="font-mono text-emerald-900">${expectedCashInDrawer.toFixed(2)}</span>
              </div>

              {isHistoric && existingCorteRecord.cashFundLeftForNextShift !== undefined && (
                <div className="border-t border-dashed border-slate-400 pt-1 space-y-0.5 text-[11px] bg-white p-1.5 rounded">
                  <div className="flex justify-between font-bold text-blue-900">
                    <span>📌 Fondo Dejado Siguiente Turno:</span>
                    <span className="font-mono">${existingCorteRecord.cashFundLeftForNextShift.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>💵 Efectivo Retirado (Sobre):</span>
                    <span className="font-mono">${(existingCorteRecord.cashWithdrawn ?? 0).toFixed(2)}</span>
                  </div>
                  {existingCorteRecord.closingNotes && (
                    <p className="text-[10px] italic text-slate-600">
                      Observaciones: {existingCorteRecord.closingNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Lista Detallada de Gastos (si los hay) */}
        {branchExpenses.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 border-b border-slate-400 pb-1">
              4. Gastos y Retiros de Caja Registrados ({branchExpenses.length})
            </h3>
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold">
                  <th className="border border-slate-300 p-1 text-left">Concepto / Motivo</th>
                  <th className="border border-slate-300 p-1 text-center">Hora</th>
                  <th className="border border-slate-300 p-1 text-center">Cajero</th>
                  <th className="border border-slate-300 p-1 text-right">Importe (-$ MXN)</th>
                </tr>
              </thead>
              <tbody>
                {branchExpenses.map((g) => {
                  const time = safeFormatTime(g.timestamp || g.date);
                  const amt = typeof g.amount === 'number' ? g.amount : parseFloat((g.amount as any) || '0') || 0;
                  return (
                    <tr key={g.id}>
                      <td className="border border-slate-300 p-1">{g.concept || 'Gasto'}</td>
                      <td className="border border-slate-300 p-1 text-center">{time}</td>
                      <td className="border border-slate-300 p-1 text-center">{g.operatorName || effectiveOperatorName}</td>
                      <td className="border border-slate-300 p-1 text-right font-mono font-bold text-rose-800">
                        -${amt.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Lista de Artículos Vendidos en el Turno */}
        <div className="space-y-1.5">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 border-b border-slate-400 pb-1">
            5. Detalle de Artículos y Servicios Vendidos ({allDetailedSoldItems.length} registros)
          </h3>
          <table className="w-full text-[10px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-bold">
                <th className="border border-slate-300 p-1 text-left">Folio</th>
                <th className="border border-slate-300 p-1 text-left">Descripción / Producto</th>
                <th className="border border-slate-300 p-1 text-center">Cat.</th>
                <th className="border border-slate-300 p-1 text-center">Cant.</th>
                <th className="border border-slate-300 p-1 text-right">P. Unit</th>
                <th className="border border-slate-300 p-1 text-right">Total</th>
                <th className="border border-slate-300 p-1 text-center">Pago</th>
              </tr>
            </thead>
            <tbody>
              {allDetailedSoldItems.slice(0, 40).map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 p-1 font-mono">{item.ticketFolio}</td>
                  <td className="border border-slate-300 p-1 font-medium">{item.productName}</td>
                  <td className="border border-slate-300 p-1 text-center">{item.categoryLabel}</td>
                  <td className="border border-slate-300 p-1 text-center font-bold">{item.quantity}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono font-bold">${item.totalPrice.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-center">{item.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {allDetailedSoldItems.length > 40 && (
            <p className="text-[9px] text-slate-500 italic text-center">
              (Mostrando primeros 40 de {allDetailedSoldItems.length} artículos. Lista completa respaldada en base de datos)
            </p>
          )}
        </div>

        {/* Firmas de Audit */}
        <div className="pt-6 border-t-2 border-slate-800 grid grid-cols-2 gap-12 text-center text-xs">
          <div>
            <div className="border-b-2 border-slate-900 h-10 mb-1 mx-6"></div>
            <p className="font-bold text-slate-900">Entregó: {effectiveOperatorName}</p>
            <p className="text-[10px] text-slate-500">Cajero(a) en Turno</p>
          </div>
          <div>
            <div className="border-b-2 border-slate-900 h-10 mb-1 mx-6"></div>
            <p className="font-bold text-slate-900">Recibió / Validó:</p>
            <p className="text-[10px] text-slate-500">Gerencia / Supervisor de Sucursal</p>
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-400 pt-2">
          Reporte Oficial Generado Automáticamente por Sistema POS ERP • {currentDateStr} {currentTimeStr}
        </div>
      </div>

      {/* Main Screen Modal */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[92vh] no-print relative">
        
        {/* Toast Notificación de Copiado */}
        {copiedNotification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200">
            <Check className="w-4 h-4 text-emerald-200 stroke-[3]" />
            <span>{copiedNotification}</span>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg tracking-tight text-white">
                    {isHistoric ? 'Corte X • Arqueo Guardado' : 'Corte X • Arqueo Parcial'}
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                    {corteFolio}
                  </span>
                  {isHistoric && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <FileCheck2 className="w-3 h-3" />
                      Histórico
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {effectiveBranchName} • {currentTimeStr} ({currentDateStr}) • Cajero: {effectiveOperatorName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              
              {/* BOTÓN RÁPIDO: COPIAR CORTE X */}
              <div className="relative">
                <div className="flex items-center rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-xs transition-all">
                  <button
                    type="button"
                    onClick={() => handleCopyClipboard('full', '¡Corte X Completo Copiado al Portapapeles!')}
                    className="flex items-center gap-1.5 px-3 py-2 text-white text-xs font-black cursor-pointer hover:bg-emerald-500 rounded-l-xl transition-colors"
                    title="Copiar reporte completo para PDF o mensaje"
                  >
                    <Copy className="w-4 h-4 text-emerald-200" />
                    <span>Copiar Corte</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickMenuOpen(!quickMenuOpen)}
                    className="px-2 py-2 text-emerald-200 hover:text-white border-l border-emerald-500/60 cursor-pointer rounded-r-xl"
                    title="Opciones de copiado y exportación"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dropdown Menu Rápido */}
                {quickMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-72 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95">
                    <button
                      onClick={() => handleCopyClipboard('full', '¡Corte X Completo para Reporte / PDF Copiado!')}
                      className="w-full text-left p-2 hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-slate-200 hover:text-white"
                    >
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-black">Copiar Reporte Completo</p>
                        <p className="text-[10px] text-slate-400">Formato listo para pegar en PDF / Reportes</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleCopyClipboard('sold_only', '¡Lista de Artículos Vendidos Copiada!')}
                      className="w-full text-left p-2 hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-slate-200 hover:text-white"
                    >
                      <ShoppingBag className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <p className="text-xs font-black">Copiar Solo Lista de Vendidos</p>
                        <p className="text-[10px] text-slate-400">{allDetailedSoldItems.length} artículos con precios y folios</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleCopyClipboard('expenses_only', '¡Lista de Gastos Copiada!')}
                      className="w-full text-left p-2 hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-slate-200 hover:text-white"
                    >
                      <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <p className="text-xs font-black">Copiar Solo Lista de Gastos</p>
                        <p className="text-[10px] text-slate-400">{branchExpenses.length} gastos registrados</p>
                      </div>
                    </button>

                    <div className="pt-1 border-t border-slate-800">
                      <button
                        onClick={() => handleShareWhatsApp('full')}
                        className="w-full text-left p-2 hover:bg-emerald-900/40 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-emerald-300"
                      >
                        <Send className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-black">Enviar por WhatsApp</p>
                          <p className="text-[10px] text-emerald-400/80">Abre WhatsApp con el reporte formateado</p>
                        </div>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setActiveTab('reporte_pdf');
                          setQuickMenuOpen(false);
                        }}
                        className="w-full text-left p-2 hover:bg-purple-900/40 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-purple-300"
                      >
                        <Download className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <p className="text-xs font-black">Ver y Descargar Reporte PDF</p>
                          <p className="text-[10px] text-purple-400/80">Formato formal membretado listo para guardar</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('copiar_lista');
                          setQuickMenuOpen(false);
                        }}
                        className="w-full text-left p-2 hover:bg-blue-900/40 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-blue-300"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <p className="text-xs font-black">Seleccionar Artículos...</p>
                          <p className="text-[10px] text-blue-400/80">Elige qué líneas y gastos copiar</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Descargar / Guardar PDF */}
              <button
                onClick={handlePrintPDFReport}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Generar o guardar reporte en PDF (Hoja Ejecutiva)"
              >
                <Download className="w-4 h-4 text-purple-200" />
                <span className="hidden sm:inline">Reporte</span> PDF
              </button>

              {/* Botón Imprimir Ticket Térmico */}
              <button
                onClick={handlePrintThermal}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Imprimir ticket térmico POS (80mm)"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline">Ticket</span> POS
              </button>

              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* TAB SELECTOR HEADER */}
          <div className="flex items-center px-4 pt-2 gap-2 bg-slate-950/90 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('arqueo')}
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 shrink-0 ${
                activeTab === 'arqueo'
                  ? 'bg-white text-slate-900 border-blue-500 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              <span>Resumen & Balance de Caja</span>
            </button>

            <button
              onClick={() => setActiveTab('copiar_lista')}
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 shrink-0 ${
                activeTab === 'copiar_lista'
                  ? 'bg-white text-slate-900 border-emerald-500 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900'
              }`}
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copiar y Seleccionar Lista</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                {allDetailedSoldItems.length + branchExpenses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reporte_pdf')}
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 shrink-0 ${
                activeTab === 'reporte_pdf'
                  ? 'bg-white text-slate-900 border-purple-500 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-purple-600" />
              <span>Reporte PDF & Exportar</span>
            </button>
          </div>
        </div>

        {/* MAIN BODY: TAB 1 (ARQUEO RESUMEN) OR TAB 2 (COPIAR LISTA SELECCIONABLE) */}
        {activeTab === 'arqueo' ? (
          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Ventas Brutas</span>
                <span className="text-base font-black text-slate-900 font-mono">${totalSalesAll.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{branchTickets.length} tickets emitidos</span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider block">Gastos en Caja</span>
                <span className="text-base font-black text-rose-600 font-mono">-${totalExpenses.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{branchExpenses.length} retiros registrados</span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">Efectivo en Cajón</span>
                <span className="text-base font-black text-emerald-700 font-mono">${expectedCashInDrawer.toFixed(2)}</span>
                <span className="text-[10px] text-emerald-800 block mt-0.5">Incluye fondo inicial</span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block">Bancos & Tarjetas</span>
                <span className="text-base font-black text-indigo-700 font-mono">${cardAndTransferTotal.toFixed(2)}</span>
                <span className="text-[10px] text-indigo-800 block mt-0.5">Terminal + SPEI</span>
              </div>
            </div>

            {/* Histórico: Detalle de Fondo Dejado si existe */}
            {isHistoric && existingCorteRecord.cashFundLeftForNextShift !== undefined && (
              <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-blue-950 text-xs">Fondo Dejado para Siguiente Turno:</span>
                      <span className="font-mono font-black text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200 text-sm">
                        ${existingCorteRecord.cashFundLeftForNextShift.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Efectivo Retirado en Sobre: <strong className="font-mono font-bold">${(existingCorteRecord.cashWithdrawn ?? 0).toFixed(2)}</strong>
                      {existingCorteRecord.closingNotes ? ` • Notas: "${existingCorteRecord.closingNotes}"` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Banner para invitar a copiar o ver la lista */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-extrabold text-emerald-950">¿Necesitas enviar el reporte detallado por WhatsApp o notas?</h5>
                  <p className="text-[11px] text-emerald-800">
                    Puedes copiar el corte completo con lista de artículos vendidos y gastos, o seleccionar qué incluir.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyClipboard('full', '¡Corte X y lista completa copiada!')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Todo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('copiar_lista')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Seleccionar...</span>
                </button>
              </div>
            </div>

            {/* DESGLOSE DESPLEGABLE POR CATEGORIAS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  Desglose Desplegable por Categorías del Turno
                </h4>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExpandedCategories({ accesorios: true, abonos: true, enganches: true, reparaciones: true, recargas: true, gastos: true })}
                    className="text-[10px] font-extrabold text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 cursor-pointer transition-colors"
                  >
                    Desplegar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedCategories({ accesorios: false, abonos: false, enganches: false, reparaciones: false, recargas: false, gastos: false })}
                    className="text-[10px] font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 cursor-pointer transition-colors"
                  >
                    Plegar Todas
                  </button>
                </div>
              </div>

              {/* LISTA DE ACCORDEONES POR CATEGORIA */}
              <div className="space-y-2 text-xs">
                {[
                  {
                    key: 'accesorios',
                    icon: <ShoppingBag className="w-4 h-4 text-indigo-500" />,
                    title: 'Accesorios y Productos',
                    count: countAccesoriosProductos,
                    total: totalAccesoriosProductos,
                    items: categoryItems.accesorios,
                    headerBg: 'bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-200 text-indigo-950',
                    textColor: 'text-indigo-950',
                  },
                  {
                    key: 'abonos',
                    icon: <CreditCard className="w-4 h-4 text-purple-600" />,
                    title: 'Abonos a Crédito',
                    count: countAbonos,
                    total: totalAbonos,
                    items: categoryItems.abonos,
                    headerBg: 'bg-purple-50/70 hover:bg-purple-100/70 border-purple-200 text-purple-950',
                    textColor: 'text-purple-950',
                  },
                  {
                    key: 'enganches',
                    icon: <Tag className="w-4 h-4 text-blue-600" />,
                    title: 'Enganches de Equipo',
                    count: countEnganches,
                    total: totalEnganches,
                    items: categoryItems.enganches,
                    headerBg: 'bg-blue-50/70 hover:bg-blue-100/70 border-blue-200 text-blue-950',
                    textColor: 'text-blue-950',
                  },
                  {
                    key: 'reparaciones',
                    icon: <Wrench className="w-4 h-4 text-amber-600" />,
                    title: 'Taller / Reparaciones',
                    count: countReparaciones,
                    total: totalReparaciones,
                    items: categoryItems.reparaciones,
                    headerBg: 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200 text-amber-950',
                    textColor: 'text-amber-950',
                  },
                  {
                    key: 'recargas',
                    icon: <Zap className="w-4 h-4 text-emerald-600" />,
                    title: 'Recargas Tiempo Aire',
                    count: countRecargas,
                    total: totalRecargas,
                    items: categoryItems.recargas,
                    headerBg: 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200 text-emerald-950',
                    textColor: 'text-emerald-950',
                  },
                  {
                    key: 'gastos',
                    icon: <TrendingDown className="w-4 h-4 text-red-600" />,
                    title: 'Gastos del Turno',
                    count: branchExpenses.length,
                    total: totalExpenses,
                    items: categoryItems.gastos,
                    headerBg: 'bg-red-50/70 hover:bg-red-100/70 border-red-200 text-red-950',
                    textColor: 'text-red-700',
                    isExpense: true,
                  },
                ].map((cat) => {
                  const isExpanded = !!expandedCategories[cat.key];
                  const itemsList = cat.items || [];

                  return (
                    <div key={cat.key} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                      
                      <button
                        type="button"
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
                        className={`w-full p-2.5 flex items-center justify-between text-left transition-colors cursor-pointer border-b ${
                          isExpanded ? 'border-slate-200 font-bold' : 'border-transparent'
                        } ${cat.headerBg}`}
                      >
                        <div className="flex items-center gap-2">
                          {cat.icon}
                          <span className="font-extrabold text-xs">{cat.title}</span>
                          <span className="bg-white/80 text-slate-800 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-slate-200">
                            {cat.count} {cat.isExpense ? 'regs' : 'arts'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`font-mono font-black text-xs sm:text-sm ${cat.textColor}`}>
                            {cat.isExpense ? `-$${cat.total.toFixed(2)}` : `$${cat.total.toFixed(2)}`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </button>

                      {/* Contenido Desplegable */}
                      {isExpanded && (
                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 space-y-1.5">
                          {itemsList.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic py-1 px-2 text-center">
                              No se registraron movimientos en esta categoría durante el turno.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {cat.isExpense ? (
                                (itemsList as any[]).map((exp, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200/80 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                      <span className="font-bold text-slate-900 truncate">{exp.concept}</span>
                                      <span className="text-[10px] text-slate-400">({exp.count} {exp.count === 1 ? 'gasto' : 'gastos'})</span>
                                    </div>
                                    <span className="font-mono font-bold text-red-600 shrink-0">
                                      -${exp.total.toFixed(2)}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                (itemsList as ConceptGroup[]).map((grp, idx) => (
                                  <div key={idx} className="bg-white rounded-lg border border-slate-200/80 p-2 text-xs space-y-1">
                                    <div className="flex items-center justify-between font-bold text-slate-800">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                        <span className="truncate">{grp.name}</span>
                                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                          x{grp.count}
                                        </span>
                                      </div>
                                      <span className="font-mono font-bold text-slate-900">
                                        ${grp.total.toFixed(2)}
                                      </span>
                                    </div>

                                    {/* Sub-details (tickets folios, metadata) */}
                                    {grp.details && grp.details.length > 0 && (
                                      <div className="pl-3 pt-1 border-t border-slate-100 space-y-0.5 text-[10px] text-slate-500">
                                        {grp.details.map((d, dIdx) => (
                                          <div key={dIdx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 truncate">
                                              <span className="font-mono text-blue-600 font-bold">{d.ticketFolio}</span>
                                              <span>• {d.time}</span>
                                              <span className="bg-slate-100 text-slate-600 px-1 rounded text-[9px] font-medium">{d.paymentMethod}</span>
                                              {d.metadata?.financingPlatform && (
                                                <span className="text-purple-600 font-semibold truncate">[{d.metadata.financingPlatform}]</span>
                                              )}
                                              {d.metadata?.clientName && (
                                                <span className="text-slate-700 truncate">({d.metadata.clientName})</span>
                                              )}
                                              {d.metadata?.imei && (
                                                <span className="font-mono text-slate-800 text-[9px]">IMEI: {d.metadata.imei}</span>
                                              )}
                                            </div>
                                            <span className="font-mono font-medium text-slate-700 shrink-0">
                                              ${d.totalPrice.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            {/* BALANCE FINAL DE CAJA (PANEL FINANCIERO) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Store className="w-4 h-4 text-emerald-600" />
                Balance de Caja y Medios de Pago
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Dinero en Efectivo y Caja */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-950 font-black uppercase text-[10.5px]">Efectivo Físico en Caja</span>
                    <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Caja Principal</span>
                  </div>

                  <div className="space-y-1 text-xs text-emerald-950">
                    <div className="flex justify-between">
                      <span>Fondo Inicial de Caja:</span>
                      <span className="font-mono font-bold">${effectiveInitialCash.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ventas en Efectivo:</span>
                      <span className="font-mono font-bold text-emerald-700">+${cashSalesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos en Efectivo:</span>
                      <span className="font-mono font-bold text-red-600">-${totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-950">Efectivo Total en Cajón:</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      ${expectedCashInDrawer.toFixed(2)} <span className="text-[10px]">MXN</span>
                    </span>
                  </div>
                </div>

                {/* Pagos Electrónicos */}
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-950 font-black uppercase text-[10.5px]">Cobros Electrónicos / Bancarios</span>
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                  </div>

                  <div className="space-y-1 text-xs text-indigo-950">
                    <div className="flex justify-between">
                      <span>Terminal / Tarjeta:</span>
                      <span className="font-mono font-bold text-indigo-700">${cardSalesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transferencias SPEI:</span>
                      <span className="font-mono font-bold text-blue-700">${transferSalesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Ventas Brutas:</span>
                      <span className="font-mono font-bold text-slate-800">${totalSalesAll.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-200/80 flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-950">Total Bancos / Tarjeta:</span>
                    <span className="text-base font-black text-indigo-800 font-mono">
                      ${cardAndTransferTotal.toFixed(2)} <span className="text-[10px]">MXN</span>
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        ) : activeTab === 'copiar_lista' ? (
          /* TAB 2: COPIAR Y SELECCIONAR LISTA DETALLADA DE VENDIDOS & GASTOS */
          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-100/70 flex flex-col md:flex-row gap-4">
            
            {/* IZQUIERDA: LISTA INTERACTIVA CON SELECCIÓN */}
            <div className="flex-1 space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col min-h-0">
              
              {/* Encabezado y Filtros */}
              <div className="space-y-2 border-b border-slate-100 pb-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-emerald-600" />
                      <span>Seleccionar Artículos y Gastos para Copiar</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Marca o desmarca los elementos que deseas incluir en el reporte copiado.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-extrabold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="w-3 h-3 text-emerald-600" />
                      <span>Marcar Todos</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFiltered}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-extrabold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 text-slate-400" />
                      <span>Desmarcar</span>
                    </button>
                  </div>
                </div>

                {/* Barra de Búsqueda y Categorías */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar producto, ticket, cliente, IMEI..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="all">Todas las Categorías</option>
                    <option value="accesorios">Accesorios y Productos</option>
                    <option value="abonos">Abonos a Crédito</option>
                    <option value="enganches">Enganches de Celular</option>
                    <option value="reparaciones">Taller / Reparaciones</option>
                    <option value="recargas">Recargas</option>
                    <option value="gastos">Solo Gastos de Caja</option>
                  </select>
                </div>
              </div>

              {/* Lista Scrollable de Elementos */}
              <div className="space-y-2 overflow-y-auto flex-1 max-h-[380px] pr-1">
                
                {/* SECCIÓN 1: ARTÍCULOS VENDIDOS */}
                {filteredSoldItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-500 px-1 pt-1">
                      <span>Artículos y Servicios Vendidos ({filteredSoldItems.length})</span>
                      <span className="text-emerald-700 font-mono font-bold">
                        ${filteredSoldItems.reduce((s, i) => s + (selectedSoldItemIds.has(i.id) ? i.totalPrice : 0), 0).toFixed(2)} sel.
                      </span>
                    </div>

                    {filteredSoldItems.map((item) => {
                      const isSelected = selectedSoldItemIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleSoldItem(item.id)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                            isSelected
                              ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-300/40'
                              : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs text-slate-900 truncate">
                                {item.productName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                                <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                                  {item.ticketFolio}
                                </span>
                                <span>• {item.time}</span>
                                <span className="bg-slate-100 text-slate-700 px-1 rounded font-medium">
                                  {item.paymentMethod}
                                </span>
                                {item.metadata?.financingPlatform && (
                                  <span className="text-purple-700 font-bold bg-purple-50 px-1 rounded border border-purple-100">
                                    {item.metadata.financingPlatform}
                                  </span>
                                )}
                                {item.metadata?.clientName && (
                                  <span className="text-slate-700 font-medium">
                                    Cliente: {item.metadata.clientName}
                                  </span>
                                )}
                                {item.metadata?.imei && (
                                  <span className="font-mono text-slate-900 bg-amber-50 border border-amber-200 px-1 rounded text-[9px] font-bold">
                                    IMEI: {item.metadata.imei}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-black text-xs text-slate-900 block">
                              ${item.totalPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {item.quantity} pza{item.quantity > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SECCIÓN 2: GASTOS DE CAJA */}
                {filteredExpenses.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase text-rose-500 px-1">
                      <span>Gastos y Retiros de Caja ({filteredExpenses.length})</span>
                      <span className="text-rose-700 font-mono font-bold">
                        -${filteredExpenses.reduce((s, e) => s + (selectedExpenseIds.has(e.id) ? e.amount : 0), 0).toFixed(2)} sel.
                      </span>
                    </div>

                    {filteredExpenses.map((exp) => {
                      const isSelected = selectedExpenseIds.has(exp.id);
                      const timeStr = safeFormatTime(exp.timestamp || exp.date);
                      const amt = typeof exp.amount === 'number' ? exp.amount : parseFloat((exp.amount as any) || '0') || 0;
                      return (
                        <div
                          key={exp.id}
                          onClick={() => handleToggleExpense(exp.id)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                            isSelected
                              ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-300/40'
                              : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs text-slate-900 truncate">
                                {exp.concept || 'Gasto'}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {timeStr} • Registrado por: {exp.operatorName || effectiveOperatorName}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-black text-xs text-rose-600 block">
                              -${amt.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredSoldItems.length === 0 && filteredExpenses.length === 0 && (
                  <div className="p-8 text-center text-slate-400 space-y-1">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">No se encontraron movimientos con los filtros aplicados.</p>
                  </div>
                )}

              </div>

            </div>

            {/* DERECHA: CONFIGURACIÓN Y VISTA PREVIA DEL TEXTO COPIABLE */}
            <div className="w-full md:w-80 space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col shrink-0">
              
              <div className="border-b border-slate-100 pb-2">
                <h4 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span>Opciones de Copiado</span>
                </h4>
                <p className="text-[11px] text-slate-500">Configura los bloques del reporte</p>
              </div>

              {/* Casillas de configuración rápida */}
              <div className="space-y-1.5 text-xs">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copySettings.includeHeader}
                    onChange={(e) => setCopySettings(prev => ({ ...prev, includeHeader: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Encabezado (Sucursal, Fecha, Folio)</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copySettings.includeFinancialSummary}
                    onChange={(e) => setCopySettings(prev => ({ ...prev, includeFinancialSummary: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Resumen de Totales y Ventas</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copySettings.includePaymentMethods}
                    onChange={(e) => setCopySettings(prev => ({ ...prev, includePaymentMethods: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Formas de Pago (Efectivo/Tarjeta)</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copySettings.includeSoldList}
                    onChange={(e) => setCopySettings(prev => ({ ...prev, includeSoldList: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Lista Detallada de Vendidos ({selectedSoldItemIds.size})</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copySettings.includeExpenseList}
                    onChange={(e) => setCopySettings(prev => ({ ...prev, includeExpenseList: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Lista Detallada de Gastos ({selectedExpenseIds.size})</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copySettings.includeDrawerBalance}
                    onChange={(e) => setCopySettings(prev => ({ ...prev, includeDrawerBalance: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Efectivo Total en Cajón de Caja</span>
                </label>
              </div>

              {/* Vista Previa de Texto */}
              <div className="flex-1 flex flex-col min-h-0 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Vista Previa de Texto</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {selectedSoldItemIds.size} arts • {selectedExpenseIds.size} gastos
                  </span>
                </div>
                <textarea
                  readOnly
                  value={generateCorteText('custom')}
                  rows={7}
                  className="w-full p-2.5 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-xl border border-slate-800 resize-none focus:outline-none select-all"
                />
              </div>

              {/* Botones de Acción de Copiado */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleCopyClipboard('custom', '¡Lista y Reporte Copiados con Éxito!')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-black text-xs shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-emerald-200" />
                  <span>Copiar al Portapapeles</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareWhatsApp('custom')}
                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enviar por WhatsApp</span>
                </button>
              </div>

            </div>

          </div>
        ) : (
          /* TAB 3: REPORTE PDF & EXPORTACIÓN EJECUTIVA */
          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-100/70">
            
            {/* Action Bar for PDF and Export */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    Reporte Ejecutivo para PDF & Compartir
                  </h4>
                  <p className="text-xs text-slate-500">
                    Copia el reporte en texto o guárdalo directamente como archivo PDF membretado
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyClipboard('full', '¡Reporte Completo Copiado para PDF!')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  title="Copiar texto estructurado listo para pegar"
                >
                  <Copy className="w-4 h-4 text-emerald-200" />
                  <span>Copiar Reporte Completo</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintPDFReport}
                  className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  title="Abre la ventana de impresión para Guardar como PDF"
                >
                  <Download className="w-4 h-4 text-purple-200" />
                  <span>Guardar / Imprimir PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareWhatsApp('full')}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Enviar por WhatsApp"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Document Preview Card (Formatted as official Letter / A4 document) */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-300 shadow-md max-w-3xl mx-auto space-y-6 text-slate-800 font-sans">
              
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-black text-[10px] uppercase">
                      Punto de Venta ERP
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">Documento Oficial</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-950 mt-1 uppercase">
                    Reporte de Corte de Caja • Corte X
                  </h2>
                  <p className="text-xs text-slate-600">
                    Sucursal: <strong>{effectiveBranchName}</strong> • Cajero: <strong>{effectiveOperatorName}</strong>
                  </p>
                </div>

                <div className="text-right bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Folio Control</span>
                  <span className="text-sm font-black font-mono text-blue-800">{corteFolio}</span>
                  <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                    {currentDateStr} • {currentTimeStr}
                  </span>
                </div>
              </div>

              {/* Grid: Totales y Formas de Pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Categorías */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                  <h5 className="font-black text-xs text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center justify-between">
                    <span>1. Resumen por Conceptos</span>
                    <span className="text-[10px] font-bold text-slate-500">{branchTickets.length} tickets</span>
                  </h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Accesorios ({countAccesoriosProductos} pzs):</span>
                      <span className="font-mono font-bold">${totalAccesoriosProductos.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Abonos a Crédito ({countAbonos}):</span>
                      <span className="font-mono font-bold">${totalAbonos.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Enganches ({countEnganches}):</span>
                      <span className="font-mono font-bold">${totalEnganches.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Reparaciones / Taller ({countReparaciones}):</span>
                      <span className="font-mono font-bold">${totalReparaciones.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Recargas ({countRecargas}):</span>
                      <span className="font-mono font-bold">${totalRecargas.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-300 pt-1.5 flex justify-between font-black text-slate-900">
                      <span>Total Ventas Brutas:</span>
                      <span className="font-mono text-sm">${totalSalesAll.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Formas de Pago & Gastos */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                  <h5 className="font-black text-xs text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
                    2. Formas de Pago Recibidas
                  </h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">( + ) Efectivo en Ventas:</span>
                      <span className="font-mono font-bold text-emerald-700">${cashSalesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">( + ) Tarjetas Bancarias:</span>
                      <span className="font-mono font-bold">${cardSalesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">( + ) Transferencias SPEI:</span>
                      <span className="font-mono font-bold">${transferSalesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>( - ) Gastos Pagados ({branchExpenses.length}):</span>
                      <span className="font-mono font-bold">-${totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-300 pt-1.5 flex justify-between font-black text-slate-900">
                      <span>Ingreso Neto de Turno:</span>
                      <span className="font-mono text-sm">${netIncome.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Balance de Caja Física */}
              <div className="border-2 border-slate-800 rounded-xl p-4 bg-slate-50 space-y-2">
                <h5 className="font-black text-xs text-slate-900 uppercase tracking-wide border-b border-slate-300 pb-1 flex items-center justify-between">
                  <span>3. Arqueo y Balance en Cajón de Caja</span>
                  <span className="text-[10px] font-mono font-black text-blue-900">Efectivo Físico</span>
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Fondo Inicial</span>
                    <span className="font-mono font-black text-slate-900">${effectiveInitialCash.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-emerald-600 font-bold block">(+) Efectivo Ventas</span>
                    <span className="font-mono font-black text-emerald-700">+${cashSalesTotal.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-rose-600 font-bold block">(-) Gastos Efectivo</span>
                    <span className="font-mono font-black text-rose-700">-${totalExpenses.toFixed(2)}</span>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-300">
                    <span className="text-[10px] text-emerald-800 font-black block">Total en Cajón</span>
                    <span className="font-mono font-black text-emerald-900 text-sm">${expectedCashInDrawer.toFixed(2)}</span>
                  </div>
                </div>

                {isHistoric && existingCorteRecord.cashFundLeftForNextShift !== undefined && (
                  <div className="mt-2 pt-2 border-t border-dashed border-slate-300 flex items-center justify-between text-xs bg-white p-2 rounded-lg">
                    <div>
                      <span className="font-bold text-slate-700">📌 Fondo Dejado Siguiente Turno:</span>{' '}
                      <span className="font-mono font-black text-blue-800">${existingCorteRecord.cashFundLeftForNextShift.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">💵 Retirado (Sobre):</span>{' '}
                      <span className="font-mono font-black text-amber-800">${(existingCorteRecord.cashWithdrawn ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista Rápida de Gastos */}
              {branchExpenses.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="font-black text-xs text-slate-900 uppercase">
                    4. Gastos Registrados ({branchExpenses.length})
                  </h5>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold text-[10px]">
                        <tr>
                          <th className="p-2">Concepto</th>
                          <th className="p-2 text-center">Hora</th>
                          <th className="p-2 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {branchExpenses.map((exp) => {
                          const timeStr = safeFormatTime(exp.timestamp || exp.date);
                          const amt = typeof exp.amount === 'number' ? exp.amount : parseFloat((exp.amount as any) || '0') || 0;
                          return (
                            <tr key={exp.id}>
                              <td className="p-2 font-medium">{exp.concept || 'Gasto'}</td>
                              <td className="p-2 text-center text-slate-500 font-mono text-[10px]">
                                {timeStr}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-rose-600">
                                -${amt.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lista Resumida de Vendidos */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h5 className="font-black text-xs text-slate-900 uppercase">
                    5. Artículos Vendidos en el Turno ({allDetailedSoldItems.length})
                  </h5>
                  <span className="text-[10px] text-slate-500">
                    Mostrando primeros {Math.min(15, allDetailedSoldItems.length)} registros
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold text-[10px]">
                      <tr>
                        <th className="p-2">Folio</th>
                        <th className="p-2">Descripción</th>
                        <th className="p-2 text-center">Cant.</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center">Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {allDetailedSoldItems.slice(0, 15).map((item) => (
                        <tr key={item.id}>
                          <td className="p-2 font-mono text-[10px] text-blue-700 font-bold">{item.ticketFolio}</td>
                          <td className="p-2 font-medium truncate max-w-[200px]">{item.productName}</td>
                          <td className="p-2 text-center font-bold">{item.quantity}</td>
                          <td className="p-2 text-right font-mono font-bold">${item.totalPrice.toFixed(2)}</td>
                          <td className="p-2 text-center text-slate-600 text-[10px]">{item.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allDetailedSoldItems.length > 15 && (
                    <div className="p-2 bg-slate-50 text-center text-[10px] text-slate-500 font-semibold border-t border-slate-200">
                      + {allDetailedSoldItems.length - 15} artículos adicionales registrados en este corte.
                    </div>
                  )}
                </div>
              </div>

              {/* Firmas de Audit en Previsualización */}
              <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1 mx-4"></div>
                  <p className="font-bold text-slate-900">{effectiveOperatorName}</p>
                  <p className="text-[10px] text-slate-500">Cajero(a) Responsable</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1 mx-4"></div>
                  <p className="font-bold text-slate-900">Gerencia / Auditoría</p>
                  <p className="text-[10px] text-slate-500">Firma de Conformidad</p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {!isHistoric ? (
              <>
                <button
                  type="button"
                  onClick={handleOpenClosureDialog}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 flex items-center gap-2 transition-all cursor-pointer"
                  title="Registra el fondo que se queda para el siguiente turno, guarda el corte y cierra sesión"
                >
                  <Coins className="w-4 h-4 text-emerald-200" />
                  <span>Finalizar Turno y Dejar Fondo</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenClosureDialog}
                  className="px-3.5 py-2.5 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  title="Guarda el corte oficial, imprime el ticket y cierra la sesión para cambio de turno"
                >
                  <LogOut className="w-4 h-4 text-indigo-200" />
                  <span>Guardar Corte y Cerrar Sesión</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintThermal}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reimprimir el ticket térmico de este corte histórico"
                >
                  <Printer className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Reimprimir Ticket</span>
                </button>
                <button
                  onClick={handlePrintPDFReport}
                  className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Imprimir o exportar reporte en PDF"
                >
                  <Download className="w-3.5 h-3.5 text-purple-200" />
                  <span>Guardar PDF</span>
                </button>
                <span className="text-[11px] text-slate-500 font-semibold">
                  Corte guardado el {currentDateStr} por {effectiveOperatorName}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyClipboard('full', '¡Corte X copiado con éxito para reporte/PDF!')}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Copiar texto del reporte para compartir o guardar en PDF"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copiar Corte</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPDFReport}
              className="px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Generar reporte para guardar como PDF"
            >
              <Download className="w-3.5 h-3.5 text-purple-600" />
              <span>Reporte PDF</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>

      </div>

      {/* APARTADO DE FONDO DE CAJA Y CIERRE DE TURNO / SESIÓN HERMÉTICA */}
      {isClosingShiftDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col my-auto animate-in zoom-in-95">
            
            {/* Header del Apartado */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-1.5">
                      <span>Cierre de Turno & Fondo de Caja</span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      {effectiveBranchName} • Cajero: {effectiveOperatorName}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsClosingShiftDialog(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo del Apartado de Fondo */}
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50/60">
              
              {/* Aviso Hermético */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">Control de Seguridad y Arqueo Hermético</p>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Indica el efectivo que se queda físicamente en el cajón como <strong>Fondo para el Siguiente Turno</strong>. Al confirmar, se guardará el arqueo oficial, se imprimirá el ticket y la sesión se cerrará de inmediato.
                  </p>
                </div>
              </div>

              {/* Resumen del Arqueo en Cajón */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>( + ) Fondo Inicial Recibido:</span>
                  <span className="font-mono font-bold text-slate-700">${effectiveInitialCash.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>( + ) Efectivo por Ventas del Turno:</span>
                  <span className="font-mono font-bold text-emerald-600">+${cashSalesTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>( - ) Gastos en Efectivo Registrados:</span>
                  <span className="font-mono font-bold text-rose-600">-${totalExpenses.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase">Efectivo Total en Cajón:</span>
                  <span className="text-lg font-black text-emerald-700 font-mono">${expectedCashInDrawer.toFixed(2)}</span>
                </div>
              </div>

              {/* APARTADO PRINCIPAL: MONTO QUE SE DEJA DE FONDO */}
              <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    <span>Monto que se Deja de Fondo</span>
                  </label>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Para el Próximo Turno
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-700 font-black text-lg">
                    $
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={nextCashFundInput}
                    onChange={(e) => setNextCashFundInput(e.target.value)}
                    placeholder="0.00"
                    className="block w-full pl-9 pr-4 py-3 border-2 border-emerald-400 rounded-2xl text-slate-900 font-mono font-black text-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 bg-emerald-50/30 transition-all"
                  />
                </div>

                {/* Botones de Selección Rápida de Fondo */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Accesos rápidos sugeridos:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[500, 1000, 1500, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setNextCashFundInput(amt.toString())}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        ${amt}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setNextCashFundInput(effectiveInitialCash.toString())}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-xs font-black transition-all cursor-pointer"
                      title="Dejar el mismo fondo con el que se abrió el turno"
                    >
                      Mismo Inicial (${effectiveInitialCash.toFixed(0)})
                    </button>

                    <button
                      type="button"
                      onClick={() => setNextCashFundInput(expectedCashInDrawer.toString())}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      title="Dejar todo el dinero en el cajón"
                    >
                      Dejar Todo (${expectedCashInDrawer.toFixed(0)})
                    </button>

                    <button
                      type="button"
                      onClick={() => setNextCashFundInput('0')}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      title="Retirar todo el efectivo sin dejar fondo"
                    >
                      $0 (Retirar Todo)
                    </button>
                  </div>
                </div>
              </div>

              {/* Cálculo en Vivo del Retiro / Sobre de Entrega */}
              {(() => {
                const parsedFund = parseFloat(nextCashFundInput) || 0;
                const cashToWithdraw = Math.max(0, expectedCashInDrawer - parsedFund);
                const isFundHigherThanDrawer = parsedFund > expectedCashInDrawer;

                return (
                  <div className="space-y-2">
                    <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>Efectivo Total en Cajón:</span>
                        <span className="font-mono font-bold">${expectedCashInDrawer.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-emerald-400">
                        <span>( - ) Fondo que se Queda en Caja:</span>
                        <span className="font-mono font-bold">-${parsedFund.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-yellow-300 uppercase block">
                            Efectivo a Retirar / Entregar:
                          </span>
                          <span className="text-[10px] text-slate-400">Sobre de depósito o resguardo</span>
                        </div>
                        <span className="text-xl font-black text-yellow-300 font-mono">
                          ${cashToWithdraw.toFixed(2)} MXN
                        </span>
                      </div>
                    </div>

                    {isFundHigherThanDrawer && (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Nota: El fondo especificado (${parsedFund.toFixed(2)}) supera el dinero total disponible en caja (${expectedCashInDrawer.toFixed(2)}).
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Notas u Observaciones Opcionales */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  Notas u Observaciones del Cierre (Opcional):
                </label>
                <input
                  type="text"
                  value={shiftClosureNotes}
                  onChange={(e) => setShiftClosureNotes(e.target.value)}
                  placeholder="Ej: Se dejaron 5 monedas de $10 y $500 en billetes para cambio"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>

            </div>

            {/* Footer de Confirmación */}
            <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsClosingShiftDialog(false)}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Regresar al Resumen
              </button>

              <button
                type="button"
                onClick={() => {
                  const finalFund = parseFloat(nextCashFundInput);
                  handleFinalizeShift(isNaN(finalFund) || finalFund < 0 ? 0 : finalFund, shiftClosureNotes);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 hover:from-indigo-800 hover:to-blue-800 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Confirmar Fondo, Finalizar y Cerrar Sesión</span>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-200" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
