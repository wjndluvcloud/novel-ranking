// Aggregated source registry. Adding a new source = add its plugin module here.
import qidian from './qidian.mjs';
import jinjiang from './jinjiang.mjs';
import zongheng from './zongheng.mjs';
import tomato from './tomato.mjs';

// Display + full metadata for every source, in tab order.
export const SOURCES = Object.freeze([qidian, jinjiang, zongheng, tomato]);

// Fetch subset consumed by the generic collector. Qidian is excluded until its
// dedicated collector is folded into the generic runner.
export const SOURCE_FETCHERS = Object.freeze(Object.fromEntries(
  SOURCES.filter(source => typeof source.parse === 'function').map(source => [source.id, source])
));

export function getSource(id) {
  return SOURCES.find(source => source.id === id);
}
