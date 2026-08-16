import {
  RANGE_EVENT,
  activeView,
  compact,
  currentScope,
  esc,
  fullScopedRows,
  publishRange,
  root,
  scopeKey,
  verifiedReport
} from './shared.js';

let generation = 0;
let densityAbort = null;
let sparkObserver = null;
const sparkPending = new Set();
let sparkActive = 0;
const SPARK_CONCURRENCY = 2;

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

async function playerDistribution() {
  if (activeView() !== 'players' || root.querySelector('[data-sg-player-distribution]')) return;
  try {
    const report = await verifiedReport(currentScope());
    if (activeView() !== 'players' || root.querySelector('[data-sg-player-distribution]')) return;
    const rows = (report.players || []).map(player => ({ ref: player.ref, name: player.name, damage: Number(player.damage) || 0 }));
    const total = rows.reduce((sum, row) => sum + row.damage, 0) || 1;
    const section = document.createElement('section');
    section.className = 'panel sg-player-distribution';
    section.dataset.sgPlayerDistribution = 'true';
    section.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">Damage share</span><h2>Party distribution</h2></div><span>${rows.length} players</span></div>
      <div class="sg-share-strip" role="img" aria-label="Party damage share">${rows.map(row => `<i data-player-ref="${esc(row.ref)}" style="--share:${row.damage / total * 100}%;--sg-player-share-color:${stableColor(row.ref)}" title="${esc(row.name)}"></i>`).join('')}</div>
      <div class="sg-share-legend">${rows.map(row => `<span data-player-ref="${esc(row.ref)}" style="--sg-player-share-color:${stableColor(row.ref)}"><b>${esc(row.name)}</b><small>${(row.damage / total * 100).toFixed(1)}%</small></span>`).join('')}</div>`;
    root.firstElementChild?.insertAdjacentElement('afterend', section);
  } catch {}
}

function sparklineSvg(points) {
  const max = Math.max(1, ...points.map(point => Number(point.damage) || 0));
  const sampled = points.length <= 80 ? points : Array.from({ length: 80 }, (_, index) => points[Math.min(points.length - 1, Math.floor(index / 79 * (points.length - 1)))]);
  return `<svg class="sg-encounter-spark" viewBox="0 0 120 24" aria-label="Encounter damage sparkline" role="img"><polyline points="${sampled.map((point, index) => `${index / Math.max(1, sampled.length - 1) * 120},${23 - (Number(point.damage) || 0) / max * 21}`).join(' ')}"/></svg>`;
}

function drainSparkQueue(localGeneration) {
  if (sparkActive >= SPARK_CONCURRENCY || !sparkPending.size) return;
  const row = sparkPending.values().next().value;
  sparkPending.delete(row);
  if (!row?.isConnected || row.dataset.sgSpark === 'true') return drainSparkQueue(localGeneration);
  sparkActive += 1;
  row.dataset.sgSpark = 'loading';
  const [type, idText] = String(row.dataset.scope || '').split(':');
  verifiedReport({ type, id: Number(idText), targetOnly: false }).then(report => {
    if (localGeneration !== generation || !row.isConnected) return;
    row.cells[2]?.insertAdjacentHTML('beforeend', sparklineSvg(report.partyTimeline || []));
    row.dataset.sgSpark = 'true';
  }).catch(() => {
    if (row.isConnected) row.dataset.sgSpark = 'error';
  }).finally(() => {
    sparkActive = Math.max(0, sparkActive - 1);
    drainSparkQueue(localGeneration);
  });
  if (sparkActive < SPARK_CONCURRENCY) drainSparkQueue(localGeneration);
}

function queueSpark(row, localGeneration) {
  if (!row || row.dataset.sgSpark === 'true' || row.dataset.sgSpark === 'loading') return;
  sparkPending.add(row);
  drainSparkQueue(localGeneration);
}

function encounterSparklines() {
  if (activeView() !== 'encounters') return;
  const localGeneration = generation;
  const rows = Array.from(root.querySelectorAll('tbody tr[data-scope]'));
  if (!rows.length) return;
  if ('IntersectionObserver' in window) {
    sparkObserver?.disconnect();
    sparkObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        sparkObserver?.unobserve(entry.target);
        queueSpark(entry.target, localGeneration);
      }
    }, { rootMargin: '600px 0px' });
    for (const row of rows) if (row.dataset.sgSpark !== 'true') sparkObserver.observe(row);
    return;
  }
  for (const row of rows) queueSpark(row, localGeneration);
}

function categoryFilter() {
  if (activeView() !== 'powers') return;
  const panel = root.querySelector('.category-panel');
  const table = root.querySelector('.power-table');
  if (!panel || !table || panel.dataset.sgCategoryFilter === 'true') return;
  panel.dataset.sgCategoryFilter = 'true';
  const status = document.createElement('div');
  status.className = 'sg-category-filter';
  status.hidden = true;
  panel.append(status);
  panel.querySelectorAll('.analysis-bar-row').forEach(row => {
    row.tabIndex = 0;
    const run = () => {
      const category = row.querySelector('strong')?.textContent?.trim() || '';
      for (const tr of table.tBodies[0]?.rows || []) {
        const value = tr.querySelector('.category-badge')?.textContent?.trim() || '';
        tr.hidden = value !== category;
      }
      status.hidden = false;
      status.innerHTML = `Showing <strong>${esc(category)}</strong> powers <button type="button" class="button" data-sg-clear-category>Clear</button>`;
    };
    row.addEventListener('click', run);
    row.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      run();
    });
  });
  status.addEventListener('click', event => {
    if (!event.target.closest('[data-sg-clear-category]')) return;
    for (const tr of table.tBodies[0]?.rows || []) tr.hidden = false;
    status.hidden = true;
  });
}

function densitySvg(buckets, max) {
  return `<svg viewBox="0 0 1000 54" preserveAspectRatio="none" aria-hidden="true"><polyline points="${buckets.map((value, index) => `${index / Math.max(1, buckets.length - 1) * 1000},${52 - value / max * 48}`).join(' ')}"/></svg>`;
}

async function rawDensity() {
  if (activeView() !== 'events' || root.querySelector('[data-sg-event-density]')) return;
  const panel = root.querySelector('.qol-event-finder') || root.querySelector(':scope > .panel');
  if (!panel) return;
  densityAbort?.abort();
  densityAbort = new AbortController();
  const local = densityAbort;
  try {
    const report = await verifiedReport(currentScope());
    const offset = Number(report.scope?.start) || 0;
    const duration = Math.max(1, Number(report.duration) || Number(report.scope?.duration) || 1);
    const { rows, complete } = await fullScopedRows(currentScope());
    if (local.signal.aborted || activeView() !== 'events') return;
    const bucketCount = 120;
    const buckets = Array(bucketCount).fill(0);
    for (const row of rows) {
      const relative = Number(row.time) - offset;
      if (relative < 0 || relative > duration) continue;
      buckets[Math.min(bucketCount - 1, Math.floor(relative / duration * bucketCount))] += 1;
    }
    const max = Math.max(1, ...buckets);
    const section = document.createElement('section');
    section.className = 'panel sg-event-density';
    section.dataset.sgEventDensity = 'true';
    section.dataset.completeness = complete ? 'complete' : 'partial';
    section.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">Event density</span><h2>Where the log gets busy</h2></div><span class="${complete ? 'good-text' : 'warn-text'}">${complete ? 'Complete scope' : `Partial · first ${rows.length.toLocaleString()} rows`}</span></div>
      ${complete ? '' : '<p class="debuff-results-help">This density strip reached the visualization row cap. Use Raw Events filters for a complete targeted search.</p>'}
      <button type="button" class="sg-event-density-plot" aria-label="Select a time window from event density">${densitySvg(buckets, max)}<i data-sg-density-selection></i></button>`;
    panel.insertAdjacentElement('beforebegin', section);
    section.querySelector('button').addEventListener('click', event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const at = Math.max(0, Math.min(duration, (event.clientX - rect.left) / rect.width * duration));
      const start = Math.max(0, at - 5);
      const end = Math.min(duration, at + 5);
      publishRange({ key: scopeKey(), start, end, origin: 'events', source: 'event-density' });
      const finder = root.querySelector('[data-qol-event-form]');
      if (finder) {
        finder.elements.start.value = (offset + start).toFixed(1);
        finder.elements.end.value = (offset + end).toFixed(1);
      }
    });
    window.addEventListener(RANGE_EVENT, event => {
      const detail = event.detail || {};
      if (detail.scopeKey !== scopeKey()) return;
      const selection = section.querySelector('[data-sg-density-selection]');
      selection.style.left = `${detail.start / duration * 100}%`;
      selection.style.width = `${Math.max(.5, (detail.end - detail.start) / duration * 100)}%`;
    }, { signal: local.signal });
  } catch {}
}

