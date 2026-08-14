import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, DollarSign, Zap, Smartphone, Wallet } from 'lucide-react';

interface PaymentCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  itemCount: number;
  onConfirmPayment: (method: 'Efectivo' | 'Tarjeta' | 'Transferencia', cashReceived: number, changeAmount: number) => void;
}

export default function PaymentCheckoutModal({
  isOpen,
  onClose,
  totalAmount,
  itemCount,
  onConfirmPayment
}: PaymentCheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [cashReceived, setCashReceived] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setCashReceived('');
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const numCashReceived = parseFloat(cashReceived) || 0;
  const changeAmount = Math.max(0, numCashReceived - totalAmount);
  const isValidPayment = paymentMethod !== 'Efectivo' || numCashReceived >= totalAmount;

  const handleAddBill = (amount: number) => {
    const current = parseFloat(cashReceived) || 0;
    setCashReceived((current + amount).toString());
  };

  const handleSetPreset = (amount: number) => {
    setCashReceived(amount.toString());
  };

  const handleFinalize = () => {
    if (!isValidPayment) return;
    const finalCash = paymentMethod === 'Efectivo' ? numCashReceived : totalAmount;
    const finalChange = paymentMethod === 'Efectivo' ? changeAmount : 0;
    onConfirmPayment(paymentMethod, finalCash, finalChange);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-600 rounded-xl text-white shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight leading-none">Módulo de Cobro</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Desglose: <span className="text-white font-bold">{itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MAIN BODY */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          
          {/* TOTAL & CAMBIO SUMMARY */}
          <div className="bg-slate-900 text-white p-3.5 rounded-xl flex justify-between items-center shadow-inner">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total a Cobrar</span>
              <span className="text-2xl font-black text-emerald-400 leading-none">
                ${totalAmount.toFixed(2)} <span className="text-xs font-bold text-slate-400">MXN</span>
              </span>
            </div>

            {paymentMethod === 'Efectivo' && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cambio a Entregar</span>
                <span className={`text-2xl font-black leading-none ${numCashReceived >= totalAmount ? 'text-yellow-400' : 'text-slate-500'}`}>
                  ${changeAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* INPUT + DROPDOWN ROW */}
          <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            
            <div className="grid grid-cols-12 gap-2 items-end">
              
              {/* Payment Method Dropdown (Replaces old 'Exacto' area) */}
              <div className="col-span-6 sm:col-span-5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-white border-2 border-indigo-300 focus:border-indigo-600 font-extrabold text-xs text-slate-900 rounded-xl py-2 px-2 outline-none cursor-pointer shadow-2xs"
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Tarjeta">💳 Tarjeta / TPV</option>
                  <option value="Transferencia">🏦 Transferencia SPEI</option>
                </select>
              </div>

              {/* Cash Input (When Efectivo) */}
              {paymentMethod === 'Efectivo' ? (
                <div className="col-span-6 sm:col-span-7">
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-500 mb-1">
                    <span>Monto Recibido ($)</span>
                    {numCashReceived > 0 && numCashReceived < totalAmount && (
                      <span className="text-red-600 font-bold">Faltan ${(totalAmount - numCashReceived).toFixed(2)}</span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">$</span>
                    <input
                      type="number"
                      step="any"
                      placeholder={totalAmount.toFixed(2)}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border-2 border-indigo-300 focus:border-indigo-600 rounded-xl text-lg font-black text-slate-900 outline-none text-right shadow-2xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="col-span-6 sm:col-span-7 bg-indigo-100/60 p-2 rounded-xl border border-indigo-200 text-center">
                  <span className="text-[10px] font-extrabold text-indigo-700 block">Cobro Digital</span>
                  <span className="text-sm font-black text-indigo-950">${totalAmount.toFixed(2)}</span>
                </div>
              )}

            </div>

            {/* DIRECT BILLS BUTTONS (BILLETES DIRECTOS) */}
            {paymentMethod === 'Efectivo' && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-tight">
                  <span>Billetes y Montos Directos:</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetPreset(totalAmount)}
                    className="py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] rounded-lg shadow-2xs cursor-pointer text-center truncate col-span-2 sm:col-span-1"
                    title="Cobro exacto"
                  >
                    Exacto
                  </button>
                  {[50, 100, 200, 500, 1000].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => handleSetPreset(bill)}
                      className="py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-lg shadow-2xs cursor-pointer text-center"
                    >
                      ${bill}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddBill(20)}
                    className="py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] rounded-lg cursor-pointer text-center"
                  >
                    +$20
                  </button>
                </div>
              </div>
            )}

            {paymentMethod !== 'Efectivo' && (
              <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0">
                  {paymentMethod === 'Tarjeta' ? <Smartphone className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-black text-indigo-950">
                    {paymentMethod === 'Tarjeta' ? 'Terminal Mercado Pago / POS Listo' : 'Transferencia Electrónica'}
                  </h4>
                  <p className="text-[10px] text-indigo-800 leading-tight">
                    {paymentMethod === 'Tarjeta'
                      ? 'Procesa el cobro contactless o chip en la terminal Mercado Pago por $' + totalAmount.toFixed(2)
                      : 'Confirma la recepción del pago vía SPEI o QR por $' + totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleFinalize}
            disabled={!isValidPayment}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar Venta (${totalAmount.toFixed(2)})
          </button>
        </div>

      </div>
    </div>
  );
}

