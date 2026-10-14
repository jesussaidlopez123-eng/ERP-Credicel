/**
 * Reintenta una escucha de Firestore si la red o la cuota fallan un momento.
 * Un fallo de Notas o agenda no debe dejar el POS en “sin nube” para siempre.
 */
export function listenSnapshotWithRetry<TSnapshot>(
  attach: (onNext: (snap: TSnapshot) => void, onError: (err: unknown) => void) => () => void,
  onNext: (snap: TSnapshot) => void,
  onError?: (err: unknown) => void,
  delaysMs: number[] = [800, 2000, 5000, 15000]
): () => void {
  let stopped = false;
  let unsub: (() => void) | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let reported = false;

  const clearTimer = () => {
    if (timer == null) return;
    clearTimeout(timer);
    timer = null;
  };

  const start = () => {
    if (stopped) return;
    unsub?.();
    unsub = attach(
      (snap) => {
        attempt = 0;
        reported = false;
        onNext(snap);
      },
      (err) => {
        console.warn('[Firestore] escucha interrumpida, se reintenta:', err);
        if (stopped) return;
        unsub?.();
        unsub = null;
        if (!reported && attempt >= delaysMs.length - 1) {
          reported = true;
          onError?.(err);
        }
        const wait = delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 15000;
        attempt += 1;
        clearTimer();
        timer = setTimeout(start, wait);
      }
    );
  };

  start();
  return () => {
    stopped = true;
    clearTimer();
    unsub?.();
    unsub = null;
  };
}
