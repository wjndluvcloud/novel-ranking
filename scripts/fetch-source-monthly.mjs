// Generic monthly collector for every ranking source.
// Usage: node scripts/fetch-source-monthly.mjs <sourceId> [--publish] [--dry-run]
//        [--data-directory <dir>] [--period YYYY-MM] [--output <file>] [--headed]
//        [--only-month-end]
//
// --only-month-end skips publishing unless today is the last calendar day in
// Asia/Shanghai (used by the scheduled workflow so a month gets one archive).
// Jinjiang and Faloo are fetched directly over HTTP. Qidian, Tomato and
// Zongheng are rendered with Playwright; the latter two can return an anti-bot
// response.
// Run with `node --use-system-ca` behind a corporate TLS proxy.
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseTomatoBookPage } from '../src/sources/tomato/index.mjs';
import { SOURCE_FETCHERS } from '../src/sources/index.mjs';
import { buildManifest, publishSourceSnapshot, validateRanking, validateSnapshot, assertBookUrls } from '../src/source-archive.mjs';
import { addVietnameseTranslations, DEFAULT_GEMINI_MODEL } from '../src/translation/gemini.mjs';

const DEFAULT_EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function parseArguments(argv) {
  const options = {
    sourceId: null, dryRun: false, publish: false, backfillDetails: false, output: null,
    dataDirectory: null, period: null, headed: false, onlyMonthEnd: false,
    diagnosticsDirectory: '.tmp/collector-diagnostics',
    browserPath: process.env.RANKING_BROWSER_PATH || null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--publish') options.publish = true;
    else if (argument === '--backfill-details') options.backfillDetails = true;
    else if (argument === '--only-month-end') options.onlyMonthEnd = true;
    else if (argument === '--headed') options.headed = true;
    else if (argument === '--output') options.output = argv[++index];
    else if (argument === '--data-directory') options.dataDirectory = argv[++index];
    else if (argument === '--period') options.period = argv[++index];
    else if (argument === '--browser-path') options.browserPath = argv[++index];
    else if (argument === '--diagnostics-directory') options.diagnosticsDirectory = argv[++index];
    else if (!argument.startsWith('--') && !options.sourceId) options.sourceId = argument;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.sourceId) throw new Error('A source id is required.');
  if (options.dryRun && options.publish) throw new Error('--dry-run cannot be used with --publish.');
  if (options.backfillDetails && (!options.period || options.dryRun || options.publish || options.output)) {
    throw new Error('--backfill-details requires --period and cannot be combined with --dry-run, --publish, or --output.');
  }
  if (options.period && !/^\d{4}-(0[1-9]|1[0-2])$/u.test(options.period)) {
    throw new Error('--period must use YYYY-MM.');
  }
  return options;
}

function periodInShanghai(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}

function isLastCalendarDayInShanghai(date = new Date()) {
  const today = periodInShanghai(date);
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return periodInShanghai(tomorrow) !== today;
}

function resolveBrowserPath(requestedPath) {
  if (requestedPath) {
    if (!existsSync(requestedPath)) throw new Error(`Browser executable not found: ${requestedPath}`);
    return requestedPath;
  }
  return DEFAULT_EDGE_PATHS.find(candidate => existsSync(candidate)) ?? null;
}

async function writeJsonAtomically(outputPath, value) {
  const absolutePath = path.resolve(outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, absolutePath);
}

