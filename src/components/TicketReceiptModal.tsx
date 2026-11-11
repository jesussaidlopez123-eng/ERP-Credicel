import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Printer, 
  X, 
  ArrowRight
} from 'lucide-react';
import { isAndroidPrintHost, isRestrictedPrintHost, printThermalFromElement } from '../lib/printWindow';
import { printThermalTicket } from '../lib/printEscpos';
import { buildSaleTicketEscPos, buildSaleTicketPlainText } from '../lib/escposTickets';
import { SaleTicket, Branch } from '../types';
import { formatMoney, ticketFolioLabel } from '../lib/ids';

interface TicketReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: SaleTicket | null;
  currentBranch: Branch;
}

export default function TicketReceiptModal({
  isOpen,
  onClose,
  ticket,
  currentBranch
}: TicketReceiptModalProps) {
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('erp_pos_autoprint');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [hasPrinted, setHasPrinted] = useState(false);

  useEffect(() => {
    if (isOpen && ticket) {
      setHasPrinted(false);
      if (autoPrintEnabled && !isRestrictedPrintHost()) {
        const timer = setTimeout(() => {
          try {
            printThermalFromElement('thermal-receipt-container', `Ticket ${ticketFolioLabel(ticket)}`);
            setHasPrinted(true);
          } catch (e) {
            console.error('Error triggering auto print:', e);
          }
        }, 280);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, ticket?.id, autoPrintEnabled]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const printAsImage = () => {
    printThermalFromElement('thermal-receipt-container', ticket ? `Ticket ${ticketFolioLabel(ticket)}` : 'Ticket CREDI CEL');
  };

  const handlePrint = async (asImage = false) => {
    if (!ticket) return;
    if (asImage) {
      printAsImage();
      setHasPrinted(true);
      return;
    }
    await printThermalTicket(
      buildSaleTicketPlainText(ticket, currentBranch),
      printAsImage,
      buildSaleTicketEscPos(ticket, currentBranch)
    );
    setHasPrinted(true);
  };

  if (!isOpen || !ticket) return null;

  const handleNextSale = (shouldPrint: boolean = false) => {
    if (shouldPrint) {
      void handlePrint();
      setTimeout(() => {
        onClose();
      }, 250);
    } else {
      onClose();
    }
  };

  const toggleAutoPrint = (val: boolean) => {
    setAutoPrintEnabled(val);
    try {
      localStorage.setItem('erp_pos_autoprint', String(val));
    } catch {}
  };

  const ticketText = buildSaleTicketPlainText(ticket, currentBranch).trimEnd();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 overflow-y-auto">
      <style>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            width: 58mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #thermal-receipt-container {
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
            font-size: 11px !important;
            line-height: 1.12 !important;
            white-space: pre !important;
            overflow: hidden !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-800 to-teal-800 text-white shrink-0 no-print">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight leading-none">
                ¡Venta Cobrada Exitosamente!
              </h3>
              <p className="text-[11px] text-emerald-200/90 mt-0.5">
                Ticket: <strong className="font-mono font-black text-white">{ticketFolioLabel(ticket)}</strong> • Total: <strong className="text-white">${formatMoney(ticket.total)}</strong>
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => handleNextSale(false)}
            className="text-emerald-200 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 shrink-0 no-print flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
              hasPrinted 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : autoPrintEnabled
                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                : 'bg-slate-200 text-slate-700 border border-slate-300'
            }`}>
              <Printer className="w-3 h-3 shrink-0" />
              <span>
                {hasPrinted
                  ? isAndroidPrintHost()
                    ? '✓ Enviado a la térmica (58mm)'
                    : '✓ Impreso (58mm)'
                  : isAndroidPrintHost()
                    ? 'Toca Imprimir (texto)'
                    : isRestrictedPrintHost()
                      ? 'Toca Imprimir'
                      : autoPrintEnabled
                        ? 'Enviando a ticket 58mm...'
                        : 'Manual'}
              </span>
            </span>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-800 font-bold cursor-pointer select-none bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs hover:bg-slate-50">
            <input
              type="checkbox"
              checked={autoPrintEnabled}
              onChange={(e) => toggleAutoPrint(e.target.checked)}
              className="rounded border-slate-400 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Auto-imprimir</span>
          </label>
        </div>

        <div className="p-3 overflow-y-auto flex-1 bg-slate-200/70 flex justify-center items-start">
          <pre
            id="thermal-receipt-container"
            className="ticket-58 font-mono text-black bg-white shadow-md border border-slate-300 w-[232px] px-1.5 py-1 text-[11px] leading-tight whitespace-pre overflow-hidden"
          >
            {ticketText}
          </pre>
        </div>

        <div className="p-3 bg-slate-900 text-white flex flex-col gap-2 shrink-0 no-print border-t border-slate-800">
          {isAndroidPrintHost() ? (
            <p className="text-[10px] text-slate-300 leading-snug">
              Android manda el ticket en <strong className="text-white">letra grande</strong> a RawBT y corta al final. Si el rollo sale vacío, usa “como foto”.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void handlePrint()}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
              title="Mandar este ticket a la térmica (Atajo: P o R)"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>{isAndroidPrintHost() ? 'Imprimir ticket' : 'Reimprimir'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNextSale(false)}
              className="flex items-center justify-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
              title="Continuar con la siguiente venta (Atajo: Enter o Espacio)"
            >
              <span>Siguiente Venta</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          {isAndroidPrintHost() ? (
            <button
              type="button"
              onClick={() => void handlePrint(true)}
              className="self-start text-[10px] text-slate-400 hover:text-slate-200 underline underline-offset-2 cursor-pointer"
            >
              Imprimir como foto (sistema)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
