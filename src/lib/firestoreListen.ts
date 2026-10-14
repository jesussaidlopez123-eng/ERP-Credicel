/**
 * Reintenta una escucha de Firestore si la red falla un momento.
 * Si se acabó la cuota gratis del día, espera mucho: reintentar cada segundo
 * la agota más y no trae los datos de vuelta.
 */
export const FIRESTORE_QUOTA_RETRY_MS = 20 * 60 * 1000;

export function firestoreErrorText(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err.toLowerCase();
  const row = err as { code?: string; message?: string };
  return `${row.code || ''} ${row.message || ''}`.toLowerCase();
}

export function isFirestoreQuotaError(err: unknown): boolean {
  const text = firestoreErrorText(err);
  return text.includes('resource-exhausted') || text.includes('quota');
}

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
        const wait = isFirestoreQuotaError(err)
          ? FIRESTORE_QUOTA_RETRY_MS
          : delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 15000;
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
