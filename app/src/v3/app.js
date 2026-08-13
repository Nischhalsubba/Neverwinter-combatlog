import { startAmbient, stopAmbient } from './ambient.js';
import { revealCards, revealView, warmMotion } from './motion.js';
import { destroyChart, renderTimelineChart, warmCharts } from './charts.js';

const worker = new Worker(new URL('../workers/fast-parse-worker.js', import.meta.url), { type: 'module' });
const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const df = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const el = {
  ambient: $('ambient-root'),
  empty: $('empty-state'),
  parse: $('parse-state'),
  workspace: $('workspace'),
  file: $('file-input'),
  open: $('open-file'),
  replace: $('replace-file'),
  drop: $('drop-zone'),
  overlay: $('drop-overlay'),
  cancel: $('cancel-parse'),
  status: $('topbar-status'),
  topbarFile: $('topbar-file'),
  nav: $('app-nav'),
  root: $('view-root'),
  player: $('player-select'),
  scope: $('encounter-select'),
  bossTargetField: $('boss-target-field'),
  bossTargetOnly: $('boss-target-only'),
  title: $('workspace-title'),
  eye: $('file-eyebrow'),
  scopeLabel: $('scope-label'),
  toast: $('toast-region'),
  bar: $('progress-bar'),
  read: $('parse-read'),
  lines: $('parse-lines'),
  parsed: $('parse-parsed'),
  rejected: $('parse-rejected'),
  elapsed: $('parse-elapsed'),
  fileName: $('parse-file-name'),
  phase: $('parse-phase'),
  partial: $('partial-list')
};

const state = {
  view: 'overview',
  summary: null,
  scope: { type: 'session', id: null, targetOnly: false },
  playerRef: '',
  compareRefs: [],
  report: null,
  reportKey: '',
  rawRows: [],
  rawNext: null,
  rawLoading: false,
  rawPlayerRef: '',
  rawKind: ''
};

let seq = 0;
const pending = new Map();

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const num = value => nf.format(Number(value) || 0);
const compact = value => {
  const n = Number(value) || 0;
  const a = Math.abs(n);
  if (a >= 1e9) return `${df.format(n / 1e9)}B`;
  if (a >= 1e6) return `${df.format(n / 1e6)}M`;
  if (a >= 1e3) return `${df.format(n / 1e3)}K`;
  return num(n);
};
const compactHtml = value => `<span class="compact-number" title="${esc(num(value))}">${compact(value)}</span>`;
const pct = value => `${df.format(Number(value) || 0)}%`;
const bytes = value => {
  const n = Number(value) || 0;
  if (n >= 1073741824) return `${df.format(n / 1073741824)} GB`;
  if (n >= 1048576) return `${df.format(n / 1048576)} MB`;
  if (n >= 1024) return `${df.format(n / 1024)} KB`;
  return `${num(n)} B`;
};
const dur = value => {
  const n = Math.max(0, Number(value) || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  if (h) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  if (m) return `${m}m ${String(s).padStart(2,'0')}s`;
  return `${df.format(n)}s`;
};
const timeAt = value => {
  const n = Math.max(0, Number(value) || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

function toast(text, tone = 'info') {
  el.toast.innerHTML = `<div class="toast ${tone}">${esc(text)}</div>`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.toast.innerHTML = ''; }, 4200);
}

function status(text, tone = 'idle') {
  el.status.dataset.tone = tone;
  el.status.innerHTML = `<span class="status-dot"></span><span>${esc(text)}</span>`;
}

function mode(name) {
  el.empty.hidden = name !== 'empty';
  el.parse.hidden = name !== 'parsing';
  el.workspace.hidden = name !== 'workspace';
  if (name === 'empty') startAmbient(el.ambient);
  else stopAmbient();
}

function request(type, payload = {}) {
  const requestId = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ type, requestId, ...payload });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error(`${type} timed out`));
    }, 45000);
  });
}

function settle(message) {
  const item = pending.get(message.requestId);
  if (!item) return false;
  pending.delete(message.requestId);
  if (message.error) item.reject(new Error(message.error));
  else if ('report' in message) item.resolve(message.report);
  else if ('page' in message) item.resolve(message.page);
  else if ('summary' in message) item.resolve(message.summary);
  else item.resolve(message);
  return true;
}

function clearCharts() {
  el.root.querySelectorAll('[data-chart]').forEach(node => destroyChart(node));
}

function replaceRoot(html) {
  clearCharts();
  el.root.innerHTML = html;
}

function enableNav(enabled) {
  el.nav.querySelectorAll('[data-view]').forEach(button => {
    button.disabled = !enabled && button.dataset.view !== 'overview';
  });
}

