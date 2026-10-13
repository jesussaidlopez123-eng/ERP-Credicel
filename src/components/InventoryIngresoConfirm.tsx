import React from 'react';
import { Check, Headphones, MapPin, Smartphone } from 'lucide-react';
import type { IngresoConfirmLine } from '../lib/inventoryLote';

export type { IngresoConfirmLine };

interface InventoryIngresoConfirmProps {
  kind: 'accesorio' | 'equipo';
  destBranchName: string;
  lines: IngresoConfirmLine[];
  onAccept: () => void;
  onBack: () => void;
}

export default function InventoryIngresoConfirm({
  kind,
  destBranchName,
  lines,
  onAccept,
  onBack
}: InventoryIngresoConfirmProps) {
  const isEquipo = kind === 'equipo';
  const total = lines.reduce((n, line) => n + line.qty, 0);
  const unit = isEquipo ? (total === 1 ? 'equipo' : 'equipos') : total === 1 ? 'pieza' : 'piezas';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className={`px-5 py-4 text-white ${isEquipo ? 'bg-blue-900' : 'bg-emerald-800'}`}>
          <p className="text-[10px] font-black uppercase tracking-wide text-white/70">Último paso</p>
          <h3 className="font-extrabold text-base">Confirmar ingreso</h3>
        </div>

        <div className="p-5 space-y-4">
          <div
            className={`rounded-2xl border-2 px-4 py-3 flex items-start gap-3 ${
              isEquipo ? 'bg-blue-50 border-blue-400' : 'bg-emerald-50 border-emerald-400'
            }`}
          >
            <MapPin className={`w-6 h-6 shrink-0 mt-0.5 ${isEquipo ? 'text-blue-800' : 'text-emerald-800'}`} />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Van a</p>
              <p className="text-xl font-black text-slate-950 leading-tight">{destBranchName}</p>
              <p className="text-xs font-bold text-slate-600 mt-0.5">
                {total} {unit}
                {lines.length > 1 ? ` · ${lines.length} renglones` : ''}
              </p>
            </div>
          </div>

          <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {lines.map((line, idx) => (
              <li
                key={`${line.code || line.name}-${idx}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  {isEquipo ? (
                    <Smartphone className="w-4 h-4 text-blue-800 shrink-0 mt-0.5" />
                  ) : (
                    <Headphones className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {line.name}
                      {line.isNew ? (
                        <span className="ml-1 text-[10px] font-black uppercase text-amber-800">nuevo</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {line.code ? `[${line.code}] · ` : ''}
                      {line.qty} {isEquipo ? (line.qty === 1 ? 'IMEI' : 'IMEI') : line.qty === 1 ? 'pza' : 'pzas'}
                    </p>
                    {line.imeis && line.imeis.length > 0 && (
                      <p className="mt-1 font-mono text-[10px] font-bold text-slate-700 break-all">
                        {line.imeis.slice(0, 8).join(' · ')}
                        {line.imeis.length > 8 ? ` · +${line.imeis.length - 8}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-[11px] font-semibold text-slate-500">
            Al aceptar, el stock queda en {destBranchName}. Si la sucursal está mal, pulse Volver.
          </p>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              autoFocus
              onClick={onAccept}
              className={`px-5 py-2.5 rounded-xl text-xs font-black text-white cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                isEquipo ? 'bg-blue-800 hover:bg-blue-900' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <Check className="w-4 h-4" />
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
