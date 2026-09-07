import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, FileSpreadsheet, History, Search } from 'lucide-react';
import { RepairRecord } from '../types';
import { formatMoney } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import { currentWeekStartKey, safeDateIsoKey, todayCashDateKey } from '../lib/dateUtils';
import { getBranchDisplayName } from '../data/initialBranches';
import {
  buildAdminWeekRegisters,
  buildDeliveredWeekRegister,
  buildRepairRangeRegister,
  REPAIR_COST_KIND_LABEL,
  type RepairWeekRegister as WeekRegister
} from '../lib/repairFinance';
import { downloadRepairRangeExcel } from '../lib/repairExcel';
import { stampRepairLabel } from '../lib/repairUtils';
import LoadMoreButton from './LoadMoreButton';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface RepairWeekRegisterProps {
  records: RepairRecord[];
  showBranch?: boolean;
  onLoadOlder?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

function moneyTone(value: number) {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-rose-700';
  return 'text-slate-900';
}

export default function RepairWeekRegisterPanel({
  records,
  showBranch = true,
  onLoadOlder,
  hasMore = false,
  loadingMore = false
}: RepairWeekRegisterProps) {
  const weeks = useMemo(() => buildAdminWeekRegisters(records), [records]);
  const [openWeekStart, setOpenWeekStart] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 160);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openWeek: WeekRegister | null = useMemo(() => {
    if (!openWeekStart) return null;
    return weeks.find((w) => w.weekStart === openWeekStart) || buildDeliveredWeekRegister(openWeekStart, records);
  }, [openWeekStart, weeks, records]);

  const filteredItems = useMemo(() => {
    if (!openWeek) return [];
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return openWeek.items;
    return openWeek.items.filter(({ repair }) => {
      return (
        repair.id.toLowerCase().includes(q) ||
        repair.clientName.toLowerCase().includes(q) ||
        repair.deviceModel.toLowerCase().includes(q) ||
        repair.clientPhone.includes(q)
      );
    });
  }, [openWeek, debouncedQuery]);

  if (openWeek) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setOpenWeekStart(null);
              setQuery('');
              setExpandedId(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Semanas
          </button>
          <button
            type="button"
            onClick={() =>
              downloadRepairRangeExcel(buildRepairRangeRegister(openWeek.weekStart, openWeek.weekEnd, records))
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel de esta semana
          </button>
        </div>

        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-indigo-700">
            {openWeek.isCurrent ? 'Semana actual' : 'Registro semanal'}
          </p>
          <h2 className="text-lg font-black text-slate-900">{openWeek.label}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Equipos entregados esta semana. Precio al cliente menos gastos de reparación = utilidad.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Equipos" value={String(openWeek.equipos)} hint="Entregados" />
          <StatCard label="Cobrado" value={`$${formatMoney(openWeek.cobrado)}`} hint="Precio al cliente" />
          <StatCard label="Gastos" value={`$${formatMoney(openWeek.gastos)}`} hint="Refacción y mano de obra" />
          <StatCard
            label="Utilidad"
            value={`$${formatMoney(openWeek.utilidad)}`}
            hint="Cobrado menos gastos"
            tone={openWeek.utilidad >= 0 ? 'ok' : 'bad'}
          />
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar folio, cliente o equipo en esta semana…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-1">
            <History className="w-9 h-9 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">
              {openWeek.equipos === 0 ? 'Nadie se ha entregado esta semana.' : 'Ningún folio coincide con la búsqueda.'}
            </p>
            <p className="text-xs text-slate-400">
              {openWeek.isCurrent
                ? 'Los equipos siguen en Pendientes hasta que el cajero complete la entrega en caja.'
                : 'Prueba otra semana o carga historial anterior.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="py-2.5 px-3 font-semibold">Folio</th>
                  <th className="py-2.5 px-3 font-semibold">Equipo / cliente</th>
                  {showBranch && <th className="py-2.5 px-3 font-semibold">Sucursal</th>}
                  <th className="py-2.5 px-3 font-semibold text-right">Cobrado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gastos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Utilidad</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((row) => {
                  const open = expandedId === row.repair.id;
                  return (
                    <React.Fragment key={row.repair.id}>
                      <tr
                        className={`border-t border-slate-100 cursor-pointer ${open ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}
                        onClick={() => setExpandedId(open ? null : row.repair.id)}
                      >
                        <td className="py-2.5 px-3 font-mono font-black text-slate-900">{row.repair.id}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900">{row.repair.deviceModel}</p>
                          <p className="text-slate-500">{row.repair.clientName}</p>
                        </td>
                        {showBranch && (
                          <td className="py-2.5 px-3 text-slate-600">{getBranchDisplayName(row.repair.branchId)}</td>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono">${formatMoney(row.cobrado)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">${formatMoney(row.gastos)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-black ${moneyTone(row.utilidad)}`}>
                          ${formatMoney(row.utilidad)}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t border-slate-100 bg-slate-50/80">
                          <td colSpan={showBranch ? 6 : 5} className="px-3 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <p>
                                <span className="text-slate-500">Falla:</span>{' '}
                                <strong>{row.repair.issueDescription || '—'}</strong>
                              </p>
                              <p>
                                <span className="text-slate-500">Entregado:</span>{' '}
                                <strong>
                                  {stampRepairLabel(row.repair.deliveredAtIso, row.repair.deliveredAt)} ·{' '}
                                  {row.repair.deliveredByName || '—'}
                                </strong>
                              </p>
                            </div>
                            {(row.repair.costLines || []).length > 0 ? (
                              <ul className="mt-2 space-y-1">
                                {(row.repair.costLines || []).map((line) => (
                                  <li key={line.id} className="flex justify-between gap-2 text-[11px]">
                                    <span>
                                      {REPAIR_COST_KIND_LABEL[line.kind]} · {line.concept}
                                    </span>
                                    <span className="font-bold">${formatMoney(line.amount)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-[11px] text-amber-700">Sin gastos internos capturados en esta orden.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {openWeek.cancelados.length > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-rose-800">
              Dados de baja esta semana ({openWeek.cancelados.length})
            </p>
            {openWeek.cancelados.map((repair) => (
              <p key={repair.id} className="text-[11px] text-rose-900">
                <span className="font-mono font-black">{repair.id}</span> · {repair.deviceModel} · {repair.clientName}
                {repair.cancelReason ? ` · ${repair.cancelReason}` : ''}
              </p>
            ))}
          </div>
        )}

        <LoadMoreButton
          hasMore={hasMore}
          loading={loadingMore}
          onClick={onLoadOlder}
          label="Cargar historial anterior"
        />
        <p className="text-[10px] text-slate-400">
          Exportado {safeDateIsoKey(trustedIso())}. El efectivo de caja no se mueve aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Registro administrativo</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Elige una semana. Al abrirla ves los equipos entregados, la suma de gastos y la utilidad.
        </p>
      </div>

      <ExcelRangeCard records={records} />

      {weeks.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">Todavía no hay semanas de taller.</p>
      ) : (
        <div className="space-y-2">
          {weeks.map((week) => (
            <button
              key={week.weekStart}
              type="button"
              onClick={() => setOpenWeekStart(week.weekStart)}
              className="w-full text-left rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black text-slate-900">{week.label}</p>
                  {week.isCurrent && (
                    <span className="text-[10px] font-black uppercase tracking-wide text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md">
                      Actual
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {week.equipos} equipo{week.equipos === 1 ? '' : 's'} · gastos ${formatMoney(week.gastos)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Utilidad</p>
                  <p className={`text-sm font-black ${moneyTone(week.utilidad)}`}>${formatMoney(week.utilidad)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      )}

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={onLoadOlder}
        label="Cargar historial anterior"
      />
    </div>
  );
}

function ExcelRangeCard({ records }: { records: RepairRecord[] }) {
  const [from, setFrom] = useState(currentWeekStartKey());
  const [to, setTo] = useState(todayCashDateKey());
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!from || !to) return null;
    return buildRepairRangeRegister(from, to, records);
  }, [from, to, records]);

  const handleDownload = () => {
    if (!from || !to) {
      setError('Elige la fecha inicial y la final.');
      return;
    }
    setError(null);
    downloadRepairRangeExcel(buildRepairRangeRegister(from, to, records));
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="w-5 h-5 text-emerald-800 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-slate-900">Generar Excel</p>
          <p className="text-xs text-slate-600">
            Resumen de operaciones del taller de tal fecha a tal fecha: equipos, gastos y utilidad.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-[11px] font-bold text-slate-700">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block text-[11px] font-bold text-slate-700">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </label>
      </div>

      {preview && (
        <p className="text-[11px] text-slate-600">
          {preview.label}: <strong>{preview.equipos}</strong> equipo{preview.equipos === 1 ? '' : 's'} ·
          cobrado <strong>${formatMoney(preview.cobrado)}</strong> · gastos{' '}
          <strong>${formatMoney(preview.gastos)}</strong> · utilidad{' '}
          <strong>${formatMoney(preview.utilidad)}</strong>
        </p>
      )}

      {error && (
        <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Descargar Excel
        </button>
        <p className="text-[10px] text-slate-500">
          Si falta un folio viejo, carga historial anterior antes de bajar el archivo.
        </p>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = 'plain'
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'plain' | 'ok' | 'bad';
}) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'bad'
        ? 'border-rose-200 bg-rose-50'
        : 'border-slate-200 bg-slate-50';
  return (
    <div className={`rounded-xl border px-3 py-3 ${cls}`}>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="text-lg font-black text-slate-900 mt-0.5">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
    </div>
  );
}
