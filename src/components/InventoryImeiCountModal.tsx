import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ScanLine, Smartphone, X } from 'lucide-react';
import { InventoryMovement, Product, SaleTicket } from '../types';
import { ALL_BRANCHES, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { imeisEqual } from '../lib/imeiInventory';
import {
  applyImeiCountScan,
  expectedImeisForCount,
  normalizeScannedImei,
  type ImeiCountExtra
} from '../lib/inventoryImeiCount';

interface InventoryImeiCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  salesTickets?: SaleTicket[];
  inventoryMovements?: InventoryMovement[];
  initialBranchId?: string;
}

function extraLabel(row: ImeiCountExtra): string {
  if (row.kind === 'other_branch') {
    return `Está en ${row.branchName || 'otra sucursal'}${row.model ? ` · ${row.model}` : ''}`;
  }
  if (row.kind === 'sold') {
    return 'Ya vendido, no debería estar en anaquel';
  }
  return 'En físico, no está en el sistema';
}

export default function InventoryImeiCountModal({
  isOpen,
  onClose,
  products,
  salesTickets = [],
  inventoryMovements = [],
  initialBranchId
}: InventoryImeiCountModalProps) {
  const [branchId, setBranchId] = useState(
    hasCashTill(initialBranchId) ? normalizeBranchId(initialBranchId) : 'b-matriz'
  );
  const [draft, setDraft] = useState('');
  const [scanned, setScanned] = useState<string[]>([]);
  const [flash, setFlash] = useState<string>('');
  const [lastHit, setLastHit] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!isOpen) return;
    setBranchId(hasCashTill(initialBranchId) ? normalizeBranchId(initialBranchId) : 'b-matriz');
    setDraft('');
    setScanned([]);
    setFlash('');
    setLastHit('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen, initialBranchId]);

  const expected = useMemo(
    () => expectedImeisForCount(products, branchId, inventoryMovements, salesTickets),
    [products, branchId, inventoryMovements, salesTickets]
  );

  const result = useMemo(
    () =>
      applyImeiCountScan({
        expected,
        scanned,
        products,
        tickets: salesTickets,
        movements: inventoryMovements,
        branchId
      }),
    [expected, scanned, products, salesTickets, inventoryMovements, branchId]
  );

  useEffect(() => {
    if (!lastHit) return;
    const el = rowRefs.current[lastHit];
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [lastHit, result.foundCount]);

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const jumpToExpected = (clean: string) => {
    const match = expected.find((row) => imeisEqual(row.imei, clean));
    if (!match) return match;
    setLastHit(match.imei);
    const el = rowRefs.current[match.imei];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
    return match;
  };

  const pushImei = (raw: string) => {
    const clean = normalizeScannedImei(raw);
    if (!clean) {
      setFlash('Escanee o escriba un IMEI.');
      return;
    }
    if (scanned.some((item) => imeisEqual(item, clean))) {
      jumpToExpected(clean);
      setFlash('Ese IMEI ya se contó.');
      setDraft('');
      focusInput();
      return;
    }
    setScanned((prev) => [...prev, clean]);
    setDraft('');
    setFlash('');
    jumpToExpected(clean);
    focusInput();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl max-h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="px-4 sm:px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400/20 text-amber-300 rounded-2xl border border-amber-300/30">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">IMEI</h2>
              <p className="text-[11px] text-slate-300 font-medium">
                Conteo físico por sucursal. Verde = está. Sin marcar = en sistema, no en anaquel.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 border-b border-slate-200 space-y-3 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="sm:col-span-1 text-xs font-extrabold text-slate-700">
              Sucursal
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setScanned([]);
                  setDraft('');
                  setFlash('');
                  setLastHit('');
                }}
                className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                {ALL_BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2 text-xs font-extrabold text-slate-700">
              Ingresar IMEI
              <div className="mt-1 flex gap-2">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraft(next);
                    const clean = normalizeScannedImei(next);
                    if (/^\d{15}$/.test(clean)) pushImei(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    pushImei(draft);
                  }}
                  placeholder="Escanee o escriba el IMEI y pulse Enter"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  autoComplete="off"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={() => pushImei(draft)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Marcar
                </button>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-extrabold">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">
              En sistema {result.rows.length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-950">
              Contados {result.foundCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-200 border border-slate-300 text-slate-800">
              Sin marcar {result.missingCount}
            </span>
            {result.extras.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-950">
                Alerta {result.extras.length}
              </span>
            )}
          </div>
          {flash && <p className="text-xs font-bold text-amber-800">{flash}</p>}
        </div>

        {result.extras.length > 0 && (
          <div className="px-4 py-3 bg-rose-50 border-b border-rose-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-black text-rose-950">
                  En físico, no corresponden a esta sucursal
                </p>
                <ul className="mt-1.5 space-y-1">
                  {result.extras.map((row) => (
                    <li key={row.imei} className="text-xs font-bold text-rose-900 font-mono">
                      {row.imei}
                      <span className="ml-2 font-sans font-semibold text-rose-800">{extraLabel(row)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 sm:p-4">
          {result.rows.length === 0 ? (
            <p className="text-sm text-slate-500 font-medium text-center py-10">
              No hay equipos en existencia en esta sucursal.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {result.rows.map((row) => (
                <li
                  key={row.imei}
                  ref={(node) => {
                    rowRefs.current[row.imei] = node;
                  }}
                  data-imei={row.imei}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs transition-shadow ${
                    row.found
                      ? lastHit === row.imei
                        ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-400 shadow-sm'
                        : 'bg-emerald-50 border-emerald-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-extrabold truncate ${row.found ? 'text-emerald-950 underline decoration-emerald-600' : 'text-slate-800'}`}>
                      {row.model}
                    </p>
                    <p className="text-[11px] text-slate-500 font-bold">
                      {row.code} · ingreso {row.enteredAtLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-mono font-black ${row.found ? 'text-emerald-900 underline' : 'text-slate-700'}`}>
                      {row.imei}
                    </span>
                    {row.found ? (
                      <Check className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500 font-medium">
            Los sin marcar están en el sistema y no se escanearon.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
