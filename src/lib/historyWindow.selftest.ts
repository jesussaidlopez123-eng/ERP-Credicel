import assert from 'node:assert/strict';
import { oldestTimestamp } from './listMerge.ts';
import { historyWindowReached, oldestDateKey } from './historyWindow.ts';

assert.equal(
  oldestTimestamp(
    [{ timestamp: 'Corte Recuperado' }, { timestamp: '2026-04-01T10:00:00-07:00' }, { timestamp: '' }],
    'timestamp'
  ),
  '2026-04-01T10:00:00-07:00'
);

assert.equal(
  oldestDateKey([
    { timestamp: '2026-10-03T12:00:00-07:00' },
    { timestamp: '2026-05-12T09:00:00-07:00' },
    { dateStr: '03/10/2026' }
  ]),
  '2026-05-12'
);

assert.equal(
  historyWindowReached([{ timestamp: '2026-09-20T23:00:00-07:00' }], '2026-10-03', 180),
  false
);
assert.equal(
  historyWindowReached([{ timestamp: '2026-03-01T23:00:00-07:00' }], '2026-10-03', 180),
  true
);

console.log('historyWindow self-test ok');
