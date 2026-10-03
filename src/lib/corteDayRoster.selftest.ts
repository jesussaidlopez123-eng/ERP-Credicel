import assert from 'node:assert/strict';
import type { CorteXRecord } from '../types';
import {
  assertThreeBranchesPerDay,
  emptyDayCorte,
  foldOnePerBranchPerDay
} from './corteDayRoster.ts';

const stub = (over: Partial<CorteXRecord>): CorteXRecord => ({
  ...emptyDayCorte(over.timestamp ? String(over.timestamp).slice(0, 10) : '2026-10-01', over.branchId || 'b-navojoa'),
  ...over
});

const onlyTwo = foldOnePerBranchPerDay([
  stub({
    id: 'SES-NAV-1',
    branchId: 'b-navojoa',
    timestamp: '2026-10-01T23:00:00-07:00',
    totalSales: 1200
  }),
  stub({
    id: 'SES-HUA-1',
    branchId: 'b-huatabampo',
    timestamp: '2026-10-01T23:05:00-07:00',
    totalSales: 800
  })
]);
assert.equal(onlyTwo.length, 3);
assert.equal(assertThreeBranchesPerDay(onlyTwo), true);
assert.equal(onlyTwo[0].branchId, 'b-matriz');
assert.equal(onlyTwo[0].id.startsWith('CAL-ZERO'), true);
assert.equal(onlyTwo[1].id, 'SES-NAV-1');
assert.equal(onlyTwo[2].id, 'SES-HUA-1');

const dupNav = foldOnePerBranchPerDay([
  stub({
    id: 'SES-NAV-OLD',
    branchId: 'navojoa',
    timestamp: '2026-10-02T21:00:00-07:00',
    totalSales: 100
  }),
  stub({
    id: 'SES-NAV-NEW',
    branchId: 'b-navojoa',
    timestamp: '2026-10-02T23:10:00-07:00',
    totalSales: 400
  }),
  stub({
    id: 'CTX-TURNO-NAVOJOA-2026-10-02',
    branchId: 'b-navojoa',
    timestamp: '2026-10-02T23:59:59.999Z',
    totalSales: 50
  }),
  stub({
    id: 'SES-MTZ-1',
    branchId: 'b-matriz',
    timestamp: '2026-10-02T22:00:00-07:00'
  }),
  stub({
    id: 'SES-HUA-1',
    branchId: 'b-huatabampo',
    timestamp: '2026-10-02T22:30:00-07:00'
  })
]);
assert.equal(dupNav.length, 3);
assert.equal(assertThreeBranchesPerDay(dupNav), true);
assert.equal(dupNav.filter((r) => r.branchId === 'b-navojoa').length, 1);
assert.equal(dupNav[1].id, 'SES-NAV-NEW');

const twoDays = foldOnePerBranchPerDay([
  stub({ id: 'A', branchId: 'b-navojoa', timestamp: '2026-10-03T23:00:00-07:00' }),
  stub({ id: 'B', branchId: 'b-matriz', timestamp: '2026-10-02T23:00:00-07:00' })
]);
assert.equal(twoDays.length, 6);
assert.equal(assertThreeBranchesPerDay(twoDays), true);
assert.equal(twoDays.slice(0, 3).every((r) => r.timestamp.startsWith('2026-10-03') || r.id.includes('2026-10-03')), true);

console.log('corteDayRoster self-test ok');
