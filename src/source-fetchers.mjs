// Per-source fetch descriptors and HTML parsers for the non-Qidian rankings.
// URL patterns are confirmed from the live sites; DOM selectors are best-effort
// and are guarded by the archive validator, which rejects malformed output.
import * as cheerio from 'cheerio';

function clean(value = '') {
  return value.replace(/\s+/gu, ' ').trim();
}

function absolute(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

// Jinjiang: https://www.jjwxc.net/topten.php?orderstr=<n>&t=0  (GBK-encoded)
// Server-rendered table: 序号 | 作者 | 作品 | 类型 | 进度 | 字数 | 作品积分 | 发表时间
function parseJinjiang(html, chart) {
  const $ = cheerio.load(html);
  const rows = $('table tr').toArray().filter(row => $(row).find('td').length >= 7);
  const entries = [];
  for (const row of rows) {
    const cells = $(row).find('td');
    const rank = Number.parseInt(clean($(cells[0]).text()), 10);
    if (!Number.isInteger(rank)) continue; // skips the header row
    const authorCell = $(cells[1]);
    const titleCell = $(cells[2]);
    const titleLink = titleCell.find('a').first();
    const title = clean(titleLink.text() || titleCell.text());
    const author = clean(authorCell.find('a').first().text() || authorCell.text());
    if (!title || !author) continue;
    const bookUrl = absolute(titleLink.attr('href'), 'https://www.jjwxc.net/');
    const novelId = bookUrl?.match(/novelid=(\d+)/u)?.[1] ?? `${chart.key}-${entries.length + 1}`;
    // 类型 like 原创-言情-近代现代-爱情
    const typeParts = clean($(cells[3]).text()).split(/[-·]/u).map(clean).filter(Boolean);
    const category = typeParts[2] ?? typeParts[1] ?? null;
    const subcategory = typeParts[3] ?? null;
    const metric = clean($(cells[6]).text()).replace(/[^0-9]/gu, '') || null;
    entries.push({
      rank: entries.length + 1,
      bookId: `jinjiang-${novelId}`,
      title,
      author,
      category,
      subcategory,
      metric,
      metricLabel: chart.metricLabel,
      metricProtected: false,
      bookUrl,
      coverUrl: null
    });
    if (entries.length === 20) break;
  }
  return entries;
}

// Tomato / Fanqie: https://fanqienovel.com/rank/<gender>_<board>_<category>
// The list is client-rendered (only ~10 of 20 items are in the raw HTML), so the
// runner renders it with Playwright and this parser reads the hydrated DOM.
export function parseTomato(html, chart) {
  const $ = cheerio.load(html);
  const entries = [];
  const seenBookIds = new Set();
  $('.book-item-text').each((_, node) => {
    if (entries.length === 20) return;
    const item = $(node);
    const titleLink = item.find('.title a').first();
    const title = clean(titleLink.text());
    const href = titleLink.attr('href') ?? '';
    const id = href.match(/\/page\/(\d+)/u)?.[1];
    const author = clean(item.find('.author a').first().text());
    if (!title || !author || !id || seenBookIds.has(id)) return;
    // Fanqie can repeat a book when its virtual list re-renders during scroll.
    seenBookIds.add(id);
    entries.push({
      rank: entries.length + 1,
      bookId: `tomato-${id}`,
      title,
      author,
      category: chart.chineseLabel,
      subcategory: null,
      metric: null,
      metricLabel: chart.metricLabel,
      metricProtected: true,
      bookUrl: absolute(href, 'https://fanqienovel.com/'),
      coverUrl: null
    });
  });
  return entries;
}

// Ranking rows use a font-obfuscated private-use character set. Individual
// book pages are server-rendered and expose the canonical Unicode title and
// author, so the collector uses this parser to de-obfuscate the archive.
export function parseTomatoBookPage(html) {
  const $ = cheerio.load(html);
  const title = clean($('.info-name h1').first().text());
  const author = clean($('.author-name-text').first().text());
  if (!title || !author) return null;
  return { title, author };
}

// Zongheng: rank pages sit behind a WAF gateway, so a real browser is required.
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

export const SOURCE_FETCHERS = Object.freeze({
  jinjiang: {
    id: 'jinjiang',
    name: 'Jinjiang',
    homeUrl: 'https://www.jjwxc.net/',
    transport: 'http',
    parse: parseJinjiang,
    charts: [
      { key: 'totalScore', label: 'Total Score', chineseLabel: '总分榜', metricLabel: '积分', url: 'https://www.jjwxc.net/topten.php?orderstr=7&t=0' },
      { key: 'monthly', label: 'Monthly', chineseLabel: '月度榜', metricLabel: '积分', url: 'https://www.jjwxc.net/topten.php?orderstr=4&t=0' },
      { key: 'quarterly', label: 'Quarterly', chineseLabel: '季度榜', metricLabel: '积分', url: 'https://www.jjwxc.net/topten.php?orderstr=5&t=0' },
      { key: 'wordCount', label: 'Word Count', chineseLabel: '字数榜', metricLabel: '字数', url: 'https://www.jjwxc.net/topten.php?orderstr=8&t=0' }
    ]
  },
  tomato: {
    id: 'tomato',
    name: 'Tomato Novel',
    homeUrl: 'https://fanqienovel.com/',
    transport: 'browser',
    readySelector: '.book-item-text',
    parse: parseTomato,
    charts: [
      { key: 'ancientRomance', label: 'Ancient Romance', chineseLabel: '古风世情', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_1139' },
      { key: 'fantasyRomance', label: 'Fantasy Romance', chineseLabel: '玄幻言情', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_248' },
      { key: 'scifiApocalypse', label: 'Sci-Fi & Apocalypse', chineseLabel: '科幻末世', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_8' },
      { key: 'ceoRomance', label: 'CEO Romance', chineseLabel: '豪门总裁', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_748' }
    ]
  },
  zongheng: {
    id: 'zongheng',
    name: 'Zongheng',
    homeUrl: 'https://www.zongheng.com/',
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
  }
});
