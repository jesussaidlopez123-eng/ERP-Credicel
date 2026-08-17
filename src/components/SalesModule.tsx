import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Store, 
  Calendar, 
  Search, 
  Filter, 
  ChevronRight, 
  Eye, 
  Clock, 
  User, 
  Plus, 
  DollarSign, 
  Receipt, 
  ShoppingBag, 
  TrendingDown, 
  CreditCard, 
  Tag, 
  Wrench, 
  Zap, 
  Printer, 
  FileText,
  Building2,
  TrendingUp,
  Wallet,
  Sparkles,
  ShieldCheck,
  Check,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { SaleTicket, Branch, Expense, Operator, CorteXRecord } from '../types';
import { parseSafeDate, safeDateIsoKey, safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import { cleanDuplicateCortesFromFirestore } from '../lib/firebase';
import CorteXModal from './CorteXModal';

interface SalesModuleProps {
  salesTickets?: SaleTicket[];
  expenses?: Expense[];
  currentBranch: Branch;
  currentOperator?: Operator;
  cortesX?: CorteXRecord[];
  onOpenNoticeModal?: () => void;
  onFinalizeCorteX?: (corteRecord: CorteXRecord) => void;
}

export default function SalesModule({
  salesTickets = [],
  expenses = [],
  currentBranch,
  currentOperator = { id: 'op-admin', name: 'Admin Principal', username: 'admin', role: 'admin', branchIds: ['b-bodega'] },
  cortesX = [],
  onOpenNoticeModal,
  onFinalizeCorteX
}: SalesModuleProps) {

  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);
  
  // Modal state for viewing a Corte X
  const [selectedCorte, setSelectedCorte] = useState<CorteXRecord | null>(null);
  const [isCorteModalOpen, setIsCorteModalOpen] = useState<boolean>(false);
  const [isLiveCorteModalOpen, setIsLiveCorteModalOpen] = useState<boolean>(false);

  // Available branches list
  const branchesList = [
    { id: 'all', name: 'Todas las Sucursales' },
    { id: 'b-bodega', name: 'Matriz / Bodega Central' },
    { id: 'b-navojoa', name: 'Sucursal Navojoa Centro' },
    { id: 'b-huatabampo', name: 'Sucursal Huatabampo' },
  ];

  const getBranchName = (branchId: string): string => {
    const found = branchesList.find(b => b.id === branchId);
    return found ? found.name : branchId;
  };

  const handleCleanDuplicates = async () => {
    setIsCleaning(true);
    setCleanFeedback(null);
    try {
      const result = await cleanDuplicateCortesFromFirestore();
      setCleanFeedback(
        result.purgedCount > 0
          ? `¡Depuración exitosa! Se eliminaron y consolidaron ${result.purgedCount} corte(s) duplicados.`
          : 'La base de datos ya está óptima. No se encontraron cortes duplicados.'
      );
    } catch (err) {
      console.error('Error limpiando duplicados:', err);
      setCleanFeedback('Ocurrió un error al depurar los duplicados.');
    } finally {
      setIsCleaning(false);
      setTimeout(() => setCleanFeedback(null), 6000);
    }
  };

  // Build strictly 1 Corte X per Branch per Day + Open Shift indicator
  const aggregatedCortesList = useMemo(() => {
    // 1. Group saved official Cortes X from Firestore by (branchId + date)
    const savedGrouped: Record<string, CorteXRecord> = {};

    cortesX.forEach((corte) => {
      const dateKey = safeDateIsoKey(corte.timestamp) || corte.dateStr || safeDateIsoKey(corte.dateStr);
      const groupKey = `${corte.branchId || 'general'}_${dateKey}`;

      if (!savedGrouped[groupKey]) {
        savedGrouped[groupKey] = corte;
      } else {
        // Keep the most comprehensive or latest record
        const existing = savedGrouped[groupKey];
        const existingCount = (existing.ticketIds?.length || 0) + (existing.ticketsSnapshot?.length || 0);
        const incomingCount = (corte.ticketIds?.length || 0) + (corte.ticketsSnapshot?.length || 0);

        if (incomingCount > existingCount) {
          savedGrouped[groupKey] = corte;
        } else if (incomingCount === existingCount && (corte.timestamp || '') > (existing.timestamp || '')) {
          savedGrouped[groupKey] = corte;
        }
      }
    });

    const dedupedSavedList = Object.values(savedGrouped);

    // 2. Identify active, open shifts (tickets/expenses from TODAY that have no corteXId and no saved corte for that branch today)
    const todayIso = safeDateIsoKey(new Date());
    const safeTickets = Array.isArray(salesTickets) ? salesTickets : [];
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const unassignedTickets = safeTickets.filter(t => !t.corteXId);
    const unassignedExpenses = safeExpenses.filter(e => !e.corteXId);

    const openShiftsGrouped: Record<string, {
      dateIsoKey: string;
      dateStr: string;
      timeStr: string;
      branchId: string;
      branchName: string;
      tickets: SaleTicket[];
      expenses: Expense[];
    }> = {};

    unassignedTickets.forEach(ticket => {
      const dateIsoKey = safeDateIsoKey(ticket.timestamp);
      // Only consider open shift for today
      if (dateIsoKey !== todayIso) return;

      const dateStr = safeFormatDate(ticket.timestamp);
      const timeStr = safeFormatTime(ticket.timestamp);
      const branchId = ticket.branchId || 'general';
      const groupKey = `${branchId}_${dateIsoKey}`;

      // If a saved official corte ALREADY exists for this branch today, don't synthesize another cut
      if (savedGrouped[groupKey]) return;

      if (!openShiftsGrouped[groupKey]) {
        openShiftsGrouped[groupKey] = {
          dateIsoKey,
          dateStr,
          timeStr,
          branchId,
          branchName: getBranchName(branchId),
          tickets: [],
          expenses: []
        };
      }
      openShiftsGrouped[groupKey].tickets.push(ticket);
    });

    unassignedExpenses.forEach(exp => {
      const dateIsoKey = safeDateIsoKey(exp.timestamp || exp.date);
      if (dateIsoKey !== todayIso) return;

      const dateStr = safeFormatDate(exp.timestamp || exp.date);
      const timeStr = safeFormatTime(exp.timestamp || exp.date);
      const branchId = exp.branchId || 'general';
      const groupKey = `${branchId}_${dateIsoKey}`;

      if (savedGrouped[groupKey]) return;

      if (!openShiftsGrouped[groupKey]) {
        openShiftsGrouped[groupKey] = {
          dateIsoKey,
          dateStr,
          timeStr,
          branchId,
          branchName: getBranchName(branchId),
          tickets: [],
          expenses: []
        };
      }
      openShiftsGrouped[groupKey].expenses.push(exp);
    });

    // Convert open shift groupings to provisional records
    const openShiftsList: CorteXRecord[] = Object.entries(openShiftsGrouped).map(([key, group]) => {
      let cash = 0;
      let card = 0;
      let transfer = 0;
      let accTot = 0;
      let accCnt = 0;
      let aboTot = 0;
      let aboCnt = 0;
      let engTot = 0;
      let engCnt = 0;
      let repTot = 0;
      let repCnt = 0;
      let recTot = 0;
      let recCnt = 0;

      group.tickets.forEach(t => {
        if (t.paymentMethod === 'Efectivo') cash += (t.total || 0);
        if (t.paymentMethod === 'Tarjeta') card += (t.total || 0);
        if (t.paymentMethod === 'Transferencia') transfer += (t.total || 0);

        const items = Array.isArray(t.items) ? t.items : [];
        items.forEach(item => {
          const pName = (item.product?.name || '').toLowerCase();
          const cat = item.product?.category;
          const tot = item.totalPrice || 0;
          const qty = item.quantity || 1;

          if (pName.includes('abono')) {
            aboTot += tot;
            aboCnt += qty;
          } else if (pName.includes('enganche') || cat === 'equipo_credito') {
            engTot += tot;
            engCnt += qty;
          } else if (pName.includes('anticipo') || cat === 'servicio' || item.metadata?.repairType) {
            repTot += tot;
            repCnt += qty;
          } else if (cat === 'recarga' || pName.includes('recarga')) {
            recTot += tot;
            recCnt += qty;
          } else {
            accTot += tot;
            accCnt += qty;
          }
        });
      });

      const totalExp = group.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalSales = cash + card + transfer;
      const initialFund = 1000;

      return {
        id: `CTX-TURNO-${group.branchId.replace('b-', '').toUpperCase()}`,
        timestamp: new Date().toISOString(),
        dateStr: group.dateStr,
        timeStr: group.timeStr,
        branchId: group.branchId,
        branchName: group.branchName,
        operatorName: group.tickets[0]?.operatorName || 'Turno Abierto (En Curso)',
        initialCashFund: initialFund,
        cashSales: cash,
        cardSales: card,
        transferSales: transfer,
        totalSales,
        totalExpenses: totalExp,
        netIncome: totalSales - totalExp,
        expectedCashInDrawer: initialFund + cash - totalExp,
        ticketIds: group.tickets.map(t => t.id),
        expenseIds: group.expenses.map(e => e.id),
        ticketsSnapshot: group.tickets,
        expensesSnapshot: group.expenses,
        breakdown: {
          accesoriosTotal: accTot,
          accesoriosCount: accCnt,
          abonosTotal: aboTot,
          abonosCount: aboCnt,
          enganchesTotal: engTot,
          enganchesCount: engCnt,
          reparacionesTotal: repTot,
          reparacionesCount: repCnt,
          recargasTotal: recTot,
          recargasCount: recCnt
        }
      };
    });

    // Merge: saved official first, then active open shifts
    const all = [...dedupedSavedList, ...openShiftsList];
    
    // Sort descending by timestamp / date
    return all.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [cortesX, salesTickets, expenses]);

  // Filtered Cortes based on branch and search query
  const filteredCortes = useMemo(() => {
    return aggregatedCortesList.filter(corte => {
      // Branch filter
      if (selectedBranchId !== 'all' && corte.branchId !== selectedBranchId) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFolio = (corte.id || '').toLowerCase().includes(q);
        const matchesBranch = (corte.branchName || '').toLowerCase().includes(q);
        const matchesOperator = (corte.operatorName || '').toLowerCase().includes(q);
        const matchesDate = (corte.dateStr || '').toLowerCase().includes(q);
        return matchesFolio || matchesBranch || matchesOperator || matchesDate;
      }

      return true;
    });
  }, [aggregatedCortesList, selectedBranchId, searchQuery]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalSales = 0;
    let totalCashInDrawer = 0;
    let totalExpenses = 0;
    let totalOperationsCount = 0;

    filteredCortes.forEach(c => {
      totalSales += c.totalSales || 0;
      totalCashInDrawer += c.expectedCashInDrawer || 0;
      totalExpenses += c.totalExpenses || 0;
      totalOperationsCount += (c.ticketIds?.length || 0) + (c.expenseIds?.length || 0);
    });

    return {
      totalCortesCount: filteredCortes.length,
      totalSales,
      totalCashInDrawer,
      totalExpenses,
      totalOperationsCount
    };
  }, [filteredCortes]);

  const handleOpenCorteDetail = (corte: CorteXRecord) => {
    setSelectedCorte(corte);
    setIsCorteModalOpen(true);
  };

  const handleOpenLiveCurrentCorte = () => {
    setIsLiveCorteModalOpen(true);
  };

  const isAdmin = currentOperator.role === 'admin';

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 text-white border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">
                  Reportes de Cortes de Caja (Cortes X)
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  1 Corte por Sucursal / Día
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Historial blindado de cortes por sucursal con un único registro consolidado por día y modo de solo lectura para gerencia
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={handleCleanDuplicates}
                disabled={isCleaning}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 hover:text-white border border-slate-600 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Consolida y elimina cortes duplicados en la base de datos de Firestore"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-400 ${isCleaning ? 'animate-spin' : ''}`} />
                <span>{isCleaning ? 'Depurando...' : 'Depurar Duplicados'}</span>
              </button>
            )}

            <button
              onClick={handleOpenLiveCurrentCorte}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-amber-300" />
              <span>Ver Corte X del Turno Actual</span>
            </button>
          </div>
        </div>

        {cleanFeedback && (
          <div className="mt-3 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{cleanFeedback}</span>
          </div>
        )}

        {/* Global KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-700/80 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cortes en Lista</span>
            <span className="text-lg font-black text-white font-mono block mt-0.5">{summaryMetrics.totalCortesCount}</span>
            <span className="text-[10px] text-slate-400">Arqueos oficiales únicos</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Ventas Totales</span>
            <span className="text-lg font-black text-emerald-300 font-mono block mt-0.5">
              ${summaryMetrics.totalSales.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Ingresos brutos</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">Efectivo en Cajón</span>
            <span className="text-lg font-black text-blue-300 font-mono block mt-0.5">
              ${summaryMetrics.totalCashInDrawer.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Fondo + Efectivo - Gastos</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Gastos Registrados</span>
            <span className="text-lg font-black text-rose-300 font-mono block mt-0.5">
              -${summaryMetrics.totalExpenses.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Deducciones de caja</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Branch Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Store className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700 shrink-0">Sucursal:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full sm:w-64 bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
          >
            {branchesList.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por fecha, sucursal, folio u operador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

      </div>

      {/* Main List of Cortes X */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Listado de Cortes X Realizados (1 por día por sucursal)
            </h2>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">
              {filteredCortes.length} registros
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
            Haz clic en cualquier corte para ver el desglose detallado con categorías desplegables
          </p>
        </div>

        {filteredCortes.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-700 text-sm">No se encontraron Cortes X</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No hay registros de cortes para los filtros seleccionados. Realiza ventas y ejecuta el Corte X en el Punto de Venta para archivarlos aquí.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCortes.map((corte, idx) => {
              const totalVenta = corte.totalSales || 0;
              const totalEfectivoCaja = corte.expectedCashInDrawer || 0;
              const totalGastos = corte.totalExpenses || 0;
              const isCurrentOpenShift = corte.id.startsWith('CTX-TURNO');

              return (
                <div
                  key={corte.id || idx}
                  onClick={() => handleOpenCorteDetail(corte)}
                  className="p-4 hover:bg-blue-50/40 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  
                  {/* Left: Branch, Folio & Date */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100/70 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 group-hover:scale-105 transition-transform">
                      <Store className="w-5 h-5" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-slate-900 truncate">
                          {corte.branchName || getBranchName(corte.branchId)}
                        </span>
                        
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {corte.id}
                        </span>

                        {isCurrentOpenShift ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Turno en Curso
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-700" />
                            Corte Oficial Único
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">{corte.dateStr}</span>
                          <span className="text-[11px]">({corte.timeStr})</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Cajero: <strong className="text-slate-800">{corte.operatorName}</strong></span>
                        </span>

                        <span className="text-[11px] text-slate-400 font-medium">
                          {(corte.ticketIds?.length || 0)} ventas • {(corte.expenseIds?.length || 0)} gastos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center/Right: Category Quick Breakdown Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    {corte.breakdown?.accesoriosTotal ? (
                      <span className="bg-indigo-50 text-indigo-900 px-2 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3 text-indigo-600" />
                        Accesorios: ${corte.breakdown.accesoriosTotal.toFixed(0)}
                      </span>
                    ) : null}

                    {corte.breakdown?.abonosTotal ? (
                      <span className="bg-purple-50 text-purple-900 px-2 py-1 rounded-lg border border-purple-200 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-purple-600" />
                        Abonos: ${corte.breakdown.abonosTotal.toFixed(0)}
                      </span>
                    ) : null}

                    {corte.breakdown?.enganchesTotal ? (
                      <span className="bg-blue-50 text-blue-900 px-2 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-blue-600" />
                        Enganches: ${corte.breakdown.enganchesTotal.toFixed(0)}
                      </span>
                    ) : null}

                    {corte.breakdown?.reparacionesTotal ? (
                      <span className="bg-amber-50 text-amber-900 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-600" />
                        Taller: ${corte.breakdown.reparacionesTotal.toFixed(0)}
                      </span>
                    ) : null}

                    {corte.breakdown?.recargasTotal ? (
                      <span className="bg-emerald-50 text-emerald-900 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-600" />
                        Recargas: ${corte.breakdown.recargasTotal.toFixed(0)}
                      </span>
                    ) : null}

                    {totalGastos > 0 ? (
                      <span className="bg-rose-50 text-rose-900 px-2 py-1 rounded-lg border border-rose-200 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-rose-600" />
                        Gastos: -${totalGastos.toFixed(0)}
                      </span>
                    ) : null}
                  </div>

                  {/* Right: Amounts & View Button */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Monto de Corte</span>
                      <span className="text-base font-black text-slate-900 font-mono block">
                        ${totalVenta.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">MXN</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 block">
                        Caja: ${totalEfectivoCaja.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 group-hover:bg-blue-600 text-white text-xs font-black rounded-xl transition-colors shrink-0 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Corte</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal for viewing historic/selected Corte X */}
      {selectedCorte && (
        <CorteXModal
          isOpen={isCorteModalOpen}
          onClose={() => {
            setIsCorteModalOpen(false);
            setSelectedCorte(null);
          }}
          tickets={salesTickets}
          expenses={expenses}
          currentBranch={currentBranch}
          currentOperator={currentOperator}
          cortesX={cortesX}
          existingCorteRecord={selectedCorte}
          onFinalizeCorteX={onFinalizeCorteX}
        />
      )}

      {/* Modal for viewing active live Corte X */}
      <CorteXModal
        isOpen={isLiveCorteModalOpen}
        onClose={() => setIsLiveCorteModalOpen(false)}
        tickets={salesTickets}
        expenses={expenses}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
        cortesX={cortesX}
        onFinalizeCorteX={onFinalizeCorteX}
      />

    </div>
  );
}
