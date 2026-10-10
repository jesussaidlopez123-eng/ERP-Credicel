import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  Phone,
  Search,
  Smartphone,
  Store,
  User,
  X
} from 'lucide-react';
import { Branch, Operator, RepairRecord, RepairWorkStage } from '../types';
import { COMMERCIAL_BRANCHES, getBranchDisplayName, hasCashTill, normalizeBranchId } from '../data/initialBranches';
import { normalizeRole } from '../lib/roles';
import { formatMoney, money } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import { safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import {
  applyRepairCost,
  hasRefaccionCost,
  isPendingRepair,
  markRepairDelivered,
  markRepairReadyForDelivery,
  matchesRepairSearch,
  needsRepairCostCapture,
  REPAIR_WORK_STAGE_META,
  REPAIR_WORK_STAGES,
  repairDaysInShop,
  setRepairWorkStage,
  stampRepairLabel,
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

const BOARD_COLUMNS: RepairWorkStage[] = [...REPAIR_WORK_STAGES];

function boardColumnOf(record: RepairRecord): RepairWorkStage | null {
  if (needsRepairCostCapture(record)) return 'costo_refaccion';
  if (!isPendingRepair(record)) return null;
  return workStageOf(record);
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

  const boardRecords = useMemo(() => {
    return scopedRecords
      .filter((r) => boardColumnOf(r) !== null)
      .filter((r) => matchesRepairSearch(r, debouncedSearch))
      .sort((a, b) =>
        String(b.receivedAtIso || b.receivedAt || '').localeCompare(
          String(a.receivedAtIso || a.receivedAt || '')
        )
      );
  }, [scopedRecords, debouncedSearch]);

  const columns = useMemo(
    () =>
      BOARD_COLUMNS.map((stage) => ({
        stage,
        rows: boardRecords.filter((r) => boardColumnOf(r) === stage)
      })),
    [boardRecords]
  );

  const openOrder = useMemo(
    () => scopedRecords.find((r) => r.id === openOrderId) || null,
    [scopedRecords, openOrderId]
  );

  const pendingStats = useMemo(() => {
    const allPending = scopedRecords.filter(isPendingRepair);
    return {
      enTaller: allPending.length,
      sinRefaccion:
        allPending.filter((r) => !hasRefaccionCost(r)).length +
        scopedRecords.filter(needsRepairCostCapture).length,
      listos: allPending.filter((r) => workStageOf(r) === 'para_entrega').length,
      saldo: allPending.reduce((sum, r) => sum + money(r.pendingBalance), 0)
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

  const persist = async (record: RepairRecord) => {
    setSavingId(record.id);
    setActionError(null);
    try {
      await onUpdateRepairRecord(record);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar la orden.');
    } finally {
      setSavingId(null);
    }
  };

  const handleMove = async (record: RepairRecord, stage: RepairWorkStage) => {
    if (savingId) return;
    await persist(setRepairWorkStage(record, stage));
  };

  const handleSavePrice = async (record: RepairRecord) => {
    if (savingId) return;
    try {
      const updated = applyRepairCost(record, parseFloat(priceDraft), currentOperator.name, trustedIso());
      await persist(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Escribe el precio al cliente.');
    }
  };

  const handleDeliver = async (record: RepairRecord) => {
    if (savingId) return;
    if (money(record.pendingBalance) > 0) {
      setActionError('Cobra el saldo en el punto de venta. La orden se cierra cuando caja termina el cobro.');
      return;
    }
    const nowIso = trustedIso();
    await persist(
      markRepairDelivered(
        record,
        currentOperator.name,
        nowIso,
        `${safeFormatDate(nowIso)} ${safeFormatTime(nowIso)}`
      )
    );
    setOpenOrderId(null);
  };

  const handleReady = async (record: RepairRecord) => {
    if (savingId) return;
    await persist(markRepairReadyForDelivery(record));
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">Órdenes de taller</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Como en otros talleres: caja recibe el equipo, aquí se trabaja la orden y se marca lista. La entrega con saldo se cobra en el punto de venta.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 w-full sm:w-auto">
            <Stat label="En taller" value={String(pendingStats.enTaller)} />
            <Stat
              label="Sin pieza"
              value={String(pendingStats.sinRefaccion)}
              accent={pendingStats.sinRefaccion > 0}
            />
            <Stat label="Listos" value={String(pendingStats.listos)} />
            <Stat label="Saldo" value={`$${formatMoney(pendingStats.saldo)}`} />
          </div>
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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {columns.map(({ stage, rows }) => {
          const meta = REPAIR_WORK_STAGE_META[stage];
          return (
            <section
              key={stage}
              className="min-w-[16.5rem] w-[16.5rem] sm:flex-1 sm:min-w-[14rem] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shrink-0"
            >
              <header className="px-2.5 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                <h2 className="text-[12px] font-semibold text-slate-800">{meta.label}</h2>
                <span className="text-[10px] font-semibold text-slate-500 tabular-nums">{rows.length}</span>
              </header>
              <div className="p-1.5 space-y-1.5 min-h-[10rem]">
                {rows.length === 0 ? (
                  <p className="text-[11px] text-slate-400 px-1 py-8 text-center">Sin órdenes</p>
                ) : (
                  rows.map((record) => (
                    <OrderCard
                      key={record.id}
                      record={record}
                      selected={openOrderId === record.id}
                      showBranch={selectedBranchId === 'all'}
                      onSelect={() => setOpenOrderId(openOrderId === record.id ? null : record.id)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {openOrder ? (
        <WorkOrder
          record={openOrder}
          operatorName={currentOperator.name}
          busy={savingId === openOrder.id}
          priceDraft={priceDraft}
          error={actionError}
          onPriceDraft={setPriceDraft}
          onClose={() => setOpenOrderId(null)}
          onMove={(stage) => void handleMove(openOrder, stage)}
          onSavePrice={() => void handleSavePrice(openOrder)}
          onUpdate={onUpdateRepairRecord}
          onReady={() => void handleReady(openOrder)}
          onDeliver={() => void handleDeliver(openOrder)}
          onCancel={() => {
            setCancelTarget(openOrder);
            setCancelReason('');
          }}
          canCancel={Boolean(onCancelRepairRecord && isAdmin && isPendingRepair(openOrder))}
        />
      ) : (
        <p className="text-[11px] text-slate-500 px-1">
          Toca una orden para abrir la ficha: refacción, precio y entrega. Las altas nuevas solo salen del punto de venta.
        </p>
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

function OrderCard({
  record,
  selected,
  showBranch,
  onSelect
}: {
  record: RepairRecord;
  selected: boolean;
  showBranch: boolean;
  onSelect: () => void;
}) {
  const days = repairDaysInShop(record);
  const missingPart = !hasRefaccionCost(record);
  const deliveredOpen = needsRepairCostCapture(record);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border bg-white px-2.5 py-2 space-y-1 cursor-pointer ${
        selected ? 'border-[#0047AB] ring-1 ring-[#0047AB]/25' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[10px] font-semibold text-slate-800">{record.id}</span>
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
            days >= 7 ? 'text-rose-700' : days >= 3 ? 'text-amber-700' : 'text-slate-500'
          }`}
        >
          <Clock className="w-3 h-3" />
          {days}d
        </span>
      </div>
      <p className="text-[13px] font-semibold text-slate-900 truncate">{record.deviceModel}</p>
      <p className="text-[11px] text-slate-500 truncate">{record.clientName}</p>
      <p className="text-[11px] text-slate-600 truncate">{record.issueDescription || '—'}</p>
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <span className="text-[10px] text-slate-500 truncate">
          {showBranch ? getBranchDisplayName(record.branchId) : ''}
          {deliveredOpen ? (showBranch ? ' · ' : '') + 'Entregado, falta pieza' : ''}
        </span>
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            money(record.pendingBalance) > 0 ? 'text-amber-800' : 'text-slate-500'
          }`}
        >
          {money(record.pendingBalance) > 0
            ? `Saldo $${formatMoney(record.pendingBalance)}`
            : money(record.totalCost) > 0
              ? 'Pagado'
              : 'Sin precio'}
        </span>
      </div>
      {missingPart && (
        <span className="inline-block text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
          Sin refacción
        </span>
      )}
    </button>
  );
}

function WorkOrder({
  record,
  operatorName,
  busy,
  priceDraft,
  error,
  onPriceDraft,
  onClose,
  onMove,
  onSavePrice,
  onUpdate,
  onReady,
  onDeliver,
  onCancel,
  canCancel
}: {
  record: RepairRecord;
  operatorName: string;
  busy: boolean;
  priceDraft: string;
  error: string | null;
  onPriceDraft: (value: string) => void;
  onClose: () => void;
  onMove: (stage: RepairWorkStage) => void;
  onSavePrice: () => void;
  onUpdate: (record: RepairRecord) => void | Promise<void>;
  onReady: () => void;
  onDeliver: () => void;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const stage = workStageOf(record);
  const pending = isPendingRepair(record);
  const deliveredOpen = needsRepairCostCapture(record);

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Orden de servicio</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="font-mono text-sm font-semibold text-slate-900">{record.id}</span>
            <span className="text-sm font-semibold text-slate-800">{record.deviceModel}</span>
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
              {getBranchDisplayName(record.branchId)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          aria-label="Cerrar orden"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="px-4 py-3 space-y-4">
        <ol className="grid grid-cols-3 gap-1.5">
          {BOARD_COLUMNS.map((id, index) => {
            const current = BOARD_COLUMNS.indexOf(stage);
            const done = !pending && !deliveredOpen ? true : index <= current;
            const active = pending || deliveredOpen ? id === stage : false;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={!pending || busy}
                  onClick={() => onMove(id)}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 cursor-pointer disabled:cursor-default ${
                    active
                      ? 'border-[#0047AB] bg-[#0047AB]/5'
                      : done
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p className="text-[10px] font-semibold text-slate-500">{index + 1}</p>
                  <p className="text-[12px] font-semibold text-slate-900">{REPAIR_WORK_STAGE_META[id].label}</p>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <Info icon={<User className="w-3.5 h-3.5" />} label="Cliente" value={`${record.clientName} · ${record.clientPhone}`} />
          <Info icon={<Smartphone className="w-3.5 h-3.5" />} label="Equipo / falla" value={`${record.deviceModel} · ${record.issueDescription || '—'}`} />
          <Info icon={<Phone className="w-3.5 h-3.5" />} label="Contraseña" value={record.passcodePattern || '—'} />
          <Info
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Recibido"
            value={`${stampRepairLabel(record.receivedAtIso, record.receivedAt)} · ${record.operatorName}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Precio al cliente</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Total</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceDraft}
                  onChange={(e) => onPriceDraft(e.target.value)}
                  disabled={!pending}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50"
                />
              </div>
              <div>
                <p className="text-slate-500 mb-1">Anticipo</p>
                <p className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-700">
                  ${formatMoney(record.advancePayment)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Saldo</p>
                <p className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-amber-800">
                  ${formatMoney(Math.max(0, money(parseFloat(priceDraft) || 0) - money(record.advancePayment)))}
                </p>
              </div>
            </div>
            {pending && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onSavePrice}
                  disabled={busy}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  Guardar precio
                </button>
              </div>
            )}
          </div>

          <RepairCostLinesEditor
            record={record}
            operatorName={operatorName}
            onUpdate={onUpdate}
            busy={busy}
            allowedKinds={['refaccion']}
          />
        </div>

        {error && (
          <p className="text-xs font-semibold text-amber-950 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100">
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 border border-slate-300 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              Dar de baja
            </button>
          )}
          {pending && stage !== 'para_entrega' && (
            <button
              type="button"
              onClick={onReady}
              disabled={busy}
              className="px-3 py-2 border border-slate-300 text-slate-800 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-60"
            >
              Marcar listo
            </button>
          )}
          {pending && (
            <button
              type="button"
              onClick={onDeliver}
              disabled={busy}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {money(record.pendingBalance) > 0
                ? `Saldo $${formatMoney(record.pendingBalance)} · cobrar en caja`
                : busy
                  ? 'Entregando…'
                  : 'Entregar equipo'}
            </button>
          )}
        </div>
      </div>
    </section>
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
