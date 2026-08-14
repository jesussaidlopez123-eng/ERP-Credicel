import React, { useState } from 'react';
import { DollarSign, CheckCircle2, X } from 'lucide-react';
import { Product, CartItemMetadata } from '../types';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (product: Product, amount: number, metadata: CartItemMetadata) => void;
}

const PRESET_AMOUNTS = [20, 30, 50, 100, 150, 200, 300, 500];

export default function RechargeModal({
  isOpen,
  onClose,
  product,
  onConfirm
}: RechargeModalProps) {
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');

  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;
    
    if (!finalAmount || finalAmount <= 0) {
      alert('Por favor ingresa un monto válido para la recarga.');
      return;
    }

    onConfirm(
      {
        ...product,
        name: `Recarga de Tiempo Aire $${finalAmount}`,
        price: finalAmount,
      },
      finalAmount,
      {
        rechargeAmount: finalAmount,
      }
    );

    setCustomAmount('');
    onClose();
  };

  const currentFinalAmount = customAmount ? parseFloat(customAmount) || 0 : amount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-700 text-white shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-200" />
            <div>
              <h3 className="font-bold text-base">Monto de Recarga</h3>
              <p className="text-[11px] text-emerald-200">Ingresa o selecciona el monto a cobrar</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Preset Amounts */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Montos Rápidos ($ MXN)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => {
                    setAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-2.5 rounded-xl border text-sm font-black transition-all ${
                    amount === amt && !customAmount
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              O bien, escribe un monto personalizado:
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-slate-400 text-base">$</span>
              <input
                type="number"
                step="any"
                min="1"
                placeholder="Ej. 120"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between font-bold">
            <span className="text-xs text-emerald-900">Total Recarga a Cobrar:</span>
            <span className="text-xl text-emerald-700 font-black">
              ${currentFinalAmount.toFixed(2)} MXN
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Agregar a Ticket
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
