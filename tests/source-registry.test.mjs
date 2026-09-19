import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, SOURCE_FETCHERS } from '../src/sources/index.mjs';

test('every source exposes the required display shape', () => {
  assert.ok(SOURCES.length > 0);
  const ids = new Set();
  for (const source of SOURCES) {
    for (const field of ['id', 'name', 'label', 'homeUrl', 'dataDir']) {
      assert.equal(typeof source[field], 'string', `${source.id}.${field} must be a string`);
    }
    assert.equal(source.dataDir, `data/${source.id}`, `${source.id}.dataDir`);
    assert.ok(!ids.has(source.id), `duplicate source id ${source.id}`);
    ids.add(source.id);

    assert.ok(Array.isArray(source.charts) && source.charts.length > 0, `${source.id}.charts`);
    const chartKeys = new Set();
    for (const chart of source.charts) {
      for (const field of ['key', 'label', 'chineseLabel']) {
        assert.equal(typeof chart[field], 'string', `${source.id}.${chart.key}.${field}`);
      }
      assert.ok(!chartKeys.has(chart.key), `${source.id} duplicate chart key ${chart.key}`);
      chartKeys.add(chart.key);
    }
    if (source.fallbackGlobal !== undefined) assert.equal(typeof source.fallbackGlobal, 'string');
  }
});

test('every fetch source exposes a valid collector contract', () => {
  for (const [id, fetcher] of Object.entries(SOURCE_FETCHERS)) {
    assert.ok(SOURCES.includes(fetcher), `${id} must be a registered source`);
    assert.equal(typeof fetcher.parse, 'function', `${id}.parse`);
    assert.ok(['http', 'browser'].includes(fetcher.transport), `${id}.transport`);
    for (const chart of fetcher.charts) {
      assert.equal(typeof chart.url, 'string', `${id}.${chart.key}.url`);
    }
    for (const hook of ['validate', 'detectChallenge', 'resolveChartUrl']) {
      if (fetcher[hook] !== undefined) assert.equal(typeof fetcher[hook], 'function', `${id}.${hook}`);
    }
    if (fetcher.readyCount !== undefined) assert.equal(typeof fetcher.readyCount, 'number', `${id}.readyCount`);
    if (fetcher.attempts !== undefined) assert.equal(typeof fetcher.attempts, 'number', `${id}.attempts`);
  }
});

test('SOURCE_FETCHERS contains exactly the parseable sources', () => {
  const expected = SOURCES.filter(source => typeof source.parse === 'function').map(source => source.id).sort();
  assert.deepEqual(Object.keys(SOURCE_FETCHERS).sort(), expected);
});
