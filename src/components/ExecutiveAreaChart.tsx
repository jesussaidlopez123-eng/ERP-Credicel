import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
  addExecutiveAreaTotals,
  areaStackValues,
  emptyExecutiveAreaTotals,
  type ExecutiveAreaPoint,
  type ExecutiveAreaTotals
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
}

export default function ExecutiveAreaChart({
  points,
  branchId,
  onBranchChange,
  totals
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
      points.map((point) => {
        const stacked = areaStackValues(point);
        return {
          ...point,
          ...stacked,
          rawUtilidad: point.utilidad
        };
      }),
    [points]
  );

  const hasSeries = totals.utilidad || totals.inversion || totals.gastos || totals.retorno;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ingresos</p>
            <h2 className="text-lg font-semibold text-slate-950">Área por semana</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verde utilidad · azul inversión · rojo gastos · amarillo retorno
            </p>
          </div>
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
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EXECUTIVE_AREA_LEGEND.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
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
            Aún no hay ingresos en las semanas cargadas para{' '}
            {branchId === 'all' ? 'todas las sucursales' : getBranchDisplayName(branchId)}.
          </div>
        ) : (
          <div className="h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="title"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickMargin={8}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={axisMoney}
                  width={52}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const key = String(name) as keyof ExecutiveAreaTotals;
                    const meta = EXECUTIVE_AREA_LEGEND.find((item) => item.id === key);
                    return [`$${peso(Number(value) || 0)}`, meta?.label || String(name)];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as ExecutiveAreaPoint | undefined;
                    return row ? `${row.title} · ${row.label}` : '';
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => EXECUTIVE_AREA_LEGEND.find((item) => item.id === value)?.label || value}
                />
                <Area
                  type="monotone"
                  dataKey="utilidad"
                  name="utilidad"
                  stackId="ing"
                  stroke={EXECUTIVE_AREA_COLORS.utilidad}
                  fill={EXECUTIVE_AREA_COLORS.utilidad}
                  fillOpacity={0.78}
                />
                <Area
                  type="monotone"
                  dataKey="inversion"
                  name="inversion"
                  stackId="ing"
                  stroke={EXECUTIVE_AREA_COLORS.inversion}
                  fill={EXECUTIVE_AREA_COLORS.inversion}
                  fillOpacity={0.78}
                />
                <Area
                  type="monotone"
                  dataKey="gastos"
                  name="gastos"
                  stackId="ing"
                  stroke={EXECUTIVE_AREA_COLORS.gastos}
                  fill={EXECUTIVE_AREA_COLORS.gastos}
                  fillOpacity={0.78}
                />
                <Area
                  type="monotone"
                  dataKey="retorno"
                  name="retorno"
                  stackId="ing"
                  stroke={EXECUTIVE_AREA_COLORS.retorno}
                  fill={EXECUTIVE_AREA_COLORS.retorno}
                  fillOpacity={0.78}
                />
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
