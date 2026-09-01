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
    <div className="p-4 flex justify-center">
      <button
        type="button"
        disabled={loading || !hasMore}
        onClick={onClick}
        className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
      >
        {loading ? 'Cargando…' : label}
      </button>
    </div>
  );
}
