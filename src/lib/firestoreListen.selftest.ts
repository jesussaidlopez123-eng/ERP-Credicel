import assert from 'node:assert/strict';
import {
  FIRESTORE_QUOTA_RETRY_MS,
  isFirestoreQuotaError,
  listenSnapshotWithRetry
} from './firestoreListen.ts';

assert.equal(isFirestoreQuotaError({ code: 'resource-exhausted' }), true);
assert.equal(
  isFirestoreQuotaError({ message: 'Quota exceeded for quota metric Free daily read units' }),
  true
);
assert.equal(isFirestoreQuotaError({ code: 'permission-denied' }), false);
assert.equal(FIRESTORE_QUOTA_RETRY_MS >= 10 * 60 * 1000, true, 'la cuota espera minutos, no segundos');

let attaches = 0;
const stop = listenSnapshotWithRetry(
  (onNext) => {
    attaches += 1;
    onNext({ ok: true });
    return () => {};
  },
  (snap) => {
    assert.equal((snap as { ok: boolean }).ok, true);
  }
);
assert.equal(attaches, 1);
stop();

console.log('firestoreListen self-test ok');
