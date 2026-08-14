import { ENCOUNTER_POWER_ICON_SPRITE, findEncounterPowerIcon } from '../data/encounter-power-icons.js';
import { workerRequest } from '../v3/power-popup/worker.js';

const root = document.getElementById('view-root');
const scopeSelect = document.getElementById('encounter-select');
const bossOnly = document.getElementById('boss-target-only');
const playerSelect = document.getElementById('player-select');
const workspaceTitle = document.getElementById('workspace-title');
const nav = document.getElementById('app-nav');
const cache = new Map();
let renderToken = 0;
let observer = null;
let scheduled = 0;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const percent = value => `${(Number(value) || 0).toFixed(1)}%`;
const duration = value => {
  const seconds = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder.toFixed(1).padStart(4, '0')}s` : `${seconds.toFixed(1)}s`;
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
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M4.2 7.5l3.5 2M16.3 14.5l3.5 2M4.2 16.5l3.5-2M16.3 9.5l3.5-2M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"/></svg><span>Team Debuffs</span>';
  bossButton.insertAdjacentElement('afterend', button);
  return button;
}

const debuffNav = ensureDebuffNav();

function isDebuffView() {
  return Boolean(debuffNav?.classList.contains('is-active'));
}

function currentFightScope() {
  const value = scopeSelect?.value || '';
  if (value === 'session') return { type: 'session' };
  const match = value.match(/^(boss|encounter):(\d+)$/);
  if (!match) return null;
  return { type: match[1], id: Number(match[2]), targetOnly: false };
}

function scopeKey(scope) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${scope.id}:window`;
}

function selectedFightLabel() {
  const option = scopeSelect?.selectedOptions?.[0];
  return option?.textContent?.trim() || 'Selected fight';
}

function setToolbarMode(active) {
  const playerField = playerSelect?.closest('.field');
  const bossField = bossOnly?.closest('.check-field');
  if (playerField) playerField.hidden = active;
  if (bossField) bossField.hidden = active || !String(scopeSelect?.value || '').startsWith('boss:');
}

function effectIcon(effect) {
  if (!effect || !['class-power', 'class-feat', 'class-effect'].includes(effect.family)) return '';
  const icon = findEncounterPowerIcon(effect.name);
  if (!icon) return '';
  const scale = .5;
  const style = [
    `background-image:url('${ENCOUNTER_POWER_ICON_SPRITE.url}')`,
    `background-size:${ENCOUNTER_POWER_ICON_SPRITE.width * scale}px ${ENCOUNTER_POWER_ICON_SPRITE.height * scale}px`,
    `background-position:-${icon.x * scale}px -${icon.y * scale}px`
  ].join(';');
  return `<span class="debuff-power-icon" style="${esc(style)}" aria-hidden="true"></span>`;
}

function changeCopy(effect) {
  return (effect.changes || []).map(change => {
    const value = change.unit === 'percent' ? `${change.value}%` : String(change.value);
    return change.direction === 'up' ? `${change.stat} +${value}` : `${change.stat} -${value}`;
  }).join(' · ');
}

function sourceLabel(effect) {
  return effect.sourceName ? `${effect.sourceType} · ${effect.sourceName}` : (effect.sourceType || 'Team debuff');
}

function empiricalLabel(empirical) {
  const value = empirical?.status || 'unavailable';
  return ({
    matched: 'Matched',
    supported: 'Supported',
    'evidence-only': 'Timeline evidence',
    'no-baseline': 'No clean baseline',
    limited: 'Limited samples',
    mismatch: 'Needs review',
    'not-timed': 'Not timed'
  })[value] || value;
}

function confidenceClass(confidence) {
  return confidence === 'UNRESOLVED' ? 'bad-text' : confidence === 'MEDIUM' ? 'warn-text' : 'good-text';
}

function effectTiming(effect) {
  const timed = (effect.targets || []).filter(target => Number.isFinite(Number(target.uptime)) && target.verified);
  if (!timed.length || effect.verification?.publishUptime === false) return null;
  if (timed.length === 1) return { label: percent(timed[0].uptime), detail: `${duration(timed[0].seconds)} active` };
  return { label: `${timed.length} targets`, detail: 'timed separately' };
}

function sourceRows(effect) {
  if (!effect.sources?.length) return '<div class="debuff-empty">The log did not record who applied this effect.</div>';
  return `<div class="debuff-source-list">${effect.sources.map(source => `<div class="debuff-source-row"><div><strong>${esc(source.name || 'Unknown source')}</strong><span>${source.applications} application${source.applications === 1 ? '' : 's'}</span></div></div>`).join('')}</div>`;
}

