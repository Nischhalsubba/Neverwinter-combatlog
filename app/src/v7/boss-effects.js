import { analyzeBossEffects } from '../engine/boss-effects.js';
import { analyzeCombatEffects } from '../engine/combat-effects.js';
import { isBossRef } from '../engine/fast-parser-core.js';
import { ENCOUNTER_POWER_ICON_SPRITE, findEncounterPowerIcon } from '../data/encounter-power-icons.js';

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

function currentFightScope() {
  const value = scopeSelect?.value || '';
  const match = value.match(/^(boss|encounter):(\d+)$/);
  if (!match) return null;
  return { type: match[1], id: Number(match[2]), targetOnly: false };
}

function scopeKey(scope) {
  return scope ? `${scope.type}:${scope.id}:window` : '';
}

function selectedFightLabel() {
  const option = scopeSelect?.selectedOptions?.[0];
  return option?.textContent?.trim() || 'Choose a fight';
}

function setToolbarMode(active) {
  const playerField = playerSelect?.closest('.field');
  const bossField = bossOnly?.closest('.check-field');
  if (playerField) playerField.hidden = active;
  if (bossField) bossField.hidden = active || !String(scopeSelect?.value || '').startsWith('boss:');
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
      reject(new Error('Debuff details took too long to load.'));
    }, 45000);
  });
}

