import {
  activeView,
  bossAttempts,
  duration,
  esc,
  icon,
  navigate,
  nav,
  prefs,
  root,
  savePrefs,
  scopeSelect,
  selectedScopeLabel,
  setScopeValue,
  workspace
} from './core.js';

const tinyFightValues = new Set();
let breadcrumbs = null;
let fightNav = null;
let scheduled = 0;

function currentOption() {
  return scopeSelect?.selectedOptions?.[0] || null;
}

function isBossOption(option) {
  return Boolean(option?.value?.startsWith('boss:'));
}

function currentViewButton() {
  return nav?.querySelector('[data-view][aria-current="page"]') || nav?.querySelector('[data-view].is-active') || null;
}

function currentView() {
  return currentViewButton()?.dataset.view || activeView();
}

function currentViewLabel() {
  return currentViewButton()?.querySelector('span')?.textContent?.trim()
    || document.getElementById('workspace-title')?.textContent?.trim()
    || 'Summary';
}

function visibleFightOptions() {
  if (!scopeSelect) return [];
  return Array.from(scopeSelect.options).filter(option => {
    if (option.value === 'session') return false;
    if (prefs.bossesOnly && !isBossOption(option)) return false;
    if (prefs.hideTiny && tinyFightValues.has(option.value)) return false;
    return true;
  });
}

function currentFightIndex(options = visibleFightOptions()) {
  return options.findIndex(option => option.value === scopeSelect?.value);
}

function goFight(delta) {
  const options = visibleFightOptions();
  if (!options.length) return;
  const index = currentFightIndex(options);
  const targetIndex = index < 0 ? (delta > 0 ? 0 : options.length - 1) : index + delta;
  const target = options[targetIndex];
  if (target) setScopeValue(target.value);
}

function allFights() {
  prefs.bossesOnly = false;
  prefs.hideTiny = false;
  savePrefs();
  syncFightNav();
  revealFightRows();
}

function toggleBossesOnly() {
  prefs.bossesOnly = !prefs.bossesOnly;
  savePrefs();
  const options = visibleFightOptions();
  if (prefs.bossesOnly && currentOption() && !isBossOption(currentOption())) {
    const first = options[0];
    if (first) setScopeValue(first.value);
  }
  syncFightNav();
  revealFightRows();
}

function toggleTiny() {
  prefs.hideTiny = !prefs.hideTiny;
  savePrefs();
  syncFightNav();
  revealFightRows();
}

function ensureBreadcrumbs() {
  if (!workspace || workspace.hidden) return null;
  breadcrumbs = workspace.querySelector('.qol-breadcrumbs');
  if (breadcrumbs) return breadcrumbs;
  const head = workspace.querySelector('.workspace-head');
  if (!head) return null;
  breadcrumbs = document.createElement('nav');
  breadcrumbs.className = 'qol-breadcrumbs';
  breadcrumbs.setAttribute('aria-label', 'Breadcrumb');
  head.insertAdjacentElement('afterend', breadcrumbs);
  breadcrumbs.addEventListener('click', event => {
    const action = event.target.closest('[data-qol-crumb]')?.dataset.qolCrumb;
    if (action === 'summary') navigate('overview');
    else if (action === 'scope') navigate(currentOption() && isBossOption(currentOption()) ? 'boss' : 'encounters');
    else if (action === 'player') navigate('players');
  });
  return breadcrumbs;
}

function syncBreadcrumbs() {
  const host = ensureBreadcrumbs();
  if (!host) return;
  const view = currentView();
  const items = ['<button type="button" data-qol-crumb="summary">Summary</button>'];
  const section = currentViewLabel();
  const scopeLabel = selectedScopeLabel();
  const selectedPlayer = document.getElementById('player-select')?.selectedOptions?.[0]?.textContent?.trim() || '';

  if (view !== 'overview') {
    items.push('<span class="qol-breadcrumb-sep" aria-hidden="true">›</span>');
    items.push(`<span data-qol-section>${esc(section)}</span>`);
  }
  if (scopeSelect?.value && scopeSelect.value !== 'session') {
    items.push('<span class="qol-breadcrumb-sep" aria-hidden="true">›</span>');
    items.push(`<button type="button" data-qol-crumb="scope">${esc(scopeLabel)}</button>`);
  }
  if (selectedPlayer && ['players','powers','events','boss','comparison','rotation'].includes(view)) {
    items.push('<span class="qol-breadcrumb-sep" aria-hidden="true">›</span>');
    items.push(`<button type="button" data-qol-crumb="player">${esc(selectedPlayer)}</button>`);
  }

  const lastIndex = items.length - 1;
  const last = items[lastIndex] || '';
  if (last.includes('<button')) items[lastIndex] = last.replace('<button ', '<button aria-current="page" ');
  else if (last.includes('<span')) items[lastIndex] = last.replace('<span ', '<span aria-current="page" ');
  host.innerHTML = items.join('');
}

