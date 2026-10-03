import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  Receipt,
  ShoppingBag,
  Store,
  TrendingDown
} from 'lucide-react';
import type { SaleCategoryKey } from '../lib/saleClassification';
import {
  CORTE_CATEGORY_META,
  CORTE_CATEGORY_ORDER,
  type CorteCategoryBreakdown as Breakdown
} from '../lib/corteCategories';

function peso(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ICONS: Record<SaleCategoryKey | 'gastos', React.ReactNode> = {
  accesorios: <ShoppingBag className="w-4 h-4 text-blue-600 shrink-0" />,
  abonos: <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />,
  enganches: <Store className="w-4 h-4 text-emerald-600 shrink-0" />,
  reparaciones: <Receipt className="w-4 h-4 text-amber-600 shrink-0" />,
  recargas: <DollarSign className="w-4 h-4 text-teal-600 shrink-0" />,
  gastos: <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
};

type Props = {
  breakdown: Breakdown;
  caption?: string;
};

export default function CorteCategoryBreakdown({
  breakdown,
  caption = 'Suma de lunes a domingo. Haz clic en una fila para ver el detalle.'
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
      <div className="px-4 py-3 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-slate-600" />
          <span>Desglose por Concepto / Categoría</span>
        </h4>
        <span className="text-xs text-slate-500">{caption}</span>
      </div>

      {CORTE_CATEGORY_ORDER.map((key) => {
        const meta = CORTE_CATEGORY_META[key];
        const count = breakdown.counts[key];
        const total = breakdown.totals[key];
        const groups = breakdown.groups[key];
        const lines = breakdown.details[key];
        const expanded = Boolean(open[key]);
        const showLines = key === 'abonos';
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                {ICONS[key]}
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900">{meta.label}</span>
                  <span className="text-[11px] text-slate-500 ml-2">
                    ({count} {meta.countLabel})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-black text-slate-900 font-mono">${peso(total)}</span>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
            {expanded && (
              <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-1.5 border-t border-slate-100">
                {showLines ? (
                  lines.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-1">{meta.empty}</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-0.5 border-b border-slate-200">
                        <span>Detalle de Abonos ({lines.length})</span>
                        <span>Monto / Pago</span>
                      </div>
                      {lines.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900">{item.productName}</span>
                              <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100">
                                {item.ticketFolio}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>{item.dateLabel}</span>
                              <span>·</span>
                              <span>{item.branchName}</span>
                              <span>·</span>
                              <span>{item.paymentMethod}</span>
                              {item.metadata?.deviceModel && (
                                <>
                                  <span>·</span>
                                  <span className="text-indigo-600">{item.metadata.deviceModel}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="font-mono font-black text-sm text-indigo-700 shrink-0">
                            ${peso(item.totalPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                ) : groups.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1">{meta.empty}</p>
                ) : (
                  groups.map((grp) => (
                    <div
                      key={grp.name}
                      className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none gap-3"
                    >
                      <span className="text-slate-700 font-medium">
                        {grp.count}x {grp.name}
                      </span>
                      <span className="font-mono font-bold text-slate-900 shrink-0">${peso(grp.total)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      <div>
        <button
          type="button"
          onClick={() => toggle('gastos')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            {ICONS.gastos}
            <div>
              <span className="text-xs font-bold text-slate-900">{CORTE_CATEGORY_META.gastos.label}</span>
              <span className="text-[11px] text-slate-500 ml-2">
                ({breakdown.expenseCount} {CORTE_CATEGORY_META.gastos.countLabel})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-rose-600 font-mono">
              −${peso(breakdown.totalExpenses)}
            </span>
            {open.gastos ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>
        {open.gastos && (
          <div className="px-4 pb-3 pt-1 bg-slate-50/50 space-y-1.5 border-t border-slate-100">
            {breakdown.expenseGroups.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-1">{CORTE_CATEGORY_META.gastos.empty}</p>
            ) : (
              breakdown.expenseGroups.map((grp) => (
                <div
                  key={grp.name}
                  className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none gap-3"
                >
                  <span className="text-slate-700 font-medium">
                    {grp.count > 1 ? `${grp.count}x ${grp.name}` : grp.name}
                  </span>
                  <span className="font-mono font-bold text-rose-600 shrink-0">−${peso(grp.total)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
