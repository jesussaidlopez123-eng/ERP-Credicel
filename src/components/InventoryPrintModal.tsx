import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  X, 
  Building2, 
  Smartphone, 
  Headphones, 
  Package, 
  CheckSquare, 
  DollarSign, 
  FileText, 
  Filter, 
  Search, 
  Calendar, 
  Clock, 
  User, 
  Layers, 
  ShieldCheck, 
  Eye, 
  EyeOff,
  Copy,
  Check,
  Receipt
} from 'lucide-react';
import { Product, Branch, Operator } from '../types';

interface InventoryPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currentBranch?: Branch;
  currentOperator?: Operator;
  allBranches?: Branch[];
}

export default function InventoryPrintModal({
  isOpen,
  onClose,
  products = [],
  currentBranch,
  currentOperator,
  allBranches = [
    { id: 'b-bodega', name: 'Bodega Central' },
    { id: 'b-navojoa', name: 'Navojoa' },
    { id: 'b-huatabampo', name: 'Huatabampo' }
  ]
}: InventoryPrintModalProps) {

  // Filter States
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'equipo' | 'accesorio'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Customization Display Options
  const [showImeis, setShowImeis] = useState<boolean>(true);
  const [showCosts, setShowCosts] = useState<boolean>(true);
  const [showAuditCheckboxes, setShowAuditCheckboxes] = useState<boolean>(true);
  const [hideZeroStock, setHideZeroStock] = useState<boolean>(false);
  const [printFormat, setPrintFormat] = useState<'letter' | 'thermal'>('letter');

  // Copy state
  const [isCopied, setIsCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const getBranchName = (branchId: string): string => {
    const found = allBranches.find(b => b.id === branchId);
    return found ? found.name : branchId;
  };

  // Helper to calculate product stock for a specific branch or all
  const getProductStock = (product: Product, branchId: string): number => {
    if (branchId === 'all') {
      if (product.branchStock) {
        return Object.values(product.branchStock).reduce((sum, val) => sum + (val || 0), 0);
      }
      return product.stock || 0;
    }
    if (product.branchStock && product.branchStock[branchId] !== undefined) {
      return product.branchStock[branchId] || 0;
    }
    return 0;
  };

  // Helper to get IMEIs for a product filtered by branch
  const getProductImeis = (product: Product, branchId: string): { imei: string; branchId?: string }[] => {
    const list: { imei: string; branchId?: string }[] = [];

    if (product.branchImeiMap) {
      Object.entries(product.branchImeiMap).forEach(([bId, imeis]) => {
        if (branchId === 'all' || branchId === bId) {
          if (Array.isArray(imeis)) {
            imeis.forEach(im => {
              if (im && im.trim()) {
                list.push({ imei: im.trim(), branchId: bId });
              }
            });
          }
        }
      });
    } else if (branchId === 'all') {
      const imeis = product.imeiList && product.imeiList.length > 0
        ? product.imeiList
        : (product.imei ? [product.imei] : []);
      imeis.forEach(im => {
        if (im && im.trim()) list.push({ imei: im.trim() });
      });
    }

    return list;
  };

  // Filter products based on selected parameters
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Category filter
      const isEquip = prod.inventoryType === 'equipo' || prod.category === 'equipo_credito';
      if (selectedCategory === 'equipo' && !isEquip) return false;
      if (selectedCategory === 'accesorio' && isEquip) return false;

      // Stock check if hiding zeroes
      const stock = getProductStock(prod, selectedBranchId);
      if (hideZeroStock && stock <= 0) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = (prod.code || '').toLowerCase().includes(q);
        const matchesName = (prod.name || '').toLowerCase().includes(q);
        const matchesCategory = (prod.category || '').toLowerCase().includes(q);
        const matchesImeis = (prod.imeiList || []).some(im => im.toLowerCase().includes(q)) || 
                             (prod.imei || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesCategory && !matchesImeis) {
          return false;
        }
      }

      return true;
    });
  }, [products, selectedBranchId, selectedCategory, hideZeroStock, searchQuery]);

  // Separate into Cell Phones and Accessories
  const phoneProducts = useMemo(() => {
    return filteredProducts.filter(p => p.inventoryType === 'equipo' || p.category === 'equipo_credito');
  }, [filteredProducts]);

  const accessoryProducts = useMemo(() => {
    return filteredProducts.filter(p => !(p.inventoryType === 'equipo' || p.category === 'equipo_credito'));
  }, [filteredProducts]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalItems = filteredProducts.length;
    let totalUnits = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;
    let totalPhoneUnits = 0;
    let totalAccessoryUnits = 0;

    filteredProducts.forEach(prod => {
      const stock = getProductStock(prod, selectedBranchId);
      const cost = prod.costPrice || 0;
      const price = prod.price || 0;
      const isEquip = prod.inventoryType === 'equipo' || prod.category === 'equipo_credito';

      totalUnits += stock;
      if (isEquip) {
        totalPhoneUnits += stock;
      } else {
        totalAccessoryUnits += stock;
      }
      totalCostValue += stock * cost;
      totalSaleValue += stock * price;
    });

    const potentialProfit = totalSaleValue - totalCostValue;
    const profitMarginPercent = totalCostValue > 0 ? (potentialProfit / totalCostValue) * 100 : 0;

    return {
      totalItems,
      totalUnits,
      totalPhoneUnits,
      totalAccessoryUnits,
      totalCostValue,
      totalSaleValue,
      potentialProfit,
      profitMarginPercent
    };
  }, [filteredProducts, selectedBranchId]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyTextReport = () => {
    let text = `====================================================\n`;
    text += `   REPORTE DE INVENTARIO FÍSICO Y VALUACIÓN\n`;
    text += `====================================================\n`;
    text += `Sucursal: ${selectedBranchId === 'all' ? 'Todas las Sucursales' : getBranchName(selectedBranchId)}\n`;
    text += `Fecha: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}\n`;
    text += `Generado por: ${currentOperator?.name || 'Administrador'}\n`;
    text += `Total Modelos: ${summaryMetrics.totalItems} | Total Unidades: ${summaryMetrics.totalUnits} pzs\n`;
    if (showCosts) {
      text += `Valuación al Costo: $${summaryMetrics.totalCostValue.toFixed(2)} MXN\n`;
      text += `Valuación a la Venta: $${summaryMetrics.totalSaleValue.toFixed(2)} MXN\n`;
    }
    text += `----------------------------------------------------\n\n`;

    if (phoneProducts.length > 0) {
      text += `--- EQUIPOS CELULARES (${phoneProducts.length} modelos) ---\n`;
      phoneProducts.forEach(p => {
        const stock = getProductStock(p, selectedBranchId);
        text += `[${p.code}] ${p.name} - Stock: ${stock} pzs - Precio: $${p.price.toFixed(2)}\n`;
        if (showImeis) {
          const imeis = getProductImeis(p, selectedBranchId);
          if (imeis.length > 0) {
            text += `   IMEIs (${imeis.length}): ${imeis.map(i => i.imei).join(', ')}\n`;
          }
        }
      });
      text += `\n`;
    }

    if (accessoryProducts.length > 0) {
      text += `--- ACCESORIOS Y PRODUCTOS (${accessoryProducts.length} modelos) ---\n`;
      accessoryProducts.forEach(p => {
        const stock = getProductStock(p, selectedBranchId);
        text += `[${p.code}] ${p.name} - Stock: ${stock} pzs - Precio: $${p.price.toFixed(2)}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const currentDateFormatted = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const currentTimeFormatted = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      
      {/* Dynamic Print CSS for flawless Letter/A4 and Thermal Output */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-inventory-container, #printable-inventory-container * {
            visibility: visible;
          }
          #printable-inventory-container {
            position: absolute;
            left: 0;
            top: 0;
            width: ${printFormat === 'thermal' ? '80mm' : '100%'};
            margin: 0;
            padding: ${printFormat === 'thermal' ? '3mm' : '8mm'};
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            font-size: ${printFormat === 'thermal' ? '10px' : '11px'} !important;
          }
          .no-print {
            display: none !important;
          }
          .print-break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          @page {
            size: ${printFormat === 'thermal' ? '80mm auto' : 'letter portrait'};
            margin: 8mm;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* MODAL HEADER - NO PRINT */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white">
                  Reporte Imprimible de Inventario y Auditoría
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  {summaryMetrics.totalUnits} Unidades
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Genera hojas de arqueo físico, conteo de stock y valuación con desglose de IMEIs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTextReport}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Copiar texto resumen al portapapeles"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
              <span>{isCopied ? '¡Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Imprimir Reporte (PDF)</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FILTERS & CUSTOMIZATION CONTROLS TOOLBAR - NO PRINT */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 no-print space-y-3">
          
          {/* Main Filter Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Branch Selector */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Sucursal a Reportar
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="all">🏢 Todas las Sucursales (Consolidado)</option>
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    📍 {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                Tipo de Inventario
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 focus:outline-none cursor-pointer"
              >
                <option value="all">📱🎧 Todo el Inventario (Equipos y Accesorios)</option>
                <option value="equipo">📱 Solo Equipos Celulares</option>
                <option value="accesorio">🎧 Solo Accesorios y Refacciones</option>
              </select>
            </div>

            {/* Quick Search */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                Buscar Modelo, Código o IMEI
              </label>
              <input
                type="text"
                placeholder="Filtrar por texto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

          </div>

          {/* Toggle Switches for Report Layout */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
            
            <div className="flex flex-wrap items-center gap-4 font-bold text-slate-700">
              
              {/* Desglosar IMEIs */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showImeis}
                  onChange={(e) => setShowImeis(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  Desglosar Lista de IMEIs
                </span>
              </label>

              {/* Mostrar Costos y Márgenes */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCosts}
                  onChange={(e) => setShowCosts(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Mostrar Precios de Costo y Margen
                </span>
              </label>

              {/* Casillas de Conteo Físico */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAuditCheckboxes}
                  onChange={(e) => setShowAuditCheckboxes(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                  Casillas para Conteo Físico
                </span>
              </label>

              {/* Ocultar Stock en Cero */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideZeroStock}
                  onChange={(e) => setHideZeroStock(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>Ocultar agotados (Stock 0)</span>
              </label>

            </div>

            {/* Print Format Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-500">Formato:</span>
              <div className="bg-slate-200 p-0.5 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPrintFormat('letter')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    printFormat === 'letter' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Hoja Carta / A4
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('thermal')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    printFormat === 'thermal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 inline mr-1" />
                  Ticket 80mm
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* PRINTABLE PREVIEW SHEET AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70">
          
          <div 
            id="printable-inventory-container"
            className="bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-200 max-w-4xl mx-auto text-slate-900 space-y-6"
          >
            
            {/* 1. DOCUMENT HEADER */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                
                {/* Brand / Company Title */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-900 text-white font-black text-xs rounded-md uppercase tracking-wider">
                      SISTEMA ERP POS
                    </span>
                    <span className="text-xs font-bold text-slate-500">CONTROL MULTI-SUCURSAL</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1">
                    REPORTE GENERAL DE INVENTARIO Y ARQUEO FÍSICO
                  </h1>
                  <p className="text-xs font-bold text-slate-600">
                    Sucursal: <strong className="text-slate-900 underline">{selectedBranchId === 'all' ? 'Todas las Sucursales (Consolidado)' : getBranchName(selectedBranchId)}</strong>
                  </p>
                </div>

                {/* Date & User Meta */}
                <div className="sm:text-right text-xs text-slate-600 space-y-0.5 bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
                  <div className="flex sm:justify-end items-center gap-1 font-extrabold text-slate-900">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>{currentDateFormatted}</span>
                  </div>
                  <div className="flex sm:justify-end items-center gap-1 font-mono font-bold text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{currentTimeFormatted}</span>
                  </div>
                  <div className="flex sm:justify-end items-center gap-1 text-[11px] text-slate-600 font-semibold">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Emitido por: <strong>{currentOperator?.name || 'Administrador'}</strong></span>
                  </div>
                </div>

              </div>
            </div>

            {/* 2. EXECUTIVE VALUATION & STOCK KPI SUMMARY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs print-break-inside-avoid">
              
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Modelos / SKUs</span>
                <span className="text-base font-black text-slate-900 font-mono block">
                  {summaryMetrics.totalItems} productos
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {phoneProducts.length} equipos • {accessoryProducts.length} acc.
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">Piezas Físicas (Stock)</span>
                <span className="text-base font-black text-blue-950 font-mono block">
                  {summaryMetrics.totalUnits} piezas
                </span>
                <span className="text-[10px] text-blue-700 font-semibold">
                  {summaryMetrics.totalPhoneUnits} celulares • {summaryMetrics.totalAccessoryUnits} accesorios
                </span>
              </div>

              {showCosts && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Valuación al Costo</span>
                  <span className="text-base font-black text-slate-950 font-mono block">
                    ${summaryMetrics.totalCostValue.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">Inversión en almacén</span>
                </div>
              )}

              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">Valuación Venta</span>
                <span className="text-base font-black text-emerald-900 font-mono block">
                  ${summaryMetrics.totalSaleValue.toFixed(2)}
                </span>
                {showCosts && (
                  <span className="text-[10px] text-emerald-700 font-bold">
                    Margen: +${summaryMetrics.potentialProfit.toFixed(2)} ({summaryMetrics.profitMarginPercent.toFixed(0)}%)
                  </span>
                )}
              </div>

            </div>

            {/* 3. SECTION 1: EQUIPOS CELULARES (CON DESGLOSE DE IMEIs) */}
            {(selectedCategory === 'all' || selectedCategory === 'equipo') && (
              <div className="space-y-3 print-break-inside-avoid">
                
                <div className="flex items-center justify-between bg-blue-950 text-white px-3.5 py-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-300" />
                    <h2 className="text-xs font-black uppercase tracking-wider">
                      1. EQUIPOS CELULARES ({phoneProducts.length} modelos / {summaryMetrics.totalPhoneUnits} piezas)
                    </h2>
                  </div>
                  <span className="text-[10px] font-extrabold text-blue-200">
                    Trazabilidad por IMEI 100% Único
                  </span>
                </div>

                {phoneProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                    No hay equipos celulares que coincidan con los filtros seleccionados.
                  </div>
                ) : (
                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-300 text-[11px]">
                          <th className="p-2.5 w-24">Código</th>
                          <th className="p-2.5">Modelo / Equipo</th>
                          <th className="p-2.5 text-center w-24">Stock Total</th>
                          {selectedBranchId === 'all' && (
                            <th className="p-2.5 text-center w-36">Por Sucursal</th>
                          )}
                          {showCosts && (
                            <th className="p-2.5 text-right w-24">Costo Unit.</th>
                          )}
                          <th className="p-2.5 text-right w-24">Precio Venta</th>
                          <th className="p-2.5 text-right w-28">Valuación</th>
                          {showAuditCheckboxes && (
                            <th className="p-2.5 text-center w-20">Físico [✓]</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {phoneProducts.map((prod, idx) => {
                          const stock = getProductStock(prod, selectedBranchId);
                          const imeis = getProductImeis(prod, selectedBranchId);
                          const cost = prod.costPrice || 0;
                          const price = prod.price || 0;
                          const totalVal = showCosts ? stock * cost : stock * price;

                          return (
                            <React.Fragment key={prod.id || idx}>
                              <tr className={`hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                
                                <td className="p-2.5 font-mono font-black text-blue-900 align-top">
                                  {prod.code}
                                </td>

                                <td className="p-2.5 align-top">
                                  <div className="font-extrabold text-slate-900">{prod.name}</div>
                                  {prod.supplier && (
                                    <div className="text-[10px] text-slate-500 font-medium">Prov: {prod.supplier}</div>
                                  )}
                                </td>

                                <td className="p-2.5 text-center font-mono font-black text-slate-900 align-top">
                                  <span className={`px-2 py-0.5 rounded-md ${stock > 0 ? 'bg-blue-100 text-blue-900' : 'bg-rose-100 text-rose-900'}`}>
                                    {stock} pzs
                                  </span>
                                </td>

                                {selectedBranchId === 'all' && (
                                  <td className="p-2.5 text-[10px] text-slate-700 align-top">
                                    <div className="space-y-0.5">
                                      {allBranches.map(b => {
                                        const bStock = prod.branchStock?.[b.id] || 0;
                                        if (bStock <= 0) return null;
                                        return (
                                          <div key={b.id} className="flex justify-between font-mono">
                                            <span className="text-slate-500">{b.name}:</span>
                                            <strong className="text-slate-900">{bStock}</strong>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                )}

                                {showCosts && (
                                  <td className="p-2.5 text-right font-mono text-slate-700 align-top">
                                    ${cost.toFixed(2)}
                                  </td>
                                )}

                                <td className="p-2.5 text-right font-mono font-bold text-slate-900 align-top">
                                  ${price.toFixed(2)}
                                </td>

                                <td className="p-2.5 text-right font-mono font-black text-slate-950 align-top">
                                  ${totalVal.toFixed(2)}
                                </td>

                                {showAuditCheckboxes && (
                                  <td className="p-2.5 text-center align-top">
                                    <div className="w-6 h-6 border-2 border-slate-400 rounded-md mx-auto inline-block bg-white"></div>
                                  </td>
                                )}

                              </tr>

                              {/* IMEIS BREAKDOWN ROW */}
                              {showImeis && imeis.length > 0 && (
                                <tr className="bg-blue-50/40 border-b border-slate-200">
                                  <td colSpan={selectedBranchId === 'all' ? (showCosts ? 8 : 7) : (showCosts ? 7 : 6)} className="p-2 pl-6">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-900">
                                        <Smartphone className="w-3 h-3 text-blue-700" />
                                        <span>IMEIs Registrados ({imeis.length}):</span>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 text-[10px] font-mono">
                                        {imeis.map((imObj, iIdx) => (
                                          <div 
                                            key={iIdx} 
                                            className="p-1 bg-white border border-blue-200 rounded-md flex items-center justify-between text-slate-800 shadow-2xs"
                                          >
                                            <span className="font-extrabold text-blue-950">#{iIdx + 1}: {imObj.imei}</span>
                                            {imObj.branchId && (
                                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-sans font-bold">
                                                {getBranchName(imObj.branchId)}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            )}

            {/* 4. SECTION 2: ACCESORIOS Y PRODUCTOS GENERALES */}
            {(selectedCategory === 'all' || selectedCategory === 'accesorio') && (
              <div className="space-y-3 print-break-inside-avoid">
                
                <div className="flex items-center justify-between bg-slate-900 text-white px-3.5 py-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-xs font-black uppercase tracking-wider">
                      2. ACCESORIOS Y REFACCIONES ({accessoryProducts.length} productos / {summaryMetrics.totalAccessoryUnits} piezas)
                    </h2>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-300">
                    Control por Código Interno / Barras
                  </span>
                </div>

                {accessoryProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                    No hay accesorios que coincidan con los filtros seleccionados.
                  </div>
                ) : (
                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-300 text-[11px]">
                          <th className="p-2.5 w-24">Código</th>
                          <th className="p-2.5">Producto / Descripción</th>
                          <th className="p-2.5 text-center w-24">Stock Total</th>
                          {selectedBranchId === 'all' && (
                            <th className="p-2.5 text-center w-36">Por Sucursal</th>
                          )}
                          {showCosts && (
                            <th className="p-2.5 text-right w-24">Costo Unit.</th>
                          )}
                          <th className="p-2.5 text-right w-24">Precio Venta</th>
                          <th className="p-2.5 text-right w-28">Valuación</th>
                          {showAuditCheckboxes && (
                            <th className="p-2.5 text-center w-20">Físico [✓]</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {accessoryProducts.map((prod, idx) => {
                          const stock = getProductStock(prod, selectedBranchId);
                          const cost = prod.costPrice || 0;
                          const price = prod.price || 0;
                          const totalVal = showCosts ? stock * cost : stock * price;

                          return (
                            <tr key={prod.id || idx} className={`hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                              
                              <td className="p-2.5 font-mono font-black text-slate-900 align-top">
                                {prod.code}
                              </td>

                              <td className="p-2.5 align-top">
                                <div className="font-extrabold text-slate-900">{prod.name}</div>
                                <div className="text-[10px] text-slate-500 capitalize">{prod.category}</div>
                              </td>

                              <td className="p-2.5 text-center font-mono font-black text-slate-900 align-top">
                                <span className={`px-2 py-0.5 rounded-md ${stock > 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                                  {stock} pzs
                                </span>
                              </td>

                              {selectedBranchId === 'all' && (
                                <td className="p-2.5 text-[10px] text-slate-700 align-top">
                                  <div className="space-y-0.5">
                                    {allBranches.map(b => {
                                      const bStock = prod.branchStock?.[b.id] || 0;
                                      if (bStock <= 0) return null;
                                      return (
                                        <div key={b.id} className="flex justify-between font-mono">
                                          <span className="text-slate-500">{b.name}:</span>
                                          <strong className="text-slate-900">{bStock}</strong>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              )}

                              {showCosts && (
                                <td className="p-2.5 text-right font-mono text-slate-700 align-top">
                                  ${cost.toFixed(2)}
                                </td>
                              )}

                              <td className="p-2.5 text-right font-mono font-bold text-slate-900 align-top">
                                  ${price.toFixed(2)}
                              </td>

                              <td className="p-2.5 text-right font-mono font-black text-slate-950 align-top">
                                ${totalVal.toFixed(2)}
                              </td>

                              {showAuditCheckboxes && (
                                <td className="p-2.5 text-center align-top">
                                  <div className="w-6 h-6 border-2 border-slate-400 rounded-md mx-auto inline-block bg-white"></div>
                                </td>
                              )}

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            )}

            {/* 5. AUDIT SIGNATURES FOOTER */}
            <div className="pt-8 border-t-2 border-slate-300 print-break-inside-avoid space-y-6">
              
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                
                <div className="space-y-2">
                  <div className="border-b-2 border-slate-900 pb-8"></div>
                  <p className="font-black text-slate-900">Encargado de Sucursal</p>
                  <p className="text-[10px] text-slate-500">Nombre y Firma</p>
                </div>

                <div className="space-y-2">
                  <div className="border-b-2 border-slate-900 pb-8"></div>
                  <p className="font-black text-slate-900">Auditor de Inventario</p>
                  <p className="text-[10px] text-slate-500">{currentOperator?.name || 'Administrador'}</p>
                </div>

                <div className="space-y-2">
                  <div className="border-b-2 border-slate-900 pb-8"></div>
                  <p className="font-black text-slate-900">Dirección General</p>
                  <p className="text-[10px] text-slate-500">Sello y Autorización</p>
                </div>

              </div>

              <div className="text-center text-[10px] text-slate-500 font-medium">
                Documento de control interno generado electrónicamente. Prohibida su alteración. Sistema ERP POS.
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
