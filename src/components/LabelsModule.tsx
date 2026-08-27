import React, { useState, useMemo } from 'react';
import {
  Printer,
  Search,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Package,
  Layers,
  Tag,
  Sliders,
  Copy,
  Check,
  Usb,
  Download,
  FileText
} from 'lucide-react';
import { Product, Branch } from '../types';

export interface LabelQueueItem {
  product: Product;
  quantity: number;
  customPrice?: number;
  customName?: string;
  customCode?: string;
}

interface LabelsModuleProps {
  products: Product[];
  currentBranch?: Branch;
  currentOperator?: any;
  allBranches?: Branch[];
  onOpenProductModal?: () => void;
}

export default function LabelsModule({
  products = []
}: LabelsModuleProps) {
  // 1. COLA DE ETIQUETAS
  const [queue, setQueue] = useState<LabelQueueItem[]>([]);

  // 2. BUSCADOR & FILTROS
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'accesorio' | 'equipo'>('all');

  // 3. CALIBRADOR EXACTO POR RENGLONES FIJOS (Solución anti-desfase POS-5890A)
  const [storeHeader, setStoreHeader] = useState('CREDICEL');
  const [linePrefix, setLinePrefix] = useState('___');
  const [usePrefix, setUsePrefix] = useState(true);
  const [totalLinesPerLabel, setTotalLinesPerLabel] = useState<number>(7); // Cada etiqueta = exactamente N renglones
  const [lineHeightPx, setLineHeightPx] = useState<number>(16); // Altura en píxeles por renglón en pantalla/impresión
  const [gapFillerChar, setGapFillerChar] = useState<'-' | ' ' | '.'>('-'); // Carácter para los renglones vacíos
  const [fontSizePt, setFontSizePt] = useState<number>(9);
  const [showCode, setShowCode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);

  // Estados auxiliares
  const [copySuccess, setCopySuccess] = useState(false);
  const [usbStatus, setUsbStatus] = useState<string | null>(null);

  // 4. PESTAÑAS (Catálogo / Cola / Etiqueta Libre)
  const [activeTab, setActiveTab] = useState<'catalog' | 'queue' | 'custom'>('catalog');

  // 5. ETIQUETA LIBRE
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  // Lista filtrada de inventario
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterCategory === 'accesorio' && p.category === 'equipo_credito') return false;
      if (filterCategory === 'equipo' && p.category !== 'equipo_credito') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = (p.code || '').toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [products, searchQuery, filterCategory]);

  // Total de etiquetas en cola
  const totalLabelsInQueue = useMemo(() => {
    return queue.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [queue]);

  // Lista plana de etiquetas individuales
  const flatLabelsList = useMemo(() => {
    const list: { id: string; item: LabelQueueItem; index: number }[] = [];
    let count = 0;
    queue.forEach((qItem) => {
      const qty = Math.max(1, Number(qItem.quantity) || 1);
      for (let i = 0; i < qty; i++) {
        list.push({
          id: `${qItem.product.id}-${i}-${count}`,
          item: qItem,
          index: count++
        });
      }
    });
    return list;
  }, [queue]);

  // Acciones sobre la cola
  const handleAddToQueue = (product: Product, quantity = 1) => {
    setQueue((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + quantity };
        return updated;
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setQueue((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setQueue((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    );
  };

  const handleClearQueue = () => {
    if (queue.length === 0) return;
    if (window.confirm('¿Vaciar la cola de impresión?')) {
      setQueue([]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const cleanCode = customCode.trim() || `ETIQ-${Date.now().toString().slice(-4)}`;
    const numPrice = parseFloat(customPrice) || 0;
    const qty = parseInt(customQty, 10) || 1;

    const pseudo: Product = {
      id: `custom-${Date.now()}`,
      code: cleanCode,
      name: customName.trim(),
      category: 'accesorio',
      inventoryType: 'accesorio',
      price: numPrice,
      stock: qty
    };

    handleAddToQueue(pseudo, qty);
    setCustomName('');
    setCustomCode('');
    setCustomPrice('');
    setCustomQty('1');
    setActiveTab('queue');
  };

  // GENERADOR DE LÍNEAS EXACTAS POR ETIQUETA
  const generateLinesForLabel = (labelObj: { item: LabelQueueItem }) => {
    const prod = labelObj.item.product;
    const name = (labelObj.item.customName || prod.name || '').slice(0, 24);
    const code = (labelObj.item.customCode || prod.code || '').slice(0, 20);
    const price = labelObj.item.customPrice !== undefined ? labelObj.item.customPrice : prod.price;
    const prefix = usePrefix ? linePrefix : '';

    const lines: string[] = [];

    // Línea 1: Encabezado
    if (storeHeader) {
      lines.push(`${prefix}${storeHeader}`);
    }

    // Línea 2: Producto
    if (name) {
      lines.push(`${prefix}${name}`);
    }

    // Línea 3: Código
    if (showCode && code) {
      lines.push(`${prefix}${code}`);
    }

    // Línea 4: Precio
    if (showPrice && price !== undefined) {
      lines.push(`${prefix}$${Number(price).toFixed(2)}`);
    }

    // Rellenar exactamente hasta llegar a totalLinesPerLabel
    while (lines.length < totalLinesPerLabel) {
      lines.push(`${prefix}${gapFillerChar}`);
    }

    // Truncar si se pasó del límite
    return lines.slice(0, totalLinesPerLabel);
  };

  // GENERADOR DE TEXTO COMPLETO PARA TODA LA TIRA
  const generateFullPlainText = (items: { id: string; item: LabelQueueItem }[]): string => {
    const allLines: string[] = [];
    items.forEach((item) => {
      const labelLines = generateLinesForLabel(item);
      labelLines.forEach((l) => allLines.push(l));
    });
    return allLines.join('\n');
  };

  // 1. IMPRIMIR VENTANA MONOSPACIO ESTRICTA (CERO DESFASE)
  const executeStrictPrint = (itemsToPrint: { id: string; item: LabelQueueItem }[]) => {
    if (itemsToPrint.length === 0) {
      alert('La cola está vacía. Selecciona al menos un producto.');
      return;
    }

    const printWin = window.open('', '_blank', 'width=380,height=550');
    if (!printWin) {
      alert('Por favor permite ventanas emergentes en el navegador.');
      return;
    }

    const textContent = generateFullPlainText(itemsToPrint);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>POS-5890A Print</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: 48mm auto;
              margin: 0mm !important;
            }
            body {
              font-family: "Courier New", Courier, monospace;
              width: 48mm;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
            }
            pre {
              font-family: "Courier New", Courier, monospace;
              font-size: ${fontSizePt}pt;
              font-weight: 900;
              line-height: ${lineHeightPx}px;
              white-space: pre;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          <pre>${textContent}</pre>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  // 2. IMPRESIÓN DIRECTA POR PUERTO USB (WebSerial ESC/POS puro)
  const handleDirectUsbPrint = async () => {
    if (queue.length === 0) {
      alert('La cola está vacía.');
      return;
    }

    if (!('serial' in navigator)) {
      alert('Tu navegador no soporta WebSerial. Usa Chrome o Edge en tu PC para imprimir directo por USB.');
      executeStrictPrint(flatLabelsList);
      return;
    }

    try {
      setUsbStatus('Conectando USB...');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      const writer = port.writable.getWriter();

      // Generar bytes ESC/POS puros
      const bytes: number[] = [];
      const appendStr = (str: string) => {
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i) & 0xff);
        }
      };

      // Inicializar impresora ESC @
      bytes.push(0x1b, 0x40);

      // Enviar cada línea con avance exacto
      flatLabelsList.forEach((item) => {
        const labelLines = generateLinesForLabel(item);
        labelLines.forEach((l) => {
          appendStr(`${l}\n`);
        });
      });

      // Avance final
      bytes.push(0x1b, 0x64, 0x02);

      const uint8 = new Uint8Array(bytes);
      await writer.write(uint8);
      writer.releaseLock();
      await port.close();

      setUsbStatus('¡Impreso con éxito!');
      setTimeout(() => setUsbStatus(null), 3000);
    } catch (err: any) {
      console.warn('Error al imprimir por USB:', err);
      setUsbStatus(null);
      executeStrictPrint(flatLabelsList);
    }
  };

  // 3. COPIAR TEXTO PLANO AL PORTAPAPELES
  const handleCopyPlainText = () => {
    if (queue.length === 0) {
      alert('La cola está vacía.');
      return;
    }
    const text = generateFullPlainText(flatLabelsList);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // 4. DESCARGAR ARCHIVO .PRN / .TXT
  const handleDownloadTxtFile = () => {
    if (queue.length === 0) {
      alert('La cola está vacía.');
      return;
    }
    const text = generateFullPlainText(flatLabelsList);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiquetas_pos5890a_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Imprimir 2 de prueba para calibrar
  const handleTestTwoLabels = () => {
    const demo1: LabelQueueItem = {
      product: { id: 'test-1', name: 'Micas', code: 'CA01', price: 40, category: 'accesorio', stock: 1 },
      quantity: 1
    };
    const demo2: LabelQueueItem = {
      product: { id: 'test-2', name: 'Micas', code: 'CA01', price: 40, category: 'accesorio', stock: 1 },
      quantity: 1
    };
    executeStrictPrint([
      { id: 't1', item: demo1 },
      { id: 't2', item: demo2 }
    ]);
  };

  return (
    <div className="h-full flex flex-col space-y-3 font-sans pb-4">
      {/* 1. ENCABEZADO Y BOTONES DE IMPRESIÓN */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl">
            <Printer className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>POS-5890A (Calibrador Anti-Desfase)</span>
              <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-md">
                Matriz de Renglones Fijos
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Garantiza que todas las etiquetas salgan sincronizadas sin desfase acumulativo.
            </p>
          </div>
        </div>

        {/* ACCIONES PRINCIPALES */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Probar 2 */}
          <button
            onClick={handleTestTwoLabels}
            className="px-3 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-amber-300 shadow-2xs"
            title="Imprime 2 etiquetas consecutivas para verificar que no haya desfase"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Probar 2 Etiquetas</span>
          </button>

          {/* Copiar Texto */}
          <button
            onClick={handleCopyPlainText}
            disabled={queue.length === 0}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200"
            title="Copiar texto puro para bloc de notas o spooler"
          >
            {copySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            <span>{copySuccess ? '¡Copiado!' : 'Copiar'}</span>
          </button>

          {/* Descargar TXT */}
          <button
            onClick={handleDownloadTxtFile}
            disabled={queue.length === 0}
            className="px-3 py-2 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-purple-200"
            title="Descargar archivo de texto listo para imprimir"
          >
            <Download className="w-4 h-4 text-purple-600" />
            <span>.TXT</span>
          </button>

          {/* Imprimir Directo USB */}
          <button
            onClick={handleDirectUsbPrint}
            disabled={queue.length === 0}
            className="px-3.5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Imprimir directamente por cable USB sin cuadros de diálogo de navegador"
          >
            <Usb className="w-4 h-4" />
            <span>{usbStatus || 'USB Directo'}</span>
          </button>

          {/* Imprimir Ventana */}
          <button
            onClick={() => executeStrictPrint(flatLabelsList)}
            disabled={queue.length === 0}
            className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir ({totalLabelsInQueue})</span>
          </button>

          {queue.length > 0 && (
            <button
              onClick={handleClearQueue}
              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200"
              title="Vaciar cola"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. ÁREA DE TRABAJO (2 COLUMNAS) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        
        {/* PANEL IZQUIERDO: SELECCIÓN DE PRODUCTOS (COL 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          {/* Pestañas */}
          <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Inventario ({products.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Cola ({totalLabelsInQueue})</span>
            </button>

            <button
              onClick={() => setActiveTab('custom')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-white text-purple-700 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Libre</span>
            </button>
          </div>

          {/* TAB 1: CATÁLOGO */}
          {activeTab === 'catalog' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-2.5 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o código..."
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
                {filteredProducts.map((p) => {
                  const queueItem = queue.find((q) => q.product.id === p.id);
                  const qtyInQueue = queueItem ? queueItem.quantity : 0;

                  return (
                    <div
                      key={p.id}
                      className={`p-2 rounded-xl flex items-center justify-between gap-2 ${
                        qtyInQueue > 0 ? 'bg-emerald-50/60 border border-emerald-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[9px] font-bold px-1 py-0.2 bg-slate-100 rounded text-slate-700">
                            {p.code || 'S/C'}
                          </span>
                          <span className="text-[10px] font-black text-emerald-700">
                            ${Number(p.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {p.name}
                        </div>
                      </div>

                      {/* Control cantidad */}
                      <div className="flex items-center gap-1 shrink-0">
                        {qtyInQueue > 0 ? (
                          <div className="flex items-center bg-white border border-emerald-300 rounded-lg p-0.5 shadow-2xs">
                            <button
                              onClick={() => handleUpdateQty(p.id, qtyInQueue - 1)}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-1.5 text-xs font-black text-emerald-800 font-mono">
                              {qtyInQueue}
                            </span>
                            <button
                              onClick={() => handleUpdateQty(p.id, qtyInQueue + 1)}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToQueue(p, 1)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            +1
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: COLA */}
          {activeTab === 'queue' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                {queue.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-xs font-bold">La cola está vacía.</p>
                  </div>
                ) : (
                  queue.map((item) => (
                    <div key={item.product.id} className="p-2 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.customName || item.product.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {item.customCode || item.product.code} | ${Number(item.customPrice !== undefined ? item.customPrice : item.product.price).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateQty(item.product.id, item.quantity - 1)}
                          className="p-1 border rounded cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-black font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQty(item.product.id, item.quantity + 1)}
                          className="p-1 border rounded cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ETIQUETA LIBRE */}
          {activeTab === 'custom' && (
            <form onSubmit={handleAddCustom} className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">Nombre / Producto:</label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ej. Micas"
                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">Código:</label>
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    placeholder="CA01"
                    className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">Precio ($):</label>
                  <input
                    type="number"
                    step="any"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="40.00"
                    className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">Cantidad:</label>
                <input
                  type="number"
                  min="1"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black cursor-pointer"
              >
                + Agregar a la Cola
              </button>
            </form>
          )}
        </div>

        {/* PANEL DERECHO: CALIBRADOR EXACTO Y VISTA PREVIA MONOSPACIO (COL 7) */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
          
          {/* CALIBRADOR DIRECTO DE RENGLONES (ANTI-DESFASE) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>Calibración de Renglones Fijos (POS-5890A)</span>
              </span>
              <span className="text-[11px] font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Exactamente {totalLinesPerLabel} Renglones / Etiqueta
              </span>
            </div>

            {/* CONTROL PRINCIPAL DE RENGLONES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Selector de Renglones por Etiqueta */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-black text-slate-900">1. Total de Renglones:</span>
                  <span className="font-mono font-black text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 text-xs">
                    {totalLinesPerLabel} renglones
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {[5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setTotalLinesPerLabel(num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        totalLinesPerLabel === num
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                  * <strong>Regla de oro:</strong> Si la 2ª etiqueta se va quedando abajo, <strong>reduce a 6</strong>. Si se va subiendo, <strong>aumenta a 8</strong>.
                </p>
              </div>

              {/* Altura de Renglón (Line-Height) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-black text-slate-900">2. Altura de Renglón:</span>
                  <span className="font-mono font-black text-slate-700">{lineHeightPx} px</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {[14, 15, 16, 17, 18].map((px) => (
                    <button
                      key={px}
                      onClick={() => setLineHeightPx(px)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        lineHeightPx === px
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {px}px
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                  * Ajuste fino del espaciado vertical entre líneas de texto.
                </p>
              </div>
            </div>

            {/* AJUSTES DE CONTENIDO */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={usePrefix}
                  onChange={(e) => setUsePrefix(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Prefijo ({linePrefix})</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={showCode}
                  onChange={(e) => setShowCode(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Código</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Precio ($)</span>
              </label>

              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-500">Relleno:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                  {(['-', ' ', '.'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setGapFillerChar(ch)}
                      className={`px-2 py-0.2 rounded text-[11px] font-mono font-black cursor-pointer ${
                        gapFillerChar === ch ? 'bg-white text-black shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      {ch === ' ' ? 'Espacio' : ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ENCABEZADO TIENDA & PREFIJO */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Tienda:</span>
                <input
                  type="text"
                  value={storeHeader}
                  onChange={(e) => setStoreHeader(e.target.value.toUpperCase())}
                  className="px-2 py-0.5 border border-slate-200 rounded font-bold text-slate-900 uppercase"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Prefijo:</span>
                <input
                  type="text"
                  value={linePrefix}
                  onChange={(e) => setLinePrefix(e.target.value)}
                  className="w-16 px-2 py-0.5 border border-slate-200 rounded font-mono font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Tamaño Fuente:</span>
                <select
                  value={fontSizePt}
                  onChange={(e) => setFontSizePt(Number(e.target.value))}
                  className="px-2 py-0.5 border border-slate-200 rounded font-bold text-slate-900 bg-white"
                >
                  <option value={8}>8 pt (Pequeño)</option>
                  <option value={9}>9 pt (Estándar)</option>
                  <option value={10}>10 pt (Mediano)</option>
                  <option value={11}>11 pt (Grande)</option>
                </select>
              </div>
            </div>
          </div>

          {/* VISTA PREVIA EXACTA EN FORMATO MONOSPACIO (WYSISWYG PURO) */}
          <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col items-center justify-start overflow-y-auto">
            <div className="w-full flex items-center justify-between text-white/70 text-xs mb-3 border-b border-slate-800 pb-2">
              <span className="font-black text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Vista Previa Matriz Monospacio (POS-5890A)</span>
              </span>
              <span className="font-mono text-emerald-400 text-[11px]">
                {totalLinesPerLabel} renglones exactos por bloque
              </span>
            </div>

            {/* Simulación visual exacta de las etiquetas consecutivas */}
            <div className="w-full max-w-[280px] bg-white rounded-xl shadow-lg p-3 font-mono border-2 border-dashed border-emerald-400">
              <pre
                style={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: `${fontSizePt}pt`,
                  lineHeight: `${lineHeightPx}px`,
                  fontWeight: 900,
                  whiteSpace: 'pre',
                  margin: 0
                }}
                className="text-black select-all"
              >
                {generateFullPlainText(
                  queue.length === 0
                    ? [
                        {
                          id: 'demo-1',
                          item: {
                            product: { id: 'd1', name: 'Micas', code: 'CA01', price: 40, category: 'accesorio', stock: 1 },
                            quantity: 1
                          },
                          index: 0
                        },
                        {
                          id: 'demo-2',
                          item: {
                            product: { id: 'd2', name: 'Micas', code: 'CA01', price: 40, category: 'accesorio', stock: 1 },
                            quantity: 1
                          },
                          index: 1
                        },
                        {
                          id: 'demo-3',
                          item: {
                            product: { id: 'd3', name: 'Micas', code: 'CA01', price: 40, category: 'accesorio', stock: 1 },
                            quantity: 1
                          },
                          index: 2
                        }
                      ]
                    : flatLabelsList.slice(0, 4)
                )}
              </pre>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Cada bloque tiene exactamente {totalLinesPerLabel} líneas constantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
