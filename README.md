# Novel Ranking

An English-language interface for browsing Top 20 rankings month by month from four Chinese web-novel platforms — **Qidian** (起点), **Jinjiang** (晋江), **Zongheng** (纵横), and **Tomato Novel** (番茄小说). Chinese titles, authors, and genre names are kept exactly as collected.

## Run the site

Serve the folder over HTTP during development, then open the local address in a browser. Each source tab loads its own archive from `data/<source>/manifest.json` and the matching monthly snapshot. If the Qidian archive cannot be loaded, the page shows a bundled verified Qidian capture labeled as a fallback; a source with no archive yet shows an unavailable notice.

Sources and their charts are declared in `sources-config.js`, which the browser reads to build the tabs and load the right archive.

## Data collection per source

| Source | Transport | Notes |
| --- | --- | --- |
| Qidian | Playwright | Rendered browser; strict challenge detection + book-URL validation preserved. |
| Jinjiang | HTTP + cheerio | `topten.php` server-rendered GBK table; fully scrapable. |
| Tomato / Fanqie | Playwright | Rank list is client-rendered (raw HTML has ~10 of 20), so a browser + scroll is required. |
| Zongheng | Playwright | Rank pages sit behind a WAF gateway; a real browser is required. |

Behind a corporate TLS proxy, run the HTTP collector with `node --use-system-ca` (already set in the `collect:*` scripts). Browser-based collectors (Qidian, Tomato, Zongheng) need Chromium via `npx playwright install chromium`, which may be blocked by the same proxy locally — run those in CI where the network is open.

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
```

Jinjiang is fetched directly and works anywhere. Tomato and Zongheng require a real browser, so they are collected by the `collect-monthly` GitHub Actions workflow (which installs Chromium and has open network access).

### Collecting real Tomato and Zongheng data

Both need a rendered browser (Tomato lazy-loads rows; Zongheng is behind a WAF), so Chromium must be installed. Two ways:

**A. GitHub Actions (recommended).** Run the `collect-monthly` workflow from the Actions tab, pick the source (or `all`), and set `dry_run: false`. The runner installs Chromium, scrapes the live charts, and commits `data/<source>/monthly/YYYY-MM.json`. Leave `dry_run: true` first to confirm each chart still yields a valid Top 20.

**B. Locally.** Install the browser, then run the collector:

```text
npx playwright install chromium
npm run collect:tomato
npm run collect:zongheng
```

Behind a corporate TLS proxy the Chromium download fails (`unable to get local issuer certificate`) because Playwright's downloader does not use the system store. Point it at your corporate root certificate first:

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\path\to\corp-root-ca.pem"
npx playwright install chromium
```

Use `--period YYYY-MM` to archive under a specific month (e.g. to match the Qidian archive):

```text
node scripts/fetch-source-monthly.mjs tomato --publish --data-directory data/tomato --period 2026-08
```

## Data and automation

Publishable records are stored per source under `data/<source>/` (`manifest.json` + `monthly/YYYY-MM.json`). A single `collect-monthly` GitHub Actions workflow handles every source: on a month-end schedule it collects all four (each publishes one immutable archive per month via a last-calendar-day gate), and on manual dispatch you can collect any one source or `all` (dry-run by default). Each run tests the collectors, scrapes the chosen charts, and commits new archives to `main`.

Because the non-Qidian scrapers depend on live DOM structure, run their workflow in dry-run first to confirm each chart still yields a valid Top 20 before publishing.

Private planning notes, diagnostics, design previews, local browsers, dependencies, and test output are ignored by Git.
