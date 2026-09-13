import React, { useEffect, useState } from 'react';
import { AlertTriangle, History, Loader2, RotateCcw, X } from 'lucide-react';
import type { Operator } from '../types';
import { fetchInventoryRestoreSources, persistInventoryRestore } from '../lib/firebase';
import { authorizeWithOperatorPassword } from '../lib/inventoryAuth';
import {
  RESTORE_BRANCH_IDS,
  planInventoryRestore,
  summarizeRestoreActions,
  type InventoryRestoreReport
} from '../lib/inventoryRestore';
import { getBranchDisplayName } from '../data/initialBranches';

type Props = {
  open: boolean;
  currentOperator?: Operator;
  onClose: () => void;
  onApplied?: () => void;
};

export default function InventoryRestoreModal({ open, currentOperator, onClose, onApplied }: Props) {
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<InventoryRestoreReport | null>(null);
  const [rawProducts, setRawProducts] = useState<Awaited<ReturnType<typeof fetchInventoryRestoreSources>>['products']>([]);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    setReport(null);
    fetchInventoryRestoreSources()
      .then((sources) => {
        if (cancelled) return;
        setRawProducts(sources.products);
        setReport(planInventoryRestore(sources.products, sources.movements, sources.tickets));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudo leer el kardex de la nube.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const byBranch = report ? summarizeRestoreActions(report.actions) : null;

  const handleApply = async () => {
    if (!report || report.actions.length === 0) return;
    const denied = authorizeWithOperatorPassword(password, currentOperator);
    if (denied) {
      setAuthError(denied);
      return;
    }
    setApplying(true);
    setError('');
    setAuthError('');
    try {
      await persistInventoryRestore(rawProducts, report.actions, currentOperator?.name || 'Sistema');
      onApplied?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron devolver las existencias.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-extrabold text-base">Existencias vs kardex</h3>
              <p className="text-[11px] font-medium text-slate-300">
                Compara Huatabampo, Navojoa y Matriz con el historial completo de la nube.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {busy && (
            <p className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Leyendo catálogo, kardex y ventas de la nube…
            </p>
          )}

          {error && (
            <p className="flex items-start gap-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          {report && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RESTORE_BRANCH_IDS.map((branch) => (
                  <div key={branch} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {getBranchDisplayName(branch)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-900">
                      Equipos: {report.current[branch].phones} ahora · {report.kardex[branch].phones} kardex
                    </p>
                    <p className="text-xs font-bold text-slate-900">
                      Accesorios: {report.current[branch].accessories} ahora · {report.kardex[branch].accessories} kardex
                    </p>
                    <p className="mt-1 text-[11px] font-extrabold text-amber-800">
                      {byBranch?.[branch] || 0} corrección(es)
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] font-medium text-slate-500">
                Se leyeron {report.movementCount} movimientos y {report.ticketCount} tickets. No se tocan
                IMEI ya vendidos ni se baja stock si hoy hay más que en el kardex.
              </p>

              {report.actions.length === 0 ? (
                <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  El kardex no encontró existencias faltantes en Huatabampo ni en Navojoa. Si la pantalla
                  seguía en ceros, era un filtro de IMEI vendidos: recarga con esta versión.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs font-semibold text-slate-800">
                  {report.actions.slice(0, 40).map((action) => (
                    <li key={`${action.productId}-${action.branchId}-${action.kind}`} className="rounded-lg border border-slate-200 px-3 py-2">
                      <span className="font-black">{action.branchName}</span>
                      {' · '}
                      {action.productCode} {action.productName}
                      {' · '}
                      {action.detail}
                    </li>
                  ))}
                  {report.actions.length > 40 && (
                    <li className="text-slate-500">… y {report.actions.length - 40} más</li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end items-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cerrar
          </button>
          {report && report.actions.length > 0 && (
            <div className="flex-1 min-w-[180px] mr-auto">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError('');
                }}
                placeholder="Contraseña del operador"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
              {authError && <p className="mt-1 text-[11px] font-bold text-red-600">{authError}</p>}
            </div>
          )}
          <button
            type="button"
            disabled={!report || report.actions.length === 0 || applying}
            onClick={() => void handleApply()}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-extrabold cursor-pointer"
          >
            {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Devolver faltantes
          </button>
        </div>
      </div>
    </div>
  );
}
