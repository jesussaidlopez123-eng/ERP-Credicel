import React, { useMemo, useState } from 'react';
import { Ban, Download, History, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { RepairRecord } from '../types';
import { formatMoney } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import { safeDateIsoKey } from '../lib/dateUtils';
import { getBranchDisplayName } from '../data/initialBranches';
import { matchesRepairSearch, stampRepairLabel } from '../lib/repairUtils';

export type HistoryScope = 'entregados' | 'cancelados' | 'todos';

interface RepairHistoryPanelProps {
  records: RepairRecord[];
  exportLabel?: string;
  showBranch?: boolean;
  isAdmin?: boolean;
  onCancelRepairRecord?: (record: RepairRecord, reason: string) => void | Promise<void>;
}

export default function RepairHistoryPanel({
  records,
  exportLabel = 'taller',
  showBranch = false,
  isAdmin = false,
  onCancelRepairRecord
}: RepairHistoryPanelProps) {
  const [historySearch, setHistorySearch] = useState('');
  const [historyScope, setHistoryScope] = useState<HistoryScope>('entregados');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RepairRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const historyRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (historyScope === 'entregados') return r.status === 'entregado';
        if (historyScope === 'cancelados') return r.status === 'cancelado';
        return r.status === 'entregado' || r.status === 'cancelado';
      })
      .filter((r) => matchesRepairSearch(r, historySearch))
      .sort((a, b) =>
        String(b.deliveredAtIso || b.cancelledAt || b.receivedAtIso || '').localeCompare(
          String(a.deliveredAtIso || a.cancelledAt || a.receivedAtIso || '')
        )
      );
  }, [records, historyScope, historySearch]);

  const historyTotals = useMemo(() => {
    const cobrado = historyRecords
      .filter((r) => r.status === 'entregado')
      .reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
    return { cobrado, cuenta: historyRecords.length };
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
      'Costo',
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

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !onCancelRepairRecord) return;
    await onCancelRepairRecord(cancelTarget, cancelReason);
    setCancelTarget(null);
    setCancelReason('');
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
              {' · '}cobrado{' '}
              <span className="font-bold text-slate-900">${formatMoney(historyTotals.cobrado)}</span>
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
                        Costo <strong className="text-slate-900">${formatMoney(record.totalCost)}</strong>
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

                    {!cancelado && onCancelRepairRecord && isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelTarget(record);
                          setCancelReason('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Dar de baja este registro
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rose-600" />
              <h4 className="text-sm font-black text-slate-900">Dar de baja {cancelTarget.id}</h4>
            </div>
            <p className="text-xs text-slate-600">
              El registro no se borra: queda en el historial como dado de baja, con tu nombre y el motivo.
              Equipo de {cancelTarget.clientName} ({cancelTarget.deviceModel}).
            </p>
            <textarea
              rows={2}
              autoFocus
              placeholder="Motivo (ej. captura equivocada, el cliente ya no dejó el equipo)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCancel()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Dar de baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CancelRepairDialog({
  record,
  reason,
  onReasonChange,
  onClose,
  onConfirm
}: {
  record: RepairRecord;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Ban className="w-5 h-5 text-rose-600" />
          <h4 className="text-sm font-black text-slate-900">Dar de baja {record.id}</h4>
        </div>
        <p className="text-xs text-slate-600">
          El registro no se borra: queda en el historial como dado de baja, con tu nombre y el motivo.
          Equipo de {record.clientName} ({record.deviceModel}).
        </p>
        <textarea
          rows={2}
          autoFocus
          placeholder="Motivo (ej. captura equivocada, el cliente ya no dejó el equipo)"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Dar de baja
          </button>
        </div>
      </div>
    </div>
  );
}
