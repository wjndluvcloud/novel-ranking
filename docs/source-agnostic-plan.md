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

### Phase 1 — Unify the source registry (#4)
- [ ] Create `src/sources/` with one module per source: `qidian.mjs`, `jinjiang.mjs`,
      `tomato.mjs`, `zongheng.mjs`.
- [ ] Fold `src/qidian-sources.mjs` (chart list + official monthly-ticket URL logic) into
      `src/sources/qidian.mjs`.
- [ ] Move `src/source-fetchers.mjs` descriptors into the per-source plugin modules.
- [ ] Add `src/sources/index.mjs` that exports the aggregated registry.
- [ ] Make `sources-config.js` derive from the registry's display subset (single source of truth).

### Phase 2 — Fold Qidian into the generic pipeline (#2)
- [ ] Register `qidian` in the plugin registry with `transport: 'browser'`, reusing
      `parseQidianRanking`.
- [ ] Route Qidian through `scripts/fetch-source-monthly.mjs` + `src/source-archive.mjs`.
- [ ] Remove `scripts/fetch-qidian-monthly.mjs` and `src/monthly-archive.mjs`.
- [ ] Update the workflow to drop the `if source == qidian` branch and the `collect:dry` /
      `collect:month` npm scripts (replace with the generic runner for all four).

### Phase 3 — Move strictness + anti-bot into plugins (#3, #6)
- [ ] Add an optional `validate(entry)` hook; port Qidian's `qidian.com/book/<id>` URL check
      (`src/qidian-validator.mjs`) into `src/sources/qidian.mjs`.
- [ ] Add an optional `detectChallenge(html)` hook; move `detectQidianChallenge` into the
      Qidian plugin; let the runner call it generically before parsing.
- [ ] Keep the generic `validateRanking` (20 entries, unique ranks/ids, title+author) as the
      baseline every source must pass.

### Phase 4 — De-Qidian the client (#1)
- [ ] Add optional `fallbackGlobal` per source in the registry; `handleLoadFailure` uses
      "does this source declare a fallback?" instead of `id === 'qidian'`.
- [ ] Add optional per-source `genreLabel`; keep `category-labels.js` as the Qidian plugin's
      label map, referenced from `src/sources/qidian.mjs`.
- [ ] Remove direct `window.QIDIAN_*` references from `app.js`.

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
