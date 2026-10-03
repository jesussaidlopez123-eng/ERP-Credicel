import React from 'react';

export default function LoadMoreButton({
  hasMore,
  loading,
  onClick,
  label = 'Cargar historial anterior'
}: {
  hasMore?: boolean;
  loading?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  if (!onClick || (!hasMore && !loading)) return null;
  return (
    <div className="p-2 flex justify-center">
      <button
        type="button"
        disabled={loading || !hasMore}
        onClick={onClick}
        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
      >
        {loading ? 'Cargando…' : label}
      </button>
    </div>
  );
}
