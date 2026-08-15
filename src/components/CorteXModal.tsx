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
  Send
} from 'lucide-react';
import { SaleTicket, Expense, Branch, Operator, CorteXRecord, CartItemMetadata } from '../types';

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
  const [activeTab, setActiveTab] = useState<'arqueo' | 'copiar_lista'>('arqueo');

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
  const effectiveInitialCash = isHistoric ? existingCorteRecord.initialCashFund : initialCashFund;

  // Filter for effective branch / tickets
  let branchTickets: SaleTicket[] = [];
  let branchExpenses: Expense[] = [];

  if (isHistoric) {
    if (existingCorteRecord.ticketsSnapshot && existingCorteRecord.ticketsSnapshot.length > 0) {
      branchTickets = existingCorteRecord.ticketsSnapshot;
    } else {
      branchTickets = tickets.filter((t) => 
        existingCorteRecord.ticketIds?.includes(t.id) || 
        (t.corteXId === existingCorteRecord.id) ||
        (t.branchId === effectiveBranchId && t.timestamp.startsWith(existingCorteRecord.timestamp.split('T')[0]))
      );
    }

    if (existingCorteRecord.expensesSnapshot && existingCorteRecord.expensesSnapshot.length > 0) {
      branchExpenses = existingCorteRecord.expensesSnapshot;
    } else {
      branchExpenses = expenses.filter((e) => 
        existingCorteRecord.expenseIds?.includes(e.id) || 
        (e.corteXId === existingCorteRecord.id) ||
        (e.branchId === effectiveBranchId && e.timestamp.startsWith(existingCorteRecord.timestamp.split('T')[0]))
      );
    }
  } else {
    // Active current shift: only unclosed tickets/expenses for current branch
    branchTickets = tickets.filter((t) => t.branchId === currentBranch.id && !t.corteXId);
    branchExpenses = expenses.filter((e) => e.branchId === currentBranch.id && !e.corteXId);
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
    if (ticket.paymentMethod === 'Efectivo') cashSalesTotal += ticket.total;
    if (ticket.paymentMethod === 'Tarjeta') cardSalesTotal += ticket.total;
    if (ticket.paymentMethod === 'Transferencia') transferSalesTotal += ticket.total;

    ticket.items.forEach((item, itemIdx) => {
      const pName = item.product.name;
      const pNameLower = pName.toLowerCase();
      const cat = item.product.category;
      const itemTotal = item.totalPrice;
      const qty = item.quantity;
      const unitPrice = item.unitPrice || (qty > 0 ? itemTotal / qty : itemTotal);
      const timeStr = new Date(ticket.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

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
      } else if (pNameLower.includes('anticipo') || pNameLower.includes('liquidaci') || pNameLower.includes('saldo final') || cat === 'servicio' || item.metadata?.repairType) {
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
        ticketFolio: ticket.folio || ticket.id,
        paymentMethod: ticket.paymentMethod,
        time: timeStr,
        qty,
        totalPrice: itemTotal,
        metadata: item.metadata
      };

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
        id: `${ticket.id}_${itemIdx}_${item.product.id || itemIdx}`,
        ticketId: ticket.id,
        ticketFolio: ticket.folio || ticket.id,
        time: timeStr,
        productName: pName,
        category: catKey,
        categoryLabel,
        quantity: qty,
        unitPrice,
        totalPrice: itemTotal,
        paymentMethod: ticket.paymentMethod,
        metadata: item.metadata
      });
    });
  });

  // Group Expenses by concept
  const expenseMap: Record<string, { concept: string; count: number; total: number }> = {};
  branchExpenses.forEach((exp) => {
    const key = exp.concept.trim();
    if (!expenseMap[key]) {
      expenseMap[key] = { concept: key, count: 0, total: 0 };
    }
    expenseMap[key].count += 1;
    expenseMap[key].total += exp.amount;
  });

  const groupedExpenseList = Object.values(expenseMap).sort((a, b) => b.total - a.total);

  const categoryItems = {
    accesorios: Object.values(categoryConceptMaps.accesorios).sort((a, b) => b.total - a.total),
    abonos: Object.values(categoryConceptMaps.abonos).sort((a, b) => b.total - a.total),
    enganches: Object.values(categoryConceptMaps.enganches).sort((a, b) => b.total - a.total),
    reparaciones: Object.values(categoryConceptMaps.reparaciones).sort((a, b) => b.total - a.total),
    recargas: Object.values(categoryConceptMaps.recargas).sort((a, b) => b.total - a.total),
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
          const time = new Date(exp.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          lines.push(`  ${idx + 1}. ${exp.concept} - Monto: -$${exp.amount.toFixed(2)} [${time} • Op: ${exp.operatorName || effectiveOperatorName}]`);
        });
      }
      lines.push(``);
    }

    // 6. BALANCE FINAL DE CAJÓN
    if (incDrawer) {
      lines.push(`💵 ARQUEO DE EFECTIVO EN CAJÓN:`);
      lines.push(`----------------------------------------`);
      lines.push(`• (+) Fondo Inicial: $${effectiveInitialCash.toFixed(2)}`);
      lines.push(`• (+) Efectivo por Ventas: +$${cashSalesTotal.toFixed(2)}`);
      lines.push(`• (-) Gastos en Efectivo: -$${totalExpenses.toFixed(2)}`);
      lines.push(`----------------------------------------`);
      lines.push(`👉 EFECTIVO TOTAL EN CAJA: $${expectedCashInDrawer.toFixed(2)} MXN`);
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

  const handlePrint = () => {
    window.print();
  };

  const handleFinalizeShift = (andLogout: boolean = false) => {
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

    if (onFinalizeCorteX) {
      onFinalizeCorteX(corteRecord);
    }

    // Trigger print
    window.print();

    onClose();

    if (andLogout && onLogout) {
      setTimeout(() => {
        onLogout();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      
      {/* Thermal POS Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-corte-x-receipt, #thermal-corte-x-receipt * {
            visibility: visible !important;
          }
          #thermal-corte-x-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            background: white !important;
            color: black !important;
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Hidden Thermal Receipt for POS Thermal Printer (80mm) */}
      <div id="thermal-corte-x-receipt" className="hidden print:block text-black font-mono text-[11px] leading-tight space-y-2">
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
            <span>( + ) Fondo Inicial de Caja:</span>
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
            <span>TOTAL EFECTIVO EN CAJA:</span>
            <span>${expectedCashInDrawer.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-[10px] text-gray-700">
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
                <button
                  type="button"
                  onClick={() => setQuickMenuOpen(!quickMenuOpen)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  title="Copiar reporte o lista detallada al portapapeles"
                >
                  <Copy className="w-4 h-4 text-emerald-200" />
                  <span>Copiar Corte X</span>
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
                </button>

                {/* Dropdown Menu Rápido */}
                {quickMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95">
                    <button
                      onClick={() => handleCopyClipboard('full', '¡Corte X Completo + Vendidos + Gastos Copiado!')}
                      className="w-full text-left p-2 hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-slate-200 hover:text-white"
                    >
                      <ListChecks className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-black">Copiar Todo al Portapapeles</p>
                        <p className="text-[10px] text-slate-400">Corte + Lista de Vendidos + Gastos</p>
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
                          <p className="text-[10px] text-emerald-400/80">Abre WhatsApp con el reporte listo</p>
                        </div>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setActiveTab('copiar_lista');
                          setQuickMenuOpen(false);
                        }}
                        className="w-full text-left p-2 hover:bg-blue-900/40 rounded-xl flex items-center gap-2 cursor-pointer transition-colors font-bold text-blue-300"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <p className="text-xs font-black">Seleccionar y Personalizar...</p>
                          <p className="text-[10px] text-blue-400/80">Elige artículos específicos a copiar</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Imprimir Ticket Térmico */}
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline">Imprimir</span> Ticket
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
          <div className="flex items-center px-4 pt-2 gap-2 bg-slate-950/90 text-xs">
            <button
              onClick={() => setActiveTab('arqueo')}
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 ${
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
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 ${
                activeTab === 'copiar_lista'
                  ? 'bg-white text-slate-900 border-emerald-500 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900'
              }`}
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copiar y Seleccionar Lista de Vendidos & Gastos</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                {allDetailedSoldItems.length + branchExpenses.length}
              </span>
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
        ) : (
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
                      const timeStr = new Date(exp.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
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
                                {exp.concept}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {timeStr} • Registrado por: {exp.operatorName || effectiveOperatorName}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-black text-xs text-rose-600 block">
                              -${exp.amount.toFixed(2)}
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
        )}

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {!isHistoric ? (
              <>
                <button
                  onClick={() => handleFinalizeShift(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  title="Guarda el corte oficial en la base de datos e imprime el ticket térmico"
                >
                  <PackageCheck className="w-4 h-4 text-emerald-200" />
                  <span>Imprimir y Guardar Corte Oficial</span>
                </button>

                <button
                  onClick={() => handleFinalizeShift(true)}
                  className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  title="Guarda el corte oficial, imprime el ticket y cierra la sesión para cambio de turno"
                >
                  <LogOut className="w-4 h-4 text-indigo-200" />
                  <span>Guardar Corte y Cerrar Sesión</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reimprimir el ticket térmico de este corte histórico"
                >
                  <Printer className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Reimprimir Ticket</span>
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
              onClick={() => handleCopyClipboard('full', '¡Corte X copiado con éxito!')}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copiar Corte</span>
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
    </div>
  );
}
