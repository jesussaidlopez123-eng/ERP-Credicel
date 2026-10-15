import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Smartphone, X } from 'lucide-react';
import { COMMERCIAL_BRANCHES, compareBranchIds, getBranchDisplayName } from '../data/initialBranches';
import { money } from '../lib/ids';
import {
  EXECUTIVE_AREA_COLORS,
  EXECUTIVE_AREA_LEGEND,
  EXECUTIVE_LINE_PERIODS,
  addExecutiveAreaTotals,
  areaStackValues,
  emptyExecutiveAreaTotals,
  executiveTramoSegments,
  type ExecutiveAreaPoint,
  type ExecutiveAreaTotals,
  type ExecutiveLinePeriod,
  type ExecutivePhoneCounts,
  type ExecutivePhoneSale
} from '../lib/executiveArea';

function peso(n: number): string {
  return money(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function axisMoney(n: number): string {
  const v = Math.abs(n);
  if (v >= 10000) return `$${(n / 1000).toFixed(0)}k`;
  if (v >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

type BranchChip = { id: string; name: string };

interface ExecutiveAreaChartProps {
  points: ExecutiveAreaPoint[];
  branchId: string;
  onBranchChange: (id: string) => void;
  totals: ExecutiveAreaTotals;
  period: ExecutiveLinePeriod;
  onPeriodChange: (period: ExecutiveLinePeriod) => void;
  rangeFrom: string;
  rangeTo: string;
  onRangeChange: (from: string, to: string) => void;
  periodLabel: string;
  phoneCounts: ExecutivePhoneCounts;
  phoneSales: ExecutivePhoneSale[];
}

export default function ExecutiveAreaChart({
  points,
  branchId,
  onBranchChange,
  totals,
  period,
  onPeriodChange,
  rangeFrom,
  rangeTo,
  onRangeChange,
  periodLabel,
  phoneCounts,
  phoneSales
}: ExecutiveAreaChartProps) {
  const [phonesOpen, setPhonesOpen] = useState(false);
  const branches: BranchChip[] = useMemo(
    () => [
      { id: 'all', name: 'Todas' },
      ...COMMERCIAL_BRANCHES.slice()
        .sort((a, b) => compareBranchIds(a.id, b.id))
        .map((b) => ({ id: b.id, name: getBranchDisplayName(b.id) }))
    ],
    []
  );

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        ...areaStackValues(point)
      })),
    [points]
  );

  const segments = useMemo(() => executiveTramoSegments(totals), [totals]);
  const tramoTotal = useMemo(
    () => segments.reduce((sum, item) => sum + item.amount, 0),
    [segments]
  );
  const hasSeries = tramoTotal > 0;
  const tickEvery = chartData.length > 16 ? Math.ceil(chartData.length / 8) : 1;
  const maxDailyPhones = Math.max(0, ...chartData.map((point) => point.equiposVendidos || 0));
  const dayCount = chartData.length || 1;
  const avgPhones = phoneCounts.total / dayCount;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ingresos</p>
            <h2 className="text-lg font-semibold text-slate-950">Un solo tramo</h2>
            <p className="text-xs text-slate-500 mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-full self-start">
            {EXECUTIVE_LINE_PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPeriodChange(item.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold cursor-pointer ${
                  period === item.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'rango' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-bold text-slate-500">
              Del
              <input
                type="date"
                value={rangeFrom}
                max={rangeTo}
                onChange={(e) => onRangeChange(e.target.value, rangeTo)}
                className="ml-1.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              al
              <input
                type="date"
                value={rangeTo}
                min={rangeFrom}
                onChange={(e) => onRangeChange(rangeFrom, e.target.value)}
                className="ml-1.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              />
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => onBranchChange(branch.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold cursor-pointer border ${
                branchId === branch.id
                  ? 'bg-slate-950 text-white border-slate-950'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              {branch.name}
            </button>
          ))}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setPhonesOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setPhonesOpen(true);
            }
          }}
          className="rounded-2xl border border-slate-200 bg-slate-950 text-white px-4 py-3.5 cursor-pointer hover:border-blue-400/60 hover:bg-slate-900 transition-colors text-left"
          aria-label="Ver lista de equipos vendidos"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Equipos vendidos
              </p>
              <p className="font-mono text-4xl font-black tabular-nums mt-1">{phoneCounts.total}</p>
              <p className="text-xs text-slate-400 mt-1">
                {phoneCounts.total === 1 ? 'celular' : 'celulares'} en {periodLabel}
                {phoneCounts.total > 0
                  ? ` · ${avgPhones >= 10 ? avgPhones.toFixed(0) : avgPhones.toFixed(1)} al día`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-lg bg-white/10 px-2.5 py-1.5">
                Contado <strong className="font-mono">{phoneCounts.contado}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1.5">
                Crédito <strong className="font-mono">{phoneCounts.credito}</strong>
              </span>
              <span className="rounded-lg bg-blue-500 px-2.5 py-1.5 font-extrabold text-white">
                Ver lista
              </span>
            </div>
          </div>
          {phoneCounts.byBranch.length > 1 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {phoneCounts.byBranch.map((branch) => (
                <div key={branch.id} className="rounded-xl bg-white/10 border border-white/10 px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {branch.name}
                  </p>
                  <p className="font-mono text-lg font-black tabular-nums">{branch.total}</p>
                  <p className="text-[10px] text-slate-500">
                    {branch.contado} contado · {branch.credito} crédito
                  </p>
                </div>
              ))}
            </div>
          )}
          {chartData.length > 1 && (
            <div className="mt-3">
              <div className="flex items-end gap-0.5 h-8">
                {chartData.map((point) => {
                  const n = point.equiposVendidos || 0;
                  const px =
                    maxDailyPhones > 0 && n > 0
                      ? Math.max(6, Math.round((n / maxDailyPhones) * 32))
                      : 4;
                  return (
                    <div
                      key={point.dateKey}
                      title={`${point.label}: ${n} ${n === 1 ? 'equipo' : 'equipos'}`}
                      className="flex-1 min-w-0 rounded-sm"
                      style={{
                        height: `${px}px`,
                        backgroundColor: n > 0 ? '#93c5fd' : 'rgba(255,255,255,0.12)'
                      }}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Cada barra es un día del periodo elegido (semana, mes o rango).
              </p>
            </div>
          )}
        </div>

        {hasSeries ? (
          <div>
            <div className="flex items-end justify-between gap-2 mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Composición</p>
              <p className="font-mono text-xs font-black text-slate-900">${peso(tramoTotal)}</p>
            </div>
            <div className="flex h-6 sm:h-7 w-full overflow-hidden rounded-full bg-slate-100">
              {segments.map((item) => (
                <div
                  key={item.id}
                  title={`${item.label} ${item.pct}%`}
                  style={{
                    width: `${Math.max(item.pct, 0)}%`,
                    backgroundColor: EXECUTIVE_AREA_COLORS[item.id]
                  }}
                  className="h-full min-w-0 flex items-center justify-center"
                >
                  {item.pct >= 14 ? (
                    <span className="text-[9px] font-black text-white/95 px-1 truncate">
                      {Math.round(item.pct)}%
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {EXECUTIVE_AREA_LEGEND.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: EXECUTIVE_AREA_COLORS[item.id] }}
                />
                {item.label}
              </p>
              <p className="font-mono text-sm font-black text-slate-950 mt-0.5">
                {item.id === 'gastos' || item.id === 'retorno' ? '−' : ''}${peso(Math.abs(totals[item.id] || 0))}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">{item.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-2 sm:px-4 py-3">
        {!hasSeries ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
            Aún no hay movimiento en este periodo para{' '}
            {branchId === 'all' ? 'todas las sucursales' : getBranchDisplayName(branchId)}.
          </div>
        ) : (
          <div className="h-44 sm:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="title"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickMargin={8}
                  interval={tickEvery - 1}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={axisMoney} width={52} />
                <Tooltip
                  formatter={(value, name) => {
                    const key = String(name) as keyof ExecutiveAreaTotals;
                    const meta = EXECUTIVE_AREA_LEGEND.find((item) => item.id === key);
                    return [`$${peso(Number(value) || 0)}`, meta?.label || String(name)];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as ExecutiveAreaPoint | undefined;
                    if (!row) return '';
                    const n = row.equiposVendidos || 0;
                    return `${row.label} · ${n} ${n === 1 ? 'equipo' : 'equipos'}`;
                  }}
                />
                {EXECUTIVE_AREA_LEGEND.map((item) => (
                  <Area
                    key={item.id}
                    type="monotone"
                    dataKey={item.id}
                    name={item.id}
                    stackId="tramo"
                    stroke={EXECUTIVE_AREA_COLORS[item.id]}
                    fill={EXECUTIVE_AREA_COLORS[item.id]}
                    fillOpacity={1}
                    strokeWidth={0}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {phonesOpen && (
        <PhonesSoldModal
          sales={phoneSales}
          periodLabel={periodLabel}
          branchId={branchId}
          onClose={() => setPhonesOpen(false)}
        />
      )}
    </section>
  );
}

function PhonesSoldModal({
  sales,
  periodLabel,
  branchId,
  onClose
}: {
  sales: ExecutivePhoneSale[];
  periodLabel: string;
  branchId: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const showBranch = branchId === 'all';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((row) =>
      [
        row.dateLabel,
        row.model,
        row.imei,
        row.clientName,
        row.clientPhone,
        row.operatorName,
        row.branchName,
        row.folio,
        row.saleKind
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [sales, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="phones-sold-title"
        aria-modal="true"
      >
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200 bg-slate-950 text-white flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              Equipos vendidos
            </p>
            <h3 id="phones-sold-title" className="text-lg font-semibold mt-1">
              Lista de ventas
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {periodLabel}
              {' · '}
              {sales.length} {sales.length === 1 ? 'equipo' : 'equipos'}
              {showBranch ? ' · Todas las sucursales' : ` · ${getBranchDisplayName(branchId)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg cursor-pointer text-slate-300 hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por fecha, equipo, IMEI, cliente, número o vendedor"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 bg-white"
          />
        </div>

        <div className="flex-1 overflow-auto">
          {sales.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              Aún no hay equipos vendidos en este periodo.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              Ninguna venta coincide con esa búsqueda.
            </div>
          ) : (
            <>
              <div className="sm:hidden divide-y divide-slate-100">
                {filtered.map((row) => (
                  <article key={row.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950">{row.model}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          row.saleKind === 'credito'
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {row.saleKind === 'credito' ? 'Crédito' : 'Contado'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{row.dateLabel}</p>
                    <p className="text-xs text-slate-700 font-mono">{row.imei || 'Sin IMEI'}</p>
                    <p className="text-xs text-slate-700">
                      {row.clientName}
                      {row.clientPhone ? ` · ${row.clientPhone}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.operatorName}
                      {showBranch ? ` · ${row.branchName}` : ''}
                    </p>
                  </article>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Fecha</th>
                      <th className="px-3 py-2.5 font-bold">Equipo</th>
                      <th className="px-3 py-2.5 font-bold">IMEI</th>
                      <th className="px-3 py-2.5 font-bold">Cliente</th>
                      <th className="px-3 py-2.5 font-bold">Número</th>
                      <th className="px-3 py-2.5 font-bold">Vendedor</th>
                      {showBranch ? <th className="px-3 py-2.5 font-bold">Sucursal</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{row.dateLabel}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-950">{row.model}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {row.saleKind === 'credito' ? 'Crédito' : 'Contado'}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-800 whitespace-nowrap">
                          {row.imei || 'Sin IMEI'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">{row.clientName}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-800 whitespace-nowrap">
                          {row.clientPhone || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">{row.operatorName}</td>
                        {showBranch ? (
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{row.branchName}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function sumAreaPoints(points: ExecutiveAreaPoint[]): ExecutiveAreaTotals {
  return points.reduce((acc, point) => addExecutiveAreaTotals(acc, point), emptyExecutiveAreaTotals());
}
