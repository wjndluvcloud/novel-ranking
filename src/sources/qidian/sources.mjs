export const QIDIAN_SOURCES = Object.freeze([
  Object.freeze({
    key: 'monthlyTickets',
    slug: 'yuepiao',
    label: 'Monthly Tickets',
    chineseLabel: '月票榜',
    url: 'https://www.qidian.com/rank/yuepiao/',
    snapshotPolicy: 'official-month'
  }),
  Object.freeze({
    key: 'bestSellers',
    slug: 'hotsales',
    label: 'Best Sellers',
    chineseLabel: '畅销榜',
    url: 'https://www.qidian.com/rank/hotsales/',
    snapshotPolicy: 'month-end'
  }),
  Object.freeze({
    key: 'readerRetention',
    slug: 'retention',
    label: 'Reader Retention',
    chineseLabel: '留存榜',
    url: 'https://www.qidian.com/rank/retention/',
    snapshotPolicy: 'month-end'
  }),
  Object.freeze({
    key: 'mostFollowed',
    slug: 'followReading',
    label: 'Most Followed',
    chineseLabel: '追读榜',
    url: 'https://www.qidian.com/rank/followReading/',
    snapshotPolicy: 'month-end'
  })
]);

export function getQidianSource(keyOrSlug) {
  return QIDIAN_SOURCES.find(source => source.key === keyOrSlug || source.slug === keyOrSlug);
}

export function officialMonthlyTicketsUrl(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(period)) {
    throw new TypeError(`Invalid monthly period: ${period}`);
  }
  const [year, month] = period.split('-');
  return `https://www.qidian.com/rank/yuepiao/year${year}-month${month}/`;
}

export function sourceForPeriod(source, period) {
  if (source?.key !== 'monthlyTickets') return source;
  return Object.freeze({ ...source, url: officialMonthlyTicketsUrl(period) });
}
