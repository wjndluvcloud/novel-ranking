// Tomato / Fanqie source plugin.
import * as cheerio from 'cheerio';
import { absolute, clean } from '../util.mjs';

// https://fanqienovel.com/rank/<gender>_<board>_<category>
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

export default Object.freeze({
  id: 'tomato',
  name: 'Tomato Novel',
  label: 'Tomato Novel Ranking',
  homeUrl: 'https://fanqienovel.com/',
  dataDir: 'data/tomato',
  bookUrl: { host: 'fanqienovel.com' },
  transport: 'browser',
  readySelector: '.book-item-text',
  parse: parseTomato,
  charts: [
    { key: 'ancientRomance', label: 'Ancient Romance', chineseLabel: '古风世情', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_1139' },
    { key: 'fantasyRomance', label: 'Fantasy Romance', chineseLabel: '玄幻言情', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_248' },
    { key: 'scifiApocalypse', label: 'Sci-Fi & Apocalypse', chineseLabel: '科幻末世', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_8' },
    { key: 'ceoRomance', label: 'CEO Romance', chineseLabel: '豪门总裁', metricLabel: '在读', url: 'https://fanqienovel.com/rank/0_2_748' }
  ]
});
