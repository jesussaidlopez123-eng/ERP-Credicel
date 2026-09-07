import React, { useMemo, useState } from 'react';
import { ChevronDown, Download, Wallet } from 'lucide-react';
import { RepairRecord, SaleTicket } from '../types';
import { formatMoney } from '../lib/ids';
import { trustedIso } from '../lib/clockGuard';
import { safeDateIsoKey } from '../lib/dateUtils';
import { getBranchDisplayName } from '../data/initialBranches';
import {
  buildRepairFinanceWeeks,
  listCostLinesInWeek,
  REPAIR_COST_KIND_LABEL
} from '../lib/repairFinance';
import { stampRepairLabel } from '../lib/repairUtils';
import LoadMoreButton from './LoadMoreButton';

interface RepairFinancePanelProps {
  tickets: SaleTicket[];
  repairs: RepairRecord[];
  onLoadOlderSales?: () => void;
  salesHasMore?: boolean;
  salesLoading?: boolean;
}

function moneyTone(value: number) {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-rose-700';
  return 'text-slate-900';
}

export default function RepairFinancePanel({
  tickets,
  repairs,
  onLoadOlderSales,
  salesHasMore = false,
  salesLoading = false
}: RepairFinancePanelProps) {
  const weeks = useMemo(() => buildRepairFinanceWeeks(tickets, repairs), [tickets, repairs]);
  const current = weeks.find((w) => w.isCurrent) || weeks[0];
  const history = weeks.filter((w) => w !== current);
  const [openWeek, setOpenWeek] = useState<string | null>(null);

  const currentLines = useMemo(
    () => (current ? listCostLinesInWeek(current.weekStart, repairs) : []),
    [current, repairs]
  );

  const exportWeeks = () => {
    const encabezado = [
      'Semana',
      'Inicio',
      'Fin',
      'Sucursal',
      'Cobrado',
      'Costos',
      'Margen',
      'Recibidos',
      'Entregados'
    ];
    const filas: string[][] = [];
    for (const week of weeks) {
      if (week.byBranch.length === 0) {
        filas.push([
          week.label,
          week.weekStart,
          week.weekEnd,
          'Sin movimiento',
          '0',
          '0',
          '0',
          '0',
          '0'
        ]);
        continue;
      }
      for (const row of week.byBranch) {
        filas.push([
          week.label,
          week.weekStart,
          week.weekEnd,
          getBranchDisplayName(row.branchId),
          formatMoney(row.cobrado),
          formatMoney(row.costos),
          formatMoney(row.margen),
          String(row.recibidos),
          String(row.entregados)
        ]);
      }
      filas.push([
        week.label,
        week.weekStart,
        week.weekEnd,
        'Total',
        formatMoney(week.cobrado),
        formatMoney(week.costos),
        formatMoney(week.margen),
        String(week.recibidos),
        String(week.entregados)
      ]);
    }
    const csv = [encabezado, ...filas]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas-taller-${safeDateIsoKey(trustedIso())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 flex items-start gap-3">
        <Wallet className="w-5 h-5 text-indigo-700 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-black">Libro del taller, aparte de la caja del día</p>
          <p>
            El efectivo de anticipos y liquidaciones sigue entrando al cajón y al Corte X. Aquí se ve la
            utilidad del taller: lo cobrado al cliente menos refacciones y mano de obra.
          </p>
        </div>
      </div>

      {current && (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-indigo-700">Semana actual</p>
              <h2 className="text-base font-black text-slate-900">{current.label}</h2>
            </div>
            <button
              type="button"
              onClick={exportWeeks}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar semanas
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <FinanceCard label="Cobrado" value={`$${formatMoney(current.cobrado)}`} hint="Anticipos y saldos" />
            <FinanceCard label="Costos" value={`$${formatMoney(current.costos)}`} hint="Refacción y mano de obra" />
            <FinanceCard
              label="Margen"
              value={`$${formatMoney(current.margen)}`}
              hint="Cobrado menos costos"
              tone={current.margen >= 0 ? 'ok' : 'bad'}
            />
            <FinanceCard label="Recibidos" value={String(current.recibidos)} hint="Entraron al taller" />
            <FinanceCard label="Entregados" value={String(current.entregados)} hint="Salieron listos" />
          </div>

          {current.byBranch.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-semibold">Sucursal</th>
                    <th className="py-2 pr-3 font-semibold text-right">Cobrado</th>
                    <th className="py-2 pr-3 font-semibold text-right">Costos</th>
                    <th className="py-2 pr-3 font-semibold text-right">Margen</th>
                    <th className="py-2 pr-3 font-semibold text-right">Recibidos</th>
                    <th className="py-2 font-semibold text-right">Entregados</th>
                  </tr>
                </thead>
                <tbody>
                  {current.byBranch.map((row) => (
                    <tr key={row.branchId} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-bold text-slate-900">{getBranchDisplayName(row.branchId)}</td>
                      <td className="py-2 pr-3 text-right font-mono">${formatMoney(row.cobrado)}</td>
                      <td className="py-2 pr-3 text-right font-mono">${formatMoney(row.costos)}</td>
                      <td className={`py-2 pr-3 text-right font-mono font-bold ${moneyTone(row.margen)}`}>
                        ${formatMoney(row.margen)}
                      </td>
                      <td className="py-2 pr-3 text-right">{row.recibidos}</td>
                      <td className="py-2 text-right">{row.entregados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              Esta semana todavía no hay cobros ni costos internos de taller.
            </p>
          )}

          {currentLines.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                Costos capturados esta semana
              </p>
              <ul className="space-y-1.5">
                {currentLines.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {line.repairId} · {REPAIR_COST_KIND_LABEL[line.kind]} · {line.concept}
                      </p>
                      <p className="text-slate-500">
                        {getBranchDisplayName(line.branchId)} · {stampRepairLabel(line.at, undefined)} · {line.by}
                      </p>
                    </div>
                    <span className="font-black text-slate-900 shrink-0">${formatMoney(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Historial semanal</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Semanas con movimiento de taller. Carga ventas anteriores si falta cobrado viejo.
          </p>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            Aún no hay semanas anteriores con cobros o costos de taller.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((week) => {
              const open = openWeek === week.weekStart;
              return (
                <div key={week.weekStart} className="rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenWeek(open ? null : week.weekStart)}
                    className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">{week.label}</p>
                      <p className="text-[11px] text-slate-500">
                        {week.recibidos} recibidos · {week.entregados} entregados
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-slate-600 hidden sm:inline">
                        cobrado ${formatMoney(week.cobrado)}
                      </span>
                      <span className={`text-xs font-black ${moneyTone(week.margen)}`}>
                        ${formatMoney(week.margen)}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 ${open ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 border-t border-slate-100 pt-2 overflow-x-auto">
                      {week.byBranch.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-2">Sin desglose.</p>
                      ) : (
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="py-1 pr-3 font-semibold">Sucursal</th>
                              <th className="py-1 pr-3 font-semibold text-right">Cobrado</th>
                              <th className="py-1 pr-3 font-semibold text-right">Costos</th>
                              <th className="py-1 font-semibold text-right">Margen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {week.byBranch.map((row) => (
                              <tr key={row.branchId}>
                                <td className="py-1 pr-3 font-bold">{getBranchDisplayName(row.branchId)}</td>
                                <td className="py-1 pr-3 text-right font-mono">${formatMoney(row.cobrado)}</td>
                                <td className="py-1 pr-3 text-right font-mono">${formatMoney(row.costos)}</td>
                                <td className={`py-1 text-right font-mono font-bold ${moneyTone(row.margen)}`}>
                                  ${formatMoney(row.margen)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <LoadMoreButton
          hasMore={salesHasMore}
          loading={salesLoading}
          onClick={onLoadOlderSales}
          label="Cargar ventas anteriores"
        />
      </section>
    </div>
  );
}

function FinanceCard({
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
