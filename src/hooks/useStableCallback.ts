import { useCallback, useRef } from 'react';

/** Misma identidad de función entre renders; siempre llama a la última versión. */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}
