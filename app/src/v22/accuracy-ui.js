import {
  EVENT_PAGE_SIZE,
  activeView,
  compact,
  currentPlayerRef,
  currentScope,
  duration,
  esc,
  playerSelect,
  root,
  scopeSelect,
  verifiedReport,
  workerRequest
} from '../v8/core.js';
import { verifyPowerCategories } from '../engine/classification-evidence.js';

const STYLE_ATTR = 'data-accuracy-ui-style';
const SCAN_EVENT = 'strikeglass:accuracy-refreshed';
const topHitCache = new Map();
let scheduled = 0;
let scanGeneration = 0;

const ACCURACY_STATES = Object.freeze({
  exact: ['Exact', 'Directly calculated from complete verified combat-log rows.'],
  derived: ['Derived', 'Calculated from exact verified source values using a documented formula.'],
  inferred: ['Inferred', 'Reconstructed from deterministic evidence in the log; the underlying observation is not directly recorded.'],
  partial: ['Partial', 'Correct for the rows inspected, but the displayed view does not cover the entire selected scope.'],
  unknown: ['Unknown', 'Strikeglass does not have enough evidence to make a safe claim.']
});

const METRICS = new Map([
  ['group damage', { state: 'exact', formula: 'Sum of counted canonical Physical damage in the selected scope.', source: 'report.damage' }],
  ['party damage', { state: 'exact', formula: 'Sum of counted canonical Physical damage in the selected scope.', source: 'report.damage' }],
  ['damage', { state: 'exact', formula: 'Selected player counted canonical Physical damage in the selected scope.', source: 'player.damage' }],
  ['total damage', { state: 'exact', formula: 'Selected player counted canonical Physical damage in the selected scope.', source: 'player.damage' }],
  ['group dps', { state: 'derived', formula: 'Group damage divided by the selected combat span.', source: 'report.partyDps' }],
  ['party dps', { state: 'derived', formula: 'Group damage divided by the selected combat span.', source: 'report.partyDps' }],
  ['dps', { state: 'derived', formula: 'Player damage divided by elapsed time from that player’s first counted hit to last counted hit.', source: 'player.dps' }],
  ['group active dps', { state: 'derived', formula: 'Group damage divided by reconstructed active combat time; qualifying idle gaps are removed.', source: 'report.partyCombatDps' }],
  ['party active dps', { state: 'derived', formula: 'Group damage divided by reconstructed active combat time; qualifying idle gaps are removed.', source: 'report.partyCombatDps' }],
  ['active dps', { state: 'derived', formula: 'Player damage divided by reconstructed active damage time; gaps longer than five seconds are removed.', source: 'player.combatDps' }],
  ['critical hit rate', { state: 'derived', formula: 'Critical counted hits divided by all counted hits in the selected scope.', source: 'player.crit' }],
  ['crit', { state: 'derived', formula: 'Critical counted hits divided by all counted hits in the selected scope.', source: 'player.crit' }],
  ['flank / ca rate', { state: 'derived', formula: 'Counted hits marked Flank or Combat Advantage divided by all counted hits.', source: 'player.flank' }],
  ['combat advantage rate', { state: 'derived', formula: 'Counted hits marked Flank or Combat Advantage divided by all counted hits.', source: 'player.flank' }],
  ['group share', { state: 'derived', formula: 'Player damage divided by total group damage in the selected scope.', source: 'player.damageShare' }],
  ['companion share', { state: 'inferred', formula: 'Damage attributed to companion-like sources divided by player damage. Companion identity is inferred from entity/template evidence.', source: 'player.companionDamage' }],
  ['biggest hit', { state: 'exact', formula: 'Largest counted canonical Physical hit in the selected scope.', source: 'player.maxHit' }],
  ['selected time', { state: 'derived', formula: 'The current scope clock used by the corresponding damage-rate metrics.', source: 'report.duration' }]
]);