function decodeBody(buffer, contentType) {
  let charset = /charset=([\w-]+)/iu.exec(contentType ?? '')?.[1]?.toLowerCase();
  if (!charset) {
    const head = buffer.subarray(0, 2048).toString('latin1');
    charset = /charset=["']?([\w-]+)/iu.exec(head)?.[1]?.toLowerCase();
  }
  if (charset === 'gb2312' || charset === 'gbk' || charset === 'gb18030') {
    return new TextDecoder('gbk').decode(buffer);
  }
  return new TextDecoder('utf-8').decode(buffer);
}

async function collectHttp(fetcher, capturedAt, period) {
  const rankings = {};
  for (const chart of fetcher.charts) {
    const url = fetcher.resolveChartUrl ? fetcher.resolveChartUrl(chart, period) : chart.url;
    console.log(`Collecting ${fetcher.name} · ${chart.label} from ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': fetcher.userAgent ?? USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const html = decodeBody(buffer, response.headers.get('content-type'));
    assertNoChallenge(fetcher, html);
    const entries = fetcher.parse(html, chart);
    rankings[chart.key] = buildRanking(fetcher, chart, entries, capturedAt, url);
  }
  return rankings;
}

function containsPrivateUseCharacters(value) {
  return /\p{Private_Use}/u.test(value ?? '');
}

// Per-source anti-bot detection: throws before parsing if the page is a
// challenge/WAF response rather than a ranking page.
function assertNoChallenge(fetcher, html) {
  const challenge = fetcher.detectChallenge?.(html);
  if (challenge) throw new Error(`${fetcher.name} returned an anti-bot page: ${challenge}`);
}

async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index]);
    }
  }));
  return results;
}

async function canonicalizeTomatoEntries(entries) {
  return mapWithConcurrency(entries, 4, async entry => {
    if (!containsPrivateUseCharacters(entry.title) && !containsPrivateUseCharacters(entry.author)) return entry;
    const response = await fetch(entry.bookUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'zh-CN,zh;q=0.9' } });
    if (!response.ok) throw new Error(`Could not resolve Tomato metadata for ${entry.bookId}: HTTP ${response.status}`);
    const metadata = parseTomatoBookPage(await response.text());
    if (!metadata || containsPrivateUseCharacters(metadata.title) || containsPrivateUseCharacters(metadata.author)) {
      throw new Error(`Could not resolve canonical Tomato metadata for ${entry.bookId}.`);
    }
    return { ...entry, ...metadata };
  });
}

async function loadArchivedBookDetails(dataDirectory, sourceId) {
  const monthlyDirectory = path.join(dataDirectory, 'monthly');
  if (!existsSync(monthlyDirectory)) return new Map();

  const files = (await readdir(monthlyDirectory))
    .filter(file => /^\d{4}-(0[1-9]|1[0-2])\.json$/u.test(file))
    .sort((left, right) => right.localeCompare(left));
  const detailsByBookId = new Map();
  for (const file of files) {
    const snapshot = JSON.parse(await readFile(path.join(monthlyDirectory, file), 'utf8'));
    if (snapshot.source !== sourceId) continue;
    for (const ranking of Object.values(snapshot.rankings ?? {})) {
      for (const entry of ranking.entries ?? []) {
        if (entry.bookId && entry.introduction && !detailsByBookId.has(entry.bookId)) {
          detailsByBookId.set(entry.bookId, { introduction: entry.introduction });
        }
      }
    }
  }
  return detailsByBookId;
}

async function loadArchivedTranslations(dataDirectory, sourceId) {
  const monthlyDirectory = path.join(dataDirectory, 'monthly');
  if (!existsSync(monthlyDirectory)) return new Map();

  const files = (await readdir(monthlyDirectory))
    .filter(file => /^\d{4}-(0[1-9]|1[0-2])\.json$/u.test(file))
    .sort((left, right) => right.localeCompare(left));
  const translationsByBookId = new Map();
  for (const file of files) {
    const snapshot = JSON.parse(await readFile(path.join(monthlyDirectory, file), 'utf8'));
    if (snapshot.source !== sourceId) continue;
    for (const ranking of Object.values(snapshot.rankings ?? {})) {
      for (const entry of ranking.entries ?? []) {
        if (!entry.bookId) continue;
        const existing = translationsByBookId.get(entry.bookId) ?? {};
        const titleVi = existing.titleVi || entry.titleVi || null;
        const authorVi = existing.authorVi || entry.authorVi || null;
        const introductionVi = existing.introductionVi || entry.introductionVi || null;
        if (titleVi || authorVi || introductionVi) translationsByBookId.set(entry.bookId, { titleVi, authorVi, introductionVi });
      }
    }
  }
  return translationsByBookId;
}

async function enrichBookDetails(rankings, fetcher, context, archivedDetails = new Map()) {
  if (!fetcher.parseBookPage) return;

  const entriesByBookId = new Map();
  for (const ranking of Object.values(rankings)) {
    for (const entry of ranking.entries) entriesByBookId.set(entry.bookId, entry);
  }
  const entries = [...entriesByBookId.values()];
  const detailsByBookId = new Map(
    entries.filter(entry => archivedDetails.has(entry.bookId)).map(entry => [entry.bookId, archivedDetails.get(entry.bookId)])
  );
  for (const entry of entries) {
    if (entry.introduction) detailsByBookId.set(entry.bookId, { introduction: entry.introduction });
  }
  const entriesToFetch = entries.filter(entry => !detailsByBookId.has(entry.bookId));
  const concurrency = fetcher.detailConcurrency ?? 3;
  let blockedChallenge = null;
  console.log(`Reusing ${detailsByBookId.size} archived introductions; collecting ${entriesToFetch.length} new ${fetcher.name} details (concurrency ${concurrency}).`);

  const details = await mapWithConcurrency(entriesToFetch, concurrency, async entry => {
    if (blockedChallenge) return null;
    const attempts = fetcher.detailAttempts ?? 3;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let detailPage = null;
      try {
        const minimumDelay = fetcher.detailDelayMinMs ?? 3_000;
        const maximumDelay = fetcher.detailDelayMaxMs ?? 5_000;
        const delay = minimumDelay + Math.floor(Math.random() * Math.max(1, maximumDelay - minimumDelay));
        await new Promise(resolve => setTimeout(resolve, delay));
        const detailUrl = fetcher.resolveBookDetailUrl?.(entry) ?? entry.bookUrl;
        let html;
        if (fetcher.detailTransport === 'http') {
          const response = await fetch(detailUrl, {
            headers: {
              'User-Agent': fetcher.detailUserAgent ?? USER_AGENT,
              'Accept-Language': 'zh-CN,zh;q=0.9'
            }
          });
          if (!response.ok) throw new Error(`${detailUrl} returned HTTP ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          html = decodeBody(buffer, response.headers.get('content-type'));
        } else {
          detailPage = await context.newPage();
          await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          html = await detailPage.content();
        }
        const detail = fetcher.parseBookPage(html);
        if (!detail?.introduction) {
          const error = new Error('introduction was not found');
          error.code = 'DETAIL_MISSING';
          throw error;
        }
        if (detail.sourceBookId && detail.sourceBookId !== entry.bookId) {
          throw new Error(`book ID mismatch: expected ${entry.bookId}, received ${detail.sourceBookId}`);
        }
        const { sourceBookId, ...storedDetail } = detail;
        return [entry.bookId, storedDetail];
      } catch (error) {
        if (error?.code === 'CHALLENGE') {
          if (!blockedChallenge) console.warn(`Stopping detail collection: ${error.message}`);
          blockedChallenge = error.code;
          return null;
        }
        if (error?.code === 'DETAIL_MISSING') {
          console.warn(`Could not collect details for ${entry.bookId}: ${error.message}`);
          return null;
        }
        if (attempt === attempts) {
          console.warn(`Could not collect details for ${entry.bookId}: ${error.message}`);
          return null;
        }
        console.warn(`Detail attempt ${attempt}/${attempts} failed for ${entry.bookId}; retrying.`);
        await new Promise(resolve => setTimeout(resolve, 1_500 * attempt));
      } finally {
        await detailPage?.close();
      }
    }
    return null;
  });

  for (const detail of details.filter(Boolean)) detailsByBookId.set(...detail);
  for (const ranking of Object.values(rankings)) {
    ranking.entries = ranking.entries.map(entry => ({
      ...entry,
      introduction: detailsByBookId.get(entry.bookId)?.introduction ?? entry.introduction ?? null
    }));
  }
  console.log(`Collected ${detailsByBookId.size}/${entries.length} novel introductions.`);
}

