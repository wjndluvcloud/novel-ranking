import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { QIDIAN_SOURCES } from './qidian-sources.mjs';
import { validateQidianRanking } from './qidian-validator.mjs';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/u;
const REQUIRED_KEYS = QIDIAN_SOURCES.map(source => source.key);

export class MonthlyArchiveError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'MonthlyArchiveError';
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
  return payload;
}

async function replaceJson(filePath, value) {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, payload, { encoding: 'utf8', flag: 'w' });
  await rename(temporaryPath, filePath);
  return payload;
}

export function validateMonthlySnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.source !== 'qidian') {
    throw new MonthlyArchiveError('Snapshot must use schema version 1 and the Qidian source.', 'INVALID_SNAPSHOT');
  }
  if (!PERIOD_PATTERN.test(snapshot.period ?? '')) {
    throw new MonthlyArchiveError('Snapshot period must use YYYY-MM.', 'INVALID_PERIOD');
  }
  if (!snapshot.rankings || typeof snapshot.rankings !== 'object') {
    throw new MonthlyArchiveError('Snapshot rankings are required.', 'RANKINGS_MISSING');
  }

  const keys = Object.keys(snapshot.rankings).sort();
  const expectedKeys = [...REQUIRED_KEYS].sort();
  if (keys.join('|') !== expectedKeys.join('|')) {
    throw new MonthlyArchiveError('Snapshot must contain exactly the four configured rankings.', 'RANKING_KEYS_INVALID', { keys });
  }

  for (const source of QIDIAN_SOURCES) {
    const ranking = snapshot.rankings[source.key];
    validateQidianRanking(ranking);
    if (ranking.key !== source.key || ranking.label !== source.label) {
      throw new MonthlyArchiveError(`Ranking metadata does not match ${source.key}.`, 'RANKING_METADATA_INVALID');
    }
    if (!ranking.capturedAt || Number.isNaN(Date.parse(ranking.capturedAt))) {
      throw new MonthlyArchiveError(`${source.key} has no valid capture timestamp.`, 'CAPTURE_TIME_INVALID');
    }
  }

  return snapshot;
}

export function manifestEntry(snapshot) {
  return {
    period: snapshot.period,
    file: `monthly/${snapshot.period}.json`,
    generatedAt: snapshot.generatedAt,
    rankings: Object.fromEntries(QIDIAN_SOURCES.map(source => {
      const ranking = snapshot.rankings[source.key];
      return [source.key, {
        label: ranking.label,
        chineseLabel: ranking.chineseLabel,
        snapshotPolicy: ranking.snapshotPolicy,
        capturedAt: ranking.capturedAt,
        sourceUrl: ranking.sourceUrl
      }];
    }))
  };
}

export async function buildManifest(dataDirectory) {
  const monthlyDirectory = path.join(dataDirectory, 'monthly');
  const files = (await readdir(monthlyDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && PERIOD_PATTERN.test(entry.name.slice(0, -5)) && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort((left, right) => right.localeCompare(left));

  const snapshots = await Promise.all(files.map(async file => {
    const snapshot = JSON.parse(await readFile(path.join(monthlyDirectory, file), 'utf8'));
    validateMonthlySnapshot(snapshot);
    if (file !== `${snapshot.period}.json`) {
      throw new MonthlyArchiveError(`Monthly file name does not match its period: ${file}`, 'PERIOD_FILE_MISMATCH');
    }
    return snapshot;
  }));

  return {
    schemaVersion: 1,
    source: 'qidian',
    periods: snapshots.map(manifestEntry)
  };
}

export async function publishMonthlySnapshot(snapshot, dataDirectory = 'data') {
  validateMonthlySnapshot(snapshot);
  const resolvedDataDirectory = path.resolve(dataDirectory);
  const monthlyDirectory = path.join(resolvedDataDirectory, 'monthly');
  const monthlyPath = path.join(monthlyDirectory, `${snapshot.period}.json`);
  const expectedPayload = `${JSON.stringify(snapshot, null, 2)}\n`;

  await mkdir(monthlyDirectory, { recursive: true });
  if (await fileExists(monthlyPath)) {
    const existingPayload = await readFile(monthlyPath, 'utf8');
    if (existingPayload !== expectedPayload) {
      throw new MonthlyArchiveError(`Refusing to rewrite immutable monthly archive: ${snapshot.period}`, 'IMMUTABLE_PERIOD_EXISTS');
    }
  } else {
    await writeNewJson(monthlyPath, snapshot);
  }

  const manifest = await buildManifest(resolvedDataDirectory);
  await replaceJson(path.join(resolvedDataDirectory, 'manifest.json'), manifest);
  return { monthlyPath, manifestPath: path.join(resolvedDataDirectory, 'manifest.json'), manifest };
}
