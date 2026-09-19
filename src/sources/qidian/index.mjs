// Qidian source plugin (display + fetch).
// Reuses Qidian's dedicated parser/validator/sources as this plugin's internals,
// so the strict challenge detection and book-URL validation are preserved while
// Qidian runs through the generic collector like every other source.
import { detectQidianChallenge, parseQidianRanking, QIDIAN_SELECTORS } from './parser.mjs';
import { validateQidianRanking } from './validator.mjs';
import { officialMonthlyTicketsUrl, QIDIAN_SOURCES } from './sources.mjs';

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
  readySelector: QIDIAN_SELECTORS.entries,
  readyCount: 20,
  attempts: 3,
  restrictToCurrentPeriod: true,
  parse: (html, chart) => parseQidianRanking(html, chart).entries,
  detectChallenge: detectQidianChallenge,
  validate: ranking => validateQidianRanking(ranking),
  // Monthly Tickets has official per-period pages; the other charts are current-only.
  resolveChartUrl: (chart, period) => (chart.key === 'monthlyTickets' ? officialMonthlyTicketsUrl(period) : chart.url),
  charts
});