async function collectBrowser(fetcher, capturedAt, options, period, archivedDetails) {
  const { chromium } = await import('playwright');
  const executablePath = resolveBrowserPath(options.browserPath);
  const browser = await chromium.launch({
    headless: !options.headed,
    ...(executablePath ? { executablePath } : {}),
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--disable-crash-reporter']
  });
  const context = await browser.newContext({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const attempts = fetcher.attempts ?? 1;
  const rankings = {};
  try {
    for (const chart of fetcher.charts) {
      const url = fetcher.resolveChartUrl ? fetcher.resolveChartUrl(chart, period) : chart.url;
      console.log(`Collecting ${fetcher.name} · ${chart.label} from ${url}`);
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          // Analytics and ad requests can keep these sites perpetually non-idle
          // in CI. DOM readiness plus the source's row selector is deterministic.
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          if (fetcher.readyCount && fetcher.readySelector) {
            await page.waitForFunction(
              ({ selector, count }) => document.querySelectorAll(selector).length === count,
              { selector: fetcher.readySelector, count: fetcher.readyCount },
              { timeout: 60_000 }
            );
          } else if (fetcher.readySelector) {
            await page.waitForSelector(fetcher.readySelector, { timeout: 45_000 });
          }
          // Trigger lazy-loaded rank rows by scrolling to the bottom a few times.
          for (let step = 0; step < 6; step += 1) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(700);
          }
          const html = await page.content();
          assertNoChallenge(fetcher, html);
          let entries = fetcher.parse(html, chart);
          if (fetcher.id === 'tomato') entries = await canonicalizeTomatoEntries(entries);
          rankings[chart.key] = buildRanking(fetcher, chart, entries, capturedAt, url);
          break;
        } catch (error) {
          const diagnosticDirectory = path.resolve(options.diagnosticsDirectory, fetcher.id);
          await mkdir(diagnosticDirectory, { recursive: true });
          const stem = `${chart.key}-${Date.now()}`;
          const htmlPath = path.join(diagnosticDirectory, `${stem}.html`);
          const html = await page.content().catch(() => '');
          await writeFile(htmlPath, html, 'utf8');
          await page.screenshot({ path: path.join(diagnosticDirectory, `${stem}.png`), fullPage: true }).catch(() => {});
          console.error(`Saved failed-page diagnostics to ${htmlPath}`);
          if (attempt === attempts) throw error;
          console.warn(`${chart.label} attempt ${attempt}/${attempts} failed; retrying.`);
          await page.waitForTimeout(2_000 * attempt);
        }
      }
      await page.waitForTimeout(1_200);
    }
    await enrichBookDetails(rankings, fetcher, context, archivedDetails);
  } finally {
    await browser.close();
  }
  return rankings;
}

