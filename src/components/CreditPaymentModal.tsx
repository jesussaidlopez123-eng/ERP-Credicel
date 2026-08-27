import React, { useState } from 'react';
import { CreditCard, DollarSign, X, CheckCircle2, Building2 } from 'lucide-react';
import { Product, CartItemMetadata, CreditAccount } from '../types';

interface CreditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Product, price: number, metadata?: CartItemMetadata) => void;
  creditAccounts?: CreditAccount[];
}

export default function CreditPaymentModal({
  isOpen,
  onClose,
  onConfirm,
  creditAccounts = []
}: CreditPaymentModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [platform, setPlatform] = useState<string>('CrediYa');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  if (!isOpen) return null;

  const activeAccounts = creditAccounts.filter((a) => a.status === 'activo' && a.remainingBalance > 0);
  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlatform = selectedAccount?.financingPlatform || platform.trim() || 'CrediYa';

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      alert('Por favor ingresa un monto de abono válido mayor a $0.');
      return;
    }

    if (selectedAccount && numAmount - selectedAccount.remainingBalance > 0.009) {
      alert(`El abono no puede ser mayor al saldo de $${selectedAccount.remainingBalance.toFixed(2)}.`);
      return;
    }

    const abonoProduct: Product = {
      id: `prod-abono-${Date.now()}`,
      code: `ABO-${cleanPlatform.substring(0, 3).toUpperCase()}`,
      name: `Abono a Crédito (${cleanPlatform})`,
      category: 'abono_credito',
      price: numAmount,
      stock: 999
    };

    const metadata: CartItemMetadata = {
      saleType: 'abono',
      creditAccountId: selectedAccount?.id,
      clientName: selectedAccount?.clientName,
      clientPhone: selectedAccount?.clientPhone,
      deviceModel: selectedAccount?.deviceModel || cleanPlatform,
      imei: selectedAccount?.imei,
      issueDescription: selectedAccount
        ? `Abono ${cleanPlatform} — ${selectedAccount.clientName} IMEI ${selectedAccount.imei}`
        : `Abono de crédito: ${cleanPlatform}`,
      downPayment: numAmount,
      remainingBalance: selectedAccount
        ? Math.max(0, selectedAccount.remainingBalance - numAmount)
        : undefined,
      financingPlatform: cleanPlatform
    };

    onConfirm(abonoProduct, numAmount, metadata);
    onClose();

    setAmount('');
    setPlatform('CrediYa');
    setSelectedAccountId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        
        <div className="p-4 bg-indigo-600 text-white flex items-center justify-between border-b border-indigo-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-700/80 rounded-xl">
              <CreditCard className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Cobrar Abono a Crédito</h3>
              <p className="text-xs text-indigo-100">Se descuenta de la cartera del equipo</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-indigo-100 hover:text-white p-1.5 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Crédito activo (cartera)
            </label>
            {activeAccounts.length === 0 ? (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                No hay créditos abiertos en esta sucursal. El abono se registrará en caja sin descontar saldo de un IMEI.
              </p>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  const acc = activeAccounts.find((a) => a.id === e.target.value);
                  if (acc) {
                    setPlatform(acc.financingPlatform || platform);
                    if (!amount) setAmount(String(Math.min(acc.remainingBalance, 500)));
                  }
                }}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="">Sin ligar a un equipo (solo caja)</option>
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.clientName} — {acc.deviceModel} — saldo ${acc.remainingBalance.toFixed(2)}
                  </option>
                ))}
              </select>
            )}
            {selectedAccount && (
              <p className="text-[11px] text-slate-600 mt-1.5">
                IMEI {selectedAccount.imei} · {selectedAccount.financingPlatform} · Saldo ${selectedAccount.remainingBalance.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Financiera de Crédito *
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
