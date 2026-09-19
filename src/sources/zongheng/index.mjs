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
    const author = clean(item.find('.rank-modules-works--main-item-author a, a[href*="/author"], .author').first().text());
    if (!author) return;
    const href = titleLink.attr('href') ?? '';
    const id = href.match(/(\d{4,})/u)?.[1] ?? `${chart.key}-${entries.length + 1}`;
    entries.push({
      rank: entries.length + 1,
      bookId: `zongheng-${id}`,
      title,
      author,
      category: chart.chineseLabel,
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

export default Object.freeze({
  id: 'zongheng',
  name: 'Zongheng',
  label: 'Zongheng Ranking',
  homeUrl: 'https://www.zongheng.com/',
  dataDir: 'data/zongheng',
  transport: 'browser',
  readySelector: '.rank-modules-works--main-item',
  parse: parseZongheng,
  charts: [
    // Zongheng retired /rank/details.html. These Nuxt routes identify each chart.
    { key: 'clicks', label: 'Most Read', chineseLabel: '点击榜', metricLabel: '点击', url: 'https://www.zongheng.com/rank?nav=click&rankType=5' },
    { key: 'monthlyTickets', label: 'Monthly Tickets', chineseLabel: '月票榜', metricLabel: '月票', url: 'https://www.zongheng.com/rank?nav=monthly-ticket&rankType=1' },
    { key: 'rewards', label: 'Rewards', chineseLabel: '打赏榜', metricLabel: '打赏', url: 'https://www.zongheng.com/rank?nav=claque&rankType=7' },
    { key: 'newBooks', label: 'New Books', chineseLabel: '新书榜', metricLabel: '人气', url: 'https://www.zongheng.com/rank?nav=new-book&rankType=4' }
  ]
});
