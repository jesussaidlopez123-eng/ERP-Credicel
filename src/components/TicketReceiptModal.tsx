import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Printer, 
  X, 
  ArrowRight
} from 'lucide-react';
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
  // Auto-print preference (enabled by default)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('erp_pos_autoprint');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [hasPrinted, setHasPrinted] = useState(false);

  // Trigger automatic thermal print when modal opens with a valid ticket
  useEffect(() => {
    if (isOpen && ticket) {
      setHasPrinted(false);
      if (autoPrintEnabled) {
        const timer = setTimeout(() => {
          try {
            window.print();
            setHasPrinted(true);
          } catch (e) {
            console.error('Error triggering auto print:', e);
          }
        }, 220);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, ticket?.id, autoPrintEnabled]);

  // Keyboard shortcut handler (Enter/Space for next sale, P/R for reprint, Esc to close)
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

  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    window.print();
    setHasPrinted(true);
  };

  const handleNextSale = (shouldPrint: boolean = false) => {
    if (shouldPrint) {
      window.print();
      setHasPrinted(true);
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

  // Human readable date formatting
  const formattedDate = (() => {
    if (!ticket.timestamp) return '';
    try {
      const d = new Date(ticket.timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
    } catch {}
    return ticket.timestamp;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 overflow-y-auto">
      
      {/* 58mm Thermal Print Stylesheet (POS-5890A-L / 58mm standard roll) */}
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
            color: #000000 !important;
            width: 58mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-container, #thermal-receipt-container * {
            visibility: visible !important;
          }
          #thermal-receipt-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 56mm !important;
            max-width: 58mm !important;
            padding: 1.5mm 2mm 12mm 2mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 10px !important;
            line-height: 1.22 !important;
            word-break: break-word !important;
          }
          .no-print {
            display: none !important;
          }
          .thermal-bold {
            font-weight: 900 !important;
            color: #000000 !important;
          }
          .thermal-divider {
            border-bottom: 1px dashed #000000 !important;
            margin: 3px 0 !important;
          }
          .thermal-divider-double {
            border-bottom: 2px solid #000000 !important;
            margin: 4px 0 !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        
        {/* Header - Screen only */}
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
                Ticket: <strong className="font-mono font-black text-white">{ticket.id}</strong> • Total: <strong className="text-white">${ticket.total.toFixed(2)}</strong>
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

        {/* Quick Toolbar - Screen Only */}
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
                  ? '✓ Impreso (58mm)' 
                  : autoPrintEnabled 
                  ? 'Enviando a ticket 58mm...' 
                  : 'Manual'}
              </span>
            </span>
          </div>

          {/* Auto print checkbox */}
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

        {/* Scrollable Receipt Preview Container */}
        <div className="p-3 overflow-y-auto flex-1 bg-slate-200/70 flex justify-center items-start">
          
          {/* RECEIPT CONTENT (58mm Printable Thermal Element) */}
          <div 
            id="thermal-receipt-container" 
            className="font-mono text-slate-900 bg-white shadow-md border border-slate-300 w-[270px] p-3 text-[11px]"
            style={{ minHeight: '320px' }}
          >
            {/* Business & Branch Header */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-800">
              <h2 className="text-lg font-black tracking-tight text-black uppercase leading-none">
                CrediCel
              </h2>
              <p className="text-[10px] text-black font-extrabold uppercase">
                PUNTO DE VENTA Y ACCESORIOS
              </p>
              <p className="text-[10px] text-slate-800 font-bold">
                Sucursal: {currentBranch.name}
              </p>
              <p className="text-[9.5px] text-slate-700">
                Atendió: {ticket.operatorName}
              </p>
              <p className="text-[9px] text-slate-600">
                {formattedDate}
              </p>
              
              <div className="inline-block mt-1 px-2 py-0.5 bg-black text-white font-black font-mono text-[10px] rounded tracking-wider">
                TICKET: {ticket.id}
              </div>
            </div>

            {/* Table Header */}
            <div className="space-y-1 py-1.5 border-b border-dashed border-slate-800">
              <div className="flex justify-between font-black text-black text-[10px] uppercase border-b border-slate-400 pb-0.5">
                <span>CANT / DESCRIPCIÓN</span>
                <span className="text-right">TOTAL</span>
              </div>

              {/* Item Rows */}
              {ticket.items.map((item, idx) => (
                <div key={item.cartItemId || idx} className="py-1 space-y-0.5 border-b border-dotted border-slate-200 last:border-none">
                  <div className="flex justify-between items-start font-black text-black">
                    <span className="leading-tight pr-1 text-[10px]">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span className="shrink-0 text-right font-mono font-bold text-[10px]">
                      ${item.totalPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-[9px] text-slate-600 font-sans flex justify-between">
                    <span>P.Unit: ${item.unitPrice.toFixed(2)}</span>
                    <span>Cód: {item.product.code}</span>
                  </div>

                  {/* Specific metadata for Credit Abonos */}
                  {item.product.code.startsWith('ABO-') && (
                    <div className="text-[9px] bg-slate-100 p-1 rounded border border-slate-300 text-black space-y-0.5 mt-0.5 font-sans">
                      <div className="font-black text-[9px] text-indigo-900">
                        💳 ABONO DE CRÉDITO
                      </div>
                      {item.metadata?.issueDescription && (
                        <div>📝 Concepto: {item.metadata.issueDescription}</div>
                      )}
                      <div>💵 Monto Abonado: <strong className="font-mono">${item.totalPrice.toFixed(2)}</strong></div>
                    </div>
                  )}

                  {/* Specific metadata for Airtime Recharges */}
                  {item.metadata?.phoneNumber && (
                    <div className="text-[9px] text-black bg-slate-100 p-1 rounded border border-slate-300 font-mono space-y-0.5 mt-0.5">
                      <div>📱 TEL: <strong className="font-black text-black">{item.metadata.phoneNumber}</strong></div>
                      {item.metadata.carrier && <div>📡 COMPAÑÍA: <strong>{item.metadata.carrier.toUpperCase()}</strong></div>}
                    </div>
                  )}

                  {/* Specific metadata for Equipment / Cell Phone Sales */}
                  {item.metadata?.deviceModel && !item.product.code.startsWith('ABO-') && (
                    <div className="text-[9.5px] bg-slate-100 p-1.5 rounded border border-slate-400 text-black space-y-1 mt-1 font-sans">
                      <div className="font-black text-[10px] uppercase text-center border-b border-dashed border-slate-400 pb-0.5">
                        {item.metadata.saleType === 'contado' || item.metadata.financingPlatform === 'Contado'
                          ? '📱 VENTA DE CELULAR (CONTADO)'
                          : `🏦 VENTA A CRÉDITO (${item.metadata.financingPlatform || 'FINANCIERA'})`}
                      </div>
                      
                      <div className="space-y-0.5">
                        {item.metadata.clientName && (
                          <div>👤 <strong>Cliente:</strong> {item.metadata.clientName}</div>
                        )}
                        {item.metadata.clientPhone && (
                          <div>📞 <strong>Teléfono:</strong> {item.metadata.clientPhone}</div>
                        )}
                        <div>📱 <strong>Modelo:</strong> {item.metadata.deviceModel}</div>
                        {item.metadata.imei && (
                          <div>🔢 <strong>IMEI:</strong> <span className="font-mono font-black">{item.metadata.imei}</span></div>
                        )}
                      </div>

                      {item.metadata.saleType === 'credito' && item.metadata.financingPlatform !== 'Contado' && item.metadata.fullPrice !== undefined ? (
                        <div className="pt-1 mt-1 border-t border-dashed border-slate-400 text-[9px] font-mono space-y-0.5">
                          <div className="flex justify-between">
                            <span>Precio Total Equipo:</span>
                            <strong>${item.metadata.fullPrice.toFixed(2)}</strong>
                          </div>
                          <div className="flex justify-between font-black text-emerald-950">
                            <span>Enganche Cobrado:</span>
                            <strong>${(item.metadata.downPayment || item.totalPrice).toFixed(2)}</strong>
                          </div>
                          <div className="flex justify-between font-black text-indigo-950 border-t border-dotted border-slate-300 pt-0.5">
                            <span>Saldo Financiado:</span>
                            <strong>${(item.metadata.remainingBalance ?? Math.max(0, item.metadata.fullPrice - (item.metadata.downPayment || item.totalPrice))).toFixed(2)}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1 mt-1 border-t border-dashed border-slate-400 text-[9px] font-mono flex justify-between font-black">
                          <span>Liquidación Total:</span>
                          <strong>${(item.metadata.fullPrice || item.totalPrice).toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Specific metadata for Repairs (Recepción de Equipo y Entrega en Taller) */}
                  {item.metadata?.repairId && (
                    <div className="text-[9.5px] bg-slate-100 p-1.5 rounded border border-slate-400 text-black space-y-1 mt-1 font-sans">
                      <div className="font-black text-[10px] uppercase text-center border-b border-dashed border-slate-400 pb-0.5">
                        {item.metadata.repairType === 'saldo_final'
                          ? '🔧 ENTREGA Y LIQUIDACIÓN'
                          : '🔧 RECEPCIÓN DE EQUIPO A TALLER'}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex justify-between">
                          <span>Folio Taller:</span>
                          <strong className="font-mono font-black text-amber-950">{item.metadata.repairId}</strong>
                        </div>
                        {item.metadata.clientName && (
                          <div>👤 <strong>Cliente:</strong> {item.metadata.clientName}</div>
                        )}
                        {item.metadata.deviceModel && (
                          <div>📱 <strong>Equipo:</strong> {item.metadata.deviceModel}</div>
                        )}
                        {item.metadata.repairType !== 'saldo_final' && item.metadata.issueDescription && (
                          <div className="text-[8.5px] bg-white p-1 rounded border border-slate-300 italic text-slate-800">
                            <strong>Falla:</strong> {item.metadata.issueDescription}
                          </div>
                        )}
                        {item.metadata.repairType !== 'saldo_final' && item.metadata.passcodePattern && item.metadata.passcodePattern !== 'Sin contraseña / Desbloqueado' && (
                          <div className="text-[8.5px] text-slate-700">
                            🔒 <strong>PIN:</strong> {item.metadata.passcodePattern}
                          </div>
                        )}
                      </div>

                      {/* Desglose de costos de reparación */}
                      {item.metadata.totalRepairCost !== undefined && (
                        <div className="pt-1 mt-1 border-t border-dashed border-slate-400 text-[9px] font-mono space-y-0.5">
                          {item.metadata.repairType === 'saldo_final' ? (
                            <>
                              <div className="flex justify-between text-slate-700">
                                <span>Total Servicio:</span>
                                <strong>${item.metadata.totalRepairCost.toFixed(2)}</strong>
                              </div>
                              <div className="flex justify-between text-slate-700">
                                <span>Anticipo:</span>
                                <strong>${(item.metadata.advancePayment || 0).toFixed(2)}</strong>
                              </div>
                              <div className="flex justify-between font-black text-emerald-950 border-t border-dotted border-slate-300 pt-0.5 text-[10px]">
                                <span>Pagado Hoy:</span>
                                <strong>${item.totalPrice.toFixed(2)}</strong>
                              </div>
                              <div className="text-center font-bold text-[8.5px] text-emerald-800 pt-0.5">
                                ✓ EQUIPO ENTREGADO Y PAGADO
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span>Costo Total:</span>
                                <strong>${item.metadata.totalRepairCost.toFixed(2)}</strong>
                              </div>
                              <div className="flex justify-between font-black text-emerald-950">
                                <span>Anticipo Hoy:</span>
                                <strong>${(item.metadata.advancePayment ?? item.totalPrice).toFixed(2)}</strong>
                              </div>
                              <div className="flex justify-between font-black text-amber-950 border-t border-dotted border-slate-300 pt-0.5">
                                <span>Resta al Entregar:</span>
                                <strong>${(item.metadata.pendingBalance ?? Math.max(0, item.metadata.totalRepairCost - (item.metadata.advancePayment ?? item.totalPrice))).toFixed(2)}</strong>
                              </div>
                              <div className="text-[8px] text-slate-600 italic text-center pt-0.5">
                                * Conserva este ticket para recoger.
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Specific metadata for Case Models */}
                  {item.metadata?.caseModel && (
                    <div className="text-[9px] bg-slate-100 p-0.5 px-1 rounded border border-slate-300 text-black font-sans mt-0.5">
                      <span>📱 Para: <strong>{item.metadata.caseModel}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div className="space-y-1 pt-1.5">
              <div className="flex justify-between text-xs font-black text-black border-b-2 border-black pb-0.5">
                <span>TOTAL:</span>
                <span className="font-mono">${ticket.total.toFixed(2)} MXN</span>
              </div>

              <div className="flex justify-between text-[9.5px] text-slate-800">
                <span>Forma de Pago:</span>
                <span className="font-black text-black uppercase">{ticket.paymentMethod}</span>
              </div>

              {ticket.paymentMethod === 'Efectivo' && ticket.cashReceived !== undefined && (
                <>
                  <div className="flex justify-between text-[9.5px] text-slate-700">
                    <span>Efectivo Recibido:</span>
                    <span className="font-mono font-bold text-black">${ticket.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black text-black">
                    <span>Cambio Devuelto:</span>
                    <span className="font-mono font-black">${(ticket.change || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Barcode Graphic & Footer */}
            <div className="text-center pt-2 border-t border-dashed border-slate-800 space-y-1">
              {/* Crisp SVG Barcode optimized for 58mm thermal resolution */}
              <div className="flex justify-center items-center py-1">
                <svg className="w-full h-7 max-w-[180px]" viewBox="0 0 200 40" preserveAspectRatio="none">
                  <rect x="0" y="0" width="4" height="40" fill="#000" />
                  <rect x="6" y="0" width="2" height="40" fill="#000" />
                  <rect x="10" y="0" width="6" height="40" fill="#000" />
                  <rect x="18" y="0" width="3" height="40" fill="#000" />
                  <rect x="24" y="0" width="5" height="40" fill="#000" />
                  <rect x="32" y="0" width="2" height="40" fill="#000" />
                  <rect x="36" y="0" width="7" height="40" fill="#000" />
                  <rect x="46" y="0" width="3" height="40" fill="#000" />
                  <rect x="52" y="0" width="4" height="40" fill="#000" />
                  <rect x="58" y="0" width="2" height="40" fill="#000" />
                  <rect x="62" y="0" width="6" height="40" fill="#000" />
                  <rect x="71" y="0" width="3" height="40" fill="#000" />
                  <rect x="76" y="0" width="5" height="40" fill="#000" />
                  <rect x="84" y="0" width="2" height="40" fill="#000" />
                  <rect x="88" y="0" width="6" height="40" fill="#000" />
                  <rect x="96" y="0" width="4" height="40" fill="#000" />
                  <rect x="103" y="0" width="2" height="40" fill="#000" />
                  <rect x="107" y="0" width="5" height="40" fill="#000" />
                  <rect x="115" y="0" width="3" height="40" fill="#000" />
                  <rect x="120" y="0" width="6" height="40" fill="#000" />
                  <rect x="128" y="0" width="2" height="40" fill="#000" />
                  <rect x="132" y="0" width="7" height="40" fill="#000" />
                  <rect x="142" y="0" width="4" height="40" fill="#000" />
                  <rect x="148" y="0" width="3" height="40" fill="#000" />
                  <rect x="154" y="0" width="6" height="40" fill="#000" />
                  <rect x="162" y="0" width="2" height="40" fill="#000" />
                  <rect x="166" y="0" width="5" height="40" fill="#000" />
                  <rect x="174" y="0" width="3" height="40" fill="#000" />
                  <rect x="180" y="0" width="6" height="40" fill="#000" />
                  <rect x="188" y="0" width="2" height="40" fill="#000" />
                  <rect x="192" y="0" width="4" height="40" fill="#000" />
                  <rect x="198" y="0" width="2" height="40" fill="#000" />
                </svg>
              </div>

              <p className="font-mono text-[9.5px] font-black tracking-widest text-black">*{ticket.id}*</p>
              
              <div className="text-[9px] text-slate-800 font-sans leading-tight pt-1">
                <p className="font-bold">¡Gracias por su compra en CrediCel!</p>
                <p className="text-[8px] text-slate-600 mt-0.5">
                  Conserve este ticket para cualquier aclaración o garantía.
                </p>
              </div>

              {/* Feed margin spacing for physical tear-bar */}
              <div className="h-5 no-screen" style={{ height: '20px' }}>
                <span className="text-[8px] text-slate-300 no-print">.</span>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Action Buttons Footer - Screen Only */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0 no-print border-t border-slate-800">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
            title="Volver a mandar a imprimir este ticket (Atajo: P o R)"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Reimprimir</span>
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

      </div>
    </div>
  );
}
