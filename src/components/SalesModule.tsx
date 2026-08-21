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
  AlertCircle,
  Rocket
} from 'lucide-react';
import { SaleTicket, Branch, Expense, Operator, CorteXRecord } from '../types';
import { parseSafeDate, safeDateIsoKey, safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import { cleanDuplicateCortesFromFirestore, clearTestSalesAndExpensesFromFirestore } from '../lib/firebase';
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
  const [isResettingLaunch, setIsResettingLaunch] = useState<boolean>(false);
  
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

  const handleOfficialLaunchReset = async () => {
    if (!window.confirm('¿Estás seguro de iniciar el lanzamiento oficial? Se borrarán todos los registros de ventas, gastos y cortes de prueba anteriores, manteniendo INTACTO el inventario y las reparaciones de taller.')) {
      return;
    }
    setIsResettingLaunch(true);
    try {
      await clearTestSalesAndExpensesFromFirestore();
      window.location.reload();
    } catch (err) {
      console.error('Error resetting for official launch:', err);
      alert('Error al reiniciar los datos.');
      setIsResettingLaunch(false);
    }
  };

  // Build Official Cortes X List + Today's Open Shift (Strictly only finalized via Imprimir Corte X y Finalizar Turno)
  const aggregatedCortesList = useMemo(() => {
    const savedGrouped: Record<string, CorteXRecord> = {};
    cortesX.forEach((corte) => {
      const dateKey = safeDateIsoKey(corte.timestamp) || corte.dateStr || safeDateIsoKey(corte.dateStr);
      const groupKey = `${corte.branchId || 'general'}_${dateKey}`;
      if (!savedGrouped[groupKey]) {
        savedGrouped[groupKey] = corte;
      }
    });

    const officialList = Object.values(savedGrouped);

    // Current open shift for today (if not yet finalized into an official Corte X)
    const todayIso = safeDateIsoKey(new Date());
    const safeTickets = Array.isArray(salesTickets) ? salesTickets : [];
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    
    const openShiftsGrouped: Record<string, { tickets: SaleTicket[]; expenses: Expense[] }> = {};
    safeTickets.forEach(t => {
      const dateIso = safeDateIsoKey(t.timestamp);
      if (dateIso !== todayIso) return;
      const bId = t.branchId || 'general';
      const key = `${bId}_${dateIso}`;
      if (savedGrouped[key]) return;
      if (!openShiftsGrouped[key]) openShiftsGrouped[key] = { tickets: [], expenses: [] };
      openShiftsGrouped[key].tickets.push(t);
    });
    safeExpenses.forEach(e => {
      const dateIso = safeDateIsoKey(e.timestamp || e.date);
      if (dateIso !== todayIso) return;
      const bId = e.branchId || 'general';
      const key = `${bId}_${dateIso}`;
      if (savedGrouped[key]) return;
      if (!openShiftsGrouped[key]) openShiftsGrouped[key] = { tickets: [], expenses: [] };
      openShiftsGrouped[key].expenses.push(e);
    });

    const openShiftsList: CorteXRecord[] = Object.entries(openShiftsGrouped).map(([key, group]) => {
      const branchId = key.split('_')[0];
      const branchName = branchId === 'b-navojoa' ? 'Sucursal Navojoa Centro' : branchId === 'b-huatabampo' ? 'Sucursal Huatabampo' : 'Matriz / Bodega Central';
      const now = new Date();
      let cash = 0, card = 0, transfer = 0;
      let accTot = 0, accCnt = 0, aboTot = 0, aboCnt = 0, engTot = 0, engCnt = 0, repTot = 0, repCnt = 0, recTot = 0, recCnt = 0;
      let earliestTime = '23:59';

      group.tickets.forEach(t => {
        if (t.paymentMethod === 'Efectivo') cash += (t.total || 0);
        if (t.paymentMethod === 'Tarjeta') card += (t.total || 0);
        if (t.paymentMethod === 'Transferencia') transfer += (t.total || 0);
        const tTime = safeFormatTime(t.timestamp);
        if (tTime < earliestTime) earliestTime = tTime;

        (t.items || []).forEach(item => {
          const pName = (item.product?.name || '').toLowerCase();
          const cat = item.product?.category;
          const tot = item.totalPrice || 0;
          const qty = item.quantity || 1;
          if (pName.includes('abono')) { aboTot += tot; aboCnt += qty; }
          else if (pName.includes('enganche') || cat === 'equipo_credito') { engTot += tot; engCnt += qty; }
          else if (pName.includes('anticipo') || cat === 'servicio' || item.metadata?.repairType) { repTot += tot; repCnt += qty; }
          else if (cat === 'recarga' || pName.includes('recarga')) { recTot += tot; recCnt += qty; }
          else { accTot += tot; accCnt += qty; }
        });
      });

      const totalExp = group.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalSales = cash + card + transfer;

      return {
        id: `CTX-TURNO-${branchId.replace('b-', '').toUpperCase()}-${todayIso}`,
        timestamp: now.toISOString(),
        dateStr: safeFormatDate(now),
        timeStr: `Inicia: ${earliestTime !== '23:59' ? earliestTime : '09:00'} (Turno Abierto)`,
        branchId,
        branchName,
        operatorName: group.tickets[0]?.operatorName || 'Turno Activo',
        initialCashFund: 1000,
        cashSales: cash,
        cardSales: card,
        transferSales: transfer,
        totalSales,
        totalExpenses: totalExp,
        netIncome: totalSales - totalExp,
        expectedCashInDrawer: 1000 + cash - totalExp,
        ticketIds: group.tickets.map(t => t.id),
        expenseIds: group.expenses.map(e => e.id),
        ticketsSnapshot: group.tickets,
        expensesSnapshot: group.expenses,
        breakdown: { accesoriosTotal: accTot, accesoriosCount: accCnt, abonosTotal: aboTot, abonosCount: aboCnt, enganchesTotal: engTot, enganchesCount: engCnt, reparacionesTotal: repTot, reparacionesCount: repCnt, recargasTotal: recTot, recargasCount: recCnt }
      };
    });

    const all = [...officialList, ...openShiftsList];
    return all.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [cortesX, salesTickets, expenses]);

  // Filtered Cortes based on branch and search query
  const filteredCortes = useMemo(() => {
    return aggregatedCortesList.filter(corte => {
      if (selectedBranchId !== 'all' && corte.branchId !== selectedBranchId) {
        return false;
      }
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

  // Summary Metrics (excluding zero-activity placeholders from sales sum)
  const summaryMetrics = useMemo(() => {
    let totalSales = 0;
    let totalCashInDrawer = 0;
    let totalExpenses = 0;
    let totalOperationsCount = 0;
    let activeDaysCount = 0;

    filteredCortes.forEach(c => {
      totalSales += c.totalSales || 0;
      totalCashInDrawer += c.expectedCashInDrawer || 0;
      totalExpenses += c.totalExpenses || 0;
      const ops = (c.ticketIds?.length || 0) + (c.expenseIds?.length || 0);
      totalOperationsCount += ops;
      if (ops > 0 || c.totalSales > 0) activeDaysCount++;
    });

    return {
      totalCortesCount: filteredCortes.length,
      activeDaysCount,
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
                  Reportes de Cortes de Caja y Calendario Natural
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Calendario Diario / Checador
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Control de apertura, cierre, checador por sucursal y registro automático de días con actividad o en ceros ($0)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleOfficialLaunchReset}
                  disabled={isResettingLaunch}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-950 hover:bg-rose-900 active:scale-[0.98] text-rose-200 hover:text-white border border-rose-700 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  title="Borra ventas y cortes de prueba, manteniendo inventario y reparaciones para lanzamiento oficial"
                >
                  <Rocket className="w-4 h-4 text-rose-400" />
                  <span>{isResettingLaunch ? 'Iniciando...' : 'Lanzamiento Oficial (Limpiar Pruebas)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  disabled={isCleaning}
                  className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 hover:text-white border border-slate-600 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  title="Consolida y elimina cortes duplicados en la base de datos de Firestore"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-400 ${isCleaning ? 'animate-spin' : ''}`} />
                  <span>{isCleaning ? 'Depurando...' : 'Depurar'}</span>
                </button>
              </>
            )}

            <button
              onClick={handleOpenLiveCurrentCorte}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-amber-300" />
              <span>Corte X del Turno Actual</span>
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
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Días en Calendario</span>
            <span className="text-lg font-black text-white font-mono block mt-0.5">{summaryMetrics.totalCortesCount}</span>
            <span className="text-[10px] text-emerald-400">{summaryMetrics.activeDaysCount} días con operaciones</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Ventas Totales</span>
            <span className="text-lg font-black text-emerald-300 font-mono block mt-0.5">
              ${summaryMetrics.totalSales.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">Ingresos netos del periodo</span>
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

      {/* Main List of Cortes X / Natural Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Calendario Natural y Listado de Cortes X (1 por día por sucursal)
            </h2>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">
              {filteredCortes.length} registros
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
            Muestra la sucursal, horario de checador (inicio/cierre) y si un día no se abrió reflejará $0.00
          </p>
        </div>

        {filteredCortes.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-700 text-sm">No se encontraron registros</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No hay datos para los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCortes.map((corte, idx) => {
              const totalVenta = corte.totalSales || 0;
              const totalEfectivoCaja = corte.expectedCashInDrawer || 0;
              const totalGastos = corte.totalExpenses || 0;
              const isZeroDay = corte.id.startsWith('CAL-ZERO');
              const isCurrentOpenShift = corte.id.startsWith('CTX-TURNO');

              return (
                <div
                  key={corte.id || idx}
                  onClick={() => !isZeroDay && handleOpenCorteDetail(corte)}
                  className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                    isZeroDay ? 'bg-slate-50/60 opacity-80' : 'hover:bg-blue-50/40 cursor-pointer'
                  }`}
                >
                  
                  {/* Left: Branch, Folio & Date */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform ${
                      isZeroDay ? 'bg-slate-200 border-slate-300 text-slate-500' : 'bg-blue-100/70 border-blue-200 text-blue-700 group-hover:scale-105'
                    }`}>
                      <Store className="w-5 h-5" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-slate-900 truncate">
                          {corte.branchName || getBranchName(corte.branchId)}
                        </span>
                        
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {isZeroDay ? 'SIN ACTIVIDAD' : corte.id}
                        </span>

                        {isZeroDay ? (
                          <span className="bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                            ⭕ Cerrado / Sin Apertura ($0)
                          </span>
                        ) : isCurrentOpenShift ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Turno en Curso
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-700" />
                            Corte Oficial
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">{corte.dateStr}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-[11px] text-slate-600 font-bold">{corte.timeStr}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Responsable: <strong className="text-slate-800">{corte.operatorName}</strong></span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Category Breakdown Badges */}
                  {!isZeroDay && (
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
                  )}

                  {/* Right: Amounts & View Button */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Día</span>
                      <span className="text-base font-black text-slate-900 font-mono block">
                        ${totalVenta.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">MXN</span>
                      </span>
                      {!isZeroDay && (
                        <span className="text-[10px] font-bold text-emerald-700 block">
                          Caja: ${totalEfectivoCaja.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {!isZeroDay && (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 group-hover:bg-blue-600 text-white text-xs font-black rounded-xl transition-colors shrink-0 shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Corte</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
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

