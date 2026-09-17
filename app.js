const grid = document.querySelector('#ranking-grid');
const months = document.querySelector('#months');
const status = document.querySelector('#data-status');
const previousButton = document.querySelector('#month-prev');
const nextButton = document.querySelector('#month-next');

const rankingOrder = ['monthlyTickets', 'bestSellers', 'readerRetention', 'mostFollowed'];
const fallbackSnapshot = window.QIDIAN_FALLBACK_SNAPSHOT;
const genreLabel = window.qidianGenreLabel ?? ((category, subcategory) => [category, subcategory].filter(Boolean).join(' · '));

let archive = null;
let activePeriod = null;
let activeSnapshot = null;
let showingFallback = false;

function monthLabel(period) {
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function captureLabel(capturedAt) {
  if (!capturedAt) return 'Capture time unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' })
    .format(new Date(capturedAt));
}

function policyLabel(policy) {
  if (policy === 'initial-baseline') return 'Initial baseline archive';
  return policy === 'official-month' ? 'Official monthly chart' : 'Month-end snapshot';
}

function displayPolicy(policy) {
  return showingFallback ? 'Verified fallback capture' : policyLabel(policy);
}

function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = `data-status ${kind}`.trim();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest?.source !== 'qidian' || !Array.isArray(manifest.periods) || !manifest.periods.length) {
    throw new Error('The ranking manifest is unavailable or invalid.');
  }
  return manifest;
}

function validateSnapshot(snapshot) {
  if (snapshot?.schemaVersion !== 1 || snapshot?.source !== 'qidian' || !snapshot?.rankings) {
    throw new Error('The selected ranking archive is invalid.');
  }
  for (const key of rankingOrder) {
    const ranking = snapshot.rankings[key];
    if (!ranking || !Array.isArray(ranking.entries) || ranking.entries.length !== 20) {
      throw new Error(`The ${key} archive is incomplete.`);
    }
  }
  return snapshot;
}

