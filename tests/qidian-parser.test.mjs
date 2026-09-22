import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { officialMonthlyTicketsUrl, QIDIAN_SOURCES, sourceForPeriod } from '../src/sources/qidian/sources.mjs';
import { detectQidianChallenge, parseQidianBookPage, parseQidianRanking, QidianParseError } from '../src/sources/qidian/parser.mjs';
import { assertBookUrls, SourceArchiveError, validateRanking } from '../src/source-archive.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, 'fixtures', 'qidian');

async function fixture(source) {
  return readFile(path.join(fixtureDirectory, `${source.slug}.html`), 'utf8');
}

for (const source of QIDIAN_SOURCES) {
  test(`${source.label} fixture yields a validated Top 20`, async () => {
    const ranking = parseQidianRanking(await fixture(source), source);
    assert.equal(validateRanking(ranking), ranking);
    assertBookUrls(ranking, { host: 'qidian.com' }, 'qidian');
    assert.equal(ranking.entries.length, 20);
    assert.deepEqual(ranking.entries.map(entry => entry.rank), Array.from({ length: 20 }, (_, index) => index + 1));
    assert.equal(new Set(ranking.entries.map(entry => entry.bookId)).size, 20);
    assert.ok(ranking.entries.every(entry => entry.title && entry.author));
    assert.ok(ranking.entries.every(entry => entry.bookUrl.startsWith('https://www.qidian.com/book/')));
  });
}

test('protocol-relative Qidian and cover URLs are normalized to HTTPS', async () => {
  const source = QIDIAN_SOURCES[0];
  const ranking = parseQidianRanking(await fixture(source), source);
  assert.ok(ranking.entries.every(entry => entry.bookUrl.startsWith('https://')));
  assert.ok(ranking.entries.every(entry => entry.coverUrl.startsWith('https://')));
});

test('Monthly Tickets uses Qidian official year and month URLs', () => {
  assert.equal(officialMonthlyTicketsUrl('2026-09'), 'https://www.qidian.com/rank/yuepiao/year2026-month09/');
  assert.equal(sourceForPeriod(QIDIAN_SOURCES[0], '2026-09').url, officialMonthlyTicketsUrl('2026-09'));
  assert.throws(() => officialMonthlyTicketsUrl('2026-13'), TypeError);
});

test('WAF probe response is detected and rejected', () => {
  const html = '<!doctype html><script src="/C2WF946J0/probe.js"></script>';
  assert.equal(detectQidianChallenge(html), 'waf-probe');
  assert.throws(
    () => parseQidianRanking(html, QIDIAN_SOURCES[0]),
    error => error instanceof QidianParseError && error.code === 'CHALLENGE'
  );
});

test('Qidian book pages expose a cleaned novel introduction', () => {
  const html = `<html><head><meta name="description" content="fallback"></head><body>
    <div class="book-intro"><p> A journey across<br>the boundless night. </p></div>
  </body></html>`;
  assert.deepEqual(parseQidianBookPage(html), { introduction: 'A journey across the boundless night.' });
});

test('Qidian book page parser falls back to the description metadata', () => {
  assert.deepEqual(
    parseQidianBookPage('<meta name="description" content="An archived introduction.">'),
    { introduction: 'An archived introduction.' }
  );
});

test('Qidian mobile book pages expose structured book details', () => {
  const pageData = {
    pageContext: { pageProps: { pageData: { bookInfo: { bookId: 1040765595, desc: '　　The official introduction.' } } } }
  };
  const html = `<script src="/C2WF946J0/probe.js"></script><script type="application/json">${JSON.stringify(pageData)}</script>`;
  assert.deepEqual(parseQidianBookPage(html), {
    sourceBookId: '1040765595',
    introduction: 'The official introduction.'
  });
});

test('partial rankings cannot be published', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries.pop();
  assert.throws(
    () => validateRanking(ranking),
    error => error instanceof SourceArchiveError && /expected 20/u.test(error.message)
  );
});

test('duplicate book IDs cannot be published', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries[19].bookId = ranking.entries[0].bookId;
  assert.throws(
    () => validateRanking(ranking),
    error => error instanceof SourceArchiveError && error.message.includes('book IDs must be present and unique')
  );
});

test('missing authors cannot be published', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries[3].author = '';
  assert.throws(
    () => validateRanking(ranking),
    error => error instanceof SourceArchiveError && /has no author/u.test(error.message)
  );
});

test('lookalike domains cannot pass book URL validation', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries[0].bookUrl = `https://notqidian.com/book/${ranking.entries[0].bookId}/`;
  assert.throws(
    () => assertBookUrls(ranking, { host: 'qidian.com' }, 'qidian'),
    error => error instanceof SourceArchiveError && error.code === 'BOOK_URL_INVALID'
  );
});
