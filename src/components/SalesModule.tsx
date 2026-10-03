import React, { useState, useMemo, useEffect, lazy, startTransition } from 'react';
import { 
  Calculator, 
  Store, 
  Calendar, 
  Search, 
  Eye, 
  Clock, 
  User, 
  Plus, 
  DollarSign, 
  Receipt, 
  TrendingDown, 
  CreditCard, 
  Printer, 
  FileText,
  Building2,
  TrendingUp,
  Wallet,
  ShieldCheck,
  AlertCircle,
  Activity,
  Layers,
  ArrowUpRight,
  BadgePercent,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  X,
  Lock
} from 'lucide-react';
import { SaleTicket, Branch, Expense, Operator, CorteXRecord, SesionCaja } from '../types';
import { formatCashDateLabel, parseSafeDate, safeDateIsoKey, safeFormatDate, safeFormatTime, todayCashDateKey } from '../lib/dateUtils';
import { corteShiftHours, formatCorteDayHeading } from '../lib/corteDayHours';
import { buildCortesRoster, CORTES_VISIBLE_DAYS, todayBranchStats } from '../lib/salesCortesBuild';
import { ticketFolioLabel } from '../lib/ids';
import { deleteSaleTicketFromFirestore } from '../lib/firebase';
import { ALL_BRANCHES, COMMERCIAL_BRANCHES, getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { authorizeWithAdminPassword } from '../lib/inventoryAuth';
import LazyWhen from './LazyWhen';
import LoadMoreButton from './LoadMoreButton';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const CorteXModal = lazy(() => import('./CorteXModal'));
const TicketReceiptModal = lazy(() => import('./TicketReceiptModal'));

interface SalesModuleProps {
  salesTickets?: SaleTicket[];
  expenses?: Expense[];
  currentBranch: Branch;
  currentOperator?: Operator;
  allBranches?: Branch[];
  cortesX?: CorteXRecord[];
  branchCashFunds?: Record<string, number>;
  onOpenNoticeModal?: () => void;
  onFinalizeCorteX?: (corteRecord: CorteXRecord) => void;
  onDeleteSaleTicket?: (ticket: SaleTicket | string, reason?: string) => Promise<void> | void;
  activeCashSession?: SesionCaja | null;
  onLoadOlderSales?: () => void;
  onLoadOlderExpenses?: () => void;
  onLoadOlderCortes?: () => void;
  salesHasMore?: boolean;
  expensesHasMore?: boolean;
  cortesHasMore?: boolean;
  historyBusy?: string | null;
  operators?: Operator[];
}

/** Fondo de apertura: lo que dejó el cajero en branchCashFunds. Nunca inventar $1000. */
function openingFundForBranch(branchId: string, funds: Record<string, number> = {}): number {
  const fromCloud = funds[branchId];
  if (typeof fromCloud === 'number' && !isNaN(fromCloud) && fromCloud >= 0) {
    return fromCloud;
  }
  try {
    const saved = localStorage.getItem(`erp_branch_fund_${branchId}`);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {}
  return 0;
}

function SalesModule({
  salesTickets = [],
  expenses = [],
  currentBranch,
  currentOperator = { id: 'op-admin', name: 'Admin Principal', username: 'admin', role: 'admin', branchIds: ['all'] },
  allBranches = ALL_BRANCHES,
  cortesX = [],
  branchCashFunds = {},
  onOpenNoticeModal,
  onFinalizeCorteX,
  onDeleteSaleTicket,
  activeCashSession = null,
  onLoadOlderSales,
  onLoadOlderExpenses,
  onLoadOlderCortes,
  salesHasMore = false,
  expensesHasMore = false,
  cortesHasMore = false,
  historyBusy = null,
  operators = []
}: SalesModuleProps) {

  const [activeTab, setActiveTab] = useState<'cortes' | 'tickets' | 'expenses' | 'analytics'>('cortes');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebouncedValue(searchQuery, 160);
  
  // Modal states
  const [selectedCorte, setSelectedCorte] = useState<CorteXRecord | null>(null);
  const [isCorteModalOpen, setIsCorteModalOpen] = useState<boolean>(false);
  const [selectedLiveBranch, setSelectedLiveBranch] = useState<Branch>(currentBranch);
  const [isLiveCorteModalOpen, setIsLiveCorteModalOpen] = useState<boolean>(false);

  // Ticket Receipt modal for reprinting / inspecting individual tickets
  const [selectedTicketForReceipt, setSelectedTicketForReceipt] = useState<SaleTicket | null>(null);
  const [isTicketReceiptOpen, setIsTicketReceiptOpen] = useState<boolean>(false);
  const [ticketToDelete, setTicketToDelete] = useState<SaleTicket | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReasonOption, setDeleteReasonOption] = useState('Cobro duplicado por operador');
  const [deleteCustomReason, setDeleteCustomReason] = useState('');
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);
  const [deleteActionFeedback, setDeleteActionFeedback] = useState<string | null>(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [deleteAuthError, setDeleteAuthError] = useState<string | null>(null);

  // Ticket list filters
  const [ticketDateFilter, setTicketDateFilter] = useState<'all' | 'today' | 'custom'>('today');
  const [ticketPaymentFilter, setTicketPaymentFilter] = useState<string>('all');
  const [visibleDayCount, setVisibleDayCount] = useState(CORTES_VISIBLE_DAYS);
  const [visibleTicketCount, setVisibleTicketCount] = useState(80);
  const [visibleExpenseCount, setVisibleExpenseCount] = useState(80);

  const todayIso = todayCashDateKey();

  // Fixed canonical branches list (Navojoa always 1st, Huatabampo always 2nd)
  const branchesList = useMemo(() => [
    { id: 'all', name: 'Todas las sucursales' },
    { id: 'b-navojoa', name: 'Navojoa' },
    { id: 'b-huatabampo', name: 'Huatabampo' }
  ], []);

  const getBranchName = (branchId?: string): string => {
    return getBranchDisplayName(branchId);
  };

  const getBranchObj = (branchId?: string): Branch => {
    const norm = normalizeBranchId(branchId);
    const found = COMMERCIAL_BRANCHES.find(b => b.id === norm);
    if (found) return found;
    return { id: norm, name: getBranchName(norm) };
  };

  // Safe data arrays
  const safeTickets = useMemo(() => Array.isArray(salesTickets) ? salesTickets : [], [salesTickets]);
  const safeExpenses = useMemo(() => Array.isArray(expenses) ? expenses : [], [expenses]);
  const safeCortesX = useMemo(() => Array.isArray(cortesX) ? cortesX : [], [cortesX]);

  useEffect(() => {
    if (!selectedCorte) return;
    const fresh = safeCortesX.find((corte) => corte.id === selectedCorte.id);
    if (fresh) setSelectedCorte(fresh);
  }, [safeCortesX, selectedCorte?.id]);

  const openingFund = (branchId: string) => openingFundForBranch(branchId, branchCashFunds);

  const branchLiveStats = useMemo(() => {
    const stats = todayBranchStats(safeTickets, safeExpenses, todayIso, openingFund);
    return stats.map((bStat) => {
      let currentShiftOperator = bStat.currentShiftOperator;
      try {
        const savedLogin = localStorage.getItem(`erp_shift_login_${bStat.branchId}_${todayIso}`);
        if (savedLogin) {
          const parsed = JSON.parse(savedLogin);
          if (parsed?.operatorName) currentShiftOperator = parsed.operatorName;
        }
      } catch {
        /* ignore */
      }
      if ((!currentShiftOperator || currentShiftOperator === 'Operador en Turno') && bStat.branchId === currentBranch.id) {
        currentShiftOperator = currentOperator.name;
      }
      return { ...bStat, currentShiftOperator };
    });
  }, [safeTickets, safeExpenses, todayIso, currentBranch, currentOperator, branchCashFunds]);

  const aggregatedCortesList = useMemo(
    () =>
      buildCortesRoster({
        cortes: safeCortesX,
        tickets: safeTickets,
        expenses: safeExpenses,
        todayKey: todayIso,
        currentBranch,
        currentOperator,
        openingFund
      }),
    [safeCortesX, safeTickets, safeExpenses, todayIso, currentBranch, currentOperator, branchCashFunds]
  );

  const filteredCortes = useMemo(() => {
    return aggregatedCortesList.filter(corte => {
      const normBId = normalizeBranchId(corte.branchId);
      if (selectedBranchId !== 'all' && normBId !== selectedBranchId) {
        return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          (corte.id || '').toLowerCase().includes(q) ||
          (corte.branchName || '').toLowerCase().includes(q) ||
          (corte.operatorName || '').toLowerCase().includes(q) ||
          (corte.dateStr || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [aggregatedCortesList, selectedBranchId, debouncedSearch]);

  const cortesByDay = useMemo(() => {
    const groups: { dateKey: string; label: string; rows: CorteXRecord[] }[] = [];
    for (const corte of filteredCortes) {
      const dateKey = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
      const last = groups[groups.length - 1];
      if (!last || last.dateKey !== dateKey) {
        groups.push({
          dateKey,
          label: formatCorteDayHeading(dateKey, todayIso),
          rows: [corte]
        });
      } else {
        last.rows.push(corte);
      }
    }
    return groups;
  }, [filteredCortes, todayIso]);

  const historySpan = useMemo(() => {
    let oldest = '';
    let realCount = 0;
    for (const corte of filteredCortes) {
      if (corte.id.startsWith('CAL-ZERO')) continue;
      const key = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
      if (!key) continue;
      realCount += 1;
      if (!oldest || key < oldest) oldest = key;
    }
    return { oldest, realCount };
  }, [filteredCortes]);

  // Filtered Live Tickets
  const filteredTickets = useMemo(() => {
    return safeTickets.filter(ticket => {
      const normBId = normalizeBranchId(ticket.branchId);
      if (!hasCashTill(normBId)) return false;
      if (selectedBranchId !== 'all' && normBId !== selectedBranchId) {
        return false;
      }
      if (ticketDateFilter === 'today') {
        if (safeDateIsoKey(ticket.timestamp) !== todayIso) return false;
      }
      if (ticketPaymentFilter !== 'all') {
        if (ticket.paymentMethod !== ticketPaymentFilter) return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const matchesFolio = (ticket.folio || ticket.id || '').toLowerCase().includes(q);
        const matchesCustomer = (ticket.items?.[0]?.metadata?.clientName || '').toLowerCase().includes(q);
        const matchesOperator = (ticket.operatorName || '').toLowerCase().includes(q);
        const matchesProduct = (ticket.items || []).some(item => (item.product?.name || '').toLowerCase().includes(q));
        const matchesDate = safeFormatDate(ticket.timestamp).toLowerCase().includes(q);
        return matchesFolio || matchesCustomer || matchesOperator || matchesProduct || matchesDate;
      }
      return true;
    }).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [safeTickets, selectedBranchId, ticketDateFilter, ticketPaymentFilter, debouncedSearch, todayIso]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return safeExpenses.filter(expense => {
      const normBId = normalizeBranchId(expense.branchId);
      if (!hasCashTill(normBId)) return false;
      if (selectedBranchId !== 'all' && normBId !== selectedBranchId) {
        return false;
      }
      if (ticketDateFilter === 'today') {
        if (safeDateIsoKey(expense.timestamp || expense.date) !== todayIso) return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const matchesConcept = (expense.concept || '').toLowerCase().includes(q);
        const matchesOperator = (expense.operatorName || '').toLowerCase().includes(q);
        return matchesConcept || matchesOperator;
      }
      return true;
    }).sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''));
  }, [safeExpenses, selectedBranchId, ticketDateFilter, debouncedSearch, todayIso]);

  useEffect(() => {
    setVisibleDayCount(CORTES_VISIBLE_DAYS);
    setVisibleTicketCount(80);
    setVisibleExpenseCount(80);
  }, [selectedBranchId, debouncedSearch, ticketDateFilter, ticketPaymentFilter]);

  const visibleCortesByDay = useMemo(
    () => cortesByDay.slice(0, visibleDayCount),
    [cortesByDay, visibleDayCount]
  );
  const visibleTickets = useMemo(
    () => filteredTickets.slice(0, visibleTicketCount),
    [filteredTickets, visibleTicketCount]
  );
  const visibleExpenses = useMemo(
    () => filteredExpenses.slice(0, visibleExpenseCount),
    [filteredExpenses, visibleExpenseCount]
  );

  const switchTab = (id: typeof activeTab) => {
    startTransition(() => setActiveTab(id));
  };

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalSales = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalTransfer = 0;
    let totalExpenses = 0;
    let ticketsCount = filteredTickets.length;

    filteredTickets.forEach(t => {
      const amt = t.total || 0;
      totalSales += amt;
      if (t.paymentMethod === 'Efectivo') totalCash += amt;
      else if (t.paymentMethod === 'Tarjeta') totalCard += amt;
      else if (t.paymentMethod === 'Transferencia') totalTransfer += amt;
    });

    filteredExpenses.forEach(e => {
      totalExpenses += (e.amount || 0);
    });

    return {
      totalSales,
      totalCash,
      totalCard,
      totalTransfer,
      totalExpenses,
      ticketsCount,
      expensesCount: filteredExpenses.length,
      netIncome: totalSales - totalExpenses
    };
  }, [filteredTickets, filteredExpenses]);

  const handleOpenCorteDetail = (corte: CorteXRecord) => {
    setSelectedCorte(corte);
    setSelectedLiveBranch(getBranchObj(corte.branchId));
    setIsCorteModalOpen(true);
  };

  const handleOpenLiveShiftForBranch = (branchId: string) => {
    const branchObj = getBranchObj(branchId);
    setSelectedLiveBranch(branchObj);
    setSelectedCorte(null);
    setIsLiveCorteModalOpen(true);
  };

  const handleOpenTicketReceipt = (ticket: SaleTicket) => {
    setSelectedTicketForReceipt(ticket);
    setIsTicketReceiptOpen(true);
  };

  const handlePromptDeleteTicket = (ticket: SaleTicket) => {
    setTicketToDelete(ticket);
    setDeleteReasonOption('Cobro duplicado por operador');
    setDeleteCustomReason('');
    setDeleteAdminPassword('');
    setDeleteAuthError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteTicket = async () => {
    if (!ticketToDelete) return;
    const authError = authorizeWithAdminPassword(deleteAdminPassword, operators, currentOperator);
    if (authError) {
      setDeleteAuthError(authError);
      return;
    }
    setIsDeletingTicket(true);
    const finalReason = deleteCustomReason.trim()
      ? `${deleteReasonOption}: ${deleteCustomReason.trim()}`
      : deleteReasonOption;
    try {
      if (onDeleteSaleTicket) {
        await onDeleteSaleTicket(ticketToDelete, finalReason);
      } else {
        await deleteSaleTicketFromFirestore(ticketToDelete, {
          reason: finalReason,
          operatorName: currentOperator.name
        });
      }
      setDeleteActionFeedback(`Ticket ${ticketToDelete.folio || ticketToDelete.id.slice(-6)} cancelado. El stock se restableció.`);
      setIsDeleteModalOpen(false);
      setTicketToDelete(null);
      setDeleteAdminPassword('');
      setDeleteAuthError(null);
    } catch (err) {
      console.error('Error al eliminar transacción:', err);
      alert('Error al eliminar la transacción. Verifica tu conexión.');
    } finally {
      setIsDeletingTicket(false);
      setTimeout(() => setDeleteActionFeedback(null), 7000);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      
      <div className="bg-white rounded-2xl p-5 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Ventas y cortes de caja</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Movimiento del día por sucursal. El arqueo se hace una sola vez, desde cada tarjeta.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {branchLiveStats.map(bStat => {
            const hasSales = bStat.todayTicketsCount > 0;
            return (
              <div
                key={bStat.branchId}
                className="bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      hasSales ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white text-slate-400 border border-slate-200'
                    }`}>
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{bStat.branchName}</h3>
                      <p className="text-[11px] text-slate-500 truncate">{bStat.currentShiftOperator}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    hasSales
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-white text-slate-500 border border-slate-200'
                  }`}>
                    {hasSales ? 'Con ventas' : 'Sin ventas hoy'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ventas ({bStat.todayTicketsCount})</span>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums block">
                      ${bStat.totalSales.toFixed(2)}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Ef. ${bStat.cashSales.toFixed(0)} · Tarj. ${bStat.cardSales.toFixed(0)}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Caja esperada</span>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums block">
                      ${bStat.expectedCashInDrawer.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-red-600 block mt-0.5">
                      Gastos −${bStat.totalExpenses.toFixed(0)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenLiveShiftForBranch(bStat.branchId)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#0047AB] hover:bg-[#003d93] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Abrir arqueo
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-200">
          {([
            ['cortes', 'Cortes', filteredCortes.length],
            ['tickets', 'Tickets', filteredTickets.length],
            ['expenses', 'Gastos', filteredExpenses.length],
            ['analytics', 'Métodos de pago', null],
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === id
                  ? 'bg-[#0047AB] text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {label}
              {count != null && (
                <span className={`text-[10px] px-1.5 rounded-full ${activeTab === id ? 'bg-white/20' : 'bg-white text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
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

        {/* Date Filter (for tickets and expenses) */}
        {activeTab !== 'cortes' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTicketDateFilter('today')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                ticketDateFilter === 'today' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoy ({todayIso})
            </button>
            <button
              type="button"
              onClick={() => setTicketDateFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                ticketDateFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todo el Historial
            </button>
          </div>
        )}

        {/* Search Field */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por fecha, sucursal, folio, cliente u operador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

      </div>

      {/* TAB 1: CORTES X Y CALENDARIO NATURAL */}
      {activeTab === 'cortes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          
          <div className="px-3 sm:px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <h2 className="text-xs font-semibold text-slate-900 truncate">
                Días por sucursal
              </h2>
              <span className="bg-slate-200/80 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                {filteredCortes.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {historyBusy === 'cortes'
                ? 'Cargando días anteriores…'
                : historySpan.oldest
                  ? `Desde ${formatCashDateLabel(historySpan.oldest)}`
                  : 'Sucursal, horario, total y corte'}
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
            <div>
              {visibleCortesByDay.map((day) => (
                <div key={day.dateKey || day.label}>
                  <div className="px-3 sm:px-4 py-1.5 bg-slate-50/90 border-y border-slate-100 text-[11px] font-semibold text-slate-500 capitalize sticky top-0 z-10">
                    {day.label}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {day.rows.map((corte, idx) => {
                      const totalVenta = corte.totalSales || 0;
                      const isZeroDay = corte.id.startsWith('CAL-ZERO');
                      const isCurrentOpenShift = corte.id.startsWith('CTX-TURNO');
                      const hours = corteShiftHours(corte);
                      const openRow = () => {
                        if (isZeroDay) return;
                        if (isCurrentOpenShift) {
                          handleOpenLiveShiftForBranch(corte.branchId);
                          return;
                        }
                        handleOpenCorteDetail(corte);
                      };

                      return (
                        <div
                          key={corte.id || `${day.dateKey}-${idx}`}
                          role={isZeroDay ? undefined : 'button'}
                          tabIndex={isZeroDay ? undefined : 0}
                          onClick={openRow}
                          onKeyDown={(e) => {
                            if (isZeroDay) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openRow();
                            }
                          }}
                          className={`min-h-[52px] px-3 sm:px-4 py-2 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[7.5rem_minmax(0,1fr)_6.75rem_auto] items-center gap-x-3 gap-y-0.5 ${
                            isZeroDay
                              ? 'bg-slate-50/50 text-slate-400'
                              : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <span className="text-[13px] font-semibold text-slate-900 truncate flex items-center gap-1.5 min-w-0 col-start-1 row-start-1 sm:col-start-1 sm:row-start-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isZeroDay
                                  ? 'bg-slate-300'
                                  : isCurrentOpenShift
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-400'
                              }`}
                            />
                            {corte.branchName || getBranchName(corte.branchId)}
                          </span>

                          <span className="text-[12px] text-slate-600 tabular-nums truncate col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">
                            {hours.start}
                            <span className="text-slate-300 mx-1.5">→</span>
                            <span className={isCurrentOpenShift ? 'text-emerald-700 font-medium' : ''}>
                              {hours.end}
                            </span>
                          </span>

                          <span className={`text-[13px] font-semibold tabular-nums text-right col-start-2 row-start-1 sm:col-start-3 sm:row-start-1 ${isZeroDay ? 'text-slate-400' : 'text-slate-900'}`}>
                            ${totalVenta.toFixed(2)}
                          </span>

                          {isZeroDay ? (
                            <span className="text-[11px] text-slate-400 text-right col-start-2 row-start-2 sm:col-start-4 sm:row-start-1">Sin corte</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRow();
                              }}
                              className="justify-self-end inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0047AB] hover:text-[#003d93] px-1.5 py-1 rounded-md hover:bg-blue-50 cursor-pointer col-start-2 row-start-2 sm:col-start-4 sm:row-start-1"
                            >
                              <Eye className="w-3 h-3" />
                              {isCurrentOpenShift ? 'Arqueo' : 'Ver corte'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-3 sm:px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500">
            {historyBusy === 'cortes'
              ? 'Cargando días anteriores en segundo plano…'
              : historySpan.realCount === 0
                ? 'Aún no hay cortes cargados. Si la nube tiene historial, use el botón de abajo.'
                : `Hay ${historySpan.realCount} turnos${historySpan.oldest ? ` desde ${formatCashDateLabel(historySpan.oldest)}` : ''}. Se muestran ${Math.min(visibleDayCount, cortesByDay.length)} de ${cortesByDay.length} días.`}
          </div>
          <LoadMoreButton
            hasMore={visibleDayCount < cortesByDay.length}
            onClick={() => setVisibleDayCount((n) => n + CORTES_VISIBLE_DAYS)}
            label="Ver más días en pantalla"
          />
          <LoadMoreButton
            hasMore={cortesHasMore}
            loading={historyBusy === 'cortes'}
            onClick={onLoadOlderCortes}
            label="Cargar meses anteriores"
          />

        </div>
      )}

      {/* TAB 2: VENTAS Y TICKETS EN VIVO */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Monitor de Tickets de Venta en Tiempo Real
              </h2>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {filteredTickets.length} tickets
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>Total Ventas:</span>
              <span className="font-mono text-emerald-700 font-black text-sm">
                ${summaryMetrics.totalSales.toFixed(2)}
              </span>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-700 text-sm">No se encontraron tickets</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No hay ventas registradas para la sucursal o fecha seleccionada.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleTickets.map((ticket, idx) => {
                const isToday = safeDateIsoKey(ticket.timestamp) === todayIso;
                const itemsCount = (ticket.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);

                return (
                  <div 
                    key={ticket.id || idx}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Ticket Header & Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {ticketFolioLabel(ticket)}
                          </span>
                          <span className="font-bold text-xs text-slate-900">
                            {getBranchName(ticket.branchId)}
                          </span>
                          {isToday && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.2 rounded-full">
                              Hoy
                            </span>
                          )}
                          <span className={`text-[10px] font-black px-2 py-0.2 rounded-full border ${
                            ticket.paymentMethod === 'Efectivo' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : (ticket.paymentMethod === 'Tarjeta' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200')
                          }`}>
                            {ticket.paymentMethod || 'Efectivo'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {safeFormatDate(ticket.timestamp)} {safeFormatTime(ticket.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {ticket.items?.[0]?.metadata?.clientName || 'Público General'}
                          </span>
                          <span className="text-slate-400">• Atendió: {ticket.operatorName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Items List Preview */}
                    <div className="flex-1 max-w-md hidden lg:block">
                      <div className="text-xs text-slate-700 truncate font-medium">
                        {(ticket.items || []).map(i => `${i.quantity}x ${i.product?.name || 'Producto'}`).join(', ')}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {itemsCount} {itemsCount === 1 ? 'artículo' : 'artículos'}
                      </span>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900 font-mono block">
                          ${(ticket.total || 0).toFixed(2)}
                        </span>
                        {ticket.corteXId ? (
                          <span className="text-[9px] text-slate-400 font-bold block">
                            Corte: {ticket.corteXId}
                          </span>
                        ) : (
                          <span className="text-[9px] text-emerald-600 font-bold block">
                            🟢 Turno Abierto
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenTicketReceipt(ticket)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        title="Reimprimir o ver ticket térmico"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>Ticket</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePromptDeleteTicket(ticket)}
                        className="flex items-center gap-1.5 px-2.5 py-2 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        title="Eliminar transacción por error de operador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <LoadMoreButton
            hasMore={visibleTicketCount < filteredTickets.length}
            onClick={() => setVisibleTicketCount((n) => n + 80)}
            label="Ver más tickets en pantalla"
          />
          <LoadMoreButton
            hasMore={salesHasMore}
            loading={historyBusy === 'sales'}
            onClick={onLoadOlderSales}
            label="Cargar tickets anteriores"
          />

        </div>
      )}

      {/* TAB 3: GASTOS Y SALIDAS DE CAJA */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Monitor de Gastos y Salidas de Caja Chica
              </h2>
              <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {filteredExpenses.length} gastos
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>Total Salidas:</span>
              <span className="font-mono text-rose-600 font-black text-sm">
                -${summaryMetrics.totalExpenses.toFixed(2)}
              </span>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <TrendingDown className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-700 text-sm">No se encontraron gastos</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No hay salidas de efectivo registradas para los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleExpenses.map((expense, idx) => {
                const isToday = safeDateIsoKey(expense.timestamp || expense.date) === todayIso;

                return (
                  <div 
                    key={expense.id || idx}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-xs text-slate-900">
                            {expense.concept || 'Gasto Operativo'}
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.2 rounded-md border border-slate-200">
                            {getBranchName(expense.branchId)}
                          </span>
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2 py-0.2 rounded-full border border-rose-200">
                            Salida de Caja
                          </span>
                          {isToday && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.2 rounded-full">
                              Hoy
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {safeFormatDate(expense.timestamp || expense.date)} {safeFormatTime(expense.timestamp || expense.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {expense.operatorName || 'Cajero'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-rose-600 font-mono block">
                        -${(expense.amount || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Deducción de caja
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <LoadMoreButton
            hasMore={visibleExpenseCount < filteredExpenses.length}
            onClick={() => setVisibleExpenseCount((n) => n + 80)}
            label="Ver más gastos en pantalla"
          />
          <LoadMoreButton
            hasMore={expensesHasMore}
            loading={historyBusy === 'expenses'}
            onClick={onLoadOlderExpenses}
            label="Cargar gastos anteriores"
          />

        </div>
      )}

      {/* TAB 4: ESTADÍSTICAS Y MÉTODOS DE PAGO */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Cash Card */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-emerald-900 uppercase">Efectivo Recibido</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-emerald-700 font-mono block">
                ${summaryMetrics.totalCash.toFixed(2)}
              </span>
              <span className="text-xs text-emerald-800/80 font-medium block mt-1">
                {summaryMetrics.totalSales > 0 ? ((summaryMetrics.totalCash / summaryMetrics.totalSales) * 100).toFixed(1) : 0}% de las ventas totales
              </span>
            </div>

            {/* Card Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-blue-900 uppercase">Cobros con Tarjeta (Clip)</span>
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-2xl font-black text-blue-700 font-mono block">
                ${summaryMetrics.totalCard.toFixed(2)}
              </span>
              <span className="text-xs text-blue-800/80 font-medium block mt-1">
                {summaryMetrics.totalSales > 0 ? ((summaryMetrics.totalCard / summaryMetrics.totalSales) * 100).toFixed(1) : 0}% de las ventas totales
              </span>
            </div>

            {/* Transfer Card */}
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-purple-900 uppercase">Transferencias SPEI</span>
                <Wallet className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-2xl font-black text-purple-700 font-mono block">
                ${summaryMetrics.totalTransfer.toFixed(2)}
              </span>
              <span className="text-xs text-purple-800/80 font-medium block mt-1">
                {summaryMetrics.totalSales > 0 ? ((summaryMetrics.totalTransfer / summaryMetrics.totalSales) * 100).toFixed(1) : 0}% de las ventas totales
              </span>
            </div>

          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Resumen Financiero del Período
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block">Ventas Brutas</span>
                <span className="text-lg font-black text-slate-900 font-mono block mt-1">
                  ${summaryMetrics.totalSales.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">{summaryMetrics.ticketsCount} tickets</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block">Total Salidas / Gastos</span>
                <span className="text-lg font-black text-rose-600 font-mono block mt-1">
                  -${summaryMetrics.totalExpenses.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">{summaryMetrics.expensesCount} registros</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block">Flujo Neto</span>
                <span className="text-lg font-black text-emerald-700 font-mono block mt-1">
                  ${summaryMetrics.netIncome.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">Ingresos menos egresos</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block">Ticket Promedio</span>
                <span className="text-lg font-black text-blue-700 font-mono block mt-1">
                  ${summaryMetrics.ticketsCount > 0 ? (summaryMetrics.totalSales / summaryMetrics.ticketsCount).toFixed(2) : '0.00'}
                </span>
                <span className="text-[11px] text-slate-400">Por transacción</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for viewing historic/selected Corte X */}
      <LazyWhen when={!!selectedCorte}>
        <CorteXModal
          isOpen={isCorteModalOpen}
          onClose={() => {
            setIsCorteModalOpen(false);
            setSelectedCorte(null);
          }}
          tickets={safeTickets}
          expenses={safeExpenses}
          currentBranch={selectedLiveBranch}
          currentOperator={currentOperator}
          cortesX={safeCortesX}
          existingCorteRecord={selectedCorte}
          onFinalizeCorteX={onFinalizeCorteX}
          onRequestDeleteTicket={onDeleteSaleTicket ? handlePromptDeleteTicket : undefined}
        />
      </LazyWhen>

      {/* Modal for viewing active live Corte X for selected branch */}
      <LazyWhen when={isLiveCorteModalOpen}>
        <CorteXModal
          isOpen={isLiveCorteModalOpen}
          onClose={() => setIsLiveCorteModalOpen(false)}
          tickets={safeTickets}
          expenses={safeExpenses}
          currentBranch={selectedLiveBranch}
          currentOperator={currentOperator}
          cortesX={safeCortesX}
          onFinalizeCorteX={onFinalizeCorteX}
          activeSessionId={
            normalizeBranchId(selectedLiveBranch.id) === normalizeBranchId(currentBranch.id)
              ? activeCashSession?.id
              : undefined
          }
          sessionOpenedAt={
            normalizeBranchId(selectedLiveBranch.id) === normalizeBranchId(currentBranch.id)
              ? activeCashSession?.fecha_apertura
              : undefined
          }
        />
      </LazyWhen>

      {/* Modal for Ticket Receipt / Reprint */}
      <LazyWhen when={isTicketReceiptOpen && !!selectedTicketForReceipt}>
        <TicketReceiptModal
          isOpen={isTicketReceiptOpen}
          onClose={() => {
            setIsTicketReceiptOpen(false);
            setSelectedTicketForReceipt(null);
          }}
          ticket={selectedTicketForReceipt as SaleTicket}
          currentBranch={getBranchObj(selectedTicketForReceipt?.branchId)}
        />
      </LazyWhen>

      {deleteActionFeedback && (
        <div className="fixed bottom-4 right-4 z-[80] max-w-sm bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-3 rounded-xl shadow-lg flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{deleteActionFeedback}</span>
        </div>
      )}

      {isDeleteModalOpen && ticketToDelete && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-rose-100">
            <div className="bg-rose-700 px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-white font-black text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  Eliminar transacción de venta
                </div>
                <p className="text-[11px] text-rose-100 mt-1">Solo para corregir un error de operador. El stock e IMEI vuelven a la sucursal.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingTicket) {
                    setIsDeleteModalOpen(false);
                    setTicketToDelete(null);
                    setDeleteAdminPassword('');
                    setDeleteAuthError(null);
                  }
                }}
                className="text-rose-100 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-800">Folio: {ticketToDelete.folio || ticketToDelete.id}</span>
                  <span className="text-sm font-black text-rose-700 font-mono">${(ticketToDelete.total || 0).toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {getBranchName(ticketToDelete.branchId)} · {ticketToDelete.paymentMethod || 'Efectivo'} · {ticketToDelete.operatorName || 'Cajero'}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Motivo</label>
                <select
                  value={deleteReasonOption}
                  onChange={(e) => setDeleteReasonOption(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5"
                >
                  <option>Cobro duplicado por operador</option>
                  <option>Artículo o modelo equivocado seleccionado</option>
                  <option>Monto o forma de pago errónea</option>
                  <option>Cliente canceló antes de entregar producto</option>
                  <option>Error de captura de operador</option>
                  <option>Otro motivo justificado</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Comentarios (opcional)</label>
                <input
                  type="text"
                  value={deleteCustomReason}
                  onChange={(e) => setDeleteCustomReason(e.target.value)}
                  placeholder="Detalle del error de captura"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Esta acción quita solo este ticket. El resto de ventas, cortes e inventario de otros folios se conserva.</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Contraseña del administrador
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  autoFocus
                  value={deleteAdminPassword}
                  onChange={(e) => {
                    setDeleteAdminPassword(e.target.value);
                    if (deleteAuthError) setDeleteAuthError(null);
                  }}
                  placeholder="Solo un administrador puede autorizar el borrado"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
                {deleteAuthError && (
                  <p className="mt-1.5 text-[11px] font-bold text-rose-700">{deleteAuthError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingTicket}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setTicketToDelete(null);
                    setDeleteAdminPassword('');
                    setDeleteAuthError(null);
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingTicket}
                  onClick={handleConfirmDeleteTicket}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeletingTicket ? 'Eliminando...' : 'Confirmar y eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default React.memo(SalesModule);
