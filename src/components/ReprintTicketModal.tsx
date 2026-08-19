import React, { useState, useMemo, useEffect } from 'react';
import { 
  Printer, 
  Search, 
  X, 
  RotateCcw, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Store, 
  User, 
  Calendar, 
  DollarSign, 
  Hash, 
  ChevronRight,
  Filter
} from 'lucide-react';
import { SaleTicket, Branch, Operator } from '../types';
import TicketReceiptModal from './TicketReceiptModal';

interface ReprintTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesTickets: SaleTicket[];
  currentBranch: Branch;
  currentOperator: Operator;
}

export default function ReprintTicketModal({
  isOpen,
  onClose,
  salesTickets = [],
  currentBranch,
  currentOperator
}: ReprintTicketModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SaleTicket | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Sort tickets by timestamp descending (newest first)
  const sortedTickets = useMemo(() => {
    return [...salesTickets].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });
  }, [salesTickets]);

  // Set default ticket to the most recent one when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setFilterBranchId('all');
      if (sortedTickets.length > 0) {
        setSelectedTicket(sortedTickets[0]);
      } else {
        setSelectedTicket(null);
      }
    }
  }, [isOpen, sortedTickets]);

  // Filtered tickets based on search query and branch
  const filteredTickets = useMemo(() => {
    let list = sortedTickets;

    if (filterBranchId !== 'all') {
      list = list.filter(t => t.branchId === filterBranchId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(t => {
        const idMatch = t.id?.toLowerCase().includes(q) || t.folio?.toLowerCase().includes(q);
        const opMatch = t.operatorName?.toLowerCase().includes(q);
        const itemMatch = t.items?.some(i => 
          i.product?.name?.toLowerCase().includes(q) ||
          i.product?.code?.toLowerCase().includes(q) ||
          i.metadata?.clientName?.toLowerCase().includes(q) ||
          i.metadata?.imei?.toLowerCase().includes(q) ||
          i.metadata?.phoneNumber?.includes(q) ||
          i.metadata?.repairId?.toLowerCase().includes(q)
        );
        return idMatch || opMatch || itemMatch;
      });
    }

    return list;
  }, [sortedTickets, filterBranchId, searchQuery]);

  if (!isOpen) return null;

  const handlePrintTicket = (ticket: SaleTicket) => {
    setSelectedTicket(ticket);
    setIsReceiptModalOpen(true);
  };

  const formatTicketDate = (ts: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch {}
    return ts;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  <span>Reimprimir Tickets de Venta</span>
                  <span className="px-2 py-0.5 bg-indigo-600/60 text-indigo-200 text-[10px] font-extrabold rounded-full">
                    Módulo 1: POS
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Busca por folio, código, cliente o IMEI. Por defecto se preselecciona el último ticket emitido.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ticket por Folio (TCK-...), Cliente, IMEI, Teléfono..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Branch Filter */}
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Todas las Sucursales</option>
                <option value="b-bodega">Bodega</option>
                <option value="b-navojoa">Navojoa</option>
                <option value="b-huatabampo">Huatabampo</option>
              </select>
            </div>
          </div>

          {/* Master-Detail Layout */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
            
            {/* Left Column: Tickets List (7 cols) */}
            <div className="md:col-span-7 border-r border-slate-200 flex flex-col overflow-hidden bg-white">
              <div className="p-2.5 bg-slate-100/70 border-b border-slate-200 text-[11px] font-black text-slate-700 flex justify-between items-center">
                <span>HISTORIAL DE TICKETS ({filteredTickets.length})</span>
                {sortedTickets.length > 0 && (
                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    Último emitido: {sortedTickets[0].id}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {filteredTickets.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">No se encontraron tickets con ese criterio.</p>
                    <p className="text-[11px] text-slate-400">Verifica el número de folio o el nombre del cliente.</p>
                  </div>
                ) : (
                  filteredTickets.map((ticket, idx) => {
                    const isSelected = selectedTicket?.id === ticket.id;
                    const isMostRecent = idx === 0 && !searchQuery && filterBranchId === 'all';
                    const branchName = ticket.branchId === 'b-bodega' ? 'Bodega' : ticket.branchId === 'b-navojoa' ? 'Navojoa' : 'Huatabampo';

                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicket(ticket)}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-400 shadow-xs ring-1 ring-indigo-400'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                              {ticket.id}
                            </span>
                            {isMostRecent && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-extrabold text-[9px] rounded-full uppercase border border-emerald-300">
                                ★ Último
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-bold">
                              {branchName}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-700 font-semibold truncate">
                            {ticket.items.map(i => `${i.quantity}x ${i.product.name}`).join(' • ')}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span>{formatTicketDate(ticket.timestamp)}</span>
                            <span>•</span>
                            <span>{ticket.operatorName}</span>
                            <span>•</span>
                            <span className="font-bold text-slate-700">{ticket.paymentMethod}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-slate-900 font-mono">
                            ${ticket.total.toFixed(2)}
                          </div>
                          <span className="text-[9px] text-indigo-600 font-bold block mt-0.5">
                            {isSelected ? 'Seleccionado' : 'Ver detalle'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Selected Ticket Preview & Action (5 cols) */}
            <div className="md:col-span-5 bg-slate-50 p-4 flex flex-col justify-between overflow-y-auto">
              {selectedTicket ? (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Ticket Seleccionado</span>
                        <h3 className="font-mono font-black text-base text-slate-900">{selectedTicket.id}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total</span>
                        <span className="font-mono font-black text-lg text-emerald-700">${selectedTicket.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-xs space-y-1.5 text-slate-600">
                      <div className="flex justify-between">
                        <span>Fecha y Hora:</span>
                        <strong className="text-slate-900">{formatTicketDate(selectedTicket.timestamp)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Sucursal:</span>
                        <strong className="text-slate-900">{selectedTicket.branchId === 'b-bodega' ? 'Bodega' : selectedTicket.branchId === 'b-navojoa' ? 'Navojoa' : 'Huatabampo'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Cajero / Atendió:</span>
                        <strong className="text-slate-900">{selectedTicket.operatorName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Forma de Pago:</span>
                        <strong className="text-slate-900 font-bold uppercase">{selectedTicket.paymentMethod}</strong>
                      </div>
                    </div>

                    {/* Items Breakdown */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                        Artículos en este Ticket ({selectedTicket.items.length}):
                      </span>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {selectedTicket.items.map((item, i) => (
                          <div key={item.cartItemId || i} className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-0.5">
                            <div className="flex justify-between font-bold text-slate-900">
                              <span className="truncate pr-1">{item.quantity}x {item.product.name}</span>
                              <span className="font-mono">${item.totalPrice.toFixed(2)}</span>
                            </div>
                            {item.metadata?.imei && (
                              <div className="text-[10px] text-slate-600 font-mono">IMEI: {item.metadata.imei}</div>
                            )}
                            {item.metadata?.clientName && (
                              <div className="text-[10px] text-slate-600">Cliente: {item.metadata.clientName}</div>
                            )}
                            {item.metadata?.phoneNumber && (
                              <div className="text-[10px] text-emerald-800 font-mono">Recarga: {item.metadata.phoneNumber} ({item.metadata.carrier})</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Big Action Button: Reimprimir */}
                  <button
                    type="button"
                    onClick={() => handlePrintTicket(selectedTicket)}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Printer className="w-5 h-5 text-amber-300" />
                    <span>Reimprimir Ticket ({selectedTicket.id})</span>
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <Receipt className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">Selecciona un ticket de la lista para reimprimirlo.</p>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between border-t border-slate-800 shrink-0">
            <span className="text-xs text-slate-400">
              Impresión optimizada para rollos térmicos de 58 mm (POS-5890A-L).
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>

      {/* Embedded TicketReceiptModal for actual printing */}
      {selectedTicket && (
        <TicketReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          ticket={selectedTicket}
          currentBranch={currentBranch}
        />
      )}
    </>
  );
}
