import React, { useState } from 'react';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
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
  Smartphone
} from 'lucide-react';
import { Branch, Operator, SaleTicket, Expense, Product } from '../types';

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

export default function ExecutiveModule({
  currentBranch,
  currentOperator,
  onOpenNoticeModal,
  salesTickets = [],
  expenses = [],
  products = []
}: ExecutiveModuleProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');

  // Initial branches definition matching official system branches
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

  // Compute live branch statistics from shared salesTickets and products
  const liveBranchesList = branchesList.map((branch) => {
    const branchTickets = salesTickets.filter((t) => t.branchId === branch.id);
    
    // Today's Date String ISO (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    
    const todayTickets = branchTickets.filter((t) => {
      const tDate = new Date(t.timestamp).toISOString().split('T')[0];
      return tDate === todayStr;
    });

    const todaySalesSum = todayTickets.reduce((sum, t) => sum + t.total, 0);
    const monthlySalesSum = branchTickets.reduce((sum, t) => sum + t.total, 0);

    // Stock alerts count for this branch
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

  const totalMonthlySales = liveBranchesList.reduce((sum, b) => sum + b.monthlySales, 0);
  const totalTodaySales = liveBranchesList.reduce((sum, b) => sum + b.todaySales, 0);
  const totalTicketsToday = liveBranchesList.reduce((sum, b) => sum + b.ticketCount, 0);
  const totalActiveJobs = liveBranchesList.reduce((sum, b) => sum + b.activeJobs, 0);

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
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      
      {/* Top Banner & Control Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-600/10 blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">
              <ShieldCheck className="w-4 h-4 text-yellow-400" />
              Módulo de Alta Dirección • CrediCel ERP
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Panel de Dirección General
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Consola ejecutiva de control consolidado para <strong className="text-yellow-400">{liveBranchesList.length} sucursales</strong> activas con monitoreo de ventas, operadores y servicios técnicos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddBranchModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-yellow-500/20"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Añadir Nueva Sucursal
            </button>

            <button
              onClick={onOpenNoticeModal}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
            >
              <Megaphone className="w-4 h-4 text-yellow-300" />
              Directiva General
            </button>
          </div>
        </div>

        {/* Period Selector Bar */}
        <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Período de Análisis:</span>
            <div className="inline-flex bg-slate-950/60 p-1 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setSelectedPeriod('today')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedPeriod === 'today' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedPeriod === 'week' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedPeriod === 'month' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Este Mes
              </button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span>Conexión en línea con {liveBranchesList.length} sucursales</span>
          </div>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ventas Consolidadas</span>
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            ${(selectedPeriod === 'today' ? totalTodaySales : totalMonthlySales).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <ArrowUpRight className="w-4 h-4" />
            <span>+14.8% vs período anterior</span>
          </div>
        </div>

        {/* KPI 2: Operating Margin / Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilidad Neta Est.</span>
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            ${((selectedPeriod === 'today' ? totalTodaySales : totalMonthlySales) * 0.28).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Margen estimado del <strong className="text-slate-800">28.0%</strong>
          </div>
        </div>

        {/* KPI 3: Total Transactions / Tickets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transacciones POS</span>
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {selectedPeriod === 'today' ? totalTicketsToday : Math.round(totalTicketsToday * 18.5)} tickets
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Promedio ticket: <strong className="text-slate-800">$440.00 MXN</strong>
          </div>
        </div>

        {/* KPI 4: Active Technical Services */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Taller & Reparaciones</span>
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {totalActiveJobs} en proceso
          </div>
          <div className="mt-2 text-xs text-amber-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>94% en tiempo estimado</span>
          </div>
        </div>

      </div>

      {/* Branches Console & Performance Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Branches Cards list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Estado de Sucursales Registradas ({liveBranchesList.length})
            </h3>
            <span className="text-xs text-slate-500">
              Monitoreo en tiempo real
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveBranchesList.map((b) => (
              <div 
                key={b.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-slate-900 text-base">{b.name}</h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 mt-0.5 inline-block">{b.code} • Gerente: {b.manager}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    Abierta
                  </span>
                </div>

                <div className="space-y-2.5 my-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Ventas Hoy:</span>
                    <span className="font-bold text-slate-900">${b.todaySales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Ventas del Mes:</span>
                    <span className="font-bold text-blue-700">${b.monthlySales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tickets generados hoy:</span>
                    <span className="font-semibold text-slate-800">{b.ticketCount} tickets</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Equipos en Taller:</span>
                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{b.activeJobs} servicios</span>
                  </div>
                </div>

                {/* Progress bar contribution */}
                <div className="pt-2">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Aporte al total de ventas:</span>
                    <span className="font-bold">{Math.round((b.monthlySales / (totalMonthlySales || 1)) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full" 
                      style={{ width: `${(b.monthlySales / (totalMonthlySales || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Card to Add new branch */}
            <div 
              onClick={() => setShowAddBranchModal(true)}
              className="bg-slate-50 hover:bg-blue-50/50 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors min-h-[240px] group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all mb-3 border border-slate-200">
                <Plus className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600">Añadir Nueva Sucursal</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Registra una sucursal adicional para expandir la red de operaciones CrediCel.
              </p>
            </div>
          </div>
        </div>

        {/* Right Col: Top Operators & Directives */}
        <div className="space-y-6">
          
          {/* Top Operators Ranking */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Rendimiento de Operadores
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center text-xs">
                    1
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Juan Pérez</h5>
                    <span className="text-[10px] text-slate-500">Sucursal Centro • Gerente</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900">$12,450 MXN</div>
                  <span className="text-[10px] text-emerald-600 font-medium">24 tickets</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center text-xs">
                    2
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">María García</h5>
                    <span className="text-[10px] text-slate-500">Sucursal Norte • Cajera</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900">$9,800 MXN</div>
                  <span className="text-[10px] text-emerald-600 font-medium">18 tickets</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center justify-center text-xs">
                    3
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Carlos López</h5>
                    <span className="text-[10px] text-slate-500">Ambas Sucursales • Cajero</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900">$6,200 MXN</div>
                  <span className="text-[10px] text-emerald-600 font-medium">12 tickets</span>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Directives / Quick Notice Widget */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-bold">Comandos de Dirección</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Envía una notificación oficial con instrucciones operativas a la campana de todos los cajeros y administradores.
            </p>

            <button
              onClick={onOpenNoticeModal}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Megaphone className="w-4 h-4 text-yellow-300" />
              Emitir Aviso Institucional
            </button>
          </div>

        </div>

      </div>

      {/* Modal for Adding a New Branch */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-base">Registrar Nueva Sucursal</h3>
              </div>
              <button 
                onClick={() => setShowAddBranchModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBranch} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de la Sucursal
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sucursal Poniente / Plaza Galerías"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código o Identificador Corto
                </label>
                <input
                  type="text"
                  placeholder="Ej. SUC-03"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-1">
                <p className="font-semibold">Expansión de Red CrediCel</p>
                <p className="text-blue-600">Al dar de alta la sucursal, estará disponible de inmediato en la pantalla de inicio de sesión para los operadores.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
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
