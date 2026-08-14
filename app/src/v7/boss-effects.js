import { analyzeBossEffects } from '../engine/boss-effects.js';

const root = document.getElementById('view-root');
const scopeSelect = document.getElementById('encounter-select');
const bossOnly = document.getElementById('boss-target-only');
const playerSelect = document.getElementById('player-select');
const workspaceTitle = document.getElementById('workspace-title');
const nav = document.getElementById('app-nav');
const cache = new Map();
const pending = new Map();
let worker = window.StrikeglassWorkerBridge?.mainWorker || null;
let requestSequence = 880000000;
let renderToken = 0;
let observedWorker = null;
let observer = null;
let scheduled = 0;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const percent = value => `${(Number(value) || 0).toFixed(1)}%`;
const duration = value => {
  const seconds = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return minutes ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${seconds.toFixed(1)}s`;
};

function ensureDebuffNav() {
  if (!nav) return null;
  const existing = document.getElementById('debuff-uptime-nav');
  if (existing) return existing;
  const bossButton = nav.querySelector('[data-view="boss"]');
  if (!bossButton) return null;
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.type = 'button';
  button.id = 'debuff-uptime-nav';
  button.dataset.view = 'debuffs';
  button.disabled = bossButton.disabled;
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M4.2 7.5l3.5 2M16.3 14.5l3.5 2M4.2 16.5l3.5-2M16.3 9.5l3.5-2M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"/></svg><span>Debuff Uptime</span>';
  bossButton.insertAdjacentElement('afterend', button);
  return button;
}

const debuffNav = ensureDebuffNav();

function isDebuffView() {
  return Boolean(debuffNav?.classList.contains('is-active'));
}

function currentBossScope() {
  const value = scopeSelect?.value || '';
  const match = value.match(/^boss:(\d+)$/);
  return match ? { type: 'boss', id: Number(match[1]), targetOnly: true } : null;
}

function scopeKey(scope) {
  return scope ? `boss:${scope.id}:target` : '';
}

function selectedFightLabel() {
  const option = scopeSelect?.selectedOptions?.[0];
  return option?.textContent?.trim() || 'Selected boss fight';
}

function selectFirstBoss() {
  if (!scopeSelect) return false;
  const option = Array.from(scopeSelect.options).find(item => /^boss:\d+$/.test(item.value));
  if (!option) return false;
  scopeSelect.value = option.value;
  scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function setToolbarMode(active) {
  const playerField = playerSelect?.closest('.field');
  if (playerField) playerField.hidden = active;
  const bossField = bossOnly?.closest('.check-field');
  if (active && bossField) bossField.hidden = true;
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
    if (!worker) {
      reject(new Error('The combat log reader is not ready yet.'));
      return;
    }
    const requestId = ++requestSequence;
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ type: 'raw-page', requestId, options });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error('Debuff uptime took too long to load.'));
    }, 45000);
  });
}

async function readBossRows(scope, token) {
  const rows = [];
  let cursor = null;
  do {
    const page = await rawPage({ cursor, limit: 500, scope });
    if (token !== renderToken) return null;
    if (!page?.verification || page.verification.status !== 'verified') {
      throw new Error('Debuff uptime is shown only after the combat log passes both checks.');
    }
    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
    updateLoading(rows.length);
    if (rows.length && rows.length % 1500 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  } while (cursor != null);
  return rows;
}

function simpleDescription(effect) {
  if (effect.id === 'midnights-malady') return "Lowers the boss's Defense and Awareness by 3.5%.";
  if (effect.id === 'blood-lust') return 'Only increases damage from the player who applied it.';
  return String(effect.description || 'A debuff found on the boss.');
}

function simpleSourceName(source) {
  const name = String(source?.name || '').trim();
  if (!name || name === 'Source not recorded' || name === 'Unknown player') return 'Player not recorded in the log';
  return name;
}

function sourceRows(effect) {
  if (!effect.sources?.length) return '<div class="debuff-empty">The log did not record who applied this debuff.</div>';
  const teamEffect = effect.audience === 'team';
  return `<div class="debuff-source-list">${effect.sources.map(source => `<div class="debuff-source-row">
    <div><strong>${esc(simpleSourceName(source))}</strong><span>Applied ${source.applications} time${source.applications === 1 ? '' : 's'}</span></div>
    <div class="debuff-source-result">${teamEffect ? `<strong>${duration(source.seconds)}</strong><span>from their applications</span>` : `<strong>${percent(source.uptime)}</strong><span>${duration(source.seconds)} active</span>`}</div>
  </div>`).join('')}</div>`;
}

function effectDetails(effect) {
  const teamEffect = effect.audience === 'team';
  const uptimeLabel = teamEffect ? percent(effect.uptime) : `${effect.sources?.length || 0} player${effect.sources?.length === 1 ? '' : 's'}`;
  return `<details class="debuff-item">
    <summary>
      <div class="debuff-item-name"><span>${teamEffect ? 'Helps everyone' : 'Only helps that player'}</span><strong>${esc(effect.name)}</strong><small>${esc(simpleDescription(effect))}</small></div>
      <div class="debuff-item-result"><strong>${esc(uptimeLabel)}</strong><span>${teamEffect ? 'uptime' : 'tracked'}</span></div>
    </summary>
    <div class="debuff-item-body">
      ${teamEffect ? `<div class="debuff-meter" aria-label="${esc(effect.name)} uptime ${percent(effect.uptime)}"><i style="--debuff-uptime:${Math.max(0, Math.min(100, Number(effect.uptime) || 0))}%"></i></div>
        <p class="debuff-time-copy">This debuff stayed on the boss for <strong>${duration(effect.seconds)}</strong> of the active fight. It was applied <strong>${effect.applications}</strong> time${effect.applications === 1 ? '' : 's'}.</p>` : '<p class="debuff-time-copy">This debuff only helps the player who applied it, so each player has their own uptime.</p>'}
      <div class="debuff-who"><h4>Who applied it</h4>${sourceRows(effect)}</div>
    </div>
  </details>`;
}

function pageFrame(content, { busy = false } = {}) {
  return `<section class="debuff-page" data-debuff-page ${busy ? 'aria-busy="true"' : ''}>
    <section class="panel debuff-page-intro">
      <div><span class="eyebrow">${esc(selectedFightLabel())}</span><h2>Debuff uptime</h2><p>See how long each known debuff stayed on the boss.</p></div>
      <div class="debuff-meaning"><strong>What does uptime mean?</strong><span>50% uptime means the debuff was on the boss for half of the active fight.</span></div>
    </section>
    ${content}
  </section>`;
}

function loadingPage() {
  return pageFrame(`<section class="panel debuff-loading">
    <div class="panel-head"><div><span class="eyebrow">Checking the fight</span><h2>Finding debuffs</h2></div><strong data-effects-progress>Starting…</strong></div>
    <p>Strikeglass is reading the boss events and checking the result twice.</p>
    <div class="debuff-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
  </section>`, { busy: true });
}

function updateLoading(events) {
  const label = root?.querySelector('[data-effects-progress]');
  if (label) label.textContent = `${events.toLocaleString()} events checked`;
}

function noBossPage() {
  return pageFrame('<section class="panel"><div class="empty-block">No boss fight was found in this log, so there is no debuff uptime to show.</div></section>');
}

function errorPage(message) {
  return pageFrame(`<section class="panel"><div class="panel-head"><div><span class="eyebrow">Debuff uptime</span><h2>Could not show this fight</h2></div></div><div class="empty-block bad-text">${esc(message)}</div></section>`);
}

function renderAnalysis(result) {
  if (!result.verification?.ok) {
    const detail = result.verification?.mismatches?.[0] || '';
    replacePage(pageFrame(`<section class="panel verification-blocked"><div class="panel-head"><div><span class="eyebrow">Checked twice</span><h2>Uptime numbers hidden</h2></div></div><div class="empty-block bad-text">The two checks did not match, so Strikeglass did not show debuff uptime.</div>${detail ? `<details class="debuff-check-detail"><summary>Why was it hidden?</summary><p>${esc(detail)}</p></details>` : ''}</section>`));
    return;
  }

  const team = result.effects.filter(effect => effect.audience === 'team');
  const personal = result.effects.filter(effect => effect.audience === 'personal');
  const signals = result.otherSignals || [];
  const totalApplications = result.effects.reduce((sum, effect) => sum + Number(effect.applications || 0), 0);
  const effectsHtml = result.effects.length
    ? `<div class="debuff-list">${[...team, ...personal].map(effectDetails).join('')}</div>`
    : '<div class="empty-block">No debuffs that Strikeglass can time were found on this boss.</div>';

  replacePage(pageFrame(`
    <section class="debuff-summary" aria-label="Debuff uptime summary">
      <article><span>Boss fighting time</span><strong>${duration(result.activeTime)}</strong><small>Long pauses are not counted.</small></article>
      <article><span>Debuffs timed</span><strong>${result.effects.length}</strong><small>Only effects with a known safe duration.</small></article>
      <article><span>Times applied</span><strong>${totalApplications}</strong><small>Across the timed debuffs.</small></article>
      <article><span>Check</span><strong>Matched</strong><small>Two calculations agreed.</small></article>
    </section>
    <section class="panel debuff-results">
      <div class="panel-head"><div><span class="eyebrow">On this boss</span><h2>Debuffs found</h2></div><span>${result.effects.length} timed</span></div>
      <p class="debuff-results-help">Open a debuff to see who applied it and how long it stayed active.</p>
      ${effectsHtml}
    </section>
    ${signals.length ? `<details class="panel debuff-untimed"><summary>Effects found but not timed yet <span>${signals.length}</span></summary><p>Strikeglass found these effects on the boss, but does not yet know a safe duration for them. They are listed instead of guessed.</p><div>${signals.map(signal => `<span><strong>${esc(signal.name)}</strong><small>${signal.applications} event${signal.applications === 1 ? '' : 's'} found</small></span>`).join('')}</div></details>` : ''}
  `));
}

function observeRoot() {
  if (observer && root) observer.observe(root, { childList: true, subtree: false });
}

function replacePage(html) {
  if (!root) return;
  observer?.disconnect();
  root.innerHTML = html;
  observeRoot();
  if (workspaceTitle) workspaceTitle.textContent = 'Debuff uptime';
  setToolbarMode(true);
}

async function refresh() {
  if (!isDebuffView() || !root) return;
  if (workspaceTitle) workspaceTitle.textContent = 'Debuff uptime';
  setToolbarMode(true);
  let scope = currentBossScope();
  if (!scope) {
    if (selectFirstBoss()) return;
    replacePage(noBossPage());
    return;
  }

  const key = scopeKey(scope);
  const token = ++renderToken;
  replacePage(loadingPage());
  try {
    let result = cache.get(key);
    if (!result) {
      const rows = await readBossRows(scope, token);
      if (!rows || token !== renderToken) return;
      result = analyzeBossEffects(rows);
      cache.set(key, result);
    }
    if (token !== renderToken || !isDebuffView() || scopeKey(currentBossScope()) !== key) return;
    renderAnalysis(result);
  } catch (error) {
    if (token !== renderToken || !isDebuffView()) return;
    replacePage(errorPage(error.message || String(error)));
  }
}

function scheduleRefresh() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => refresh());
}

observer = new MutationObserver(() => {
  if (isDebuffView() && !root?.querySelector('[data-debuff-page]')) scheduleRefresh();
});
observeRoot();

nav?.addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  renderToken += 1;
  if (button.dataset.view === 'debuffs') scheduleRefresh();
  else {
    const playerField = playerSelect?.closest('.field');
    if (playerField) playerField.hidden = false;
  }
});

scopeSelect?.addEventListener('change', () => {
  if (!isDebuffView()) return;
  renderToken += 1;
  scheduleRefresh();
});
