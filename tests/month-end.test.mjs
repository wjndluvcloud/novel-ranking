import assert from 'node:assert/strict';
import test from 'node:test';
import { isFirstCalendarDayInShanghai, isLastCalendarDayInShanghai, periodInShanghai } from '../src/month-end.mjs';

test('Shanghai month-end gate handles scheduled runs around midnight', () => {
  const dayBeforeMonthEnd = new Date('2026-09-29T08:40:00Z'); // Sep 29, 16:40 Shanghai
  const earlyMonthEnd = new Date('2026-09-29T20:16:00Z'); // Sep 30, 04:16 Shanghai
  const monthEnd = new Date('2026-09-30T13:40:00Z'); // Sep 30, 21:40 Shanghai
  const afterMonthEnd = new Date('2026-09-30T20:16:00Z'); // Oct 1, 04:16 Shanghai

  assert.equal(periodInShanghai(monthEnd), '2026-09');
  assert.equal(isLastCalendarDayInShanghai(dayBeforeMonthEnd), false);
  assert.equal(isLastCalendarDayInShanghai(earlyMonthEnd), true);
  assert.equal(isLastCalendarDayInShanghai(monthEnd), true);
  assert.equal(isFirstCalendarDayInShanghai(afterMonthEnd), true);
  assert.equal(isLastCalendarDayInShanghai(afterMonthEnd), false);
  assert.equal(periodInShanghai(afterMonthEnd), '2026-10');
});

test('Shanghai month-end gate handles February in a leap year', () => {
  assert.equal(isLastCalendarDayInShanghai(new Date('2024-02-28T15:40:00Z')), false);
  assert.equal(isLastCalendarDayInShanghai(new Date('2024-02-29T15:40:00Z')), true);
  assert.equal(isFirstCalendarDayInShanghai(new Date('2024-02-29T16:00:00Z')), true);
});
