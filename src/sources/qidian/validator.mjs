export class QidianValidationError extends Error {
  constructor(issues) {
    super(`Qidian ranking validation failed: ${issues.join('; ')}`);
    this.name = 'QidianValidationError';
    this.code = 'VALIDATION_FAILED';
    this.issues = issues;
  }
}

function isQidianBookUrl(value, bookId) {
  try {
    const url = new URL(value);
    const hostnameIsQidian = url.hostname === 'qidian.com' || url.hostname.endsWith('.qidian.com');
    const pathSegments = url.pathname.split('/').filter(Boolean);
    return url.protocol === 'https:'
      && hostnameIsQidian
      && pathSegments[0] === 'book'
      && pathSegments[1] === bookId;
  } catch {
    return false;
  }
}

export function validateQidianRanking(ranking, expectedCount = 20) {
  const issues = [];
  const entries = Array.isArray(ranking?.entries) ? ranking.entries : [];

  if (entries.length !== expectedCount) {
    issues.push(`expected ${expectedCount} entries, received ${entries.length}`);
  }

  const ranks = entries.map(entry => entry.rank);
  const expectedRanks = Array.from({ length: expectedCount }, (_, index) => index + 1);
  if (new Set(ranks).size !== entries.length || expectedRanks.some(rank => !ranks.includes(rank))) {
    issues.push(`ranks must be unique and cover 1-${expectedCount}`);
  }

  const bookIds = entries.map(entry => entry.bookId).filter(Boolean);
  if (new Set(bookIds).size !== entries.length) {
    issues.push('book IDs must be present and unique');
  }

  for (const entry of entries) {
    const prefix = `rank ${entry.rank ?? '?'}`;
    if (!entry.title) issues.push(`${prefix} has no title`);
    if (!entry.author) issues.push(`${prefix} has no author`);
    if (!entry.bookId) issues.push(`${prefix} has no book ID`);
    if (entry.bookId && !isQidianBookUrl(entry.bookUrl, entry.bookId)) {
      issues.push(`${prefix} has an invalid Qidian book URL`);
    }
  }

  if (issues.length) throw new QidianValidationError(issues);
  return ranking;
}
