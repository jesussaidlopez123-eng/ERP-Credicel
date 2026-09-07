import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { RepairCostKind, RepairRecord } from '../types';
import { formatMoney } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import {
  addRepairCostLine,
  removeRepairCostLine,
  repairInternalCost,
  stampRepairLabel
} from '../lib/repairUtils';
import { REPAIR_COST_KIND_LABEL, repairCustomerMargin } from '../lib/repairFinance';

interface RepairCostLinesEditorProps {
  record: RepairRecord;
  operatorName: string;
  onUpdate: (record: RepairRecord) => void | Promise<void>;
  busy?: boolean;
}

const KINDS: RepairCostKind[] = ['refaccion', 'mano_obra', 'otro'];

export default function RepairCostLinesEditor({
  record,
  operatorName,
  onUpdate,
  busy = false
}: RepairCostLinesEditorProps) {
  const [kind, setKind] = useState<RepairCostKind>('refaccion');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const interno = repairInternalCost(record);
  const margen = repairCustomerMargin(record);

  const handleAdd = async () => {
    if (busy || saving) return;
    setError(null);
    try {
      const updated = addRepairCostLine(record, {
        kind,
        concept,
        amount: parseFloat(amount),
        at: trustedIso(),
        by: operatorName
      });
      setSaving(true);
      await onUpdate(updated);
      setConcept('');
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el costo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (lineId: string) => {
    if (busy || saving) return;
    setSaving(true);
    try {
      await onUpdate(removeRepairCostLine(record, lineId));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">
            Costos / gastos de la orden
          </p>
          <p className="text-[11px] text-slate-500">
            Refacción y mano de obra de esta orden. Pasan al registro semanal cuando se entrega el equipo.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <span>
            Interno <strong className="text-slate-900">${formatMoney(interno)}</strong>
          </span>
          <span>
            Precio cliente <strong className="text-slate-900">${formatMoney(record.totalCost)}</strong>
          </span>
          <span>
            Margen{' '}
            <strong className={margen >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
              ${formatMoney(margen)}
            </strong>
          </span>
        </div>
      </div>

      {(record.costLines || []).length > 0 && (
        <ul className="space-y-1.5">
          {(record.costLines || []).map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">
                  {REPAIR_COST_KIND_LABEL[line.kind]} · {line.concept}
                </p>
                <p className="text-slate-500">
                  {stampRepairLabel(line.at, undefined)} · {line.by || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-black text-slate-900">${formatMoney(line.amount)}</span>
                <button
                  type="button"
                  onClick={() => void handleRemove(line.id)}
                  disabled={saving || busy}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                  aria-label="Quitar costo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as RepairCostKind)}
          className="px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {REPAIR_COST_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Concepto (display, flex, envío…)"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          className="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Monto"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      {error && (
        <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {saving ? 'Guardando…' : 'Agregar costo interno'}
        </button>
      </div>
    </div>
  );
}
