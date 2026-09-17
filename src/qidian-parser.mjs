import * as cheerio from 'cheerio';

export const QIDIAN_SELECTORS = Object.freeze({
  entries: '#rank-view-list .book-img-text > ul > li[data-rid]',
  rank: '.rank-tag',
  book: '.book-mid-info h2 a[data-bid]',
  author: '.book-mid-info p.author a.name',
  subcategory: '.book-mid-info p.author a.go-sub-type',
  cover: '.book-img-box img',
  metric: '.book-right-info .total'
});

export class QidianParseError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'QidianParseError';
    this.code = code;
    this.details = details;
  }
}

function cleanText(value = '') {
  return value.replace(/\s+/gu, ' ').trim();
}

function absoluteUrl(value, sourceUrl) {
  if (!value) return null;
  try {
    return new URL(value, sourceUrl).href;
  } catch {
    return null;
  }
}

function metricFrom($, entry) {
  const metricNode = entry.find(QIDIAN_SELECTORS.metric).first().clone();
  metricNode.find('style, script').remove();
  const raw = cleanText(metricNode.text());
  if (!raw) return { metric: null, metricLabel: null, metricProtected: false };

  const metricProtected = /[\u{10000}-\u{10ffff}]/u.test(raw);
  if (metricProtected) {
    return { metric: null, metricLabel: cleanText(raw.replace(/[\u{10000}-\u{10ffff}]/gu, '')) || null, metricProtected: true };
  }

  const number = raw.match(/[0-9][0-9,.]*/u)?.[0]?.replaceAll(',', '') ?? null;
  const label = cleanText(number ? raw.replace(/[0-9][0-9,.]*/u, '') : raw) || null;
  return { metric: number, metricLabel: label, metricProtected: false };
}

export function detectQidianChallenge(html) {
  if (typeof html !== 'string' || !html.trim()) return 'empty-response';
  if (/\/C2WF[^/]*\/probe(?:v3)?\.js|x-waf-captcha-referer/iu.test(html) && !/id="rank-view-list"/u.test(html)) {
    return 'waf-probe';
  }
  return null;
}

export function parseQidianRanking(html, source) {
  if (!source?.url) throw new TypeError('A Qidian source with a URL is required.');

  const challenge = detectQidianChallenge(html);
  if (challenge) {
    throw new QidianParseError(`Qidian response is not a ranking page: ${challenge}`, 'CHALLENGE', { challenge });
  }

  const $ = cheerio.load(html);
  const nodes = $(QIDIAN_SELECTORS.entries);
  if (!nodes.length) {
    throw new QidianParseError('Qidian ranking list was not found.', 'RANKING_LIST_MISSING');
  }

  const entries = nodes.toArray().map(node => {
    const entry = $(node);
    const bookLink = entry.find(QIDIAN_SELECTORS.book).first();
    const authorBlock = entry.find('.book-mid-info p.author').first();
    const authorLink = authorBlock.find('a.name').first();
    const categoryLink = authorBlock.find('a').eq(1);
    const subcategoryLink = authorBlock.find('a.go-sub-type').first();
    const cover = entry.find(QIDIAN_SELECTORS.cover).first();
    const attributeRank = Number.parseInt(entry.attr('data-rid') ?? '', 10);
    const visibleRank = Number.parseInt(cleanText(entry.find(QIDIAN_SELECTORS.rank).first().text()), 10);
    const metric = metricFrom($, entry);

    if (Number.isInteger(attributeRank) && Number.isInteger(visibleRank) && attributeRank !== visibleRank) {
      throw new QidianParseError('Rank attribute does not match the visible rank.', 'RANK_MISMATCH', {
        attributeRank,
        visibleRank
      });
    }

    return {
      rank: Number.isInteger(attributeRank) ? attributeRank : visibleRank,
      bookId: cleanText(bookLink.attr('data-bid') ?? ''),
      title: cleanText(bookLink.text()),
      author: cleanText(authorLink.text()),
      category: cleanText(categoryLink.text()) || null,
      subcategory: cleanText(subcategoryLink.text()) || null,
      ...metric,
      bookUrl: absoluteUrl(bookLink.attr('href'), source.url),
      coverUrl: absoluteUrl(cover.attr('src') || cover.attr('data-original'), source.url)
    };
  });

  return {
    key: source.key,
    label: source.label,
    chineseLabel: source.chineseLabel,
    sourceUrl: source.url,
    snapshotPolicy: source.snapshotPolicy,
    entries
  };
}