function viewTitle(view) {
  return ({
    overview: 'Session overview',
    comparison: 'Player comparison',
    boss: 'Boss analysis',
    encounters: 'Encounters',
    players: 'Party performance',
    powers: 'Power analysis',
    events: 'Event explorer',
    diagnostics: 'Parser diagnostics'
  })[view] || 'Combat analysis';
}

function setView(view) {
  state.view = view;
  el.nav.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  el.title.textContent = viewTitle(view);
}

function scopeKey(scope = state.scope) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${Number(scope.id)}:${scope.targetOnly ? 'target' : 'window'}`;
}

function currentScopeForWorker() {
  if (state.scope.type === 'session') return { type: 'session' };
  return { type: state.scope.type, id: Number(state.scope.id), targetOnly: state.scope.type === 'boss' && Boolean(state.scope.targetOnly) };
}

function encounterById(id) {
  return (state.summary?.encounters || []).find(encounter => Number(encounter.id) === Number(id));
}

function scopeName(scope = state.scope) {
  if (!scope || scope.type === 'session') return 'Full session';
  const encounter = encounterById(scope.id);
  if (!encounter) return 'Unknown scope';
  const prefix = scope.type === 'boss' ? 'Boss' : 'Encounter';
  const suffix = scope.type === 'boss' && scope.targetOnly ? ' · target only' : '';
  return `${prefix} ${encounter.id} · ${encounter.label}${suffix}`;
}

function fillScopeControl() {
  const encounters = state.summary?.encounters || [];
  const options = ['<option value="session">Full session</option>'];
  for (const encounter of encounters) {
    const type = encounter.type === 'boss' ? 'boss' : 'encounter';
    const prefix = encounter.type === 'boss' ? 'Boss' : 'Encounter';
    options.push(`<option value="${type}:${encounter.id}">${esc(`${prefix} ${encounter.id} · ${encounter.label}`)}</option>`);
  }
  el.scope.innerHTML = options.join('');
  const value = state.scope.type === 'session' ? 'session' : `${state.scope.type}:${state.scope.id}`;
  el.scope.value = value;
}

function fillPlayerControl(players = state.summary?.players || []) {
  if (!players.length) {
    el.player.innerHTML = '<option value="">No player detected</option>';
    el.player.disabled = true;
    return;
  }
  el.player.disabled = false;
  if (!state.playerRef || !players.some(player => player.ref === state.playerRef)) state.playerRef = players[0].ref;
  el.player.innerHTML = players.map(player => `<option value="${esc(player.ref)}" ${player.ref === state.playerRef ? 'selected' : ''}>${esc(player.name)}</option>`).join('');
}

function updateScopeControls() {
  const boss = state.scope.type === 'boss';
  el.bossTargetField.hidden = !boss;
  el.bossTargetOnly.checked = boss && Boolean(state.scope.targetOnly);
  el.scopeLabel.textContent = scopeName();
  const value = state.scope.type === 'session' ? 'session' : `${state.scope.type}:${state.scope.id}`;
  if (el.scope.value !== value) el.scope.value = value;
}

function resetScopedData() {
  state.report = null;
  state.reportKey = '';
  state.rawRows = [];
  state.rawNext = null;
}

function setScope(scope, { renderNow = true } = {}) {
  state.scope = scope?.type === 'session' ? { type: 'session', id: null, targetOnly: false } : {
    type: scope.type,
    id: Number(scope.id),
    targetOnly: scope.type === 'boss' && Boolean(scope.targetOnly)
  };
  resetScopedData();
  updateScopeControls();
  if (renderNow) render();
}

function parseScopeValue(value) {
  if (!value || value === 'session') return { type: 'session', id: null, targetOnly: false };
  const [type, idText] = value.split(':');
  const id = Number(idText);
  return { type: type === 'boss' ? 'boss' : 'encounter', id, targetOnly: type === 'boss' && Boolean(el.bossTargetOnly.checked) };
}

function ensureBossScope() {
  if (state.scope.type === 'boss' && encounterById(state.scope.id)?.type === 'boss') return true;
  const boss = (state.summary?.encounters || []).find(encounter => encounter.type === 'boss');
  if (!boss) return false;
  state.scope = { type: 'boss', id: boss.id, targetOnly: false };
  resetScopedData();
  updateScopeControls();
  return true;
}

async function getScopeReport() {
  const key = scopeKey();
  if (state.report && state.reportKey === key) return state.report;
  const report = await request('scope-report', { scope: currentScopeForWorker() });
  if (key !== scopeKey()) return null;
  state.report = report;
  state.reportKey = key;
  if (report?.players?.length && !report.players.some(player => player.ref === state.playerRef)) state.playerRef = report.players[0].ref;
  if (state.playerRef) el.player.value = state.playerRef;
  return report;
}

function metric(label, value, note = '') {
  return `<article class="metric-card" data-motion-card><span>${esc(label)}</span><strong>${value}</strong>${note ? `<small>${esc(note)}</small>` : ''}</article>`;
}

function coverage(summary) {
  const total = (summary.parsed || 0) + (summary.rejected || 0);
  const accepted = total ? summary.parsed / total * 100 : 0;
  return `<span class="${summary.rejected ? 'warn-text' : 'good-text'}">${accepted.toFixed(2)}% accepted</span>`;
}

function playerTable(players, { compactMode = false } = {}) {
  if (!players?.length) return '<div class="empty-block">No player activity in this scope.</div>';
  const max = Math.max(1, ...players.map(player => player.damage || 0));
  return `<div class="table-wrap"><table><thead><tr>
    <th class="rank">#</th><th>Player</th><th class="num">Damage</th><th class="num">Share</th><th class="num">DPS</th><th class="num">Combat DPS</th>
    ${compactMode ? '' : '<th class="num">Crit</th><th class="num">Flank / CA</th><th class="num">Companion</th><th class="num">Taken</th>'}
  </tr></thead><tbody>${players.map((player, index) => `<tr data-player-row="${esc(player.ref)}" class="${player.ref === state.playerRef ? 'selected' : ''}">
    <td class="rank">${index + 1}</td>
    <td><strong>${esc(player.name)}</strong><span class="mini-bar"><i style="--bar:${Math.max(1, (player.damage || 0) / max * 100)}%"></i></span></td>
    <td class="num">${compactHtml(player.damage)}</td><td class="num">${pct(player.damageShare)}</td><td class="num">${compactHtml(player.dps)}</td><td class="num accent">${compactHtml(player.combatDps)}</td>
    ${compactMode ? '' : `<td class="num">${pct(player.crit)}</td><td class="num">${pct(player.flank)}</td><td class="num">${compactHtml(player.companionDamage)}</td><td class="num">${compactHtml(player.damageTaken)}</td>`}
  </tr>`).join('')}</tbody></table></div>`;
}

function bindPlayerRows() {
  el.root.querySelectorAll('[data-player-row]').forEach(row => row.addEventListener('click', () => {
    state.playerRef = row.dataset.playerRow;
    el.player.value = state.playerRef;
    if (state.view === 'overview' || state.view === 'players') state.view = 'powers';
    render();
  }));
}

function encounterStrip() {
  const encounters = state.summary?.encounters || [];
  if (!encounters.length) return '<div class="empty-block">No encounters detected.</div>';
  return `<div class="encounter-strip">${encounters.slice(0, 40).map(encounter => `<button type="button" class="encounter-chip ${encounter.type === 'boss' ? 'boss' : ''}" data-scope="${encounter.type === 'boss' ? 'boss' : 'encounter'}:${encounter.id}">
    <span>${encounter.type === 'boss' ? 'Boss' : 'Combat'} ${encounter.id} · ${timeAt(encounter.start)}</span><strong>${esc(encounter.label)}</strong><small>${dur(encounter.duration)} · ${compact(encounter.damage)} damage</small>
  </button>`).join('')}</div>`;
}

function bindScopeButtons() {
  el.root.querySelectorAll('[data-scope]').forEach(button => button.addEventListener('click', () => {
    const scope = parseScopeValue(button.dataset.scope);
    state.view = scope.type === 'boss' ? 'boss' : 'overview';
    setScope(scope);
  }));
}

function compareDefaults(players) {
  const available = players || [];
  const allowed = new Set(available.map(player => player.ref));
  state.compareRefs = state.compareRefs.filter(ref => allowed.has(ref)).slice(0, 5);
  for (const player of available) {
    if (state.compareRefs.length >= Math.min(3, available.length)) break;
    if (!state.compareRefs.includes(player.ref)) state.compareRefs.push(player.ref);
  }
}

function selectedPlayers(report) {
  compareDefaults(report?.players || []);
  const wanted = new Set(state.compareRefs);
  return (report?.players || []).filter(player => wanted.has(player.ref)).slice(0, 5);
}

function compareSelector(report) {
  compareDefaults(report.players || []);
  return `<div class="compare-selector" aria-label="Players to compare">${(report.players || []).slice(0, 12).map(player => `<label class="compare-toggle"><input type="checkbox" data-compare-ref="${esc(player.ref)}" ${state.compareRefs.includes(player.ref) ? 'checked' : ''}><span>${esc(player.name)}</span></label>`).join('')}</div>`;
}

function bindCompareSelector(report) {
  el.root.querySelectorAll('[data-compare-ref]').forEach(input => input.addEventListener('change', () => {
    const ref = input.dataset.compareRef;
    if (input.checked) {
      if (state.compareRefs.length >= 5) {
        input.checked = false;
        toast('Compare up to five players at a time.', 'warn');
        return;
      }
      if (!state.compareRefs.includes(ref)) state.compareRefs.push(ref);
    } else {
      if (state.compareRefs.length <= Math.min(2, report.players.length)) {
        input.checked = true;
        toast('Keep at least two players selected for comparison.', 'warn');
        return;
      }
      state.compareRefs = state.compareRefs.filter(item => item !== ref);
    }
    renderComparison(report);
  }));
}

async function renderOverview() {
  replaceRoot('<div class="empty-block">Building scoped combat summary...</div>');
  const report = await getScopeReport();
  if (!report) return;
  const scopeText = report.scope?.label || scopeName();
  replaceRoot(`
    <section class="metrics">
      ${metric('Total damage', compactHtml(report.damage), scopeText)}
      ${metric('Party DPS', compactHtml(report.partyDps), 'Exact aggregate / scope duration')}
      ${metric('Duration', dur(report.duration), `${compact(report.hits)} valid hits`)}
      ${metric('Players', compactHtml(report.players.length), `${compact(state.summary?.encounters?.length || 0)} encounters detected`)}
    </section>
    <section class="section-grid overview-grid">
      <article class="panel chart-panel">
        <div class="panel-head"><div><span class="eyebrow">Combat intensity</span><h2>Party damage over time</h2></div><span class="chart-note">Canvas · exact totals remain in tables</span></div>
        <div class="chart-host" data-chart id="overview-chart"></div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><span class="eyebrow">Party ranking</span><h2>Damage contribution</h2></div><span>${compact(report.players.length)} players</span></div>
        ${playerTable(report.players, { compactMode: true })}
      </article>
    </section>
    <section class="panel">
      <div class="panel-head"><div><span class="eyebrow">Detected windows</span><h2>Encounters</h2></div><span>${compact(state.summary?.encounters?.length || 0)}</span></div>
      ${encounterStrip()}
    </section>`);
  bindPlayerRows();
  bindScopeButtons();
  renderTimelineChart($('overview-chart'), [{ label: 'Party damage', points: report.partyTimeline || [] }], { ariaLabel: `${scopeText} party damage over time` });
  revealCards(el.root);
}

function renderComparison(report) {
  const players = selectedPlayers(report);
  if ((report.players || []).length < 2) {
    replaceRoot(`<section class="panel"><div class="panel-head"><h2>Player comparison</h2></div><div class="empty-block">At least two active players are required in this scope.</div></section>`);
    return;
  }
  replaceRoot(`
    <section class="panel">
      <div class="panel-head"><div><span class="eyebrow">Comparison set</span><h2>Players in identical scope</h2></div><span>${esc(report.scope?.label || scopeName())}</span></div>
      ${compareSelector(report)}
    </section>
    <section class="comparison-cards">${players.map((player, index) => `<article class="compare-card" data-motion-card>
      <header><h3>${esc(player.name)}</h3><span class="compare-rank">#${(report.players || []).findIndex(item => item.ref === player.ref) + 1}</span></header>
      <strong>${compactHtml(player.damage)}</strong><small>${pct(player.damageShare)} of scoped party damage</small>
      <div class="mini-stats"><div><span>DPS</span><b>${compactHtml(player.dps)}</b></div><div><span>Combat DPS</span><b>${compactHtml(player.combatDps)}</b></div><div><span>Crit</span><b>${pct(player.crit)}</b></div><div><span>Flank / CA</span><b>${pct(player.flank)}</b></div></div>
    </article>`).join('')}</section>
    <section class="panel chart-panel">
      <div class="panel-head"><div><span class="eyebrow">Same clock, same scope</span><h2>Player damage over time</h2></div><span class="chart-note">2–5 player comparison</span></div>
      <div class="chart-host" data-chart id="comparison-chart"></div>
    </section>
    <section class="panel">
      <div class="panel-head"><div><span class="eyebrow">Exact metrics</span><h2>Comparison table</h2></div><span>${compact(players.length)} selected</span></div>
      ${playerTable(players)}
    </section>`);
  bindCompareSelector(report);
  bindPlayerRows();
  renderTimelineChart($('comparison-chart'), players.map(player => ({ label: player.name, points: player.timeline || [] })), { ariaLabel: 'Selected player damage comparison over time' });
  revealCards(el.root);
}

async function renderComparisonView() {
  replaceRoot('<div class="empty-block">Building comparison scope...</div>');
  const report = await getScopeReport();
  if (!report) return;
  renderComparison(report);
}

async function renderBoss() {
  if (!ensureBossScope()) {
    replaceRoot('<section class="panel"><div class="panel-head"><h2>Boss analysis</h2></div><div class="empty-block">No boss encounters were detected in this log.</div></section>');
    return;
  }
  fillScopeControl();
  updateScopeControls();
  replaceRoot('<div class="empty-block">Building boss report...</div>');
  const report = await getScopeReport();
  if (!report) return;
  const encounter = encounterById(state.scope.id);
  const current = report.players.find(player => player.ref === state.playerRef) || report.players[0] || null;
  const topPowers = (current?.powers || []).slice(0, 8);
  replaceRoot(`
    <section class="metrics">
      ${metric('Boss damage', compactHtml(report.damage), state.scope.targetOnly ? 'Selected boss target only' : 'Entire boss encounter window')}
      ${metric('Party DPS', compactHtml(report.partyDps), 'Same scope for every player')}
      ${metric('Duration', dur(report.duration), `${compact(report.hits)} valid hits`)}
      ${metric('Top player', report.players[0] ? esc(report.players[0].name) : '—', report.players[0] ? `${pct(report.players[0].damageShare)} share` : '')}
    </section>
    <section class="section-grid boss-grid">
      <div>
        <article class="panel chart-panel">
          <div class="panel-head"><div><span class="eyebrow">Boss ${encounter?.id || ''}</span><h2>${esc(encounter?.label || report.scope?.label || 'Boss encounter')}</h2></div><span>${timeAt(encounter?.start || 0)} · ${dur(report.duration)}</span></div>
          <div class="chart-host" data-chart id="boss-chart"></div>
        </article>
        <article class="panel">
          <div class="panel-head"><div><span class="eyebrow">Exact ranking</span><h2>Player damage</h2></div><span>${compact(report.players.length)} players</span></div>
          ${playerTable(report.players, { compactMode: true })}
        </article>
      </div>
      <aside>
        <article class="panel">
          <div class="panel-head"><h2>Encounter signal</h2></div>
          <div class="boss-summary"><article><span>Start</span><strong>${timeAt(encounter?.start || 0)}</strong></article><article><span>End</span><strong>${timeAt(encounter?.end || 0)}</strong></article><article><span>Hits</span><strong>${compact(report.hits)}</strong></article><article><span>Scope</span><strong>${state.scope.targetOnly ? 'Target' : 'Window'}</strong></article></div>
        </article>
        <article class="panel">
          <div class="panel-head"><div><span class="eyebrow">Selected player</span><h2>${esc(current?.name || 'No player')}</h2></div><span>Top powers</span></div>
          ${topPowers.length ? `<div class="power-list">${topPowers.map(power => `<div class="power-row"><strong>${esc(power.power)}</strong><b>${compactHtml(power.damage)}</b><span>${pct(power.share)}</span></div>`).join('')}</div>` : '<div class="empty-block">No scoped power damage.</div>'}
        </article>
      </aside>
    </section>`);
  bindPlayerRows();
  renderTimelineChart($('boss-chart'), report.players.slice(0, 5).map(player => ({ label: player.name, points: player.timeline || [] })), { ariaLabel: `${encounter?.label || 'Boss'} player damage over time` });
  revealCards(el.root);
}

async function renderEncounters() {
  const encounters = state.summary?.encounters || [];
  const total = Math.max(1, ...encounters.map(encounter => encounter.damage || 0));
  replaceRoot(`<section class="panel"><div class="panel-head"><div><span class="eyebrow">Combat windows</span><h2>Encounter browser</h2></div><span>${compact(encounters.length)} detected</span></div>
    ${encounters.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Boss / target</th><th>Start</th><th class="num">Duration</th><th class="num">Damage</th><th class="num">Hits</th></tr></thead><tbody>${encounters.map(encounter => `<tr data-scope="${encounter.type === 'boss' ? 'boss' : 'encounter'}:${encounter.id}" class="${state.scope.id === encounter.id ? 'selected' : ''}"><td>${encounter.id}</td><td class="${encounter.type === 'boss' ? 'boss-value' : ''}">${encounter.type === 'boss' ? 'Boss' : 'Combat'}</td><td><strong>${esc(encounter.label)}</strong><span class="mini-bar"><i style="--bar:${Math.max(1, encounter.damage / total * 100)}%"></i></span></td><td>${timeAt(encounter.start)}</td><td class="num">${dur(encounter.duration)}</td><td class="num">${compactHtml(encounter.damage)}</td><td class="num">${compactHtml(encounter.hits)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-block">No encounters detected.</div>'}
  </section>`);
  bindScopeButtons();
}

async function renderPlayers() {
  replaceRoot('<div class="empty-block">Building scoped party table...</div>');
  const report = await getScopeReport();
  if (!report) return;
  replaceRoot(`<section class="panel"><div class="panel-head"><div><span class="eyebrow">${esc(report.scope?.label || scopeName())}</span><h2>Player performance</h2></div><span>${compact(report.players.length)} players</span></div>${playerTable(report.players)}</section>`);
  bindPlayerRows();
}

async function renderPowers() {
  replaceRoot('<div class="empty-block">Building scoped power report...</div>');
  const report = await getScopeReport();
  if (!report) return;
  const player = report.players.find(item => item.ref === state.playerRef) || report.players[0];
  if (!player) {
    replaceRoot('<section class="panel"><div class="panel-head"><h2>Power analysis</h2></div><div class="empty-block">No player damage in this scope.</div></section>');
    return;
  }
  state.playerRef = player.ref;
  el.player.value = player.ref;
  replaceRoot(`
    <section class="metrics">
      ${metric('Damage', compactHtml(player.damage), `${pct(player.damageShare)} party share`)}
      ${metric('Combat DPS', compactHtml(player.combatDps), `${compact(player.hits)} hits`)}
      ${metric('Critical', pct(player.crit), `Max ${compact(player.maxHit)}`)}
      ${metric('Flank / CA', pct(player.flank), `${compact(player.companionDamage)} companion`)}
    </section>
    <section class="panel chart-panel"><div class="panel-head"><div><span class="eyebrow">${esc(player.name)}</span><h2>Damage over time</h2></div><span>${esc(report.scope?.label || scopeName())}</span></div><div class="chart-host" data-chart id="player-chart"></div></section>
    <section class="panel"><div class="panel-head"><div><span class="eyebrow">Exact contribution</span><h2>Power breakdown</h2></div><span>${compact(player.powers?.length || 0)} powers</span></div>
      ${(player.powers || []).length ? `<div class="table-wrap"><table><thead><tr><th>Power</th><th class="num">Damage</th><th class="num">Share</th><th class="num">DPS</th><th class="num">Hits</th><th class="num">Average</th><th class="num">Maximum</th><th class="num">Crit</th><th class="num">Flank / CA</th></tr></thead><tbody>${player.powers.map(power => `<tr><td><strong>${esc(power.power)}</strong></td><td class="num">${compactHtml(power.damage)}</td><td class="num">${pct(power.share)}</td><td class="num">${compactHtml(power.dps)}</td><td class="num">${compactHtml(power.hits)}</td><td class="num">${compactHtml(power.avg)}</td><td class="num">${compactHtml(power.max)}</td><td class="num">${pct(power.crit)}</td><td class="num">${pct(power.flank)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-block">No power damage in this scope.</div>'}
    </section>`);
  renderTimelineChart($('player-chart'), [{ label: player.name, points: player.timeline || [] }], { ariaLabel: `${player.name} damage over time` });
  revealCards(el.root);
}

function rawFilters() {
  const playerOptions = ['<option value="">All owners</option>', ...(state.summary?.players || []).map(player => `<option value="${esc(player.ref)}" ${player.ref === state.rawPlayerRef ? 'selected' : ''}>${esc(player.name)}</option>`)].join('');
  const kinds = ['', 'damage', 'healing', 'shield', 'shield-damage', 'resource', 'meta', 'summon', 'control', 'immune', 'unknown'];
  const kindOptions = kinds.map(kind => `<option value="${kind}" ${kind === state.rawKind ? 'selected' : ''}>${kind || 'All event types'}</option>`).join('');
  return `<div class="inline-filters"><label class="field"><span>Owner</span><select id="raw-player-filter">${playerOptions}</select></label><label class="field"><span>Event type</span><select id="raw-kind-filter">${kindOptions}</select></label></div>`;
}

async function loadRaw(reset = false) {
  if (state.rawLoading) return;
  state.rawLoading = true;
  if (reset) { state.rawRows = []; state.rawNext = null; }
  try {
    const page = await request('raw-page', { options: {
      cursor: reset ? null : state.rawNext,
      limit: 180,
      playerRef: state.rawPlayerRef,
      kind: state.rawKind,
      scope: currentScopeForWorker()
    }});
    state.rawRows.push(...(page.rows || []));
    state.rawNext = page.nextCursor;
    renderEvents(false);
  } catch (error) {
    toast(error.message, 'bad');
  } finally {
    state.rawLoading = false;
  }
}

function bindRawFilters() {
  $('raw-player-filter')?.addEventListener('change', event => { state.rawPlayerRef = event.target.value; loadRaw(true); });
  $('raw-kind-filter')?.addEventListener('change', event => { state.rawKind = event.target.value; loadRaw(true); });
  el.root.querySelector('.load-more')?.addEventListener('click', () => loadRaw(false));
}

function renderEvents(auto = true) {
  replaceRoot(`<section class="panel"><div class="panel-head"><div><span class="eyebrow">Indexed row store</span><h2>Event explorer</h2></div><span>${compact(state.rawRows.length)} shown</span></div>
    ${rawFilters()}
    ${state.rawRows.length ? `<div class="table-wrap raw"><table><thead><tr><th>Time</th><th>Owner</th><th>Target</th><th>Power</th><th>Damage type</th><th>Event type</th><th class="num">Amount</th></tr></thead><tbody>${state.rawRows.map(row => `<tr><td>${row.time.toFixed(2)}s</td><td>${esc(row.ownerName)}</td><td>${esc(row.targetName)}</td><td>${esc(row.powerName)}</td><td>${esc(row.damageType)}</td><td>${esc(row.kind)}</td><td class="num">${compactHtml(row.amount)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-block">Querying compact row store...</div>'}
    ${state.rawNext != null ? '<button class="button load-more" type="button">Load 180 more</button>' : ''}
    <div class="view-note">Rows are paged from the worker. The UI never renders the complete raw log at once.</div>
  </section>`);
  bindRawFilters();
  if (auto && !state.rawRows.length) loadRaw(true);
}

function renderDiagnostics() {
  const summary = state.summary;
  const list = (items, empty) => items?.length ? `<div class="reason-list">${items.map(item => `<div class="reason"><strong>${esc(item.key)}</strong><span>${compactHtml(item.value)}</span></div>`).join('')}</div>` : `<div class="empty-block good-text">${empty}</div>`;
  replaceRoot(`
    <section class="metrics">
      ${metric('Accepted', compactHtml(summary.parsed), `${compact(summary.rejected)} rejected`)}
      ${metric('Acceptance', coverage(summary), `${compact(summary.lines)} lines inspected`)}
      ${metric('Valid damage', compactHtml(summary.validDamageRows), `${compact(summary.damage)} damage`)}
      ${metric('Worker store', bytes(summary.estimatedStoreBytes), `${compact(summary.storedRows)} compact rows`)}
    </section>
    <section class="section-grid diagnostic-grid">
      <article class="panel"><div class="panel-head"><div><span class="eyebrow">Parser health</span><h2>Reject reasons</h2></div><span>${compact(summary.rejected)}</span></div>${list(summary.rejectReasons, 'No rejected structured rows.')}
      <div class="panel-head"><h2>Unknown event types</h2></div>${list(summary.unknownTypes, 'No unknown event types.')}</article>
      <article class="panel"><div class="panel-head"><div><span class="eyebrow">Traceability</span><h2>Rejected row samples</h2></div><span>Max 40</span></div>${summary.rejectedSamples?.length ? `<div class="samples">${summary.rejectedSamples.map(sample => `<article><b>Line ${num(sample.lineNo)} · ${esc(sample.reason)}</b><code>${esc(sample.preview)}</code></article>`).join('')}</div>` : '<div class="empty-block good-text">Every structured row was accepted.</div>'}</article>
    </section>`);
}

async function render() {
  setView(state.view);
  updateScopeControls();
  try {
    if (state.view === 'overview') await renderOverview();
    else if (state.view === 'comparison') await renderComparisonView();
    else if (state.view === 'boss') await renderBoss();
    else if (state.view === 'encounters') await renderEncounters();
    else if (state.view === 'players') await renderPlayers();
    else if (state.view === 'powers') await renderPowers();
    else if (state.view === 'events') renderEvents();
    else renderDiagnostics();
    revealView(el.root);
  } catch (error) {
    replaceRoot(`<section class="panel"><div class="panel-head"><h2>Analysis error</h2></div><div class="empty-block bad-text">${esc(error.message || error)}</div></section>`);
    toast(error.message || String(error), 'bad');
  }
}

function finish(summary) {
  state.summary = summary;
  state.scope = { type: 'session', id: null, targetOnly: false };
  state.playerRef = summary.players?.[0]?.ref || '';
  state.compareRefs = (summary.players || []).slice(0, 3).map(player => player.ref);
  state.rawPlayerRef = '';
  state.rawKind = '';
  resetScopedData();
  fillScopeControl();
  fillPlayerControl();
  updateScopeControls();
  enableNav(true);
  mode('workspace');
  el.topbarFile.textContent = summary.file?.name || 'Combat log';
  el.eye.textContent = `${summary.file?.name || 'Loaded log'} · ${bytes(summary.file?.size || 0)}`;
  status(`${compact(summary.parsed)} events ready`, summary.rejected ? 'warn' : 'good');
  warmCharts();
  render();
  toast(`Parsed ${compact(summary.parsed)} events in ${(summary.parseMs / 1000).toFixed(2)}s`, 'good');
}

function acceptFile(file) {
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (!['.log', '.txt', '.csv'].some(ext => lower.endsWith(ext))) {
    toast('Choose a .log, .txt, or .csv combat log.', 'bad');
    return;
  }
  state.summary = null;
  state.report = null;
  state.reportKey = '';
  state.rawRows = [];
  state.rawNext = null;
  clearCharts();
  mode('parsing');
  enableNav(false);
  el.fileName.textContent = file.name;
  el.topbarFile.textContent = `${file.name} · ${bytes(file.size)}`;
  el.partial.innerHTML = '<span class="empty-inline">Player totals appear while parsing continues.</span>';
  el.bar.style.transform = 'scaleX(0)';
  status('Parser active', 'working');
  worker.postMessage({ type: 'parse', file });
}

worker.onmessage = event => {
  const message = event.data || {};
  if (message.requestId && settle(message)) return;
  if (message.type === 'progress') {
    const progress = message.progress;
    const total = progress.totalBytes || 0;
    const ratio = total ? Math.min(1, progress.bytesRead / total) : 0;
    el.bar.style.transform = `scaleX(${ratio})`;
    el.read.textContent = total ? `${bytes(progress.bytesRead)} / ${bytes(total)}` : bytes(progress.bytesRead);
    el.lines.textContent = compact(progress.lineNo);
    el.parsed.textContent = compact(progress.parsed);
    el.rejected.textContent = compact(progress.rejected);
    el.elapsed.textContent = `${(progress.elapsedMs / 1000).toFixed(1)}s`;
    const phaseText = progress.phase === 'indexing' ? 'Indexing encounters...' : progress.phase === 'finalizing' ? 'Finalizing exact aggregates...' : 'Streaming and aggregating...';
    el.phase.textContent = phaseText;
    status(`${Math.round(ratio * 100)}% parsed`, 'working');
  } else if (message.type === 'partial-summary') {
    const players = (message.summary.players || []).slice(0, 6);
    const max = Math.max(1, ...players.map(player => player.damage));
    el.partial.innerHTML = players.length ? players.map((player, index) => `<div class="partial-row"><span>${index + 1}</span><strong>${esc(player.name)}</strong><i style="--bar:${Math.max(2, player.damage / max * 100)}%"></i><b>${compact(player.damage)}</b></div>`).join('') : '<span class="empty-inline">Waiting for player damage...</span>';
  } else if (message.type === 'done') {
    finish(message.summary);
  } else if (message.type === 'error') {
    mode('empty');
    el.topbarFile.textContent = 'No combat log linked';
    status('Parser error', 'bad');
    toast(message.message || 'Parser failed', 'bad');
  }
};

worker.onerror = event => {
  mode('empty');
  el.topbarFile.textContent = 'No combat log linked';
  status('Worker crashed', 'bad');
  toast(event.message || 'Worker crashed', 'bad');
};

el.open.addEventListener('click', () => el.file.click());
el.replace.addEventListener('click', () => el.file.click());
el.drop.addEventListener('click', () => el.file.click());
el.file.addEventListener('change', () => { acceptFile(el.file.files?.[0]); el.file.value = ''; });
el.cancel.addEventListener('click', () => {
  worker.postMessage({ type: 'cancel' });
  mode('empty');
  el.topbarFile.textContent = 'No combat log linked';
  status('Parse cancelled');
});
el.player.addEventListener('change', () => { state.playerRef = el.player.value; render(); });
el.scope.addEventListener('change', () => setScope(parseScopeValue(el.scope.value)));
el.bossTargetOnly.addEventListener('change', () => {
  if (state.scope.type !== 'boss') return;
  state.scope.targetOnly = el.bossTargetOnly.checked;
  resetScopedData();
  updateScopeControls();
  render();
});
el.nav.addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button || button.disabled) return;
  state.view = button.dataset.view;
  if (state.view === 'boss') ensureBossScope();
  if (state.view === 'events') { state.rawRows = []; state.rawNext = null; }
  render();
});

let dragDepth = 0;
addEventListener('dragenter', event => {
  if (!event.dataTransfer?.types?.includes('Files')) return;
  event.preventDefault();
  dragDepth += 1;
  el.overlay.hidden = false;
});
addEventListener('dragover', event => { if (event.dataTransfer?.types?.includes('Files')) event.preventDefault(); });
addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) el.overlay.hidden = true; });
addEventListener('drop', event => {
  event.preventDefault();
  dragDepth = 0;
  el.overlay.hidden = true;
  acceptFile(event.dataTransfer?.files?.[0]);
});
addEventListener('beforeunload', () => worker.postMessage({ type: 'dispose' }));

mode('empty');
enableNav(false);
el.bossTargetField.hidden = true;
warmMotion();