function targetRows(effect) {
  if (!effect.targets?.length) return '<div class="debuff-empty">No target timing was available.</div>';
  return `<div class="debuff-source-list">${effect.targets.map(target => {
    const show = effect.verification?.publishUptime !== false && target.verified && Number.isFinite(Number(target.uptime));
    return `<div class="debuff-source-row"><div><strong>${esc(target.name || target.ref)}</strong><span>${target.applications} application${target.applications === 1 ? '' : 's'}</span></div><div class="debuff-source-result">${show ? `<strong>${percent(target.uptime)}</strong><span>${duration(target.seconds)} active</span>` : '<strong>Review</strong><span>uptime not published</span>'}</div></div>`;
  }).join('')}</div>`;
}

function effectRow(effect) {
  const timing = effectTiming(effect);
  const result = timing?.label || (effect.verification?.empirical?.status === 'mismatch' ? 'Review' : `${effect.applications}x`);
  const resultDetail = timing?.detail || (effect.duration ? 'applications / timing' : 'applications');
  const changes = changeCopy(effect);
  const empirical = effect.verification?.empirical || {};
  const uplift = Number.isFinite(Number(empirical.medianUplift)) ? `${(Number(empirical.medianUplift) * 100).toFixed(1)}%` : '—';
  const agreement = Number.isFinite(Number(empirical.directionAgreement)) ? percent(Number(empirical.directionAgreement) * 100) : '—';
  return `<details class="debuff-item debuff-inventory-item team-debuff-row">
    <summary>
      <div class="debuff-item-identity">${effectIcon(effect)}<div class="debuff-item-name"><span><b class="debuff-source-badge">${esc(sourceLabel(effect))}</b></span><strong>${esc(effect.name)}</strong><small>${esc(effect.description || 'Helps the party deal more damage to the target.')}</small></div></div>
      <div class="debuff-item-result"><strong>${esc(result)}</strong><span>${esc(resultDetail)}</span></div>
    </summary>
    <div class="debuff-item-body">
      ${changes ? `<p class="debuff-time-copy"><strong>What helps damage:</strong> ${esc(changes)}</p>` : ''}
      ${effect.duration ? `<p class="debuff-time-copy"><strong>Known duration:</strong> ${duration(effect.duration)} per application${effect.refreshes ? ', refreshed by another valid trigger' : ''}.</p>` : '<p class="debuff-time-copy">A safe fixed duration is not locked down, so Strikeglass does not invent uptime.</p>'}
      <div class="effect-verification" aria-label="Effect verification">
        <div><span>Timeline</span><strong class="${effect.verification?.timelineVerified ? 'good-text' : 'bad-text'}">${effect.verification?.timelineVerified ? 'Matched' : 'Needs review'}</strong></div>
        <div><span>Damage check</span><strong>${esc(empiricalLabel(empirical))}${empirical.comparableHits ? ` · ${empirical.comparableHits} hits` : ''}</strong></div>
        <div><span>Confidence</span><strong class="${confidenceClass(effect.verification?.confidence)}">${esc(effect.verification?.confidence || 'MEDIUM')}</strong></div>
      </div>
      ${empirical.mode === 'damage-baseline' && empirical.comparableHits ? `<p class="debuff-time-copy"><strong>Observed vs clean baseline:</strong> median ${esc(uplift)} higher · ${esc(agreement)} of comparable hits moved in the expected direction · ${empirical.players || 0} player${empirical.players === 1 ? '' : 's'}.</p>` : ''}
      <div class="debuff-detail-columns">
        <div class="debuff-who"><h4>Who applied it</h4>${sourceRows(effect)}</div>
        <div class="debuff-who"><h4>Target uptime</h4>${targetRows(effect)}</div>
      </div>
    </div>
  </details>`;
}

function pageFrame(content, { busy = false } = {}) {
  return `<section class="debuff-page" data-debuff-page ${busy ? 'aria-busy="true"' : ''}>
    <section class="panel debuff-page-intro">
      <div><span class="eyebrow">${esc(selectedFightLabel())}</span><h2>What made the boss take more damage?</h2><p>Only shared offensive effects are shown: enhancements, class debuffs, rings and gear, companions, mounts, artifacts, and other effects that help the team damage the target.</p></div>
      <div class="debuff-meaning"><strong>How Strikeglass checks this</strong><span>Known effect timing is reconstructed from the log, then comparable damage is checked against clean amount/baseAmount baselines when enough samples exist.</span></div>
    </section>
    ${content}
  </section>`;
}

