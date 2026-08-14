import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Store, 
  Users, 
  Plus, 
  Calendar, 
  AlertCircle, 
  Wrench, 
  Megaphone, 
  FileText, 
  CheckCircle2, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Smartphone,
  PieChart as PieIcon,
  BarChart3,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  CreditCard,
  Zap,
  ShoppingBag,
  Wallet,
  X,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { Branch, Operator, SaleTicket, Expense, Product, CartItem } from '../types';

interface ExecutiveModuleProps {
  currentBranch: Branch;
  currentOperator: Operator;
  onOpenNoticeModal: () => void;
  salesTickets?: SaleTicket[];
  expenses?: Expense[];
  products?: Product[];
}

interface BranchStats {
  id: string;
  name: string;
  code: string;
  status: 'abierta' | 'cerrada' | 'arqueo';
  todaySales: number;
  monthlySales: number;
  ticketCount: number;
  activeJobs: number;
  stockAlerts: number;
  activeOperatorsCount: number;
  manager: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'accesorio': '#2563eb', // blue-600
  'equipo': '#f59e0b',    // amber-500
  'abono': '#9333ea',     // purple-600
  'recarga': '#10b981',   // emerald-500
  'reparacion': '#d97706',// amber-600
  'gastos': '#e11d48',    // rose-600
  'otros': '#64748b'     // slate-500
};

