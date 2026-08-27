import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  Tag,
  Package
} from 'lucide-react';
import { Product } from '../types';
import { isVirtualPosProduct } from '../lib/inventoryRules';
import { barcodePngDataUrl } from '../lib/barcode';
import { escapeHtml, printHtmlDocument } from '../lib/printWindow';

interface QueueItem {
  product: Product;
  quantity: number;
}

interface InventoryLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  inventoryTab: 'accesorio' | 'equipo';
}

function isLabelProduct(product: Product): boolean {
  if (isVirtualPosProduct(product)) return false;
  if (product.category === 'recarga' || product.category === 'servicio') return false;
  return Boolean((product.code || '').trim() && (product.name || '').trim());
}

export default function InventoryLabelsModal({
  isOpen,
  onClose,
  products,
  inventoryTab
}: InventoryLabelsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setQueue([]);
    setPrintError(null);
  }, [isOpen, inventoryTab]);

  const catalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter((p) => {
        if (!isLabelProduct(p)) return false;
        const type = p.inventoryType || (p.category === 'equipo_credito' ? 'equipo' : 'accesorio');
        if (type !== inventoryTab) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.code || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'es', { numeric: true }));
  }, [products, inventoryTab, searchQuery]);

  const totalLabels = queue.reduce((sum, item) => sum + item.quantity, 0);

  const addProduct = (product: Product) => {
    setQueue((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const setQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setQueue((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setQueue((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)));
  };

  const preview = queue[0]?.product || catalog[0] || null;
  const previewBarcode = preview ? barcodePngDataUrl(preview.code) : '';

  const handlePrint = () => {
    if (totalLabels === 0) {
      setPrintError('Elige al menos un producto de inventario.');
      return;
    }
    setPrintError(null);

    const stickers: string[] = [];
    queue.forEach((item) => {
      const barcode = barcodePngDataUrl(item.product.code);
      const name = escapeHtml(item.product.name);
      const code = escapeHtml(item.product.code);
      const price = Number(item.product.price || 0).toFixed(2);
      for (let i = 0; i < item.quantity; i++) {
        stickers.push(`
          <div class="sticker">
            <div class="store">CREDI CEL</div>
            <div class="code">${code}</div>
            <div class="name">${name}</div>
            <img class="barcode" src="${barcode}" alt="${code}" />
            <div class="price">$${price}</div>
          </div>
        `);
      }
    });

    const css = `
      @page { size: 58mm auto; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; width: 58mm; background: #fff; color: #000; }
      .sticker {
        width: 54mm;
        margin: 0 auto;
        padding: 2.2mm 1.5mm 6mm 1.5mm;
        text-align: center;
        font-family: Arial, Helvetica, sans-serif;
        page-break-after: always;
        border-bottom: 1px dashed #000;
      }
      .sticker:last-child { page-break-after: auto; border-bottom: none; }
      .store { font-size: 8px; font-weight: 800; letter-spacing: 0.12em; }
      .code { font-size: 10px; font-family: 'Courier New', monospace; font-weight: 700; margin-top: 1mm; }
      .name { font-size: 11px; font-weight: 700; line-height: 1.2; margin: 1mm 0; }
      .barcode { width: 50mm; height: 16mm; object-fit: contain; }
      .price { font-size: 16px; font-weight: 800; margin-top: 1mm; }
    `;

    printHtmlDocument(stickers.join(''), 'Etiquetas de inventario', css);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl border border-slate-200 shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#0047AB] text-white rounded-xl">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Etiquetas de inventario</h3>
              <p className="text-[11px] text-slate-500">
                {inventoryTab === 'equipo' ? 'Equipos' : 'Accesorios'} · código, nombre, código de barras y precio
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="border-b md:border-b-0 md:border-r border-slate-200 flex flex-col min-h-[280px]">
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar producto por nombre o código"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {catalog.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No hay productos para etiquetar en esta pestaña.</div>
              ) : (
                catalog.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono font-semibold text-[#0047AB]">{product.code}</p>
                      <p className="text-xs font-semibold text-slate-800 truncate">{product.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold">${Number(product.price || 0).toFixed(2)}</p>
                      <span className="text-[10px] text-emerald-700 font-semibold">Agregar</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-[280px]">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Para imprimir ({totalLabels})</p>
              {queue.length > 0 && (
                <button type="button" onClick={() => setQueue([])} className="text-[11px] font-semibold text-red-700">
                  Vaciar
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {queue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-8">
                  <Package className="w-8 h-8 mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">Elige productos de la lista</p>
                </div>
              ) : (
                queue.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2 border border-slate-200 rounded-xl p-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono text-slate-500">{item.product.code}</p>
                      <p className="text-xs font-semibold truncate">{item.product.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setQty(item.product.id, item.quantity - 1)} className="p-1 rounded bg-slate-100">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <button type="button" onClick={() => setQty(item.product.id, item.quantity + 1)} className="p-1 rounded bg-slate-100">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => setQty(item.product.id, 0)} className="p-1 rounded text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {preview && (
              <div className="mx-3 mb-2 border border-dashed border-slate-300 rounded-xl p-3 text-center bg-slate-50">
                <p className="text-[9px] font-bold tracking-[0.18em] text-slate-500">CREDI CEL</p>
                <p className="text-[11px] font-mono font-bold">{preview.code}</p>
                <p className="text-xs font-semibold leading-tight">{preview.name}</p>
                {previewBarcode && (
                  <img src={previewBarcode} alt={preview.code} className="mx-auto my-1 h-12 object-contain" />
                )}
                <p className="text-lg font-bold">${Number(preview.price || 0).toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        {printError && (
          <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-t border-amber-200">{printError}</div>
        )}

        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-xl">
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={totalLabels === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0047AB] hover:bg-[#003d93] disabled:opacity-40 rounded-xl flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir {totalLabels > 0 ? `${totalLabels} etiqueta${totalLabels === 1 ? '' : 's'}` : 'etiquetas'}
          </button>
        </div>
      </div>
    </div>
  );
}
