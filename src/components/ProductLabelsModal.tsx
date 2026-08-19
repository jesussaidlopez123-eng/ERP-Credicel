import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Tag, 
  Printer, 
  X, 
  Search, 
  Plus, 
  Minus, 
  Check, 
  Square, 
  CheckSquare, 
  SlidersHorizontal, 
  Building2, 
  RotateCcw,
  Sparkles,
  Layers,
  DollarSign,
  Package,
  Smartphone,
  Headphones,
  Eye,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Product, Branch } from '../types';

interface ProductLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currentBranch?: Branch;
  allBranches?: Branch[];
  initialSelectedProduct?: Product | null;
  initialQuantities?: Record<string, number>;
  defaultFormat?: 'sticker_50x30' | 'thermal_58mm' | 'grid_sheet';
}

// Individual SVG Barcode Component
function BarcodeSvgItem({
  value,
  width = 1.3,
  height = 32,
  fontSize = 9,
  displayValue = true,
  className = ''
}: {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: width,
          height: height,
          displayValue: displayValue,
          font: 'monospace',
          fontSize: fontSize,
          textMargin: 1,
          margin: 2,
          background: '#ffffff',
          lineColor: '#000000'
        });
      } catch (e) {
        // Fallback if code cannot be rendered
        console.warn('Barcode render error for:', value, e);
      }
    }
  }, [value, width, height, fontSize, displayValue]);

  return <svg ref={svgRef} className={`mx-auto ${className}`} />;
}

