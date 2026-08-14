import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Smartphone, 
  Search, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Sparkles, 
  Check, 
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { Product } from '../types';

interface CaseModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (product: Product, modelName: string, quantity?: number) => void;
}

// Popular phone model suggestions for one-click fast selection
const POPULAR_MODELS = [
  { brand: 'iPhone', models: ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 13 Pro Max', 'iPhone 14', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Pro Max', 'iPhone 16 Pro'] },
  { brand: 'Samsung', models: ['Galaxy A14', 'Galaxy A15', 'Galaxy A24', 'Galaxy A34', 'Galaxy A54', 'Galaxy A55', 'Galaxy S23 FE', 'Galaxy S24 Ultra'] },
  { brand: 'Motorola', models: ['Moto G13', 'Moto G14', 'Moto G23', 'Moto G24', 'Moto G54 5G', 'Moto G84 5G', 'Moto Edge 40'] },
  { brand: 'Xiaomi', models: ['Redmi 12', 'Redmi 13C', 'Redmi Note 12', 'Redmi Note 13', 'Redmi Note 13 Pro', 'POCO X6 Pro'] },
  { brand: 'Otros', models: ['Honor X8a', 'Honor Magic 6 Lite', 'Oppo Reno 10', 'ZTE Blade V50', 'Infinix Hot 30'] }
];

export default function CaseModelModal({
  isOpen,
  onClose,
  product,
  onConfirm
}: CaseModelModalProps) {
  const [modelInput, setModelInput] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeBrandTab, setActiveBrandTab] = useState<string>('iPhone');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setModelInput('');
      setQuantity(1);
      setActiveBrandTab('iPhone');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalModel = modelInput.trim() || 'Modelo General';
    onConfirm(product, finalModel, quantity);
    onClose();
  };

  const handleSelectModel = (m: string) => {
    setModelInput(m);
    inputRef.current?.focus();
  };

  const handleQuickAddGeneric = () => {
    onConfirm(product, 'Modelo General', quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">Modelo de Funda</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-white/20 rounded-full border border-white/30 text-white">
                  Registro de Venta
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                {product.name} • <strong className="text-white font-mono">${product.price.toFixed(2)} MXN</strong>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="text-blue-100 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
          
          {/* Main Model Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                Escribe o Selecciona el Modelo del Celular
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                (Opcional - Presiona Enter para confirmar)
              </span>
            </label>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="Ej: iPhone 13 Pro, Samsung A54, Redmi Note 12..."
                className="w-full pl-4 pr-10 py-3 bg-slate-50 border-2 border-blue-200 focus:border-blue-600 focus:bg-white text-slate-900 font-bold text-sm rounded-xl outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-xs"
              />
              {modelInput && (
                <button
                  type="button"
                  onClick={() => {
                    setModelInput('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Brand Tabs & Shortcuts */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Modelos Frecuentes por Marca
              </span>
            </div>

            {/* Brand Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {POPULAR_MODELS.map((group) => (
                <button
                  key={group.brand}
                  type="button"
                  onClick={() => setActiveBrandTab(group.brand)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                    activeBrandTab === group.brand
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {group.brand}
                </button>
              ))}
            </div>

            {/* Models Grid for Active Brand */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50/80 rounded-xl border border-slate-200">
              {POPULAR_MODELS.find((g) => g.brand === activeBrandTab)?.models.map((m) => {
                const isSelected = modelInput.toLowerCase() === m.toLowerCase();
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectModel(m)}
                    className={`px-2.5 py-2 text-left rounded-lg text-xs font-bold transition-all flex items-center justify-between border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    <span className="truncate">{m}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity selector */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-black uppercase text-slate-700">Cantidad a Vender:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center font-black text-sm text-slate-900">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-7 h-7 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleQuickAddGeneric}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Sin Modelo / Venta Rápida</span>
            </button>

            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Agregar al Carrito {modelInput ? `(${modelInput})` : ''}</span>
              <ArrowRight className="w-4 h-4 ml-auto opacity-70" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