function ensureFightNav() {
  const toolbar = workspace?.querySelector('.analysis-toolbar');
  if (!toolbar || workspace.hidden) return null;
  fightNav = toolbar.querySelector('.qol-fight-nav');
  if (fightNav) return fightNav;
  fightNav = document.createElement('div');
  fightNav.className = 'qol-fight-nav';
  fightNav.innerHTML = `
    <div class="qol-fight-nav-main" aria-label="Fight navigation">
      <button class="qol-icon-button" type="button" data-qol-prev title="Previous fight" aria-label="Previous fight">${icon('chevronLeft')}</button>
      <button class="qol-icon-button" type="button" data-qol-next title="Next fight" aria-label="Next fight">${icon('chevronRight')}</button>
      <button class="qol-action-button" type="button" data-qol-all>All fights</button>
      <button class="qol-action-button qol-filter-toggle" type="button" data-qol-bosses aria-pressed="false">${icon('filter')}<span>Bosses only</span></button>
      <button class="qol-action-button qol-filter-toggle" type="button" data-qol-tiny aria-pressed="false">Hide tiny fights</button>
      <button class="qol-action-button" type="button" data-qol-attempt hidden>${icon('compare')}<span>Compare attempts</span></button>
    </div>
    <span class="qol-fight-nav-status" data-qol-fight-status>Full session</span>`;
  toolbar.append(fightNav);
  fightNav.querySelector('[data-qol-prev]')?.addEventListener('click', () => goFight(-1));
  fightNav.querySelector('[data-qol-next]')?.addEventListener('click', () => goFight(1));
  fightNav.querySelector('[data-qol-all]')?.addEventListener('click', allFights);
  fightNav.querySelector('[data-qol-bosses]')?.addEventListener('click', toggleBossesOnly);
  fightNav.querySelector('[data-qol-tiny]')?.addEventListener('click', toggleTiny);
  fightNav.querySelector('[data-qol-attempt]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('strikeglass:qol-attempt-compare'));
  });
  return fightNav;
}

function syncFightNav() {
  const host = ensureFightNav();
  if (!host || !scopeSelect) return;
  const options = visibleFightOptions();
  const index = currentFightIndex(options);
  const prev = host.querySelector('[data-qol-prev]');
  const next = host.querySelector('[data-qol-next]');
  if (prev) prev.disabled = !options.length || index === 0;
  if (next) next.disabled = !options.length || index === options.length - 1;
  const bosses = host.querySelector('[data-qol-bosses]');
  const tiny = host.querySelector('[data-qol-tiny]');
  bosses?.setAttribute('aria-pressed', String(prefs.bossesOnly));
  tiny?.setAttribute('aria-pressed', String(prefs.hideTiny));
  const status = host.querySelector('[data-qol-fight-status]');
  if (status) status.textContent = scopeSelect.value === 'session'
    ? `Full session · ${options.length} fight${options.length === 1 ? '' : 's'}`
    : `${Math.max(1, index + 1)} of ${options.length} · ${selectedScopeLabel()}`;
  const attempt = host.querySelector('[data-qol-attempt]');
  if (attempt) attempt.hidden = !isBossOption(currentOption()) || bossAttempts().length < 2;
}

function collectTinyFights() {
  if (currentView() !== 'encounters' || !root) return;
  root.querySelectorAll('tr[data-scope]').forEach(row => {
    const cells = row.cells;
    const durationText = cells?.[4]?.textContent || '';
    const hitsText = cells?.[6]?.querySelector('.compact-number')?.getAttribute('title') || cells?.[6]?.textContent || '';
    const hits = Number(String(hitsText).replace(/[^0-9.-]/g, '')) || 0;
    const zeroDuration = /^\s*(?:0(?:\.0)?s|0m\s+00s)\s*$/i.test(durationText.trim());
    if (hits <= 1 || zeroDuration) tinyFightValues.add(row.dataset.scope);
  });
}

function revealFightRows() {
  if (currentView() !== 'encounters' || !root) return;
  root.querySelectorAll('tr[data-scope]').forEach(row => {
    const boss = String(row.dataset.scope || '').startsWith('boss:');
    const hidden = (prefs.bossesOnly && !boss) || (prefs.hideTiny && tinyFightValues.has(row.dataset.scope));
    row.hidden = hidden;
  });
}

function scheduleSync() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    collectTinyFights();
    revealFightRows();
    syncBreadcrumbs();
    syncFightNav();
  });
}

scopeSelect?.addEventListener('change', scheduleSync);
document.getElementById('player-select')?.addEventListener('change', scheduleSync);
nav?.addEventListener('click', scheduleSync);
new MutationObserver(scheduleSync).observe(root || document.body, { childList: true, subtree: false });
new MutationObserver(scheduleSync).observe(workspace || document.body, { attributes: true, attributeFilter: ['hidden'] });

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
  if (document.querySelector('[role="dialog"]')) return;
  if (event.key.toLowerCase() === 'j') {
    event.preventDefault();
    goFight(1);
  } else if (event.key.toLowerCase() === 'k') {
    event.preventDefault();
    goFight(-1);
  }
});

window.addEventListener('strikeglass:qol-prev-fight', () => goFight(-1));
window.addEventListener('strikeglass:qol-next-fight', () => goFight(1));
window.addEventListener('strikeglass:qol-all-fights', allFights);

scheduleSync();
