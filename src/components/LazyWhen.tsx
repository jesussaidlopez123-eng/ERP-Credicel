import React, { Suspense } from 'react';

/** Monta un chunk pesado solo cuando hace falta (modal, gráfica, vista secundaria). */
export default function LazyWhen({
  when,
  children,
  fallback = null
}: {
  when: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!when) return null;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

export function ModuleLoading() {
  return (
    <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-slate-500 gap-2">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
      <p className="text-xs font-semibold">Cargando módulo…</p>
    </div>
  );
}