function diagnosticsBars() {
  if (activeView() !== 'diagnostics' || root.querySelector('[data-sg-diagnostic-visuals]')) return;
  const panels = Array.from(root.querySelectorAll('.panel'));
  if (!panels.length) return;
  const entries = [];
  for (const panel of panels) {
    for (const row of panel.querySelectorAll('tr')) {
      const cells = row.cells;
      if (!cells || cells.length < 2) continue;
      const label = cells[0].textContent.trim();
      const raw = cells[cells.length - 1].textContent.replace(/,/g, '').trim();
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0) entries.push({ label, value });
    }
  }
  if (entries.length < 2) return;
  const max = Math.max(1, ...entries.map(entry => entry.value));
  const section = document.createElement('section');
  section.className = 'panel sg-diagnostic-visuals';
  section.dataset.sgDiagnosticVisuals = 'true';
  section.innerHTML = `<div class="panel-head"><div><span class="eyebrow">Health signals</span><h2>Analysis checks at a glance</h2></div><span>${entries.length} numeric checks</span></div><div class="sg-diagnostic-bars">${entries.slice(0, 12).map(item => `<div><span>${esc(item.label)}</span><i><b style="--value:${item.value / max * 100}%"></b></i><strong>${compact(item.value)}</strong></div>`).join('')}</div>`;
  root.firstElementChild?.insertAdjacentElement('beforebegin', section);
}

export function scanScenes() {
  playerDistribution();
  categoryFilter();
  diagnosticsBars();
  rawDensity();
  encounterSparklines();
}

export function resetScenes() {
  generation += 1;
  densityAbort?.abort();
  densityAbort = null;
  sparkObserver?.disconnect();
  sparkObserver = null;
  sparkPending.clear();
  sparkActive = 0;
}
