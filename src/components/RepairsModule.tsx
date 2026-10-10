import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  PackageCheck,
  Search,
  Store
} from 'lucide-react';
import { Branch, Operator, RepairRecord } from '../types';
import { COMMERCIAL_BRANCHES, getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { normalizeRole } from '../lib/roles';
import { formatMoney, money } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import { safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import {
  hasRefaccionCost,
  isPendingRepair,
  markRepairDelivered,
  markRepairReadyForDelivery,
  matchesRepairSearch,
  needsRepairCostCapture,
  stampRepairLabel,
  workStageLabel,
  workStageOf
} from '../lib/repairUtils';
import RepairCostLinesEditor from './RepairCostLinesEditor';
import { CancelRepairDialog } from './RepairHistoryPanel';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface RepairsModuleProps {
  repairRecords: RepairRecord[];
  currentBranch: Branch;
  currentOperator: Operator;
  onUpdateRepairRecord: (record: RepairRecord) => void | Promise<void>;
  onCancelRepairRecord?: (record: RepairRecord, reason: string) => void | Promise<void>;
  embedded?: boolean;
  onLoadOlderRepairs?: () => void;
  repairsHasMore?: boolean;
  repairsLoading?: boolean;
  focusCostDue?: boolean;
  onFocusCostDueConsumed?: () => void;
}

type TabId = 'refaccion' | 'entrega';

function RepairsModule({
  repairRecords,
  currentBranch,
  currentOperator,
  onUpdateRepairRecord,
  onCancelRepairRecord,
  embedded = false,
  focusCostDue = false,
  onFocusCostDueConsumed
}: RepairsModuleProps) {
  const role = normalizeRole(currentOperator.role);
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const [activeTab, setActiveTab] = useState<TabId>('refaccion');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    hasCashTill(currentBranch.id) ? normalizeBranchId(currentBranch.id) : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 160);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RepairRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deliverError, setDeliverError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusCostDue) return;
    setActiveTab('refaccion');
    onFocusCostDueConsumed?.();
  }, [focusCostDue, onFocusCostDueConsumed]);

  useEffect(() => {
    if (isManager && !isAdmin) {
      setSelectedBranchId(normalizeBranchId(currentBranch.id));
    }
  }, [isManager, isAdmin, currentBranch.id]);

  const scopedRecords = useMemo(() => {
    return repairRecords.filter((r) => {
      if (selectedBranchId === 'all') return true;
      return normalizeBranchId(r.branchId) === normalizeBranchId(selectedBranchId);
    });
  }, [repairRecords, selectedBranchId]);

  const pendingRepairs = useMemo(() => {
    return scopedRecords
      .filter(isPendingRepair)
      .filter((r) => matchesRepairSearch(r, debouncedSearch))
      .sort((a, b) =>
        String(b.receivedAtIso || b.receivedAt || '').localeCompare(
          String(a.receivedAtIso || a.receivedAt || '')
        )
      );
  }, [scopedRecords, debouncedSearch]);

  const refaccionQueue = useMemo(() => {
    const open = scopedRecords.filter(
      (r) =>
        (isPendingRepair(r) || needsRepairCostCapture(r)) && matchesRepairSearch(r, debouncedSearch)
    );
    return open.sort((a, b) => {
      const aMissing = hasRefaccionCost(a) ? 1 : 0;
      const bMissing = hasRefaccionCost(b) ? 1 : 0;
      if (aMissing !== bMissing) return aMissing - bMissing;
      return String(b.receivedAtIso || b.receivedAt || '').localeCompare(
        String(a.receivedAtIso || a.receivedAt || '')
      );
    });
  }, [scopedRecords, debouncedSearch]);

  const pendingStats = useMemo(() => {
    const allPending = scopedRecords.filter(isPendingRepair);
    return {
      enTaller: allPending.length,
      sinRefaccion: allPending.filter((r) => !hasRefaccionCost(r)).length +
        scopedRecords.filter(needsRepairCostCapture).length,
      saldo: allPending.reduce((sum, r) => sum + money(r.pendingBalance), 0)
    };
  }, [scopedRecords]);

  if (!isAdmin && !isManager) return null;

  const handleDeliver = async (record: RepairRecord) => {
    if (savingId) return;
    setDeliverError(null);
    if (money(record.pendingBalance) > 0) {
      setDeliverError('Cobra el saldo en el punto de venta. El equipo se marca entregado cuando el cobro queda hecho.');
      setOpenOrderId(record.id);
      return;
    }
    const nowIso = trustedIso();
    try {
      setSavingId(record.id);
      await onUpdateRepairRecord(
        markRepairDelivered(
          record,
          currentOperator.name,
          nowIso,
          `${safeFormatDate(nowIso)} ${safeFormatTime(nowIso)}`
        )
      );
      setOpenOrderId(null);
    } catch (err) {
      setDeliverError(err instanceof Error ? err.message : 'No se pudo entregar el equipo.');
    } finally {
      setSavingId(null);
    }
  };

  const handleReadyForDelivery = async (record: RepairRecord) => {
    if (savingId) return;
    setSavingId(record.id);
    try {
      await onUpdateRepairRecord(markRepairReadyForDelivery(record));
      setActiveTab('entrega');
      setOpenOrderId(record.id);
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

  const listForTab = activeTab === 'refaccion' ? refaccionQueue : pendingRepairs;

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-4 pb-12'}>
      <div className={`bg-white rounded-xl border border-slate-200 ${embedded ? 'p-2.5' : 'p-3'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <h1 className="text-sm font-semibold text-slate-900">Taller</h1>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <SummaryCard label="En taller" value={String(pendingStats.enTaller)} />
          <SummaryCard
            label="Sin refacción"
            value={String(pendingStats.sinRefaccion)}
            accent={pendingStats.sinRefaccion > 0 ? 'amber' : 'slate'}
          />
          <SummaryCard label="Saldo por cobrar" value={`$${formatMoney(pendingStats.saldo)}`} />
        </div>

        <div className="tool-seg mt-3">
          {([
            ['refaccion', 'Costo de refacción', pendingStats.sinRefaccion],
            ['entrega', 'Entrega', pendingStats.enTaller]
          ] as Array<[TabId, string, number]>).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              data-active={activeTab === id}
              onClick={() => setActiveTab(id)}
            >
              {id === 'refaccion' ? (
                <DollarSign className="w-3.5 h-3.5" />
              ) : (
                <PackageCheck className="w-3.5 h-3.5" />
              )}
              {label}
              <span className="text-[10px] text-slate-500">{count}</span>
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
            {isAdmin && <option value="all">Todas las sucursales</option>}
            {COMMERCIAL_BRANCHES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

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
      </div>

      {activeTab === 'refaccion' && pendingStats.sinRefaccion > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-950">
            {pendingStats.sinRefaccion} folio{pendingStats.sinRefaccion === 1 ? '' : 's'} sin costo de refacción
          </p>
        </div>
      )}

      {deliverError && activeTab === 'entrega' && (
        <p className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2">
          {deliverError}
        </p>
      )}

      {listForTab.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
          <PackageCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            {activeTab === 'refaccion' ? 'Nada pendiente de refacción' : 'Sin equipos en taller'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {listForTab.map((record) => {
            const open = openOrderId === record.id;
            const missingPart = !hasRefaccionCost(record);
            return (
              <article
                key={record.id}
                className={`bg-white border rounded-xl p-3 space-y-3 ${
                  open ? 'border-[#0047AB]/40' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenOrderId(open ? null : record.id)}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-slate-900 text-amber-400 font-mono font-semibold text-xs rounded-md">
                        {record.id}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{record.deviceModel}</span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                        {getBranchDisplayName(record.branchId)}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                        {workStageLabel(workStageOf(record))}
                      </span>
                      {missingPart && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                          Sin refacción
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {stampRepairLabel(record.receivedAtIso, record.receivedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {record.clientName} · {record.clientPhone} · {record.issueDescription}
                  </p>
                </button>

                {open && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
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

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span>
                        Precio: <strong className="text-slate-900">${formatMoney(record.totalCost)}</strong>
                      </span>
                      <span>
                        Anticipo:{' '}
                        <strong className="text-emerald-700">${formatMoney(record.advancePayment)}</strong>
                      </span>
                      <span>
                        Saldo:{' '}
                        <strong className="text-amber-700">${formatMoney(record.pendingBalance)}</strong>
                      </span>
                    </div>

                    {activeTab === 'refaccion' && (
                      <RepairCostLinesEditor
                        record={record}
                        operatorName={currentOperator.name}
                        onUpdate={onUpdateRepairRecord}
                        busy={savingId === record.id}
                        allowedKinds={['refaccion']}
                      />
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
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
                      {activeTab === 'refaccion' && isPendingRepair(record) && (
                        <button
                          type="button"
                          onClick={() => void handleReadyForDelivery(record)}
                          disabled={savingId === record.id}
                          className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-60"
                        >
                          Pasar a entrega
                        </button>
                      )}
                      {activeTab === 'entrega' && isPendingRepair(record) && (
                        <button
                          type="button"
                          onClick={() => void handleDeliver(record)}
                          disabled={savingId === record.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {money(record.pendingBalance) > 0
                            ? `Saldo $${formatMoney(record.pendingBalance)} · cobrar en caja`
                            : savingId === record.id
                              ? 'Entregando…'
                              : 'Entregar equipo'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
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
  accent = 'slate'
}: {
  label: string;
  value: string;
  accent?: 'slate' | 'amber';
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        accent === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

export default React.memo(RepairsModule);
