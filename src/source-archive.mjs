// Generic monthly-archive writer shared by every ranking source.
// Parameterised by source id + chart set, it validates a snapshot and writes an
// immutable per-month archive plus a rebuilt manifest.
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/u;

export class SourceArchiveError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SourceArchiveError';
    this.code = code;
    this.details = details;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeNewJson(filePath, value) {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, payload, { encoding: 'utf8', flag: 'wx' });
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function replaceJson(filePath, value) {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, payload, { encoding: 'utf8', flag: 'w' });
  await rename(temporaryPath, filePath);
}

export function validateRanking(ranking, expectedCount = 20) {
  const issues = [];
  const entries = Array.isArray(ranking?.entries) ? ranking.entries : [];
  if (entries.length !== expectedCount) {
    issues.push(`${ranking?.key ?? 'chart'} expected ${expectedCount} entries, received ${entries.length}`);
  }
  const ranks = entries.map(entry => entry.rank);
  const expectedRanks = Array.from({ length: expectedCount }, (_, index) => index + 1);
  if (new Set(ranks).size !== entries.length || expectedRanks.some(rank => !ranks.includes(rank))) {
    issues.push(`${ranking?.key ?? 'chart'} ranks must be unique and cover 1-${expectedCount}`);
  }
  const bookIds = entries.map(entry => entry.bookId).filter(Boolean);
  if (new Set(bookIds).size !== entries.length) {
    issues.push(`${ranking?.key ?? 'chart'} book IDs must be present and unique`);
  }
  for (const entry of entries) {
    if (!entry.title) issues.push(`${ranking?.key} rank ${entry.rank ?? '?'} has no title`);
    if (!entry.author) issues.push(`${ranking?.key} rank ${entry.rank ?? '?'} has no author`);
  }
  if (issues.length) throw new SourceArchiveError(issues.join('; '), 'RANKING_INVALID', { issues });
  return ranking;
}

// The book id is stored as `<sourceId>-<rawId>` (or the raw id for Qidian);
// recover the raw id so it can be matched against the book URL.
function rawBookId(bookId, sourceId) {
  const prefix = `${sourceId}-`;
  return bookId?.startsWith(prefix) ? bookId.slice(prefix.length) : bookId;
}

function isValidBookUrl(value, host, bookId, sourceId) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    // Exact host or a real subdomain — never a lookalike like notqidian.com.
    if (url.host !== host && !url.host.endsWith(`.${host}`)) return false;
    const rawId = rawBookId(bookId, sourceId);
    return Boolean(rawId) && `${url.pathname}${url.search}`.includes(rawId);
  } catch {
    return false;
  }
}

// Verifies every entry's book URL is an https link on the source's own domain
// whose path/query contains the book id. `rule` is `{ host }` from the plugin.
export function assertBookUrls(ranking, rule, sourceId) {
  if (!rule?.host) return ranking;
  const issues = [];
  for (const entry of ranking?.entries ?? []) {
    if (!isValidBookUrl(entry.bookUrl, rule.host, entry.bookId, sourceId)) {
      issues.push(`${ranking?.key ?? 'chart'} rank ${entry.rank ?? '?'} has an invalid ${sourceId} book URL`);
    }
  }
  if (issues.length) throw new SourceArchiveError(issues.join('; '), 'BOOK_URL_INVALID', { issues });
  return ranking;
}

export function validateSnapshot(snapshot, sourceId, chartKeys) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.source !== sourceId) {
    throw new SourceArchiveError(`Snapshot must use schema version 1 and source ${sourceId}.`, 'INVALID_SNAPSHOT');
  }
  if (!PERIOD_PATTERN.test(snapshot.period ?? '')) {
    throw new SourceArchiveError('Snapshot period must use YYYY-MM.', 'INVALID_PERIOD');
  }
  if (!snapshot.rankings || typeof snapshot.rankings !== 'object') {
    throw new SourceArchiveError('Snapshot rankings are required.', 'RANKINGS_MISSING');
  }
  const keys = Object.keys(snapshot.rankings).sort();
  const expectedKeys = [...chartKeys].sort();
  if (keys.join('|') !== expectedKeys.join('|')) {
    throw new SourceArchiveError('Snapshot must contain exactly the configured charts.', 'RANKING_KEYS_INVALID', { keys });
  }
  for (const key of chartKeys) {
    const ranking = snapshot.rankings[key];
    validateRanking(ranking);
    if (!ranking.capturedAt || Number.isNaN(Date.parse(ranking.capturedAt))) {
      throw new SourceArchiveError(`${key} has no valid capture timestamp.`, 'CAPTURE_TIME_INVALID');
    }
  }
  return snapshot;
}

export function manifestEntry(snapshot, chartKeys) {
  return {
    period: snapshot.period,
    file: `monthly/${snapshot.period}.json`,
    generatedAt: snapshot.generatedAt,
    rankings: Object.fromEntries(chartKeys.map(key => {
      const ranking = snapshot.rankings[key];
      return [key, {
        label: ranking.label,
        chineseLabel: ranking.chineseLabel,
        snapshotPolicy: ranking.snapshotPolicy,
        capturedAt: ranking.capturedAt,
        sourceUrl: ranking.sourceUrl
      }];
    }))
  };
}

export async function buildManifest(sourceId, chartKeys, dataDirectory) {
  const monthlyDirectory = path.join(dataDirectory, 'monthly');
  const files = (await readdir(monthlyDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.json') && PERIOD_PATTERN.test(entry.name.slice(0, -5)))
    .map(entry => entry.name)
    .sort((left, right) => right.localeCompare(left));

  const snapshots = await Promise.all(files.map(async file => {
    const snapshot = JSON.parse(await readFile(path.join(monthlyDirectory, file), 'utf8'));
    validateSnapshot(snapshot, sourceId, chartKeys);
    return snapshot;
  }));

  return {
    schemaVersion: 1,
    source: sourceId,
    periods: snapshots.map(snapshot => manifestEntry(snapshot, chartKeys))
  };
}

export async function publishSourceSnapshot(snapshot, sourceId, chartKeys, dataDirectory) {
  validateSnapshot(snapshot, sourceId, chartKeys);
  const monthlyDirectory = path.join(dataDirectory, 'monthly');
  await mkdir(monthlyDirectory, { recursive: true });
  const monthlyPath = path.join(monthlyDirectory, `${snapshot.period}.json`);

  if (await fileExists(monthlyPath)) {
    const existing = JSON.parse(await readFile(monthlyPath, 'utf8'));
    if (JSON.stringify(existing) !== JSON.stringify(snapshot)) {
      throw new SourceArchiveError(`An archive for ${snapshot.period} already exists and is immutable.`, 'IMMUTABLE_PERIOD_EXISTS');
    }
  } else {
    await writeNewJson(monthlyPath, snapshot);
  }

  const manifest = await buildManifest(sourceId, chartKeys, dataDirectory);
  const manifestPath = path.join(dataDirectory, 'manifest.json');
  await replaceJson(manifestPath, manifest);
  return { monthlyPath, manifestPath, manifest };
}
