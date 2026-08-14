import React, { useState } from 'react';
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
  FileCheck2
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

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    accesorios: false,
    abonos: false,
    enganches: false,
    reparaciones: false,
    recargas: false,
    gastos: false,
  });

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

  branchTickets.forEach((ticket) => {
    if (ticket.paymentMethod === 'Efectivo') cashSalesTotal += ticket.total;
    if (ticket.paymentMethod === 'Tarjeta') cardSalesTotal += ticket.total;
    if (ticket.paymentMethod === 'Transferencia') transferSalesTotal += ticket.total;

    ticket.items.forEach((item) => {
      const pName = item.product.name;
      const pNameLower = pName.toLowerCase();
      const cat = item.product.category;
      const itemTotal = item.totalPrice;
      const qty = item.quantity;

      let catKey = 'accesorios';

      // Categorize Income Type
      if (pNameLower.includes('abono')) {
        totalAbonos += itemTotal;
        countAbonos += qty;
        catKey = 'abonos';
      } else if (pNameLower.includes('enganche') || (cat === 'equipo_credito' && !pNameLower.includes('abono'))) {
        totalEnganches += itemTotal;
        countEnganches += qty;
        catKey = 'enganches';
      } else if (pNameLower.includes('anticipo') || pNameLower.includes('liquidaci') || pNameLower.includes('saldo final') || cat === 'servicio' || item.metadata?.repairType) {
        totalReparaciones += itemTotal;
        countReparaciones += qty;
        catKey = 'reparaciones';
      } else if (cat === 'recarga' || pNameLower.includes('recarga')) {
        totalRecargas += itemTotal;
        countRecargas += qty;
        catKey = 'recargas';
      } else {
        totalAccesoriosProductos += itemTotal;
        countAccesoriosProductos += qty;
        catKey = 'accesorios';
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
        time: new Date(ticket.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
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

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] no-print">
        
        {/* Header Section */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80">
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
                  {isHistoric ? 'Detalle completo del corte registrado en la base de datos' : 'Resumen operativo y estado de caja en tiempo real'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                Imprimir Ticket
              </button>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Parameter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-950/80 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-900/40 border border-blue-700/50 flex items-center justify-center text-blue-400 shrink-0">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wide">Sucursal</span>
                <span className="font-black text-white text-xs truncate block">{effectiveBranchName}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wide">Operador</span>
                <span className="font-black text-white text-xs truncate block">{effectiveOperatorName}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wide">Fecha & Hora</span>
                <span className="font-bold text-slate-200 text-xs truncate block">{currentTimeStr} <span className="text-[10px] text-slate-400">({currentDateStr})</span></span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-900/40 border border-amber-700/50 flex items-center justify-center text-amber-400 shrink-0">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wide">Operaciones</span>
                <span className="font-black text-amber-300 text-xs truncate block">{branchTickets.length} Ventas | {branchExpenses.length} Gastos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">

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

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  );
}
