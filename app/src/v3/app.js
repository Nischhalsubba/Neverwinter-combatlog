import { startAmbient, stopAmbient } from './ambient.js';
import { revealCards, revealView, warmMotion } from './motion.js';
import { destroyChart, renderTimelineChart, warmCharts } from './charts.js';

const worker = new Worker(new URL('../workers/fast-parse-worker.js', import.meta.url), { type: 'module' });
const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const df = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const ROTATION_CATEGORIES = ['At-Will', 'Encounter', 'Daily', 'Artifact', 'Mount'];
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
  rotation: null,
  rotationKey: '',
  rotationFilters: new Set(ROTATION_CATEGORIES),
  powerDetail: null,
  rawRows: [],
  rawNext: null,
  rawLoading: false,
  rawPlayerRef: '',
  rawKind: ''
};

let seq = 0;
let renderEpoch = 0;
let rotationPaintToken = 0;
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

function logTimestamp(abs, fallbackTime = 0) {
  const n = Number(abs);
  if (Number.isFinite(n) && n > 946684800) {
    const date = new Date(n * 1000);
    const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const sec = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
    return `${yy}:${mo}:${day}:${h}:${m}:${sec.toFixed(1).padStart(4, '0')}`;
  }
  return `${Number(fallbackTime || 0).toFixed(2)}s`;
}

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
  const promise = new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ type, requestId, ...payload });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error(`${type} timed out`));
    }, 45000);
  });
  promise.requestId = requestId;
  return promise;
}

function settle(message) {
  const item = pending.get(message.requestId);
  if (!item) return false;
  pending.delete(message.requestId);
  if (message.error) {
    const error = new Error(message.error);
    error.verification = message.verification || null;
    item.reject(error);
  } else if ('report' in message) item.resolve(message.report);
  else if ('page' in message) item.resolve(message.page);
  else if ('summary' in message) item.resolve(message.summary);
  else item.resolve(message);
  return true;
}

const TASK_PHASE_LABELS = Object.freeze({
  calculate: 'Calculating the selected fight',
  verify: 'Double-checking the numbers',
  scan: 'Reading damaging power uses',
  group: 'Grouping power uses',
  'verify-rotation': 'Double-checking power timing',
  cached: 'Using saved results',
  done: 'Ready'
});

function taskLoading(title, detail, type) {
  return `<section class="task-loading" data-task-loading data-task-type="${esc(type)}" aria-busy="true" aria-live="polite">
    <div class="task-loading-head"><div><span class="eyebrow">Working</span><h2>${esc(title)}</h2><p>${esc(detail)}</p></div><strong data-task-progress-value>2%</strong></div>
    <div class="task-progress-track" role="progressbar" aria-label="${esc(title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="2"><i data-task-progress-bar style="--task-progress:.02"></i></div>
    <div class="task-progress-copy" data-task-progress-label>Starting…</div>
    <div class="task-skeleton-grid" aria-hidden="true">
      <span class="task-skeleton task-skeleton-wide"></span><span class="task-skeleton"></span><span class="task-skeleton"></span>
      <span class="task-skeleton task-skeleton-tall"></span><span class="task-skeleton task-skeleton-tall"></span>
    </div>
  </section>`;
}

function bindTaskRequest(promise, task) {
  if (!promise?.requestId) return promise;
  const loading = el.root.querySelector(`[data-task-loading][data-task-type="${task}"]`);
  if (loading) loading.dataset.taskRequest = String(promise.requestId);
  return promise;
}

function updateTaskProgress(message) {
  const requestId = String(message.requestId || '');
  const loading = Array.from(el.root.querySelectorAll('[data-task-loading]')).find(node => node.dataset.taskRequest === requestId);
  if (!loading) return;
  const value = Math.max(.02, Math.min(1, Number(message.progress) || 0));
  const percent = Math.round(value * 100);
  const bar = loading.querySelector('[data-task-progress-bar]');
  const meter = loading.querySelector('[role="progressbar"]');
  const valueLabel = loading.querySelector('[data-task-progress-value]');
  const phaseLabel = loading.querySelector('[data-task-progress-label]');
  if (bar) bar.style.setProperty('--task-progress', String(value));
  if (meter) meter.setAttribute('aria-valuenow', String(percent));
  if (valueLabel) valueLabel.textContent = `${percent}%`;
  if (phaseLabel) phaseLabel.textContent = message.detail || TASK_PHASE_LABELS[message.phase] || 'Working…';
}

function clearCharts() {
  el.root.querySelectorAll('[data-chart]').forEach(node => destroyChart(node));
}

