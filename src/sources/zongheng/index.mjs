// Zongheng source plugin.
import * as cheerio from 'cheerio';
import { absolute, clean } from '../util.mjs';

// Rank pages sit behind a WAF gateway, so a real browser is required.
// The runner uses Playwright for this source; the parser reads the rendered DOM.
export function parseZongheng(html, chart) {
  const $ = cheerio.load(html);
  const entries = [];
  $('.rank-modules-works--main-item, .rank_d_list, .rank-list li, .bookLi').each((_, node) => {
    if (entries.length === 20) return;
    const item = $(node);
    // Current Nuxt rank pages put a cover link before the titled detail link.
    const titleLink = item.find('.rank-modules-works--main-item-title').first().length
      ? item.find('.rank-modules-works--main-item-title').first()
      : item.find('a[href*="/book/"], a[href*="/detail/"]').first();
    const title = clean(titleLink.text());
    if (!title) return;
    const metadataLinks = item.find('.rank-modules-works--main-item-author a');
    const author = clean(metadataLinks.first().text() || item.find('a[href*="/author"], .author').first().text());
    if (!author) return;
    const category = clean(metadataLinks.eq(1).text()) || null;
    const href = titleLink.attr('href') ?? '';
    const id = href.match(/(\d{4,})/u)?.[1] ?? `${chart.key}-${entries.length + 1}`;
    entries.push({
      rank: entries.length + 1,
      bookId: `zongheng-${id}`,
      title,
      author,
      category,
      subcategory: null,
      metric: null,
      metricLabel: chart.metricLabel,
      metricProtected: true,
      bookUrl: absolute(href, 'https://www.zongheng.com/'),
      coverUrl: item.find('img').first().attr('src') ?? null
    });
  });
  return entries;
}

export function parseZonghengBookPage(html) {
  const $ = cheerio.load(html);
  const nuxt = $('script').toArray().map(node => $(node).text()).find(text => text.includes('window.__NUXT__')) ?? '';
  const encodedDescription = /detailBook:\{book:\{[\s\S]*?description:"((?:\\.|[^"\\])*)"/u.exec(nuxt)?.[1];
  let description = '';
  if (encodedDescription) {
    try {
      description = JSON.parse(`"${encodedDescription}"`);
    } catch {
      description = '';
    }
  }
  if (!description) {
    const metadata = clean($('meta[name="description"]').attr('content'));
    description = /最新章节[^。]*。([\s\S]*?)\s*纵横中文网为您创造/u.exec(metadata)?.[1] ?? '';
  }
  if (!description) return null;
  const introduction = clean(cheerio.load(`<div>${description}</div>`).text());
  const readUrl = $('meta[name="og:novel:read_url"]').attr('content') ?? '';
  const id = readUrl.match(/\/detail\/(\d+)/u)?.[1];
  return introduction ? { ...(id ? { sourceBookId: `zongheng-${id}` } : {}), introduction } : null;
}

export default Object.freeze({
  id: 'zongheng',
  name: 'Zongheng',
  label: 'Zongheng Ranking',
  homeUrl: 'https://www.zongheng.com/',
  dataDir: 'data/zongheng',
  bookUrl: { host: 'zongheng.com' },
  transport: 'browser',
  readySelector: '.rank-modules-works--main-item',
  parse: parseZongheng,
  parseBookPage: parseZonghengBookPage,
  detailTransport: 'http',
  detailConcurrency: 3,
  detailAttempts: 3,
  detailUserAgent: 'undici',
  resolveBookDetailUrl: entry => `https://m.zongheng.com/book/${entry.bookId.replace('zongheng-', '')}`,
  charts: [
    // Zongheng retired /rank/details.html. These Nuxt routes identify each chart.
    { key: 'clicks', label: 'Most Read', chineseLabel: '点击榜', metricLabel: '点击', url: 'https://www.zongheng.com/rank?nav=click&rankType=5' },
    { key: 'monthlyTickets', label: 'Monthly Tickets', chineseLabel: '月票榜', metricLabel: '月票', url: 'https://www.zongheng.com/rank?nav=monthly-ticket&rankType=1' },
    { key: 'rewards', label: 'Rewards', chineseLabel: '打赏榜', metricLabel: '打赏', url: 'https://www.zongheng.com/rank?nav=claque&rankType=7' },
    { key: 'newBooks', label: 'New Books', chineseLabel: '新书榜', metricLabel: '人气', url: 'https://www.zongheng.com/rank?nav=new-book&rankType=4' }
  ]
});
