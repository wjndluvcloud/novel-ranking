// Jinjiang source plugin.
import * as cheerio from 'cheerio';
import { absolute, clean } from './util.mjs';

// https://www.jjwxc.net/topten.php?orderstr=<n>&t=0  (GBK-encoded)
// Server-rendered table: 序号 | 作者 | 作品 | 类型 | 进度 | 字数 | 作品积分 | 发表时间
export function parseJinjiang(html, chart) {
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

export default Object.freeze({
  id: 'jinjiang',
  name: 'Jinjiang',
  label: 'Jinjiang Ranking',
  homeUrl: 'https://www.jjwxc.net/',
  dataDir: 'data/jinjiang',
  transport: 'http',
  parse: parseJinjiang,
  charts: [
    { key: 'totalScore', label: 'Total Score', chineseLabel: '总分榜', metricLabel: '积分', url: 'https://www.jjwxc.net/topten.php?orderstr=7&t=0' },
    { key: 'monthly', label: 'Monthly', chineseLabel: '月度榜', metricLabel: '积分', url: 'https://www.jjwxc.net/topten.php?orderstr=4&t=0' },
    { key: 'quarterly', label: 'Quarterly', chineseLabel: '季度榜', metricLabel: '积分', url: 'https://www.jjwxc.net/topten.php?orderstr=5&t=0' },
    { key: 'wordCount', label: 'Word Count', chineseLabel: '字数榜', metricLabel: '字数', url: 'https://www.jjwxc.net/topten.php?orderstr=8&t=0' }
  ]
});
