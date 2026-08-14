import React from 'react';
import { CheckCircle2, Printer, X, Store, User, Clock, Smartphone, Phone, FileText, QrCode, Barcode } from 'lucide-react';
import { SaleTicket, Branch } from '../types';

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
  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Print Styles for 80mm POS Thermal Receipt Printers */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt-container, #thermal-receipt-container * {
            visibility: visible;
          }
          #thermal-receipt-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 4mm;
            margin: 0;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Screen only */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-700 text-white no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">¡Venta Registrada Exitosamente!</h3>
              <p className="text-[11px] text-emerald-100">Folio Ticket: <span className="font-mono font-bold">{ticket.id}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* RECEIPT CONTENT (Printable Area) */}
        <div id="thermal-receipt-container" className="p-5 font-mono text-xs text-slate-800 space-y-3 bg-slate-50 border-b border-slate-200">
          
          {/* Business & Branch Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
            <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">CrediCel POS</h2>
            <p className="text-xs text-slate-700 font-bold font-sans">Sucursal: {currentBranch.name}</p>
            <p className="text-[11px] text-slate-600 font-sans">Atendió: {ticket.operatorName}</p>
            <p className="text-[11px] text-slate-500 font-sans">{ticket.timestamp}</p>
            <div className="inline-block mt-1 px-2.5 py-0.5 bg-slate-200 text-slate-900 font-extrabold font-mono text-xs rounded border border-slate-300">
              TICKET: {ticket.id}
            </div>
          </div>

          {/* Table Header */}
          <div className="space-y-1.5 py-1 border-b border-dashed border-slate-400">
            <div className="flex justify-between font-black text-slate-900 text-[11px] uppercase border-b border-slate-300 pb-1">
              <span>CANT / DESCRIPCION</span>
              <span className="text-right">TOTAL</span>
            </div>

            {/* Item Rows */}
            {ticket.items.map((item, idx) => (
              <div key={item.cartItemId || idx} className="py-1 space-y-0.5 border-b border-slate-100 last:border-none">
                <div className="flex justify-between items-start font-bold text-slate-900">
                  <span className="leading-tight pr-2">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="shrink-0 text-right">${item.totalPrice.toFixed(2)}</span>
                </div>

                <div className="text-[10px] text-slate-500 font-sans">
                  Precio unit: ${item.unitPrice.toFixed(2)} • Cód: {item.product.code}
                </div>

                {/* Specific metadata for Airtime Recharges */}
                {item.metadata?.phoneNumber && (
                  <div className="text-[10px] text-emerald-800 font-sans bg-emerald-50 p-1.5 rounded border border-emerald-200 space-y-0.5">
                    <div>📱 Teléfono: <strong className="font-mono text-emerald-950 font-extrabold">{item.metadata.phoneNumber}</strong></div>
                    {item.metadata.carrier && <div>📡 Compañía: <strong>{item.metadata.carrier}</strong></div>}
                  </div>
                )}

                {/* Specific metadata for Equipment / Cell Phone Sales (Contado or Crédito) */}
                {item.metadata?.deviceModel && (
                  <div className={`text-[10px] font-sans p-1.5 rounded border space-y-0.5 ${
                    item.metadata.saleType === 'contado' || item.metadata.financingPlatform === 'Contado'
                      ? 'text-emerald-900 bg-emerald-50 border-emerald-200'
                      : 'text-indigo-900 bg-indigo-50 border-indigo-200'
                  }`}>
                    <div className="font-bold flex items-center justify-between">
                      <span>
                        {item.metadata.saleType === 'contado' || item.metadata.financingPlatform === 'Contado'
                          ? '📱 VENTA DE CELULAR (CONTADO)'
                          : `🏦 ENGANCHE CRÉDITO (${item.metadata.financingPlatform || 'Financiera'})`}
                      </span>
                    </div>
                    {item.metadata.clientName && <div>👤 Cliente: <strong>{item.metadata.clientName}</strong></div>}
                    {item.metadata.clientPhone && <div>📞 Tel: <strong>{item.metadata.clientPhone}</strong></div>}
                    <div>📱 Equipo: <strong>{item.metadata.deviceModel}</strong></div>
                    {item.metadata.imei && <div>🔢 IMEI: <strong className="font-mono">{item.metadata.imei}</strong></div>}
                    
                    {item.metadata.saleType === 'credito' && item.metadata.financingPlatform !== 'Contado' && item.metadata.fullPrice !== undefined && (
                      <div className="pt-1 mt-1 border-t border-indigo-200 text-[9.5px] space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>Precio Total Equipo:</span> <strong>${item.metadata.fullPrice.toFixed(2)}</strong></div>
                        <div className="flex justify-between"><span>Enganche Cobrado:</span> <strong>${(item.metadata.downPayment || item.totalPrice).toFixed(2)}</strong></div>
                        <div className="flex justify-between font-bold text-indigo-950">
                          <span>Saldo Financiado:</span>
                          <strong>${(item.metadata.remainingBalance ?? Math.max(0, item.metadata.fullPrice - (item.metadata.downPayment || item.totalPrice))).toFixed(2)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Specific metadata for Repairs */}
                {item.metadata?.repairId && (
                  <div className="text-[10px] text-amber-900 font-sans bg-amber-50 p-1.5 rounded border border-amber-200 space-y-0.5">
                    <div>🔧 Folio Reparación: <strong className="font-mono">{item.metadata.repairId}</strong></div>
                    <div>👤 Cliente: <strong>{item.metadata.clientName}</strong></div>
                    <div>💬 Concepto: <strong>{item.metadata.repairType === 'anticipo' ? 'Anticipo' : 'Saldo Final Liquidado'}</strong></div>
                  </div>
                )}

                {/* Specific metadata for Phone Cases (Fundas) */}
                {item.metadata?.caseModel && (
                  <div className="text-[10px] text-blue-900 font-sans bg-blue-50 p-1.5 rounded border border-blue-200">
                    <div>📱 Modelo Funda: <strong className="font-bold text-blue-950">{item.metadata.caseModel}</strong></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals Section */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-base font-black text-slate-900 border-b border-slate-300 pb-1">
              <span>TOTAL A PAGAR:</span>
              <span>${ticket.total.toFixed(2)} MXN</span>
            </div>

            <div className="flex justify-between text-xs text-slate-700 font-sans">
              <span>Método de Pago:</span>
              <span className="font-bold text-slate-900 uppercase">{ticket.paymentMethod}</span>
            </div>

            {ticket.paymentMethod === 'Efectivo' && ticket.cashReceived !== undefined && (
              <>
                <div className="flex justify-between text-xs text-slate-600 font-sans">
                  <span>Efectivo Recibido:</span>
                  <span className="font-mono font-bold">${ticket.cashReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-emerald-700 font-sans">
                  <span>Cambio Entregado:</span>
                  <span className="font-mono font-bold">${(ticket.change || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Barcode graphic footer */}
          <div className="text-center pt-3 border-t border-dashed border-slate-400 space-y-1.5">
            <div className="flex justify-center items-center py-1">
              <Barcode className="w-48 h-10 text-slate-900" />
            </div>
            <p className="font-mono text-[10px] tracking-widest text-slate-600">*{ticket.id}*</p>
            <p className="text-[10px] text-slate-500 font-sans leading-tight">
              ¡Gracias por su compra en CrediCel! <br />
              Conserve este comprobante para aclaraciones o garantía.
            </p>
          </div>

        </div>

        {/* Buttons - Screen Only */}
        <div className="p-4 bg-white flex items-center justify-between gap-3 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-yellow-400" />
            Imprimir Ticket Thermal
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            Siguiente Venta
          </button>
        </div>

      </div>
    </div>
  );
}

