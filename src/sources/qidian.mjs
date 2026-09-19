// Qidian source plugin (display + fetch metadata).
// The Qidian collector still runs through the dedicated Playwright script and
// strict validator; folding it into the generic runner is a later phase. This
// module is the single source of truth for Qidian's display + chart list.
import { QIDIAN_SOURCES } from '../qidian-sources.mjs';

const charts = QIDIAN_SOURCES.map(source => Object.freeze({
  key: source.key,
  label: source.label,
  chineseLabel: source.chineseLabel,
  url: source.url,
  slug: source.slug,
  snapshotPolicy: source.snapshotPolicy
}));

export default Object.freeze({
  id: 'qidian',
  name: 'Qidian',
  label: 'Qidian Ranking',
  homeUrl: 'https://www.qidian.com/',
  dataDir: 'data/qidian',
  transport: 'browser',
  legacyCollector: true,
  charts
});
