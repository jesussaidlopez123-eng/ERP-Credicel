import React, { useEffect, useState, useCallback } from 'react';
import { 
  CheckCircle2, 
  Printer, 
  X, 
  Store, 
  User, 
  Clock, 
  Smartphone, 
  Phone, 
  FileText, 
  Barcode, 
  ArrowRight,
  Settings2,
  HelpCircle,
  Zap,
  Info
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

  // Printer Paper Width: 58mm (default for POS-5890A-L) or 80mm
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(() => {
    try {
      const saved = localStorage.getItem('erp_pos_printer_size');
      return saved === '80mm' ? '80mm' : '58mm';
    } catch {
      return '58mm';
    }
  });

  const [hasPrinted, setHasPrinted] = useState(false);
  const [showKioskGuide, setShowKioskGuide] = useState(false);

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
  }, [isOpen, ticket?.id, autoPrintEnabled, paperSize]);

  // Keyboard shortcut handler (Enter/Space for next sale, P/R for reprint, Esc to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is inside an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' || e.key === ' ') {
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

  const changePaperSize = (size: '58mm' | '80mm') => {
    setPaperSize(size);
    try {
      localStorage.setItem('erp_pos_printer_size', size);
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
      
      {/* Dynamic Thermal Print Stylesheet tailored for 58mm (POS-5890A-L) and 80mm thermal receipt printers */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === '58mm' ? '58mm auto' : '80mm auto'};
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${paperSize === '58mm' ? '58mm' : '80mm'} !important;
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
            width: ${paperSize === '58mm' ? '56mm' : '78mm'} !important;
            max-width: ${paperSize === '58mm' ? '58mm' : '80mm'} !important;
            padding: ${paperSize === '58mm' ? '1.5mm 2mm 12mm 2mm' : '2mm 4mm 14mm 4mm'} !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: ${paperSize === '58mm' ? '10px' : '11.5px'} !important;
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

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        
        {/* Header - Screen only */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-emerald-800 to-teal-800 text-white shrink-0 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base tracking-tight leading-none">
                  ¡Venta Cobrada Exitosamente!
                </h3>
                <span className="bg-emerald-400/20 text-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-400/30">
                  {paperSize === '58mm' ? 'POS-5890A-L' : '80mm'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 mt-0.5">
                Folio Ticket: <strong className="font-mono font-black text-white">{ticket.id}</strong> • Monto: <strong className="text-white">${ticket.total.toFixed(2)}</strong>
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => handleNextSale(false)}
            className="text-emerald-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-print status & Printer Controls bar - Screen Only */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 shrink-0 no-print space-y-2">
          
          <div className="flex flex-wrap items-center justify-between gap-2">
            
            {/* Status pill */}
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                hasPrinted 
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : autoPrintEnabled
                  ? 'bg-blue-100 text-blue-900 border border-blue-300 animate-pulse'
                  : 'bg-slate-200 text-slate-700 border border-slate-300'
              }`}>
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {hasPrinted 
                    ? `✓ Ticket enviado a la impresora (${paperSize})` 
                    : autoPrintEnabled 
                    ? `Imprimiendo en ${paperSize === '58mm' ? 'POS-5890A-L (58mm)' : '80mm'}...` 
                    : 'Modo manual (Auto-impresión apagada)'}
                </span>
              </span>
            </div>

            {/* Quick format selector and toggle */}
            <div className="flex items-center gap-2">
              
              {/* Size switcher */}
              <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5 border border-slate-300 text-[11px] font-black">
                <button
                  type="button"
                  onClick={() => changePaperSize('58mm')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    paperSize === '58mm'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                  title="Formato estrecho para impresoras térmicas de 58mm como POS-5890A-L"
                >
                  POS-5890A (58mm)
                </button>
                <button
                  type="button"
                  onClick={() => changePaperSize('80mm')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    paperSize === '80mm'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                  title="Formato ancho estándar 80mm"
                >
                  80mm
                </button>
              </div>

              {/* Auto print checkbox */}
              <label className="flex items-center gap-1.5 text-xs text-slate-800 font-bold cursor-pointer select-none bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={autoPrintEnabled}
                  onChange={(e) => toggleAutoPrint(e.target.checked)}
                  className="rounded border-slate-400 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Auto-imprimir</span>
              </label>

              {/* Help Kiosk mode */}
              <button
                type="button"
                onClick={() => setShowKioskGuide(!showKioskGuide)}
                className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                title="Consejos para impresión directa silenciosa sin cuadro de diálogo en Windows/Chrome"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* Kiosk Mode Info Guide Dropdown */}
          {showKioskGuide && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-950 space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between font-black text-blue-900">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600" />
                  💡 Impresión Silenciosa Directa para POS-5890A-L (Modo Kiosco)
                </span>
                <button 
                  onClick={() => setShowKioskGuide(false)}
                  className="text-blue-600 hover:text-blue-900 font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Para que tus tickets se impriman <strong>automáticamente sin abrir el cuadro de diálogo de Windows/Chrome</strong> cada vez:
              </p>
              <ol className="list-decimal list-inside text-[10.5px] text-blue-900 font-medium space-y-0.5 bg-white/70 p-2 rounded-xl border border-blue-200/60 font-mono">
                <li>1. En Windows, establece la <strong>POS-5890A-L</strong> como impresora predeterminada con tamaño de papel <strong>58mm × 210mm / Continuo</strong>.</li>
                <li>2. En el acceso directo de Google Chrome o Edge, añade el parámetro: <code className="bg-blue-100 px-1 py-0.2 rounded font-bold text-blue-950">--kiosk-printing</code> al final de la ruta del destino.</li>
                <li>3. ¡Listo! Al dar cobrar, el ticket saldrá expulsado físicamente al instante sin confirmaciones.</li>
              </ol>
            </div>
          )}

        </div>

        {/* Scrollable Receipt Preview Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-200/70 flex justify-center items-start">
          
          {/* RECEIPT CONTENT (Printable Thermal Element) */}
          <div 
            id="thermal-receipt-container" 
            className={`font-mono text-slate-900 bg-white shadow-lg border border-slate-300 transition-all ${
              paperSize === '58mm' ? 'w-[280px] p-3 text-[11px]' : 'w-[360px] p-5 text-xs'
            }`}
            style={{ minHeight: '340px' }}
          >
            
            {/* Business & Branch Header */}
            <div className="text-center space-y-0.5 pb-2.5 border-b border-dashed border-slate-800">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-black uppercase leading-none">
                CrediCel
              </h2>
              <p className="text-[10px] sm:text-[11px] text-black font-extrabold uppercase">
                PUNTO DE VENTA Y ACCESORIOS
              </p>
              <p className="text-[10.5px] text-slate-800 font-bold">
                Sucursal: {currentBranch.name}
              </p>
              <p className="text-[10px] text-slate-700">
                Atendió: {ticket.operatorName}
              </p>
              <p className="text-[9.5px] text-slate-600">
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
                    <span className="leading-tight pr-1 text-[10.5px]">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span className="shrink-0 text-right font-mono font-bold text-[10.5px]">
                      ${item.totalPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-[9px] text-slate-600 font-sans flex justify-between">
                    <span>P.Unit: ${item.unitPrice.toFixed(2)}</span>
                    <span>Cód: {item.product.code}</span>
                  </div>

                  {/* Specific metadata for Airtime Recharges */}
                  {item.metadata?.phoneNumber && (
                    <div className="text-[9.5px] text-black bg-slate-100 p-1 rounded border border-slate-300 font-mono space-y-0.5 mt-0.5">
                      <div>📱 TEL: <strong className="font-black text-black">{item.metadata.phoneNumber}</strong></div>
                      {item.metadata.carrier && <div>📡 COMPAÑÍA: <strong>{item.metadata.carrier.toUpperCase()}</strong></div>}
                    </div>
                  )}

                  {/* Specific metadata for Equipment / Cell Phone Sales */}
                  {item.metadata?.deviceModel && (
                    <div className="text-[9px] bg-slate-100 p-1 rounded border border-slate-300 text-black space-y-0.5 mt-0.5 font-sans">
                      <div className="font-black text-[9.5px]">
                        {item.metadata.saleType === 'contado' || item.metadata.financingPlatform === 'Contado'
                          ? '📱 CELULAR (CONTADO)'
                          : `🏦 CRÉDITO (${item.metadata.financingPlatform || 'FINANCIERA'})`}
                      </div>
                      {item.metadata.clientName && <div>👤 Cliente: {item.metadata.clientName}</div>}
                      {item.metadata.clientPhone && <div>📞 Tel: {item.metadata.clientPhone}</div>}
                      <div>📱 Modelo: <strong>{item.metadata.deviceModel}</strong></div>
                      {item.metadata.imei && <div>🔢 IMEI: <strong className="font-mono text-black">{item.metadata.imei}</strong></div>}
                      
                      {item.metadata.saleType === 'credito' && item.metadata.financingPlatform !== 'Contado' && item.metadata.fullPrice !== undefined && (
                        <div className="pt-0.5 mt-0.5 border-t border-slate-300 text-[8.5px] space-y-0.2 font-mono">
                          <div className="flex justify-between"><span>Precio Equipo:</span> <strong>${item.metadata.fullPrice.toFixed(2)}</strong></div>
                          <div className="flex justify-between"><span>Enganche Cobrado:</span> <strong>${(item.metadata.downPayment || item.totalPrice).toFixed(2)}</strong></div>
                          <div className="flex justify-between font-bold">
                            <span>Saldo Restante:</span>
                            <strong>${(item.metadata.remainingBalance ?? Math.max(0, item.metadata.fullPrice - (item.metadata.downPayment || item.totalPrice))).toFixed(2)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Specific metadata for Repairs */}
                  {item.metadata?.repairId && (
                    <div className="text-[9px] bg-slate-100 p-1 rounded border border-slate-300 text-black space-y-0.5 mt-0.5 font-sans">
                      <div>🔧 Folio Taller: <strong className="font-mono font-black">{item.metadata.repairId}</strong></div>
                      <div>👤 Cliente: {item.metadata.clientName}</div>
                      <div>💬 Tipo: {item.metadata.repairType === 'anticipo' ? 'Anticipo' : 'Liquidación Final'}</div>
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
              <div className="flex justify-between text-xs sm:text-sm font-black text-black border-b-2 border-black pb-0.5">
                <span>TOTAL:</span>
                <span className="font-mono">${ticket.total.toFixed(2)} MXN</span>
              </div>

              <div className="flex justify-between text-[10px] text-slate-800">
                <span>Forma de Pago:</span>
                <span className="font-black text-black uppercase">{ticket.paymentMethod}</span>
              </div>

              {ticket.paymentMethod === 'Efectivo' && ticket.cashReceived !== undefined && (
                <>
                  <div className="flex justify-between text-[10px] text-slate-700">
                    <span>Efectivo Recibido:</span>
                    <span className="font-mono font-bold text-black">${ticket.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10.5px] font-black text-black">
                    <span>Cambio Devuelto:</span>
                    <span className="font-mono font-black">${(ticket.change || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Barcode Graphic & Footer */}
            <div className="text-center pt-2.5 border-t border-dashed border-slate-800 space-y-1">
              
              {/* Crisp SVG Barcode optimized for 58mm thermal resolution */}
              <div className="flex justify-center items-center py-1">
                <svg className="w-full h-8 max-w-[200px]" viewBox="0 0 200 40" preserveAspectRatio="none">
                  {/* Generated pseudo barcode stripes */}
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

              <p className="font-mono text-[10px] font-black tracking-widest text-black">*{ticket.id}*</p>
              
              <div className="text-[9.5px] text-slate-800 font-sans leading-tight pt-1">
                <p className="font-bold">¡Gracias por su compra en CrediCel!</p>
                <p className="text-[8.5px] text-slate-600 mt-0.5">
                  Conserve este ticket para cualquier aclaración o garantía de productos.
                </p>
              </div>

              {/* Feed margin spacing for physical tear-bar on POS-5890A-L */}
              <div className="h-6 no-screen" style={{ height: '24px' }}>
                <span className="text-[8px] text-slate-300 no-print">.</span>
              </div>

            </div>

          </div>

        </div>

        {/* Modal Action Buttons Footer - Screen Only */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 no-print border-t border-slate-800">
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              title="Volver a mandar a imprimir este ticket (Atajo: Letra P o R)"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Reimprimir Ticket</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <button
              type="button"
              onClick={() => handleNextSale(false)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
              title="Continuar con la siguiente venta (Atajo: Tecla Enter o Espacio)"
            >
              <span>Siguiente Venta</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