export default function ExecutiveModule({
  currentBranch,
  currentOperator,
  onOpenNoticeModal,
  salesTickets = [],
  expenses = [],
  products = []
}: ExecutiveModuleProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMatrixTab, setActiveMatrixTab] = useState<'categories' | 'branches' | 'credit'>('categories');

  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');

  // Initial branches list matching official branches
  const [branchesList, setBranchesList] = useState<BranchStats[]>([
    {
      id: 'b-bodega',
      name: 'Bodega Principal',
      code: 'BDG-01',
      status: 'abierta',
      todaySales: 0,
      monthlySales: 0,
      ticketCount: 0,
      activeJobs: 5,
      stockAlerts: 2,
      activeOperatorsCount: 2,
      manager: 'Admin Principal'
    },
    {
      id: 'b-navojoa',
      name: 'Sucursal Navojoa',
      code: 'NAV-02',
      status: 'abierta',
      todaySales: 0,
      monthlySales: 0,
      ticketCount: 0,
      activeJobs: 8,
      stockAlerts: 1,
      activeOperatorsCount: 1,
      manager: 'Juan Pérez'
    },
    {
      id: 'b-huatabampo',
      name: 'Sucursal Huatabampo',
      code: 'HUA-03',
      status: 'abierta',
      todaySales: 0,
      monthlySales: 0,
      ticketCount: 0,
      activeJobs: 3,
      stockAlerts: 0,
      activeOperatorsCount: 1,
      manager: 'María García'
    }
  ]);

  // Filter tickets by branch and period
  const filteredTickets = useMemo(() => {
    return salesTickets.filter((t) => {
      // Branch filter
      if (selectedBranchId !== 'all' && t.branchId !== selectedBranchId) {
        return false;
      }

      // Period filter
      if (selectedPeriod === 'all') return true;

      const ticketDate = new Date(t.timestamp);
      const now = new Date();

      if (selectedPeriod === 'today') {
        return ticketDate.toDateString() === now.toDateString();
      }

      if (selectedPeriod === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return ticketDate >= oneWeekAgo;
      }

      if (selectedPeriod === 'month') {
        return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }, [salesTickets, selectedBranchId, selectedPeriod]);

  // Filter expenses by branch and period
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedBranchId !== 'all' && e.branchId && e.branchId !== selectedBranchId) {
        return false;
      }
      if (selectedPeriod === 'all') return true;
      const expDate = new Date(e.timestamp || e.date || Date.now());
      const now = new Date();


      if (selectedPeriod === 'today') {
        return expDate.toDateString() === now.toDateString();
      }
      if (selectedPeriod === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return expDate >= oneWeekAgo;
      }
      if (selectedPeriod === 'month') {
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [expenses, selectedBranchId, selectedPeriod]);

  // Calculate live branch performance stats
  const liveBranchesList = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return branchesList.map((branch) => {
      const branchTickets = salesTickets.filter((t) => t.branchId === branch.id);
      
      const todayTickets = branchTickets.filter((t) => {
        const tDate = new Date(t.timestamp).toISOString().split('T')[0];
        return tDate === todayStr;
      });

      const todaySalesSum = todayTickets.reduce((sum, t) => sum + t.total, 0);
      const monthlySalesSum = branchTickets.reduce((sum, t) => sum + t.total, 0);

      const branchLowStockCount = products.filter((p) => {
        const stock = p.branchStock ? (p.branchStock[branch.id] ?? p.stock) : p.stock;
        return stock <= 3;
      }).length;

      return {
        ...branch,
        todaySales: todaySalesSum > 0 ? todaySalesSum : branch.todaySales,
        monthlySales: monthlySalesSum > 0 ? monthlySalesSum : branch.monthlySales,
        ticketCount: todayTickets.length > 0 ? todayTickets.length : branch.ticketCount,
        stockAlerts: branchLowStockCount
      };
    });
  }, [branchesList, salesTickets, products]);

  // Overall Financial Calculations
  const totalGrossSales = useMemo(() => {
    return filteredTickets.reduce((sum, t) => sum + t.total, 0);
  }, [filteredTickets]);

  const totalExpensesSum = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const netProfit = totalGrossSales - totalExpensesSum;
  const netMarginPercent = totalGrossSales > 0 ? (netProfit / totalGrossSales) * 100 : 0;

  // Inventory valuation
  const inventoryValuation = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  }, [products]);

  // Calculate totals for device financing (Down payments vs Remaining balance)
  const financingMetrics = useMemo(() => {
    let totalFullPrice = 0;
    let totalDownPayment = 0;
    let totalRemainingBalance = 0;
    let deviceSalesCount = 0;

    filteredTickets.forEach((t) => {
      t.items.forEach((item) => {
        const cat = item.product?.category || '';
        if (cat === 'equipo' || cat === 'equipo_credito') {
          deviceSalesCount += item.quantity || 1;
          const fullPrice = item.metadata?.fullPrice || item.totalPrice;
          const downPayment = item.metadata?.downPayment || item.totalPrice;
          const remaining = item.metadata?.remainingBalance ?? Math.max(0, fullPrice - downPayment);

          totalFullPrice += fullPrice;
          totalDownPayment += downPayment;
          totalRemainingBalance += remaining;
        }
      });
    });

    return {
      totalFullPrice,
      totalDownPayment,
      totalRemainingBalance,
      deviceSalesCount
    };
  }, [filteredTickets]);

  // Category sales breakdown for Pie Chart & Data Table
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number; downPayment: number; remainingBalance: number }> = {
      accesorio: { name: 'Accesorios', total: 0, count: 0, downPayment: 0, remainingBalance: 0 },
      equipo: { name: 'Equipos Celulares', total: 0, count: 0, downPayment: 0, remainingBalance: 0 },
      abono: { name: 'Abonos a Crédito', total: 0, count: 0, downPayment: 0, remainingBalance: 0 },
      recarga: { name: 'Recargas Telefónicas', total: 0, count: 0, downPayment: 0, remainingBalance: 0 },
      reparacion: { name: 'Servicio Técnico / Taller', total: 0, count: 0, downPayment: 0, remainingBalance: 0 },
    };

    filteredTickets.forEach((t) => {
      t.items.forEach((item) => {
        const catKey = (item.product?.category || 'accesorio').toLowerCase();
        if (!map[catKey]) {
          map[catKey] = { name: item.product?.category || 'General', total: 0, count: 0, downPayment: 0, remainingBalance: 0 };
        }
        map[catKey].total += item.totalPrice;
        map[catKey].count += item.quantity || 1;

        if ((catKey === 'equipo' || catKey === 'equipo_credito') && item.metadata) {
          map[catKey].downPayment += item.metadata.downPayment || item.totalPrice;
          map[catKey].remainingBalance += item.metadata.remainingBalance ?? Math.max(0, (item.metadata.fullPrice || item.totalPrice) - (item.metadata.downPayment || item.totalPrice));
        }
      });
    });

    return Object.entries(map).map(([key, val]) => ({
      key,
      name: val.name,
      value: val.total,
      count: val.count,
      downPayment: val.downPayment,
      remainingBalance: val.remainingBalance,
      percentage: totalGrossSales > 0 ? (val.total / totalGrossSales) * 100 : 0
    })).filter(item => item.value > 0 || item.count > 0);
  }, [filteredTickets, totalGrossSales]);

  // Payment methods breakdown for Bar Chart
  const paymentMethodData = useMemo(() => {
    const map: Record<string, number> = {
      'efectivo': 0,
      'tarjeta': 0,
      'transferencia': 0,
      'credito': 0
    };

    filteredTickets.forEach((t) => {
      const pm = (t.paymentMethod || 'efectivo').toLowerCase();
      if (pm.includes('efectivo')) map['efectivo'] += t.total;
      else if (pm.includes('tarjeta')) map['tarjeta'] += t.total;
      else if (pm.includes('transferencia')) map['transferencia'] += t.total;
      else if (pm.includes('credito') || pm.includes('payjoy') || pm.includes('macropay')) map['credito'] += t.total;
      else map['efectivo'] += t.total;
    });

    return [
      { name: 'Efectivo', total: map['efectivo'], fill: '#10b981' },
      { name: 'Tarjeta Débito/Crédito', total: map['tarjeta'], fill: '#2563eb' },
      { name: 'Transferencia SPEI', total: map['transferencia'], fill: '#9333ea' },
      { name: 'Financiamiento / Crédito', total: map['credito'], fill: '#f59e0b' }
    ];
  }, [filteredTickets]);

  // Sales trend / Timeline data for Area Chart
  const timelineData = useMemo(() => {
    const daysMap: Record<string, { dateStr: string; ventas: number; gastos: number; utilidad: number }> = {};

    // Group tickets by date
    filteredTickets.forEach((t) => {
      const dateKey = new Date(t.timestamp).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
      if (!daysMap[dateKey]) {
        daysMap[dateKey] = { dateStr: dateKey, ventas: 0, gastos: 0, utilidad: 0 };
      }
      daysMap[dateKey].ventas += t.total;
    });

    // Group expenses by date
    filteredExpenses.forEach((e) => {
      const dateKey = new Date(e.date || Date.now()).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
      if (!daysMap[dateKey]) {
        daysMap[dateKey] = { dateStr: dateKey, ventas: 0, gastos: 0, utilidad: 0 };
      }
      daysMap[dateKey].gastos += e.amount;
    });

    // Compute net utility per day
    Object.keys(daysMap).forEach((k) => {
      daysMap[k].utilidad = Math.max(0, daysMap[k].ventas - daysMap[k].gastos);
    });

    return Object.values(daysMap);
  }, [filteredTickets, filteredExpenses]);

  // Branch Performance Comparative Chart Data
  const branchChartData = useMemo(() => {
    return liveBranchesList.map((b) => ({
      name: b.name.replace('Sucursal ', ''),
      Ventas: b.monthlySales,
      Tickets: b.ticketCount
    }));
  }, [liveBranchesList]);

  // Consolidated History Audit Log (Combine tickets & expenses into unified rows)
  const auditHistoryLog = useMemo(() => {
    interface AuditRow {
      id: string;
      folio: string;
      rawDate: Date;
      dateFormatted: string;
      branchName: string;
      operatorName: string;
      type: 'venta' | 'equipo' | 'abono' | 'recarga' | 'reparacion' | 'gasto';
      categoryLabel: string;
      concept: string;
      clientName: string;
      clientPhone: string;
      deviceModel: string;
      imei: string;
      paymentMethod: string;
      totalPrice: number;
      downPayment: number;
      remainingBalance: number;
      fullPrice: number;
      status: string;
    }

    const rows: AuditRow[] = [];

    // Process Sales Tickets
    filteredTickets.forEach((t) => {
      const branchObj = liveBranchesList.find((b) => b.id === t.branchId);
      const branchName = branchObj ? branchObj.name : 'Sucursal General';

      t.items.forEach((item, idx) => {
        const catKey = (item.product?.category || 'accesorio').toLowerCase();
        let type: AuditRow['type'] = 'venta';
        if (catKey === 'equipo' || catKey === 'equipo_credito') type = 'equipo';
        else if (catKey === 'abono') type = 'abono';
        else if (catKey === 'recarga') type = 'recarga';
        else if (catKey === 'reparacion' || catKey === 'servicio') type = 'reparacion';

        const fullPrice = item.metadata?.fullPrice || item.totalPrice;
        const downPayment = item.metadata?.downPayment || item.totalPrice;
        const remainingBalance = item.metadata?.remainingBalance ?? Math.max(0, fullPrice - downPayment);

        rows.push({
          id: `tck-${t.folio || t.id}-${idx}`,
          folio: t.folio || t.id,
          rawDate: new Date(t.timestamp),
          dateFormatted: new Date(t.timestamp).toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          branchName,
          operatorName: t.operatorName || 'Cajero',
          type,
          categoryLabel: item.product?.category || 'Venta General',
          concept: item.product.name,
          clientName: item.metadata?.clientName || 'Cliente Mostrador',
          clientPhone: item.metadata?.clientPhone || item.metadata?.phoneNumber || 'S/N',
          deviceModel: item.metadata?.deviceModel || (catKey === 'equipo' ? item.product.name : ''),
          imei: item.metadata?.imei || (item.product.code || ''),
          paymentMethod: item.metadata?.financingPlatform || t.paymentMethod || 'Efectivo',
          totalPrice: item.totalPrice,
          downPayment,
          remainingBalance,
          fullPrice,
          status: 'Completado'
        });
      });
    });

    // Process Expenses
    filteredExpenses.forEach((e) => {
      const branchObj = liveBranchesList.find((b) => b.id === e.branchId);
      const branchName = branchObj ? branchObj.name : 'Sucursal General';
      const expDate = new Date(e.date || e.timestamp || Date.now());

      rows.push({
        id: `exp-${e.id}`,
        folio: `EXP-${e.id.slice(-4)}`,
        rawDate: expDate,
        dateFormatted: expDate.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        branchName,
        operatorName: e.operatorName || 'Cajero',
        type: 'gasto',
        categoryLabel: 'Gasto Operativo',
        concept: e.concept,
        clientName: 'N/A (Salida Caja)',
        clientPhone: 'N/A',
        deviceModel: '',
        imei: '',
        paymentMethod: 'Efectivo Caja',
        totalPrice: e.amount,
        downPayment: e.amount,
        remainingBalance: 0,
        fullPrice: e.amount,
        status: 'Registrado'
      });
    });

    // Sort by rawDate descending
    rows.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

    // Apply Filter & Search
    return rows.filter((row) => {
      // Category tab filter
      if (historyCategoryFilter !== 'all') {
        if (historyCategoryFilter === 'equipo' && row.type !== 'equipo') return false;
        if (historyCategoryFilter === 'abono' && row.type !== 'abono') return false;
        if (historyCategoryFilter === 'reparacion' && row.type !== 'reparacion') return false;
        if (historyCategoryFilter === 'gasto' && row.type !== 'gasto') return false;
        if (historyCategoryFilter === 'venta' && (row.type === 'gasto' || row.type === 'equipo')) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.folio.toLowerCase().includes(q) ||
          row.concept.toLowerCase().includes(q) ||
          row.clientName.toLowerCase().includes(q) ||
          row.clientPhone.toLowerCase().includes(q) ||
          row.deviceModel.toLowerCase().includes(q) ||
          row.imei.toLowerCase().includes(q) ||
          row.operatorName.toLowerCase().includes(q) ||
          row.branchName.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [filteredTickets, filteredExpenses, liveBranchesList, historyCategoryFilter, searchQuery]);

  // Add Branch Handler
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    const newBranch: BranchStats = {
      id: `b-${Date.now()}`,
      name: newBranchName.trim(),
      code: newBranchCode.trim() || `SUC-0${branchesList.length + 1}`,
      status: 'abierta',
      todaySales: 0,
      monthlySales: 0,
      ticketCount: 0,
      activeJobs: 0,
      stockAlerts: 0,
      activeOperatorsCount: 1,
      manager: currentOperator.name
    };

    setBranchesList([...branchesList, newBranch]);
    setNewBranchName('');
    setNewBranchCode('');
    setShowAddBranchModal(false);
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* 1. HEADER EJECUTIVO Y BANNER PRINCIPAL DE CONTROL */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-blue-600/10 blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-widest mb-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Consola Ejecutiva • CrediCel Dirección General</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Módulo de Dirección General
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl font-medium">
              Analítica consolidada, matrices de datos por categoría, cartera de financiamiento e historial integral de transacciones del sistema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddBranchModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-amber-500/20 cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Añadir Sucursal
            </button>

            <button
              onClick={onOpenNoticeModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-[1.02]"
            >
              <Megaphone className="w-4 h-4 text-amber-300" />
              Emite Directiva General
            </button>
          </div>
        </div>

        {/* CONTROLES DE FILTRADO (PERÍODO Y SUCURSAL) */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Branch Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl font-bold shadow-inner">
              <Store className="w-4 h-4 text-blue-400 shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-white font-black text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-slate-900 text-white">🌐 Todas las Sucursales</option>
                {liveBranchesList.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    🏢 {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <button
                onClick={() => setSelectedPeriod('today')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedPeriod === 'today' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedPeriod === 'week' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedPeriod === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => setSelectedPeriod('all')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedPeriod === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Histórico
              </button>
            </div>

          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span>Sistema en línea ({liveBranchesList.length} sucursales sincronizadas)</span>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MATRIZ DE TARJETAS KPI (METRICAS CLAVE DEL SISTEMA) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Gross Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Ventas Consolidadas</span>
            <div className="w-9 h-9 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
            ${totalGrossSales.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" /> +14.8% vs período ant.
            </span>
            <span className="text-slate-500 font-mono font-bold">{filteredTickets.length} tickets</span>
          </div>
        </div>

        {/* KPI 2: Net Profit & Operating Margin */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Utilidad Neta Est.</span>
            <div className="w-9 h-9 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
            ${netProfit.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Margen Neto: <strong className="text-emerald-700 font-bold">{netMarginPercent.toFixed(1)}%</strong></span>
            <span className="text-rose-600 font-bold">Gastos: ${totalExpensesSum.toFixed(0)}</span>
          </div>
        </div>

        {/* KPI 3: Device Financing & Down Payments Portfolio */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Cartera Equipos & Enganches</span>
            <div className="w-9 h-9 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-100">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950 font-mono tracking-tight">
            ${financingMetrics.totalDownPayment.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Enganches ({financingMetrics.deviceSalesCount} eq.)</span>
            <span className="text-indigo-800 font-bold">Saldo: ${financingMetrics.totalRemainingBalance.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* KPI 4: Operating Expenses & Inventory Valuation */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Gastos & Inventario</span>
            <div className="w-9 h-9 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
            ${inventoryValuation.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Valor Stock Almacén</span>
            <span className="text-rose-600 font-bold">{filteredExpenses.length} Gastos reg.</span>
          </div>
        </div>

      </div>



      {/* ========================================================================= */}
      {/* 4. SECCIÓN CUADRO DE DATOS Y MATRIZ DE RESUMEN (DATA MATRIX TABS) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Header and Sub-tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Cuadro de Datos Consolidado
            </h2>
            <p className="text-xs text-slate-500">Matriz detallada de operaciones, márgenes y rendimiento por categoría</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl border border-slate-300/80 text-xs">
            <button
              onClick={() => setActiveMatrixTab('categories')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                activeMatrixTab === 'categories' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matriz por Categorías
            </button>
            <button
              onClick={() => setActiveMatrixTab('branches')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                activeMatrixTab === 'branches' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rendimiento Sucursales
            </button>
            <button
              onClick={() => setActiveMatrixTab('credit')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                activeMatrixTab === 'credit' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cartera & Financiamiento
            </button>
          </div>
        </div>

        {/* TAB 1: CATEGORY MATRIX */}
        {activeMatrixTab === 'categories' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Categoría de Sistema</th>
                  <th className="p-3.5 text-center">Nº Operaciones</th>
                  <th className="p-3.5 text-right">Recaudación / Enganches ($)</th>
                  <th className="p-3.5 text-right">Saldo Financiado ($)</th>
                  <th className="p-3.5 text-right">Total Acumulado ($)</th>
                  <th className="p-3.5 text-right">% Aporte al Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryBreakdown.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[row.key] || '#64748b' }}></span>
                      {row.name}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      {row.count} ítems
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      ${(row.key === 'equipo' ? row.downPayment : row.value).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-indigo-700">
                      ${row.remainingBalance.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-slate-900 text-xs">
                      ${row.value.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-extrabold text-blue-700">
                      {row.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {categoryBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                      No hay registros de ventas en la matriz para el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: BRANCH PERFORMANCE MATRIX */}
        {activeMatrixTab === 'branches' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Sucursal / Código</th>
                  <th className="p-3.5">Gerente Responsable</th>
                  <th className="p-3.5 text-center">Tickets Hoy</th>
                  <th className="p-3.5 text-right">Ventas Hoy ($)</th>
                  <th className="p-3.5 text-right">Ventas Mes ($)</th>
                  <th className="p-3.5 text-center">Alertas Stock</th>
                  <th className="p-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liveBranchesList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-600" />
                        <div>
                          <span>{b.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">{b.code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700">
                      {b.manager}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                      {b.ticketCount}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      ${b.todaySales.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-blue-900 text-xs">
                      ${b.monthlySales.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      {b.stockAlerts > 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                          ⚠️ {b.stockAlerts} prod.
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-[10px] font-bold">✓ Normal</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black rounded-full text-[10px]">
                        ABIERTA
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: CREDIT & FINANCING MATRIX */}
        {activeMatrixTab === 'credit' && (
          <div className="overflow-x-auto p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-800">Enganches Recaudados</span>
                <div className="text-xl font-black font-mono">${financingMetrics.totalDownPayment.toFixed(2)}</div>
                <p className="text-[11px] text-amber-800 font-medium">Flujo inmediato ingresado a caja por venta de equipos</p>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 text-indigo-950 space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-800">Saldo Financiado Pendiente</span>
                <div className="text-xl font-black font-mono">${financingMetrics.totalRemainingBalance.toFixed(2)}</div>
                <p className="text-[11px] text-indigo-800 font-medium">Monto total diferido a liquidar con financieras</p>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Valor Total Equipos</span>
                <div className="text-xl font-black font-mono text-amber-300">${financingMetrics.totalFullPrice.toFixed(2)}</div>
                <p className="text-[11px] text-slate-300 font-medium">{financingMetrics.deviceSalesCount} equipos financiados/vendidos</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 5. HISTORIAL CONSOLIDADO DEL SISTEMA (SYSTEM AUDIT LOG TABLE) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-3">
        
        {/* Header & Search Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3 bg-slate-50/80">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Historial Consolidado de Transacciones y Auditoría
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Bitácora integral de tickets, ventas, equipos financiados, abonos, reparaciones y gastos en tiempo real
              </p>
            </div>

            {/* Search Input Box */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por folio, cliente, IMEI, modelo, cajero..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider mr-1">Filtrar por:</span>
            
            <button
              onClick={() => setHistoryCategoryFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                historyCategoryFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              Todos ({auditHistoryLog.length})
            </button>
            <button
              onClick={() => setHistoryCategoryFilter('equipo')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                historyCategoryFilter === 'equipo' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              📱 Equipos
            </button>
            <button
              onClick={() => setHistoryCategoryFilter('abono')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                historyCategoryFilter === 'abono' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              💳 Abonos
            </button>
            <button
              onClick={() => setHistoryCategoryFilter('reparacion')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                historyCategoryFilter === 'reparacion' ? 'bg-amber-700 text-white shadow-xs' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              🔧 Reparaciones
            </button>
            <button
              onClick={() => setHistoryCategoryFilter('gasto')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                historyCategoryFilter === 'gasto' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              💸 Gastos
            </button>
          </div>

        </div>

        {/* Audit Log Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Folio / Fecha</th>
                <th className="p-3.5">Sucursal & Cajero</th>
                <th className="p-3.5">Tipo / Categoría</th>
                <th className="p-3.5">Detalle / Concepto</th>
                <th className="p-3.5">Cliente / Teléfono / IMEI</th>
                <th className="p-3.5">Método / Financiera</th>
                <th className="p-3.5 text-right">Enganche ($)</th>
                <th className="p-3.5 text-right">Saldo ($)</th>
                <th className="p-3.5 text-right">Total ($)</th>
                <th className="p-3.5 text-center">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditHistoryLog.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/40 transition-colors">
                  
                  {/* Folio & Fecha */}
                  <td className="p-3.5 font-mono text-[11px] whitespace-nowrap">
                    <strong className="text-blue-900 block font-black text-xs">{row.folio}</strong>
                    <span className="text-[10px] text-slate-500">{row.dateFormatted}</span>
                  </td>

                  {/* Sucursal & Cajero */}
                  <td className="p-3.5">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 font-extrabold rounded text-[10px] border border-slate-200 block truncate">
                      {row.branchName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">👤 {row.operatorName}</span>
                  </td>

                  {/* Tipo / Categoría */}
                  <td className="p-3.5 whitespace-nowrap">
                    {row.type === 'equipo' && (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-950 font-black rounded-full text-[10px] border border-amber-300">
                        📱 EQUIPO
                      </span>
                    )}
                    {row.type === 'abono' && (
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-950 font-black rounded-full text-[10px] border border-purple-300">
                        💳 ABONO
                      </span>
                    )}
                    {row.type === 'reparacion' && (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-black rounded-full text-[10px] border border-amber-300">
                        🔧 SERVICIO
                      </span>
                    )}
                    {row.type === 'gasto' && (
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-950 font-black rounded-full text-[10px] border border-rose-300">
                        💸 GASTO
                      </span>
                    )}
                    {row.type === 'venta' && (
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-950 font-black rounded-full text-[10px] border border-blue-300">
                        🛍️ ACCESORIO
                      </span>
                    )}
                    {row.type === 'recarga' && (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-black rounded-full text-[10px] border border-emerald-300">
                        ⚡ RECARGA
                      </span>
                    )}
                  </td>

                  {/* Detalle / Concepto */}
                  <td className="p-3.5">
                    <strong className="text-slate-900 font-bold block text-xs">{row.concept}</strong>
                    {row.deviceModel && <span className="text-[10px] text-slate-500 block">Mod: {row.deviceModel}</span>}
                  </td>

                  {/* Cliente / Phone / IMEI */}
                  <td className="p-3.5">
                    <span className="font-bold text-slate-900 block text-xs">{row.clientName}</span>
                    {row.clientPhone !== 'S/N' && <span className="text-[10px] text-emerald-800 font-bold block">📱 {row.clientPhone}</span>}
                    {row.imei && <span className="text-[10px] font-mono text-slate-500 block">IMEI: {row.imei}</span>}
                  </td>

                  {/* Método / Financiera */}
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-black rounded text-[10px] border border-slate-200">
                      {row.paymentMethod}
                    </span>
                  </td>

                  {/* Enganche ($) */}
                  <td className="p-3.5 text-right font-mono font-extrabold text-emerald-700 text-xs">
                    ${row.downPayment.toFixed(2)}
                  </td>

                  {/* Saldo Financiado ($) */}
                  <td className="p-3.5 text-right font-mono font-black text-xs">
                    {row.remainingBalance > 0 ? (
                      <span className="text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        ${row.remainingBalance.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold">$0.00</span>
                    )}
                  </td>

                  {/* Precio Total ($) */}
                  <td className="p-3.5 text-right font-mono font-black text-slate-900 text-xs">
                    ${row.fullPrice.toFixed(2)}
                  </td>

                  {/* Estatus */}
                  <td className="p-3.5 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-black text-[10px]">
                      {row.status}
                    </span>
                  </td>

                </tr>
              ))}

              {auditHistoryLog.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
                    No se encontraron registros de auditoría que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL AÑADIR SUCURSAL */}
      {/* ========================================================================= */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base">Registrar Nueva Sucursal</h3>
              </div>
              <button 
                onClick={() => setShowAddBranchModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBranch} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la Sucursal
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sucursal Poniente / Plaza Galerías"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código o Identificador Corto
                </label>
                <input
                  type="text"
                  placeholder="Ej. SUC-03"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
                <p className="font-extrabold">Expansión de Red CrediCel</p>
                <p className="text-blue-700 font-medium">Al dar de alta la sucursal, estará disponible de inmediato para el monitoreo y corte de caja.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  Confirmar Alta
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