function ensureStyle() {
  if (document.querySelector(`link[${STYLE_ATTR}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./accuracy-ui.css', import.meta.url).href;
  link.setAttribute(STYLE_ATTR, 'true');
  document.head.append(link);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function stableColor(key) {
  let hash = 2166136261;
  for (const char of String(key || 'unknown')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const hue = ((hash >>> 0) * 0.61803398875 * 360) % 360;
  const light = document.documentElement.dataset.theme === 'dark' ? 62 : 43;
  return `hsl(${Math.round(hue)} 68% ${light}%)`;
}

function scopeKey(scope = currentScope()) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${scope.id}:${scope.targetOnly ? 'target' : 'window'}`;
}

function statePill(state) {
  const [label] = ACCURACY_STATES[state] || ACCURACY_STATES.unknown;
  return `<span class="sg-accuracy-pill is-${esc(state)}">${esc(label)}</span>`;
}

function findPlayer(report) {
  const ref = currentPlayerRef();
  return report?.players?.find(player => player.ref === ref) || report?.players?.[0] || null;
}

function playerNameMap(report) {
  return new Map((report?.players || []).map(player => [String(player.name || ''), player]));
}

async function applyPlayerColors() {
  if (!root?.isConnected) return;
  let report;
  try { report = await verifiedReport(currentScope()); } catch { return; }
  const byName = playerNameMap(report);
  const strips = root.querySelectorAll('.sg-share-strip i');
  for (const segment of strips) {
    const name = segment.getAttribute('title') || '';
    const player = byName.get(name);
    if (!player) continue;
    segment.style.setProperty('--sg-player-share-color', stableColor(player.ref));
    segment.dataset.playerRef = player.ref;
  }
  for (const legend of root.querySelectorAll('.sg-share-legend span')) {
    const name = legend.querySelector('b')?.textContent?.trim() || '';
    const player = byName.get(name);
    if (!player) continue;
    legend.style.setProperty('--sg-player-share-color', stableColor(player.ref));
    legend.dataset.playerRef = player.ref;
  }
  for (const row of root.querySelectorAll('tbody tr')) {
    const cells = row.cells;
    if (!cells?.length) continue;
    const name = Array.from(cells).map(cell => cell.textContent.trim()).find(text => byName.has(text));
    if (!name) continue;
    const player = byName.get(name);
    row.style.setProperty('--sg-player-color', stableColor(player.ref));
    row.dataset.sgPlayerIdentity = 'true';
  }
  if (window.echarts?.getInstanceByDom) {
    for (const stage of root.querySelectorAll('[data-sg-chart-stage]')) {
      const chart = window.echarts.getInstanceByDom(stage);
      if (!chart) continue;
      const option = chart.getOption?.() || {};
      const updates = (option.series || []).map(series => {
        const player = byName.get(String(series.name || ''));
        if (!player) return { name: series.name };
        const color = stableColor(player.ref);
        return { name: series.name, lineStyle: { ...(series.lineStyle || {}), color }, itemStyle: { ...(series.itemStyle || {}), color } };
      });
      if (updates.some(update => update.lineStyle?.color)) chart.setOption({ series: updates }, { lazyUpdate: true });
    }
  }
}

function metricLabel(card) {
  const candidates = [
    card.querySelector('.eyebrow'), card.querySelector(':scope > span'), card.querySelector('small'), card.querySelector('label')
  ].filter(Boolean);
  for (const node of candidates) {
    const label = normalize(node.textContent);
    if (METRICS.has(label)) return label;
  }
  const direct = normalize(card.firstElementChild?.textContent || '');
  return METRICS.has(direct) ? direct : '';
}

function metricCards() {
  const nodes = new Set();
  for (const selector of ['.metric-card', '.metric', '.stat-card', '.overview-metric', '.dashboard-metric', '.analysis-stat']) {
    root?.querySelectorAll(selector).forEach(node => nodes.add(node));
  }
  root?.querySelectorAll('.metrics-grid > *, .metric-grid > *, .overview-kpis > *, .summary-metrics > *').forEach(node => nodes.add(node));
  return [...nodes];
}

function ensureEvidenceDialog() {
  let dialog = document.getElementById('sg-accuracy-dialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'sg-accuracy-dialog';
  dialog.className = 'sg-accuracy-dialog';
  dialog.innerHTML = '<div class="sg-accuracy-dialog-head"><div><span class="eyebrow">Metric evidence</span><h2 data-sg-accuracy-title>Why this number?</h2></div><button type="button" data-sg-accuracy-close aria-label="Close metric evidence">×</button></div><div class="sg-accuracy-dialog-body" data-sg-accuracy-body></div>';
  dialog.querySelector('[data-sg-accuracy-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  return dialog;
}

function reportValue(report, player, source) {
  const parts = String(source || '').split('.');
  let value = parts.shift() === 'player' ? player : report;
  for (const part of parts.slice(parts[0] === 'report' ? 1 : 0)) value = value?.[part];
  return value;
}

async function showMetricEvidence(card, label) {
  const dialog = ensureEvidenceDialog();
  const body = dialog.querySelector('[data-sg-accuracy-body]');
  const title = dialog.querySelector('[data-sg-accuracy-title]');
  const definition = METRICS.get(label) || { state: 'unknown', formula: 'No metric contract is registered for this value yet.', source: '' };
  title.textContent = card.querySelector('strong,h3,h2')?.textContent?.trim() || label.replace(/\b\w/g, char => char.toUpperCase());
  body.innerHTML = '<div class="sg-accuracy-loading">Reading the verified report…</div>';
  if (!dialog.open) dialog.showModal();
  try {
    const report = await verifiedReport(currentScope());
    const player = findPlayer(report);
    const verification = report.verification || {};
    const selected = scopeSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Selected scope';
    const displayed = card.querySelector('strong')?.textContent?.trim() || '—';
    const sourceValue = reportValue(report, player, definition.source);
    const state = definition.state === 'inferred' ? 'inferred' : verification.status === 'verified' ? definition.state : 'partial';
    const checked = (verification.checkedFields || []).slice(0, 10).join(', ') || 'core combat totals and clocks';
    body.innerHTML = `
      <div class="sg-accuracy-evidence-summary">${statePill(state)}<strong>${esc(displayed)}</strong><span>${esc(selected)}</span></div>
      <dl class="sg-accuracy-evidence-list">
        <div><dt>Definition</dt><dd>${esc(definition.formula)}</dd></div>
        <div><dt>Verified source</dt><dd>${sourceValue == null ? 'Shown from the verified presentation value.' : esc(String(sourceValue))}</dd></div>
        <div><dt>Scope</dt><dd>${esc(selected)}</dd></div>
        <div><dt>Calculation check</dt><dd>${verification.status === 'verified' ? 'Independent arithmetic check matched.' : esc(verification.status || 'Unavailable')}</dd></div>
        <div><dt>Verifier</dt><dd>${esc(verification.engine || 'shadow verifier')}</dd></div>
        <div><dt>Checked fields</dt><dd>${esc(checked)}</dd></div>
        ${verification.checksum ? `<div><dt>Evidence checksum</dt><dd><code>${esc(String(verification.checksum))}</code></dd></div>` : ''}
      </dl>
      <p class="sg-accuracy-help">${esc((ACCURACY_STATES[state] || ACCURACY_STATES.unknown)[1])}</p>`;
  } catch (error) {
    body.innerHTML = `<div class="sg-accuracy-error">${esc(error.message || String(error))}</div>`;
  }
}

function enhanceMetricEvidence() {
  for (const card of metricCards()) {
    if (card.dataset.sgAccuracyMetric === 'true') continue;
    const label = metricLabel(card);
    if (!label) continue;
    card.dataset.sgAccuracyMetric = 'true';
    const definition = METRICS.get(label);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sg-accuracy-evidence-button';
    button.setAttribute('aria-label', `Why this ${label} number?`);
    button.title = `Why this ${label} number?`;
    button.innerHTML = `${statePill(definition?.state || 'unknown')}<span>Why?</span>`;
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); showMetricEvidence(card, label); });
    card.append(button);
  }
}

async function ensureTaxonomyPanel() {
  if (activeView() !== 'powers' || root.querySelector('[data-sg-taxonomy-audit]')) return;
  try {
    const report = await verifiedReport(currentScope());
    if (activeView() !== 'powers' || root.querySelector('[data-sg-taxonomy-audit]')) return;
    const player = findPlayer(report);
    if (!player) return;
    const powers = player.powers || [];
    const total = Math.max(1, Number(player.damage) || powers.reduce((sum, power) => sum + (Number(power.damage) || 0), 0));
    const unknown = powers.filter(power => String(power.category || '') === 'Other / Unknown');
    const unknownDamage = unknown.reduce((sum, power) => sum + (Number(power.damage) || 0), 0);
    const categoryVerification = verifyPowerCategories(powers);
    const checks = categoryVerification.checks;
    const mismatches = categoryVerification.mismatches;
    const coverage = Math.max(0, Math.min(100, (total - unknownDamage) / total * 100));
    const panel = document.createElement('section');
    panel.className = 'panel sg-taxonomy-audit';
    panel.dataset.sgTaxonomyAudit = 'true';
    panel.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">Classification evidence</span><h2>Power taxonomy coverage</h2></div>${statePill(unknown.length ? 'inferred' : 'exact')}</div>
      <div class="sg-accuracy-summary-grid">
        <div><span>Classified damage</span><strong>${coverage.toFixed(1)}%</strong><small>${compact(total - unknownDamage)} of ${compact(total)}</small></div>
        <div><span>Other / Unknown</span><strong>${compact(unknownDamage)}</strong><small>${unknown.length} unresolved power${unknown.length === 1 ? '' : 's'}</small></div>
        <div><span>Independent spot checks</span><strong>${checks.length}</strong><small>${mismatches.length ? `${mismatches.length} mismatch${mismatches.length === 1 ? '' : 'es'}` : 'no mismatches'}</small></div>
      </div>
      ${unknown.length ? `<details class="sg-accuracy-details"><summary>Review unresolved powers</summary><div class="sg-accuracy-unknown-list">${unknown.slice(0, 20).map(power => `<div><span><strong>${esc(power.power || 'Unknown')}</strong><small>${esc(power.powerRef || 'No power reference')}</small></span><b>${compact(power.damage)}</b><em>${power.hits || 0} hits</em></div>`).join('')}</div></details>` : '<p class="sg-accuracy-help">Every damaging power in this scope has a current category. Classification remains an inferred layer unless independent source evidence exists.</p>'}
      ${mismatches.length ? `<p class="sg-accuracy-warning">Independent classification evidence disagrees on ${mismatches.length} power${mismatches.length === 1 ? '' : 's'}. Analysis Checks should be reviewed before relying on category or rotation conclusions.</p>` : ''}`;
    const category = root.querySelector('.category-panel');
    (category || root.firstElementChild)?.insertAdjacentElement(category ? 'beforebegin' : 'afterend', panel);
  } catch {}
}

function applyEffectLanguage() {
  if (activeView() !== 'debuffs') return;
  for (const verification of root.querySelectorAll('.effect-verification')) {
    const rows = [...verification.children];
    for (const row of rows) {
      const label = normalize(row.querySelector('span')?.textContent);
      const strong = row.querySelector('strong');
      if (!strong) continue;
      if (label === 'confidence') {
        const value = strong.textContent.trim().toUpperCase();
        strong.textContent = value === 'VERIFIED' ? 'Strong evidence' : value === 'HIGH' ? 'High evidence' : value === 'MEDIUM' ? 'Limited evidence' : 'Unresolved';
      } else if (label === 'damage check') {
        strong.textContent = strong.textContent.replace(/^Matched\b/i, 'Damage evidence consistent').replace(/^Supported\b/i, 'Some supporting evidence');
      } else if (label === 'timeline' && /^Matched$/i.test(strong.textContent.trim())) {
        strong.textContent = 'Timing verified';
      }
    }
    if (!verification.nextElementSibling?.matches?.('[data-sg-effect-evidence-note]')) {
      const note = document.createElement('p');
      note.className = 'sg-accuracy-help';
      note.dataset.sgEffectEvidenceNote = 'true';
      note.textContent = 'Timing verification confirms reconstructed effect windows. Damage evidence shows consistency with the expected direction; it is not presented as proof of causation.';
      verification.insertAdjacentElement('afterend', note);
    }
  }
}

function bossEvidence() {
  const scope = currentScope();
  if (scope?.type !== 'boss' || root.querySelector('[data-sg-boss-confidence]')) return;
  const panel = document.createElement('div');
  panel.className = 'sg-accuracy-context';
  panel.dataset.sgBossConfidence = 'true';
  panel.innerHTML = `${statePill('inferred')}<strong>Boss detection: high confidence</strong><span>The selected scope was classified from a creature entity template containing <code>_Boss</code>, then checked against the verified encounter window.</span>`;
  const anchor = root.querySelector('.verification-strip, .verification-banner, .effect-health-strip');
  if (anchor) anchor.insertAdjacentElement('afterend', panel);
  else root.prepend(panel);
}

async function fullScopeTopHits(scope) {
  const key = scopeKey(scope);
  if (topHitCache.has(key)) return topHitCache.get(key);
  const promise = (async () => {
    let cursor = null;
    let checked = 0;
    const top = [];
    do {
      const page = await workerRequest('raw-page', { options: { cursor, limit: EVENT_PAGE_SIZE, kind: 'damage', validDamageOnly: true, scope } }, 45000);
      if (page?.verification?.status !== 'verified') throw new Error('Exact hit annotations are waiting for the second accuracy check.');
      for (const row of page.rows || []) {
        checked += 1;
        const amount = Number(row.amount) || 0;
        if (amount <= 0) continue;
        top.push(row);
        top.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
        if (top.length > 4) top.length = 4;
      }
      cursor = page.nextCursor;
      await new Promise(resolve => setTimeout(resolve, 0));
    } while (cursor != null);
    return { top, checked, complete: true };
  })().catch(error => { topHitCache.delete(key); throw error; });
  topHitCache.set(key, promise);
  return promise;
}

function graphBadge(node, text, state = 'exact') {
  let badge = node.querySelector('[data-sg-graph-evidence]');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'sg-graph-evidence';
    badge.dataset.sgGraphEvidence = 'true';
    node.append(badge);
  }
  badge.innerHTML = `${statePill(state)}<span>${esc(text)}</span>`;
  return badge;
}

function applyDamageGaps(node) {
  if (!window.echarts?.getInstanceByDom) return;
  const stage = node.querySelector('[data-sg-chart-stage]');
  const chart = stage && window.echarts.getInstanceByDom(stage);
  if (!chart) return;
  const mode = node.querySelector('[data-sg-v17-mode]')?.value || 'damage';
  if (mode !== 'damage') {
    stage.dataset.sgGapMode = mode;
    return;
  }
  const option = chart.getOption?.() || {};
  const updates = [];
  for (const series of option.series || []) {
    if (series.type !== 'line' || !Array.isArray(series.data) || series.data.length < 2) continue;
    if (series.data.some(point => Array.isArray(point) && point[1] == null)) continue;
    const data = [];
    let previous = null;
    for (const point of series.data) {
      const x = Number(point?.[0]);
      const y = point?.[1] == null ? null : Number(point?.[1]);
      if (previous && Number.isFinite(x) && x - previous[0] > 5) {
        data.push([previous[0] + 0.001, null], [Math.max(previous[0] + 0.002, x - 0.001), null]);
      }
      data.push([x, y]);
      previous = [x, y];
    }
    updates.push({ name: series.name, data, connectNulls: false });
  }
  if (updates.length) {
    chart.setOption({ series: updates }, { lazyUpdate: true });
    stage.dataset.sgGapMode = 'damage';
    graphBadge(node, 'Damage view breaks the line across idle gaps longer than 5 seconds.', 'derived');
  }
}

async function applyExactTopHitAnnotations(node) {
  if (node.dataset.sgExactHits === 'ready' || node.dataset.sgExactHits === 'loading') return;
  if (!window.echarts?.getInstanceByDom) return;
  const stage = node.querySelector('[data-sg-chart-stage]');
  const chart = stage && window.echarts.getInstanceByDom(stage);
  if (!chart) return;
  node.dataset.sgExactHits = 'loading';
  graphBadge(node, 'Checking top-hit annotations against the complete verified scope…', 'partial');
  try {
    const report = await verifiedReport(currentScope());
    const result = await fullScopeTopHits(currentScope());
    if (!node.isConnected) return;
    const maxTime = Math.max(1, Number(report.duration) || Number(report.scope?.duration) || 1);
    const offset = Number(report.scope?.start) || 0;
    const percentAxis = node.querySelector('[data-sg-v17-scale]')?.value === 'percent';
    const option = chart.getOption?.() || {};
    const first = (option.series || []).find(series => series.type === 'line');
    if (!first) return;
    const currentMark = Array.isArray(first.markLine) ? first.markLine[0] : first.markLine;
    const currentData = Array.isArray(currentMark?.data) ? currentMark.data : [];
    const keep = currentData.filter(item => {
      const formatter = item?.label?.formatter;
      return String(formatter || '').toLowerCase() !== 'big hit';
    });
    const exact = result.top.map(row => {
      const seconds = Math.max(0, Number(row.time) - offset);
      const x = percentAxis ? seconds / maxTime * 100 : seconds;
      return {
        name: `${row.ownerName || 'Player'} · ${row.powerName || 'Hit'} · ${compact(row.amount)}`,
        xAxis: x,
        label: { show: true, formatter: 'Top hit', rotate: 90, fontSize: 10 },
        lineStyle: { type: 'dashed', width: 1.4, opacity: .72 }
      };
    });
    chart.setOption({ series: [{ name: first.name, markLine: { ...(currentMark || {}), silent: false, symbol: ['none', 'none'], data: [...keep, ...exact] } }] }, { lazyUpdate: true });
    node.dataset.sgExactHits = 'ready';
    graphBadge(node, `Top-hit annotations checked across ${result.checked.toLocaleString()} verified damage rows.`, 'exact');
  } catch (error) {
    node.dataset.sgExactHits = 'error';
    graphBadge(node, error.message || 'Could not verify graph annotations.', 'unknown');
  }
}

function enhanceGraphs() {
  for (const node of root?.querySelectorAll('.sg-chart-studio') || []) {
    applyDamageGaps(node);
    const annotationToggle = node.querySelector('[data-sg-v17-annotation="bigHits"]');
    if (!annotationToggle || annotationToggle.checked) applyExactTopHitAnnotations(node);
  }
}

function compareNumber(a, b) {
  const left = Number(a), right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  const delta = left - right;
  const tolerance = Math.max(0.001, Math.abs(right) * 1e-9);
  return { left, right, delta, match: Math.abs(delta) <= tolerance };
}

function normalizeReferencePlayers(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.entries(value).map(([name, metrics]) => ({ name, ...metrics }));
  return [];
}

async function renderReferenceComparison(panel, reference) {
  const host = panel.querySelector('[data-sg-reference-results]');
  host.innerHTML = '<div class="sg-accuracy-loading">Comparing the reference with the verified Strikeglass report…</div>';
  try {
    const report = await verifiedReport(currentScope());
    const checks = [];
    const group = reference.group || reference.party || {};
    const groupFields = [['damage', report.damage], ['dps', report.partyDps], ['activeDps', report.partyCombatDps], ['duration', report.duration], ['hits', report.hits]];
    for (const [key, actual] of groupFields) if (group[key] != null) checks.push({ owner: 'Group', metric: key, ...compareNumber(actual, group[key]) });
    const byName = new Map((report.players || []).map(player => [normalize(player.name), player]));
    for (const expected of normalizeReferencePlayers(reference.players)) {
      const actual = byName.get(normalize(expected.name));
      if (!actual) { checks.push({ owner: expected.name || 'Player', metric: 'player', match: false, missing: true }); continue; }
      for (const [key, source] of [['damage', 'damage'], ['dps', 'dps'], ['activeDps', 'combatDps'], ['hits', 'hits'], ['critRate', 'crit'], ['caRate', 'flank']]) {
        if (expected[key] == null || actual[source] == null) continue;
        checks.push({ owner: actual.name, metric: key, ...compareNumber(actual[source], expected[key]) });
      }
    }
    const mismatches = checks.filter(check => !check.match);
    host.innerHTML = `<div class="sg-reference-summary">${statePill(mismatches.length ? 'unknown' : 'exact')}<strong>${mismatches.length ? `${mismatches.length} mismatch${mismatches.length === 1 ? '' : 'es'}` : 'All supplied reference metrics match'}</strong><span>${checks.length} metric${checks.length === 1 ? '' : 's'} compared · ${esc(reference.source || 'external reference')}</span></div><div class="sg-reference-table"><table><thead><tr><th>Owner</th><th>Metric</th><th>Strikeglass</th><th>Reference</th><th>Delta</th><th>Status</th></tr></thead><tbody>${checks.map(check => `<tr><td>${esc(check.owner)}</td><td>${esc(check.metric)}</td><td>${check.left == null ? '—' : esc(String(check.left))}</td><td>${check.right == null ? '—' : esc(String(check.right))}</td><td>${check.delta == null ? '—' : esc(String(check.delta))}</td><td>${check.match ? 'Match' : check.missing ? 'Missing player' : 'Review'}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) {
    host.innerHTML = `<div class="sg-accuracy-error">${esc(error.message || String(error))}</div>`;
  }
}

function ensureReferencePanel() {
  if (activeView() !== 'diagnostics' || root.querySelector('[data-sg-reference-parity]')) return;
  const panel = document.createElement('section');
  panel.className = 'panel sg-reference-parity';
  panel.dataset.sgReferenceParity = 'true';
  panel.innerHTML = `
    <div class="panel-head"><div><span class="eyebrow">External parity</span><h2>Compare a trusted parser result</h2></div>${statePill('derived')}</div>
    <p class="sg-accuracy-help">Import a reference JSON captured from NW-Hub, ACT, or another trusted parser. Strikeglass compares only metrics that the reference supplies; a different metric definition must be documented rather than forced to match.</p>
    <div class="sg-reference-controls"><label class="button"><input type="file" accept="application/json,.json" data-sg-reference-file>Import reference JSON</label><button class="button" type="button" data-sg-reference-template>Download template</button></div>
    <div data-sg-reference-results></div>`;
  root.prepend(panel);
  panel.querySelector('[data-sg-reference-file]')?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try { await renderReferenceComparison(panel, JSON.parse(await file.text())); }
    catch (error) { panel.querySelector('[data-sg-reference-results]').innerHTML = `<div class="sg-accuracy-error">Invalid reference JSON: ${esc(error.message || String(error))}</div>`; }
  });
  panel.querySelector('[data-sg-reference-template]')?.addEventListener('click', () => {
    const template = { source: 'NW-Hub', capturedAt: new Date().toISOString(), metricDefinitions: { dps: 'Document the reference parser clock here.' }, group: { damage: null, dps: null, activeDps: null, duration: null, hits: null }, players: [{ name: 'Player name', damage: null, dps: null, activeDps: null, hits: null, critRate: null, caRate: null }] };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'strikeglass-reference-template.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function verificationLanguage() {
  for (const node of document.querySelectorAll('.verification-strip strong, .verification-banner strong, [data-verification] strong')) {
    if (/checked twice/i.test(node.textContent || '')) node.title = 'Core combat totals and clocks were recalculated by the independent arithmetic verifier. Classification and inferred mechanics have their own evidence states.';
  }
}

async function scan() {
  const generation = ++scanGeneration;
  ensureStyle();
  enhanceMetricEvidence();
  applyEffectLanguage();
  bossEvidence();
  ensureReferencePanel();
  await Promise.allSettled([applyPlayerColors(), ensureTaxonomyPanel()]);
  if (generation !== scanGeneration) return;
  enhanceGraphs();
  verificationLanguage();
  document.dispatchEvent(new CustomEvent(SCAN_EVENT));
}

function schedule(delay = 0) {
  clearTimeout(scheduled);
  scheduled = setTimeout(() => requestAnimationFrame(scan), delay);
}

root?.addEventListener('change', event => {
  if (event.target.matches('[data-sg-v17-mode],[data-sg-v17-scale],[data-sg-v17-annotation]')) {
    root.querySelectorAll('.sg-chart-studio').forEach(node => { node.dataset.sgExactHits = ''; });
    schedule(80);
  }
});
playerSelect?.addEventListener('change', () => schedule(20));
scopeSelect?.addEventListener('change', () => { topHitCache.clear(); schedule(20); });
document.addEventListener('strikeglass:view-rendered', () => schedule(20));
document.addEventListener('strikeglass:analysis-ready', () => schedule(20));
document.addEventListener('strikeglass:settings-changed', () => schedule(20));
new MutationObserver(() => schedule(80)).observe(root || document.body, { childList: true, subtree: false });

ensureStyle();
schedule();
