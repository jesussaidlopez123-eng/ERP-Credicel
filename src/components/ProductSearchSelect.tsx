import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Product } from '../types';
import { filterProductsByQuery, productPickLabel } from '../lib/productSearch';

type ExtraOption = { id: string; label: string };

interface ProductSearchSelectProps {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  emptyLabel?: string;
  disabled?: boolean;
  getLabel?: (product: Product) => string;
  extraOptions?: ExtraOption[];
  focusClassName?: string;
  autoFocus?: boolean;
}

export default function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder,
  emptyLabel = 'No hay modelos registrados',
  disabled = false,
  getLabel = productPickLabel,
  extraOptions = [],
  focusClassName = 'focus:ring-2 focus:ring-blue-600',
  autoFocus = false
}: ProductSearchSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => products.find((p) => p.id === value) || extraOptions.find((o) => o.id === value),
    [products, extraOptions, value]
  );
  const selectedLabel = selected
    ? 'name' in selected
      ? getLabel(selected as Product)
      : selected.label
    : '';

  const filtered = useMemo(() => filterProductsByQuery(products, query), [products, query]);
  const extras = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return extraOptions;
    return extraOptions.filter((opt) => opt.label.toLowerCase().includes(q) || opt.id.toLowerCase().includes(q));
  }, [extraOptions, query]);
  const rows: Array<{ id: string; label: string }> = [
    ...filtered.map((p) => ({ id: p.id, label: getLabel(p) })),
    ...extras
  ];

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    setOpen(true);
  }, [autoFocus]);

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
  }, [query, open]);

  const pick = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  const display = open ? query : selectedLabel;

  return (
    <div ref={rootRef} className="relative">
      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={disabled || (products.length === 0 && extraOptions.length === 0)}
        placeholder={products.length === 0 && extraOptions.length === 0 ? emptyLabel : placeholder}
        value={products.length === 0 && extraOptions.length === 0 ? '' : display}
        onFocus={() => {
          if (disabled || (products.length === 0 && extraOptions.length === 0)) return;
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
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
            e.preventDefault();
            const hit = rows[activeIndex];
            if (hit) pick(hit.id);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
        className={`w-full pl-8 pr-8 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white ${focusClassName} focus:outline-none disabled:bg-slate-50 disabled:text-slate-400`}
      />
      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      {open && (products.length > 0 || extraOptions.length > 0) && (
        <ul
          role="listbox"
          className="relative z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-slate-500">Ningún modelo coincide con “{query}”.</li>
          ) : (
            rows.map((row, idx) => (
              <li key={row.id} role="option" aria-selected={row.id === value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row.id)}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer ${
                    idx === activeIndex ? 'bg-slate-100 text-slate-900' : 'text-slate-800 hover:bg-slate-50'
                  } ${row.id === value ? 'text-[#0047AB]' : ''}`}
                >
                  {row.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
