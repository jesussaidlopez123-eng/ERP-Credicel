import React, { useState } from 'react';
import { DollarSign, FileText, X, AlertCircle, PlusCircle, Printer, CheckCircle2, Barcode, Store, Clock, User, ShieldCheck } from 'lucide-react';
import { Expense, Branch, Operator } from '../types';
import { printThermalFromElement } from '../lib/printWindow';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: Expense) => void;
  currentBranch: Branch;
  currentOperator: Operator;
}

export default function ExpenseModal({
  isOpen,
  onClose,
  onAddExpense,
  currentBranch,
  currentOperator
}: ExpenseModalProps) {
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [createdExpense, setCreatedExpense] = useState<Expense | null>(null);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setCreatedExpense(null);
    setAmount('');
    setConcept('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (!numAmount || numAmount <= 0) {
      alert('Ingresa un monto de gasto válido.');
      return;
    }

    if (!concept.trim()) {
      alert('Ingresa el concepto o motivo del gasto.');
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      amount: numAmount,
      concept: concept.trim(),
      timestamp: new Date().toISOString(),
      operatorName: currentOperator.name,
      branchId: currentBranch.id
    };

    onAddExpense(newExpense);
    setCreatedExpense(newExpense);
    setAmount('');
    setConcept('');
  };

  const handlePrint = () => {
    printThermalFromElement('thermal-expense-receipt', 'Ticket de gasto');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      
      {/* Print Styles for 58mm POS Thermal Printers */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-expense-receipt, #thermal-expense-receipt * {
            visibility: visible !important;
          }
          #thermal-expense-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 56mm !important;
            max-width: 58mm !important;
            padding: 2mm 2mm 12mm 2mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 10px !important;
            line-height: 1.22 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        
        {/* IF EXPENSE IS JUST CREATED: SHOW RECEIPT TICKET VIEW */}
        {createdExpense ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-red-800 text-white no-print shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-red-200" />
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">¡Gasto Registrado con Éxito!</h3>
                  <p className="text-[11px] text-red-100">Folio: <span className="font-mono font-bold">{createdExpense.id}</span></p>
                </div>
              </div>
              <button 
                onClick={handleCloseModal}
                className="text-red-200 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* RECEIPT CONTENT (PRINTABLE THERMAL AREA) */}
            <div id="thermal-expense-receipt" className="p-5 font-mono text-xs text-slate-800 space-y-3 bg-slate-50 border-b border-slate-200 overflow-y-auto flex-1">
              
              {/* Business & Branch Header */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
                <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">CrediCel POS</h2>
                <p className="text-xs text-slate-700 font-bold font-sans">Sucursal: {currentBranch.name}</p>
                <p className="text-[11px] font-black text-red-700 uppercase tracking-wide my-1">
                  *** VALE DE SALIDA DE CAJA ***
                </p>
                <p className="text-[11px] text-slate-600 font-sans">Registró: {createdExpense.operatorName}</p>
                <p className="text-[11px] text-slate-500 font-sans">{createdExpense.timestamp}</p>
                <div className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-900 font-extrabold font-mono text-[11px] rounded border border-red-300">
                  FOLIO GASTO: {createdExpense.id}
                </div>
              </div>

              {/* Concept Body */}
              <div className="py-2 space-y-2 border-b border-dashed border-slate-400">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  CONCEPTO / MOTIVO DEL GASTO:
                </div>
                <div className="p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 leading-relaxed font-sans">
                  {createdExpense.concept}
                </div>
              </div>

              {/* Total Amount */}
              <div className="space-y-1 py-1.5 border-b border-dashed border-slate-400">
                <div className="flex justify-between items-center text-sm font-black text-slate-900">
                  <span>TOTAL SALIDA:</span>
                  <span className="text-red-700 text-base font-extrabold">-${createdExpense.amount.toFixed(2)} MXN</span>
                </div>
              </div>

              {/* Status Note (Sin firmas según solicitud de blindaje) */}
              <div className="py-1 text-center font-bold text-[9.5px] text-slate-600">
                *** SALIDA DE EFECTIVO AUTORIZADA ***
              </div>

              {/* Footer */}
              <div className="text-center pt-2 border-t border-dashed border-slate-400 space-y-1">
                <div className="flex justify-center items-center py-0.5">
                  <Barcode className="w-40 h-8 text-slate-900" />
                </div>
                <p className="font-mono text-[9px] tracking-widest text-slate-600">*{createdExpense.id}*</p>
                <p className="text-[9px] text-slate-500 font-sans leading-tight">
                  Comprobante interno para respaldo de salida de efectivo en Corte X.
                </p>
              </div>

            </div>

            {/* Modal Bottom Action Buttons (Screen Only) */}
            <div className="p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-2 no-print shrink-0 border-t border-slate-200">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-yellow-300" />
                Imprimir Ticket de Gasto
              </button>

              <button
                type="button"
                onClick={() => setCreatedExpense(null)}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Otro Gasto
              </button>

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Finalizar
              </button>
            </div>

          </div>
        ) : (
          /* FORM VIEW */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-red-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-red-300" />
                <div>
                  <h3 className="font-bold text-base">Registrar Gasto de Caja</h3>
                  <p className="text-[11px] text-red-200">Salida Operativa de Efectivo</p>
                </div>
              </div>
              <button 
                onClick={handleCloseModal}
                className="text-red-200 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-red-600" />
                  Monto del Gasto ($ MXN)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.5"
                  placeholder="Ej. 150.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xl font-bold text-slate-900 focus:ring-2 focus:ring-red-600 focus:outline-none"
                />
              </div>

              {/* Concept */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  Concepto / Razón del Gasto
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej. Pago de garrafón de agua y limpieza para la sucursal..."
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-red-600 focus:outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>Al registrar, se descontará de caja y se generará el <strong>Ticket de Salida</strong> para impresión.</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-red-200" />
                  Registrar e Imprimir Ticket
                </button>
              </div>

            </form>
          </div>
        )}

      </div>
    </div>
  );
}