async function readFightRows(scope, token) {
  const rows = [];
  let cursor = null;
  do {
    const page = await rawPage({ cursor, limit: 500, scope });
    if (token !== renderToken) return null;
    if (!page?.verification || page.verification.status !== 'verified') {
      throw new Error('Debuffs are shown only after the combat log passes both checks.');
    }
    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
    updateLoading(rows.length);
    if (rows.length && rows.length % 2000 === 0) await new Promise(resolve => setTimeout(resolve, 0));
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
  if (!name || name === 'Source not recorded' || name === 'Unknown player' || name === 'Unknown source') return 'Source not recorded in the log';
  return name;
}

function sourceRows(effect) {
  if (!effect.sources?.length) return '<div class="debuff-empty">The log did not record who applied this effect.</div>';
  const teamEffect = effect.audience === 'team';
  return `<div class="debuff-source-list">${effect.sources.map(source => `<div class="debuff-source-row">
    <div><strong>${esc(simpleSourceName(source))}</strong><span>Applied ${source.applications} time${source.applications === 1 ? '' : 's'}</span></div>
    <div class="debuff-source-result">${teamEffect ? `<strong>${duration(source.seconds)}</strong><span>from their applications</span>` : `<strong>${percent(source.uptime)}</strong><span>${duration(source.seconds)} active</span>`}</div>
  </div>`).join('')}</div>`;
}

function bossEffectDetails(effect) {
  const teamEffect = effect.audience === 'team';
  const uptimeLabel = teamEffect ? percent(effect.uptime) : `${effect.sources?.length || 0} player${effect.sources?.length === 1 ? '' : 's'}`;
  return `<details class="debuff-item">
    <summary>
      <div class="debuff-item-name"><span>${teamEffect ? 'Helps everyone' : 'Only helps that player'}</span><strong>${esc(effect.name)}</strong><small>${esc(simpleDescription(effect))}</small></div>
      <div class="debuff-item-result"><strong>${esc(uptimeLabel)}</strong><span>${teamEffect ? 'boss uptime' : 'tracked'}</span></div>
    </summary>
    <div class="debuff-item-body">
      ${teamEffect ? `<div class="debuff-meter" aria-label="${esc(effect.name)} uptime ${percent(effect.uptime)}"><i style="--debuff-uptime:${Math.max(0, Math.min(100, Number(effect.uptime) || 0))}%"></i></div>
        <p class="debuff-time-copy">This debuff stayed on the boss for <strong>${duration(effect.seconds)}</strong> of the active boss fight. It was applied <strong>${effect.applications}</strong> time${effect.applications === 1 ? '' : 's'}.</p>` : '<p class="debuff-time-copy">This debuff only helps the player who applied it, so each player has their own uptime.</p>'}
      <div class="debuff-who"><h4>Who applied it</h4>${sourceRows(effect)}</div>
    </div>
  </details>`;
}

function targetTiming(effect, target) {
  return effect.timedTargets?.find(item => item.ref === target.ref && item.verified) || null;
}

function inventorySources(effect) {
  if (!effect.sources?.length) return '<div class="debuff-empty">Source not recorded in the log.</div>';
  return `<div class="debuff-source-list">${effect.sources.map(source => `<div class="debuff-source-row"><div><strong>${esc(simpleSourceName(source))}</strong><span>Applied ${source.applications} time${source.applications === 1 ? '' : 's'}</span></div></div>`).join('')}</div>`;
}

function inventoryTargets(effect) {
  if (!effect.targets?.length) return '<div class="debuff-empty">Target not recorded in the log.</div>';
  return `<div class="debuff-source-list">${effect.targets.map(target => {
    const timing = targetTiming(effect, target);
    return `<div class="debuff-source-row"><div><strong>${esc(target.name)}</strong><span>${target.kind === 'boss' ? 'Boss' : target.kind === 'player' ? 'Player' : 'Enemy'} · Applied ${target.applications} time${target.applications === 1 ? '' : 's'}</span></div><div class="debuff-source-result">${timing ? `<strong>${percent(timing.uptime)}</strong><span>${duration(timing.seconds)} of ${duration(timing.activeTime)}</span>` : `<strong>${target.applications}</strong><span>applications</span>`}</div></div>`;
  }).join('')}</div>`;
}

function effectIcon(effect) {
  if (!effect || !['class-power', 'class-feat'].includes(effect.family)) return '';
  const icon = findEncounterPowerIcon(effect.name);
  if (!icon) return '';
  const scale = 0.5;
  const style = [
    "background-image:url('" + ENCOUNTER_POWER_ICON_SPRITE.url + "')",
    'background-size:' + (ENCOUNTER_POWER_ICON_SPRITE.width * scale) + 'px ' + (ENCOUNTER_POWER_ICON_SPRITE.height * scale) + 'px',
    'background-position:-' + (icon.x * scale) + 'px -' + (icon.y * scale) + 'px'
  ].join(';');
  return '<span class="debuff-power-icon" style="' + esc(style) + '" aria-hidden="true"></span>';
}

function classificationLabel(effect) {
  if (effect.classification === 'enemy-debuff') return 'Actual debuff';
  if (effect.classification === 'target-advantage') return 'Combat Advantage effect';
  if (effect.classification === 'personal-target-effect') return 'Personal target effect';
  if (effect.classification === 'ally-buff') return 'Party / player buff';
  if (effect.classification === 'support-window') return 'Support window';
  if (effect.classification === 'enemy-mechanic') return 'Enemy mechanic';
  if (effect.classification === 'player-effect') return 'Player effect';
  return 'Unclassified status';
}

function sourceCopy(effect) {
  const source = effect.source;
  if (!source?.label) return '';
  const detail = [source.section, source.updated].filter(Boolean).join(' · ');
  return detail ? `${source.label} · ${detail}` : source.label;
}

function changeCopy(effect) {
  const changes = effect.changes || [];
  if (!changes.length) return '';
  return changes.map(change => {
    const value = change.unit === 'percent' ? `${change.value}%` : String(change.value);
    return change.direction === 'up' ? `${change.stat} +${value}` : `${change.stat} -${value}`;
  }).join(' · ');
}

function inventoryDetails(effect) {
  const known = effect.family !== 'unknown';
  const timed = effect.timedTargets?.some(target => target.verified);
  const description = effect.description || 'The combat log recorded this status signal, but its exact gameplay meaning has not been safely mapped yet.';
  const source = sourceCopy(effect);
  const changes = changeCopy(effect);
  return `<details class="debuff-item debuff-inventory-item">
    <summary>
      <div class="debuff-item-identity">${effectIcon(effect)}<div class="debuff-item-name"><span>${esc(classificationLabel(effect))}</span><strong>${esc(effect.name)}</strong><small>${esc(description)}</small></div></div>
      <div class="debuff-item-result"><strong>${effect.applications}</strong><span>${effect.applications === 1 ? 'application' : 'applications'}${timed ? ' · uptime available' : ''}</span></div>
    </summary>
    <div class="debuff-item-body">
      ${changes ? `<p class="debuff-time-copy"><strong>What it changes:</strong> ${esc(changes)}</p>` : ''}
      ${source ? `<p class="debuff-time-copy"><strong>Reference:</strong> ${esc(source)}</p>` : ''}
      ${effect.notes ? `<p class="debuff-time-copy"><strong>Note:</strong> ${esc(effect.notes)}</p>` : ''}
      ${Number.isFinite(effect.duration) && effect.duration > 0 ? `<p class="debuff-time-copy">Known duration: <strong>${duration(effect.duration)}</strong> per application. Uptime is calculated separately for each target when enough verified damage activity exists.</p>` : '<p class="debuff-time-copy">Uptime is not guessed because a safe fixed duration is not locked down for this effect.</p>'}
      <div class="debuff-detail-columns">
        <div class="debuff-who"><h4>Who applied it</h4>${inventorySources(effect)}</div>
        <div class="debuff-who"><h4>Who it affected</h4>${inventoryTargets(effect)}</div>
      </div>
    </div>
  </details>`;
}

function catalogTimedDetails(effect) {
  const targets = (effect.timedTargets || []).filter(target => target.verified);
  if (!targets.length) return '';
  const summary = targets.length === 1 ? percent(targets[0].uptime) : `${targets.length} targets`;
  return `<details class="debuff-item">
    <summary>
      <div class="debuff-item-identity">${effectIcon(effect)}<div class="debuff-item-name"><span>Verified debuff</span><strong>${esc(effect.name)}</strong><small>${esc(effect.description)}</small></div></div>
      <div class="debuff-item-result"><strong>${esc(summary)}</strong><span>${targets.length === 1 ? 'uptime' : 'timed separately'}</span></div>
    </summary>
    <div class="debuff-item-body">
      <p class="debuff-time-copy">Each application lasts <strong>${duration(effect.duration)}</strong>. Overlapping refreshes are merged before uptime is shown.</p>
      ${sourceCopy(effect) ? `<p class="debuff-time-copy"><strong>Reference:</strong> ${esc(sourceCopy(effect))}</p>` : ''}
      <div class="debuff-who"><h4>Uptime by target</h4><div class="debuff-source-list">${targets.map(target => `<div class="debuff-source-row"><div><strong>${esc(target.name)}</strong><span>${target.kind === 'boss' ? 'Boss' : 'Enemy'} · Applied ${target.applications} time${target.applications === 1 ? '' : 's'}</span></div><div class="debuff-source-result"><strong>${percent(target.uptime)}</strong><span>${duration(target.seconds)} active</span></div></div>`).join('')}</div></div>
      <div class="debuff-who"><h4>Who applied it</h4>${inventorySources(effect)}</div>
    </div>
  </details>`;
}

function pageFrame(content, { busy = false } = {}) {
  return `<section class="debuff-page" data-debuff-page ${busy ? 'aria-busy="true"' : ''}>
    <section class="panel debuff-page-intro">
      <div><span class="eyebrow">${esc(selectedFightLabel())}</span><h2>Debuffs</h2><p>Actual enemy debuffs are listed first. Party buffs, personal target effects, enemy mechanics, and unknown status signals are kept separate so they are not mislabeled as debuffs.</p></div>
      <div class="debuff-meaning"><strong>What does uptime mean?</strong><span>50% uptime means the timed debuff was active for half of that target's active combat time.</span></div>
    </section>
    ${content}
  </section>`;
}

function loadingPage() {
  return pageFrame(`<section class="panel debuff-loading">
    <div class="panel-head"><div><span class="eyebrow">Checking the fight</span><h2>Finding debuffs and effects</h2></div><strong data-effects-progress>Starting…</strong></div>
    <p>Strikeglass is reading the selected fight, including boss, add, and player status events.</p>
    <div class="debuff-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
  </section>`, { busy: true });
}

function updateLoading(events) {
  const label = root?.querySelector('[data-effects-progress]');
  if (label) label.textContent = `${events.toLocaleString()} events checked`;
}

function noFightPage() {
  return pageFrame('<section class="panel"><div class="panel-head"><div><span class="eyebrow">Choose a fight</span><h2>No fight selected</h2></div></div><div class="empty-block">Choose a boss fight or encounter from the Fight menu above. Strikeglass will show effects from that exact combat window.</div></section>');
}

function errorPage(message) {
  return pageFrame(`<section class="panel"><div class="panel-head"><div><span class="eyebrow">Debuffs & effects</span><h2>Could not show this fight</h2></div></div><div class="empty-block bad-text">${esc(message)}</div></section>`);
}

function section(title, eyebrow, effects, empty) {
  return `<section class="panel debuff-results"><div class="panel-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div><span>${effects.length} found</span></div>${effects.length ? `<div class="debuff-list">${effects.map(inventoryDetails).join('')}</div>` : `<div class="empty-block">${esc(empty)}</div>`}</section>`;
}

function renderAnalysis({ bossResult, combatResult, scope }) {
  const bossVerified = !bossResult || bossResult.verification?.ok;
  const catalogVerified = combatResult.verification?.ok;
  const bossDebuffs = bossVerified ? (bossResult?.effects || []).filter(effect => effect.audience === 'team') : [];
  const bossPersonal = bossVerified ? (bossResult?.effects || []).filter(effect => effect.audience !== 'team') : [];
  const catalogDebuffs = combatResult.debuffsOnEnemies.filter(effect => effect.family !== 'boss');
  const timedCatalog = catalogDebuffs.filter(effect => effect.timedTargets?.some(target => target.verified));
  const timedCount = bossDebuffs.length + timedCatalog.length;
  const debuffCount = bossDebuffs.length + catalogDebuffs.length;
  const personalInventory = combatResult.personalTargetEffects.filter(effect => effect.family !== 'boss');
  const personalCount = bossPersonal.length + personalInventory.length;
  const checkOk = bossVerified && catalogVerified;
  const actualDebuffHtml = debuffCount
    ? `<div class="debuff-list">${bossDebuffs.map(bossEffectDetails).join('')}${catalogDebuffs.map(inventoryDetails).join('')}</div>`
    : '<div class="empty-block">No verified enemy debuff application was found in this fight. That is different from finding no status events.</div>';
  const timedHtml = timedCount
    ? `<div class="debuff-list">${bossDebuffs.map(bossEffectDetails).join('')}${timedCatalog.map(catalogTimedDetails).join('')}</div>`
    : '<div class="empty-block">No actual debuff with a safely timed duration was found in this fight.</div>';
  const personalHtml = personalCount
    ? `<div class="debuff-list">${bossPersonal.map(bossEffectDetails).join('')}${personalInventory.map(inventoryDetails).join('')}</div>`
    : '<div class="empty-block">No personal target effects were recorded in this fight.</div>';
  const immuneCount = combatResult.immuneEffects.reduce((sum, effect) => sum + Number(effect.applications || 0), 0);

  replacePage(pageFrame(`
    <section class="debuff-summary" aria-label="Debuff summary">
      <article><span>Actual debuffs</span><strong>${debuffCount}</strong><small>Enemy debuffs identified by known effect rules or negative stat metadata.</small></article>
      <article><span>Timed debuffs</span><strong>${timedCount}</strong><small>Only effects with safe timing rules.</small></article>
      <article><span>Personal target effects</span><strong>${personalCount}</strong><small>Useful effects that are not shared enemy debuffs.</small></article>
      <article><span>Uptime check</span><strong class="${checkOk ? 'good-text' : 'bad-text'}">${checkOk ? 'Matched' : 'Hidden'}</strong><small>${checkOk ? 'Independent calculations agreed.' : 'Calculated uptime is hidden where checks disagree.'}</small></article>
    </section>
    <section class="panel debuff-results">
      <div class="panel-head"><div><span class="eyebrow">Enemy debuffs only</span><h2>Actual debuffs on enemies</h2></div><span>${debuffCount}</span></div>
      <p class="debuff-results-help">This section no longer treats every small status row as a debuff. Known companion enhancements, support companions and mounts, current class debuffs, and strong negative stat rows can appear here.</p>
      ${actualDebuffHtml}
    </section>
    <section class="panel debuff-results">
      <div class="panel-head"><div><span class="eyebrow">Safe to time</span><h2>Verified debuff uptime</h2></div><span>${timedCount}</span></div>
      <p class="debuff-results-help">Uptime is published only when the duration rule is locked down and the independent calculation agrees.</p>
      ${timedHtml}
    </section>
    ${combatResult.targetAdvantageEffects.length ? section('Combat Advantage effects', 'Target advantage', combatResult.targetAdvantageEffects, '') : ''}
    <section class="panel debuff-results"><div class="panel-head"><div><span class="eyebrow">Not shared debuffs</span><h2>Personal target effects</h2></div><span>${personalCount}</span></div>${personalHtml}</section>
    ${section('Party / player buffs', 'Not debuffs', [...combatResult.allyBuffs, ...combatResult.supportWindows], 'No catalogued party/player support buffs were exposed as status rows in this fight.')}
    ${section('Enemy buffs & mechanics', scope.type === 'boss' ? 'Boss state' : 'Encounter state', combatResult.enemyMechanics, 'No enemy-origin status mechanics were recorded in this fight.')}
    ${section('Other status signals', 'Not classified as debuffs', combatResult.unclassifiedEnemyEffects, 'No unclassified enemy-target status signals were recorded in this fight.')}
    ${section('Effects on players', 'Encounter mechanics', combatResult.playerEffects, 'No successful player-target status effects were recorded in this fight.')}
    ${immuneCount ? `<details class="panel debuff-untimed debuff-immune"><summary>Immune / resisted effect attempts <span>${immuneCount}</span></summary><p>These were recorded as Immune, so Strikeglass shows the attempts but does not count them as applied debuffs.</p><div>${combatResult.immuneEffects.map(effect => `<span><strong>${esc(effect.name)}</strong><small>${effect.applications} immune event${effect.applications === 1 ? '' : 's'}</small></span>`).join('')}</div></details>` : ''}
    ${!bossVerified ? '<section class="panel verification-blocked"><div class="panel-head"><div><span class="eyebrow">Boss uptime check</span><h2>Boss uptime hidden</h2></div></div><div class="empty-block bad-text">The two boss-uptime calculations did not match. Observed status events remain visible, but unverified uptime percentages are not published.</div></section>' : ''}
    ${!catalogVerified ? '<section class="panel verification-blocked"><div class="panel-head"><div><span class="eyebrow">Debuff uptime check</span><h2>Target uptime hidden</h2></div></div><div class="empty-block bad-text">The two target-uptime calculations did not match. Application, source, and target details remain visible because they come directly from verified log rows.</div></section>' : ''}
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
  if (workspaceTitle) workspaceTitle.textContent = 'Debuffs';
  setToolbarMode(true);
}

async function refresh() {
  if (!isDebuffView() || !root) return;
  if (workspaceTitle) workspaceTitle.textContent = 'Debuffs';
  setToolbarMode(true);
  const scope = currentFightScope();
  if (!scope) {
    replacePage(noFightPage());
    return;
  }

  const key = scopeKey(scope);
  const token = ++renderToken;
  replacePage(loadingPage());
  try {
    let result = cache.get(key);
    if (!result) {
      const rows = await readFightRows(scope, token);
      if (!rows || token !== renderToken) return;
      const bossRows = scope.type === 'boss' ? rows.filter(row => isBossRef(row.targetRef)) : [];
      result = {
        scope,
        combatResult: analyzeCombatEffects(rows),
        bossResult: scope.type === 'boss' ? analyzeBossEffects(bossRows) : null
      };
      cache.set(key, result);
    }
    if (token !== renderToken || !isDebuffView() || scopeKey(currentFightScope()) !== key) return;
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
  else setToolbarMode(false);
});

scopeSelect?.addEventListener('change', () => {
  if (!isDebuffView()) return;
  renderToken += 1;
  scheduleRefresh();
});
