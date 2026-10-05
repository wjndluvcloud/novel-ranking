export function periodInShanghai(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}

export function isLastCalendarDayInShanghai(date = new Date()) {
  const today = periodInShanghai(date);
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return periodInShanghai(tomorrow) !== today;
}

export function isFirstCalendarDayInShanghai(date = new Date()) {
  const today = periodInShanghai(date);
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return periodInShanghai(yesterday) !== today;
}
