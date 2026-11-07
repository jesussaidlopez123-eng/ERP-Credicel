import assert from 'node:assert/strict';
import { dropAbsentFromLiveWindow, mergeByIdKeep, oldestTimestamp } from './listMerge.ts';

assert.deepEqual(
  mergeByIdKeep(
    [
      { id: 'a', timestamp: '2026-11-01' },
      { id: 'b', timestamp: '2026-11-02' }
    ],
    [{ id: 'b', timestamp: '2026-11-03' }, { id: 'c', timestamp: '2026-11-04' }]
  ).map((row) => `${row.id}:${row.timestamp}`),
  ['a:2026-11-01', 'b:2026-11-03', 'c:2026-11-04']
);

assert.equal(oldestTimestamp([{ timestamp: '2026-11-07T10:00:00.000Z' }, { timestamp: '2026-11-06' }], 'timestamp'), '2026-11-06');

assert.deepEqual(
  dropAbsentFromLiveWindow(
    [
      { id: 'keep-old', timestamp: '2026-10-01T00:00:00.000Z' },
      { id: 'deleted', timestamp: '2026-11-07T20:00:00.000Z' },
      { id: 'live', timestamp: '2026-11-07T21:00:00.000Z' },
      { id: 'live-old', timestamp: '2026-11-07T18:00:00.000Z' }
    ],
    [
      { id: 'live', timestamp: '2026-11-07T21:00:00.000Z' },
      { id: 'live-old', timestamp: '2026-11-07T18:00:00.000Z' }
    ]
  ).map((row) => row.id),
  ['keep-old', 'live', 'live-old']
);

console.log('listMerge self-test ok');
