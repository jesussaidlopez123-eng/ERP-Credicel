import React, { useMemo, useState } from 'react';
import { Ban, Download, History, Lock, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Operator, RepairRecord } from '../types';
import { formatMoney } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import { safeDateIsoKey } from '../lib/dateUtils';
import { getBranchDisplayName } from '../data/initialBranches';
import { authorizeWithAdminPassword } from '../lib/inventoryAuth';
import { canDeleteRepair, matchesRepairSearch, repairInternalCost, stampRepairLabel } from '../lib/repairUtils';
import { REPAIR_COST_KIND_LABEL, repairCustomerMargin } from '../lib/repairFinance';
import LoadMoreButton from './LoadMoreButton';
import RepairCostLinesEditor from './RepairCostLinesEditor';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export type HistoryScope = 'entregados' | 'cancelados' | 'todos';

interface RepairHistoryPanelProps {
  records: RepairRecord[];
  exportLabel?: string;
  showBranch?: boolean;
  isAdmin?: boolean;
  onCancelRepairRecord?: (record: RepairRecord, reason: string) => void | Promise<void>;
  onDeleteRepairRecord?: (record: RepairRecord, reason: string) => void | Promise<void>;
  operators?: Operator[];
  currentOperator?: Operator;
  onUpdateRepairRecord?: (record: RepairRecord) => void | Promise<void>;
  operatorName?: string;
  onLoadOlder?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export default function RepairHistoryPanel({
  records,
  exportLabel = 'taller',
  showBranch = false,
  isAdmin = false,
  onDeleteRepairRecord,
  operators = [],
  currentOperator,
  onUpdateRepairRecord,
  operatorName,
  onLoadOlder,
  hasMore = false,
  loadingMore = false
}: RepairHistoryPanelProps) {
  const [historySearch, setHistorySearch] = useState('');
  const debouncedHistorySearch = useDebouncedValue(historySearch, 160);
  const [historyScope, setHistoryScope] = useState<HistoryScope>('entregados');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RepairRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const showAdminDelete = isAdmin && Boolean(onDeleteRepairRecord) && canDeleteRepair(currentOperator?.role);

  const historyRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (historyScope === 'entregados') return r.status === 'entregado';
        if (historyScope === 'cancelados') return r.status === 'cancelado';
        return r.status === 'entregado' || r.status === 'cancelado';
      })
      .filter((r) => matchesRepairSearch(r, debouncedHistorySearch))
      .sort((a, b) =>
        String(b.deliveredAtIso || b.cancelledAt || b.receivedAtIso || '').localeCompare(
          String(a.deliveredAtIso || a.cancelledAt || a.receivedAtIso || '')
        )
      );
  }, [records, historyScope, debouncedHistorySearch]);

  const historyTotals = useMemo(() => {
    const delivered = historyRecords.filter((r) => r.status === 'entregado');
    const cobrado = delivered.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
    const interno = delivered.reduce((sum, r) => sum + repairInternalCost(r), 0);
    return { cobrado, interno, margen: cobrado - interno, cuenta: historyRecords.length };
  }, [historyRecords]);

  const exportHistory = () => {
    const encabezado = [
      'Folio',
      'Estado',
      'Sucursal',
      'Cliente',
      'Telefono',
      'Equipo',
      'Falla',
      'Precio cliente',
      'Costo interno',
      'Margen',
      'Anticipo',
      'Saldo',
      'Recibido',
      'Entregado',
      'Recibio',
      'Entrego'
    ];
    const filas = historyRecords.map((r) => [
      r.id,
      r.status,
      getBranchDisplayName(r.branchId),
      r.clientName,
      r.clientPhone,
      r.deviceModel,
      (r.issueDescription || '').replace(/[\n;]/g, ' '),
      formatMoney(r.totalCost),
      formatMoney(repairInternalCost(r)),
      formatMoney(repairCustomerMargin(r)),
      formatMoney(r.advancePayment),
      formatMoney(r.pendingBalance),
      stampRepairLabel(r.receivedAtIso, r.receivedAt),
      stampRepairLabel(r.deliveredAtIso, r.deliveredAt),
      r.operatorName || '',
      r.deliveredByName || ''
    ]);
    const csv = [encabezado, ...filas]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-${exportLabel}-${safeDateIsoKey(trustedIso())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar en el historial por folio, cliente, teléfono, equipo o falla…"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
        <select
          value={historyScope}
          onChange={(e) => setHistoryScope(e.target.value as HistoryScope)}
          className="px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
        >
          <option value="entregados">Entregados</option>
          <option value="cancelados">Dados de baja</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-[11px] text-slate-600">
          <span className="font-bold text-slate-900">{historyTotals.cuenta}</span> registro(s)
          {historyScope !== 'cancelados' && (
            <>
              {' · '}precio cliente{' '}
              <span className="font-bold text-slate-900">${formatMoney(historyTotals.cobrado)}</span>
              {' · '}interno{' '}
              <span className="font-bold text-slate-900">${formatMoney(historyTotals.interno)}</span>
              {' · '}margen{' '}
              <span className="font-bold text-slate-900">${formatMoney(historyTotals.margen)}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={exportHistory}
          disabled={historyRecords.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar
        </button>
      </div>

      {historyRecords.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <History className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-xs font-bold">Todavía no hay equipos en el historial.</p>
          <p className="text-[11px] text-slate-400">
            Aquí aparecen los equipos entregados y los dados de baja, con su información completa.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {historyRecords.map((record) => {
            const abierto = expandedId === record.id;
            const cancelado = record.status === 'cancelado';
            return (
              <div
                key={record.id}
                className={`rounded-2xl border overflow-hidden ${
                  cancelado ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(abierto ? null : record.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 cursor-pointer"
                >
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-slate-900 text-amber-400 font-mono font-extrabold text-[11px] rounded-lg">
                      {record.id}
                    </span>
                    <span className="text-xs font-black text-slate-900 truncate">
                      {record.clientName}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">{record.deviceModel}</span>
                    {showBranch && (
                      <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                        {getBranchDisplayName(record.branchId)}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        cancelado
                          ? 'border-rose-200 bg-rose-100 text-rose-700'
                          : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {cancelado ? 'Dado de baja' : 'Entregado'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-medium">
                    {cancelado
                      ? stampRepairLabel(record.cancelledAt, undefined)
                      : stampRepairLabel(record.deliveredAtIso, record.deliveredAt)}
                  </span>
                </button>

                {abierto && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                      <div>
                        <p className="text-slate-500 font-medium">Teléfono</p>
                        <p className="font-bold text-slate-900 font-mono">{record.clientPhone}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Contraseña / patrón</p>
                        <p className="font-bold text-slate-900">{record.passcodePattern || '—'}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-slate-500 font-medium">Falla reportada</p>
                        <p className="font-bold text-slate-900">{record.issueDescription}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Recibido</p>
                        <p className="font-bold text-slate-900">
                          {stampRepairLabel(record.receivedAtIso, record.receivedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Entregado</p>
                        <p className="font-bold text-slate-900">
                          {stampRepairLabel(record.deliveredAtIso, record.deliveredAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Recibió</p>
                        <p className="font-bold text-slate-900">{record.operatorName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Entregó</p>
                        <p className="font-bold text-slate-900">{record.deliveredByName || '—'}</p>
                      </div>
                      {record.deliveryTicketId && (
                        <div>
                          <p className="text-slate-500 font-medium">Ticket de liquidación</p>
                          <p className="font-bold text-slate-900 font-mono">{record.deliveryTicketId}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-slate-500 font-medium">Equipo que registró</p>
                        <p className="font-bold text-slate-900">{record.deviceLabel || '—'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                      <span>
                        Precio cliente <strong className="text-slate-900">${formatMoney(record.totalCost)}</strong>
                      </span>
                      <span>
                        Costo interno{' '}
                        <strong className="text-slate-900">${formatMoney(repairInternalCost(record))}</strong>
                      </span>
                      <span>
                        Margen{' '}
                        <strong className="text-slate-900">${formatMoney(repairCustomerMargin(record))}</strong>
                      </span>
                      <span>
                        Anticipo{' '}
                        <strong className="text-emerald-700">${formatMoney(record.advancePayment)}</strong>
                      </span>
                      <span>
                        Saldo final{' '}
                        <strong className="text-slate-900">${formatMoney(record.pendingBalance)}</strong>
                      </span>
                    </div>

                    {(record.costLines || []).length > 0 && !(onUpdateRepairRecord && operatorName) && (
                      <div className="text-[11px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 space-y-1">
                        <p className="font-bold">Costos internos del taller</p>
                        {(record.costLines || []).map((line) => (
                          <p key={line.id}>
                            {REPAIR_COST_KIND_LABEL[line.kind]} · {line.concept} · ${formatMoney(line.amount)} ·{' '}
                            {stampRepairLabel(line.at, undefined)} · {line.by}
                          </p>
                        ))}
                      </div>
                    )}

                    {onUpdateRepairRecord && operatorName && (
                      <RepairCostLinesEditor
                        record={record}
                        operatorName={operatorName}
                        onUpdate={onUpdateRepairRecord}
                      />
                    )}

                    {(record.costUpdates || []).length > 0 && (
                      <div className="text-[11px] bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-950 space-y-1">
                        <p className="font-bold">Cambios de costo</p>
                        {(record.costUpdates || []).map((u, idx) => (
                          <p key={`${record.id}-cost-${idx}`}>
                            ${formatMoney(u.previousTotal)} → ${formatMoney(u.newTotal)} · {u.by} ·{' '}
                            {stampRepairLabel(u.at, undefined)}
                            {u.note ? ` · ${u.note}` : ''}
                          </p>
                        ))}
                      </div>
                    )}

                    {cancelado && (
                      <div className="text-[11px] bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-rose-800">
                        <p>
                          <strong>Dado de baja por:</strong> {record.cancelledByName || '—'}
                        </p>
                        <p>
                          <strong>Motivo:</strong> {record.cancelReason || '—'}
                        </p>
                      </div>
                    )}

                    {!cancelado && (
                      <p className="text-[11px] text-slate-500">
                        Un equipo entregado no se da de baja. La baja es para órdenes que siguen en taller.
                      </p>
                    )}

                    {showAdminDelete && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(record);
                            setDeleteError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadOlder}
        label="Cargar historial anterior"
      />

      {deleteTarget && (
        <DeleteRepairDialog
          record={deleteTarget}
          operators={operators}
          currentOperator={currentOperator}
          onClose={() => {
            if (deleteBusy) return;
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={async (reason) => {
            if (!onDeleteRepairRecord || deleteBusy) return;
            setDeleteBusy(true);
            setDeleteError(null);
            try {
              await onDeleteRepairRecord(deleteTarget, reason);
              setDeleteTarget(null);
              setExpandedId((id) => (id === deleteTarget.id ? null : id));
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar.');
            } finally {
              setDeleteBusy(false);
            }
          }}
          busy={deleteBusy}
          error={deleteError}
        />
      )}
    </div>
  );
}

export function CancelRepairDialog({
  record,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
  busy = false,
  error = null
}: {
  record: RepairRecord;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const hasReason = Boolean(reason.trim());
  const anticipo = Number(record.advancePayment) || 0;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Ban className="w-5 h-5 text-rose-600" />
          <h4 className="text-sm font-black text-slate-900">Dar de baja {record.id}</h4>
        </div>
        <p className="text-xs text-slate-600">
          Sale de taller y queda en el historial como dado de baja, con tu nombre y el motivo.
          Equipo de {record.clientName} ({record.deviceModel}).
        </p>
        {anticipo > 0 && (
          <p className="text-[11px] text-amber-950 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Ya hay un anticipo de ${formatMoney(anticipo)} en caja. La baja no lo devuelve: si hay que reembolsar, regístralo como gasto.
          </p>
        )}
        <textarea
          rows={2}
          autoFocus
          placeholder="Motivo (ej. captura equivocada, el cliente ya no dejó el equipo)"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          disabled={busy}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:bg-slate-50"
        />
        {error && (
          <p className="text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !hasReason}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            {busy ? 'Guardando…' : 'Dar de baja'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteRepairDialog({
  record,
  operators,
  currentOperator,
  onClose,
  onConfirm,
  busy = false,
  error = null
}: {
  record: RepairRecord;
  operators: Operator[];
  currentOperator?: Operator;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [reason, setReason] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const anticipo = Number(record.advancePayment) || 0;

  const handleConfirm = async () => {
    if (busy) return;
    const auth = authorizeWithAdminPassword(adminPassword, operators, currentOperator);
    if (auth) {
      setAuthError(auth);
      return;
    }
    const finalReason = reason.trim() || 'Eliminado por administrador';
    await onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="bg-white rounded-2xl border border-rose-100 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-rose-700 px-5 py-4">
          <div className="flex items-center gap-2 text-white">
            <ShieldAlert className="w-4 h-4" />
            <h4 className="text-sm font-black">Eliminar {record.id}</h4>
          </div>
          <p className="text-[11px] text-rose-100 mt-1">
            Solo el administrador. Sale de taller, de caja y del historial. No se puede deshacer.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
            <p className="font-black text-slate-900">
              {record.clientName} · {record.deviceModel}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {getBranchDisplayName(record.branchId)} · {record.clientPhone || 'sin teléfono'}
            </p>
          </div>
          {anticipo > 0 && (
            <p className="text-[11px] text-amber-950 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Hay un anticipo de ${formatMoney(anticipo)} en caja. Borrar la ficha no lo devuelve: si hay
              que reembolsar, regístralo como gasto.
            </p>
          )}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Motivo (opcional)</label>
            <textarea
              rows={2}
              placeholder="Ej. captura duplicada, folio de prueba"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Contraseña del administrador
            </label>
            <input
              type="password"
              autoComplete="off"
              autoFocus
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                if (authError) setAuthError(null);
              }}
              disabled={busy}
              placeholder="Solo un administrador puede autorizar el borrado"
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            {(authError || error) && (
              <p className="mt-1.5 text-[11px] font-bold text-rose-700">{authError || error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {busy ? 'Eliminando…' : 'Confirmar y eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
