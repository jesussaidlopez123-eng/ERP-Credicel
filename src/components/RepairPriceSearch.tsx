import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { RepairPriceItem } from '../types';
import { formatMoney } from '../lib/ids';
import { repairPricePickLabel, searchRepairPrices } from '../lib/repairPriceCatalog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface RepairPriceSearchProps {
  prices: RepairPriceItem[];
  selectedId?: string;
  onSelect: (item: RepairPriceItem) => void;
  placeholder?: string;
}

export default function RepairPriceSearch({
  prices,
  selectedId,
  onSelect,
  placeholder = 'Buscar modelo o pantalla…'
}: RepairPriceSearchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebouncedValue(query, 80);

  const selected = useMemo(() => prices.find((item) => item.id === selectedId), [prices, selectedId]);
  const rows = useMemo(() => searchRepairPrices(prices, debounced, 14), [prices, debounced]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced, open]);

  const pick = (item: RepairPriceItem) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  const display = open ? query : selected ? `${repairPricePickLabel(selected)}  ·  $${formatMoney(selected.price)}` : '';

  return (
    <div ref={rootRef} className="relative">
      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-600 pointer-events-none" />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={prices.length === 0 ? 'Todavía no hay precios de lista' : placeholder}
        value={prices.length === 0 ? '' : display}
        disabled={prices.length === 0}
        onFocus={() => {
          if (!prices.length) return;
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(rows.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            const hit = rows[activeIndex];
            if (open && hit) {
              e.preventDefault();
              pick(hit);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
        className="w-full pl-8 pr-8 py-2 border border-amber-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
      />
      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      {open && prices.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-slate-500">Ningún modelo coincide con “{query}”.</li>
          ) : (
            rows.map((item, idx) => (
              <li key={item.id} role="option" aria-selected={item.id === selectedId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                  className={`w-full text-left px-3 py-2 cursor-pointer ${
                    idx === activeIndex ? 'bg-amber-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900 truncate">
                        {repairPricePickLabel(item)}
                      </span>
                      <span className="block text-[10px] text-slate-500">{item.category || 'Pantalla'}</span>
                    </span>
                    <span className="shrink-0 text-xs font-black text-emerald-700 font-mono">
                      ${formatMoney(item.price)}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
