import { analyzeBossEffects } from '../engine/boss-effects.js';

const root = document.getElementById('view-root');
const scopeSelect = document.getElementById('encounter-select');
const bossOnly = document.getElementById('boss-target-only');
const nav = document.getElementById('app-nav');
const cache = new Map();
const pending = new Map();
let worker = window.StrikeglassWorkerBridge?.mainWorker || null;
let requestSequence = 880000000;
let renderToken = 0;
let observedWorker = null;
let observer = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const percent = value => `${(Number(value) || 0).toFixed(1)}%`;
const duration = value => {
  const seconds = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return minutes ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${seconds.toFixed(1)}s`;
};

function currentBossScope() {
  const value = scopeSelect?.value || '';
  const match = value.match(/^boss:(\d+)$/);
  return match ? { type: 'boss', id: Number(match[1]), targetOnly: true } : null;
}

function scopeKey(scope) {
  return scope ? `boss:${scope.id}:target` : '';
}

function bossViewReady() {
  return Boolean(nav?.querySelector('[data-view="boss"].is-active') && root?.querySelector('.boss-grid') && !root.querySelector('[data-task-loading]'));
}

function attachWorker(nextWorker) {
  if (!nextWorker || nextWorker === observedWorker) return;
  worker = nextWorker;
  observedWorker = nextWorker;
  worker.addEventListener('message', event => {
    const message = event.data || {};
    const item = pending.get(message.requestId);
    if (item && message.type === 'raw-page') {
      pending.delete(message.requestId);
      if (message.error) item.reject(new Error(message.error));
      else item.resolve(message.page);
    }
    if (message.type === 'done') {
      cache.clear();
      renderToken += 1;
    }
  });
}

attachWorker(worker);
window.addEventListener('strikeglass:worker-ready', event => attachWorker(event.detail?.worker));

function rawPage(options) {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('Combat worker is not ready.')); return; }
    const requestId = ++requestSequence;
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ type: 'raw-page', requestId, options });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error('Boss effect scan timed out.'));
    }, 45000);
  });
}

async function readBossRows(scope, token) {
  const rows = [];
  let cursor = null;
  let pages = 0;
  do {
    const page = await rawPage({ cursor, limit: 500, scope });
    if (token !== renderToken) return null;
    if (!page?.verification || page.verification.status !== 'verified') throw new Error('Boss effects are blocked until the combat log is checked twice.');
    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
    pages += 1;
    updateLoading(rows.length, pages);
    if (pages % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  } while (cursor != null);
  return rows;
}

function loadingPanel() {
  return `<section class="panel boss-effects-panel" data-boss-effects aria-busy="true">
    <div class="panel-head"><div><span class="eyebrow">Boss effects</span><h2>Debuffs and marks</h2></div><strong data-effects-progress>Starting…</strong></div>
    <p class="boss-effects-help">Reading verified boss-target rows and measuring effects only while the boss is actively taking damage.</p>
    <div class="boss-effects-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
  </section>`;
}

function updateLoading(rows, pages) {
  const label = root?.querySelector('[data-boss-effects] [data-effects-progress]');
  if (!label) return;
  label.textContent = rows ? `${rows.toLocaleString()} boss rows read` : `${pages} pages read`;
}

function observeRoot() {
  if (observer && root) observer.observe(root, { childList: true, subtree: false });
}

function ensurePanel(html) {
  observer?.disconnect();
  root?.querySelector('[data-boss-effects]')?.remove();
  const grid = root?.querySelector('.boss-grid');
  if (grid) grid.insertAdjacentHTML('afterend', html);
  observeRoot();
}

function sourceList(effect) {
  if (!effect.sources?.length) return '<div class="boss-effect-empty">No player source was recorded in the log.</div>';
  return `<div class="boss-effect-sources">${effect.sources.map(source => `<div><span>${esc(source.name)}</span><strong>${percent(source.uptime)}</strong><small>${duration(source.seconds)} · ${source.applications} application${source.applications === 1 ? '' : 's'}</small></div>`).join('')}</div>`;
}

function effectCard(effect) {
  const team = effect.audience === 'team';
  return `<article class="boss-effect-card">
    <header><div><span class="boss-effect-type">${esc(effect.type)}</span><h3>${esc(effect.name)}</h3></div>${team ? `<strong class="boss-effect-uptime">${percent(effect.uptime)}</strong>` : '<strong class="boss-effect-uptime">Per player</strong>'}</header>
    <p>${esc(effect.description)}</p>
    ${team ? `<div class="boss-effect-meter" aria-label="${esc(effect.name)} uptime ${percent(effect.uptime)}"><i style="--effect-uptime:${Math.max(0, Math.min(100, Number(effect.uptime) || 0))}%"></i></div><div class="boss-effect-meta"><span>${duration(effect.seconds)} active</span><span>${effect.applications} application${effect.applications === 1 ? '' : 's'}</span><span>${effect.duration}s each</span></div>` : sourceList(effect)}
    ${team && effect.sources?.some(source => source.ref) ? `<details><summary>Applied by</summary>${sourceList(effect)}</details>` : ''}
  </article>`;
}

function renderAnalysis(result) {
  if (!result.verification?.ok) {
    ensurePanel(`<section class="panel boss-effects-panel verification-blocked" data-boss-effects><div class="panel-head"><div><span class="eyebrow">Boss effects</span><h2>Debuff analysis blocked</h2></div></div><div class="empty-block bad-text">The two uptime calculations disagreed: ${esc(result.verification?.mismatches?.[0] || 'unknown mismatch')}.</div></section>`);
    return;
  }
  const team = result.effects.filter(effect => effect.audience === 'team');
  const personal = result.effects.filter(effect => effect.audience === 'personal');
  const signals = result.otherSignals || [];
  ensurePanel(`<section class="panel boss-effects-panel" data-boss-effects>
    <div class="panel-head"><div><span class="eyebrow">Boss effects</span><h2>Debuffs and marks</h2></div><span class="boss-effects-verified">Checked twice</span></div>
    <p class="boss-effects-help">Uptime uses ${duration(result.activeTime)} of boss-active time. Gaps longer than 5 seconds are not counted.</p>
    ${team.length ? `<div class="boss-effects-group"><h3>Team debuffs</h3><p>These effects can change how the whole group interacts with the boss.</p><div class="boss-effect-grid">${team.map(effectCard).join('')}</div></div>` : '<div class="empty-block">No recognized team debuffs were found on this boss.</div>'}
    ${personal.length ? `<div class="boss-effects-group"><h3>Personal target effects</h3><p>These effects help only the player who applied them, so uptime is shown separately for each player.</p><div class="boss-effect-grid">${personal.map(effectCard).join('')}</div></div>` : ''}
    ${signals.length ? `<details class="boss-effect-signals"><summary>Other boss status signals found in the log</summary><p>These rows look like target-status events, but Strikeglass does not assign uptime until their duration and meaning are known.</p><div>${signals.map(signal => `<span><strong>${esc(signal.name)}</strong> ${signal.applications} row${signal.applications === 1 ? '' : 's'}</span>`).join('')}</div></details>` : ''}
  </section>`);
}

async function refresh() {
  if (!bossViewReady()) return;
  const scope = currentBossScope();
  if (!scope) return;
  const key = scopeKey(scope);
  const token = ++renderToken;
  ensurePanel(loadingPanel());
  try {
    let result = cache.get(key);
    if (!result) {
      const rows = await readBossRows(scope, token);
      if (!rows || token !== renderToken) return;
      result = analyzeBossEffects(rows);
      cache.set(key, result);
    }
    if (token !== renderToken || !bossViewReady() || scopeKey(currentBossScope()) !== key) return;
    renderAnalysis(result);
  } catch (error) {
    if (token !== renderToken) return;
    ensurePanel(`<section class="panel boss-effects-panel" data-boss-effects><div class="panel-head"><div><span class="eyebrow">Boss effects</span><h2>Debuffs and marks</h2></div></div><div class="empty-block bad-text">${esc(error.message || error)}</div></section>`);
  }
}

let scheduled = 0;
function scheduleRefresh() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => refresh());
}

observer = new MutationObserver(() => scheduleRefresh());
observeRoot();
nav?.addEventListener('click', () => { renderToken += 1; scheduleRefresh(); });
scopeSelect?.addEventListener('change', () => { renderToken += 1; scheduleRefresh(); });
bossOnly?.addEventListener('change', () => { renderToken += 1; scheduleRefresh(); });
