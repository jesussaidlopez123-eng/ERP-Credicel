import React, { useState } from 'react';
import { CreditCard, DollarSign, X, CheckCircle2, Building2 } from 'lucide-react';
import { Product, CartItemMetadata } from '../types';

interface CreditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Product, price: number, metadata?: CartItemMetadata) => void;
}

export default function CreditPaymentModal({
  isOpen,
  onClose,
  onConfirm
}: CreditPaymentModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [platform, setPlatform] = useState<string>('CrediYa');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlatform = platform.trim() || 'CrediYa';

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      alert('Por favor ingresa un monto de abono válido mayor a $0.');
      return;
    }

    const abonoProduct: Product = {
      id: `prod-abono-${Date.now()}`,
      code: `ABO-${cleanPlatform.substring(0, 3).toUpperCase()}`,
      name: `Abono a Crédito (${cleanPlatform})`,
      category: 'equipo_credito',
      price: numAmount,
      stock: 999
    };

    const metadata: CartItemMetadata = {
      deviceModel: cleanPlatform,
      issueDescription: `Abono de crédito: ${cleanPlatform}`,
      downPayment: numAmount
    };

    onConfirm(abonoProduct, numAmount, metadata);
    onClose();

    // Reset fields
    setAmount('');
    setPlatform('CrediYa');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-indigo-600 text-white flex items-center justify-between border-b border-indigo-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-700/80 rounded-xl">
              <CreditCard className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Cobrar Abono a Crédito</h3>
              <p className="text-xs text-indigo-100">CrediYa / PayJoy</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-indigo-100 hover:text-white p-1.5 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Platform Field (Exclusively CrediYa & PayJoy) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Financiera de Crédito *
              </span>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Solo CrediYa y PayJoy
              </span>
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              {['CrediYa', 'PayJoy'].map((plat) => {
                const isSelected = platform === plat;
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setPlatform(plat)}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-200'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-black tracking-wide ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {plat}
                      </span>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Field (Strict Written Input) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              Monto a Cobrar ($ MXN) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">$</span>
              <input
                type="number"
                step="any"
                required
                min="1"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-2xl font-black text-indigo-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            
            {/* Presets */}
            <div className="flex gap-1.5 pt-2">
              {[100, 200, 300, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-indigo-200" />
              Cargar Abono al Ticket
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
