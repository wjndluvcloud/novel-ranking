import assert from 'node:assert/strict';
import test from 'node:test';
import { compareEntries, previousPeriod } from '../assets/js/rank-comparison.js';

test('comparison uses the previous calendar month, including the year boundary', () => {
  assert.equal(previousPeriod('2026-10'), '2026-09');
  assert.equal(previousPeriod('2026-02'), '2026-01');
  assert.equal(previousPeriod('2026-01'), '2025-12');
});

test('matches novels by stable ID even when the title or ID type changes', () => {
  const changes = compareEntries(
    [{ bookId: '42', title: 'Renamed novel', rank: 2 }],
    [{ bookId: 42, title: 'Original title', rank: 9 }]
  );
  assert.deepEqual(changes.get('42'), { state: 'up', previousRank: 9, delta: 7 });
});

test('distinguishes rising, falling, unchanged and newly ranked novels', () => {
  const changes = compareEntries(
    [
      { bookId: 'up', rank: 1 },
      { bookId: 'down', rank: 10 },
      { bookId: 'same', rank: 20 },
      { bookId: 'new', title: 'Shared title', rank: 5 }
    ],
    [
      { bookId: 'up', rank: 20 },
      { bookId: 'down', rank: 1 },
      { bookId: 'same', rank: 20 },
      { bookId: 'different-novel', title: 'Shared title', rank: 5 }
    ]
  );
  assert.deepEqual(changes.get('up'), { state: 'up', previousRank: 20, delta: 19 });
  assert.deepEqual(changes.get('down'), { state: 'down', previousRank: 1, delta: -9 });
  assert.deepEqual(changes.get('same'), { state: 'same', previousRank: 20, delta: 0 });
  assert.deepEqual(changes.get('new'), { state: 'new', previousRank: null, delta: null });
});

test('a missing previous chart does not mark every novel as new', () => {
  const entries = [{ bookId: '42', rank: 1 }];
  for (const previousEntries of [null, undefined]) {
    assert.deepEqual(compareEntries(entries, previousEntries).get('42'), {
      state: 'unavailable', previousRank: null, delta: null
    });
  }
  assert.equal(compareEntries(entries, []).get('42').state, 'new');
});

test('the same novel is compared independently in each chart', () => {
  const entries = Object.freeze([Object.freeze({ bookId: '42', rank: 5 })]);
  const tickets = Object.freeze([Object.freeze({ bookId: '42', rank: 10 })]);
  const sales = Object.freeze([Object.freeze({ bookId: '42', rank: 1 })]);
  assert.equal(compareEntries(entries, tickets).get('42').delta, 5);
  assert.equal(compareEntries(entries, sales).get('42').delta, -4);
  assert.equal(compareEntries(entries, [{ bookId: 'other', rank: 5 }]).get('42').state, 'new');
});
