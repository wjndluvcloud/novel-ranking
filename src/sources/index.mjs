// Aggregated source registry. Adding a new source = add its plugin module here.
import qidian from './qidian/index.mjs';
import jinjiang from './jinjiang/index.mjs';
import zongheng from './zongheng/index.mjs';
import tomato from './tomato/index.mjs';
import faloo from './faloo/index.mjs';

// Display + full metadata for every source, in tab order.
export const SOURCES = Object.freeze([qidian, jinjiang, zongheng, tomato, faloo]);

// Fetch subset consumed by the generic collector. Qidian is excluded until its
// dedicated collector is folded into the generic runner.
export const SOURCE_FETCHERS = Object.freeze(Object.fromEntries(
  SOURCES.filter(source => typeof source.parse === 'function').map(source => [source.id, source])
));

export function getSource(id) {
  return SOURCES.find(source => source.id === id);
}
