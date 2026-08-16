import { EVENT_PAGE_SIZE, activeView, compact, currentPlayerRef, currentScope, esc, root, workerRequest } from '../v8/core.js';
import { summarizeCompanionEvidence, summarizeEncounterEntityEvidence } from '../engine/entity-evidence.js';

const STYLE_ATTR = 'data-entity-evidence-style';
const cache = new Map();
let scheduled = 0;
let generation = 0;

function ensureStyle() {
  if (document.querySelector(`link[${STYLE_ATTR}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./entity-evidence.css', import.meta.url).href;
  link.setAttribute(STYLE_ATTR, 'true');
  document.head.append(link);
}

function scopeKey(scope = currentScope()) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${Number(scope.id)}:${scope.targetOnly ? 'target' : 'window'}`;
}

async function damageRows(scope, playerRef = '') {
  const key = `${scopeKey(scope)}|${playerRef || '*'}`;
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    const rows = [];
    let cursor = null;
    do {
      const page = await workerRequest('raw-page', {
        options: { cursor, limit: EVENT_PAGE_SIZE, scope, playerRef, kind: 'damage', validDamageOnly: true }
      }, 45000);
      if (page?.verification?.status !== 'verified') throw new Error('Entity evidence is waiting for the independent arithmetic check.');
      rows.push(...(page.rows || []));
      cursor = page.nextCursor;
      if (cursor != null) await new Promise(resolve => setTimeout(resolve, 0));
    } while (cursor != null);
    return rows;
  })().catch(error => { cache.delete(key); throw error; });
  cache.set(key, promise);
  if (cache.size > 10) cache.delete(cache.keys().next().value);
  return promise;
}

function confidenceLabel(value) {
  if (value === 'high') return 'High evidence';
  if (value === 'medium') return 'Mixed evidence';
  if (value === 'low') return 'Needs review';
  if (value === 'not-observed') return 'Not observed';
  return 'Unknown';
}

function pill(value) {
  const kind = value === 'high' ? 'good' : value === 'medium' || value === 'not-observed' ? 'info' : 'review';
  return `<span class="sg-entity-pill is-${kind}">${esc(confidenceLabel(value))}</span>`;
}

function insertPanel(panel) {
  const anchor = root.querySelector('.verification-strip, [data-sg-accuracy-state-legend], [data-sg-semantic-guide]');
  if (anchor) anchor.insertAdjacentElement('afterend', panel);
  else root.prepend(panel);
}

async function renderCompanionEvidence(localGeneration) {
  if (activeView() !== 'players' || root.querySelector('[data-sg-companion-evidence]')) return;
  const playerRef = currentPlayerRef();
  if (!playerRef) return;
  const panel = document.createElement('section');
  panel.className = 'panel sg-entity-evidence';
  panel.dataset.sgCompanionEvidence = 'true';
  panel.innerHTML = '<div class="sg-entity-loading">Checking companion attribution evidence…</div>';
  insertPanel(panel);
  try {
    const rows = await damageRows(currentScope(), playerRef);
    if (generation !== localGeneration || activeView() !== 'players' || !panel.isConnected) return;
    const evidence = summarizeCompanionEvidence(rows, playerRef);
    const directPct = evidence.companionDamage ? evidence.directCoverage * 100 : 0;
    panel.innerHTML = `
      <div class="sg-entity-head"><div><span class="eyebrow">Attribution evidence</span><h2>How certain is companion damage?</h2></div>${pill(evidence.confidence)}</div>
      <div class="sg-entity-grid">
        <article><span>Companion damage</span><strong>${compact(evidence.companionDamage)}</strong><small>${evidence.companionHits.toLocaleString()} counted Physical hits</small></article>
        <article><span>Direct entity-template evidence</span><strong>${directPct.toFixed(1)}%</strong><small>${compact(evidence.directTemplateDamage)} · ${evidence.directTemplateHits.toLocaleString()} hits</small></article>
        <article><span>Text-inferred attribution</span><strong>${compact(evidence.textInferredDamage)}</strong><small>${evidence.textInferredHits.toLocaleString()} hits identified from companion-like event text</small></article>
        <article><span>Unresolved creature-source damage</span><strong>${compact(evidence.unresolvedCreatureSourceDamage)}</strong><small>${evidence.unresolvedCreatureSourceHits.toLocaleString()} hits are not counted as companion damage without enough evidence</small></article>
      </div>
      <p class="sg-entity-help">Companion share is an <strong>inferred</strong> metric. Creature templates containing companion, pet, appointment or summon markers are the strongest available evidence. Text-only attribution remains visible as weaker evidence. Unresolved creature-source damage stays outside Companion Share rather than being guessed into it.</p>
      ${evidence.evidence.length ? `<details class="sg-entity-details"><summary>See attribution examples</summary>${evidence.evidence.map(item => `<div><strong>${esc(item.power)}</strong><span>${esc(item.level === 'direct-template' ? 'Direct template' : item.level === 'text-inferred' ? 'Text inferred' : 'Unresolved')}</span><b>${compact(item.amount)}</b><small>${esc(item.reason)}</small></div>`).join('')}</details>` : ''}`;
  } catch (error) {
    if (panel.isConnected) panel.innerHTML = `<div class="sg-entity-error">${esc(error.message || String(error))}</div>`;
  }
}

