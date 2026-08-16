import {
  EVENT_PAGE_SIZE,
  activeView,
  compact,
  currentScope,
  esc,
  root,
  scopeSelect,
  workerRequest
} from '../v8/core.js';
import { isKnownEncounterPowerName } from '../data/encounter-power-icons.js';

const STYLE_ATTR = 'data-evidence-coverage-style';
let scheduled = 0;
let generation = 0;
const rotationCache = new Map();
const effectCache = new Map();

function ensureStyle() {
  if (document.querySelector(`link[${STYLE_ATTR}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./evidence-coverage.css', import.meta.url).href;
  link.setAttribute(STYLE_ATTR, 'true');
  document.head.append(link);
}

function scopeKey(scope = currentScope()) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${Number(scope.id)}:${scope.targetOnly ? 'target' : 'window'}`;
}

function pill(kind, text) {
  return `<span class="sg-evidence-pill is-${esc(kind)}">${esc(text)}</span>`;
}

async function allRawRows(scope, options = {}) {
  const rows = [];
  let cursor = null;
  do {
    const page = await workerRequest('raw-page', { options: { cursor, limit: EVENT_PAGE_SIZE, scope, ...options } }, 45000);
    if (page?.verification?.status !== 'verified') throw new Error('Direct evidence is waiting for the arithmetic verification gate.');
    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
    if (cursor != null) await new Promise(resolve => setTimeout(resolve, 0));
  } while (cursor != null);
  return rows;
}

async function rotationEvidence(scope) {
  const key = scopeKey(scope);
  if (rotationCache.has(key)) return rotationCache.get(key);
  const promise = (async () => {
    const [rotation, resourceRows] = await Promise.all([
      workerRequest('rotation-report', { scope }, 90000),
      allRawRows(scope, { kind: 'resource' })
    ]);
    if (!rotation?.report) throw new Error(rotation?.error || 'Power timing report is unavailable.');
    const report = rotation.report;
    const origin = Number(report.scope?.start) || 0;
    const explicit = resourceRows.filter(row =>
      Number(row.amount) < 0 &&
      row.sourceRef === '*' &&
      !row.companion &&
      /^P\[/.test(String(row.ownerRef || '')) &&
      isKnownEncounterPowerName(row.powerName)
    );
    const laneByRef = new Map((report.lanes || []).map(lane => [lane.ref, lane]));
    let matched = 0;
    const misses = [];
    for (const marker of explicit) {
      const lane = laneByRef.get(marker.ownerRef);
      const markerTime = Math.max(0, Number(marker.time) - origin);
      const match = lane?.activations?.some(activation =>
        activation.power === marker.powerName &&
        Math.abs(Number(activation.time) - markerTime) <= 0.25
      );
      if (match) matched += 1;
      else misses.push({ owner: marker.ownerName, power: marker.powerName, time: markerTime, lineNo: marker.lineNo });
    }
    const total = Number(report.activationCount) || (report.lanes || []).reduce((sum, lane) => sum + (lane.activations?.length || 0), 0);
    return {
      total,
      explicit: explicit.length,
      matched,
      unmatched: misses.length,
      directCoverage: total ? matched / total : 0,
      markerAgreement: explicit.length ? matched / explicit.length : 1,
      misses: misses.slice(0, 12),
      verification: report.verification || null
    };
  })().catch(error => { rotationCache.delete(key); throw error; });
  rotationCache.set(key, promise);
  return promise;
}

function formatPercent(value) {
  return `${(Math.max(0, Math.min(1, Number(value) || 0)) * 100).toFixed(1)}%`;
}

async function ensureRotationCoverage(localGeneration) {
  if (activeView() !== 'timeline' || root.querySelector('[data-sg-rotation-coverage]')) return;
  const shell = document.createElement('section');
  shell.className = 'panel sg-evidence-coverage';
  shell.dataset.sgRotationCoverage = 'true';
  shell.innerHTML = '<div class="sg-evidence-loading">Checking explicit power-use evidence…</div>';
  const semantic = root.querySelector('[data-sg-rotation-evidence]');
  if (semantic) semantic.insertAdjacentElement('afterend', shell); else root.prepend(shell);
  try {
    const evidence = await rotationEvidence(currentScope());
    if (localGeneration !== generation || !shell.isConnected || activeView() !== 'timeline') return;
    const direct = evidence.directCoverage;
    shell.innerHTML = `
      <div class="sg-evidence-head"><div><span class="eyebrow">Activation evidence</span><h2>How much of this timeline is directly marked by the log?</h2></div>${pill(evidence.unmatched ? 'review' : 'good', evidence.unmatched ? 'Review marker mismatch' : 'Explicit markers agree')}</div>
      <div class="sg-evidence-summary-grid">
        <article><span>Total reconstructed activations</span><strong>${evidence.total.toLocaleString()}</strong><small>All power categories shown on the timeline</small></article>
        <article><span>Explicit Encounter markers</span><strong>${evidence.explicit.toLocaleString()}</strong><small>${evidence.matched.toLocaleString()} matched a reconstructed activation</small></article>
        <article><span>Direct marker coverage</span><strong>${formatPercent(direct)}</strong><small>Share of all reconstructed activations backed by an explicit Encounter resource marker</small></article>
        <article><span>Marker agreement</span><strong>${formatPercent(evidence.markerAgreement)}</strong><small>${evidence.unmatched ? `${evidence.unmatched} explicit marker${evidence.unmatched === 1 ? '' : 's'} not matched` : 'Every explicit marker was represented'}</small></article>
      </div>
      <p class="sg-evidence-help">At-Wills, Dailies, artifacts, mounts and some powers do not expose a reliable cast marker in the combat log, so low direct coverage is not automatically an error. Those activations remain <strong>inferred</strong>. Explicit Encounter markers are an independent spot-check because this comparison does not use the category dedupe threshold to decide whether the marker exists.</p>
      ${evidence.misses.length ? `<details class="sg-evidence-details"><summary>Review unmatched explicit markers</summary>${evidence.misses.map(item => `<div><strong>${esc(item.power)}</strong><span>${esc(item.owner || 'Unknown player')}</span><small>${item.time.toFixed(2)}s · log line ${item.lineNo || '—'}</small></div>`).join('')}</details>` : ''}`;
  } catch (error) {
    if (shell.isConnected) shell.innerHTML = `<div class="sg-evidence-error">${esc(error.message || String(error))}</div>`;
  }
}

async function effectEvidence(scope) {
  const key = scopeKey(scope);
  if (effectCache.has(key)) return effectCache.get(key);
  const promise = workerRequest('effect-intelligence-report', { scope }, 90000).then(report => {
    if (!report) throw new Error('Effect Intelligence report is unavailable.');
    const rows = (report.effects || []).map(effect => {
      const empirical = effect.verification?.empirical || {};
      return {
        name: effect.name,
        sourceType: effect.sourceType,
        confidence: effect.verification?.confidence || 'UNRESOLVED',
        timelineVerified: Boolean(effect.verification?.timelineVerified),
        status: empirical.status || 'unknown',
        mode: empirical.mode || 'timeline-evidence',
        hits: Number(empirical.comparableHits) || 0,
        players: Number(empirical.players) || 0,
        coverage: Number(empirical.observableCoverage) || 0,
        agreement: Number.isFinite(Number(empirical.directionAgreement)) ? Number(empirical.directionAgreement) : null,
        medianUplift: Number.isFinite(Number(empirical.medianUplift)) ? Number(empirical.medianUplift) : null,
        baselineSamples: Number(empirical.baselineSamples) || 0
      };
    });
    return { report, rows };
  }).catch(error => { effectCache.delete(key); throw error; });
  effectCache.set(key, promise);
  return promise;
}

function effectStatusText(row) {
  if (!row.timelineVerified) return 'Timing unresolved';
  if (row.status === 'matched') return 'Strong supporting evidence';
  if (row.status === 'supported') return 'Some supporting evidence';
  if (row.status === 'mismatch') return 'Evidence conflicts';
  if (row.status === 'no-baseline') return 'No clean baseline';
  if (row.status === 'evidence-only') return 'Timeline evidence only';
  if (row.status === 'limited') return 'Limited evidence';
  return row.status.replace(/-/g, ' ');
}

async function ensureEffectCoverage(localGeneration) {
  if (activeView() !== 'debuffs' || root.querySelector('[data-sg-effect-coverage]')) return;
  const shell = document.createElement('section');
  shell.className = 'panel sg-evidence-coverage';
  shell.dataset.sgEffectCoverage = 'true';
  shell.innerHTML = '<div class="sg-evidence-loading">Reading effect evidence quality…</div>';
  const guide = root.querySelector('[data-sg-effect-evidence-legend]');
  if (guide) guide.insertAdjacentElement('afterend', shell); else root.prepend(shell);
  try {
    const { rows } = await effectEvidence(currentScope());
    if (localGeneration !== generation || !shell.isConnected || activeView() !== 'debuffs') return;
    const damageRows = rows.filter(row => row.mode === 'damage-baseline');
    const comparableHits = damageRows.reduce((sum, row) => sum + row.hits, 0);
    const baselineSamples = damageRows.reduce((sum, row) => sum + row.baselineSamples, 0);
    const conflicts = rows.filter(row => row.status === 'mismatch' || !row.timelineVerified).length;
    shell.innerHTML = `
      <div class="sg-evidence-head"><div><span class="eyebrow">Evidence quality</span><h2>What the debuff conclusions are based on</h2></div>${pill(conflicts ? 'review' : 'good', conflicts ? `${conflicts} item${conflicts === 1 ? '' : 's'} need review` : 'No evidence conflicts')}</div>
      <div class="sg-evidence-summary-grid">
        <article><span>Effects observed</span><strong>${rows.length}</strong><small>Detected support effects in this scope</small></article>
        <article><span>Comparable damage hits</span><strong>${comparableHits.toLocaleString()}</strong><small>Effect-window hits with an available clean baseline</small></article>
        <article><span>Baseline samples used</span><strong>${baselineSamples.toLocaleString()}</strong><small>Clean reference observations contributing to comparisons</small></article>
        <article><span>Evidence conflicts</span><strong>${conflicts}</strong><small>Timeline or empirical checks that should not be treated as confirmed</small></article>
      </div>
      <div class="sg-evidence-table-wrap"><table class="sg-evidence-table"><thead><tr><th>Effect</th><th>Evidence</th><th>Comparable hits</th><th>Players</th><th>Observable coverage</th><th>Direction agreement</th><th>Median observed uplift</th><th>Baseline samples</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.name)}</strong><small>${esc(row.sourceType || '')}</small></td><td>${esc(effectStatusText(row))}</td><td>${row.hits.toLocaleString()}</td><td>${row.players}</td><td>${formatPercent(row.coverage)}</td><td>${row.agreement == null ? '—' : formatPercent(row.agreement)}</td><td>${row.medianUplift == null ? '—' : `${(row.medianUplift * 100).toFixed(1)}%`}</td><td>${row.baselineSamples.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
      <p class="sg-evidence-help">These columns expose the sample size behind the conclusion. “Direction agreement” means comparable hits moved in the expected direction. It is supporting evidence, not a claim that the debuff alone caused every observed change. Strikeglass still refuses uptime publication when the deterministic timeline check fails.</p>`;
  } catch (error) {
    if (shell.isConnected) shell.innerHTML = `<div class="sg-evidence-error">${esc(error.message || String(error))}</div>`;
  }
}

async function scan() {
  ensureStyle();
  const localGeneration = ++generation;
  await Promise.allSettled([ensureRotationCoverage(localGeneration), ensureEffectCoverage(localGeneration)]);
}

function schedule(delay = 30) {
  clearTimeout(scheduled);
  scheduled = setTimeout(() => requestAnimationFrame(scan), delay);
}

document.addEventListener('strikeglass:view-rendered', () => schedule());
document.addEventListener('strikeglass:analysis-ready', () => schedule());
scopeSelect?.addEventListener('change', () => { rotationCache.clear(); effectCache.clear(); schedule(); });

ensureStyle();
schedule(0);
