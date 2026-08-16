import { workerRequest } from '../v3/power-popup/worker.js';
import { registerRouteEnhancer } from '../v28/route-lifecycle.js';

const root = document.getElementById('view-root');
const nav = document.getElementById('app-nav');
const scopeSelect = document.getElementById('encounter-select');
const DASHBOARD_KEY = 'strikeglass.dashboard.v1';
const MIGRATION_KEY = 'strikeglass.overview-layout.v20';
const DESIRED_LAYOUT = [
  { id: 'party-summary', visible: true, size: 'medium', order: 0 },
  { id: 'party-overview', visible: true, size: 'full', order: 1 },
  { id: 'timeline', visible: true, size: 'large', order: 2 },
  { id: 'encounters', visible: true, size: 'medium', order: 3 },
  { id: 'selected-player', visible: true, size: 'medium', order: 4 },
  { id: 'top-powers', visible: true, size: 'large', order: 5 }
];

let diagnosticsPromise = null;
let diagnosticsSummary = null;
let syncToken = 0;

function activeView() {
  return nav?.querySelector('[data-view].is-active')?.dataset.view || '';
}

function navigate(view) {
  const button = nav?.querySelector(`[data-view="${CSS.escape(view)}"]`);
  if (button && !button.disabled) button.click();
}

function migrateDashboardLayout({ create = false } = {}) {
  let parsed = null;
  try { parsed = JSON.parse(localStorage.getItem(DASHBOARD_KEY) || 'null'); } catch {}
  if (!parsed?.widgets?.length && !create) return;
  if (localStorage.getItem(MIGRATION_KEY) === '1' && parsed?.widgets?.length) return;

  const previous = new Map((parsed?.widgets || []).map(item => [item?.id, item]));
  const migrated = DESIRED_LAYOUT.map(item => ({
    ...item,
    visible: previous.has(item.id) ? previous.get(item.id)?.visible !== false : item.visible
  }));
  try {
    localStorage.setItem(DASHBOARD_KEY, JSON.stringify({ version: 1, widgets: migrated }));
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    // Dashboard persistence is optional. The compact raw Overview still works.
  }
}

async function getDiagnosticsSummary() {
  if (diagnosticsSummary) return diagnosticsSummary;
  if (diagnosticsPromise) return diagnosticsPromise;
  diagnosticsPromise = workerRequest('diagnostics', {}, 12000)
    .then(message => {
      diagnosticsSummary = message?.summary || null;
      return diagnosticsSummary;
    })
    .catch(() => null)
    .finally(() => { diagnosticsPromise = null; });
  return diagnosticsPromise;
}

