// Backward-compatible shim. The parsers and fetch descriptors now live in
// src/sources/*.mjs; this module re-exports them so existing importers keep
// working. Prefer importing from ./sources/index.mjs in new code.
export { SOURCE_FETCHERS } from './sources/index.mjs';
export { parseJinjiang } from './sources/jinjiang.mjs';
export { parseTomato, parseTomatoBookPage } from './sources/tomato.mjs';
export { parseZongheng } from './sources/zongheng.mjs';
