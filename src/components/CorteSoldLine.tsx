import React from 'react';

export type CorteSoldLineItem = {
  id?: string;
  productName: string;
  ticketFolio: string;
  time?: string;
  dateLabel?: string;
  branchName?: string;
  paymentMethod?: string;
  totalPrice: number;
  qty?: number;
  imei?: string;
  deviceModel?: string;
};

function peso(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TONE = {
  indigo: {
    folio: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    amount: 'text-indigo-700',
    hover: 'hover:border-indigo-300'
  },
  emerald: {
    folio: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    amount: 'text-emerald-800',
    hover: 'hover:border-emerald-300'
  },
  blue: {
    folio: 'bg-blue-50 text-blue-800 border-blue-100',
    amount: 'text-slate-900',
    hover: 'hover:border-blue-300'
  }
} as const;

type Tone = keyof typeof TONE;

export default function CorteSoldLine({
  item,
  tone = 'blue'
}: {
  item: CorteSoldLineItem;
  tone?: Tone;
}) {
  const colors = TONE[tone];
  const qty = item.qty && item.qty > 1 ? `${item.qty}x ` : '';
  const when = item.dateLabel || item.time;
  const imei = String(item.imei || '').trim();
  return (
    <div
      className={`flex items-start justify-between text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs ${colors.hover} transition-colors gap-3`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-900">
            {qty}
            {item.productName}
          </span>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${colors.folio}`}>
            {item.ticketFolio}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
          {when ? <span>{when}</span> : null}
          {item.branchName ? (
            <>
              {when ? <span>·</span> : null}
              <span>{item.branchName}</span>
            </>
          ) : null}
          {item.paymentMethod ? (
            <>
              {when || item.branchName ? <span>·</span> : null}
              <span>{item.paymentMethod}</span>
            </>
          ) : null}
          {item.deviceModel ? (
            <>
              <span>·</span>
              <span className="text-indigo-600">{item.deviceModel}</span>
            </>
          ) : null}
        </div>
        {imei ? (
          <p className="mt-1 font-mono text-[11px] font-black tracking-wide text-slate-800">IMEI {imei}</p>
        ) : null}
      </div>
      <span className={`font-mono font-black text-sm shrink-0 ${colors.amount}`}>${peso(item.totalPrice)}</span>
    </div>
  );
}
