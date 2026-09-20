const grid = document.querySelector('#ranking-grid');
const months = document.querySelector('#months');
const status = document.querySelector('#data-status');
const previousButton = document.querySelector('#month-prev');
const nextButton = document.querySelector('#month-next');
const sourceTabs = document.querySelectorAll('.source-tab');
const footerArchive = document.querySelector('#footer-archive');
const footerSource = document.querySelector('#footer-source');

const sources = window.RANKING_SOURCES ?? [];
const genreLabel = window.genreLabelForSource ?? ((_, category, subcategory) => [category, subcategory].filter(Boolean).join(' · '));

let activeSourceConfig = sources[0] ?? null;
let rankingOrder = activeSourceConfig?.charts.map(chart => chart.key) ?? [];
const archiveCache = new Map();

let archive = null;
let activePeriod = null;
let activeSnapshot = null;

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
  return policyLabel(policy);
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

function validateManifest(manifest, sourceId) {
  if (manifest?.schemaVersion !== 1 || manifest?.source !== sourceId || !Array.isArray(manifest.periods) || !manifest.periods.length) {
    throw new Error('The ranking manifest is unavailable or invalid.');
  }
  return manifest;
}

function validateSnapshot(snapshot, sourceId = activeSourceConfig?.id, chartKeys = rankingOrder) {
  if (snapshot?.schemaVersion !== 1 || snapshot?.source !== sourceId || !snapshot?.rankings) {
    throw new Error('The selected ranking archive is invalid.');
  }
  for (const key of chartKeys) {
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

function createRankItem(entry, ranking) {
  const item = createElement('li', 'rank-item');
  item.append(createElement('span', 'position', String(entry.rank)));
  const info = createElement('span', 'book-info');
  const genre = genreLabel(activeSourceConfig?.id, entry.category, entry.subcategory);
  info.dataset.tooltip = `Genre: ${genre}`;
  const name = createElement(entry.bookUrl ? 'a' : 'span', 'book-name', entry.title);
  if (entry.bookUrl) {
    name.href = entry.bookUrl;
    name.target = '_blank';
    name.rel = 'noreferrer';
  }
  info.append(name);
  info.append(createElement('small', 'book-author', entry.author));
  item.append(info);

  const introduction = createElement('div', 'novel-introduction');
  introduction.id = `novel-introduction-${ranking.key}-${entry.bookId}`;
  introduction.hidden = true;
  introduction.append(
    createElement('strong', '', `${entry.title} – Introduction`),
    createElement('p', '', entry.introduction || entry.description || `A ${genre || 'web novel'} by ${entry.author}.`)
  );

  const toggle = createElement('button', 'introduction-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', introduction.id);
  toggle.setAttribute('aria-label', `Show introduction for ${entry.title}`);
  toggle.title = 'Show novel introduction';
  item.append(toggle);

  const copy = createElement('button', 'copy-button', '⧉');
  copy.type = 'button';
  copy.dataset.copy = `${entry.title} + ${entry.author}`;
  copy.setAttribute('aria-label', `Copy ${entry.title} and author`);
  copy.title = 'Copy title and author';
  item.append(copy, introduction);
  return item;
}

function createCard(ranking) {
  const article = createElement('article', 'rank-card');
  const header = createElement('div', 'card-head');
  const heading = document.createElement('div');
  heading.append(createElement('h3', '', ranking.label));

  const source = createElement('a', '', '↗');
  source.href = ranking.sourceUrl;
  source.target = '_blank';
  source.rel = 'noreferrer';
  source.setAttribute('aria-label', `View ${ranking.label} on ${activeSourceConfig?.name ?? 'source'}`);
  header.append(heading, source);

  const list = createElement('ol', 'rank-list');
  ranking.entries.forEach(entry => list.append(createRankItem(entry, ranking)));

  const footer = createElement('div', 'card-footer');
  footer.append(
    createElement('span', '', `Captured ${captureLabel(ranking.capturedAt)}`),
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

async function renderSnapshot(snapshot) {
  grid.replaceChildren(...rankingOrder.map(key => createCard(snapshot.rankings[key])));
}

async function selectPeriod(period) {
  if (!archive || period === activePeriod && activeSnapshot) return;
  setStatus('');
  try {
    const entry = archive.periods.find(candidate => candidate.period === period);
    activeSnapshot = validateSnapshot(await fetchJson(`${activeSourceConfig.dataDir}/${entry.file}`));
    activePeriod = period;
    renderMonths();
    await renderSnapshot(activeSnapshot);
    setStatus('');
  } catch (error) {
    if (activeSnapshot) {
      setStatus(`Could not load ${monthLabel(period)}. Showing the last available archive.`, 'warning');
      return;
    }
    handleLoadFailure(error);
  }
}

function handleLoadFailure(error) {
  archive = null;
  activeSnapshot = null;
  activePeriod = null;
  grid.replaceChildren();
  months.replaceChildren();
  previousButton.disabled = true;
  nextButton.disabled = true;
  setStatus(`Archive unavailable. (${error.message})`, 'warning');
}

function updateSourceTabs() {
  sourceTabs.forEach(tab => {
    const isActive = tab.dataset.source === activeSourceConfig?.id;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  document.title = `Novel Ranking · ${activeSourceConfig?.name ?? 'Chinese Web-Novel'} Rankings`;
  const sourceName = activeSourceConfig?.name ?? 'Novel';
  footerArchive.textContent = `Novel Ranking · Unofficial ${sourceName} ranking archive`;
  footerSource.textContent = `Source: public rankings from ${sourceName}`;
  footerSource.href = activeSourceConfig?.homeUrl ?? '#';
  footerSource.setAttribute('aria-label', `Visit ${sourceName}`);
}

async function activateSource(sourceId) {
  const config = sources.find(source => source.id === sourceId) ?? sources[0];
  if (!config) return;
  activeSourceConfig = config;
  rankingOrder = config.charts.map(chart => chart.key);
  activeSnapshot = null;
  archive = null;
  updateSourceTabs();
  setStatus('');
  try {
    if (!archiveCache.has(config.id)) {
      archiveCache.set(config.id, validateManifest(await fetchJson(`${config.dataDir}/manifest.json`), config.id));
    }
    archive = archiveCache.get(config.id);
    activePeriod = archive.periods[0].period;
    renderMonths();
    await selectPeriod(activePeriod);
  } catch (error) {
    handleLoadFailure(error);
  }
}

async function initialise() {
  await activateSource(sources[0]?.id);
}

sourceTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activateSource(tab.dataset.source);
  });
});

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
  const introductionToggle = event.target.closest('.introduction-toggle');
  if (introductionToggle) {
    const introduction = document.getElementById(introductionToggle.getAttribute('aria-controls'));
    if (!introduction) return;
    const isExpanded = introductionToggle.getAttribute('aria-expanded') === 'true';
    introduction.hidden = isExpanded;
    introductionToggle.setAttribute('aria-expanded', String(!isExpanded));
    const title = introductionToggle.closest('.rank-item').querySelector('.book-name').textContent;
    introductionToggle.setAttribute('aria-label', `${isExpanded ? 'Show' : 'Hide'} introduction for ${title}`);
    introductionToggle.title = isExpanded ? 'Show novel introduction' : 'Hide novel introduction';
    return;
  }
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
