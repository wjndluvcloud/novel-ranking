// Generates sources-config.js (browser global) from the source registry so the
// registry in src/sources/*.mjs is the single source of truth.
// Run: node scripts/build-sources-config.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../src/sources/index.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const display = SOURCES.map(source => {
  const entry = {
    id: source.id,
    name: source.name,
    label: source.label,
    homeUrl: source.homeUrl,
    dataDir: source.dataDir,
    charts: source.charts.map(chart => ({
      key: chart.key,
      label: chart.label,
      chineseLabel: chart.chineseLabel
    }))
  };
  if (source.fallbackGlobal) entry.fallbackGlobal = source.fallbackGlobal;
  return entry;
});

const banner = '// AUTO-GENERATED from src/sources/*.mjs by scripts/build-sources-config.mjs.\n'
  + '// Do not edit by hand; run `npm run build:config` after changing a source plugin.\n';
const body = `window.RANKING_SOURCES = Object.freeze(${JSON.stringify(display, null, 2)});\n`;

await writeFile(path.join(projectRoot, 'sources-config.js'), `${banner}${body}`, 'utf8');
console.log(`Wrote sources-config.js (${display.length} sources).`);
