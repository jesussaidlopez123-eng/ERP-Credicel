import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UploadCloud
} from 'lucide-react';
import { Branch, CorteXRecord, Expense, SaleTicket } from '../types';
import {
  OutboxStatus,
  STUCK_ATTEMPTS,
  listPendingOutbox,
  retryPendingNow,
  subscribeOutboxStatus
} from '../lib/outbox';
import { OutboxRow, localDbUsesFallback } from '../lib/localDb';
import { buildDailyBackup, downloadBackupFile, ensureDailyBackup } from '../lib/dailyBackup';
import { clockLooksWrong } from '../lib/clockGuard';
import { getDeviceLabel } from '../lib/deviceId';
import { folioLeaseRemaining } from '../lib/folioAllocator';
import { safeFormatTime } from '../lib/dateUtils';

interface SyncStatusChipProps {
  currentBranch: Branch;
  salesTickets: SaleTicket[];
  expenses: Expense[];
  cortesX: CorteXRecord[];
}

export default function SyncStatusChip({
  currentBranch,
  salesTickets,
  expenses,
  cortesX
}: SyncStatusChipProps) {
  const [status, setStatus] = useState<OutboxStatus>({
    pending: 0,
    stuck: 0,
    oldestPendingIso: null,
    lastError: null,
    lastSyncIso: null,
    draining: false
  });
  const [isOpen, setIsOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<OutboxRow[]>([]);
  const [foliosLeft, setFoliosLeft] = useState<number>(0);
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => subscribeOutboxStatus(setStatus), []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void listPendingOutbox().then((rows) => {
      if (!cancelled) setPendingRows(rows.slice(0, 12));
    });
    if (currentBranch.id !== 'all') {
      void folioLeaseRemaining(currentBranch.id).then((left) => {
        if (!cancelled) setFoliosLeft(left);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, status.pending, currentBranch.id]);

  const handleRetry = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const sent = await retryPendingNow();
      setFeedback(sent > 0 ? `Se subieron ${sent} registro(s).` : 'Aún no hay conexión con la nube.');
    } catch {
      setFeedback('No se pudo conectar. Se seguirá intentando solo.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const backup = buildDailyBackup({
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        tickets: salesTickets,
        expenses,
        cortes: cortesX
      });
      await ensureDailyBackup({
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        tickets: salesTickets,
        expenses,
        cortes: cortesX
      });
      downloadBackupFile(backup);
      setFeedback(`Respaldo del día descargado (${backup.ticketCount} tickets).`);
    } catch {
      setFeedback('No se pudo generar el archivo de respaldo.');
    } finally {
      setBusy(false);
    }
  };

  const hasTrouble = status.stuck > 0 || !online;
  const tone = hasTrouble
    ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
    : status.pending > 0
      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';

  const label = !online
    ? `Sin internet${status.pending > 0 ? ` · ${status.pending}` : ''}`
    : status.pending > 0
      ? `${status.pending} por subir`
      : 'Respaldado';

  const Icon = !online ? CloudOff : status.draining ? Loader2 : status.pending > 0 ? UploadCloud : CheckCircle2;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${tone}`}
        title="Estado del respaldo y de la cola de envío"
      >
        <Icon className={`w-3.5 h-3.5 ${status.draining ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{label}</span>
        {status.pending > 0 && <span className="sm:hidden">{status.pending}</span>}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[92vw] z-50 rounded-xl border border-slate-200 bg-white shadow-xl p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Respaldo del día
                </h4>
                <p className="text-[11px] text-slate-500">
                  {currentBranch.name} · {getDeviceLabel()}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  online
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {online ? 'En línea' : 'Sin internet'}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1.5 text-[11px] text-slate-700">
              <div className="flex items-center justify-between">
                <span>Ventas guardadas en este equipo</span>
                <span className="font-bold text-slate-900">{salesTickets.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pendientes de subir</span>
                <span className={`font-bold ${status.pending > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {status.pending}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Folios apartados sin internet</span>
                <span className="font-bold text-slate-900">{foliosLeft}</span>
              </div>
              {status.lastSyncIso && (
                <div className="flex items-center justify-between">
                  <span>Última subida</span>
                  <span className="font-bold text-slate-900">{safeFormatTime(status.lastSyncIso)}</span>
                </div>
              )}
            </div>

            {status.pending === 0 ? (
              <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Todo lo del día ya está en la nube.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-700">Esperando su turno para subir:</p>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {pendingRows.map((row) => (
                    <li
                      key={row.id}
                      className="text-[11px] flex items-center justify-between gap-2 rounded-md bg-slate-50 border border-slate-200 px-2 py-1"
                    >
                      <span className="truncate text-slate-700">{row.label || row.kind}</span>
                      <span
                        className={`shrink-0 font-bold ${
                          row.attempts >= STUCK_ATTEMPTS ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        {row.attempts > 0 ? `${row.attempts} int.` : 'en fila'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {status.stuck > 0 && status.lastError && (
              <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Un registro lleva varios intentos. No se ha perdido; sigue guardado aquí.{' '}
                  <span className="opacity-75">{status.lastError}</span>
                </span>
              </p>
            )}

            {clockLooksWrong() && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                La fecha de esta computadora va atrasada. El sistema está usando la hora correcta,
                pero conviene ajustarla.
              </p>
            )}

            {localDbUsesFallback() && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
                <HardDrive className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Este navegador guarda en modo reducido. Suba el día antes de cerrar.</span>
              </p>
            )}

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleRetry}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                Subir ahora
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
            </div>

            {feedback && <p className="text-[11px] text-slate-600">{feedback}</p>}
          </div>
        </>
      )}
    </div>
  );
}
