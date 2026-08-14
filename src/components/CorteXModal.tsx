import React, { useState } from 'react';
import { Calculator, DollarSign, CreditCard, TrendingDown, Printer, X, Store, Clock, User, PackageCheck, Zap, Receipt, ShoppingBag, Wrench, ShieldCheck, Tag, Barcode, ChevronDown, ChevronUp } from 'lucide-react';
import { SaleTicket, Expense, Branch, Operator, CorteXRecord, CartItemMetadata } from '../types';

interface CorteXModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: SaleTicket[];
  expenses: Expense[];
  currentBranch: Branch;
  currentOperator: Operator;
  initialCashFund?: number;
  onFinalizeCorteX?: (corteRecord: CorteXRecord) => void;
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
  onFinalizeCorteX
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

  // Filter for current branch
  const branchTickets = tickets.filter((t) => t.branchId === currentBranch.id);
  const branchExpenses = expenses.filter((e) => e.branchId === currentBranch.id);

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

  const conceptMap: Record<string, ConceptGroup> = {};

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

      if (!conceptMap[conceptName]) {
        conceptMap[conceptName] = {
          name: conceptName,
          count: 0,
          total: 0,
          category: cat,
          details: []
        };
      }
      conceptMap[conceptName].count += qty;
      conceptMap[conceptName].total += itemTotal;
      conceptMap[conceptName].details.push(detailObj);
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

  const conceptList = Object.values(conceptMap).sort((a, b) => b.total - a.total);
  const groupedExpenseList = Object.values(expenseMap).sort((a, b) => b.total - a.total);

  const categoryItems = {
    accesorios: Object.values(categoryConceptMaps.accesorios).sort((a, b) => b.total - a.total),
    abonos: Object.values(categoryConceptMaps.abonos).sort((a, b) => b.total - a.total),
    enganches: Object.values(categoryConceptMaps.enganches).sort((a, b) => b.total - a.total),
    reparaciones: Object.values(categoryConceptMaps.reparaciones).sort((a, b) => b.total - a.total),
    recargas: Object.values(categoryConceptMaps.recargas).sort((a, b) => b.total - a.total),
    gastos: groupedExpenseList,
  };

  const totalSalesAll = cashSalesTotal + cardSalesTotal + transferSalesTotal;
  const totalExpenses = branchExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netIncome = totalSalesAll - totalExpenses;

  const cardAndTransferTotal = cardSalesTotal + transferSalesTotal;
  const expectedCashInDrawer = initialCashFund + cashSalesTotal - totalExpenses;

  const corteFolio = `CTX-${Date.now().toString().slice(-6)}`;
  const currentDateStr = new Date().toLocaleDateString('es-MX');
  const currentTimeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const handlePrint = () => {
    window.print();
  };

  const handleFinalizeShift = () => {
    // 1. Trigger thermal print
    window.print();

    // 2. Build official CorteXRecord snapshot
    const corteRecord: CorteXRecord = {
      id: corteFolio,
      timestamp: new Date().toISOString(),
      dateStr: currentDateStr,
      timeStr: currentTimeStr,
      branchId: currentBranch.id,
      branchName: currentBranch.name,
      operatorName: currentOperator.name,
      initialCashFund,
      cashSales: cashSalesTotal,
      cardSales: cardSalesTotal,
      transferSales: transferSalesTotal,
      totalSales: totalSalesAll,
      totalExpenses,
      netIncome,
      expectedCashInDrawer,
      ticketIds: branchTickets.map((t) => t.id),
      expenseIds: branchExpenses.map((e) => e.id),
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
    onClose();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      
      {/* Thermal POS Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-corte-x-receipt, #thermal-corte-x-receipt * {
            visibility: visible;
          }
          #thermal-corte-x-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 3mm;
            margin: 0;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* HIDDEN PRINTABLE THERMAL TICKET (Visible only during window.print()) */}
      <div id="thermal-corte-x-receipt" className="hidden print:block text-black font-mono text-[11px] leading-tight space-y-2">
        <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-black">
          <h2 className="text-lg font-black uppercase">CrediCel POS</h2>
          <p className="font-bold">Sucursal: {currentBranch.name}</p>
          <p className="text-[12px] font-black my-1 uppercase">*** CORTE X / PARCIAL ***</p>
          <p>Operador: {currentOperator.name}</p>
          <p>Fecha: {currentDateStr} • {currentTimeStr}</p>
          <p className="font-bold">FOLIO: {corteFolio}</p>
        </div>

        {/* Resumen de Entradas */}
        <div className="py-1.5 border-b border-dashed border-black space-y-1">
          <p className="font-bold uppercase text-[10px]">--- RESUMEN DEL TURNO ---</p>
          <div className="flex justify-between">
            <span>Accesorios/Prod:</span>
            <span>${totalAccesoriosProductos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Abonos Crédito:</span>
            <span>${totalAbonos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Enganches Equipo:</span>
            <span>${totalEnganches.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taller/Reparac:</span>
            <span>${totalReparaciones.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Recargas T.Aire:</span>
            <span>${totalRecargas.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-black">
            <span>Gastos Turno:</span>
            <span>-${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-[12px] pt-1 border-t border-black">
            <span>NETO GANADO:</span>
            <span>${netIncome.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>TOTAL BRUTO:</span>
            <span>${totalSalesAll.toFixed(2)}</span>
          </div>
        </div>

        {/* Desglose por Forma de Pago */}
        <div className="py-1.5 border-b border-dashed border-black space-y-1">
          <p className="font-bold uppercase text-[10px]">--- ARQUEO Y MEDIOS DE PAGO ---</p>
          <div className="flex justify-between">
            <span>Fondo Inicial:</span>
            <span>${initialCashFund.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Ventas Efectivo:</span>
            <span>+${cashSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Gastos Efectivo:</span>
            <span>-${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-black pt-0.5">
            <span>EFECTIVO EN CAJA:</span>
            <span>${expectedCashInDrawer.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>Tarjeta TPV:</span>
            <span>${cardSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Transferencias:</span>
            <span>${transferSalesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>TOTAL DIGITAL:</span>
            <span>${cardAndTransferTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Desglose Específico de Productos */}
        {conceptList.length > 0 && (
          <div className="py-1.5 border-b border-dashed border-black space-y-1">
            <p className="font-bold uppercase text-[10px]">--- DESGLOSE PRODUCTOS ---</p>
            {conceptList.map((c, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span>{c.count}x {c.name.slice(0, 22)}</span>
                <span>${c.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Desglose de Gastos */}
        {groupedExpenseList.length > 0 && (
          <div className="py-1.5 border-b border-dashed border-black space-y-1">
            <p className="font-bold uppercase text-[10px]">--- DESGLOSE GASTOS ---</p>
            {groupedExpenseList.map((exp, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span>{exp.count}x {exp.concept.slice(0, 22)}</span>
                <span>-${exp.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

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
          <p>Reporte Interno de Arqueo Parcial de Caja (Corte X)</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] no-print">
        
        {/* Header Section */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg tracking-tight text-white">Corte X • Arqueo Parcial</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                    {corteFolio}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Resumen operativo y estado de caja en tiempo real</p>
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

          {/* Re-arranged Parameter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-950/80 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-900/40 border border-blue-700/50 flex items-center justify-center text-blue-400 shrink-0">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wide">Sucursal</span>
                <span className="font-black text-white text-xs truncate block">{currentBranch.name}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wide">Operador</span>
                <span className="font-black text-white text-xs truncate block">{currentOperator.name}</span>
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
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs">{cat.title}</span>
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-white/90 border border-slate-200 text-slate-700">
                              {cat.count} {cat.count === 1 ? 'operación' : 'operaciones'}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-medium block">
                            {isExpanded ? 'Clic para plegar' : 'Clic para desplegar artículos'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className={`font-mono font-black text-xs ${cat.textColor}`}>
                          {cat.isExpense && cat.total > 0 ? `-$${cat.total.toFixed(2)}` : `$${cat.total.toFixed(2)}`}
                        </span>
                        <div className="p-1 rounded bg-white/80 border border-slate-200 text-slate-700">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-2.5 bg-slate-50/60 space-y-1.5 border-t border-slate-100 animate-in fade-in duration-150">
                        {itemsList.length === 0 ? (
                          <p className="text-xs text-slate-400 italic text-center py-1.5">
                            Sin artículos ni operaciones registradas en esta categoría.
                          </p>
                        ) : cat.isExpense ? (
                          <div className="divide-y divide-red-100 border border-red-200 rounded-lg overflow-hidden bg-white">
                            {(itemsList as typeof groupedExpenseList).map((exp, idx) => (
                              <div key={idx} className="flex justify-between items-center px-3 py-1.5 text-xs hover:bg-red-50/50">
                                <div className="flex items-center gap-2">
                                  <span className="bg-red-100 text-red-900 font-black text-[10px] px-1.5 py-0.2 rounded shrink-0">
                                    {exp.count}×
                                  </span>
                                  <span className="font-bold text-slate-800">{exp.concept}</span>
                                </div>
                                <span className="font-black text-red-600 shrink-0">
                                  -${exp.total.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                            {(itemsList as ConceptGroup[]).map((item, idx) => (
                              <div key={idx} className="p-2.5 text-xs hover:bg-slate-50/80 transition-colors">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-900 font-black text-[10px] px-1.5 py-0.2 rounded shrink-0">
                                      {item.count}×
                                    </span>
                                    <span className="font-extrabold text-slate-800">{item.name}</span>
                                  </div>
                                  <span className="font-mono font-black text-slate-900 shrink-0">
                                    ${item.total.toFixed(2)}
                                  </span>
                                </div>

                                {/* Detailed transaction breakdown cards matching Sales & Reports module format */}
                                {item.details && item.details.length > 0 && (
                                  <div className="mt-2 space-y-1 pl-1 sm:pl-3">
                                    {item.details.map((d, dIdx) => (
                                      <div key={dIdx} className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 text-[10.5px] space-y-0.5 text-slate-700">
                                        <div className="flex items-center justify-between font-mono text-[9.5px] text-slate-500 border-b border-slate-200/60 pb-0.5">
                                          <span>Folio Ticket: <strong className="text-slate-800">{d.ticketFolio}</strong> ({d.paymentMethod})</span>
                                          <span>{d.time}</span>
                                        </div>
                                        {d.metadata?.clientName && (
                                          <div>👤 Cliente: <strong className="text-slate-900">{d.metadata.clientName}</strong></div>
                                        )}
                                        {d.metadata?.deviceModel && (
                                          <div>📱 Equipo: <strong className="text-slate-900">{d.metadata.deviceModel}</strong> {d.metadata.imei && <span className="font-mono text-[9.5px]">(IMEI: {d.metadata.imei})</span>}</div>
                                        )}
                                        {d.metadata?.financingPlatform && (
                                          <div>🏦 Financiera: <strong className="text-slate-900">{d.metadata.financingPlatform}</strong></div>
                                        )}
                                        {d.metadata?.fullPrice !== undefined && (
                                          <div className="pt-0.5 font-mono text-[9.5px] flex flex-wrap gap-x-2 text-indigo-950 font-semibold border-t border-slate-200/60 mt-0.5">
                                            <span>Precio Total: <strong>${d.metadata.fullPrice.toFixed(2)}</strong></span>
                                            <span>Enganche: <strong>${(d.metadata.downPayment || d.totalPrice).toFixed(2)}</strong></span>
                                            <span>Saldo Financiado: <strong className="text-emerald-700">${(d.metadata.remainingBalance ?? Math.max(0, d.metadata.fullPrice - (d.metadata.downPayment || d.totalPrice))).toFixed(2)}</strong></span>
                                          </div>
                                        )}
                                        {d.metadata?.repairType && (
                                          <div>🔧 Servicio: <strong className="text-amber-800">{d.metadata.repairType}</strong></div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* TOTAL NETO BANNER */}
            <div className="bg-slate-900 text-white p-3 rounded-xl flex justify-between items-center shadow-sm mt-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Neto Ganado (Ingresos - Gastos)
                </span>
                <span className="text-xl font-black text-emerald-400">
                  ${netIncome.toFixed(2)} <span className="text-xs font-normal text-slate-400">MXN</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Bruto
                </span>
                <span className="text-sm font-extrabold text-slate-200">
                  ${totalSalesAll.toFixed(2)}
                </span>
              </div>
            </div>

            {/* DESGLOSE POR METODO DE PAGO (EFECTIVO vs TARJETA) ABAJO DEL TOTAL */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              
              {/* Efectivo */}
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                    💵 En Efectivo (Caja)
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    Fondo: ${initialCashFund.toFixed(0)}
                  </span>
                </div>
                <div className="text-base font-black text-emerald-950">
                  ${expectedCashInDrawer.toFixed(2)} <span className="text-[10px] text-emerald-700 font-bold">MXN</span>
                </div>
                <p className="text-[9px] text-emerald-800 font-medium">
                  Ventas efect. +${cashSalesTotal.toFixed(2)} - Gastos -${totalExpenses.toFixed(2)}
                </p>
              </div>

              {/* Tarjeta / Digital */}
              <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wide">
                    💳 Tarjeta / Digital
                  </span>
                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                    Mercado Pago
                  </span>
                </div>
                <div className="text-base font-black text-indigo-950">
                  ${cardAndTransferTotal.toFixed(2)} <span className="text-[10px] text-indigo-700 font-bold">MXN</span>
                </div>
                <p className="text-[9px] text-indigo-800 font-medium">
                  Tarjeta: ${cardSalesTotal.toFixed(2)} | Transf: ${transferSalesTotal.toFixed(2)}
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleFinalizeShift}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="Guarda el corte oficial en la nube, imprime el ticket térmico y finaliza el turno actual"
            >
              <PackageCheck className="w-4 h-4 text-emerald-200" />
              <Printer className="w-3.5 h-3.5 text-yellow-300" />
              <span>Imprimir y Cerrar Turno (Corte Oficial)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Solo imprime un comprobante parcial sin archivar el turno"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Imprimir Vista Previa (Turno Abierto)</span>
            </button>
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

