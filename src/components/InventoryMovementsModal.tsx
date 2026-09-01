import React, { useState, useMemo } from 'react';
import { 
  History, X, Search, Filter, ArrowRightLeft, PlusCircle, 
  MinusCircle, DollarSign, Calendar, Clock, Download, 
  FileSpreadsheet, RefreshCw, Smartphone, Headphones, 
  Store, User, ShieldAlert, CheckCircle2, Info, AlertTriangle, Printer
} from 'lucide-react';
import { InventoryMovement, InventoryMovementType, Branch } from '../types';
import LoadMoreButton from './LoadMoreButton';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface InventoryMovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  movements?: InventoryMovement[];
  currentBranch?: Branch;
  branches?: Branch[];
  onLoadOlder?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export const InventoryMovementsModal: React.FC<InventoryMovementsModalProps> = ({
  isOpen,
  onClose,
  movements = [],
  currentBranch,
  branches = [],
  onLoadOlder,
  hasMore = false,
  loadingMore = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 160);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'15d' | '7d' | '3d' | 'today'>('15d');

  // Safe branches list
  const safeBranches: Branch[] = Array.isArray(branches) ? branches : [];

  // Format date helper with robust fallback
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Reciente';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeStr = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (isToday) {
        return `Hoy, ${timeStr}`;
      }
      if (isYesterday) {
        return `Ayer, ${timeStr}`;
      }

      return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} • ${timeStr}`;
    } catch {
      return String(isoString || 'Reciente');
    }
  };

  // Filtered movements based on all criteria within the 15-day range
  const filteredMovements = useMemo(() => {
    try {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      let maxAgeMs = 15 * dayMs;
      if (timeRange === 'today') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        maxAgeMs = now - startOfToday.getTime();
      } else if (timeRange === '3d') {
        maxAgeMs = 3 * dayMs;
      } else if (timeRange === '7d') {
        maxAgeMs = 7 * dayMs;
      }

      const cutoff = now - maxAgeMs;
      const rawList = Array.isArray(movements) ? movements : [];

      return rawList.filter((m) => {
        if (!m || typeof m !== 'object') return false;

        const mTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
        if (!isNaN(mTime) && mTime > 0 && mTime < cutoff) {
          return false;
        }

        // Filter by Branch
        if (selectedBranchId !== 'all') {
          const matchesTarget = m.targetBranchId === selectedBranchId;
          const matchesSource = m.sourceBranchId === selectedBranchId;
          if (!matchesTarget && !matchesSource) return false;
        }

        // Filter by Type
        if (selectedType !== 'all') {
          if (selectedType === 'ingreso' && m.type !== 'ingreso' && m.type !== 'creacion') return false;
          if (selectedType === 'traspaso' && m.type !== 'traspaso') return false;
          if (selectedType === 'ajuste' && m.type !== 'ajuste' && m.type !== 'baja') return false;
          if (selectedType === 'venta' && m.type !== 'venta') return false;
          if (selectedType === 'precio' && m.type !== 'precio') return false;
        }

        // Filter by Search Query
        if (debouncedSearch && debouncedSearch.trim()) {
          const q = debouncedSearch.toLowerCase().trim();
          const matchesName = String(m.productName || '').toLowerCase().includes(q);
          const matchesCode = String(m.productCode || '').toLowerCase().includes(q);
          const matchesOp = String(m.operatorName || '').toLowerCase().includes(q);
          const matchesDetails = String(m.details || '').toLowerCase().includes(q);
          const matchesReason = String(m.reason || '').toLowerCase().includes(q);
          const matchesImei = Array.isArray(m.imeis) && m.imeis.some((im) => String(im || '').toLowerCase().includes(q));

          if (!matchesName && !matchesCode && !matchesOp && !matchesDetails && !matchesReason && !matchesImei) {
            return false;
          }
        }

        return true;
      });
    } catch (err) {
      console.error('[InventoryMovementsModal] Filter calculation error:', err);
      return [];
    }
  }, [movements, selectedBranchId, selectedType, timeRange, debouncedSearch]);

  // Statistics for summary banner
  const stats = useMemo(() => {
    let totalIngresosQty = 0;
    let totalVentasQty = 0;
    let totalTraspasosCount = 0;
    let totalAjustesCount = 0;

    filteredMovements.forEach((m) => {
      if (!m) return;
      const q = Math.abs(Number(m.quantity) || 0);
      if (m.type === 'ingreso' || m.type === 'creacion') {
        totalIngresosQty += q;
      } else if (m.type === 'venta') {
        totalVentasQty += q;
      } else if (m.type === 'traspaso') {
        totalTraspasosCount++;
      } else if (m.type === 'ajuste' || m.type === 'baja') {
        totalAjustesCount++;
      }
    });

    return {
      totalIngresosQty,
      totalVentasQty,
      totalTraspasosCount,
      totalAjustesCount,
      totalCount: filteredMovements.length
    };
  }, [filteredMovements]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      alert('No hay movimientos para exportar con los filtros seleccionados.');
      return;
    }

    try {
      const headers = ['ID', 'Fecha y Hora', 'Tipo', 'Código', 'Producto', 'Categoría', 'Cantidad', 'Origen', 'Destino', 'Operador', 'Detalle', 'IMEIs'];
      const rows = filteredMovements.map((m) => [
        String(m.id || ''),
        m.timestamp ? new Date(m.timestamp).toLocaleString('es-MX') : '',
        String(m.type || ''),
        String(m.productCode || ''),
        `"${String(m.productName || '').replace(/"/g, '""')}"`,
        String(m.inventoryType || m.category || ''),
        Number(m.quantity) || 0,
        String(m.sourceBranchName || m.sourceBranchId || ''),
        String(m.targetBranchName || m.targetBranchId || ''),
        `"${String(m.operatorName || '').replace(/"/g, '""')}"`,
        `"${String(m.details || '').replace(/"/g, '""')}"`,
        Array.isArray(m.imeis) ? `"${m.imeis.join('; ')}"` : ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Historial_Movimientos_Inventario_15Dias_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (csvErr) {
      console.error('Error generating CSV:', csvErr);
      alert('Ocurrió un error al generar el archivo CSV.');
    }
  };

  // Movement badge styler
  const renderTypeBadge = (type: InventoryMovementType | string) => {
    switch (type) {
      case 'ingreso':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
            Ingreso
          </span>
        );
      case 'creacion':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-teal-100 text-teal-800 border border-teal-300">
            <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
            Nuevo Producto
          </span>
        );
      case 'traspaso':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
            Traspaso
          </span>
        );
      case 'ajuste':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Ajuste / Merma
          </span>
        );
      case 'venta':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
            <MinusCircle className="w-3.5 h-3.5 text-purple-600" />
            Venta POS
          </span>
        );
      case 'precio':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
            Cambio Precio
          </span>
        );
      case 'baja':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
            <X className="w-3.5 h-3.5 text-rose-600" />
            Baja / Eliminado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
            {type}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-400/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Historial de Movimientos de Inventario
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-indigo-400/20 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-300/30">
                  <Clock className="w-3 h-3 text-indigo-300" /> Últimos 15 Días
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Auditoría cronológica de ingresos, traspasos, ajustes, ventas y cambios de precio con auto-borrado a los 15 días.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-xl border border-white/20 transition-all cursor-pointer"
              title="Descargar historial filtrado en Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Exportar CSV
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTA DE AUTO-DEPURACIÓN */}
        <div className="bg-amber-500/10 border-b border-amber-200/60 px-4 py-2 flex items-center justify-between text-xs text-amber-900 font-semibold gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Política de Retención:</strong> Los movimientos se conservan durante los últimos 15 días continuos y se depuran de forma 100% automática para mantener el sistema ligero y rápido.
            </span>
          </div>
          <span className="text-[11px] font-black bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-md shrink-0">
            {filteredMovements.length} registro(s) activo(s)
          </span>
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-white border-b border-slate-200 shrink-0">
          
          <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-emerald-800 font-extrabold uppercase tracking-wide">Entradas / Ingresos</p>
              <p className="text-xl font-black text-emerald-950">+{stats.totalIngresosQty} <span className="text-xs font-semibold text-emerald-700">pzs</span></p>
            </div>
          </div>

          <div className="p-3 bg-purple-50/80 rounded-2xl border border-purple-200/80 flex items-center gap-3">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
              <MinusCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-purple-800 font-extrabold uppercase tracking-wide">Salidas / Ventas</p>
              <p className="text-xl font-black text-purple-950">-{stats.totalVentasQty} <span className="text-xs font-semibold text-purple-700">pzs</span></p>
            </div>
          </div>

          <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200/80 flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-blue-800 font-extrabold uppercase tracking-wide">Traspasos Entre Suc.</p>
              <p className="text-xl font-black text-blue-950">{stats.totalTraspasosCount} <span className="text-xs font-semibold text-blue-700">movs</span></p>
            </div>
          </div>

          <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 flex items-center gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-xl shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-amber-800 font-extrabold uppercase tracking-wide">Ajustes & Mermas</p>
              <p className="text-xl font-black text-amber-950">{stats.totalAjustesCount} <span className="text-xs font-semibold text-amber-700">movs</span></p>
            </div>
          </div>

        </div>

        {/* FILTERS TOOLBAR */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por producto, código, operador, IMEI o motivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            {/* Branch Selector */}
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
            >
              <option value="all">🏢 Todas las Sucursales</option>
              {safeBranches.map((b) => (
                <option key={b?.id || Math.random()} value={b?.id || ''}>
                  {b?.name || b?.id || 'Sucursal'}
                </option>
              ))}
            </select>

            {/* Type Selector */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
            >
              <option value="all">🏷️ Todos los Tipos</option>
              <option value="ingreso">📥 Ingresos y Nuevos</option>
              <option value="traspaso">🔄 Traspasos</option>
              <option value="ajuste">⚖️ Ajustes & Mermas</option>
              <option value="venta">🛒 Ventas POS</option>
              <option value="precio">💲 Cambios de Precio</option>
            </select>

          </div>

          {/* Time Range Pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-xs">
            <button
              onClick={() => setTimeRange('15d')}
              className={`px-2.5 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                timeRange === '15d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              15 Días
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                timeRange === '7d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setTimeRange('3d')}
              className={`px-2.5 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                timeRange === '3d' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3 Días
            </button>
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2.5 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                timeRange === 'today' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoy
            </button>
          </div>

        </div>

        {/* LIST / TABLE BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredMovements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <History className="w-7 h-7 text-slate-500" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm">No hay movimientos registrados en este rango</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                Cualquier ingreso, venta en caja, traspaso o ajuste de inventario realizado en los últimos 15 días se reflejará automáticamente aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredMovements.map((mov, index) => {
                if (!mov) return null;
                const movIdKey = mov.id || `mov-${index}`;
                const qtyNum = Number(mov.quantity) || 0;
                const isPositive = qtyNum > 0;
                const isNegative = qtyNum < 0;

                return (
                  <div
                    key={movIdKey}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                  >
                    {/* Left: Type, Timestamp, Product & Details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        {renderTypeBadge(mov.type || 'ingreso')}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-xs text-slate-900">
                            {mov.productName || 'Artículo'}
                          </span>
                          {mov.productCode && (
                            <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                              {mov.productCode}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDate(mov.timestamp)}
                          </span>
                        </div>

                        {/* Details and Reason */}
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {mov.details || 'Movimiento de inventario'}
                        </p>

                        {/* IMEIs Breakdown if applicable */}
                        {Array.isArray(mov.imeis) && mov.imeis.length > 0 && (
                          <div className="pt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500">IMEI(s):</span>
                            {mov.imeis.map((im, idx) => (
                              <span
                                key={idx}
                                className="font-mono text-[10px] font-black bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200"
                              >
                                📱 {String(im)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Quantity variation & Branches info */}
                    <div className="flex items-center gap-4 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                      
                      {/* Branches / Location Badge */}
                      <div className="text-right text-[11px]">
                        {mov.type === 'traspaso' ? (
                          <div className="flex items-center gap-1 text-slate-700 font-bold">
                            <span className="text-slate-500">{mov.sourceBranchName || mov.sourceBranchId || 'Origen'}</span>
                            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                            <span className="text-blue-700 font-black">{mov.targetBranchName || mov.targetBranchId || 'Destino'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-600 font-bold">
                            <Store className="w-3 h-3 text-slate-400" />
                            <span>{mov.targetBranchName || mov.targetBranchId || 'Bodega Central'}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-medium flex items-center justify-end gap-1">
                          <User className="w-2.5 h-2.5" />
                          <span>{mov.operatorName || 'Admin'}</span>
                        </div>
                      </div>

                      {/* Quantity pill */}
                      {mov.type !== 'precio' && (
                        <div
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center justify-center min-w-[58px] ${
                            isPositive
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : isNegative
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isPositive ? `+${qtyNum}` : `${qtyNum}`} pz
                        </div>
                      )}

                    </div>

                  </div>
                );
              })}
            </div>
          )}
          <LoadMoreButton
            hasMore={hasMore}
            loading={loadingMore}
            onClick={onLoadOlder}
            label="Cargar movimientos anteriores"
          />
        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Sincronizado en tiempo real con la nube (Firestore)</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Descargar Reporte CSV
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
