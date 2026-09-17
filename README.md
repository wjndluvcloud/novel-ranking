# Novel Ranking

An English-language interface for browsing Qidian Top 20 rankings month by month. Chinese titles, authors, and genre names are kept exactly as collected from Qidian.

## Run the site

Serve the folder over HTTP during development, then open the local address in a browser. The page loads `data/manifest.json` and the matching monthly archive. When an archive cannot be loaded, it shows a bundled verified Qidian capture labeled as a fallback.

## Collector development

Install Node.js 24 LTS and the locked dependencies:

```text
npm ci
npx playwright install chromium
```

Useful commands:

```text
npm test
npm run collect:dry
npm run collect:month
```

`collect:dry` validates the four live Top 20 charts without writing data. `collect:month` runs only on the final calendar day in Asia/Shanghai, writes an immutable `data/monthly/YYYY-MM.json`, and rebuilds `data/manifest.json`.

## Data and automation

Publishable records are stored in `data/`. The GitHub Actions workflow runs against `main`, tests the collector, retries transient source failures, and commits a newly collected monthly archive. Failures remain in the Actions log.

Private planning notes, diagnostics, design previews, local browsers, dependencies, and test output are ignored by Git.