export default function ProductLabelsModal({
  isOpen,
  onClose,
  products = [],
  currentBranch,
  allBranches = [],
  initialSelectedProduct = null,
  initialQuantities = undefined,
  defaultFormat = 'sticker_50x30'
}: ProductLabelsModalProps) {

  // Map of productId -> quantity of labels to print
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({});
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'accesorio' | 'equipo'>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranch?.id || 'all');

  // Label Customization Options (50x30mm as standard default)
  const [printFormat, setPrintFormat] = useState<'thermal_58mm' | 'grid_sheet' | 'sticker_50x30'>(defaultFormat);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [showProductCode, setShowProductCode] = useState<boolean>(true);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [currencyPrefix, setCurrencyPrefix] = useState<string>('$');
  const [customFooterText, setCustomFooterText] = useState<string>('CrediCel');

  // Initialize selected product when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialQuantities && Object.keys(initialQuantities).length > 0) {
        setLabelQuantities({ ...initialQuantities });
      } else if (initialSelectedProduct) {
        setLabelQuantities({ [initialSelectedProduct.id]: 1 });
      } else {
        // If none pre-selected, initialize empty
        setLabelQuantities({});
      }
      if (defaultFormat) {
        setPrintFormat(defaultFormat);
      }
      setSearchQuery('');
    }
  }, [isOpen, initialSelectedProduct?.id, initialQuantities, defaultFormat]);

  // Keyboard shortcut (Escape to close, P to print)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Helper to get stock
  const getProductStock = (product: Product, branchId: string): number => {
    if (!product) return 0;
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

  // Filtered product catalog for selection
  const filteredProducts = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : [];
    return safeProducts.filter(p => {
      if (!p) return false;
      const isEquip = p.inventoryType === 'equipo' || p.category === 'equipo_credito';
      if (categoryFilter === 'equipo' && !isEquip) return false;
      if (categoryFilter === 'accesorio' && isEquip) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = (p.code || '').toLowerCase().includes(q);
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesCat = (p.category || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesCat) return false;
      }

      return true;
    });
  }, [products, categoryFilter, searchQuery]);

  // Array of items to actually generate labels for
  const selectedLabelItems = useMemo(() => {
    const list: { product: Product; qty: number }[] = [];
    Object.entries(labelQuantities).forEach(([prodId, qty]) => {
      if (qty > 0) {
        const prod = products.find(p => p.id === prodId);
        if (prod) {
          list.push({ product: prod, qty });
        }
      }
    });
    return list;
  }, [labelQuantities, products]);

  // Total count of label stickers to be printed
  const totalStickersToPrint = useMemo(() => {
    return Object.values(labelQuantities).reduce((sum, qty) => sum + (qty > 0 ? qty : 0), 0);
  }, [labelQuantities]);

  // Flattened array of individual stickers for rendering
  const flattenedLabels = useMemo(() => {
    const result: { product: Product; stickerIndex: number }[] = [];
    selectedLabelItems.forEach(({ product, qty }) => {
      for (let i = 0; i < qty; i++) {
        result.push({ product, stickerIndex: i + 1 });
      }
    });
    return result;
  }, [selectedLabelItems]);

  if (!isOpen) return null;

  const handleSetQuantity = (prodId: string, qty: number) => {
    setLabelQuantities(prev => {
      const updated = { ...prev };
      if (qty <= 0) {
        delete updated[prodId];
      } else {
        updated[prodId] = qty;
      }
      return updated;
    });
  };

  const handleIncrement = (prodId: string) => {
    const current = labelQuantities[prodId] || 0;
    handleSetQuantity(prodId, current + 1);
  };

  const handleDecrement = (prodId: string) => {
    const current = labelQuantities[prodId] || 0;
    if (current > 1) {
      handleSetQuantity(prodId, current - 1);
    } else {
      handleSetQuantity(prodId, 0);
    }
  };

  const handleSelectAllVisible = (qty: number = 1) => {
    setLabelQuantities(prev => {
      const updated = { ...prev };
      filteredProducts.forEach(p => {
        updated[p.id] = qty;
      });
      return updated;
    });
  };

  const handleSetQuantitiesByStock = () => {
    setLabelQuantities(prev => {
      const updated = { ...prev };
      filteredProducts.forEach(p => {
        const stock = getProductStock(p, selectedBranchId);
        if (stock > 0) {
          updated[p.id] = stock;
        }
      });
      return updated;
    });
  };

  const handleClearAll = () => {
    setLabelQuantities({});
  };

  const handlePrint = () => {
    if (totalStickersToPrint === 0) {
      alert('Selecciona al menos 1 producto con cantidad mayor a 0 para imprimir etiquetas.');
      return;
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      
      {/* Dynamic Print Stylesheet based on chosen format */}
      <style>{`
        @media print {
          @page {
            ${
              printFormat === 'thermal_58mm'
                ? 'size: 58mm auto; margin: 0mm !important;'
                : printFormat === 'sticker_50x30'
                ? 'size: 50mm 30mm; margin: 0mm !important;'
                : 'size: letter portrait; margin: 10mm !important;'
            }
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-labels-container, #print-labels-container * {
            visibility: visible !important;
          }
          #print-labels-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* 1. THERMAL 58mm CONTINUOUS ROLL STYLES */
          .thermal-58mm-wrapper {
            width: 56mm !important;
            max-width: 58mm !important;
            margin: 0 auto !important;
            padding: 1mm 0 6mm 0 !important;
          }
          .thermal-58mm-label {
            width: 54mm !important;
            margin: 0 auto 5mm auto !important;
            padding: 2mm 1.5mm !important;
            border: 1px dashed #000000 !important;
            text-align: center !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }

          /* 2. 50x30mm THERMAL STICKER STYLES */
          .sticker-50x30-wrapper {
            width: 50mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .sticker-50x30-label {
            width: 48mm !important;
            height: 28mm !important;
            margin: 0 auto !important;
            padding: 1mm !important;
            text-align: center !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }

          /* 3. LETTER / A4 GRID STYLES */
          .grid-sheet-wrapper {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4mm !important;
            width: 100% !important;
            padding: 0 !important;
          }
          .grid-sheet-label {
            border: 1px dashed #cccccc !important;
            padding: 2.5mm !important;
            text-align: center !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            border-radius: 4px !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight text-white">
                  Impresión de Etiquetas con Código de Barras
                </h3>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                  Código + Barras + Precio + Nombre
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Selecciona productos, ajusta cantidades y manda a imprimir a tu impresora térmica o en hojas de etiquetas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={totalStickersToPrint === 0}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer ${
                totalStickersToPrint > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
              title="Mandar a imprimir etiquetas (Atajo: P)"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir ({totalStickersToPrint} etiquetas)</span>
            </button>

            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Layout: 2 Columns (Left: Product Selector / Right: Real-time Label Preview & Print Config) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-100/60 no-print">
          
          {/* LEFT PANEL: PRODUCT SELECTOR (Cols 7) */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-white">
            
            {/* Search and Filter Controls */}
            <div className="p-3 border-b border-slate-200 space-y-2.5 bg-slate-50/80">
              <div className="flex items-center gap-2">
                
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre, código o categoría..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Pill Filters */}
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold shrink-0">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      categoryFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setCategoryFilter('accesorio')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      categoryFilter === 'accesorio' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Headphones className="w-3 h-3 text-blue-500" />
                    Accesorios
                  </button>
                  <button
                    onClick={() => setCategoryFilter('equipo')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      categoryFilter === 'equipo' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3 h-3 text-indigo-500" />
                    Equipos
                  </button>
                </div>
              </div>

              {/* Quick Batch Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectAllVisible(1)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 shadow-2xs cursor-pointer text-[11px]"
                    title="Poner 1 etiqueta a todos los productos mostrados"
                  >
                    +1 a todos ({filteredProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleSetQuantitiesByStock}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold rounded-lg border border-blue-200 shadow-2xs cursor-pointer text-[11px]"
                    title="Poner la cantidad de etiquetas igual al stock existente"
                  >
                    = Stock disponible
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">
                    {selectedLabelItems.length} seleccionados ({totalStickersToPrint} etiquetas)
                  </span>
                  {totalStickersToPrint > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-extrabold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Product Table / List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">No se encontraron productos con los filtros aplicados.</p>
                </div>
              ) : (
                filteredProducts.map(product => {
                  const qty = labelQuantities[product.id] || 0;
                  const isSelected = qty > 0;
                  const stock = getProductStock(product, selectedBranchId);
                  const isEquip = product.inventoryType === 'equipo' || product.category === 'equipo_credito';

                  return (
                    <div 
                      key={product.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-400/40 shadow-2xs' 
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Left: Product Info & Code */}
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleSetQuantity(product.id, isSelected ? 0 : 1)}
                          className={`mt-0.5 p-1 rounded-md cursor-pointer transition-colors ${
                            isSelected ? 'text-amber-600' : 'text-slate-300 hover:text-slate-500'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs px-1.5 py-0.2 bg-slate-900 text-white rounded">
                              {product.code || 'S/C'}
                            </span>
                            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                              isEquip ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isEquip ? 'Equipo' : 'Accesorio'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 font-mono">
                              Stock: {stock} pzs
                            </span>
                          </div>

                          <h4 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                            {product.name}
                          </h4>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className="font-black text-emerald-700 font-mono">
                              Precio: ${product.price.toFixed(2)} MXN
                            </span>
                            {product.costPrice !== undefined && product.costPrice > 0 && (
                              <span className="text-slate-400 font-mono text-[10px]">
                                (Costo: ${product.costPrice.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity Spinner */}
                      <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleDecrement(product.id)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black cursor-pointer shadow-2xs transition-colors"
                          title="Restar 1 etiqueta"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          max="999"
                          value={qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            handleSetQuantity(product.id, isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="w-10 text-center font-mono font-black text-xs bg-white border border-slate-300 rounded-md py-0.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />

                        <button
                          type="button"
                          onClick={() => handleIncrement(product.id)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black cursor-pointer shadow-2xs transition-colors"
                          title="Sumar 1 etiqueta"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* RIGHT PANEL: PRINT CONFIGURATION & REAL-TIME PREVIEW (Cols 5) */}
          <div className="lg:col-span-5 flex flex-col h-full overflow-hidden bg-slate-50">
            
            {/* Top Toolbar: Format & Options */}
            <div className="p-3 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                  Formato de Impresión
                </span>
                <span className="text-[11px] font-black text-slate-900 font-mono bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  {totalStickersToPrint} {totalStickersToPrint === 1 ? 'Etiqueta' : 'Etiquetas'}
                </span>
              </div>

              {/* Format selector buttons */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setPrintFormat('thermal_58mm')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    printFormat === 'thermal_58mm'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="leading-tight">Rollo Térmico</div>
                  <div className="text-[9px] opacity-80 mt-0.5">58mm Continuo</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintFormat('sticker_50x30')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    printFormat === 'sticker_50x30'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="leading-tight">Adhesivo Térmico</div>
                  <div className="text-[9px] opacity-80 mt-0.5">50x30mm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintFormat('grid_sheet')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    printFormat === 'grid_sheet'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="leading-tight">Hoja Carta/A4</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Cuadrícula</div>
                </button>
              </div>

              {/* Visual switches / checkboxes */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Nombre Tienda (CrediCel)</span>
                </label>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Mostrar Precio ($)</span>
                </label>
              </div>
            </div>

            {/* Live Preview Container */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center bg-slate-200/70 space-y-3">
              <div className="w-full flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                <span className="flex items-center gap-1 text-[11px]">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  Vista Previa en Tiempo Real ({flattenedLabels.length} pzs):
                </span>
                {totalStickersToPrint > 0 && (
                  <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-extrabold border border-emerald-300">
                    Listo para imprimir
                  </span>
                )}
              </div>

              {flattenedLabels.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <Tag className="w-12 h-12 mx-auto text-slate-400 opacity-60" />
                  <p className="text-xs font-bold">Selecciona productos a la izquierda para ver el diseño de la etiqueta.</p>
                </div>
              ) : (
                <div className="w-full max-w-[320px] space-y-3">
                  {flattenedLabels.slice(0, 10).map((item, idx) => (
                    <div 
                      key={`${item.product.id}_${item.stickerIndex}_${idx}`}
                      className="bg-white p-3 rounded-xl border border-slate-400 shadow-md text-center space-y-1 font-mono select-none"
                    >
                      {showStoreName && (
                        <div className="text-[10px] font-black tracking-wider uppercase text-slate-800 border-b border-dashed border-slate-300 pb-0.5">
                          {customFooterText}
                        </div>
                      )}

                      {/* Product Name */}
                      <div className="font-black text-xs text-black leading-tight line-clamp-2 px-1 font-sans">
                        {item.product.name}
                      </div>

                      {/* Barcode SVG */}
                      <div className="py-0.5 flex justify-center">
                        <BarcodeSvgItem 
                          value={item.product.code || '000000'} 
                          width={1.4} 
                          height={30} 
                          fontSize={9} 
                        />
                      </div>

                      {/* Price in Big Bold Text */}
                      {showPrice && (
                        <div className="text-base font-black text-black tracking-tight border-t border-dashed border-slate-400 pt-1 flex items-center justify-center gap-1">
                          <span className="text-xs font-bold text-slate-700">PRECIO:</span>
                          <span className="text-base font-black">{currencyPrefix} {item.product.price.toFixed(2)} MXN</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {flattenedLabels.length > 10 && (
                    <p className="text-[11px] text-center text-slate-500 font-bold italic">
                      + {flattenedLabels.length - 10} etiquetas más (todas saldrán al imprimir)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Floating Print Button */}
            <div className="p-3 bg-white border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                disabled={totalStickersToPrint === 0}
                className={`w-full py-2.5 rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  totalStickersToPrint > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.01] active:scale-[0.99]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Mandar a Imprimir {totalStickersToPrint} {totalStickersToPrint === 1 ? 'Etiqueta' : 'Etiquetas'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* PRINTABLE CONTAINER (Rendered exclusively for window.print()) */}
        {/* ---------------------------------------------------- */}
        <div id="print-labels-container" className="hidden">
          
          {/* FORMAT 1: CONTINUOUS 58mm THERMAL ROLL */}
          {printFormat === 'thermal_58mm' && (
            <div className="thermal-58mm-wrapper">
              {flattenedLabels.map((item, idx) => (
                <div key={`print_thermal_${item.product.id}_${item.stickerIndex}_${idx}`} className="thermal-58mm-label">
                  {showStoreName && (
                    <div style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '1mm', borderBottom: '1px dashed #000', paddingBottom: '0.5mm' }}>
                      {customFooterText}
                    </div>
                  )}

                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.2', margin: '1mm 0', wordBreak: 'break-word' }}>
                    {item.product.name}
                  </div>

                  <div style={{ margin: '1mm 0' }}>
                    <BarcodeSvgItem 
                      value={item.product.code || '000000'} 
                      width={1.25} 
                      height={26} 
                      fontSize={9} 
                    />
                  </div>

                  {showPrice && (
                    <div style={{ fontSize: '13px', fontWeight: '900', borderTop: '1px dashed #000', paddingTop: '1mm', marginTop: '1mm' }}>
                      PRECIO: {currencyPrefix} {item.product.price.toFixed(2)} MXN
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* FORMAT 2: 50x30mm THERMAL ADHESIVE STICKERS */}
          {printFormat === 'sticker_50x30' && (
            <div className="sticker-50x30-wrapper">
              {flattenedLabels.map((item, idx) => (
                <div key={`print_sticker_${item.product.id}_${item.stickerIndex}_${idx}`} className="sticker-50x30-label">
                  {showStoreName && (
                    <div style={{ fontSize: '8.5px', fontWeight: '900', textTransform: 'uppercase' }}>
                      {customFooterText}
                    </div>
                  )}

                  <div style={{ fontSize: '9px', fontWeight: 'bold', lineHeight: '1.1', maxHeight: '18px', overflow: 'hidden' }}>
                    {item.product.name}
                  </div>

                  <div style={{ margin: '0.5mm 0' }}>
                    <BarcodeSvgItem 
                      value={item.product.code || '000000'} 
                      width={1.1} 
                      height={20} 
                      fontSize={8} 
                    />
                  </div>

                  {showPrice && (
                    <div style={{ fontSize: '11px', fontWeight: '900' }}>
                      {currencyPrefix} {item.product.price.toFixed(2)} MXN
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* FORMAT 3: LETTER / A4 GRID STICKER SHEET */}
          {printFormat === 'grid_sheet' && (
            <div className="grid-sheet-wrapper">
              {flattenedLabels.map((item, idx) => (
                <div key={`print_grid_${item.product.id}_${item.stickerIndex}_${idx}`} className="grid-sheet-label">
                  {showStoreName && (
                    <div style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '1mm', borderBottom: '1px dashed #ccc', paddingBottom: '0.5mm' }}>
                      {customFooterText}
                    </div>
                  )}

                  <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: '1.2', margin: '1mm 0' }}>
                    {item.product.name}
                  </div>

                  <div style={{ margin: '1mm 0' }}>
                    <BarcodeSvgItem 
                      value={item.product.code || '000000'} 
                      width={1.3} 
                      height={26} 
                      fontSize={9} 
                    />
                  </div>

                  {showPrice && (
                    <div style={{ fontSize: '13px', fontWeight: '900', borderTop: '1px dashed #ccc', paddingTop: '1mm', marginTop: '1mm' }}>
                      PRECIO: {currencyPrefix} {item.product.price.toFixed(2)} MXN
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
