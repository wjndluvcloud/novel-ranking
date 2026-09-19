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
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseTomatoBookPage } from '../src/sources/tomato/index.mjs';
import { SOURCE_FETCHERS } from '../src/sources/index.mjs';
import { publishSourceSnapshot, validateRanking, assertBookUrls } from '../src/source-archive.mjs';

const DEFAULT_EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function parseArguments(argv) {
  const options = {
    sourceId: null, dryRun: false, publish: false, output: null,
    dataDirectory: null, period: null, headed: false, onlyMonthEnd: false,
    diagnosticsDirectory: '.tmp/collector-diagnostics',
    browserPath: process.env.RANKING_BROWSER_PATH || null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--publish') options.publish = true;
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

async function collectBrowser(fetcher, capturedAt, options, period) {
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
  if (fetcher.restrictToCurrentPeriod && period !== currentPeriod) {
    throw new Error(`${fetcher.name} can only be captured for the current period (${currentPeriod}); its charts have no verified historical source.`);
  }
  const dataDirectory = options.dataDirectory ?? path.join('data', fetcher.id);
  const capturedAt = new Date().toISOString();

  const rankings = fetcher.transport === 'browser'
    ? await collectBrowser(fetcher, capturedAt, options, period)
    : await collectHttp(fetcher, capturedAt, period);

  const snapshot = {
    schemaVersion: 1,
    source: fetcher.id,
    period,
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? 'dry-run' : 'month-end-candidate',
    rankings
  };

  const chartKeys = fetcher.charts.map(chart => chart.key);

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
