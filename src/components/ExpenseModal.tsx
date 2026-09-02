import React, { useState } from 'react';
import { DollarSign, FileText, X, AlertCircle, PlusCircle, Printer, CheckCircle2, Barcode } from 'lucide-react';
import { Expense, Branch, Operator } from '../types';
import { printThermalFromElement } from '../lib/printWindow';
import { formatMoney, money, newUniqueId } from '../lib/ids';
import { formatHermosilloDate } from '../lib/shiftHours';

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
    const newExpense: Expense = {
      id: newUniqueId('EXP'),
      amount: money(numAmount),
      concept: concept.trim(),
      timestamp: now.toISOString(),
      date: formatHermosilloDate(now),
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
            padding: 0.5mm 0.8mm 5mm 0.8mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 8px !important;
            line-height: 1.1 !important;
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
            <div id="thermal-expense-receipt" className="px-1.5 py-1 font-mono text-[8px] leading-tight text-slate-800 bg-white border-b border-slate-200 overflow-y-auto flex-1">
              
              <div className="text-center pb-0.5 border-b border-dashed border-slate-800">
                <h2 className="text-[11px] font-black tracking-tight text-black uppercase leading-none m-0">CrediCel</h2>
                <p className="text-[8px] font-bold m-0">{currentBranch.name} · {createdExpense.operatorName}</p>
                <p className="text-[7.5px] text-slate-700 m-0">{createdExpense.timestamp}</p>
                <p className="text-[8px] font-black uppercase m-0">VALE DE SALIDA</p>
                <div className="inline-block mt-0.5 px-1 bg-black text-white font-black font-mono text-[8px]">
                  {createdExpense.id}
                </div>
              </div>

              <div className="py-0.5 border-b border-dashed border-slate-800">
                <div className="font-black uppercase">Concepto</div>
                <div className="font-bold leading-tight">{createdExpense.concept}</div>
              </div>

              <div className="flex justify-between text-[9px] font-black text-black border-t border-black">
                <span>SALIDA</span>
                <span className="font-mono">-${formatMoney(createdExpense.amount)}</span>
              </div>

              <div className="text-center pt-0.5 border-t border-dashed border-slate-800">
                <Barcode className="w-full text-black" style={{ height: '10px', maxWidth: '46mm' }} />
                <p className="font-mono text-[8px] font-black tracking-widest m-0">*{createdExpense.id}*</p>
                <p className="text-[7.5px] m-0">Salida de efectivo autorizada</p>
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
