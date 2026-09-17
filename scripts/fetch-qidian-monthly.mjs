import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { QIDIAN_SOURCES, sourceForPeriod } from '../src/qidian-sources.mjs';
import { detectQidianChallenge, parseQidianRanking, QIDIAN_SELECTORS } from '../src/qidian-parser.mjs';
import { validateQidianRanking } from '../src/qidian-validator.mjs';
import { publishMonthlySnapshot } from '../src/monthly-archive.mjs';

const DEFAULT_EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

function parseArguments(argv) {
  const options = {
    dryRun: false,
    output: null,
    publish: false,
    dataDirectory: 'data',
    period: null,
    headed: false,
    browserPath: process.env.QIDIAN_BROWSER_PATH || null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--headed') options.headed = true;
    else if (argument === '--output') options.output = argv[++index];
    else if (argument === '--publish') options.publish = true;
    else if (argument === '--data-directory') options.dataDirectory = argv[++index];
    else if (argument === '--period') options.period = argv[++index];
    else if (argument === '--browser-path') options.browserPath = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.dryRun && options.publish) throw new Error('--dry-run cannot be used with --publish.');
  if (options.period && !/^\d{4}-(0[1-9]|1[0-2])$/u.test(options.period)) {
    throw new Error('--period must use YYYY-MM.');
  }
  return options;
}

function periodInShanghai(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit'
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year').value;
  const month = parts.find(part => part.type === 'month').value;
  return `${year}-${month}`;
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
  const directory = path.dirname(absolutePath);
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, absolutePath);
}

async function collectSource(page, source) {
  console.log(`Collecting ${source.label} from ${source.url}`);
  const response = await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  try {
    await page.waitForFunction(
      selector => document.querySelectorAll(selector).length === 20,
      QIDIAN_SELECTORS.entries,
      { timeout: 60_000 }
    );
  } catch (error) {
    const html = await page.content();
    const entryCount = await page.locator(QIDIAN_SELECTORS.entries).count();
    const diagnostics = {
      status: response?.status() ?? null,
      finalUrl: page.url(),
      title: await page.title(),
      entryCount,
      challenge: detectQidianChallenge(html),
      htmlBytes: Buffer.byteLength(html)
    };
    throw new Error(`Qidian did not render a complete ranking: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  const html = await page.content();
  const ranking = validateQidianRanking(parseQidianRanking(html, source));
  console.log(`Validated ${ranking.entries.length} entries for ${source.label}.`);
  return { ...ranking, capturedAt: new Date().toISOString() };
}

async function collectSourceWithRetries(page, source, maximumAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await collectSource(page, source);
    } catch (error) {
      lastError = error;
      if (attempt === maximumAttempts) break;
      const delay = 2_000 * 2 ** (attempt - 1);
      console.warn(`${source.label} attempt ${attempt}/${maximumAttempts} failed; retrying in ${delay / 1000}s.`);
      await page.waitForTimeout(delay);
    }
  }
  throw lastError;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const currentPeriod = periodInShanghai();
  const period = options.period ?? currentPeriod;
  if (period !== currentPeriod) {
    throw new Error('Only the current period can be captured: the three non-ticket charts have no verified historical source.');
  }
  if (options.publish && !isLastCalendarDayInShanghai()) {
    console.log('Skipping monthly publication: today is not the final calendar day in Asia/Shanghai.');
    return;
  }
  const sources = QIDIAN_SOURCES.map(source => sourceForPeriod(source, period));
  const executablePath = resolveBrowserPath(options.browserPath);
  const browser = await chromium.launch({
    headless: !options.headed,
    ...(executablePath ? { executablePath } : {}),
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--disable-crash-reporter']
  });

  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 1000 }
  });
  const page = await context.newPage();
  const rankings = {};

  try {
    for (const source of sources) {
      rankings[source.key] = await collectSourceWithRetries(page, source);
      await page.waitForTimeout(1_200);
    }
  } finally {
    await browser.close();
  }

  const snapshot = {
    schemaVersion: 1,
    source: 'qidian',
    period,
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? 'dry-run' : 'month-end-candidate',
    rankings
  };

  if (options.publish) {
    const result = await publishMonthlySnapshot(snapshot, options.dataDirectory);
    console.log(`Published ${result.monthlyPath}`);
    console.log(`Updated ${result.manifestPath}`);
  }

  if (options.output && !options.dryRun) {
    await writeJsonAtomically(options.output, snapshot);
    console.log(`Wrote ${path.resolve(options.output)}`);
  }

  if (!options.output && !options.publish) {
    console.log(JSON.stringify({
      period: snapshot.period,
      mode: snapshot.mode,
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
