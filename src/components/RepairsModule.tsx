import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Clock, Phone, Search, Smartphone, Store, User, X } from 'lucide-react';
import { Branch, Operator, RepairRecord } from '../types';
import { COMMERCIAL_BRANCHES, getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { normalizeRole } from '../lib/roles';
import { formatMoney, money } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import {
  applyRepairCost,
  hasRefaccionCost,
  isPendingRepair,
  matchesRepairSearch,
  needsRepairCostCapture,
  repairDaysInShop,
  stampRepairLabel
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

function isCostQueue(record: RepairRecord): boolean {
  return isPendingRepair(record) || needsRepairCostCapture(record);
}

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
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    hasCashTill(currentBranch.id) ? normalizeBranchId(currentBranch.id) : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 160);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RepairRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');

  useEffect(() => {
    if (!focusCostDue) return;
    const due = repairRecords.find(needsRepairCostCapture);
    if (due) setOpenOrderId(due.id);
    onFocusCostDueConsumed?.();
  }, [focusCostDue, onFocusCostDueConsumed, repairRecords]);

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

  const orders = useMemo(() => {
    return scopedRecords
      .filter(isCostQueue)
      .filter((r) => matchesRepairSearch(r, debouncedSearch))
      .sort((a, b) => {
        const aMissing = hasRefaccionCost(a) ? 1 : 0;
        const bMissing = hasRefaccionCost(b) ? 1 : 0;
        if (aMissing !== bMissing) return aMissing - bMissing;
        return String(b.receivedAtIso || b.receivedAt || '').localeCompare(
          String(a.receivedAtIso || a.receivedAt || '')
        );
      });
  }, [scopedRecords, debouncedSearch]);

  const openOrder = useMemo(
    () => scopedRecords.find((r) => r.id === openOrderId) || null,
    [scopedRecords, openOrderId]
  );

  const stats = useMemo(() => {
    const pending = scopedRecords.filter(isPendingRepair);
    return {
      enTaller: pending.length,
      sinPieza: pending.filter((r) => !hasRefaccionCost(r)).length + scopedRecords.filter(needsRepairCostCapture).length
    };
  }, [scopedRecords]);

  useEffect(() => {
    if (!openOrder) {
      setPriceDraft('');
      return;
    }
    setPriceDraft(openOrder.totalCost > 0 ? String(openOrder.totalCost) : '');
    setActionError(null);
  }, [openOrder?.id, openOrder?.totalCost]);

  if (!isAdmin && !isManager) return null;

  const handleSavePrice = async (record: RepairRecord) => {
    if (savingId) return;
    setSavingId(record.id);
    setActionError(null);
    try {
      await onUpdateRepairRecord(
        applyRepairCost(record, parseFloat(priceDraft), currentOperator.name, trustedIso())
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Escribe el costo del cliente.');
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !onCancelRepairRecord) return;
    await onCancelRepairRecord(cancelTarget, cancelReason);
    setCancelTarget(null);
    setCancelReason('');
    if (openOrderId === cancelTarget.id) setOpenOrderId(null);
  };

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-4 pb-12'}>
      <div className={`bg-white rounded-xl border border-slate-200 ${embedded ? 'p-2.5' : 'p-3'}`}>
        <h1 className="text-sm font-semibold text-slate-900">Costos de taller</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">
          El punto de venta registra el equipo y lo entrega. Aquí solo se agrega el costo de la pieza o se modifica el costo del cliente.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 max-w-sm">
          <Stat label="En taller" value={String(stats.enTaller)} />
          <Stat label="Sin pieza" value={String(stats.sinPieza)} accent={stats.sinPieza > 0} />
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Store className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full sm:w-52 bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
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
            placeholder="Folio, cliente, teléfono o modelo…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
          <p className="text-sm font-semibold text-slate-700">Sin órdenes en taller</p>
          <p className="text-[11px] mt-1">Las altas nuevas se hacen en el punto de venta.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((record) => {
            const selected = openOrderId === record.id;
            const days = repairDaysInShop(record);
            const missingPart = !hasRefaccionCost(record);
            return (
              <article
                key={record.id}
                className={`bg-white border rounded-xl ${selected ? 'border-[#0047AB]/40' : 'border-slate-200'}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenOrderId(selected ? null : record.id)}
                  className="w-full text-left px-3 py-2.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-slate-900 text-amber-400 font-mono font-semibold text-xs rounded-md">
                        {record.id}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{record.deviceModel}</span>
                      {selectedBranchId === 'all' && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                          {getBranchDisplayName(record.branchId)}
                        </span>
                      )}
                      {missingPart && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                          Sin pieza
                        </span>
                      )}
                      {needsRepairCostCapture(record) && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                          Entregado en caja · falta pieza
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {days}d · {stampRepairLabel(record.receivedAtIso, record.receivedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {record.clientName} · {record.clientPhone} · {record.issueDescription || '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Cliente ${formatMoney(record.totalCost)} · Anticipo ${formatMoney(record.advancePayment)} · Saldo $
                    {formatMoney(record.pendingBalance)}
                  </p>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {openOrder && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <header className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Costos de la orden</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="font-mono text-sm font-semibold text-slate-900">{openOrder.id}</span>
                <span className="text-sm font-semibold text-slate-800">{openOrder.deviceModel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenOrderId(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="px-4 py-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <Info icon={<User className="w-3.5 h-3.5" />} label="Cliente" value={`${openOrder.clientName} · ${openOrder.clientPhone}`} />
              <Info icon={<Smartphone className="w-3.5 h-3.5" />} label="Falla" value={openOrder.issueDescription || '—'} />
              <Info icon={<Phone className="w-3.5 h-3.5" />} label="Contraseña" value={openOrder.passcodePattern || '—'} />
              <Info
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Recibido en caja"
                value={`${stampRepairLabel(openOrder.receivedAtIso, openOrder.receivedAt)} · ${openOrder.operatorName}`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Costo del cliente
                </p>
                <p className="text-[11px] text-slate-500">
                  Se puede cambiar. El saldo que vea caja al entregar se recalcula con el anticipo ya cobrado.
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">Costo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      disabled={!isPendingRepair(openOrder)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Anticipo</p>
                    <p className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-700">
                      ${formatMoney(openOrder.advancePayment)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Saldo</p>
                    <p className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-amber-800">
                      ${formatMoney(Math.max(0, money(parseFloat(priceDraft) || 0) - money(openOrder.advancePayment)))}
                    </p>
                  </div>
                </div>
                {isPendingRepair(openOrder) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSavePrice(openOrder)}
                      disabled={savingId === openOrder.id}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      Guardar costo del cliente
                    </button>
                  </div>
                )}
              </div>

              <RepairCostLinesEditor
                record={openOrder}
                operatorName={currentOperator.name}
                onUpdate={onUpdateRepairRecord}
                busy={savingId === openOrder.id}
                allowedKinds={['refaccion']}
              />
            </div>

            {actionError && (
              <p className="text-xs font-semibold text-amber-950 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2">
                {actionError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-500">
                Recibir y entregar el equipo es en el punto de venta.
              </p>
              {onCancelRepairRecord && isAdmin && isPendingRepair(openOrder) && (
                <button
                  type="button"
                  onClick={() => {
                    setCancelTarget(openOrder);
                    setCancelReason('');
                  }}
                  className="px-3 py-2 border border-slate-300 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Dar de baja
                </button>
              )}
            </div>
          </div>
        </section>
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

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-slate-500 font-medium flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="font-semibold text-slate-900 mt-0.5 break-words">{value}</p>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${accent ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default React.memo(RepairsModule);
