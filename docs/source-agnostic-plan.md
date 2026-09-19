# Plan: Make the ranking project source-agnostic

Goal: turn the project from **"Qidian + others"** into a system where **any source is a plugin**.

**Definition of done:** adding a new source (e.g. Webnovel) means creating one plugin file
under `src/sources/` and adding one display entry in `sources-config.js` — with **zero edits**
to `app.js`, the archive writer, the collector runner, or the CI workflow.

---

## Current state

Already generic (no work needed):

- Per-source data folders: `data/<id>/manifest.json` + `monthly/YYYY-MM.json`.
- The manifest/snapshot schema and the strict, immutable archive writer (`src/source-archive.mjs`).
- Client month navigation, trend arrows, and per-source loading in `app.js`.
- One `collect-monthly` GitHub Actions workflow (matrix over all sources, month-end gate).

Still privileged / hardcoded to Qidian:

- Client fallback + genre labels are Qidian-specific globals.
- Two collectors and two archive writers (Qidian-locked vs generic).
- Source metadata is split across three files.
- Validation strictness and anti-bot detection live in core, not with the source.

---

## Target architecture

One **source-plugin** model. Each source is a single module exporting one object:

```
src/sources/<id>.mjs  ->  {
  id, name, homeUrl, dataDir,
  charts: [{ key, label, chineseLabel, url?, metricLabel? }],
  transport: 'http' | 'browser',
  parse(html, chart) -> entries[],
  validate?(entry) -> void,        // optional per-source strict rules
  detectChallenge?(html) -> string|null,  // optional anti-bot/WAF hook
  fallbackGlobal?: string,         // optional bundled snapshot global name
  genreLabel?(category, subcategory) -> string  // optional label mapping
}
```

- **Browser** reads the display subset (id, name, dataDir, charts, fallbackGlobal, genreLabel).
- **Server** reads the fetch subset (transport, charts.url, parse, validate, detectChallenge).

A single registry (`src/sources/index.mjs`) aggregates all plugins; `sources-config.js`
is generated from / mirrors the display subset for the browser.

---

## Work breakdown

### Phase 1 — Unify the source registry (#4) — DONE
- [x] Create `src/sources/` with one module per source: `qidian.mjs`, `jinjiang.mjs`,
      `tomato.mjs`, `zongheng.mjs` (+ shared `util.mjs`).
- [x] Fold `src/qidian-sources.mjs` chart list into `src/sources/qidian.mjs` (imports it;
      the official monthly-ticket URL logic stays in `qidian-sources.mjs` for the legacy collector).
- [x] Move `src/source-fetchers.mjs` descriptors into the per-source plugin modules;
      `source-fetchers.mjs` is now a re-export shim for backward compatibility (tests/runner unchanged).
- [x] Add `src/sources/index.mjs` exporting `SOURCES` (all four) and `SOURCE_FETCHERS`
      (the three generic-runner sources).
- [x] Make `sources-config.js` a generated artifact via `scripts/build-sources-config.mjs`
      (`npm run build:config`); the registry is now the single source of truth.
- [x] Tests remain green (16/16); browser config content unchanged.

### Phase 2 — Fold Qidian into the generic pipeline (#2) — DONE
- [x] Register `qidian` in the plugin registry with `transport: 'browser'`, reusing
      `parseQidianRanking` (and its strict validator via a `validate` hook).
- [x] Route Qidian through `scripts/fetch-source-monthly.mjs` + `src/source-archive.mjs`
      (added per-source hooks: `resolveChartUrl`, `readyCount`, `attempts`, `restrictToCurrentPeriod`,
      per-chart `snapshotPolicy`, and `validate`).
- [x] Remove `scripts/fetch-qidian-monthly.mjs` and `src/monthly-archive.mjs`.
- [x] Update the workflow to drop the `if source == qidian` branch; `collect:dry` / `collect:month`
      now call the generic runner.
- [x] Migrated the archive test to `tests/source-archive.test.mjs`; tests 16/16 green.
- Note: strict validation + challenge detection were moved with Qidian (covers plan #3/#6 for Qidian).

### Phase 3 — Move strictness + anti-bot into plugins (#3, #6) — DONE
- [x] Optional `validate(ranking)` hook exposing Qidian's strict `qidian.com/book/<id>` check
      via the plugin (wired in Phase 2).
- [x] Optional `detectChallenge(html)` hook; Qidian exposes `detectQidianChallenge`; the runner
      calls it generically before parsing in both transports (`assertNoChallenge`).
- [x] Generic `validateRanking` (20 entries, unique ranks/ids, title+author) stays the baseline
      every source must pass. Tests 16/16 green.

### Phase 4 — De-Qidian the client (#1) — DONE
- [x] Added optional `fallbackGlobal` per source in the registry (emitted into `sources-config.js`);
      `app.js` resolves the fallback via `fallbackSnapshotFor(config)` and `handleLoadFailure`
      keys off "does this source declare a fallback?" instead of `id === 'qidian'`.
- [x] Genre labels are source-aware via `window.genreLabelForSource(sourceId, …)`
      (`category-labels.js`); `app.js` no longer references a Qidian-only label map.
- [x] `app.js` has zero `qidian`/`QIDIAN` references. Tests 16/16 green.

### Phase 5 — Tests (#5)
- [ ] Re-point the suite at the plugin registry + `source-archive.mjs`.
- [ ] Keep Qidian's parser/validator coverage by testing them **as the Qidian plugin**.
- [ ] Add a small "contract" test that every registered plugin exposes the required shape.
- [ ] Keep the suite green after each phase.

---

## Acceptance test

Add a throwaway `src/sources/example.mjs` with 4 charts + a parse stub and one display entry;
confirm a new tab renders and `node scripts/fetch-source-monthly.mjs example` runs — **without
touching any core file.** Then delete it.

## Order & risk

Do Phase 1 -> 2 -> 3 -> 4 -> 5, keeping tests green between phases. Highest-risk step is
Phase 2 (retiring the battle-tested Qidian collector); mitigate by porting its parser/validator
verbatim into the plugin and reusing the existing fixtures in `tests/fixtures/qidian/`.
