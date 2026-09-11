import React, { useEffect, useMemo, useState } from 'react';
import { Fingerprint, Search, Smartphone, X } from 'lucide-react';
import { CreditAccount, InventoryMovement, Product, SaleTicket } from '../types';
import { getBranchDisplayName } from '../data/initialBranches';
import { normalizeImei, traceImei, type ImeiTraceStatus } from '../lib/imeiInventory';

interface ImeiTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  tickets?: SaleTicket[];
  movements?: InventoryMovement[];
  credits?: CreditAccount[];
  initialImei?: string;
}

const STATUS_COPY: Record<ImeiTraceStatus, { label: string; className: string }> = {
  disponible: { label: 'Disponible en inventario', className: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  vendido: { label: 'Vendido — ya no está en inventario', className: 'bg-blue-50 text-blue-900 border-blue-200' },
  baja: { label: 'Dado de baja', className: 'bg-amber-50 text-amber-950 border-amber-200' },
  no_encontrado: { label: 'Sin registro de este IMEI', className: 'bg-slate-100 text-slate-700 border-slate-200' }
};

export default function ImeiTraceModal({
  isOpen,
  onClose,
  products,
  tickets = [],
  movements = [],
  credits = [],
  initialImei = ''
}: ImeiTraceModalProps) {
  const [query, setQuery] = useState(initialImei);

  useEffect(() => {
    if (isOpen) setQuery(initialImei);
  }, [isOpen, initialImei]);

  const result = useMemo(() => {
    const imei = normalizeImei(query);
    if (!imei) return null;
    return traceImei(imei, { products, tickets, movements, credits });
  }, [query, products, tickets, movements, credits]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-extrabold text-base">Trazado de equipo</h3>
              <p className="text-[11px] text-slate-300">Cada IMEI: sucursal actual, venta y movimientos</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              placeholder="Escribe o escanea el IMEI"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {!result && (
            <p className="text-xs text-slate-500 font-medium">
              El IMEI vive en Matriz, Navojoa o Huatabampo. Si se vendió, aquí aparece el ticket y deja de estar en inventario.
            </p>
          )}

          {result && (
            <div className="space-y-3">
              <div className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${STATUS_COPY[result.status].className}`}>
                <p className="font-mono text-sm">{result.imei || '—'}</p>
                <p className="mt-0.5">{STATUS_COPY[result.status].label}</p>
              </div>

              {result.product && (
                <div className="flex items-start gap-2 text-xs">
                  <Smartphone className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-black text-slate-900">{result.product.name}</p>
                    <p className="text-slate-500 font-mono">{result.product.code}</p>
                    {result.status === 'disponible' && result.branchName && (
                      <p className="text-slate-800 font-extrabold mt-1">Ahora está en {result.branchName}</p>
                    )}
                    {result.wasHidden && (
                      <p className="text-amber-800 mt-1">
                        Estaba en una ubicación que no se veía. Quedó en Matriz para que se pueda transferir o vender.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {result.ticket && (
                <p className="text-xs text-slate-700">
                  Ticket <span className="font-mono font-black">{result.ticket.folio || result.ticket.id}</span>
                  {result.ticket.operatorName ? ` · ${result.ticket.operatorName}` : ''}
                  {` · ${getBranchDisplayName(result.ticket.branchId)}`}
                </p>
              )}

              {result.credit && (
                <p className="text-xs text-slate-700">
                  Crédito de {result.credit.clientName} · saldo ${Number(result.credit.remainingBalance || 0).toFixed(2)}
                </p>
              )}

              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 mb-1.5">Historial</p>
                {result.events.length === 0 ? (
                  <p className="text-xs text-slate-400">Aún no hay movimientos guardados de este IMEI.</p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto space-y-1.5">
                    {result.events.map((ev, idx) => (
                      <li key={`${ev.at}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <p className="text-[10px] font-bold text-slate-500">
                          {ev.at ? new Date(ev.at).toLocaleString('es-MX') : 'Sin fecha'}
                          {ev.branchName ? ` · ${ev.branchName}` : ''}
                        </p>
                        <p className="text-xs font-bold text-slate-800">{ev.label}</p>
                        {ev.operatorName && <p className="text-[10px] text-slate-500">{ev.operatorName}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