function replaceRoot(html) {
  rotationPaintToken += 1;
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
    overview: 'Overview',
    rotation: 'Fight Timeline',
    comparison: 'Compare',
    boss: 'Bosses',
    encounters: 'All Fights',
    players: 'Players',
    powers: 'Damage & Powers',
    events: 'Raw Events',
    diagnostics: 'Analysis Checks',
    debuffs: 'Team Debuffs'
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
  state.rotation = null;
  state.rotationKey = '';
  state.powerDetail = null;
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

function requireVerified(value, label = 'analytics') {
  if (!value || value.verification?.status !== 'verified') {
    throw new Error(`${label} was blocked because both engines did not verify it.`);
  }
  return value;
}

async function getScopeReport() {
  const key = scopeKey();
  if (state.report && state.reportKey === key) return requireVerified(state.report, 'Scope report');
  const task = bindTaskRequest(request('scope-report', { scope: currentScopeForWorker() }), 'scope-report');
  const report = requireVerified(await task, 'Scope report');
  if (key !== scopeKey()) return null;
  state.report = report;
  state.reportKey = key;
  if (report.players?.length && !report.players.some(player => player.ref === state.playerRef)) state.playerRef = report.players[0].ref;
  if (state.playerRef) el.player.value = state.playerRef;
  return report;
}

async function getRotationReport() {
  const key = scopeKey();
  if (state.rotation && state.rotationKey === key) return requireVerified(state.rotation, 'Rotation report');
  const task = bindTaskRequest(request('rotation-report', { scope: currentScopeForWorker() }), 'rotation-report');
  const report = requireVerified(await task, 'Rotation report');
  if (key !== scopeKey()) return null;
  state.rotation = report;
  state.rotationKey = key;
  return report;
}

function metric(label, value, note = '') {
  return `<article class="metric-card" data-motion-card><span>${esc(label)}</span><strong>${value}</strong>${note ? `<small>${esc(note)}</small>` : ''}</article>`;
}

function verificationBadge(verification) {
  if (verification?.status !== 'verified') return '<span class="verification-badge is-bad">Blocked</span>';
  const detail = verification.checkedFields ? `${num(verification.checkedFields)} fields` : verification.checkedActivations ? `${num(verification.checkedActivations)} activations` : 'cross-check';
  return `<span class="verification-badge" title="Verifier checksum ${esc(verification.checksum || '')}"><i></i>Verified · 2 engines · ${detail}</span>`;
}

function coverage(summary) {
  const total = (summary.parsed || 0) + (summary.rejected || 0);
  const accepted = total ? summary.parsed / total * 100 : 0;
  return `<span class="${summary.rejected ? 'warn-text' : 'good-text'}">${accepted.toFixed(2)}% accepted</span>`;
}

function classLabel(player) {
  return player?.className && player.className !== 'Unknown' ? player.className : 'Unknown';
}

function currentPlayer(report) {
  return report?.players?.find(player => player.ref === state.playerRef) || report?.players?.[0] || null;
}

function playerTable(players, { compactMode = false } = {}) {
  if (!players?.length) return '<div class="empty-block">No player activity in this scope.</div>';
  const max = Math.max(1, ...players.map(player => player.damage || 0));
  return `<div class="table-wrap"><table><thead><tr>
    <th class="rank">#</th><th>Player</th><th>Class</th><th class="num">Damage</th><th class="num">Share</th><th class="num">DPS</th><th class="num">Combat DPS</th><th class="num">Hits</th><th class="num">Duration</th>
    ${compactMode ? '' : '<th class="num">Crit</th><th class="num">Flank / CA</th><th class="num">Companion</th><th class="num">Taken</th>'}
  </tr></thead><tbody>${players.map((player, index) => `<tr data-player-row="${esc(player.ref)}" class="${player.ref === state.playerRef ? 'selected' : ''}">
    <td class="rank">${index + 1}</td>
    <td><strong>${esc(player.name)}</strong><span class="mini-bar"><i style="--bar:${Math.max(1, (player.damage || 0) / max * 100)}%"></i></span></td>
    <td><span class="class-badge">${esc(classLabel(player))}</span></td>
    <td class="num">${compactHtml(player.damage)}</td><td class="num">${pct(player.damageShare)}</td><td class="num">${compactHtml(player.dps)}</td><td class="num accent">${compactHtml(player.combatDps)}</td><td class="num">${compactHtml(player.hits)}</td><td class="num">${dur(player.duration)}</td>
    ${compactMode ? '' : `<td class="num">${pct(player.crit)}</td><td class="num">${pct(player.flank)}</td><td class="num">${compactHtml(player.companionDamage)}</td><td class="num">${compactHtml(player.damageTaken)}</td>`}
  </tr>`).join('')}</tbody></table></div>`;
}

function bindPlayerRows() {
  el.root.querySelectorAll('[data-player-row]').forEach(row => row.addEventListener('click', () => {
    state.playerRef = row.dataset.playerRow;
    el.player.value = state.playerRef;
    state.powerDetail = null;
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

function bars(items, { labelKey = 'power', valueKey = 'damage', shareKey = 'share', limit = 8 } = {}) {
  const rows = (items || []).slice(0, limit);
  if (!rows.length) return '<div class="empty-block">No data in this scope.</div>';
  const max = Math.max(1, ...rows.map(item => Number(item[valueKey]) || 0));
  return `<div class="analysis-bars">${rows.map(item => `<div class="analysis-bar-row"><strong>${esc(item[labelKey])}</strong><div class="analysis-bar-track"><i style="--bar:${Math.max(1, (Number(item[valueKey]) || 0) / max * 100)}%"></i></div><span>${pct(item[shareKey])}</span><b>${compactHtml(item[valueKey])}</b></div>`).join('')}</div>`;
}

function selectedOverview(player, report) {
  if (!player) return '<div class="empty-block">No selected player activity.</div>';
  const topPowers = player.powers || [];
  return `<section class="panel player-overview-panel">
    <div class="panel-head"><div><span class="eyebrow">Overview · ${esc(classLabel(player))}</span><h2>${esc(player.name)}</h2></div>${verificationBadge(report.verification)}</div>
    <section class="reference-metrics">
      ${metric('Total Damage', compactHtml(player.damage))}
      ${metric('DPS', compactHtml(player.dps), 'First to last canonical hit')}
      ${metric('Combat DPS', compactHtml(player.combatDps), 'Verified active combat time')}
      ${metric('Duration', dur(player.duration))}
      ${metric('In-Combat Time', dur(player.combatTime))}
      ${metric('Total Hits', compactHtml(player.hits))}
      ${metric('Crit Rate', pct(player.crit))}
      ${metric('Flank Rate', pct(player.flank))}
      ${metric('Max Hit', compactHtml(player.maxHit), player.maxPower || 'Unknown')}
      ${metric('Encounters', compactHtml(player.encounters || 0))}
      ${metric('Healing Done', compactHtml(player.healingDone))}
      ${metric('Damage Taken', compactHtml(player.damageTaken))}
      ${metric('Shielded', compactHtml(player.shielded))}
    </section>
    <div class="panel-subsection"><div class="subsection-head"><h3>Top Damage Powers</h3><span>${compact(topPowers.length)} powers</span></div>${bars(topPowers, { limit: 8 })}</div>
  </section>`;
}

async function renderOverview(epoch = renderEpoch) {
  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading summary', 'Calculating the selected fight and checking the values before display.', 'scope-report'));
  const report = await getScopeReport();
  if (!report || epoch !== renderEpoch || state.view !== 'overview') return;
  const player = currentPlayer(report);
  const scopeText = report.scope?.label || scopeName();
  replaceRoot(`
    <section class="verification-strip">${verificationBadge(report.verification)}<span>Canonical damage: Physical · values remain local</span><button class="button" type="button" data-dashboard-customize>Customize overview</button></section>
    <section class="metrics party-metrics">
      ${metric('Party damage', compactHtml(report.damage), scopeText)}
      ${metric('Party DPS', compactHtml(report.partyDps), 'Scope clock')}
      ${metric('Party Combat DPS', compactHtml(report.partyCombatDps), 'Verified active combat time')}
      ${metric('Scope duration', dur(report.duration), `${compact(report.hits)} valid hits`)}
    </section>
    <section class="panel">
      <div class="panel-head"><div><span class="eyebrow">Party overview</span><h2>Damage contribution</h2></div><span>${compact(report.players.length)} players</span></div>
      ${playerTable(report.players, { compactMode: true })}
    </section>
    ${selectedOverview(player, report)}
    <section class="section-grid overview-grid">
      <article class="panel chart-panel">
        <div class="panel-head"><div><span class="eyebrow">Combat intensity</span><h2>Party damage over time</h2></div><span class="chart-note">Canvas · verified totals remain in tables</span></div>
        <div class="chart-host" data-chart id="overview-chart"></div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><span class="eyebrow">Detected windows</span><h2>Encounters</h2></div><span>${compact(state.summary?.encounters?.length || 0)}</span></div>
        ${encounterStrip()}
      </article>
    </section>`);
  bindPlayerRows();
  bindScopeButtons();
  renderTimelineChart($('overview-chart'), [{ label: 'Party damage', points: report.partyTimeline || [] }], { ariaLabel: `${scopeText} party damage over time` });
  revealCards(el.root);
}

function compareDefaults(players) {
  const available = players || [];
  const allowed = new Set(available.map(player => player.ref));
  state.compareRefs = state.compareRefs.filter(ref => allowed.has(ref)).slice(0, 5);
  const target = state.compareRefs.length ? Math.min(2, available.length) : Math.min(3, available.length);
  for (const player of available) {
    if (state.compareRefs.length >= target) break;
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

function renderComparison(report) {
  const players = selectedPlayers(report);
  if ((report.players || []).length < 2) {
    replaceRoot(`<section class="panel"><div class="panel-head"><h2>Player comparison</h2></div><div class="empty-block">At least two active players are required in this scope.</div></section>`);
    return;
  }
  replaceRoot(`
    <section class="verification-strip">${verificationBadge(report.verification)}<span>${esc(report.scope?.label || scopeName())}</span></section>
    <section class="panel">
      <div class="panel-head"><div><span class="eyebrow">Comparison set</span><h2>Players in identical scope</h2></div><span>Select 2–5 players</span></div>
      ${compareSelector(report)}
      <div class="view-note"><strong>DPS</strong> = damage divided by the time from that player's first to last valid hit. <strong>Combat DPS</strong> = damage divided by verified active combat time. Idle gaps over 5 seconds are excluded unless they belong to a merged boss phase. The values can legitimately match when there is no qualifying idle time.</div>
    </section>
    <section class="comparison-cards">${players.map(player => `<article class="compare-card" data-motion-card>
      <header><div><h3>${esc(player.name)}</h3><span class="class-badge">${esc(classLabel(player))}</span></div><span class="compare-rank">#${(report.players || []).findIndex(item => item.ref === player.ref) + 1}</span></header>
      <strong>${compactHtml(player.damage)}</strong><small>${pct(player.damageShare)} of scoped party damage</small>
      <div class="mini-stats"><div><span title="Damage divided by first-to-last valid hit time">DPS</span><b>${compactHtml(player.dps)}</b></div><div><span title="Damage divided by verified active combat time">Combat DPS</span><b>${compactHtml(player.combatDps)}</b></div><div><span>Elapsed</span><b>${dur(player.duration)}</b></div><div><span>In combat</span><b>${dur(player.combatTime)}</b></div><div><span>Crit</span><b>${pct(player.crit)}</b></div><div><span>Flank / CA</span><b>${pct(player.flank)}</b></div></div>
    </article>`).join('')}</section>
    <section class="panel chart-panel"><div class="panel-head"><div><span class="eyebrow">Same clock, same scope</span><h2>Player damage over time</h2></div><span class="chart-note">2–5 player comparison</span></div><div class="chart-host" data-chart id="comparison-chart"></div></section>
    <section class="panel"><div class="panel-head"><div><span class="eyebrow">Exact metrics</span><h2>Comparison table</h2></div><span>${compact(players.length)} selected</span></div>${playerTable(players)}</section>`);
  bindCompareSelector(report);
  bindPlayerRows();
  renderTimelineChart($('comparison-chart'), players.map(player => ({ label: player.name, points: player.timeline || [] })), { ariaLabel: 'Selected player damage comparison over time' });
  revealCards(el.root);
}

async function renderComparisonView(epoch = renderEpoch) {
  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading comparison', 'Preparing the same fight for the selected players.', 'scope-report'));
  const report = await getScopeReport();
  if (!report || epoch !== renderEpoch || state.view !== 'comparison') return;
  renderComparison(report);
}

async function renderBoss(epoch = renderEpoch) {
  if (!ensureBossScope()) {
    replaceRoot('<section class="panel"><div class="panel-head"><h2>Boss analysis</h2></div><div class="empty-block">No boss encounters were detected in this log.</div></section>');
    return;
  }
  fillScopeControl();
  updateScopeControls();
  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading boss fight', 'Calculating this boss fight and checking the values before display.', 'scope-report'));
  const report = await getScopeReport();
  if (!report || epoch !== renderEpoch || state.view !== 'boss') return;
  const encounter = encounterById(state.scope.id);
  const current = currentPlayer(report);
  const topPowers = (current?.powers || []).slice(0, 8);
  replaceRoot(`
    <section class="verification-strip">${verificationBadge(report.verification)}<span>${state.scope.targetOnly ? 'Boss target only' : 'Entire encounter window'}</span></section>
    <section class="metrics">
      ${metric('Boss damage', compactHtml(report.damage), state.scope.targetOnly ? 'Selected boss target only' : 'Entire boss encounter window')}
      ${metric('Party DPS', compactHtml(report.partyDps), 'Same scope for every player')}
      ${metric('Duration', dur(report.duration), `${compact(report.hits)} valid hits`)}
      ${metric('Top player', report.players[0] ? esc(report.players[0].name) : '—', report.players[0] ? `${pct(report.players[0].damageShare)} share` : '')}
    </section>
    <section class="section-grid boss-grid"><div>
      <article class="panel chart-panel"><div class="panel-head"><div><span class="eyebrow">Boss ${encounter?.id || ''}</span><h2>${esc(encounter?.label || report.scope?.label || 'Boss encounter')}</h2></div><span>${timeAt(encounter?.start || 0)} · ${dur(report.duration)}</span></div><div class="chart-host" data-chart id="boss-chart"></div></article>
      <article class="panel"><div class="panel-head"><div><span class="eyebrow">Exact ranking</span><h2>Player damage</h2></div><span>${compact(report.players.length)} players</span></div>${playerTable(report.players, { compactMode: true })}</article>
    </div><aside>
      <article class="panel"><div class="panel-head"><h2>Encounter signal</h2></div><div class="boss-summary"><article><span>Start</span><strong>${timeAt(encounter?.start || 0)}</strong></article><article><span>End</span><strong>${timeAt(encounter?.end || 0)}</strong></article><article><span>Hits</span><strong>${compact(report.hits)}</strong></article><article><span>Scope</span><strong>${state.scope.targetOnly ? 'Target' : 'Window'}</strong></article></div></article>
      <article class="panel"><div class="panel-head"><div><span class="eyebrow">Selected player</span><h2>${esc(current?.name || 'No player')}</h2></div><span>Top powers</span></div>${topPowers.length ? bars(topPowers, { limit: 8 }) : '<div class="empty-block">No scoped power damage.</div>'}</article>
    </aside></section>`);
  bindPlayerRows();
  renderTimelineChart($('boss-chart'), report.players.slice(0, 5).map(player => ({ label: player.name, points: player.timeline || [] })), { ariaLabel: `${encounter?.label || 'Boss'} player damage over time` });
  revealCards(el.root);
}

async function renderEncounters() {
  const encounters = state.summary?.encounters || [];
  const total = Math.max(1, ...encounters.map(encounter => encounter.damage || 0));
  replaceRoot(`<section class="panel"><div class="panel-head"><div><span class="eyebrow">Combat windows</span><h2>Encounter browser</h2></div><span>${compact(encounters.length)} detected</span></div>
    ${encounters.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Boss / target</th><th>Start</th><th class="num">Duration</th><th class="num">Damage</th><th class="num">Hits</th></tr></thead><tbody>${encounters.map(encounter => `<tr data-scope="${encounter.type === 'boss' ? 'boss' : 'encounter'}:${encounter.id}" class="${state.scope.id === encounter.id ? 'selected' : ''}"><td>${encounter.id}</td><td class="${encounter.type === 'boss' ? 'boss-value' : ''}">${encounter.type === 'boss' ? 'Boss' : 'Combat'}</td><td><strong>${esc(encounter.label)}</strong><span class="mini-bar"><i style="--bar:${Math.max(1, encounter.damage / total * 100)}%"></i></span></td><td>${timeAt(encounter.start)}</td><td class="num">${dur(encounter.duration)}</td><td class="num">${compactHtml(encounter.damage)}</td><td class="num">${compactHtml(encounter.hits)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-block">No encounters detected.</div>'}</section>`);
  bindScopeButtons();
}

async function renderPlayers(epoch = renderEpoch) {
  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading player results', 'Calculating player totals for the selected fight.', 'scope-report'));
  const report = await getScopeReport();
  if (!report || epoch !== renderEpoch || state.view !== 'players') return;
  replaceRoot(`<section class="verification-strip">${verificationBadge(report.verification)}<span>${esc(report.scope?.label || scopeName())}</span></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">${esc(report.scope?.label || scopeName())}</span><h2>Player performance</h2></div><span>${compact(report.players.length)} players</span></div>${playerTable(report.players)}</section>`);
  bindPlayerRows();
}

function rawFlags(row) {
  const flags = String(row.flagsRaw || '').split('|').map(item => item.trim().toLowerCase()).filter(Boolean);
  const chips = [];
  if (flags.includes('critical')) chips.push(['CRIT', 'crit']);
  if (flags.includes('flank') || flags.includes('combatadvantage')) chips.push(['CA', 'ca']);
  if (flags.includes('dodge') || flags.includes('deflect') || flags.includes('deflected')) chips.push(['DEFLECT', 'deflect']);
  if (flags.includes('kill')) chips.push(['KILL', 'kill']);
  return chips.map(([label, tone]) => `<span class="raw-flag ${tone}">${label}</span>`).join(' ');
}

function debuff(row) {
  const damage = Number(row.amount) || 0;
  const base = Number(row.baseAmount) || 0;
  if (!base) return '—';
  const value = (damage / base - 1) * 100;
  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
}

function rawHitsHtml(detail) {
  if (!detail) return '';
  const firstTime = detail.firstTime ?? detail.rows?.[0]?.time ?? 0;
  return `<section class="raw-hits-panel">
    <div class="raw-hits-head"><div><span class="eyebrow">Source rows · verified session</span><h3>Raw hits — ${esc(detail.power)} <small>(${compact(detail.rows.length)} shown)</small></h3></div><button class="raw-close" type="button" data-close-power aria-label="Close raw hits">×</button></div>
    ${detail.rows.length ? `<div class="table-wrap raw-hits-scroll"><table class="raw-hits-table"><thead><tr><th>Time</th><th>+Offset</th><th>Target</th><th class="num">Damage</th><th class="num">Base</th><th class="num">Debuff%</th><th>Type</th><th>Flags</th></tr></thead><tbody>${detail.rows.map(row => `<tr><td>${esc(logTimestamp(row.abs, row.time))}</td><td>+${Math.max(0, row.time - firstTime).toFixed(2)}s</td><td>${esc(row.targetName || row.targetRef)}</td><td class="num"><strong>${compactHtml(row.amount)}</strong></td><td class="num">${compactHtml(row.baseAmount)}</td><td class="num raw-debuff">${esc(debuff(row))}</td><td>${esc(row.damageType)}</td><td>${rawFlags(row)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-block">${detail.loading ? 'Loading canonical damage rows...' : 'No canonical raw hits for this power in the selected scope.'}</div>`}
    <div class="raw-hits-foot"><span>Debuff% = (Damage / Base − 1) × 100</span>${detail.next != null ? '<button class="button raw-more" type="button" data-more-power>Load 250 more</button>' : ''}</div>
  </section>`;
}

async function loadPowerHits(power, reset = false) {
  if (!power || state.powerDetail?.loading) return;
  if (reset || !state.powerDetail || state.powerDetail.power !== power || state.powerDetail.playerRef !== state.playerRef || state.powerDetail.scopeKey !== scopeKey()) {
    state.powerDetail = { power, playerRef: state.playerRef, scopeKey: scopeKey(), rows: [], next: null, firstTime: null, loading: false };
  }
  const detail = state.powerDetail;
  detail.loading = true;
  try {
    const page = await request('raw-page', { options: {
      cursor: reset ? null : detail.next,
      limit: 250,
      playerRef: state.playerRef,
      powerName: power,
      kind: 'damage',
      validDamageOnly: true,
      scope: currentScopeForWorker()
    }});
    if (!page?.verification || page.verification.status !== 'verified') throw new Error('Raw rows are blocked until both engines verify the session.');
    detail.rows.push(...(page.rows || []));
    detail.next = page.nextCursor;
    if (detail.firstTime == null && detail.rows.length) detail.firstTime = detail.rows[0].time;
  } catch (error) {
    toast(error.message || String(error), 'bad');
  } finally {
    detail.loading = false;
    if (state.view === 'powers') renderPowers();
  }
}

function bindPowerRows() {
  el.root.querySelectorAll('[data-power-row]').forEach(row => row.addEventListener('click', event => {
    if (event.target.closest('button')) return;
    const power = row.dataset.powerRow;
    if (state.powerDetail?.power === power) {
      state.powerDetail = null;
      renderPowers();
      return;
    }
    loadPowerHits(power, true);
  }));
  el.root.querySelector('[data-close-power]')?.addEventListener('click', () => { state.powerDetail = null; renderPowers(); });
  el.root.querySelector('[data-more-power]')?.addEventListener('click', () => loadPowerHits(state.powerDetail?.power, false));
}

async function renderPowers(epoch = renderEpoch) {
  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading power damage', 'Calculating power totals for the selected fight.', 'scope-report'));
  const report = await getScopeReport();
  if (!report || epoch !== renderEpoch || state.view !== 'powers') return;
  const player = currentPlayer(report);
  if (!player) {
    replaceRoot('<section class="panel"><div class="panel-head"><h2>Damage out</h2></div><div class="empty-block">No player damage in this scope.</div></section>');
    return;
  }
  state.playerRef = player.ref;
  el.player.value = player.ref;
  const powers = player.powers || [];
  const categories = player.categories || [];
  replaceRoot(`
    <section class="verification-strip">${verificationBadge(report.verification)}<span>${esc(player.name)} · ${esc(classLabel(player))}</span></section>
    <section class="metrics">
      ${metric('Damage', compactHtml(player.damage), `${pct(player.damageShare)} party share`)}
      ${metric('DPS', compactHtml(player.dps), dur(player.duration))}
      ${metric('Combat DPS', compactHtml(player.combatDps), `${dur(player.combatTime)} in combat`)}
      ${metric('Critical', pct(player.crit), `Max ${compact(player.maxHit)}`)}
    </section>
    <section class="panel category-panel"><div class="panel-head"><div><span class="eyebrow">Damage by category</span><h2>Contribution mix</h2></div><span>${compact(categories.length)} categories</span></div>${bars(categories, { labelKey: 'category', limit: 20 })}</section>
    <section class="panel chart-panel"><div class="panel-head"><div><span class="eyebrow">${esc(player.name)}</span><h2>Damage over time</h2></div><span>${esc(report.scope?.label || scopeName())}</span></div><div class="chart-host" data-chart id="player-chart"></div></section>
    <section class="panel damage-out-panel"><div class="panel-head"><div><span class="eyebrow">Damage out</span><h2>${compact(powers.length)} powers</h2></div><span>Click a row for source hits</span></div>
      ${powers.length ? `<div class="table-wrap"><table class="power-table"><thead><tr><th>Power</th><th>Category</th><th class="num">Hits</th><th class="num">Damage</th><th class="num">%</th><th class="num">Avg</th><th class="num">Max</th><th class="num">Crit%</th><th class="num">Flank%</th></tr></thead><tbody>${powers.map(power => `<tr data-power-row="${esc(power.power)}" class="${state.powerDetail?.power === power.power ? 'selected' : ''}"><td><span class="row-chevron">›</span><strong>${esc(power.power)}</strong></td><td><span class="category-badge">${esc(power.category || 'Other / Unknown')}</span></td><td class="num">${compactHtml(power.hits)}</td><td class="num"><strong>${compactHtml(power.damage)}</strong></td><td class="num">${pct(power.share)}</td><td class="num">${compactHtml(power.avg)}</td><td class="num">${compactHtml(power.max)}</td><td class="num">${pct(power.crit)}</td><td class="num">${pct(power.flank)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-block">No canonical power damage in this scope.</div>'}
      ${rawHitsHtml(state.powerDetail)}
    </section>`);
  renderTimelineChart($('player-chart'), [{ label: player.name, points: player.timeline || [] }], { ariaLabel: `${player.name} damage over time` });
  bindPowerRows();
  revealCards(el.root);
}

function rotationRuler(duration) {
  const ticks = 9;
  return `<div class="rotation-ruler">${Array.from({ length: ticks }, (_, index) => {
    const ratio = index / (ticks - 1);
    return `<span style="left:${ratio * 100}%">${dur(duration * ratio)}</span>`;
  }).join('')}</div>`;
}

function rotationCanvasWidth(duration) {
  return Math.max(920, Math.min(4200, Math.ceil(Math.max(1, Number(duration) || 1) * 0.55)));
}

function visibleRotationCount(lane) {
  if (lane?.categoryCounts) {
    let count = 0;
    for (const category of state.rotationFilters) count += Number(lane.categoryCounts[category]) || 0;
    return count;
  }
  let count = 0;
  for (const item of lane?.activations || []) if (state.rotationFilters.has(item.category)) count += 1;
  return count;
}

function updateRotationCounts(report) {
  let visibleTotal = 0;
  el.root.querySelectorAll('[data-rotation-count]').forEach(node => {
    const lane = report.lanes.find(item => item.ref === node.dataset.rotationCount);
    if (!lane) return;
    const visible = visibleRotationCount(lane);
    visibleTotal += visible;
    node.textContent = `${lane.className || 'Unknown'} · ${compact(visible)} visible / ${compact(lane.activationCount)} total`;
  });
  const total = el.root.querySelector('[data-rotation-visible-total]');
  if (total) total.textContent = `${compact(visibleTotal)} visible · ${compact(report.activationCount)} verified total`;
  const all = el.root.querySelector('[data-rotation-all]');
  if (all) {
    const active = state.rotationFilters.size === ROTATION_CATEGORIES.length;
    all.classList.toggle('is-active', active);
    all.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

function drawRotation(report) {
  if (window.StrikeglassViewportTimeline) return;
  const filters = state.rotationFilters;
  const width = rotationCanvasWidth(report.duration);
  const css = getComputedStyle(document.documentElement);
  const color = {
    'At-Will': css.getPropertyValue('--green').trim() || '#63f5b0',
    Encounter: css.getPropertyValue('--blue').trim() || '#4fa3ff',
    Daily: css.getPropertyValue('--red').trim() || '#ff6f78',
    Artifact: css.getPropertyValue('--cyan').trim() || '#65e4ff',
    Mount: css.getPropertyValue('--amber').trim() || '#ffbf69'
  };
  const canvases = Array.from(el.root.querySelectorAll('canvas[data-rotation-lane]'));
  const token = ++rotationPaintToken;
  let canvasIndex = 0;

  const paintNext = () => {
    if (token !== rotationPaintToken || canvasIndex >= canvases.length) return;
    const canvas = canvases[canvasIndex++];
    if (!canvas?.isConnected) return;
    const lane = report.lanes.find(item => item.ref === canvas.dataset.rotationLane);
    if (!lane) { requestAnimationFrame(paintNext); return; }
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const height = 42;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = css.getPropertyValue('--line').trim() || '#315064';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 6);
    ctx.lineTo(width, height - 6);
    ctx.stroke();

    let maxAmount = 1;
    for (const item of lane.activations || []) {
      if (!filters.has(item.category)) continue;
      maxAmount = Math.max(maxAmount, Number(item.amount) || 0);
    }
    for (const item of lane.activations || []) {
      if (!filters.has(item.category)) continue;
      const x = Math.max(1, Math.min(width - 1, (Number(item.time) || 0) / Math.max(1, report.duration) * width));
      const markerHeight = 8 + Math.sqrt((Number(item.amount) || 0) / maxAmount) * 22;
      ctx.strokeStyle = color[item.category] || color.Encounter;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, height - 6);
      ctx.lineTo(x, height - 6 - markerHeight);
      ctx.stroke();
    }
    if (canvasIndex < canvases.length) requestAnimationFrame(paintNext);
  };

  requestAnimationFrame(paintNext);
}

function bindRotationFilters(report) {
  el.root.querySelectorAll('[data-rotation-filter]').forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.rotationFilter;
    if (state.rotationFilters.has(category)) state.rotationFilters.delete(category);
    else state.rotationFilters.add(category);
    button.classList.toggle('is-active', state.rotationFilters.has(category));
    button.setAttribute('aria-pressed', state.rotationFilters.has(category) ? 'true' : 'false');
    updateRotationCounts(report);
    drawRotation(report);
  }));
  el.root.querySelector('[data-rotation-all]')?.addEventListener('click', () => {
    state.rotationFilters.clear();
    for (const category of ROTATION_CATEGORIES) state.rotationFilters.add(category);
    el.root.querySelectorAll('[data-rotation-filter]').forEach(button => {
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
    });
    updateRotationCounts(report);
    drawRotation(report);
  });
}

async function renderRotation(epoch = renderEpoch) {
  if (!state.rotation || state.rotationKey !== scopeKey()) replaceRoot(taskLoading('Loading power timing', 'Reading damaging power uses and checking them before display.', 'rotation-report'));
  const report = await getRotationReport();
  if (!report || epoch !== renderEpoch || state.view !== 'rotation') return;
  const width = rotationCanvasWidth(report.duration);
  replaceRoot(`
    <section class="verification-strip">${verificationBadge(report.verification)}<span data-rotation-visible-total>${compact(report.activationCount)} visible · ${compact(report.activationCount)} verified total</span></section>
    <section class="panel rotation-panel"><div class="panel-head"><div><span class="eyebrow">Party rotation</span><h2>Activated damage powers on one clock</h2></div><span>${dur(report.duration)}</span></div>
      <div class="rotation-help">Markers are inferred from canonical player damage rows. Passive procs, feats, class features and companion attacks are excluded; repeated multi-hit rows are collapsed by power type. Category buttons are visibility filters, so each lane shows a live visible count beside its verified total.</div>
      <div class="rotation-filters" aria-label="Rotation categories"><button type="button" data-rotation-all aria-pressed="${state.rotationFilters.size === ROTATION_CATEGORIES.length ? 'true' : 'false'}" class="${state.rotationFilters.size === ROTATION_CATEGORIES.length ? 'is-active' : ''}">All</button>${ROTATION_CATEGORIES.map(category => `<button type="button" data-rotation-filter="${esc(category)}" aria-pressed="${state.rotationFilters.has(category) ? 'true' : 'false'}" class="${state.rotationFilters.has(category) ? 'is-active' : ''}">${esc(category)}</button>`).join('')}</div>
      <div class="rotation-shell"><div class="rotation-label-spacer"></div><div class="rotation-scroll" id="rotation-scroll"><div class="rotation-timeline" style="width:${width}px">${rotationRuler(report.duration)}</div></div>
      ${report.lanes.map(lane => `<div class="rotation-lane"><div class="rotation-lane-label"><strong>${esc(lane.name)}</strong><span data-rotation-count="${esc(lane.ref)}">${esc(lane.className || 'Unknown')} · ${compact(visibleRotationCount(lane))} visible / ${compact(lane.activationCount)} total</span></div><div class="rotation-scroll"><canvas data-rotation-lane="${esc(lane.ref)}" aria-label="${esc(`${lane.name} power activation timeline`)}"></canvas></div></div>`).join('')}</div>
    </section>`);
  bindRotationFilters(report);
  updateRotationCounts(report);
  drawRotation(report);
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
    const page = await request('raw-page', { options: { cursor: reset ? null : state.rawNext, limit: 180, playerRef: state.rawPlayerRef, kind: state.rawKind, scope: currentScopeForWorker() }});
    if (!page?.verification || page.verification.status !== 'verified') throw new Error('Events are blocked until both engines verify the session.');
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
  replaceRoot(`<section class="verification-strip">${verificationBadge(state.summary?.verification)}<span>Raw source rows from the verified session</span></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">Indexed row store</span><h2>Event explorer</h2></div><span>${compact(state.rawRows.length)} shown</span></div>
    ${rawFilters()}
    ${state.rawRows.length ? `<div class="table-wrap raw"><table><thead><tr><th>Time</th><th>Owner</th><th>Target</th><th>Power</th><th>Damage type</th><th>Event type</th><th class="num">Amount</th></tr></thead><tbody>${state.rawRows.map(row => `<tr><td>${row.time.toFixed(2)}s</td><td>${esc(row.ownerName)}</td><td>${esc(row.targetName)}</td><td>${esc(row.powerName)}</td><td>${esc(row.damageType)}</td><td>${esc(row.kind)}</td><td class="num">${compactHtml(row.amount)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-block">Querying compact row store...</div>'}
    ${state.rawNext != null ? '<button class="button load-more" type="button">Load 180 more</button>' : ''}<div class="view-note">Rows are paged from the worker. The UI never renders the complete raw log at once.</div></section>`);
  bindRawFilters();
  if (auto && !state.rawRows.length) loadRaw(true);
}

function renderDiagnostics() {
  const summary = state.summary;
  const list = (items, empty) => items?.length ? `<div class="reason-list">${items.map(item => `<div class="reason"><strong>${esc(item.key)}</strong><span>${compactHtml(item.value)}</span></div>`).join('')}</div>` : `<div class="empty-block good-text">${empty}</div>`;
  const verification = summary.verification || {};
  replaceRoot(`
    <section class="verification-strip">${verificationBadge(verification)}<span>Combat engines matched · Effect Intelligence ${esc(summary.effectEngine?.status || 'on demand')}</span></section>
    <section class="metrics">
      ${metric('Accepted', compactHtml(summary.parsed), `${compact(summary.rejected)} rejected`)}
      ${metric('Acceptance', coverage(summary), `${compact(summary.lines)} lines inspected`)}
      ${metric('Valid damage', compactHtml(summary.validDamageRows), `${compact(summary.damage)} canonical damage`)}
      ${metric('Worker store', bytes(summary.estimatedStoreBytes), `${compact(summary.storedRows)} compact rows`)}
    </section>
    <section class="section-grid diagnostic-grid">
      <article class="panel"><div class="panel-head"><div><span class="eyebrow">Parser health</span><h2>Reject reasons</h2></div><span>${compact(summary.rejected)}</span></div>${list(summary.rejectReasons, 'No rejected structured rows.')}
        <div class="panel-head"><h2>Non-canonical damage types</h2></div>${list(summary.nonCanonicalDamageTypes, 'No positive non-Physical damage rows were excluded.')}
        <div class="panel-head"><h2>Unknown event types</h2></div>${list(summary.unknownTypes, 'No unknown event types.')}</article>
      <article class="panel"><div class="panel-head"><div><span class="eyebrow">Dual-engine traceability</span><h2>Verification</h2></div><span>${compact(verification.checkedFields || 0)} fields</span></div>
        <div class="verification-details"><div><span>Primary</span><strong>Combat accumulator V5</strong></div><div><span>Verifier</span><strong>${esc(verification.engine || 'Unavailable')}</strong></div><div><span>Status</span><strong class="${verification.status === 'verified' ? 'good-text' : 'bad-text'}">${esc(verification.status || 'Unavailable')}</strong></div><div><span>Warnings</span><strong>${compact(verification.warnings?.length || 0)}</strong></div></div>
        <div class="panel-head"><h2>Verifier warnings</h2></div>${list(verification.warnings, 'No verifier warnings.')}
        <div class="panel-head"><div><h2>Rejected row samples</h2></div><span>Max 40</span></div>${summary.rejectedSamples?.length ? `<div class="samples">${summary.rejectedSamples.map(sample => `<article><b>Line ${num(sample.lineNo)} · ${esc(sample.reason)}</b><code>${esc(sample.preview)}</code></article>`).join('')}</div>` : '<div class="empty-block good-text">Every structured row was accepted.</div>'}
      </article>
    </section>`);
}

async function render() {
  const epoch = ++renderEpoch;
  setView(state.view);
  updateScopeControls();
  try {
    if (state.view === 'overview') await renderOverview(epoch);
    else if (state.view === 'rotation') await renderRotation(epoch);
    else if (state.view === 'comparison') await renderComparisonView(epoch);
    else if (state.view === 'boss') await renderBoss(epoch);
    else if (state.view === 'encounters') await renderEncounters();
    else if (state.view === 'players') await renderPlayers(epoch);
    else if (state.view === 'powers') await renderPowers(epoch);
    else if (state.view === 'debuffs') replaceRoot(taskLoading('Loading team debuffs', 'Reconstructing verified effect timing for the selected fight.', 'effect-intelligence-report'));
    else if (state.view === 'events') renderEvents();
    else renderDiagnostics();
    if (epoch !== renderEpoch) return;
    if (!el.root.querySelector('[data-task-loading],.rotation-panel,.raw-hits-panel') && el.root.querySelectorAll('tr').length < 100) revealView(el.root);
    document.dispatchEvent(new CustomEvent('strikeglass:view-rendered', { detail: { view: state.view, epoch } }));
  } catch (error) {
    if (epoch !== renderEpoch) return;
    replaceRoot(`<section class="panel verification-blocked"><div class="panel-head"><h2>Analytics blocked</h2></div><div class="empty-block bad-text">${esc(error.message || error)}</div><div class="view-note">Strikeglass does not publish calculated values when the primary and verifier engines disagree.</div></section>`);
    toast(error.message || String(error), 'bad');
  }
}

function finish(summary) {
  if (summary?.verification?.status !== 'verified') {
    mode('empty');
    status('Verification blocked', 'bad');
    toast('The verifier did not approve this combat log. No calculated values were published.', 'bad');
    return;
  }
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
  status('Combat verified · Effect Engine ready', 'good');
  warmCharts();
  document.dispatchEvent(new CustomEvent('strikeglass:analysis-ready', { detail: { parsed: summary.parsed || 0 } }));
  render();
  toast(`Parsed and verified ${compact(summary.parsed)} events in ${(summary.parseMs / 1000).toFixed(2)}s`, 'good');
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
  state.rotation = null;
  state.rotationKey = '';
  state.powerDetail = null;
  state.rawRows = [];
  state.rawNext = null;
  clearCharts();
  mode('parsing');
  enableNav(false);
  el.fileName.textContent = file.name;
  el.topbarFile.textContent = `${file.name} · ${bytes(file.size)}`;
  el.partial.innerHTML = '<span class="empty-inline">Player totals are provisional until Engine 2 finishes verification.</span>';
  el.bar.style.transform = 'scaleX(0)';
  status('Engine 1 parsing', 'working');
  worker.postMessage({ type: 'parse', file });
}

worker.onmessage = event => {
  const message = event.data || {};
  if (message.type === 'task-progress') { updateTaskProgress(message); return; }
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
    const phaseText = progress.phase === 'indexing' ? 'Indexing fights and targets...' : progress.phase === 'verifying' ? 'Engine 2 independently verifying combat metrics...' : progress.phase === 'finalizing' ? 'Preparing the shared analysis store...' : 'Engine 1 reading and aggregating the log...';
    el.phase.textContent = phaseText;
    status(progress.phase === 'verifying' ? 'Engine 2 verifying' : `${Math.round(ratio * 100)}% parsed`, 'working');
  } else if (message.type === 'partial-summary') {
    const players = (message.summary.players || []).slice(0, 6);
    const max = Math.max(1, ...players.map(player => player.damage));
    el.partial.innerHTML = players.length ? players.map((player, index) => `<div class="partial-row"><span>${index + 1}</span><strong>${esc(player.name)}</strong><i style="--bar:${Math.max(2, player.damage / max * 100)}%"></i><b>${compact(player.damage)}</b></div>`).join('') : '<span class="empty-inline">Waiting for canonical player damage...</span>';
  } else if (message.type === 'done') {
    finish(message.summary);
  } else if (message.type === 'error') {
    mode('empty');
    el.topbarFile.textContent = 'No combat log linked';
    status(message.verification ? 'Verification blocked' : 'Parser error', 'bad');
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
el.player.addEventListener('change', () => {
  state.playerRef = el.player.value;
  state.powerDetail = null;
  render();
});
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
