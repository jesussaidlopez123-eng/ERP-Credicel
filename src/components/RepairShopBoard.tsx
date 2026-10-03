import React from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { RepairRecord } from '../types';
import { formatMoney, money } from '../lib/ids';
import {
  REPAIR_WORK_STAGES,
  REPAIR_WORK_STAGE_META,
  repairDaysInShop,
  workStageOf
} from '../lib/repairUtils';
import { getBranchDisplayName } from '../data/initialBranches';

interface RepairShopBoardProps {
  records: RepairRecord[];
  selectedId?: string | null;
  showBranch?: boolean;
  onSelect: (record: RepairRecord) => void;
  onMove: (record: RepairRecord, delta: -1 | 1) => void;
}

export default function RepairShopBoard({
  records,
  selectedId,
  showBranch = false,
  onSelect,
  onMove
}: RepairShopBoardProps) {
  const grouped = REPAIR_WORK_STAGES.map((stage) => ({
    stage,
    rows: records.filter((r) => workStageOf(r) === stage)
  }));

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {grouped.map(({ stage, rows }) => {
        const meta = REPAIR_WORK_STAGE_META[stage];
        return (
          <section
            key={stage}
            className="min-w-[15.5rem] w-[15.5rem] sm:flex-1 sm:min-w-[13rem] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shrink-0"
          >
            <header className="px-2.5 py-1.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold text-slate-700">{meta.label}</h3>
              <span className="text-[10px] font-semibold text-slate-500 tabular-nums">{rows.length}</span>
            </header>
            <div className="p-1.5 space-y-1.5 min-h-[8rem]">
              {rows.length === 0 ? (
                <p className="text-[11px] text-slate-400 px-1 py-6 text-center">—</p>
              ) : (
                rows.map((record) => {
                  const days = repairDaysInShop(record);
                  const selected = selectedId === record.id;
                  const idx = REPAIR_WORK_STAGES.indexOf(stage);
                  return (
                    <article
                      key={record.id}
                      className={`rounded-lg border bg-white px-2 py-1.5 space-y-1 ${
                        selected ? 'border-[#0047AB] ring-1 ring-[#0047AB]/20' : 'border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(record)}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] font-semibold text-slate-800">
                            {record.id}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                              days >= 7 ? 'text-rose-700' : days >= 3 ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {days}d
                          </span>
                        </div>
                        <p className="text-[12px] font-semibold text-slate-900 truncate">{record.deviceModel}</p>
                        <p className="text-[11px] text-slate-500 truncate">{record.clientName}</p>
                        <p className="text-[11px] text-slate-600 truncate">{record.issueDescription || '—'}</p>
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <span className="text-[10px] text-slate-500">
                            {showBranch ? getBranchDisplayName(record.branchId) : ''}
                          </span>
                          <span className={`text-[11px] font-semibold tabular-nums ${
                            money(record.pendingBalance) > 0 ? 'text-amber-800' : 'text-slate-500'
                          }`}>
                            {money(record.pendingBalance) > 0
                              ? `Saldo $${formatMoney(record.pendingBalance)}`
                              : money(record.totalCost) > 0
                                ? 'Pagado'
                                : 'Sin precio'}
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center justify-between pt-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onMove(record, -1)}
                          className="p-1 rounded-md border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                          title="Paso anterior"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-400">{meta.short}</span>
                        <button
                          type="button"
                          disabled={idx === REPAIR_WORK_STAGES.length - 1}
                          onClick={() => onMove(record, 1)}
                          className="p-1 rounded-md border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                          title="Siguiente paso"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
