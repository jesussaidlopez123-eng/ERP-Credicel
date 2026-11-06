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
import CorteSoldLine from './CorteSoldLine';

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
  caption = ''
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
      <div className="px-3 py-2 bg-slate-50 flex items-center justify-between gap-1">
        <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-slate-500" />
          <span>Desglose</span>
        </h4>
        {caption ? <span className="text-[11px] text-slate-500">{caption}</span> : null}
      </div>

      {CORTE_CATEGORY_ORDER.map((key) => {
        const meta = CORTE_CATEGORY_META[key];
        const count = breakdown.counts[key];
        const total = breakdown.totals[key];
        const groups = breakdown.groups[key];
        const lines = breakdown.details[key];
        const expanded = Boolean(open[key]);
        const showLines = key === 'abonos' || key === 'accesorios' || key === 'enganches';
        const lineTone = key === 'abonos' ? 'indigo' : key === 'enganches' ? 'emerald' : 'blue';
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
                        <span>
                          {key === 'abonos' ? 'Detalle de abonos' : key === 'enganches' ? 'Celulares a crédito' : 'Piezas y equipos'} ({lines.length})
                        </span>
                        <span>Monto</span>
                      </div>
                      {lines.map((item) => (
                        <CorteSoldLine
                          key={item.id}
                          tone={lineTone}
                          item={{
                            productName: item.productName,
                            ticketFolio: item.ticketFolio,
                            dateLabel: item.dateLabel,
                            branchName: item.branchName,
                            paymentMethod: item.paymentMethod,
                            totalPrice: item.totalPrice,
                            qty: item.qty,
                            imei: item.imei,
                            deviceModel: item.metadata?.deviceModel
                          }}
                        />
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
