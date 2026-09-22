# Novel Ranking

An English-language interface for browsing Top 20 rankings month by month from five Chinese web-novel platforms — **Qidian** (起点), **Jinjiang** (晋江), **Zongheng** (纵横), **Tomato Novel** (番茄小说), and **Faloo** (飞卢). Chinese titles, authors, and genre names are kept exactly as collected.

## Run the site

Serve the folder over HTTP during development, then open the local address in a browser. Each source tab loads its own archive from `data/<source>/manifest.json` and the matching monthly snapshot. If a source's archive cannot be loaded, its tab shows an "Archive unavailable" notice.

Sources and their charts are declared in `assets/js/sources-config.js`, which the browser reads to build the tabs and load the right archive.

## Vietnamese translations

Published monthly runs translate each new novel title and introduction with `gemini-3-flash-preview`. Add an Auth key as the `GEMINI_API_KEY` repository Actions secret. Successful translations are stored as `titleVi` and `introductionVi` in the monthly archive and reused in later months; failed or unavailable translations remain `null` and do not stop publication. Dry runs never call Gemini or consume its quota.

## Data collection per source

| Source | Transport | Notes |
| --- | --- | --- |
| Qidian | Playwright | Rendered browser; strict challenge detection + book-URL validation preserved. |
| Jinjiang | HTTP + cheerio | `topten.php` server-rendered GBK table; fully scrapable. |
| Tomato / Fanqie | Playwright | Rank list is client-rendered (raw HTML has ~10 of 20), so a browser + scroll is required. |
| Zongheng | Playwright | Rank pages sit behind a WAF gateway; a real browser is required. |
| Faloo | HTTP + cheerio | Server-rendered GB2312 monthly ranking pages. |

## Collector development

Install Node.js 24 LTS and the locked dependencies:

```text
npm ci
npx playwright install chromium
```

Useful commands:

```text
npm test
npm run collect:dry        # Qidian, validate only
npm run collect:month      # Qidian, publish month-end archive
npm run collect:jinjiang   # Jinjiang, publish (HTTP + cheerio, real data)
npm run collect:tomato     # Tomato/Fanqie, publish (Playwright)
npm run collect:zongheng   # Zongheng, publish (Playwright, WAF-protected)
npm run collect:faloo      # Faloo, publish (HTTP + cheerio, real data)
```

## Adding a new source

Every source is a self-contained plugin, so adding one needs no changes to `app.js`, the collector runner, or the archive writer:

1. Create `src/sources/<id>/index.mjs` exporting a plugin object: `{ id, name, label, homeUrl, dataDir: 'data/<id>', transport, parse, charts: [{ key, label, chineseLabel, url }] }`. Optional hooks: `validate(ranking)`, `detectChallenge(html)`, `resolveChartUrl(chart, period)`, `readySelector`, `readyCount`, `attempts`, `restrictToCurrentPeriod`. Source-specific helpers (parser, validator, etc.) live in the same folder.
2. Register it in the `SOURCES` array in `src/sources/index.mjs`.
3. Run `npm run build:config` to regenerate `assets/js/sources-config.js` (the browser registry).
4. Add its id to the GitHub Actions manual choice and collection matrices.

`npm test` includes a contract test that validates every plugin's shape, plus an acceptance test that publishes an arbitrary source through the generic archive writer.

## Data and automation

Publishable records are stored per source under `data/<source>/` (`manifest.json` + `monthly/YYYY-MM.json`). A single `collect-monthly` GitHub Actions workflow handles every source: on a month-end schedule it collects all five (each publishes one immutable archive per month via a last-calendar-day gate), and on manual dispatch you can collect any one source or `all` (dry-run by default). Each run tests the collectors, scrapes the chosen charts, and commits new archives to `main`.

Because the non-Qidian scrapers depend on live DOM structure, run their workflow in dry-run first to confirm each chart still yields a valid Top 20 before publishing.

Private planning notes, diagnostics, design previews, local browsers, dependencies, and test output are ignored by Git.
