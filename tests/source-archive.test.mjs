import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildManifest, publishSourceSnapshot, SourceArchiveError, validateSnapshot } from '../src/source-archive.mjs';
import { parseQidianRanking } from '../src/qidian-parser.mjs';
import { QIDIAN_SOURCES } from '../src/qidian-sources.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, 'fixtures', 'qidian');
const chartKeys = QIDIAN_SOURCES.map(source => source.key);

async function snapshotFor(period = '2026-09') {
  const rankings = {};
  for (const source of QIDIAN_SOURCES) {
    const html = await readFile(path.join(fixtureDirectory, `${source.slug}.html`), 'utf8');
    const parsed = parseQidianRanking(html, source);
    rankings[source.key] = { ...parsed, capturedAt: '2026-09-30T15:40:00.000Z' };
  }
  return {
    schemaVersion: 1,
    source: 'qidian',
    period,
    generatedAt: '2026-09-30T15:55:00.000Z',
    rankings
  };
}

test('publishes a complete immutable monthly snapshot and deterministic manifest', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'novel-ranking-archive-'));
  try {
    const snapshot = await snapshotFor();
    const first = await publishSourceSnapshot(snapshot, 'qidian', chartKeys, dataDirectory);
    const written = JSON.parse(await readFile(first.monthlyPath, 'utf8'));
    const manifest = JSON.parse(await readFile(first.manifestPath, 'utf8'));

    assert.deepEqual(written, snapshot);
    assert.deepEqual(manifest, await buildManifest('qidian', chartKeys, dataDirectory));
    assert.equal(manifest.periods.length, 1);
    assert.equal(manifest.periods[0].file, 'monthly/2026-09.json');

    const second = await publishSourceSnapshot(snapshot, 'qidian', chartKeys, dataDirectory);
    assert.deepEqual(second.manifest, manifest);

    snapshot.rankings.monthlyTickets.entries[0].title = 'Changed title';
    await assert.rejects(
      publishSourceSnapshot(snapshot, 'qidian', chartKeys, dataDirectory),
      error => error instanceof SourceArchiveError && error.code === 'IMMUTABLE_PERIOD_EXISTS'
    );
  } finally {
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test('rejects snapshots that omit a configured chart', async () => {
  const snapshot = await snapshotFor();
  delete snapshot.rankings.mostFollowed;
  assert.throws(
    () => validateSnapshot(snapshot, 'qidian', chartKeys),
    error => error instanceof SourceArchiveError && error.code === 'RANKING_KEYS_INVALID'
  );
});
