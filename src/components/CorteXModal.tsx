import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  CreditCard, 
  TrendingDown, 
  Printer, 
  X, 
  Store, 
  Clock, 
  User, 
  Receipt, 
  ShoppingBag, 
  FileCheck2,
  Copy,
  Check,
  Send,
  DollarSign,
  AlertCircle,
  Coins,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  CheckSquare,
  Square
} from 'lucide-react';
import { SaleTicket, Expense, Branch, Operator, CorteXRecord, CartItemMetadata } from '../types';
import { safeDateIsoKey, safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import { saveBranchFundToFirestore } from '../lib/firebase';
import { belongsToOpenSession, classifySaleItem } from '../lib/saleClassification';
import { money } from '../lib/ids';
import { printThermalFromElement } from '../lib/printWindow';

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
  cortesX?: CorteXRecord[];
  onSelectExistingCorte?: (corteRecord: CorteXRecord) => void;
  activeSessionId?: string;
  sessionOpenedAt?: string;
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
  id: string;
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
  onLogout,
  cortesX = [],
  activeSessionId,
  sessionOpenedAt
}: CorteXModalProps) {

  // Tabs: Arqueo, Ticket 58mm preview, or Copiar Lista
  const [activeTab, setActiveTab] = useState<'arqueo' | 'ticket' | 'copiar_lista'>('arqueo');
  
  // Printing state
  const [hasPrinted, setHasPrinted] = useState(false);

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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Shift Finalization state
  const [isClosingShiftDialog, setIsClosingShiftDialog] = useState(false);
  const [nextCashFundInput, setNextCashFundInput] = useState<string>('');
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [shiftClosureNotes, setShiftClosureNotes] = useState<string>('');
  const [shouldPrintOnClose, setShouldPrintOnClose] = useState<boolean>(true);
  const [isFinishingShift, setIsFinishingShift] = useState<boolean>(false);
  const [finishStatusMessage, setFinishStatusMessage] = useState<string>('');
  const [closedShiftFundSnapshot, setClosedShiftFundSnapshot] = useState<{ fundLeft: number; cashWithdrawn: number; notes: string } | null>(null);

  // Track selected items for custom WhatsApp sharing
  const [selectedSoldItemIds, setSelectedSoldItemIds] = useState<Set<string>>(new Set());
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const isHistoric = !!existingCorteRecord;

  // Determine branch info
  const effectiveBranchName = isHistoric ? existingCorteRecord.branchName : (currentBranch?.name || 'Sucursal');
  const effectiveBranchId = isHistoric ? existingCorteRecord.branchId : (currentBranch?.id || 'main');
  const effectiveOperatorName = isHistoric ? existingCorteRecord.operatorName : (currentOperator?.name || 'Cajero');
  
  const todayDateIsoKey = safeDateIsoKey(new Date());
  const todayFormatted = safeFormatDate(new Date());
  const todaySavedCorte = !isHistoric ? (cortesX || []).find((c) => 
    c && c.branchId === effectiveBranchId && 
    (safeDateIsoKey(c.timestamp) === todayDateIsoKey || c.dateStr === todayFormatted || safeDateIsoKey(c.dateStr) === todayDateIsoKey)
  ) : null;
  const isCorteAlreadyDoneToday = !isHistoric && !!todaySavedCorte;

  // Stored branch initial cash fund calculation (with fallback hierarchy)
  const previousBranchCortes = (cortesX || []).filter(c => 
    c && c.branchId === effectiveBranchId && (!existingCorteRecord || c.id !== existingCorteRecord.id)
  );
  previousBranchCortes.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const lastClosedCorte = previousBranchCortes[0];

  let storedBranchFund = initialCashFund !== undefined ? initialCashFund : 1000.00;

  if (lastClosedCorte && typeof lastClosedCorte.cashFundLeftForNextShift === 'number' && !isNaN(lastClosedCorte.cashFundLeftForNextShift)) {
    storedBranchFund = lastClosedCorte.cashFundLeftForNextShift;
  }

  try {
    const saved = localStorage.getItem(`erp_branch_fund_${effectiveBranchId}`);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0) {
        storedBranchFund = parsed;
      }
    }
  } catch {}

  if (initialCashFund !== undefined && initialCashFund !== null && !isNaN(initialCashFund)) {
    storedBranchFund = initialCashFund;
  }

  const effectiveInitialCash = isHistoric ? existingCorteRecord.initialCashFund : storedBranchFund;

  // Filter tickets and expenses
  let branchTickets: SaleTicket[] = [];
  let branchExpenses: Expense[] = [];

  if (isHistoric && existingCorteRecord) {
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
    branchTickets = (tickets || []).filter((t) => {
      if (!t || t.branchId !== effectiveBranchId || t.corteXId) return false;
      if (activeSessionId) {
        return belongsToOpenSession(t, {
          branchId: effectiveBranchId,
          sessionId: activeSessionId,
          sessionOpenedAt: sessionOpenedAt || ''
        });
      }
      const todayIso = safeDateIsoKey(new Date());
      return !!todayIso && safeDateIsoKey(t.timestamp) === todayIso;
    });
    branchExpenses = (expenses || []).filter((e) => {
      if (!e || e.branchId !== effectiveBranchId || e.corteXId) return false;
      if (activeSessionId) {
        return belongsToOpenSession(
          { branchId: e.branchId, corteXId: e.corteXId, sesion_caja_id: e.sesion_caja_id, timestamp: e.timestamp },
          { branchId: effectiveBranchId, sessionId: activeSessionId, sessionOpenedAt: sessionOpenedAt || '' }
        );
      }
      const todayIso = safeDateIsoKey(new Date());
      return !!todayIso && safeDateIsoKey(e.timestamp || e.date) === todayIso;
    });
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

  const categoryConceptMaps: Record<string, Record<string, ConceptGroup>> = {
    accesorios: {},
    abonos: {},
    enganches: {},
    reparaciones: {},
    recargas: {},
  };

  const allDetailedSoldItems: DetailedSoldItem[] = [];

  branchTickets.forEach((ticket) => {
    if (!ticket) return;
    const ticketTotal = typeof ticket.total === 'number' ? ticket.total : parseFloat((ticket.total as any) || '0') || 0;
    const paymentMethod = ticket.paymentMethod || 'Efectivo';
    if (ticketTotal > 0) {
      if (paymentMethod === 'Efectivo') cashSalesTotal += ticketTotal;
      if (paymentMethod === 'Tarjeta') cardSalesTotal += ticketTotal;
      if (paymentMethod === 'Transferencia') transferSalesTotal += ticketTotal;
    }

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

      const catKey = classifySaleItem(item);
      let categoryLabel = 'Accesorios y Productos';

      if (catKey === 'abonos') {
        totalAbonos += itemTotal;
        countAbonos += qty;
        categoryLabel = 'Abonos a Crédito';
      } else if (catKey === 'enganches') {
        totalEnganches += itemTotal;
        countEnganches += qty;
        categoryLabel = 'Enganches de Celular';
      } else if (catKey === 'reparaciones') {
        totalReparaciones += itemTotal;
        countReparaciones += qty;
        categoryLabel = 'Taller / Reparaciones';
      } else if (catKey === 'recargas') {
        totalRecargas += itemTotal;
        countRecargas += qty;
        categoryLabel = 'Recargas';
      } else {
        totalAccesoriosProductos += itemTotal;
        countAccesoriosProductos += qty;
        categoryLabel = 'Productos / Equipos';
      }

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

  // If historic, use stored breakdown totals
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

  // Initialize selection
  useEffect(() => {
    if (isOpen) {
      setSelectedSoldItemIds(new Set(allDetailedSoldItems.map(i => i.id)));
      setSelectedExpenseIds(new Set(branchExpenses.map(e => e.id)));
      setHasPrinted(false);
    }
  }, [isOpen, branchTickets.length, branchExpenses.length]);

  const handlePrintThermal = () => {
    try {
      printThermalFromElement('corte-thermal-receipt-container', 'Corte de caja');
      setHasPrinted(true);
    } catch (e) {
      console.error('Error triggering window.print():', e);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePrintThermal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDateStr = isHistoric ? existingCorteRecord.dateStr : safeFormatDate(new Date());
  const currentTimeStr = isHistoric ? existingCorteRecord.timeStr : safeFormatTime(new Date());
  const corteFolio = isHistoric ? existingCorteRecord.id : (activeSessionId || `SES-${effectiveBranchId}-${Date.now().toString(36).toUpperCase()}`);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const generateWhatsAppText = () => {
    const lines: string[] = [];
    lines.push(`========================================`);
    lines.push(`📊 CORTE X • ${effectiveBranchName.toUpperCase()}`);
    lines.push(`========================================`);
    lines.push(`👤 Cajero(a): ${effectiveOperatorName}`);
    lines.push(`📅 Fecha: ${currentDateStr}  |  ⏰ Hora: ${currentTimeStr}`);
    lines.push(`🏷️ Folio: ${corteFolio}`);
    lines.push(``);

    lines.push(`💰 RESUMEN FINANCIERO:`);
    lines.push(`----------------------------------------`);
    lines.push(`• Accesorios/Artículos: $${totalAccesoriosProductos.toFixed(2)} (${countAccesoriosProductos} pzs)`);
    lines.push(`• Abonos a Crédito: $${totalAbonos.toFixed(2)} (${countAbonos} ops)`);
    lines.push(`• Enganches Celulares: $${totalEnganches.toFixed(2)} (${countEnganches} ops)`);
    lines.push(`• Taller/Reparaciones: $${totalReparaciones.toFixed(2)} (${countReparaciones} ops)`);
    lines.push(`• Recargas Telefónicas: $${totalRecargas.toFixed(2)} (${countRecargas} ops)`);
    lines.push(`----------------------------------------`);
    lines.push(`💵 TOTAL VENTAS: $${totalSalesAll.toFixed(2)}`);
    lines.push(`🔻 GASTOS EN CAJA: -$${totalExpenses.toFixed(2)}`);
    lines.push(`📈 UTILIDAD NETA: $${netIncome.toFixed(2)}`);
    lines.push(``);

    lines.push(`💳 FORMAS DE PAGO:`);
    lines.push(`• (+) Efectivo: $${cashSalesTotal.toFixed(2)}`);
    lines.push(`• (+) Tarjeta: $${cardSalesTotal.toFixed(2)}`);
    lines.push(`• (+) Transferencias: $${transferSalesTotal.toFixed(2)}`);
    lines.push(``);

    lines.push(`💵 ARQUEO DE EFECTIVO EN CAJÓN:`);
    lines.push(`• (+) Fondo Inicial: $${effectiveInitialCash.toFixed(2)}`);
    lines.push(`• (+) Efectivo Ventas: +$${cashSalesTotal.toFixed(2)}`);
    lines.push(`• (-) Gastos Efectivo: -$${totalExpenses.toFixed(2)}`);
    lines.push(`----------------------------------------`);
    lines.push(`👉 EFECTIVO TOTAL EN CAJA: $${expectedCashInDrawer.toFixed(2)} MXN`);

    if (isHistoric && existingCorteRecord.cashFundLeftForNextShift !== undefined) {
      lines.push(`📌 FONDO DEJADO: $${existingCorteRecord.cashFundLeftForNextShift.toFixed(2)}`);
      lines.push(`💵 RETIRADO/ENTREGADO: $${(existingCorteRecord.cashWithdrawn ?? 0).toFixed(2)}`);
    }

    lines.push(`========================================`);
    return lines.join('\n');
  };

  const handleCopyClipboard = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification('¡Corte X copiado al portapapeles!');
      setTimeout(() => setCopiedNotification(null), 3000);
    });
  };

  const handleShareWhatsApp = () => {
    const text = generateWhatsAppText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleOpenCloseShiftDialog = () => {
    const defaultLeftFund = storedBranchFund > 0 
      ? storedBranchFund 
      : Math.min(1000, Math.max(0, expectedCashInDrawer));
    setNextCashFundInput(defaultLeftFund.toFixed(2));
    setCountedCashInput(expectedCashInDrawer.toFixed(2));
    setShiftClosureNotes('');
    setShouldPrintOnClose(true);
    setIsClosingShiftDialog(true);
  };

  const handleFinalizeShift = async (fundLeft: number, notes: string, printTicket: boolean, countedCash: number) => {
    if (isFinishingShift) return;
    const cashWithdrawn = Math.max(0, money(countedCash) - fundLeft);
    setClosedShiftFundSnapshot({ fundLeft, cashWithdrawn, notes });
    setIsFinishingShift(true);
    setIsClosingShiftDialog(false);
    setFinishStatusMessage('Guardando Corte X y registrando fondo de caja en la nube...');

    // 1. Guardar persistentemente el fondo para el nuevo día en Firestore y localStorage
    try {
      localStorage.setItem(`erp_branch_fund_${effectiveBranchId}`, fundLeft.toFixed(2));
    } catch {}
    try {
      await saveBranchFundToFirestore(effectiveBranchId, fundLeft);
    } catch (e) {
      console.error('Error saving branch fund to Firestore:', e);
    }

    const corteRecord: CorteXRecord = {
      id: corteFolio,
      timestamp: new Date().toISOString(),
      dateStr: currentDateStr,
      timeStr: currentTimeStr,
      branchId: effectiveBranchId,
      branchName: effectiveBranchName,
      operatorName: effectiveOperatorName,
      initialCashFund: effectiveInitialCash,
      cashFundLeftForNextShift: fundLeft,
      cashWithdrawn: cashWithdrawn,
      closingNotes: notes || undefined,
      cashSales: cashSalesTotal,
      cardSales: cardSalesTotal,
      transferSales: transferSalesTotal,
      totalSales: totalSalesAll,
      totalExpenses: totalExpenses,
      netIncome: netIncome,
      expectedCashInDrawer: expectedCashInDrawer,
      countedCash: money(countedCash),
      cashDifference: money(countedCash - expectedCashInDrawer),
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
        recargasCount: countRecargas,
      }
    };

    // 2. Ejecutar guardado del corte en estado y Firestore
    if (onFinalizeCorteX) {
      try {
        await onFinalizeCorteX(corteRecord);
      } catch (err) {
        console.error('Error in onFinalizeCorteX:', err);
        setIsFinishingShift(false);
        setIsClosingShiftDialog(true);
        setFinishStatusMessage('');
        setCopiedNotification('No se pudo guardar el corte. El turno sigue abierto; inténtalo de nuevo.');
        setTimeout(() => setCopiedNotification(null), 5000);
        return;
      }
    }

    // 3. Imprimir resumen de ventas del día y cerrar sesión en automático
    if (printTicket) {
      setFinishStatusMessage('Imprimiendo resumen de ventas del día...');

      setTimeout(() => {
        let sessionTerminated = false;
        const doAutoLogout = () => {
          if (sessionTerminated) return;
          sessionTerminated = true;
          setFinishStatusMessage('Corte X generado e impreso. Cerrando sesión de turno...');
          setTimeout(() => {
            if (onLogout) {
              onLogout();
            } else {
              onClose();
            }
          }, 350);
        };

        try {
          printThermalFromElement('corte-thermal-receipt-container', 'Corte de caja');
        } catch (e) {
          console.error('Error triggering window.print:', e);
        }

        setTimeout(() => {
          doAutoLogout();
        }, 2200);
      }, 400);

    } else {
      // Si desmarcó imprimir: finalizar y cerrar sesión directamente
      setFinishStatusMessage('Turno cerrado exitosamente. Cerrando sesión...');
      setTimeout(() => {
        if (onLogout) {
          onLogout();
        } else {
          onClose();
        }
      }, 600);
    }
  };

  const filteredSoldItems = categoryFilter === 'all' 
    ? allDetailedSoldItems 
    : allDetailedSoldItems.filter(i => i.category === categoryFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      
      {/* 58mm POS Thermal Printing Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 58mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #corte-thermal-receipt-container, #corte-thermal-receipt-container * {
            visibility: visible !important;
            display: block !important;
          }
          #corte-thermal-receipt-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 56mm !important;
            max-width: 58mm !important;
            padding: 2mm 2mm 14mm 2mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
            word-break: break-word !important;
          }
          #corte-thermal-receipt-container .flex {
            display: flex !important;
          }
          #corte-thermal-receipt-container .inline-block {
            display: inline-block !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        
        {/* Copied Toast Banner */}
        {copiedNotification && (
          <div className="bg-emerald-600 text-white text-xs font-black py-2 px-4 text-center shrink-0 flex items-center justify-center gap-2 animate-in slide-in-from-top duration-150 no-print">
            <Check className="w-4 h-4" />
            <span>{copiedNotification}</span>
          </div>
        )}

        {/* Clean Header */}
        <div className="bg-slate-900 text-white border-b border-slate-800 shrink-0 no-print">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg tracking-tight text-white">
                    {isHistoric ? 'Corte X • Arqueo Guardado' : 'Corte X • Arqueo Parcial'}
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                    {corteFolio}
                  </span>
                  {isHistoric && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
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

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintThermal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Imprimir Corte X en Ticket Térmico 58mm (Atajo: P)"
              >
                <Printer className="w-4 h-4 text-cyan-200" />
                <span>Imprimir Ticket (58mm)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyClipboard}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                title="Copiar texto para WhatsApp o mensaje"
              >
                <Copy className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Copiar</span>
              </button>

              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Cerrar ventana (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Simple Tab Bar */}
          <div className="flex items-center px-4 pt-1 gap-2 bg-slate-950 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('arqueo')}
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 shrink-0 ${
                activeTab === 'arqueo'
                  ? 'bg-white text-slate-900 border-blue-500 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              <span>Arqueo y Balance de Caja</span>
            </button>

            <button
              onClick={() => setActiveTab('ticket')}
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 shrink-0 ${
                activeTab === 'ticket'
                  ? 'bg-white text-slate-900 border-indigo-500 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              <span>Vista Ticket Térmico (58mm)</span>
            </button>

            <button
              onClick={() => setActiveTab('copiar_lista')}
              className={`px-4 py-2 rounded-t-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 shrink-0 ${
                activeTab === 'copiar_lista'
                  ? 'bg-white text-slate-900 border-emerald-500 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copiar Lista (WhatsApp)</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                {allDetailedSoldItems.length + branchExpenses.length}
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-100/70 space-y-4 no-print">

          {/* TAB 1: ARQUEO DE TURNO */}
          {activeTab === 'arqueo' && (
            <div className="space-y-4">
              
              {/* Top KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase">Ventas Brutas</span>
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    ${totalSalesAll.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {branchTickets.length} tickets emitidos
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase">Gastos de Caja</span>
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-xl font-black text-rose-600 font-mono">
                    -${totalExpenses.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {branchExpenses.length} salidas registradas
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase">Utilidad Neta</span>
                    <Coins className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    ${netIncome.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Ventas menos Gastos
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-3.5 rounded-2xl shadow-md border border-indigo-700/50">
                  <div className="flex items-center justify-between text-indigo-300 mb-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider">Efectivo en Caja</span>
                    <DollarSign className="w-4 h-4 text-yellow-300" />
                  </div>
                  <div className="text-xl font-black text-yellow-300 font-mono">
                    ${expectedCashInDrawer.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-indigo-200 mt-0.5">
                    Fondo ($ {effectiveInitialCash.toFixed(2)}) + Efectivo
                  </div>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Ingresos por Medio de Pago</span>
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-bold text-slate-600 uppercase">Efectivo Cobrado</p>
                    <p className="text-base font-black text-slate-900 font-mono mt-0.5">${cashSalesTotal.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-bold text-slate-600 uppercase">Tarjeta (TPV / Terminal)</p>
                    <p className="text-base font-black text-slate-900 font-mono mt-0.5">${cardSalesTotal.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-bold text-slate-600 uppercase">Transferencias SPEI</p>
                    <p className="text-base font-black text-slate-900 font-mono mt-0.5">${transferSalesTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Concept Categories Accordions */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
                <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-slate-600" />
                    <span>Desglose por Concepto / Categoría</span>
                  </h4>
                  <span className="text-xs text-slate-500">Haz clic en una fila para ver el detalle</span>
                </div>

                {/* Accesorios y Productos */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCategory('accesorios')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900">Accesorios y Productos de Tienda</span>
                        <span className="text-[11px] text-slate-500 ml-2">({countAccesoriosProductos} pzs)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900 font-mono">${totalAccesoriosProductos.toFixed(2)}</span>
                      {expandedCategories.accesorios ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {expandedCategories.accesorios && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-1.5 border-t border-slate-100">
                      {categoryItems.accesorios.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1">Sin ventas registradas en esta categoría.</p>
                      ) : (
                        categoryItems.accesorios.map((grp, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                            <span className="text-slate-700 font-medium">{grp.count}x {grp.name}</span>
                            <span className="font-mono font-bold text-slate-900">${grp.total.toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Abonos a Crédito */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCategory('abonos')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900">Abonos a Crédito (CrediYa / PayJoy)</span>
                        <span className="text-[11px] text-slate-500 ml-2">({countAbonos} ops)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900 font-mono">${totalAbonos.toFixed(2)}</span>
                      {expandedCategories.abonos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {expandedCategories.abonos && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-2 border-t border-slate-100">
                      {(() => {
                        const abonoItems = allDetailedSoldItems.filter(i => i.category === 'abonos');
                        if (abonoItems.length === 0) {
                          return <p className="text-xs text-slate-400 italic py-1">Sin abonos registrados.</p>;
                        }
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-0.5 border-b border-slate-200">
                              <span>Detalle de Abonos ({abonoItems.length})</span>
                              <span>Monto / Pago</span>
                            </div>
                            {abonoItems.map((item, idx) => (
                              <div key={item.id || idx} className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition-colors">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900">{item.productName}</span>
                                    <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100">
                                      {item.ticketFolio}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                    <span className="font-medium">{item.time}</span>
                                    <span>•</span>
                                    <span className="font-medium text-slate-600">{item.paymentMethod}</span>
                                    {item.metadata?.deviceModel && (
                                      <>
                                        <span>•</span>
                                        <span className="font-medium text-indigo-600">{item.metadata.deviceModel}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-black text-sm text-indigo-700">
                                    ${item.totalPrice.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Enganches Celular */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCategory('enganches')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900">Enganches de Celular (Financiamiento / Contado)</span>
                        <span className="text-[11px] text-slate-500 ml-2">({countEnganches} ops)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900 font-mono">${totalEnganches.toFixed(2)}</span>
                      {expandedCategories.enganches ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {expandedCategories.enganches && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-1.5 border-t border-slate-100">
                      {categoryItems.enganches.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1">Sin enganches registrados.</p>
                      ) : (
                        categoryItems.enganches.map((grp, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                            <span className="text-slate-700 font-medium">{grp.count}x {grp.name}</span>
                            <span className="font-mono font-bold text-slate-900">${grp.total.toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Reparaciones / Taller */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCategory('reparaciones')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900">Taller / Reparaciones</span>
                        <span className="text-[11px] text-slate-500 ml-2">({countReparaciones} ops)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900 font-mono">${totalReparaciones.toFixed(2)}</span>
                      {expandedCategories.reparaciones ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {expandedCategories.reparaciones && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-1.5 border-t border-slate-100">
                      {categoryItems.reparaciones.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1">Sin reparaciones cobradas.</p>
                      ) : (
                        categoryItems.reparaciones.map((grp, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                            <span className="text-slate-700 font-medium">{grp.count}x {grp.name}</span>
                            <span className="font-mono font-bold text-slate-900">${grp.total.toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Recargas Telefónicas */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCategory('recargas')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900">Recargas de Tiempo Aire</span>
                        <span className="text-[11px] text-slate-500 ml-2">({countRecargas} ops)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900 font-mono">${totalRecargas.toFixed(2)}</span>
                      {expandedCategories.recargas ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {expandedCategories.recargas && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-1.5 border-t border-slate-100">
                      {categoryItems.recargas.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1">Sin recargas cobradas.</p>
                      ) : (
                        categoryItems.recargas.map((grp, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                            <span className="text-slate-700 font-medium">{grp.count}x {grp.name}</span>
                            <span className="font-mono font-bold text-slate-900">${grp.total.toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Gastos y Retiros */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCategory('gastos')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900">Gastos y Salidas de Caja</span>
                        <span className="text-[11px] text-slate-500 ml-2">({branchExpenses.length} regs)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-rose-600 font-mono">-${totalExpenses.toFixed(2)}</span>
                      {expandedCategories.gastos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {expandedCategories.gastos && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-1.5 border-t border-slate-100">
                      {branchExpenses.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1">Sin gastos registrados en el turno.</p>
                      ) : (
                        branchExpenses.map((exp, idx) => (
                          <div key={exp.id || idx} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                            <span className="text-slate-700 font-medium">{exp.concept}</span>
                            <span className="font-mono font-bold text-rose-600">-${exp.amount.toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: VISTA TICKET TÉRMICO (58MM) */}
          {activeTab === 'ticket' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-indigo-600" />
                      <span>Vista Previa de Ticket Térmico (58mm)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Formato optimizado para miniprinters e impresoras térmicas de 58mm (Atajo de teclado: <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-800 font-mono rounded font-bold border border-slate-300 text-[10px]">P</kbd>)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrintThermal}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Mandar a Imprimir (58mm)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyClipboard}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>

                {/* Simulated Thermal Ticket Preview Container */}
                <div className="flex justify-center p-3 sm:p-6 bg-slate-200/70 rounded-2xl border border-slate-300">
                  <div className="w-[300px] bg-white p-4 rounded-xl shadow-xl border border-slate-300 font-mono text-slate-950 text-[10.5px] leading-snug space-y-2">
                    {/* Header */}
                    <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
                      <h2 className="text-base font-black tracking-tight uppercase leading-none text-slate-950">
                        CrediCel
                      </h2>
                      <p className="text-[9.5px] font-extrabold uppercase text-slate-800">
                        REPORTE DE CORTE DE CAJA (X)
                      </p>
                      <p className="text-[9.5px] font-bold text-slate-800">
                        Sucursal: {effectiveBranchName}
                      </p>
                      <p className="text-[9px] text-slate-700">
                        Cajero: {effectiveOperatorName}
                      </p>
                      <p className="text-[8.5px] text-slate-600">
                        {currentDateStr} • {currentTimeStr}
                      </p>
                      <div className="inline-block mt-1 px-2 py-0.5 bg-slate-900 text-white font-mono font-black text-[9.5px] rounded">
                        FOLIO: {corteFolio}
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="py-1.5 border-b border-dashed border-slate-400 space-y-1">
                      <div className="font-black text-[9.5px] uppercase border-b border-slate-400 pb-0.5">
                        RESUMEN FINANCIERO
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>Accesorios ({countAccesoriosProductos} pzs):</span>
                        <span className="font-bold">${totalAccesoriosProductos.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>Abonos Crédito ({countAbonos} ops):</span>
                        <span className="font-bold">${totalAbonos.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>Enganches ({countEnganches} ops):</span>
                        <span className="font-bold">${totalEnganches.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>Reparaciones ({countReparaciones} ops):</span>
                        <span className="font-bold">${totalReparaciones.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9.5px]">
                        <span>Recargas ({countRecargas} ops):</span>
                        <span className="font-bold">${totalRecargas.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-black border-t border-slate-900 pt-0.5">
                        <span>TOTAL VENTAS:</span>
                        <span>${totalSalesAll.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9.5px] text-rose-700 font-bold">
                        <span>(-) GASTOS CAJA:</span>
                        <span>-${totalExpenses.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10.5px] font-black border-t border-double border-slate-900 pt-0.5">
                        <span>UTILIDAD NETA:</span>
                        <span>${netIncome.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Detalle de Artículos Vendidos */}
                    <div className="py-1.5 border-b border-dashed border-slate-400 space-y-1">
                      <div className="font-black text-[9.5px] uppercase border-b border-slate-400 pb-0.5 flex justify-between">
                        <span>DETALLE DE VENTAS</span>
                        <span>({allDetailedSoldItems.length} PZS)</span>
                      </div>
                      {allDetailedSoldItems.length === 0 ? (
                        <div className="text-[9px] italic text-center py-1 text-slate-500">Sin ventas registradas</div>
                      ) : (
                        <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                          {allDetailedSoldItems.map((item, idx) => (
                            <div key={item.id || idx} className="text-[9px] leading-tight border-b border-slate-100 pb-0.5">
                              <div className="flex justify-between font-bold">
                                <span className="truncate pr-1">{item.quantity}x {item.productName}</span>
                                <span className="shrink-0">${item.totalPrice.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-[8px] text-slate-600">
                                <span>Folio: {item.ticketFolio}</span>
                                <span>{item.paymentMethod.toUpperCase()} • {item.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Detalle de Gastos */}
                    {branchExpenses.length > 0 && (
                      <div className="py-1.5 border-b border-dashed border-slate-400 space-y-1">
                        <div className="font-black text-[9.5px] uppercase border-b border-slate-400 pb-0.5 flex justify-between">
                          <span>SALIDAS / GASTOS DE CAJA</span>
                          <span>({branchExpenses.length})</span>
                        </div>
                        <div className="space-y-0.5">
                          {branchExpenses.map((exp, idx) => (
                            <div key={exp.id || idx} className="flex justify-between text-[9px]">
                              <span className="truncate pr-1 text-slate-700">• {exp.concept}</span>
                              <span className="font-bold text-rose-700 shrink-0">-${exp.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formas de Pago */}
                    <div className="py-1.5 border-b border-dashed border-slate-400 space-y-0.5">
                      <div className="font-black text-[9.5px] uppercase">
                        FORMAS DE PAGO
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span>Efectivo:</span>
                        <span>${cashSalesTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span>Tarjeta:</span>
                        <span>${cardSalesTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span>Transferencia:</span>
                        <span>${transferSalesTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Arqueo de Cajón */}
                    <div className="py-1.5 border-b-2 border-slate-900 space-y-0.5">
                      <div className="font-black text-[9.5px] uppercase">
                        ARQUEO DE CAJÓN
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span>(+) Fondo Inicial:</span>
                        <span>${effectiveInitialCash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span>(+) Efectivo Ventas:</span>
                        <span>+${cashSalesTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span>(-) Gastos en Efectivo:</span>
                        <span>-${totalExpenses.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10.5px] font-black border-t border-slate-900 pt-0.5">
                        <span>TOTAL EN CAJA:</span>
                        <span>${expectedCashInDrawer.toFixed(2)}</span>
                      </div>
                      {(() => {
                        const fundLeftToDisplay = isHistoric 
                          ? existingCorteRecord.cashFundLeftForNextShift 
                          : (closedShiftFundSnapshot?.fundLeft !== undefined ? closedShiftFundSnapshot.fundLeft : (parseFloat(nextCashFundInput) || undefined));
                        const cashWithdrawnToDisplay = isHistoric 
                          ? existingCorteRecord.cashWithdrawn 
                          : (closedShiftFundSnapshot?.cashWithdrawn !== undefined ? closedShiftFundSnapshot.cashWithdrawn : (fundLeftToDisplay !== undefined ? Math.max(0, expectedCashInDrawer - fundLeftToDisplay) : undefined));
                        const notesToDisplay = isHistoric 
                          ? existingCorteRecord.closingNotes 
                          : (closedShiftFundSnapshot?.notes || shiftClosureNotes || undefined);

                        return (
                          <>
                            {fundLeftToDisplay !== undefined && (
                              <div className="flex justify-between text-[9px] pt-1">
                                <span>Fondo Dejado Sig. Turno:</span>
                                <span className="font-bold">${fundLeftToDisplay.toFixed(2)}</span>
                              </div>
                            )}
                            {cashWithdrawnToDisplay !== undefined && (
                              <div className="flex justify-between text-[9px]">
                                <span>Efectivo a Entregar:</span>
                                <span className="font-bold">${cashWithdrawnToDisplay.toFixed(2)}</span>
                              </div>
                            )}
                            {notesToDisplay && (
                              <div className="text-[8.5px] pt-1 border-t border-dotted border-slate-400 mt-1">
                                <span className="font-bold">Observaciones:</span> {notesToDisplay}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Firmas de Conformidad */}
                    <div className="pt-3 pb-1 space-y-3 text-center">
                      <div>
                        <div className="border-b border-slate-400 w-3/4 mx-auto mb-0.5"></div>
                        <p className="text-[8px] font-bold text-slate-800 uppercase">
                          Firma Cajero(a): {effectiveOperatorName}
                        </p>
                      </div>
                      <div>
                        <div className="border-b border-slate-400 w-3/4 mx-auto mb-0.5"></div>
                        <p className="text-[8px] font-bold text-slate-800 uppercase">
                          Firma Auditoría / Recibió
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-1 text-center space-y-0.5">
                      <p className="text-[8px] font-bold text-slate-700">
                        *** FIN DEL REPORTE DE CORTE ***
                      </p>
                      <p className="text-[7.5px] text-slate-500">
                        CrediCel ERP • Sistema Punto de Venta
                      </p>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: COPIAR LISTA (WHATSAPP) */}
          {activeTab === 'copiar_lista' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Exportar a WhatsApp / Portapapeles</h4>
                    <p className="text-[11px] text-slate-500">Copia el resumen o compártelo directamente con un clic</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyClipboard}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiar al Portapapeles</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar por WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Filter selector */}
                <div className="flex items-center gap-2 text-xs">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-slate-600">Filtrar por categoría:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 font-bold"
                  >
                    <option value="all">Todas ({allDetailedSoldItems.length})</option>
                    <option value="accesorios">Accesorios ({categoryItems.accesorios.reduce((s, i) => s + i.count, 0)})</option>
                    <option value="abonos">Abonos ({categoryItems.abonos.reduce((s, i) => s + i.count, 0)})</option>
                    <option value="enganches">Enganches ({categoryItems.enganches.reduce((s, i) => s + i.count, 0)})</option>
                    <option value="reparaciones">Taller ({categoryItems.reparaciones.reduce((s, i) => s + i.count, 0)})</option>
                    <option value="recargas">Recargas ({categoryItems.recargas.reduce((s, i) => s + i.count, 0)})</option>
                  </select>
                </div>

                {/* Preview Box */}
                <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[300px] border border-slate-800 whitespace-pre-wrap select-all">
                  {generateWhatsAppText()}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Action Footer */}
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0 no-print border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintThermal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              title="Imprimir ticket térmico 58mm (Atajo: P)"
            >
              <Printer className="w-4 h-4 text-cyan-200" />
              <span>{isHistoric ? 'Reimprimir Ticket (58mm)' : 'Imprimir Ticket (58mm)'}</span>
            </button>
            <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">
              Atajo: <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-bold border border-slate-700">P</kbd>
            </span>
          </div>

          {!isHistoric && (
            <button
              type="button"
              onClick={handleOpenCloseShiftDialog}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Cerrar Turno (Corte)</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-200" />
            </button>
          )}
        </div>

      </div>

      {/* =================================================================================== */}
      {/* 58mm PRINTABLE THERMAL RECEIPT CONTAINER (Visible in @media print) */}
      {/* =================================================================================== */}
      <div 
        id="corte-thermal-receipt-container" 
        className="printable-thermal-receipt no-screen font-mono text-black bg-white w-[270px] p-2 text-[10px]"
      >
        {/* Header */}
        <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-black">
          <h2 className="text-base font-black tracking-tight text-black uppercase leading-none">
            CrediCel
          </h2>
          <p className="text-[9.5px] font-extrabold uppercase">
            REPORTE DE CORTE DE CAJA (X)
          </p>
          <p className="text-[9.5px] font-bold">
            Sucursal: {effectiveBranchName}
          </p>
          <p className="text-[9px]">
            Cajero: {effectiveOperatorName}
          </p>
          <p className="text-[8.5px]">
            {currentDateStr} • {currentTimeStr}
          </p>
          <div className="inline-block mt-1 px-2 py-0.5 bg-black text-white font-mono font-black text-[9.5px] rounded">
            FOLIO: {corteFolio}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="py-2 border-b border-dashed border-black space-y-1">
          <div className="font-black text-[9.5px] uppercase border-b border-black pb-0.5">
            RESUMEN FINANCIERO
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Accesorios ({countAccesoriosProductos} pzs):</span>
            <span className="font-bold">${totalAccesoriosProductos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Abonos Crédito ({countAbonos} ops):</span>
            <span className="font-bold">${totalAbonos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Enganches ({countEnganches} ops):</span>
            <span className="font-bold">${totalEnganches.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Reparaciones ({countReparaciones} ops):</span>
            <span className="font-bold">${totalReparaciones.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Recargas ({countRecargas} ops):</span>
            <span className="font-bold">${totalRecargas.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9.5px] font-black border-t border-black pt-0.5">
            <span>TOTAL VENTAS:</span>
            <span>${totalSalesAll.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px] text-black">
            <span>(-) GASTOS CAJA:</span>
            <span>-${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-black border-t border-double border-black pt-0.5">
            <span>UTILIDAD NETA:</span>
            <span>${netIncome.toFixed(2)}</span>
          </div>
        </div>

        {/* Detalle de Productos y Ventas Realizadas */}
        <div className="py-2 border-b border-dashed border-black space-y-1">
          <div className="font-black text-[9.5px] uppercase border-b border-black pb-0.5 flex justify-between">
            <span>DETALLE DE ARTÍCULOS VENDIDOS</span>
            <span>({allDetailedSoldItems.length} PZS)</span>
          </div>

          {allDetailedSoldItems.length === 0 ? (
            <div className="text-[9px] italic text-center py-1">Sin ventas registradas</div>
          ) : (
            <div className="space-y-1">
              {allDetailedSoldItems.map((item, idx) => (
                <div key={item.id || idx} className="text-[9px] leading-tight">
                  <div className="flex justify-between font-bold">
                    <span className="truncate pr-1">{item.quantity}x {item.productName}</span>
                    <span className="shrink-0">${item.totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-800">
                    <span>Folio: {item.ticketFolio}</span>
                    <span>{item.paymentMethod.toUpperCase()} • {item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalle de Gastos de Caja */}
        {branchExpenses.length > 0 && (
          <div className="py-2 border-b border-dashed border-black space-y-1">
            <div className="font-black text-[9.5px] uppercase border-b border-black pb-0.5 flex justify-between">
              <span>SALIDAS / GASTOS DE CAJA</span>
              <span>({branchExpenses.length})</span>
            </div>
            <div className="space-y-0.5">
              {branchExpenses.map((exp, idx) => (
                <div key={exp.id || idx} className="flex justify-between text-[9px]">
                  <span className="truncate pr-1">• {exp.concept}</span>
                  <span className="font-bold shrink-0">-${exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Methods */}
        <div className="py-2 border-b border-dashed border-black space-y-0.5">
          <div className="font-black text-[9.5px] uppercase">
            FORMAS DE PAGO
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Efectivo:</span>
            <span>${cashSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Tarjeta:</span>
            <span>${cardSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Transferencia:</span>
            <span>${transferSalesTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Cash Drawer Balance */}
        <div className="py-2 border-b-2 border-black space-y-0.5">
          <div className="font-black text-[9.5px] uppercase">
            ARQUEO DE CAJÓN
          </div>
          <div className="flex justify-between text-[9px]">
            <span>(+) Fondo Inicial:</span>
            <span>${effectiveInitialCash.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>(+) Efectivo Ventas:</span>
            <span>+${cashSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>(-) Gastos en Efectivo:</span>
            <span>-${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-black border-t border-black pt-0.5">
            <span>TOTAL EN CAJA:</span>
            <span>${expectedCashInDrawer.toFixed(2)}</span>
          </div>
          {(() => {
            const fundLeftToDisplay = isHistoric 
              ? existingCorteRecord.cashFundLeftForNextShift 
              : (closedShiftFundSnapshot?.fundLeft !== undefined ? closedShiftFundSnapshot.fundLeft : (parseFloat(nextCashFundInput) || undefined));
            const cashWithdrawnToDisplay = isHistoric 
              ? existingCorteRecord.cashWithdrawn 
              : (closedShiftFundSnapshot?.cashWithdrawn !== undefined ? closedShiftFundSnapshot.cashWithdrawn : (fundLeftToDisplay !== undefined ? Math.max(0, expectedCashInDrawer - fundLeftToDisplay) : undefined));
            const notesToDisplay = isHistoric 
              ? existingCorteRecord.closingNotes 
              : (closedShiftFundSnapshot?.notes || shiftClosureNotes || undefined);

            return (
              <>
                {fundLeftToDisplay !== undefined && (
                  <div className="flex justify-between text-[9px] pt-1">
                    <span>Fondo Dejado Sig. Turno:</span>
                    <span className="font-bold">${fundLeftToDisplay.toFixed(2)}</span>
                  </div>
                )}
                {cashWithdrawnToDisplay !== undefined && (
                  <div className="flex justify-between text-[9px]">
                    <span>Efectivo a Entregar:</span>
                    <span className="font-bold">${cashWithdrawnToDisplay.toFixed(2)}</span>
                  </div>
                )}
                {notesToDisplay && (
                  <div className="text-[8.5px] pt-1 border-t border-dotted border-black mt-1">
                    <span className="font-bold">Observaciones:</span> {notesToDisplay}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Firmas de Conformidad */}
        <div className="pt-4 pb-2 space-y-3 text-center">
          <div>
            <div className="border-b border-black w-3/4 mx-auto mb-0.5"></div>
            <p className="text-[8px] font-bold text-black uppercase">
              Firma Cajero(a): {effectiveOperatorName}
            </p>
          </div>
          <div>
            <div className="border-b border-black w-3/4 mx-auto mb-0.5"></div>
            <p className="text-[8px] font-bold text-black uppercase">
              Firma Auditoría / Recibió
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 pb-2 text-center space-y-0.5">
          <p className="text-[8.5px] font-bold text-black">
            *** FIN DEL REPORTE DE CORTE ***
          </p>
          <p className="text-[8px] text-black">
            CrediCel ERP • Sistema Punto de Venta
          </p>
        </div>
      </div>

      {/* Finalizing & Auto-Logout Overlay */}
      {isFinishingShift && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 no-print animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600 animate-bounce">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900">Cierre de Turno y Corte X</h4>
              <p className="text-xs text-slate-600 mt-1 font-medium">{finishStatusMessage}</p>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-3/4 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================================== */}
      {/* SIMPLE SHIFT CLOSURE DIALOG */}
      {/* =================================================================================== */}
      {isClosingShiftDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-sm text-white">Finalizar Turno y Corte</h3>
              </div>
              <button
                onClick={() => setIsClosingShiftDialog(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              
              {/* Drawer Cash Summary */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Efectivo esperado en caja:</span>
                  <strong className="text-base font-black text-slate-900 font-mono">
                    ${expectedCashInDrawer.toFixed(2)}
                  </strong>
                </div>
                <p className="text-[10px] text-slate-500">Fondo inicial + ventas en efectivo − gastos.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-800 uppercase">
                  Efectivo contado en el cajón:
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={countedCashInput}
                    onChange={(e) => setCountedCashInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                    placeholder={expectedCashInDrawer.toFixed(2)}
                  />
                </div>
                {(() => {
                  const counted = parseFloat(countedCashInput);
                  if (isNaN(counted)) return null;
                  const diff = counted - expectedCashInDrawer;
                  if (Math.abs(diff) < 0.005) {
                    return <p className="text-[11px] text-emerald-700 font-bold">Arqueo cuadrado.</p>;
                  }
                  return (
                    <p className={`text-[11px] font-bold ${diff > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {diff > 0 ? 'Sobrante' : 'Faltante'}: ${Math.abs(diff).toFixed(2)}
                    </p>
                  );
                })()}
              </div>

              {/* Fund Left Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-800 uppercase">
                  Fondo en Efectivo para el Siguiente Turno:
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={nextCashFundInput}
                    onChange={(e) => setNextCashFundInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                    placeholder="1000.00"
                  />
                </div>
                {(() => {
                  const fund = parseFloat(nextCashFundInput) || 0;
                  const counted = parseFloat(countedCashInput);
                  const base = isNaN(counted) ? expectedCashInDrawer : counted;
                  const withdraw = Math.max(0, base - fund);
                  return (
                    <p className="text-[11px] text-slate-600">
                      Efectivo a retirar / resguardar: <strong className="font-bold text-slate-900 font-mono">${withdraw.toFixed(2)}</strong>
                    </p>
                  );
                })()}
              </div>

              {/* Print Ticket checkbox */}
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-blue-950 text-xs">
                  <input
                    type="checkbox"
                    checked={shouldPrintOnClose}
                    onChange={(e) => setShouldPrintOnClose(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Imprimir Ticket de Corte (58mm) al finalizar</span>
                </label>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Notas u Observaciones (Opcional):
                </label>
                <input
                  type="text"
                  value={shiftClosureNotes}
                  onChange={(e) => setShiftClosureNotes(e.target.value)}
                  placeholder="Ej: Se dejaron billetes de $50 y monedas para cambio"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsClosingShiftDialog(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isFinishingShift) return;
                  const finalFund = parseFloat(nextCashFundInput);
                  const counted = parseFloat(countedCashInput);
                  handleFinalizeShift(
                    isNaN(finalFund) || finalFund < 0 ? 0 : finalFund,
                    shiftClosureNotes,
                    shouldPrintOnClose,
                    isNaN(counted) || counted < 0 ? expectedCashInDrawer : counted
                  );
                }}
                disabled={isFinishingShift}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isFinishingShift ? 'Guardando…' : 'Confirmar y Finalizar'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
