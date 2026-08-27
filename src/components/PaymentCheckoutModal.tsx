import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  DollarSign, 
  Zap, 
  Smartphone, 
  Wallet, 
  RotateCcw, 
  ArrowRight,
  Calculator,
  Coins
} from 'lucide-react';

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
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCashReceived('');
      setPaymentMethod('Efectivo');
      // Focus on manual input after modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const numCashReceived = parseFloat(cashReceived) || 0;
  const changeAmount = Math.max(0, numCashReceived - totalAmount);
  const difference = totalAmount - numCashReceived;
  const isExact = numCashReceived === totalAmount;
  const isOver = numCashReceived > totalAmount;
  const isUnder = numCashReceived > 0 && numCashReceived < totalAmount;
  const isValidPayment = paymentMethod !== 'Efectivo' || numCashReceived >= totalAmount;

  // Handlers for quick cash manipulation
  const handleAddAmount = (amount: number) => {
    const current = parseFloat(cashReceived) || 0;
    const nextVal = (current + amount).toFixed(2).replace(/\.00$/, '');
    setCashReceived(nextVal);
    inputRef.current?.focus();
  };

  const handleSetExact = () => {
    setCashReceived(totalAmount.toFixed(2).replace(/\.00$/, ''));
    inputRef.current?.focus();
  };

  const handleSetPreset = (amount: number) => {
    setCashReceived(amount.toString());
    inputRef.current?.focus();
  };

  const handleClearCash = () => {
    setCashReceived('');
    inputRef.current?.focus();
  };

  const handleKeypadPress = (key: string) => {
    if (key === 'C') {
      setCashReceived('');
    } else if (key === 'BACK') {
      setCashReceived((prev) => prev.slice(0, -1));
    } else if (key === '.') {
      if (!cashReceived.includes('.')) {
        setCashReceived((prev) => (prev === '' ? '0.' : prev + '.'));
      }
    } else {
      setCashReceived((prev) => prev + key);
    }
    inputRef.current?.focus();
  };

  const handleFinalize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValidPayment) return;
    const finalCash = paymentMethod === 'Efectivo' ? numCashReceived : totalAmount;
    const finalChange = paymentMethod === 'Efectivo' ? changeAmount : 0;
    onConfirmPayment(paymentMethod, finalCash, finalChange);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/30 border border-emerald-500/40 rounded-2xl text-emerald-400 shadow-inner">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight leading-none text-white">
                  Módulo de Cobro
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  POS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Desglose: <strong className="text-white font-black">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</strong> en ticket
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar ventana de cobro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MAIN BODY */}
        <form onSubmit={handleFinalize} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* TOTAL & CAMBIO DISPLAY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            
            {/* Total a Cobrar */}
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Total a Cobrar
                </span>
                <span className="text-[10px] font-bold text-slate-400">MXN</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight font-mono my-1">
                ${totalAmount.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400">Monto neto del ticket</span>
            </div>

            {/* Cambio a Entregar o Estado */}
            <div className={`p-3.5 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${
              paymentMethod !== 'Efectivo'
                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                : isUnder
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : isOver || isExact
                ? 'bg-amber-50 border-amber-300 text-amber-950 ring-1 ring-amber-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {paymentMethod !== 'Efectivo' ? 'Forma de Pago' : 'Cambio a Devolver'}
                </span>
                {paymentMethod === 'Efectivo' && isUnder && (
                  <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded-md">
                    Faltan ${(totalAmount - numCashReceived).toFixed(2)}
                  </span>
                )}
                {paymentMethod === 'Efectivo' && isExact && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                    Pago Exacto
                  </span>
                )}
              </div>

              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight my-1">
                {paymentMethod !== 'Efectivo' ? (
                  <span className="text-indigo-700 text-lg sm:text-xl flex items-center gap-1.5">
                    {paymentMethod === 'Tarjeta' ? <Smartphone className="w-5 h-5 inline" /> : <Zap className="w-5 h-5 inline" />}
                    {paymentMethod === 'Tarjeta' ? 'Terminal TPV' : 'SPEI Directo'}
                  </span>
                ) : (
                  <span className={isOver ? 'text-amber-700 font-extrabold' : 'text-slate-800'}>
                    ${changeAmount.toFixed(2)}
                  </span>
                )}
              </div>

              <span className="text-[10px] font-medium opacity-80">
                {paymentMethod !== 'Efectivo' 
                  ? 'No requiere entrega de cambio'
                  : numCashReceived > 0 
                  ? `Recibido: $${numCashReceived.toFixed(2)}` 
                  : 'Ingrese el monto recibido'}
              </span>
            </div>

          </div>

          {/* SELECTOR DE MÉTODO DE PAGO */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
              1. Seleccione Forma de Pago:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('Efectivo');
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className={`p-2.5 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  paymentMethod === 'Efectivo'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md ring-2 ring-emerald-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>💵 Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Tarjeta')}
                className={`p-2.5 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  paymentMethod === 'Tarjeta'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>💳 Tarjeta / TPV</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Transferencia')}
                className={`p-2.5 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  paymentMethod === 'Transferencia'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>🏦 Transferencia</span>
              </button>
            </div>
          </div>

          {/* SECCIÓN EFECTIVO: CAMPO MANUAL + BOTONES RÁPIDOS */}
          {paymentMethod === 'Efectivo' ? (
            <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-3">
              
              {/* ENTRADA MANUAL DEL MONTO QUE ENTREGA EL CLIENTE */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="cash-received-input" className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>2. Monto que entrega el Cliente (Escribir Manualmente):</span>
                  </label>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKeypad(!showKeypad)}
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-colors ${
                        showKeypad 
                          ? 'bg-blue-600 text-white border-blue-700' 
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Teclado numérico táctil en pantalla"
                    >
                      <Calculator className="w-3 h-3" />
                      <span>{showKeypad ? 'Ocultar Teclado' : 'Teclado Táctil'}</span>
                    </button>

                    {cashReceived && (
                      <button
                        type="button"
                        onClick={handleClearCash}
                        className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Borrar monto ingresado"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Borrar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Big Manual Input Box */}
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                    <span className="text-xl font-black text-emerald-700 font-mono">$</span>
                  </div>

                  <input
                    ref={inputRef}
                    id="cash-received-input"
                    type="number"
                    step="any"
                    min="0"
                    placeholder={`Escriba el monto (Ej: ${totalAmount > 0 ? (Math.ceil(totalAmount / 50) * 50).toFixed(2) : '500'})`}
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full pl-9 pr-24 py-3 bg-white border-2 border-emerald-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 rounded-2xl text-xl sm:text-2xl font-mono font-black text-slate-900 outline-none transition-all shadow-inner"
                  />

                  {/* Acciones rápidas dentro del input */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSetExact}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer transition-transform active:scale-95 flex items-center gap-1"
                      title="Cobro exacto sin cambio"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Exacto</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-1 px-1">
                  <span>💡 Puedes teclear cualquier cantidad libre con tu teclado físico o pantalla.</span>
                  {numCashReceived > 0 && isUnder && (
                    <span className="text-rose-600 font-black">
                      Falta entregar: ${difference.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* TECLADO NUMÉRICO TÁCTIL (DESPLEGABLE / OPCIONAL) */}
              {showKeypad && (
                <div className="bg-slate-100 p-2.5 rounded-2xl border border-slate-200 animate-in fade-in zoom-in-95">
                  <div className="grid grid-cols-4 gap-1.5 text-sm font-black">
                    {['7', '8', '9', 'C'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleKeypadPress(k)}
                        className={`py-2 rounded-xl border shadow-2xs font-mono font-black text-base cursor-pointer active:scale-95 transition-all ${
                          k === 'C'
                            ? 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {k}
                      </button>
                    ))}

                    {['4', '5', '6', 'BACK'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleKeypadPress(k)}
                        className={`py-2 rounded-xl border shadow-2xs font-mono font-black text-sm cursor-pointer active:scale-95 transition-all ${
                          k === 'BACK'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50 text-base'
                        }`}
                      >
                        {k === 'BACK' ? '⌫' : k}
                      </button>
                    ))}

                    {['1', '2', '3', '.'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleKeypadPress(k)}
                        className="py-2 rounded-xl bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-2xs font-mono font-black text-base cursor-pointer active:scale-95 transition-all"
                      >
                        {k}
                      </button>
                    ))}

                    {['0', '00', '50', '100'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          if (k === '50' || k === '100') handleSetPreset(Number(k));
                          else handleKeypadPress(k);
                        }}
                        className={`py-2 rounded-xl border shadow-2xs font-mono font-black text-xs sm:text-sm cursor-pointer active:scale-95 transition-all ${
                          k === '50' || k === '100'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200 font-bold'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {k === '50' || k === '100' ? `$${k}` : k}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* BOTONES DE BILLETES DIRECTOS / COBRADO RÁPIDO */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-700 uppercase tracking-tight">
                  <span>Billetes Directos (Cobrado Rápido):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Toca para fijar el billete recibido</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[50, 100, 200, 500, 1000].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => handleSetPreset(bill)}
                      className={`py-2 px-1 rounded-xl font-mono font-black text-xs shadow-xs border transition-all cursor-pointer text-center active:scale-95 ${
                        numCashReceived === bill
                          ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                      }`}
                    >
                      ${bill}
                    </button>
                  ))}

                  {/* Sumar Monedas / Billetes */}
                  <button
                    type="button"
                    onClick={() => handleAddAmount(20)}
                    className="py-2 px-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-extrabold text-xs rounded-xl border border-slate-300 shadow-2xs cursor-pointer text-center transition-colors active:scale-95"
                    title="Sumar $20 al monto actual"
                  >
                    +$20
                  </button>
                </div>

                {/* Fila extra de sumas rápidas para cambio exacto */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">Sumar monedas:</span>
                  {[5, 10, 50, 100].map((extra) => (
                    <button
                      key={extra}
                      type="button"
                      onClick={() => handleAddAmount(extra)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      +${extra}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* VISTA PARA COBROS DIGITALES (TARJETA / TRANSFERENCIA) */
            <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-2xl flex items-start gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shrink-0 shadow-sm">
                {paymentMethod === 'Tarjeta' ? <Smartphone className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-indigo-950">
                  {paymentMethod === 'Tarjeta' ? 'Cobro con Terminal TPV / Tarjeta' : 'Transferencia Bancaria SPEI'}
                </h4>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  {paymentMethod === 'Tarjeta'
                    ? `Inserte o acerque la tarjeta del cliente en la terminal por el monto exacto de $${totalAmount.toFixed(2)} MXN.`
                    : `Verifique en la app bancaria la acreditación del traspaso SPEI por $${totalAmount.toFixed(2)} MXN.`}
                </p>
                <div className="pt-1">
                  <span className="inline-block text-[11px] font-black bg-indigo-200/80 text-indigo-950 px-2.5 py-1 rounded-lg">
                    Monto a procesar: ${totalAmount.toFixed(2)} MXN
                  </span>
                </div>
              </div>
            </div>
          )}

        </form>

        {/* MODAL FOOTER WITH CONFIRM BUTTON */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => handleFinalize()}
            disabled={!isValidPayment}
            className={`flex-1 py-3 px-4 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isValidPayment
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-slate-300 text-slate-500 opacity-60 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>
              {paymentMethod === 'Efectivo' && isUnder
                ? `Faltan $${(totalAmount - numCashReceived).toFixed(2)} para cobrar`
                : `Confirmar Venta ($${totalAmount.toFixed(2)})`}
            </span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>

      </div>
    </div>
  );
}