function createElement(name, className, text) {
  const element = document.createElement(name);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function movementFor(entry, ranking, priorSnapshot) {
  const priorEntries = priorSnapshot?.rankings?.[ranking.key]?.entries;
  const prior = priorEntries?.find(candidate => candidate.bookId === entry.bookId);
  const trend = createElement('span', 'trend same', '—');
  if (!prior) return trend;
  const change = prior.rank - entry.rank;
  if (change > 0) {
    trend.className = 'trend up';
    trend.textContent = `↑${change}`;
  } else if (change < 0) {
    trend.className = 'trend down';
    trend.textContent = `↓${Math.abs(change)}`;
  }
  return trend;
}

function createRankItem(entry, ranking, priorSnapshot) {
  const item = createElement('li', 'rank-item');
  item.append(createElement('span', 'position', String(entry.rank)));
  const info = createElement('span', 'book-info');
  const genre = genreLabel(entry.category, entry.subcategory);
  info.dataset.tooltip = `Genre: ${genre}`;
  info.title = `Genre: ${genre}\nSource: ${[entry.category, entry.subcategory].filter(Boolean).join(' · ')}`;
  info.append(createElement('span', 'book-name', entry.title));
  info.append(createElement('small', 'book-author', entry.author));
  item.append(info, movementFor(entry, ranking, priorSnapshot));

  const copy = createElement('button', 'copy-button', '⧉');
  copy.type = 'button';
  copy.dataset.copy = `${entry.title} + ${entry.author}`;
  copy.setAttribute('aria-label', `Copy ${entry.title} and author`);
  copy.title = 'Copy title and author';
  item.append(copy);
  return item;
}

function createCard(ranking, priorSnapshot) {
  const article = createElement('article', 'rank-card');
  const header = createElement('div', 'card-head');
  const heading = document.createElement('div');
  heading.append(createElement('h3', '', ranking.label));
  heading.append(createElement('p', '', `${ranking.chineseLabel} · TOP 20 · ${displayPolicy(ranking.snapshotPolicy)}`));

  const source = createElement('a', '', '↗');
  source.href = ranking.sourceUrl;
  source.target = '_blank';
  source.rel = 'noreferrer';
  source.setAttribute('aria-label', `View ${ranking.label} on Qidian`);
  header.append(heading, source);

  const list = createElement('ol', 'rank-list');
  ranking.entries.forEach(entry => list.append(createRankItem(entry, ranking, priorSnapshot)));

  const footer = createElement('div', 'card-footer');
  footer.append(
    createElement('span', '', priorSnapshot ? 'Change from previous archive' : `Captured ${captureLabel(ranking.capturedAt)}`),
    createElement('span', 'capture-policy', displayPolicy(ranking.snapshotPolicy))
  );
  article.append(header, list, footer);
  return article;
}

function renderMonths() {
  months.replaceChildren();
  const periods = archive?.periods ?? [{ period: activePeriod }];
  periods.forEach(({ period }) => {
    const button = createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.dataset.month = period;
    button.setAttribute('aria-selected', String(period === activePeriod));
    button.classList.toggle('active', period === activePeriod);
    const [year] = period.split('-');
    button.append(createElement('span', '', monthLabel(period).replace(` ${year}`, '')), createElement('small', '', year));
    button.addEventListener('click', () => selectPeriod(period));
    months.append(button);
  });
  const index = archive?.periods.findIndex(entry => entry.period === activePeriod) ?? -1;
  previousButton.disabled = !archive || index === archive.periods.length - 1;
  nextButton.disabled = !archive || index === 0;
}

async function priorSnapshotFor(period) {
  if (!archive) return null;
  const index = archive.periods.findIndex(entry => entry.period === period);
  const prior = archive.periods[index + 1];
  if (!prior) return null;
  try {
    return validateSnapshot(await fetchJson(`data/${prior.file}`));
  } catch {
    return null;
  }
}

async function renderSnapshot(snapshot) {
  const priorSnapshot = showingFallback ? null : await priorSnapshotFor(snapshot.period);
  grid.replaceChildren(...rankingOrder.map(key => createCard(snapshot.rankings[key], priorSnapshot)));
}

async function selectPeriod(period) {
  if (!archive || period === activePeriod && activeSnapshot) return;
  setStatus(`Loading ${monthLabel(period)}…`);
  try {
    const entry = archive.periods.find(candidate => candidate.period === period);
    activeSnapshot = validateSnapshot(await fetchJson(`data/${entry.file}`));
    activePeriod = period;
    showingFallback = false;
    renderMonths();
    await renderSnapshot(activeSnapshot);
    setStatus(`${monthLabel(period)} archive · ${activeSnapshot.rankings.monthlyTickets.entries.length} records per chart`, 'ready');
  } catch (error) {
    if (activeSnapshot) {
      setStatus(`Could not load ${monthLabel(period)}. Showing the last available archive.`, 'warning');
      return;
    }
    showFallback(`Archive unavailable. Showing the verified fallback capture. (${error.message})`);
  }
}

function showFallback(message) {
  showingFallback = true;
  archive = null;
  activeSnapshot = validateSnapshot(fallbackSnapshot);
  activePeriod = activeSnapshot.period;
  renderMonths();
  renderSnapshot(activeSnapshot);
  setStatus(message, 'warning');
}

async function initialise() {
  try {
    archive = validateManifest(await fetchJson('data/manifest.json'));
    activePeriod = archive.periods[0].period;
    renderMonths();
    await selectPeriod(activePeriod);
  } catch (error) {
    showFallback(`Archive unavailable. Showing the verified fallback capture. (${error.message})`);
  }
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

previousButton.addEventListener('click', () => {
  const index = archive?.periods.findIndex(entry => entry.period === activePeriod) ?? -1;
  if (index >= 0 && index < archive.periods.length - 1) selectPeriod(archive.periods[index + 1].period);
});

nextButton.addEventListener('click', () => {
  const index = archive?.periods.findIndex(entry => entry.period === activePeriod) ?? -1;
  if (index > 0) selectPeriod(archive.periods[index - 1].period);
});

grid.addEventListener('click', async event => {
  const button = event.target.closest('.copy-button');
  if (!button) return;
  try {
    await copyText(button.dataset.copy);
    button.textContent = '✓';
    button.classList.add('copied');
    button.setAttribute('aria-label', 'Copied');
    window.setTimeout(() => {
      button.textContent = '⧉';
      button.classList.remove('copied');
      button.setAttribute('aria-label', 'Copy title and author');
    }, 1200);
  } catch {
    button.textContent = '!';
    window.setTimeout(() => { button.textContent = '⧉'; }, 1200);
  }
});

initialise();
