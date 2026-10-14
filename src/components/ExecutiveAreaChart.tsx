import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
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
  type ExecutiveLinePeriod
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
  periodLabel
}: ExecutiveAreaChartProps) {
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                {item.id === 'gastos' || item.id === 'retorno' ? '−' : ''}${peso(Math.abs(totals[item.id]))}
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
                    return row ? row.label : '';
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
    </section>
  );
}

export function sumAreaPoints(points: ExecutiveAreaPoint[]): ExecutiveAreaTotals {
  return points.reduce((acc, point) => addExecutiveAreaTotals(acc, point), emptyExecutiveAreaTotals());
}
