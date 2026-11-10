export function previousPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

// Compare only entries from the same source and chart. A missing archive is
// different from a novel that was absent from an available Top 20.
export function compareEntries(entries, previousEntries) {
  const previousRanks = previousEntries
    ? new Map(previousEntries.map(entry => [String(entry.bookId), entry.rank]))
    : null;
  return new Map(entries.map(entry => {
    const previousRank = previousRanks?.get(String(entry.bookId));
    if (!previousRanks) return [String(entry.bookId), { state: 'unavailable', previousRank: null, delta: null }];
    if (previousRank === undefined) return [String(entry.bookId), { state: 'new', previousRank: null, delta: null }];
    const delta = previousRank - entry.rank;
    return [String(entry.bookId), {
      state: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
      previousRank,
      delta
    }];
  }));
}
