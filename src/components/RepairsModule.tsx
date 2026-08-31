import React, { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  History,
  PackageCheck,
  Pencil,
  Search,
  Store,
  Wrench
} from 'lucide-react';
import { Branch, Operator, RepairRecord } from '../types';
import { COMMERCIAL_BRANCHES, getBranchDisplayName, normalizeBranchId } from '../data/initialBranches';
import { formatMoney, money } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import {
  applyRepairCost,
  isPendingRepair,
  matchesRepairSearch,
  repairStatusLabel,
  stampRepairLabel
} from '../lib/repairUtils';
import RepairHistoryPanel, { CancelRepairDialog } from './RepairHistoryPanel';

interface RepairsModuleProps {
  repairRecords: RepairRecord[];
  currentBranch: Branch;
  currentOperator: Operator;
  onUpdateRepairRecord: (record: RepairRecord) => void | Promise<void>;
  onCancelRepairRecord?: (record: RepairRecord, reason: string) => void | Promise<void>;
}

type TabId = 'pendientes' | 'historial';

export default function RepairsModule({
  repairRecords,
  currentBranch,
  currentOperator,
  onUpdateRepairRecord,
  onCancelRepairRecord
}: RepairsModuleProps) {
  const isAdmin = currentOperator.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabId>('pendientes');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState('');
  const [costNote, setCostNote] = useState('');
  const [costError, setCostError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RepairRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const scopedRecords = useMemo(() => {
    return repairRecords.filter((r) => {
      if (selectedBranchId === 'all') return true;
      return normalizeBranchId(r.branchId) === normalizeBranchId(selectedBranchId);
    });
  }, [repairRecords, selectedBranchId]);

  const pendingRepairs = useMemo(() => {
    return scopedRecords
      .filter(isPendingRepair)
      .filter((r) => matchesRepairSearch(r, searchQuery))
      .sort((a, b) =>
        String(b.receivedAtIso || b.receivedAt || '').localeCompare(
          String(a.receivedAtIso || a.receivedAt || '')
        )
      );
  }, [scopedRecords, searchQuery]);

  const pendingStats = useMemo(() => {
    const allPending = scopedRecords.filter(isPendingRepair);
    const sinCosto = allPending.filter((r) => money(r.totalCost) <= 0).length;
    const listos = allPending.filter((r) => r.status === 'listo').length;
    const saldo = allPending.reduce((sum, r) => sum + money(r.pendingBalance), 0);
    return {
      enTaller: allPending.length,
      sinCosto,
      listos,
      saldo
    };
  }, [scopedRecords]);

  const openCostEditor = (record: RepairRecord) => {
    setEditingId(record.id);
    setCostDraft(record.totalCost > 0 ? String(record.totalCost) : '');
    setCostNote('');
    setCostError(null);
  };

  const handleSaveCost = async (record: RepairRecord) => {
    if (savingId) return;
    setCostError(null);
    const parsed = parseFloat(costDraft);
    if (!Number.isFinite(parsed)) {
      setCostError('Escribe el costo de la reparación.');
      return;
    }
    try {
      const updated = applyRepairCost(
        record,
        parsed,
        currentOperator.name,
        trustedIso(),
        costNote
      );
      setSavingId(record.id);
      await onUpdateRepairRecord(updated);
      setEditingId(null);
      setCostDraft('');
      setCostNote('');
    } catch (err) {
      setCostError(err instanceof Error ? err.message : 'No se pudo guardar el costo.');
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkReady = async (record: RepairRecord) => {
    if (savingId) return;
    setSavingId(record.id);
    try {
      await onUpdateRepairRecord({
        ...record,
        status: record.status === 'listo' ? 'en_taller' : 'listo'
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !onCancelRepairRecord) return;
    await onCancelRepairRecord(cancelTarget, cancelReason);
    setCancelTarget(null);
    setCancelReason('');
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white rounded-2xl p-5 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Reparaciones</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Equipos que siguen en taller hasta hoy, costos e historial. El cobro sigue en el punto de venta.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="En taller" value={String(pendingStats.enTaller)} hint="Pendientes de entregar" />
          <SummaryCard
            label="Sin costo"
            value={String(pendingStats.sinCosto)}
            hint="Hay que capturar el precio"
            accent={pendingStats.sinCosto > 0 ? 'amber' : 'slate'}
          />
          <SummaryCard
            label="Listos"
            value={String(pendingStats.listos)}
            hint="Para recoger en sucursal"
          />
          <SummaryCard
            label="Saldo por cobrar"
            value={`$${formatMoney(pendingStats.saldo)}`}
            hint="Al entregar en caja"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-200">
          {([
            ['pendientes', 'Pendientes', pendingStats.enTaller],
            ['historial', 'Historial', scopedRecords.filter((r) => !isPendingRepair(r)).length]
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === id
                  ? 'bg-[#0047AB] text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {id === 'pendientes' ? <Wrench className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
              {label}
              <span className={`text-[10px] px-1.5 rounded-full ${activeTab === id ? 'bg-white/20' : 'bg-white text-slate-500'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Store className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700 shrink-0">Sucursal:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full sm:w-64 bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las sucursales</option>
            {COMMERCIAL_BRANCHES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'pendientes' && (
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por folio, cliente, teléfono o modelo…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {activeTab === 'pendientes' && (
        <div className="space-y-3">
          {pendingRepairs.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
              <PackageCheck className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No hay reparaciones pendientes.</p>
              <p className="text-xs text-slate-400">
                Las recepciones se capturan en el punto de venta. Los equipos entregados están en Historial.
              </p>
            </div>
          ) : (
            pendingRepairs.map((record) => {
              const editing = editingId === record.id;
              const sinCosto = money(record.totalCost) <= 0;
              const listo = record.status === 'listo';
              return (
                <article
                  key={record.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-slate-900 text-amber-400 font-mono font-extrabold text-xs rounded-lg">
                        {record.id}
                      </span>
                      <span className="text-sm font-extrabold text-slate-900">{record.deviceModel}</span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                        {getBranchDisplayName(record.branchId)}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          listo
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {repairStatusLabel(record.status)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {stampRepairLabel(record.receivedAtIso, record.receivedAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                    <div>
                      <p className="text-slate-500 font-medium">Cliente</p>
                      <p className="font-bold text-slate-900">
                        {record.clientName} ({record.clientPhone})
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Falla / servicio</p>
                      <p className="font-bold text-slate-800">{record.issueDescription}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Contraseña / patrón</p>
                      <p className="font-bold text-slate-800">{record.passcodePattern || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Recibió</p>
                      <p className="font-bold text-slate-800">{record.operatorName}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Costo:</span>{' '}
                        <span className={`font-bold ${sinCosto ? 'text-amber-700' : 'text-slate-900'}`}>
                          {sinCosto ? 'Sin capturar' : `$${formatMoney(record.totalCost)}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Anticipo:</span>{' '}
                        <span className="font-bold text-emerald-700">${formatMoney(record.advancePayment)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Saldo:</span>{' '}
                        <span className="font-black text-amber-700 text-sm">
                          ${formatMoney(record.pendingBalance)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {onCancelRepairRecord && isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelTarget(record);
                            setCancelReason('');
                          }}
                          className="px-3 py-2 border border-slate-300 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Dar de baja
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleMarkReady(record)}
                        disabled={savingId === record.id}
                        className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {listo ? 'Volver a taller' : 'Marcar listo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => (editing ? setEditingId(null) : openCostEditor(record))}
                        className="px-3 py-2 bg-[#0047AB] hover:bg-[#003d93] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        {sinCosto ? <DollarSign className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                        {sinCosto ? 'Agregar costo' : 'Modificar costo'}
                      </button>
                    </div>
                  </div>

                  {editing && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Costo total de la reparación
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            autoFocus
                            value={costDraft}
                            onChange={(e) => setCostDraft(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Anticipo ya cobrado
                          </label>
                          <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-800">
                            ${formatMoney(record.advancePayment)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Nuevo saldo
                          </label>
                          <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-amber-800">
                            ${formatMoney(Math.max(0, money(parseFloat(costDraft) || 0) - money(record.advancePayment)))}
                          </div>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Nota opcional (ej. se cambió display, no solo revisión)"
                        value={costNote}
                        onChange={(e) => setCostNote(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      {costError && (
                        <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                          {costError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveCost(record)}
                          disabled={savingId === record.id}
                          className="px-4 py-2 bg-[#0047AB] hover:bg-[#003d93] disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          {savingId === record.id ? 'Guardando…' : 'Guardar costo'}
                        </button>
                      </div>
                    </div>
                  )}

                  {(record.costUpdates || []).length > 0 && !editing && (
                    <p className="text-[11px] text-slate-500">
                      Último cambio:{' '}
                      ${formatMoney(record.costUpdates![record.costUpdates!.length - 1].previousTotal)} → $
                      {formatMoney(record.costUpdates![record.costUpdates!.length - 1].newTotal)} por{' '}
                      {record.costUpdates![record.costUpdates!.length - 1].by}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <RepairHistoryPanel
            records={scopedRecords}
            exportLabel={`admin-${selectedBranchId}`}
            showBranch
            isAdmin={isAdmin}
            onCancelRepairRecord={onCancelRepairRecord}
          />
        </div>
      )}

      {cancelTarget && (
        <CancelRepairDialog
          record={cancelTarget}
          reason={cancelReason}
          onReasonChange={setCancelReason}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => void handleConfirmCancel()}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent = 'slate'
}: {
  label: string;
  value: string;
  hint: string;
  accent?: 'slate' | 'amber';
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        accent === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="text-lg font-black text-slate-900 mt-0.5">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
    </div>
  );
}