function buildRanking(fetcher, chart, entries, capturedAt, sourceUrl) {
  const ranking = {
    key: chart.key,
    label: chart.label,
    chineseLabel: chart.chineseLabel,
    sourceUrl: sourceUrl ?? chart.url,
    snapshotPolicy: chart.snapshotPolicy ?? 'month-end',
    capturedAt,
    entries
  };
  validateRanking(ranking);
  if (fetcher.bookUrl) assertBookUrls(ranking, fetcher.bookUrl, fetcher.id);
  fetcher.validate?.(ranking);
  console.log(`Validated ${entries.length} entries for ${chart.label}.`);
  return ranking;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const fetcher = SOURCE_FETCHERS[options.sourceId];
  if (!fetcher) throw new Error(`Unknown source: ${options.sourceId}`);
  if (options.publish && options.onlyMonthEnd && !isLastCalendarDayInShanghai()) {
    console.log('Skipping monthly publication: today is not the final calendar day in Asia/Shanghai.');
    return;
  }
  const currentPeriod = periodInShanghai();
  const period = options.period ?? currentPeriod;
  const dataDirectory = options.dataDirectory ?? path.join('data', fetcher.id);
  const chartKeys = fetcher.charts.map(chart => chart.key);

  if (options.backfillDetails) {
    if (!fetcher.parseBookPage) throw new Error(`${fetcher.name} does not support detail collection.`);
    const snapshotPath = path.join(dataDirectory, 'monthly', `${period}.json`);
    const snapshot = validateSnapshot(JSON.parse(await readFile(snapshotPath, 'utf8')), fetcher.id, chartKeys);
    await enrichBookDetails(snapshot.rankings, fetcher, null, await loadArchivedBookDetails(dataDirectory, fetcher.id));
    await writeJsonAtomically(snapshotPath, snapshot);
    await writeJsonAtomically(path.join(dataDirectory, 'manifest.json'), await buildManifest(fetcher.id, chartKeys, dataDirectory));
    console.log(`Backfilled novel details in ${snapshotPath}.`);
    return;
  }

  if (fetcher.restrictToCurrentPeriod && period !== currentPeriod) {
    throw new Error(`${fetcher.name} can only be captured for the current period (${currentPeriod}); its charts have no verified historical source.`);
  }
  const capturedAt = new Date().toISOString();
  const archivedDetails = fetcher.parseBookPage
    ? await loadArchivedBookDetails(dataDirectory, fetcher.id)
    : new Map();

  let rankings;
  if (fetcher.transport === 'browser') {
    rankings = await collectBrowser(fetcher, capturedAt, options, period, archivedDetails);
  } else {
    rankings = await collectHttp(fetcher, capturedAt, period);
    await enrichBookDetails(rankings, fetcher, null, archivedDetails);
  }

  await addVietnameseTranslations(rankings, await loadArchivedTranslations(dataDirectory, fetcher.id), {
    // Validation-only runs must not consume the Gemini free quota.
    apiKey: options.publish ? process.env.GEMINI_API_KEY : null,
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  });

  const snapshot = {
    schemaVersion: 1,
    source: fetcher.id,
    period,
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? 'dry-run' : 'month-end-candidate',
    rankings
  };

  if (options.publish) {
    const result = await publishSourceSnapshot(snapshot, fetcher.id, chartKeys, dataDirectory);
    console.log(`Published ${result.monthlyPath}`);
    console.log(`Updated ${result.manifestPath}`);
  }

  if (options.output && !options.dryRun) {
    await writeJsonAtomically(options.output, snapshot);
    console.log(`Wrote ${path.resolve(options.output)}`);
  }

  if (!options.output && !options.publish) {
    console.log(JSON.stringify({
      source: fetcher.id,
      period,
      rankings: Object.fromEntries(Object.entries(rankings).map(([key, ranking]) => [key, {
        entries: ranking.entries.length,
        first: ranking.entries[0]
      }]))
    }, null, 2));
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
