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
  ShieldCheck,
  Check,
  AlertCircle,
  Activity,
  Layers,
  ArrowUpRight,
  BadgePercent,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  X
} from 'lucide-react';
import { SaleTicket, Branch, Expense, Operator, CorteXRecord } from '../types';
import { parseSafeDate, safeDateIsoKey, safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import { classifySaleItem } from '../lib/saleClassification';
import { deleteSaleTicketFromFirestore } from '../lib/firebase';
import { ALL_BRANCHES, COMMERCIAL_BRANCHES, normalizeBranchId, compareBranchIds, getBranchDisplayName } from '../data/initialBranches';
import CorteXModal from './CorteXModal';
import TicketReceiptModal from './TicketReceiptModal';

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
}

export default function SalesModule({
  salesTickets = [],
  expenses = [],
  currentBranch,
  currentOperator = { id: 'op-admin', name: 'Admin Principal', username: 'admin', role: 'admin', branchIds: ['b-bodega'] },
  allBranches = ALL_BRANCHES,
  cortesX = [],
  branchCashFunds = {},
  onOpenNoticeModal,
  onFinalizeCorteX,
  onDeleteSaleTicket
}: SalesModuleProps) {

  const [activeTab, setActiveTab] = useState<'cortes' | 'tickets' | 'expenses' | 'analytics'>('cortes');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
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

  // Ticket list filters
  const [ticketDateFilter, setTicketDateFilter] = useState<'all' | 'today' | 'custom'>('today');
  const [ticketPaymentFilter, setTicketPaymentFilter] = useState<string>('all');

  const todayIso = safeDateIsoKey(new Date());

  // Fixed canonical branches list (Navojoa always 1st, Huatabampo always 2nd)
  const branchesList = useMemo(() => [
    { id: 'all', name: 'Todas las Sucursales' },
    { id: 'b-navojoa', name: 'Sucursal Navojoa Centro' },
    { id: 'b-huatabampo', name: 'Sucursal Huatabampo' }
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

  // List of active physical commercial sales branches to monitor (strictly fixed canonical order)
  const monitoredBranches = useMemo(() => COMMERCIAL_BRANCHES, []);


  // Live branch state calculation (Today's Real-time Pulse)
  const branchLiveStats = useMemo(() => {
    return monitoredBranches.map(branch => {
      const todayTickets = safeTickets.filter(t => 
        safeDateIsoKey(t.timestamp) === todayIso && normalizeBranchId(t.branchId) === branch.id
      );
      const openTickets = todayTickets.filter(t => !t.corteXId);

      const todayExpenses = safeExpenses.filter(e => 
        safeDateIsoKey(e.timestamp || e.date) === todayIso && normalizeBranchId(e.branchId) === branch.id
      );
      const openExpenses = todayExpenses.filter(e => !e.corteXId);

      let cashSales = 0;
      let cardSales = 0;
      let transferSales = 0;
      let totalSales = 0;

      todayTickets.forEach(t => {
        const amt = t.total || 0;
        totalSales += amt;
        if (t.paymentMethod === 'Efectivo') cashSales += amt;
        else if (t.paymentMethod === 'Tarjeta') cardSales += amt;
        else if (t.paymentMethod === 'Transferencia') transferSales += amt;
      });

      let totalExpenses = 0;
      todayExpenses.forEach(e => {
        totalExpenses += (e.amount || 0);
      });

      let openCashSales = 0;
      openTickets.forEach(t => {
        if (t.paymentMethod === 'Efectivo') openCashSales += (t.total || 0);
      });

      let openExpensesAmt = 0;
      openExpenses.forEach(e => {
        openExpensesAmt += (e.amount || 0);
      });

      let initialCashFund = 1000;
      try {
        const savedFund = localStorage.getItem(`erp_branch_fund_${branch.id}`);
        if (savedFund) {
          const parsed = parseFloat(savedFund);
          if (!isNaN(parsed) && parsed >= 0) initialCashFund = parsed;
        }
      } catch {}

      const expectedCashInDrawer = initialCashFund + openCashSales - openExpensesAmt;

      // Operator name in turn
      let currentShiftOperator = todayTickets[todayTickets.length - 1]?.operatorName || '';
      try {
        const shiftLoginKey = `erp_shift_login_${branch.id}_${todayIso}`;
        const savedLogin = localStorage.getItem(shiftLoginKey);
        if (savedLogin) {
          const parsed = JSON.parse(savedLogin);
          if (parsed?.operatorName) currentShiftOperator = parsed.operatorName;
        }
      } catch {}

      if (!currentShiftOperator && branch.id === currentBranch.id) {
        currentShiftOperator = currentOperator.name;
      }

      const hasActivityToday = todayTickets.length > 0 || todayExpenses.length > 0;

      return {
        branchId: branch.id,
        branchName: branch.name,
        hasActivityToday,
        todayTicketsCount: todayTickets.length,
        openTicketsCount: openTickets.length,
        todayExpensesCount: todayExpenses.length,
        totalSales,
        cashSales,
        cardSales,
        transferSales,
        totalExpenses,
        initialCashFund,
        expectedCashInDrawer,
        currentShiftOperator: currentShiftOperator || 'Operador en Turno',
        hasOpenShift: openTickets.length > 0 || openExpenses.length > 0 || hasActivityToday
      };
    });
  }, [monitoredBranches, safeTickets, safeExpenses, todayIso, currentBranch, currentOperator]);

  // Build Official Cortes X List + Open/Historical Shifts for all active branches across natural days
  const aggregatedCortesList = useMemo(() => {
    const savedGrouped: Record<string, CorteXRecord> = {};
    
    safeCortesX.forEach((corte) => {
      if (!corte) return;
      const normBId = normalizeBranchId(corte.branchId);
      if (normBId === 'b-bodega') return; // Bodega is not a sales point
      const dateKey = safeDateIsoKey(corte.timestamp) || safeDateIsoKey(corte.dateStr);
      const groupKey = `${normBId}_${dateKey}`;
      // Ensure dateStr and branchName are always cleanly formatted
      const normalizedCorte: CorteXRecord = {
        ...corte,
        branchId: normBId,
        branchName: getBranchName(normBId),
        dateStr: safeFormatDate(parseSafeDate(dateKey))
      };
      // For past days, group by branch & date. For today, preserve all closed cortes
      if (dateKey !== todayIso) {
        if (!savedGrouped[groupKey]) {
          savedGrouped[groupKey] = normalizedCorte;
        }
      } else {
        // Closed corte of today
        savedGrouped[corte.id] = normalizedCorte;
      }
    });

    // Fallback: Reconstruct Cortes X from tickets/expenses that have corteXId if missing from cortesX collection
    const cortesIdSet = new Set(safeCortesX.map(c => c.id));
    const orphanCorteMap: Record<string, { branchId: string; tickets: SaleTicket[]; expenses: Expense[]; maxTimestamp: string }> = {};

    safeTickets.forEach(t => {
      const normBId = normalizeBranchId(t.branchId);
      if (normBId === 'b-bodega') return;
      if (t.corteXId && !cortesIdSet.has(t.corteXId)) {
        if (!orphanCorteMap[t.corteXId]) {
          orphanCorteMap[t.corteXId] = { branchId: normBId, tickets: [], expenses: [], maxTimestamp: t.timestamp };
        }
        orphanCorteMap[t.corteXId].tickets.push(t);
        if (t.timestamp > orphanCorteMap[t.corteXId].maxTimestamp) {
          orphanCorteMap[t.corteXId].maxTimestamp = t.timestamp;
        }
      }
    });

    safeExpenses.forEach(e => {
      const normBId = normalizeBranchId(e.branchId);
      if (normBId === 'b-bodega') return;
      if (e.corteXId && !cortesIdSet.has(e.corteXId)) {
        if (!orphanCorteMap[e.corteXId]) {
          orphanCorteMap[e.corteXId] = { branchId: normBId, tickets: [], expenses: [], maxTimestamp: e.timestamp || new Date().toISOString() };
        }
        orphanCorteMap[e.corteXId].expenses.push(e);
      }
    });

    Object.entries(orphanCorteMap).forEach(([corteId, data]) => {
      const dKey = safeDateIsoKey(data.maxTimestamp);
      const groupKey = `${data.branchId}_${dKey}`;
      if (!savedGrouped[groupKey] && !savedGrouped[corteId]) {
        let cash = 0, card = 0, transfer = 0;
        data.tickets.forEach(t => {
          if (t.paymentMethod === 'Efectivo') cash += (t.total || 0);
          if (t.paymentMethod === 'Tarjeta') card += (t.total || 0);
          if (t.paymentMethod === 'Transferencia') transfer += (t.total || 0);
        });
        const totalExp = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalSales = cash + card + transfer;
        const targetDate = parseSafeDate(dKey);

        savedGrouped[corteId] = {
          id: corteId,
          timestamp: data.maxTimestamp,
          dateStr: safeFormatDate(targetDate),
          timeStr: 'Corte Recuperado',
          branchId: data.branchId,
          branchName: getBranchName(data.branchId),
          operatorName: data.tickets[0]?.operatorName || 'Cajero',
          initialCashFund: 1000,
          cashSales: cash,
          cardSales: card,
          transferSales: transfer,
          totalSales,
          totalExpenses: totalExp,
          netIncome: totalSales - totalExp,
          expectedCashInDrawer: 1000 + cash - totalExp,
          ticketIds: data.tickets.map(t => t.id),
          expenseIds: data.expenses.map(e => e.id),
          ticketsSnapshot: data.tickets,
          expensesSnapshot: data.expenses,
          breakdown: { accesoriosTotal: totalSales, accesoriosCount: data.tickets.length, abonosTotal: 0, abonosCount: 0, enganchesTotal: 0, enganchesCount: 0, reparacionesTotal: 0, reparacionesCount: 0, recargasTotal: 0, recargasCount: 0 }
        };
      }
    });

    const officialList = Object.values(savedGrouped);

    // Recopilar todas las fechas naturales con actividad, garantizando hoy, ayer (domingo) y los últimos 14 días
    const dateKeysSet = new Set<string>();
    dateKeysSet.add(todayIso);

    // Garantizar que ayer (domingo) y los últimos 14 días naturales siempre existan en el registro
    const now = new Date();
    for (let d = 1; d <= 14; d++) {
      const pastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, 12, 0, 0);
      dateKeysSet.add(safeDateIsoKey(pastDay));
    }

    safeCortesX.forEach(c => {
      const normBId = normalizeBranchId(c.branchId);
      if (normBId === 'b-bodega') return;
      const dKey = safeDateIsoKey(c.timestamp) || safeDateIsoKey(c.dateStr);
      if (dKey) dateKeysSet.add(dKey);
    });

    safeTickets.forEach(t => {
      const normBId = normalizeBranchId(t.branchId);
      if (normBId === 'b-bodega') return;
      const dKey = safeDateIsoKey(t.timestamp);
      if (dKey) dateKeysSet.add(dKey);
    });

    safeExpenses.forEach(e => {
      const normBId = normalizeBranchId(e.branchId);
      if (normBId === 'b-bodega') return;
      const dKey = safeDateIsoKey(e.timestamp || e.date);
      if (dKey) dateKeysSet.add(dKey);
    });

    const openShiftsList: CorteXRecord[] = [];
    const pastReconciledList: CorteXRecord[] = [];
    const zeroDaysList: CorteXRecord[] = [];

    // Process each natural day
    dateKeysSet.forEach(dateIso => {
      monitoredBranches.forEach(branch => {
        const groupKey = `${branch.id}_${dateIso}`;

        // 1. TODAY's Live Shift: Handle active turnos without duplicating already-closed cortes
        if (dateIso === todayIso) {
          const branchTodayTickets = safeTickets.filter(t => 
            safeDateIsoKey(t.timestamp) === dateIso && normalizeBranchId(t.branchId) === branch.id
          );
          const openTickets = branchTodayTickets.filter(t => !t.corteXId);

          const branchTodayExpenses = safeExpenses.filter(e => 
            safeDateIsoKey(e.timestamp || e.date) === dateIso && normalizeBranchId(e.branchId) === branch.id
          );
          const openExpenses = branchTodayExpenses.filter(e => !e.corteXId);

          // Verificar si ya existe un corte cerrado registrado para hoy en esta sucursal
          const closedCortesToday = officialList.filter(c => 
            normalizeBranchId(c.branchId) === branch.id && 
            (safeDateIsoKey(c.timestamp) === todayIso || safeDateIsoKey(c.dateStr) === todayIso)
          );

          // Si ya se realizó el corte oficial hoy y NO hay nuevas ventas/gastos abiertos, NO duplicar fila
          if (closedCortesToday.length > 0 && openTickets.length === 0 && openExpenses.length === 0) {
            return;
          }

          const isPostCorteTurno = closedCortesToday.length > 0;
          const ticketsToCount = isPostCorteTurno ? openTickets : (openTickets.length > 0 ? openTickets : branchTodayTickets);
          const expensesToCount = isPostCorteTurno ? openExpenses : (openExpenses.length > 0 ? openExpenses : branchTodayExpenses);

          let cash = 0, card = 0, transfer = 0;
          let accTot = 0, accCnt = 0, aboTot = 0, aboCnt = 0, engTot = 0, engCnt = 0, repTot = 0, repCnt = 0, recTot = 0, recCnt = 0;

          ticketsToCount.forEach(t => {
            if (t.paymentMethod === 'Efectivo') cash += (t.total || 0);
            if (t.paymentMethod === 'Tarjeta') card += (t.total || 0);
            if (t.paymentMethod === 'Transferencia') transfer += (t.total || 0);

            (t.items || []).forEach(item => {
              const tot = item.totalPrice || 0;
              const qty = item.quantity || 1;
              const key = classifySaleItem(item);
              if (key === 'abonos') { aboTot += tot; aboCnt += qty; }
              else if (key === 'enganches') { engTot += tot; engCnt += qty; }
              else if (key === 'reparaciones') { repTot += tot; repCnt += qty; }
              else if (key === 'recargas') { recTot += tot; recCnt += qty; }
              else { accTot += tot; accCnt += qty; }
            });
          });

          const totalExp = expensesToCount.reduce((sum, e) => sum + (e.amount || 0), 0);
          const totalSales = cash + card + transfer;
          const targetDate = parseSafeDate(dateIso);

          let initialCashFund = 1000;
          if (branchCashFunds && branchCashFunds[branch.id] !== undefined && !isNaN(branchCashFunds[branch.id])) {
            initialCashFund = branchCashFunds[branch.id];
          } else {
            const priorCortes = (cortesX || []).filter(c => c && normalizeBranchId(c.branchId) === branch.id);
            priorCortes.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            if (priorCortes[0] && typeof priorCortes[0].cashFundLeftForNextShift === 'number' && !isNaN(priorCortes[0].cashFundLeftForNextShift)) {
              initialCashFund = priorCortes[0].cashFundLeftForNextShift;
            } else {
              try {
                const savedFund = localStorage.getItem(`erp_branch_fund_${branch.id}`);
                if (savedFund) {
                  const parsed = parseFloat(savedFund);
                  if (!isNaN(parsed) && parsed >= 0) initialCashFund = parsed;
                }
              } catch {}
            }
          }

          let shiftLoginTime = '09:00 AM';
          let loggedOperatorName = '';
          try {
            const shiftLoginKey = `erp_shift_login_${branch.id}_${dateIso}`;
            const savedLogin = localStorage.getItem(shiftLoginKey);
            if (savedLogin) {
              const parsedLogin = JSON.parse(savedLogin);
              if (parsedLogin?.time) shiftLoginTime = parsedLogin.time;
              if (parsedLogin?.operatorName) loggedOperatorName = parsedLogin.operatorName;
            }
          } catch {}

          openShiftsList.push({
            id: isPostCorteTurno 
              ? `CTX-TURNO-POST-${branch.id.replace('b-', '').toUpperCase()}-${dateIso}`
              : `CTX-TURNO-${branch.id.replace('b-', '').toUpperCase()}-${dateIso}`,
            timestamp: `${dateIso}T23:59:59.999Z`,
            dateStr: safeFormatDate(targetDate),
            timeStr: isPostCorteTurno 
              ? 'Turno en Vivo (Movimientos posteriores al corte)' 
              : `Inicia: ${shiftLoginTime} (Turno en Vivo / Tiempo Real)`,
            branchId: branch.id,
            branchName: branch.name,
            operatorName: loggedOperatorName || branchTodayTickets[0]?.operatorName || (branch.id === currentBranch.id ? currentOperator.name : 'Turno Activo (Hoy)'),
            initialCashFund,
            cashSales: cash,
            cardSales: card,
            transferSales: transfer,
            totalSales,
            totalExpenses: totalExp,
            netIncome: totalSales - totalExp,
            expectedCashInDrawer: initialCashFund + cash - totalExp,
            ticketIds: ticketsToCount.map(t => t.id),
            expenseIds: expensesToCount.map(e => e.id),
            ticketsSnapshot: ticketsToCount,
            expensesSnapshot: expensesToCount,
            breakdown: { accesoriosTotal: accTot, accesoriosCount: accCnt, abonosTotal: aboTot, abonosCount: aboCnt, enganchesTotal: engTot, enganchesCount: engCnt, reparacionesTotal: repTot, reparacionesCount: repCnt, recargasTotal: recTot, recargasCount: recCnt }
          });
          return;
        }

        // 2. PAST DAYS: If official corte saved for this branch & date, keep it
        if (savedGrouped[groupKey]) return;

        const branchTickets = safeTickets.filter(t => safeDateIsoKey(t.timestamp) === dateIso && normalizeBranchId(t.branchId) === branch.id);
        const branchExpenses = safeExpenses.filter(e => safeDateIsoKey(e.timestamp || e.date) === dateIso && normalizeBranchId(e.branchId) === branch.id);

        let cash = 0, card = 0, transfer = 0;
        let accTot = 0, accCnt = 0, aboTot = 0, aboCnt = 0, engTot = 0, engCnt = 0, repTot = 0, repCnt = 0, recTot = 0, recCnt = 0;

        branchTickets.forEach(t => {
          if (t.paymentMethod === 'Efectivo') cash += (t.total || 0);
          if (t.paymentMethod === 'Tarjeta') card += (t.total || 0);
          if (t.paymentMethod === 'Transferencia') transfer += (t.total || 0);

          (t.items || []).forEach(item => {
            const tot = item.totalPrice || 0;
            const qty = item.quantity || 1;
            const key = classifySaleItem(item);
            if (key === 'abonos') { aboTot += tot; aboCnt += qty; }
            else if (key === 'enganches') { engTot += tot; engCnt += qty; }
            else if (key === 'reparaciones') { repTot += tot; repCnt += qty; }
            else if (key === 'recargas') { recTot += tot; recCnt += qty; }
            else { accTot += tot; accCnt += qty; }
          });
        });

        const totalExp = branchExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalSales = cash + card + transfer;
        const hasActivity = branchTickets.length > 0 || branchExpenses.length > 0;
        const targetDate = parseSafeDate(dateIso);

        if (hasActivity) {
          // Días pasados con actividad sin corte manual: Reconciliados y asegurados con su desglose oficial
          pastReconciledList.push({
            id: `CTX_${branch.id}_${dateIso}`,
            timestamp: `${dateIso}T23:59:59.000Z`,
            dateStr: safeFormatDate(targetDate),
            timeStr: 'Cierre Oficial de Turno',
            branchId: branch.id,
            branchName: branch.name,
            operatorName: branchTickets[0]?.operatorName || 'Cajero en Turno',
            initialCashFund: 1000,
            cashSales: cash,
            cardSales: card,
            transferSales: transfer,
            totalSales,
            totalExpenses: totalExp,
            netIncome: totalSales - totalExp,
            expectedCashInDrawer: 1000 + cash - totalExp,
            ticketIds: branchTickets.map(t => t.id),
            expenseIds: branchExpenses.map(e => e.id),
            ticketsSnapshot: branchTickets,
            expensesSnapshot: branchExpenses,
            breakdown: { accesoriosTotal: accTot, accesoriosCount: accCnt, abonosTotal: aboTot, abonosCount: aboCnt, enganchesTotal: engTot, enganchesCount: engCnt, reparacionesTotal: repTot, reparacionesCount: repCnt, recargasTotal: recTot, recargasCount: recCnt }
          });
        } else {
          // Días pasados sin movimientos: Cerrados sin actividad
          zeroDaysList.push({
            id: `CAL-ZERO-${branch.id.replace('b-', '').toUpperCase()}-${dateIso}`,
            timestamp: `${dateIso}T00:00:00.000Z`,
            dateStr: safeFormatDate(targetDate),
            timeStr: 'Cerrado / Sin Actividad (No se laboró)',
            branchId: branch.id,
            branchName: branch.name,
            operatorName: 'Sin Movimientos',
            initialCashFund: 0,
            cashSales: 0,
            cardSales: 0,
            transferSales: 0,
            totalSales: 0,
            totalExpenses: 0,
            netIncome: 0,
            expectedCashInDrawer: 0,
            ticketIds: [],
            expenseIds: [],
            breakdown: { accesoriosTotal: 0, accesoriosCount: 0, abonosTotal: 0, abonosCount: 0, enganchesTotal: 0, enganchesCount: 0, reparacionesTotal: 0, reparacionesCount: 0, recargasTotal: 0, recargasCount: 0 }
          });
        }
      });
    });

    const all = [...openShiftsList, ...officialList, ...pastReconciledList, ...zeroDaysList];
    
    // Stable, deterministic multi-level sort to avoid any flickering between branches
    return all.sort((a, b) => {
      // 1. Date (YYYY-MM-DD) descending (newest day first)
      const dateA = safeDateIsoKey(a.timestamp) || safeDateIsoKey(a.dateStr) || '';
      const dateB = safeDateIsoKey(b.timestamp) || safeDateIsoKey(b.dateStr) || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      // 2. Open live shift on top for today
      const isOpenA = a.id.startsWith('CTX-TURNO') ? 1 : 0;
      const isOpenB = b.id.startsWith('CTX-TURNO') ? 1 : 0;
      if (isOpenA !== isOpenB) {
        return isOpenB - isOpenA;
      }

      // 3. Zero activity days at the bottom
      const isZeroA = a.id.startsWith('CAL-ZERO') ? 1 : 0;
      const isZeroB = b.id.startsWith('CAL-ZERO') ? 1 : 0;
      if (isZeroA !== isZeroB) {
        return isZeroA - isZeroB;
      }

      // 4. CANONICAL INVARIANT BRANCH PRIORITY (Navojoa always 1st, Huatabampo always 2nd)
      const branchCmp = compareBranchIds(a.branchId, b.branchId);
      if (branchCmp !== 0) return branchCmp;

      // 5. Timestamp descending if distinct
      if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp) {
        return b.timestamp.localeCompare(a.timestamp);
      }

      // 6. Final tiebreaker by ID
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [safeCortesX, safeTickets, safeExpenses, monitoredBranches, todayIso, currentBranch, currentOperator]);

  // Filtered Cortes list
  const filteredCortes = useMemo(() => {
    return aggregatedCortesList.filter(corte => {
      const normBId = normalizeBranchId(corte.branchId);
      if (selectedBranchId !== 'all' && normBId !== selectedBranchId) {
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

  // Filtered Live Tickets
  const filteredTickets = useMemo(() => {
    return safeTickets.filter(ticket => {
      const normBId = normalizeBranchId(ticket.branchId);
      if (normBId === 'b-bodega') return false;
      if (selectedBranchId !== 'all' && normBId !== selectedBranchId) {
        return false;
      }
      if (ticketDateFilter === 'today') {
        if (safeDateIsoKey(ticket.timestamp) !== todayIso) return false;
      }
      if (ticketPaymentFilter !== 'all') {
        if (ticket.paymentMethod !== ticketPaymentFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFolio = (ticket.folio || ticket.id || '').toLowerCase().includes(q);
        const matchesCustomer = (ticket.items?.[0]?.metadata?.clientName || '').toLowerCase().includes(q);
        const matchesOperator = (ticket.operatorName || '').toLowerCase().includes(q);
        const matchesProduct = (ticket.items || []).some(item => (item.product?.name || '').toLowerCase().includes(q));
        const matchesDate = safeFormatDate(ticket.timestamp).toLowerCase().includes(q);
        return matchesFolio || matchesCustomer || matchesOperator || matchesProduct || matchesDate;
      }
      return true;
    }).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [safeTickets, selectedBranchId, ticketDateFilter, ticketPaymentFilter, searchQuery, todayIso]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return safeExpenses.filter(expense => {
      const normBId = normalizeBranchId(expense.branchId);
      if (normBId === 'b-bodega') return false;
      if (selectedBranchId !== 'all' && normBId !== selectedBranchId) {
        return false;
      }
      if (ticketDateFilter === 'today') {
        if (safeDateIsoKey(expense.timestamp || expense.date) !== todayIso) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesConcept = (expense.concept || '').toLowerCase().includes(q);
        const matchesOperator = (expense.operatorName || '').toLowerCase().includes(q);
        return matchesConcept || matchesOperator;
      }
      return true;
    }).sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''));
  }, [safeExpenses, selectedBranchId, ticketDateFilter, searchQuery, todayIso]);


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
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteTicket = async () => {
    if (!ticketToDelete) return;
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
    } catch (err) {
      console.error('Error al eliminar transacción:', err);
      alert('Error al eliminar la transacción. Verifica tu conexión.');
    } finally {
      setIsDeletingTicket(false);
      setTimeout(() => setDeleteActionFeedback(null), 7000);
    }
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
                  Ventas, Cortes de Caja y Reportes en Vivo
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sincronizado en Tiempo Real
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Monitoreo activo por sucursal, registro en vivo de tickets, arqueos, checador de turno y calendario de cortes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 border border-slate-600 px-3 py-2 rounded-xl">
                Los tickets, gastos, cortes e inventario de producción no se borran al actualizar el sistema.
              </span>
            )}
          </div>
        </div>

        {/* Live Branch Pulse Cards (Real-Time Monitor for Today) */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {branchLiveStats.map(bStat => {
            const hasSales = bStat.todayTicketsCount > 0;
            return (
              <div 
                key={bStat.branchId}
                className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-2xl p-4 transition-all shadow-inner relative overflow-hidden group"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      hasSales ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                    }`}>
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-white truncate">{bStat.branchName}</h3>
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {bStat.currentShiftOperator}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 border ${
                    hasSales 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' 
                      : 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}>
                    {hasSales ? '🟢 En Vivo' : '⚪ Sin Ventas Hoy'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 my-2.5 pt-2 border-t border-slate-700/60">
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Ventas Hoy ({bStat.todayTicketsCount})</span>
                    <span className="text-sm font-black text-emerald-400 font-mono block">
                      ${bStat.totalSales.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5">
                      <span>Ef: ${bStat.cashSales.toFixed(0)}</span>
                      <span>•</span>
                      <span>Tarj: ${bStat.cardSales.toFixed(0)}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Caja Esperada</span>
                    <span className="text-sm font-black text-amber-300 font-mono block">
                      ${bStat.expectedCashInDrawer.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-rose-400 block mt-0.5">
                      Gastos: -${bStat.totalExpenses.toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenLiveShiftForBranch(bStat.branchId)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Arqueo / Corte en Vivo</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-3 border-t border-slate-700/80">
          <button
            type="button"
            onClick={() => setActiveTab('cortes')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'cortes'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Cortes de Caja y Turnos Diarios</span>
            <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {filteredCortes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Ventas y Tickets en Vivo</span>
            <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {filteredTickets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>Gastos y Salidas de Caja</span>
            <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {filteredExpenses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Estadísticas y Métodos de Pago</span>
          </button>
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
              Muestra la sucursal, horario de apertura/cierre y estado en tiempo real
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
                const isAutoMidnight = (corte.timeStr || '').includes('Medianoche') || (corte.operatorName || '').includes('Medianoche');

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
                        isZeroDay ? 'bg-slate-200 border-slate-300 text-slate-500' : (
                          isCurrentOpenShift 
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-700 group-hover:scale-105' 
                            : 'bg-blue-100/70 border-blue-200 text-blue-700 group-hover:scale-105'
                        )
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
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Turno en Curso (Hoy - Tiempo Real)
                            </span>
                          ) : isAutoMidnight ? (
                            <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3 text-blue-700" />
                              Corte Oficial (Cierre 12:00 AM)
                            </span>
                          ) : (
                            <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              Corte Guardado
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1 text-slate-700 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {corte.dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {corte.timeStr || 'Horario Registrado'}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {corte.operatorName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Categorized Subtotals */}
                    {!isZeroDay && (
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        {corte.breakdown?.accesoriosTotal ? (
                          <span className="bg-blue-50 text-blue-900 px-2 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 text-blue-600" />
                            Accesorios: ${corte.breakdown.accesoriosTotal.toFixed(0)}
                          </span>
                        ) : null}

                        {corte.breakdown?.abonosTotal ? (
                          <span className="bg-purple-50 text-purple-900 px-2 py-1 rounded-lg border border-purple-200 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-purple-600" />
                            Abonos: ${corte.breakdown.abonosTotal.toFixed(0)}
                          </span>
                        ) : null}

                        {corte.breakdown?.enganchesTotal ? (
                          <span className="bg-amber-50 text-amber-900 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-amber-600" />
                            Enganches: ${corte.breakdown.enganchesTotal.toFixed(0)}
                          </span>
                        ) : null}

                        {corte.breakdown?.reparacionesTotal ? (
                          <span className="bg-cyan-50 text-cyan-900 px-2 py-1 rounded-lg border border-cyan-200 flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-cyan-600" />
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
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Turno / Día</span>
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
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 group-hover:bg-blue-600 text-white text-xs font-black rounded-xl transition-colors shrink-0 shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isCurrentOpenShift ? 'Arqueo en Vivo' : 'Ver Corte'}</span>
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
              {filteredTickets.map((ticket, idx) => {
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
                            {ticket.folio || ticket.id}
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
              {filteredExpenses.map((expense, idx) => {
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
      {selectedCorte && (
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
        />
      )}

      {/* Modal for viewing active live Corte X for selected branch */}
      {isLiveCorteModalOpen && (
        <CorteXModal
          isOpen={isLiveCorteModalOpen}
          onClose={() => setIsLiveCorteModalOpen(false)}
          tickets={safeTickets}
          expenses={safeExpenses}
          currentBranch={selectedLiveBranch}
          currentOperator={currentOperator}
          cortesX={safeCortesX}
          onFinalizeCorteX={onFinalizeCorteX}
        />
      )}

      {/* Modal for Ticket Receipt / Reprint */}
      {isTicketReceiptOpen && selectedTicketForReceipt && (
        <TicketReceiptModal
          isOpen={isTicketReceiptOpen}
          onClose={() => {
            setIsTicketReceiptOpen(false);
            setSelectedTicketForReceipt(null);
          }}
          ticket={selectedTicketForReceipt}
          currentBranch={getBranchObj(selectedTicketForReceipt.branchId)}
        />
      )}

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
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingTicket}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setTicketToDelete(null);
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
