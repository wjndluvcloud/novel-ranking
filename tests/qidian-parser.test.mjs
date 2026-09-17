import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { officialMonthlyTicketsUrl, QIDIAN_SOURCES, sourceForPeriod } from '../src/qidian-sources.mjs';
import { detectQidianChallenge, parseQidianRanking, QidianParseError } from '../src/qidian-parser.mjs';
import { QidianValidationError, validateQidianRanking } from '../src/qidian-validator.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, 'fixtures', 'qidian');

async function fixture(source) {
  return readFile(path.join(fixtureDirectory, `${source.slug}.html`), 'utf8');
}

for (const source of QIDIAN_SOURCES) {
  test(`${source.label} fixture yields a validated Top 20`, async () => {
    const ranking = parseQidianRanking(await fixture(source), source);
    assert.equal(validateQidianRanking(ranking), ranking);
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

test('partial rankings cannot be published', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries.pop();
  assert.throws(
    () => validateQidianRanking(ranking),
    error => error instanceof QidianValidationError && error.issues.some(issue => issue.includes('expected 20'))
  );
});

test('duplicate book IDs cannot be published', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries[19].bookId = ranking.entries[0].bookId;
  assert.throws(
    () => validateQidianRanking(ranking),
    error => error instanceof QidianValidationError && error.issues.includes('book IDs must be present and unique')
  );
});

test('missing authors cannot be published', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries[3].author = '';
  assert.throws(
    () => validateQidianRanking(ranking),
    error => error instanceof QidianValidationError && error.issues.some(issue => issue.includes('has no author'))
  );
});

test('lookalike domains cannot pass Qidian book URL validation', async () => {
  const ranking = parseQidianRanking(await fixture(QIDIAN_SOURCES[0]), QIDIAN_SOURCES[0]);
  ranking.entries[0].bookUrl = `https://notqidian.com/book/${ranking.entries[0].bookId}/`;
  assert.throws(
    () => validateQidianRanking(ranking),
    error => error instanceof QidianValidationError && error.issues.some(issue => issue.includes('invalid Qidian book URL'))
  );
});
