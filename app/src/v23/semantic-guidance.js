import {
  activeView,
  compact,
  currentPlayerRef,
  currentScope,
  esc,
  root,
  verifiedReport
} from '../v8/core.js';
import { registerRouteEnhancer } from '../v28/route-lifecycle.js';

const STYLE_ATTR = 'data-semantic-guidance-style';
let scheduled = 0;
let generation = 0;

function ensureStyle() {
  if (document.querySelector(`link[${STYLE_ATTR}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./semantic-guidance.css', import.meta.url).href;
  link.setAttribute(STYLE_ATTR, 'true');
  document.head.append(link);
}

function formatRate(value) {
  const n = Number(value) || 0;
  return compact(n);
}

function formatSeconds(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

function selectedPlayer(report) {
  const ref = currentPlayerRef();
  return report?.players?.find(player => player.ref === ref) || report?.players?.[0] || null;
}

function evidencePill(type, label) {
  return `<span class="sg-semantic-pill is-${esc(type)}">${esc(label)}</span>`;
}

function scopeDpsLabel() {
  const scope = currentScope();
  return scope?.type === 'session' ? 'Session DPS' : 'Fight DPS';
}

function insertAfterContext(panel) {
  const candidates = [
    root.querySelector('.verification-strip'),
    root.querySelector('.verification-banner'),
    root.querySelector('[data-sg-active-player]')?.closest('.panel'),
    root.querySelector(':scope > .panel')
  ].filter(Boolean);
  const anchor = candidates[0];
  if (anchor) anchor.insertAdjacentElement('afterend', panel);
  else root.prepend(panel);
}

async function ensureClockGuide(localGeneration) {
  const view = activeView();
  if (!['overview', 'players', 'powers', 'bosses'].includes(view) || root.querySelector('[data-sg-clock-guide]')) return;
  let report;
  try { report = await verifiedReport(currentScope()); } catch { return; }
  if (localGeneration !== generation || !['overview', 'players', 'powers', 'bosses'].includes(activeView()) || root.querySelector('[data-sg-clock-guide]')) return;
  const player = selectedPlayer(report);
  if (!player) return;
  const scopeDuration = Math.max(0, Number(report.duration) || Number(player.scopeDuration) || 0);
  const personalDuration = Math.max(0, Number(player.duration) || 0);
  const activeDuration = Math.max(0, Number(player.combatTime) || 0);
  const damage = Number(player.damage) || 0;
  const scopeDps = damage / Math.max(1, scopeDuration);
  const personalDps = Number(player.dps) || damage / Math.max(1, personalDuration);
  const activeDps = Number(player.combatDps) || damage / Math.max(1, activeDuration);
  const panel = document.createElement('section');
  panel.className = 'panel sg-clock-guide';
  panel.dataset.sgClockGuide = 'true';
  panel.innerHTML = `
    <div class="sg-clock-guide-head">
      <div><span class="eyebrow">Performance clocks</span><h2>${esc(player.name)} · understand the three rates</h2></div>
      ${evidencePill('derived', 'Derived from verified damage')}
    </div>
    <div class="sg-clock-guide-grid">
      <article><span>${scopeDpsLabel()}</span><strong>${formatRate(scopeDps)}</strong><small>${compact(damage)} ÷ ${formatSeconds(scopeDuration)}</small><p>Uses the entire selected ${currentScope()?.type === 'session' ? 'session combat span' : 'fight window'}. Best for direct contribution comparisons.</p></article>
      <article><span>Personal DPS</span><strong>${formatRate(personalDps)}</strong><small>${compact(damage)} ÷ ${formatSeconds(personalDuration)}</small><p>Uses this player’s first counted hit through last counted hit. Long pauses inside that span remain.</p></article>
      <article><span>Active DPS</span><strong>${formatRate(activeDps)}</strong><small>${compact(damage)} ÷ ${formatSeconds(activeDuration)}</small><p>Uses reconstructed active damage time. Gaps longer than five seconds are removed.</p></article>
    </div>
    <details class="sg-semantic-details"><summary>Why can these numbers be different?</summary><p>They use the same verified damage numerator but different clocks. A player who joins late, dies early, or has long idle gaps can therefore have high Personal or Active DPS while contributing less damage across the whole selected fight. Strikeglass keeps the clocks separate instead of pretending they answer the same question.</p></details>`;
  insertAfterContext(panel);
}

async function ensureCompanionEvidence(localGeneration) {
  const view = activeView();
  if (!['players', 'powers', 'overview'].includes(view) || root.querySelector('[data-sg-companion-evidence]')) return;
  let report;
  try { report = await verifiedReport(currentScope()); } catch { return; }
  if (localGeneration !== generation || root.querySelector('[data-sg-companion-evidence]')) return;
  const player = selectedPlayer(report);
  if (!player || !(Number(player.companionDamage) > 0)) return;
  const damage = Number(player.damage) || 0;
  const companionDamage = Number(player.companionDamage) || 0;
  const share = damage ? companionDamage / damage * 100 : 0;
  const panel = document.createElement('aside');
  panel.className = 'sg-semantic-note sg-companion-evidence';
  panel.dataset.sgCompanionEvidence = 'true';
  panel.innerHTML = `${evidencePill('inferred', 'Inferred')}<div><strong>Companion attribution · ${compact(companionDamage)} (${share.toFixed(1)}%)</strong><p>Damage values are exact counted rows. The label “companion” is inferred from Neverwinter source/entity evidence and ownership patterns, so Strikeglass keeps attribution confidence separate from arithmetic accuracy.</p></div>`;
  const clock = root.querySelector('[data-sg-clock-guide]');
  if (clock) clock.insertAdjacentElement('afterend', panel);
  else insertAfterContext(panel);
}

function ensureRotationEvidence() {
  if (activeView() !== 'timeline' || root.querySelector('[data-sg-rotation-evidence]')) return;
  const panel = document.createElement('aside');
  panel.className = 'sg-semantic-note sg-rotation-evidence';
  panel.dataset.sgRotationEvidence = 'true';
  panel.innerHTML = `${evidencePill('inferred', 'Reconstructed')}<div><strong>Power activations are inferred from combat-log evidence</strong><p>Encounter resource markers are used when the log exposes them. Otherwise repeated damage rows are grouped with category timing rules. The shadow check confirms the reconstruction is internally consistent; it is not an independent observation of a button press.</p></div>`;
  insertAfterContext(panel);
}

function ensureEffectLegend() {
  if (activeView() !== 'debuffs' || root.querySelector('[data-sg-effect-evidence-legend]')) return;
  const panel = document.createElement('section');
  panel.className = 'panel sg-effect-evidence-legend';
  panel.dataset.sgEffectEvidenceLegend = 'true';
  panel.innerHTML = `
    <div class="sg-clock-guide-head"><div><span class="eyebrow">Evidence guide</span><h2>How to read Team Debuffs</h2></div>${evidencePill('inferred', 'Mechanics are reconstructed')}</div>
    <div class="sg-effect-evidence-grid">
      <article>${evidencePill('exact', 'Timing verified')}<p>Independent interval reconstruction agrees on when the effect signal was active.</p></article>
      <article>${evidencePill('derived', 'Mechanic sourced')}<p>The support catalog contains a reviewed definition and source for the effect.</p></article>
      <article>${evidencePill('inferred', 'Damage evidence')}<p>Comparable clean-baseline hits move in the expected direction. This supports the mechanic but does not prove causation.</p></article>
      <article>${evidencePill('unknown', 'Magnitude unresolved')}<p>Unless enough comparable evidence exists, Strikeglass does not claim the observed percentage exactly proves the listed mechanic magnitude.</p></article>
    </div>`;
  insertAfterContext(panel);
}

function clarifyExistingDpsLabels() {
  for (const card of root.querySelectorAll('[data-sg-accuracy-metric="true"]')) {
    const label = card.querySelector('.eyebrow, :scope > span, small')?.textContent?.trim().toLowerCase() || '';
    if (label !== 'dps') continue;
    card.title = 'Personal DPS: selected player damage divided by time from that player’s first counted hit to last counted hit. See Performance clocks for fight-wide comparison.';
  }
}

async function scan() {
  ensureStyle();
  const localGeneration = ++generation;
  ensureRotationEvidence();
  ensureEffectLegend();
  await Promise.allSettled([ensureClockGuide(localGeneration), ensureCompanionEvidence(localGeneration)]);
  if (localGeneration !== generation) return;
  clarifyExistingDpsLabels();
}

function schedule(delay = 20) {
  clearTimeout(scheduled);
  scheduled = setTimeout(() => requestAnimationFrame(scan), delay);
}

registerRouteEnhancer('semantic-guidance', () => schedule());

ensureStyle();
schedule(0);
