// Faloo source plugin.
import * as cheerio from 'cheerio';
import { absolute, clean } from '../util.mjs';

// Faloo's library ranking pages are server-rendered GB2312 HTML. Each page
// contains 30 books; the archive intentionally keeps only the first 20.
export function parseFaloo(html, chart) {
  const $ = cheerio.load(html);
  const entries = [];

  $('.TwoBox02_02').each((_, node) => {
    if (entries.length === 20) return;
    const item = $(node);
    const titleLink = item.find('.TwoBox02_08 a, h1 a').first();
    const title = clean(titleLink.text());
    const href = titleLink.attr('href') ?? '';
    const id = href.match(/\/(\d+)\.html(?:$|[?#])/u)?.[1];
    const author = clean(item.find('.TwoBox02_09 a').first().text());
    if (!title || !author || !id) return;

    const metadata = item.find('.fontSize14andHui').first();
    const category = clean(metadata.find('a').first().text()) || null;
    const metadataText = clean(metadata.text());
    const metric = metadataText.match(new RegExp(`${chart.metricLabel}[：:]\\s*([0-9.]+万?)`, 'u'))?.[1] ?? null;

    entries.push({
      rank: entries.length + 1,
      bookId: `faloo-${id}`,
      title,
      author,
      category,
      subcategory: null,
      metric,
      metricLabel: chart.metricLabel,
      metricProtected: false,
      bookUrl: absolute(href, 'https://b.faloo.com/'),
      coverUrl: null
    });
  });

  return entries;
}

export default Object.freeze({
  id: 'faloo',
  name: 'Faloo',
  label: 'Faloo Ranking',
  homeUrl: 'https://b.faloo.com/',
  dataDir: 'data/faloo',
  bookUrl: { host: 'faloo.com' },
  transport: 'http',
  // Faloo self-redirects desktop Chrome user agents back to the same URL.
  userAgent: 'undici',
  // These URLs expose only the live month; do not relabel them as historical data.
  restrictToCurrentPeriod: true,
  parse: parseFaloo,
  charts: [
    { key: 'monthlyTickets', label: 'Monthly Tickets', chineseLabel: '月票榜', metricLabel: '月票', url: 'https://b.faloo.com/y_0_0_0_0_3_15_1.html' },
    { key: 'monthlyClicks', label: 'Monthly Clicks', chineseLabel: '月点击榜', metricLabel: '月点击', url: 'https://b.faloo.com/y_0_0_0_0_0_2_1.html' },
    { key: 'monthlyRewards', label: 'Monthly Rewards', chineseLabel: '月打赏榜', metricLabel: '月打赏', url: 'https://b.faloo.com/y_0_0_0_0_0_17_1.html' },
    { key: 'monthlyFlowers', label: 'Monthly Flowers', chineseLabel: '月鲜花榜', metricLabel: '月鲜花', url: 'https://b.faloo.com/y_0_0_0_0_0_5_1.html' }
  ]
});