function loadingPage() {
  return pageFrame(`<section class="panel debuff-loading"><div class="panel-head"><div><span class="eyebrow">Effect Engine</span><h2>Reconstructing the selected fight</h2></div><strong>Working…</strong></div><p>Finding applications, refreshes, target states, and comparable clean hits inside the worker.</p><div class="debuff-skeleton" aria-hidden="true"><i></i><i></i><i></i></div></section>`, { busy: true });
}

function noFightPage() {
  return pageFrame('<section class="panel"><div class="panel-head"><div><span class="eyebrow">Choose a fight</span><h2>No fight selected</h2></div></div><div class="empty-block">Choose a boss fight or combat window above.</div></section>');
}

function errorPage(message) {
  return pageFrame(`<section class="panel verification-blocked"><div class="panel-head"><h2>Effect analysis unavailable</h2></div><div class="empty-block bad-text">${esc(message)}</div></section>`);
}

function unexplainedSection(report) {
  const windows = report.unexplainedAmplification || [];
  if (!windows.length) return '';
  return `<details class="panel"><summary class="panel-head"><div><span class="eyebrow">Research signal</span><h2>Unexplained damage windows</h2></div><span>${windows.length}</span></summary><p class="debuff-results-help">The party's normalized damage rose together, but no known team effect currently explains these windows. Strikeglass does not assign a debuff name without matching log evidence.</p><div class="unexplained-window-list">${windows.map(window => `<div class="unexplained-window"><div><strong>${duration(window.start)} → ${duration(window.end)}</strong><span>${window.hits} comparable hits · ${window.players} players</span></div><b>~+${(Number(window.medianUplift || 0) * 100).toFixed(1)}%</b></div>`).join('')}</div></details>`;
}

function renderAnalysis(report) {
  const effects = report.teamEffects || [];
  const verification = report.verification || {};
  const statusClass = verification.status === 'verified' ? 'is-good' : verification.status === 'attention' ? 'is-review' : 'bad-text';
  const list = effects.length ? `<div class="debuff-list">${effects.map(effectRow).join('')}</div>` : '<div class="empty-block">No shared offensive debuff was found in this fight. Personal-only procs, defensive effects, and enemy mechanics are intentionally left out.</div>';
  replacePage(pageFrame(`
    <div class="effect-health-strip" role="status"><strong>${effects.length} team debuff${effects.length === 1 ? '' : 's'} found</strong><span>${report.summary?.timedEffects || 0} with known timing</span><span>${report.baseline?.comparableBuckets || 0} clean comparison groups</span><span class="${statusClass}">Effect engine: ${esc(verification.status || 'unavailable')}</span></div>
    <section class="panel debuff-results"><div class="panel-head"><div><span class="eyebrow">Party damage only</span><h2>Team debuffs</h2></div><span>${effects.length}</span></div><p class="debuff-results-help">Open an effect to see who applied it, its known mechanic, reconstructed uptime, and whether observed damage supported that timing.</p>${list}</section>
    ${unexplainedSection(report)}
  `));
}

function replacePage(html) {
  if (!root) return;
  root.innerHTML = html;
  if (workspaceTitle) workspaceTitle.textContent = 'Team Debuffs';
  setToolbarMode(true);
}

async function refresh() {
  if (!isDebuffView() || !root) return;
  const scope = currentFightScope();
  if (!scope) {
    replacePage(noFightPage());
    return;
  }
  const key = scopeKey(scope);
  const token = ++renderToken;
  replacePage(loadingPage());
  try {
    let report = cache.get(key);
    if (!report) {
      report = await workerRequest('effect-intelligence-report', { scope }, 90000);
      if (report?.verification?.status === 'blocked') throw new Error('The deterministic effect checks did not agree, so Strikeglass blocked the effect timeline.');
      cache.set(key, report);
      if (cache.size > 8) cache.delete(cache.keys().next().value);
    }
    if (token !== renderToken || !isDebuffView() || scopeKey(currentFightScope()) !== key) return;
    renderAnalysis(report);
  } catch (error) {
    if (token !== renderToken || !isDebuffView()) return;
    replacePage(errorPage(error.message || String(error)));
  }
}

function scheduleRefresh() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(refresh);
}

document.addEventListener('strikeglass:view-rendered', event => {
  if (event.detail?.view === 'debuffs') scheduleRefresh();
});

nav?.addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  renderToken += 1;
  if (button.dataset.view === 'debuffs') scheduleRefresh();
  else setToolbarMode(false);
});

scopeSelect?.addEventListener('change', () => {
  if (!isDebuffView()) return;
  renderToken += 1;
  scheduleRefresh();
});

window.addEventListener('strikeglass:worker-ready', () => cache.clear());

if (isDebuffView()) scheduleRefresh();