function formatTime(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function duration(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`;
  if (minutes) return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
  return `${Math.round(seconds)}s`;
}

function compactNumber(value) {
  const number = Number(value) || 0;
  const absolute = Math.abs(number);
  if (absolute >= 1e9) return `${(number / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (absolute >= 1e6) return `${(number / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (absolute >= 1e3) return `${(number / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return new Intl.NumberFormat().format(Math.round(number));
}

function selectScope(value) {
  if (!scopeSelect) return;
  const option = Array.from(scopeSelect.options).find(item => item.value === value);
  if (!option) return;
  scopeSelect.value = value;
  scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

function ensureFooter(container, key, copy, actionLabel, view) {
  if (!container) return;
  const existing = container.querySelector(`[data-sg-overview-footer="${CSS.escape(key)}"]`);
  if (existing) {
    existing.querySelector('span')?.replaceChildren(copy);
    const button = existing.querySelector('button');
    if (button) button.textContent = actionLabel;
    return;
  }
  const footer = document.createElement('div');
  footer.className = 'sg-overview-footer';
  footer.dataset.sgOverviewFooter = key;
  const copyNode = document.createElement('span');
  copyNode.textContent = copy;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = actionLabel;
  button.addEventListener('click', () => navigate(view));
  footer.append(copyNode, button);
  container.append(footer);
}

function compactPlayerTable() {
  const rawPanel = Array.from(root?.querySelectorAll(':scope > .panel') || []).find(panel =>
    panel.querySelector('.panel-head .eyebrow')?.textContent?.trim().toLowerCase() === 'party overview'
  );
  const container = root?.querySelector('.v6-widget[data-widget-id="party-overview"] .v6-widget-content') || rawPanel;
  if (!container) return;
  rawPanel?.classList.add('sg-overview-party');
  const rows = Array.from(container.querySelectorAll('tbody tr'));
  rows.forEach((row, index) => { row.hidden = index >= 10; });
  if (rows.length > 10) ensureFooter(container, 'players', `Showing the top 10 of ${rows.length} players.`, 'View all players', 'players');
}

function compactSelectedPlayer() {
  const rawPanel = root?.querySelector(':scope > .player-overview-panel');
  const metricsHost = root?.querySelector('.v6-widget[data-widget-id="selected-player"] .reference-metrics') || rawPanel?.querySelector('.reference-metrics');
  if (metricsHost) {
    const cards = Array.from(metricsHost.querySelectorAll(':scope > .metric-card'));
    cards.forEach((card, index) => { card.hidden = index >= 8; });
    const wrapper = root?.querySelector('.v6-widget[data-widget-id="selected-player"] .v6-widget-content') || rawPanel;
    if (cards.length > 8) ensureFooter(wrapper, 'player-metrics', 'Eight core player metrics shown.', 'Open Players', 'players');
  }

  const powersHost = root?.querySelector('.v6-widget[data-widget-id="top-powers"] .v6-widget-content') || rawPanel?.querySelector('.panel-subsection');
  if (powersHost) {
    const rows = Array.from(powersHost.querySelectorAll('.analysis-bar-row'));
    rows.forEach((row, index) => { row.hidden = index >= 6; });
    if (rows.length > 6) ensureFooter(powersHost, 'powers', `Top 6 of ${rows.length} damaging powers shown.`, 'Damage & Powers', 'powers');
  }
}

function bossEncountersFromSelect() {
  if (!scopeSelect) return [];
  return Array.from(scopeSelect.options)
    .filter(option => String(option.value || '').startsWith('boss:'))
    .map(option => {
      const id = Number(String(option.value).split(':')[1]);
      const label = String(option.textContent || '').replace(/^Boss\s+\d+\s*[·-]?\s*/i, '').trim();
      return { id, type: 'boss', label: label || `Boss ${id}`, fallback: true };
    })
    .filter(encounter => Number.isFinite(encounter.id));
}

function createBossCard(encounter) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'encounter-chip boss';
  button.dataset.scope = `boss:${Number(encounter.id)}`;
  const meta = document.createElement('span');
  meta.textContent = encounter.fallback ? `Boss ${Number(encounter.id)}` : `Boss ${Number(encounter.id)} · ${formatTime(encounter.start)}`;
  const title = document.createElement('strong');
  title.textContent = encounter.label || `Boss ${Number(encounter.id)}`;
  const detail = document.createElement('small');
  detail.textContent = encounter.fallback ? 'Open verified boss scope' : `${duration(encounter.duration)} · ${compactNumber(encounter.damage)} damage`;
  button.append(meta, title, detail);
  button.addEventListener('click', event => {
    event.preventDefault();
    selectScope(button.dataset.scope);
  });
  return button;
}

async function compactFights(localToken) {
  const widget = root?.querySelector('.v6-widget[data-widget-id="encounters"]');
  const panel = widget?.querySelector('.panel') || Array.from(root?.querySelectorAll('.overview-grid > .panel') || []).find(item => item.querySelector('.encounter-strip'));
  const strip = panel?.querySelector('.encounter-strip');
  if (!panel || !strip) return;

  const existingCards = Array.from(strip.querySelectorAll('.encounter-chip'));
  existingCards.forEach(card => { card.hidden = !card.classList.contains('boss'); });

  const summary = await getDiagnosticsSummary();
  if (localToken !== syncToken || !strip.isConnected || activeView() !== 'overview') return;
  const encounters = Array.isArray(summary?.encounters) ? summary.encounters : [];
  const bosses = encounters.length ? encounters.filter(encounter => encounter?.type === 'boss') : bossEncountersFromSelect();
  const knownBossIds = new Set(Array.from(strip.querySelectorAll('.encounter-chip.boss')).map(card => Number(String(card.dataset.scope || '').split(':')[1])));
  for (const encounter of bosses) {
    if (knownBossIds.has(Number(encounter.id))) continue;
    strip.append(createBossCard(encounter));
    knownBossIds.add(Number(encounter.id));
  }

  const totalFightCount = encounters.length || Math.max(0, Number(scopeSelect?.options?.length || 1) - 1) || existingCards.length;
  const bossCount = bosses.length || strip.querySelectorAll('.encounter-chip.boss').length;
  const panelHead = panel.querySelector('.panel-head');
  const eyebrow = panelHead?.querySelector('.eyebrow');
  const heading = panelHead?.querySelector('h2');
  const count = panelHead?.querySelector(':scope > span');
  if (eyebrow) eyebrow.textContent = 'Detected bosses';
  if (heading) heading.textContent = 'Boss fights';
  if (count) count.textContent = `${bossCount} bosses · ${Math.max(0, totalFightCount)} fights`;

  const widgetTitle = widget?.querySelector('.v6-widget-title strong');
  const widgetSubtitle = widget?.querySelector('.v6-widget-title span');
  if (widgetTitle) widgetTitle.textContent = 'Boss fights';
  if (widgetSubtitle) widgetSubtitle.textContent = 'Boss shortcuts; every combat window remains in All Fights.';

  ensureFooter(panel, 'fights', `${bossCount} boss fights shown; ${Math.max(0, totalFightCount)} combat windows detected.`, `All ${Math.max(0, totalFightCount)} fights`, 'encounters');
}

function placeSummaryBand() {
  const grid = root?.querySelector('.v6-dashboard-grid');
  const insights = root?.querySelector(':scope > .qol-matters');
  if (!grid || !insights || insights.parentElement === grid) return;
  grid.insertBefore(insights, grid.firstElementChild);
}

function cleanDashboardChrome() {
  const grid = root?.querySelector('.v6-dashboard-grid');
  if (!grid) return;
  root?.querySelector(':scope > .verification-strip [data-dashboard-customize]')?.setAttribute('hidden', '');
  placeSummaryBand();
}

function enhanceOverview(localToken) {
  if (!root || activeView() !== 'overview') return;
  root.classList.add('sg-overview');
  root.dataset.sgView = 'overview';
  compactPlayerTable();
  compactSelectedPlayer();
  cleanDashboardChrome();
  void compactFights(localToken);
}

function syncView(view = activeView()) {
  if (!root) return;
  syncToken += 1;
  const localToken = syncToken;
  const current = view || activeView();
  root.dataset.sgView = current;
  root.classList.toggle('sg-overview', current === 'overview');
  if (current !== 'overview') return;
  let attempts = 0;
  const tick = () => {
    if (localToken !== syncToken || activeView() !== 'overview') return;
    enhanceOverview(localToken);
    attempts += 1;
    if (attempts < 12) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

root?.addEventListener('click', event => {
  if (!event.target.closest('[data-dashboard-customize]')) return;
  migrateDashboardLayout({ create: true });
}, true);

registerRouteEnhancer('overview-layout', ({ view, reasons }) => {
  if (reasons.includes('analysis-ready') || reasons.includes('worker-ready')) {
    diagnosticsPromise = null;
    diagnosticsSummary = null;
  }
  if (reasons.includes('dashboard-ready')) {
    syncView('overview');
    return;
  }
  if (reasons.some(reason => reason === 'view-rendered' || reason === 'analysis-ready' || reason.startsWith('register:'))) {
    syncView(view || activeView());
  }
});

migrateDashboardLayout();
syncView();
