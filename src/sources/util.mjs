// Small shared helpers for source parsers.
export function clean(value = '') {
  return value.replace(/\s+/gu, ' ').trim();
}

export function absolute(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}