async function renderBossEvidence(localGeneration) {
  if (activeView() !== 'bosses' || root.querySelector('[data-sg-boss-evidence]')) return;
  const scope = currentScope();
  if (!scope || scope.type === 'session') return;
  const panel = document.createElement('section');
  panel.className = 'panel sg-entity-evidence';
  panel.dataset.sgBossEvidence = 'true';
  panel.innerHTML = '<div class="sg-entity-loading">Checking boss identity evidence…</div>';
  insertPanel(panel);
  try {
    const rows = await damageRows(scope);
    if (generation !== localGeneration || activeView() !== 'bosses' || !panel.isConnected) return;
    const evidence = summarizeEncounterEntityEvidence(rows);
    panel.innerHTML = `
      <div class="sg-entity-head"><div><span class="eyebrow">Encounter evidence</span><h2>Why Strikeglass calls this a boss fight</h2></div>${pill(evidence.confidence)}</div>
      <div class="sg-entity-grid">
        <article><span>Boss targets with canonical marker</span><strong>${evidence.bossTargets.length}</strong><small>${evidence.bossHits.toLocaleString()} counted hits · ${compact(evidence.bossDamage)} damage</small></article>
        <article><span>Unclassified creature targets</span><strong>${evidence.unknownTargets.length}</strong><small>Shown for review; they are not promoted to boss without evidence</small></article>
      </div>
      <p class="sg-entity-help">Boss identity is <strong>inferred from the combat-log entity template</strong>. A creature template containing <code>_boss</code> is treated as high-confidence boss evidence. Strikeglass does not promote an unfamiliar creature to boss merely because it has a lot of health or damage.</p>
      ${evidence.bossTargets.length ? `<details class="sg-entity-details"><summary>See boss identity evidence</summary>${evidence.bossTargets.map(target => `<div><strong>${esc(target.name)}</strong><span>${target.hits.toLocaleString()} hits</span><b>${compact(target.damage)}</b><small>${esc(target.reason)}</small></div>`).join('')}</details>` : ''}
      ${evidence.unknownTargets.length ? `<details class="sg-entity-details"><summary>Review unclassified creature targets</summary>${evidence.unknownTargets.slice(0, 12).map(target => `<div><strong>${esc(target.name)}</strong><span>${target.hits.toLocaleString()} hits</span><b>${compact(target.damage)}</b><small>${esc(target.reason)}</small></div>`).join('')}</details>` : ''}`;
  } catch (error) {
    if (panel.isConnected) panel.innerHTML = `<div class="sg-entity-error">${esc(error.message || String(error))}</div>`;
  }
}

async function scan() {
  ensureStyle();
  const localGeneration = ++generation;
  await Promise.allSettled([renderCompanionEvidence(localGeneration), renderBossEvidence(localGeneration)]);
}

function schedule(delay = 40) {
  clearTimeout(scheduled);
  scheduled = setTimeout(() => requestAnimationFrame(scan), delay);
}

document.addEventListener('strikeglass:view-rendered', () => schedule());
document.addEventListener('strikeglass:analysis-ready', () => { cache.clear(); schedule(); });
window.addEventListener('strikeglass:worker-ready', () => { cache.clear(); schedule(); });

ensureStyle();
schedule(0);
