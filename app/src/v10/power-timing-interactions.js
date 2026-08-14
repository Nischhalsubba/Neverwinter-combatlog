import { currentPlayerRef, currentScope, workerRequest } from '../v3/power-popup/worker.js';
import { findEncounterPowerIcon, loadEncounterPowerIconSprite } from '../data/encounter-power-icons.js';

const root = document.getElementById('view-root');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const CATEGORY_COLORS = Object.freeze({
  'At-Will': '#55b981',
  Encounter: '#4f7ff0',
  Daily: '#ef7b61',
  Artifact: '#67c5d8',
  Mount: '#e7b54a'
});
const CATEGORY_LABELS = Object.freeze({ 'At-Will': 'AW', Encounter: 'E', Daily: 'D', Artifact: 'AR', Mount: 'M' });
const MIN_ZOOM = .4;
const MAX_ZOOM = 5;
const BASE_PX_PER_SECOND = 3;
let zoom = 1;
let report = null;
let iconSprite = null;
let reportGeneration = 0;
let repaintPending = false;
let scopeReportCache = null;
let drag = null;
const laneHitboxes = new Map();

function ensureStyle() {
  if (document.querySelector('link[data-power-timing-v10-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./power-timing-interactions.css', import.meta.url).href;
  link.dataset.powerTimingV10Style = 'true';
  document.head.append(link);
}

function formatNumber(value) {
  const n = Number(value) || 0;
  const a = Math.abs(n);
  if (a >= 1e9) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n / 1e9) + 'B';
  if (a >= 1e6) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n / 1e6) + 'M';
  if (a >= 1e3) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n / 1e3) + 'K';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatPercent(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value) || 0) + '%';
}

function formatTime(value) {
  const n = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(n / 60);
  const seconds = n % 60;
  return minutes ? minutes + 'm ' + seconds.toFixed(1) + 's' : seconds.toFixed(1) + 's';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function tooltip() {
  let node = document.querySelector('[data-power-timing-tooltip]');
  if (node) return node;
  node = document.createElement('div');
  node.className = 'pt-tooltip';
  node.dataset.powerTimingTooltip = 'true';
  node.setAttribute('role', 'tooltip');
  node.hidden = true;
  document.body.append(node);
  return node;
}

function placeTooltip(node, clientX, clientY) {
  const gap = 14;
  const rect = node.getBoundingClientRect();
  let left = clientX + gap;
  let top = clientY + gap;
  if (left + rect.width > innerWidth - 10) left = clientX - rect.width - gap;
  if (top + rect.height > innerHeight - 10) top = clientY - rect.height - gap;
  node.style.left = Math.max(8, left) + 'px';
  node.style.top = Math.max(8, top) + 'px';
}

function showTooltip(html, clientX, clientY) {
  const node = tooltip();
  node.innerHTML = html;
  node.hidden = false;
  node.classList.add('is-visible');
  placeTooltip(node, clientX, clientY);
  if (!reduceMotion.matches) node.animate([{ opacity: .01, transform: 'translateY(4px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 145, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
}

function hideTooltip() {
  const node = document.querySelector('[data-power-timing-tooltip]');
  if (!node) return;
  node.classList.remove('is-visible');
  node.hidden = true;
}

function selectedCategories(panel) {
  return new Set(Array.from(panel.querySelectorAll('[data-rotation-filter][aria-pressed="true"]')).map(button => button.dataset.rotationFilter));
}

function timelineScrolls(panel) {
  return Array.from(panel.querySelectorAll('.rotation-scroll'));
}

function timelineViewport(panel) {
  const scroll = panel.querySelector('.rotation-scroll');
  return Math.max(640, scroll?.clientWidth || panel.clientWidth || 900);
}

function timelineWidth(panel) {
  return Math.max(timelineViewport(panel), Math.min(12000, Math.ceil(Math.max(1, Number(report?.duration) || 1) * BASE_PX_PER_SECOND * zoom)));
}

function syncScroll(panel, value, source = null) {
  for (const scroll of timelineScrolls(panel)) if (scroll !== source && Math.abs(scroll.scrollLeft - value) > 1) scroll.scrollLeft = value;
  if (source && Math.abs(source.scrollLeft - value) > 1) source.scrollLeft = value;
}

function updateZoomLabel(panel) {
  const node = panel.querySelector('[data-pt-zoom-label]');
  if (node) node.textContent = Math.round(zoom * 100) + '%';
}

function rulerMarkup(duration, width) {
  const desired = Math.max(6, Math.min(18, Math.floor(width / 120)));
  return Array.from({ length: desired }, (_, index) => {
    const ratio = desired <= 1 ? 0 : index / (desired - 1);
    return '<span style="left:' + (ratio * 100) + '%">' + formatTime(duration * ratio) + '</span>';
  }).join('');
}

function applyDimensions(panel, anchor = null) {
  if (!report) return;
  const previousWidth = Number(panel.dataset.ptTimelineWidth) || timelineWidth(panel);
  const width = timelineWidth(panel);
  panel.dataset.ptTimelineWidth = String(width);
  const timeline = panel.querySelector('.rotation-timeline');
  if (timeline) {
    timeline.style.width = width + 'px';
    timeline.innerHTML = '<div class="rotation-ruler">' + rulerMarkup(report.duration, width) + '</div>';
  }
  for (const canvas of panel.querySelectorAll('canvas[data-rotation-lane]')) {
    canvas.style.width = width + 'px';
    canvas.style.height = '58px';
  }
  updateZoomLabel(panel);
  if (anchor) {
    const oldPoint = anchor.scrollLeft + anchor.localX;
    const ratio = previousWidth ? oldPoint / previousWidth : 0;
    syncScroll(panel, Math.max(0, ratio * width - anchor.localX));
  }
}

function setZoom(panel, next, anchor = null) {
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(next) || 1));
  applyDimensions(panel, anchor);
  scheduleRepaint();
}

function fitZoom(panel) {
  const duration = Math.max(1, Number(report?.duration) || 1);
  const next = timelineViewport(panel) / (duration * BASE_PX_PER_SECOND);
  setZoom(panel, Math.max(MIN_ZOOM, Math.min(1, next)));
  syncScroll(panel, 0);
}

function controlsMarkup() {
  return '<div class="pt-toolbar" data-pt-toolbar>' +
    '<div class="pt-legend" aria-label="Hit result legend">' +
      '<span><i class="is-ca"></i>Combat Adv.</span>' +
      '<span><i class="is-crit"></i>Crit</span>' +
      '<span><i class="is-deflect"></i>Deflected</span>' +
      '<span><i class="is-size"></i>Bigger = more damage</span>' +
    '</div>' +
    '<div class="pt-zoom" aria-label="Timeline zoom controls">' +
      '<button type="button" data-pt-zoom-out aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>' +
      '<output data-pt-zoom-label aria-live="polite">100%</output>' +
      '<button type="button" data-pt-zoom-in aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '<button type="button" data-pt-fit aria-label="Fit timeline" title="Fit timeline"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg></button>' +
    '</div>' +
  '</div>';
}

function enhanceHelp(panel) {
  const help = panel.querySelector('.rotation-help');
  if (!help) return;
  help.textContent = 'Every verified player power use shares one clock. Drag to pan, wheel to zoom, and Shift + wheel to scroll. Blue, yellow, and gray marks show Combat Advantage, Critical, and Deflected hits. Hover a power use for verified details.';
}

function ensureControls(panel) {
  if (!panel.querySelector('[data-pt-toolbar]')) panel.querySelector('.panel-head')?.insertAdjacentHTML('afterend', controlsMarkup());
  if (panel.dataset.ptControlsBound === 'true') return;
  panel.dataset.ptControlsBound = 'true';
  panel.querySelector('[data-pt-zoom-out]')?.addEventListener('click', () => setZoom(panel, zoom / 1.25));
  panel.querySelector('[data-pt-zoom-in]')?.addEventListener('click', () => setZoom(panel, zoom * 1.25));
  panel.querySelector('[data-pt-fit]')?.addEventListener('click', () => fitZoom(panel));
}

function markerSize(item, maxDamage) {
  const damage = Math.max(0, Number(item.damage) || 0);
  if (!damage || !maxDamage) return 22;
  return 22 + Math.sqrt(damage / maxDamage) * 10;
}

function drawFallbackMarker(ctx, category, x, y, size, hovered) {
  const color = CATEGORY_COLORS[category] || '#8093a1';
  const label = CATEGORY_LABELS[category] || '?';
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = hovered ? color : 'transparent';
  ctx.shadowBlur = hovered ? 12 : 0;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,.82)';
  ctx.lineWidth = hovered ? 2.2 : 1.3;
  if (category === 'Daily') {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.roundRect(-size * .34, -size * .34, size * .68, size * .68, 3);
    ctx.fill(); ctx.stroke();
    ctx.rotate(-Math.PI / 4);
  } else if (category === 'At-Will') {
    ctx.beginPath(); ctx.arc(0, 0, size * .39, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.roundRect(-size * .4, -size * .4, size * .8, size * .8, 5); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#071018';
  ctx.font = '800 ' + Math.max(8, Math.round(size * .27)) + 'px ui-monospace,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawIndicators(ctx, item, x, y, size) {
  const indicators = [];
  if ((Number(item.caHits) || 0) > 0) indicators.push('#62a9f5');
  if ((Number(item.critHits) || 0) > 0) indicators.push('#f2c94c');
  if ((Number(item.deflectedHits) || 0) > 0) indicators.push('#a9b4bd');
  if (!indicators.length) return;
  const spacing = 7;
  const start = x - (indicators.length - 1) * spacing / 2;
  indicators.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(7,16,24,.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(start + index * spacing, y + size * .53, 3.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });
}

function overlayFor(canvas, width, height) {
  const scroll = canvas.parentElement;
  if (!scroll) return null;
  let overlay = scroll.querySelector('canvas[data-power-timing-v10-layer]');
  if (!overlay) {
    overlay = document.createElement('canvas');
    overlay.className = 'pt-canvas';
    overlay.dataset.powerTimingV10Layer = canvas.dataset.rotationLane || '';
    scroll.append(overlay);
  }
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  overlay.width = Math.max(1, Math.floor(width * dpr));
  overlay.height = Math.max(1, Math.floor(height * dpr));
  overlay.style.width = width + 'px';
  overlay.style.height = height + 'px';
  return { overlay, dpr };
}

function activationTooltip(hit) {
  const item = hit.item;
  const details = Number(item.hits) > 0
    ? '<div class="pt-tooltip-grid"><span>Damage</span><b>' + formatNumber(item.damage) + '</b><span>Hits</span><b>' + formatNumber(item.hits) + '</b><span>Highest hit</span><b>' + formatNumber(item.maxHit) + '</b></div>'
    : '<p class="pt-tooltip-note">No direct damage was logged near this activation.</p>';
  const flags = '<div class="pt-tooltip-flags"><span class="is-crit">Crit ' + formatNumber(item.critHits) + '</span><span class="is-ca">Combat Adv. ' + formatNumber(item.caHits) + '</span><span class="is-deflect">Deflected ' + formatNumber(item.deflectedHits) + '</span></div>';
  return '<strong class="pt-tooltip-title">' + escapeHtml(item.power) + '</strong><span class="pt-tooltip-meta">' + escapeHtml(hit.lane.name) + ' · ' + escapeHtml(item.category) + ' · ' + formatTime(item.time) + '</span>' + details + flags;
}

function nearestHit(canvas, lane, event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let nearest = null;
  let distance = Infinity;
  for (const hit of laneHitboxes.get(lane.ref) || []) {
    const dx = x - hit.x;
    const dy = y - hit.y;
    const d = Math.hypot(dx, dy);
    if (d <= hit.radius && d < distance) { nearest = hit; distance = d; }
  }
  return nearest;
}

function bindCanvasInteractions(panel, canvas, lane) {
  if (canvas.dataset.ptBound === 'true') return;
  canvas.dataset.ptBound = 'true';
  let hovered = '';
  canvas.addEventListener('pointermove', event => {
    if (drag) return;
    const hit = nearestHit(canvas, lane, event);
    const next = hit?.key || '';
    if (next !== hovered) {
      hovered = next;
      const base = panel.querySelector('canvas[data-rotation-lane="' + CSS.escape(lane.ref) + '"]');
      if (base) drawLane(panel, base, lane, hovered);
    }
    if (hit) showTooltip(activationTooltip(hit), event.clientX, event.clientY);
    else hideTooltip();
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = '';
    hideTooltip();
    const base = panel.querySelector('canvas[data-rotation-lane="' + CSS.escape(lane.ref) + '"]');
    if (base) drawLane(panel, base, lane, '');
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const source = canvas.parentElement;
    drag = { pointerId: event.pointerId, startX: event.clientX, startScroll: source.scrollLeft, panel, source };
    canvas.setPointerCapture(event.pointerId);
    panel.classList.add('is-panning');
    hideTooltip();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    syncScroll(panel, drag.startScroll - (event.clientX - drag.startX), drag.source);
  });
  const endDrag = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    panel.classList.remove('is-panning');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

function drawLane(panel, baseCanvas, lane, hoveredKey = '') {
  const width = Number(panel.dataset.ptTimelineWidth) || timelineWidth(panel);
  const height = 58;
  const built = overlayFor(baseCanvas, width, height);
  if (!built) return;
  const { overlay, dpr } = built;
  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const categories = selectedCategories(panel);
  const visible = (lane.activations || []).filter(item => categories.has(item.category));
  const maxDamage = Math.max(1, ...visible.map(item => Number(item.damage) || 0));
  const hitboxes = [];
  ctx.strokeStyle = 'rgba(120,145,162,.22)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 50.5); ctx.lineTo(width, 50.5); ctx.stroke();

  visible.forEach((item, index) => {
    const x = Math.max(14, Math.min(width - 14, (Number(item.time) || 0) / Math.max(1, Number(report.duration) || 1) * width));
    const key = lane.ref + ':' + index + ':' + item.time + ':' + item.power;
    const hovered = key === hoveredKey;
    const size = markerSize(item, maxDamage) + (hovered ? 4 : 0);
    const y = 24;
    if (item.category === 'Encounter') {
      const icon = findEncounterPowerIcon(item.power, lane.className);
      if (icon && iconSprite) {
        ctx.save();
        ctx.shadowColor = hovered ? 'rgba(79,127,240,.78)' : 'rgba(79,127,240,.32)';
        ctx.shadowBlur = hovered ? 14 : 6;
        ctx.fillStyle = 'rgba(7,16,24,.94)';
        ctx.strokeStyle = hovered ? '#8ca9ff' : '#4f7ff0';
        ctx.lineWidth = hovered ? 2.5 : 1.4;
        ctx.beginPath(); ctx.roundRect(x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4, 5); ctx.fill(); ctx.stroke();
        ctx.drawImage(iconSprite, icon.x, icon.y, icon.width, icon.height, x - size / 2, y - size / 2, size, size);
        ctx.restore();
      } else drawFallbackMarker(ctx, item.category, x, y, size, hovered);
    } else drawFallbackMarker(ctx, item.category, x, y, size, hovered);
    drawIndicators(ctx, item, x, y, size);
    hitboxes.push({ x, y, radius: Math.max(16, size * .62), item, lane, key });
  });
  laneHitboxes.set(lane.ref, hitboxes);
  bindCanvasInteractions(panel, overlay, lane);
}

function bindScrollAndWheel(panel) {
  for (const scroll of timelineScrolls(panel)) {
    if (scroll.dataset.ptScrollBound === 'true') continue;
    scroll.dataset.ptScrollBound = 'true';
    scroll.addEventListener('scroll', () => { if (!drag || drag.source === scroll) syncScroll(panel, scroll.scrollLeft, scroll); }, { passive: true });
    scroll.addEventListener('wheel', event => {
      if (event.shiftKey) {
        event.preventDefault();
        syncScroll(panel, scroll.scrollLeft + event.deltaY + event.deltaX, scroll);
        return;
      }
      event.preventDefault();
      const rect = scroll.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom(panel, zoom * factor, { scrollLeft: scroll.scrollLeft, localX });
    }, { passive: false });
  }
}

function paintRotation(panel) {
  if (!report || report.verification?.status !== 'verified') return;
  panel.dataset.powerTimingV10 = 'true';
  applyDimensions(panel);
  bindScrollAndWheel(panel);
  const byRef = new Map((report.lanes || []).map(lane => [lane.ref, lane]));
  for (const base of panel.querySelectorAll('canvas[data-rotation-lane]')) {
    const lane = byRef.get(base.dataset.rotationLane || '');
    if (lane) drawLane(panel, base, lane, '');
  }
}

function scheduleRepaint() {
  if (repaintPending) return;
  repaintPending = true;
  requestAnimationFrame(() => {
    repaintPending = false;
    const panel = root?.querySelector('.rotation-panel');
    if (panel) paintRotation(panel);
  });
}

async function enhanceRotation(panel) {
  if (panel.dataset.ptEnhancing === 'true') return;
  panel.dataset.ptEnhancing = 'true';
  const generation = ++reportGeneration;
  try {
    ensureControls(panel);
    enhanceHelp(panel);
    const [nextReport, sprite] = await Promise.all([
      workerRequest('rotation-report', { scope: currentScope() }, 45000),
      loadEncounterPowerIconSprite().catch(() => null)
    ]);
    if (generation !== reportGeneration || !panel.isConnected) return;
    if (nextReport?.verification?.status !== 'verified') return;
    report = nextReport;
    iconSprite = sprite;
    fitZoom(panel);
    paintRotation(panel);
  } finally {
    panel.dataset.ptEnhancing = 'false';
  }
}

function categoryTooltipMarkup(category) {
  return '<strong class="pt-tooltip-title">' + escapeHtml(category.category) + '</strong>' +
    '<span class="pt-tooltip-meta">Verified damage in the selected fight</span>' +
    '<div class="pt-tooltip-grid"><span>Total damage</span><b>' + formatNumber(category.damage) + '</b><span>Share of player damage</span><b>' + formatPercent(category.share) + '</b><span>Hits</span><b>' + formatNumber(category.hits) + '</b><span>Powers</span><b>' + formatNumber(category.powers) + '</b></div>';
}

async function enhanceCategoryBars(panel) {
  const key = JSON.stringify(currentScope()) + '|' + currentPlayerRef();
  if (!scopeReportCache || scopeReportCache.key !== key) {
    const scoped = await workerRequest('scope-report', { scope: currentScope() }, 45000);
    if (scoped?.verification?.status !== 'verified') return;
    scopeReportCache = { key, report: scoped };
  }
  const player = scopeReportCache.report.players?.find(item => item.ref === currentPlayerRef()) || scopeReportCache.report.players?.[0];
  if (!player) return;
  const byCategory = new Map((player.categories || []).map(category => [category.category, category]));
  for (const row of panel.querySelectorAll('.analysis-bar-row')) {
    if (row.dataset.ptCategoryBound === 'true') continue;
    const label = row.querySelector('strong')?.textContent?.trim() || '';
    const category = byCategory.get(label);
    if (!category) continue;
    row.dataset.ptCategoryBound = 'true';
    row.tabIndex = 0;
    row.setAttribute('aria-label', label + ': ' + formatNumber(category.damage) + ' damage, ' + formatPercent(category.share));
    const show = event => {
      const rect = row.getBoundingClientRect();
      showTooltip(categoryTooltipMarkup(category), event.clientX || rect.left + rect.width / 2, event.clientY || rect.top + rect.height / 2);
    };
    row.addEventListener('pointerenter', show);
    row.addEventListener('pointermove', show);
    row.addEventListener('pointerleave', hideTooltip);
    row.addEventListener('focus', show);
    row.addEventListener('blur', hideTooltip);
  }
}

async function scan() {
  const rotationPanel = root?.querySelector('.rotation-panel');
  if (rotationPanel && rotationPanel.dataset.ptReady !== 'true') {
    rotationPanel.dataset.ptReady = 'true';
    await enhanceRotation(rotationPanel).catch(() => {});
  }
  const categoryPanel = root?.querySelector('.category-panel');
  if (categoryPanel) enhanceCategoryBars(categoryPanel).catch(() => {});
}

ensureStyle();
if (root) {
  new MutationObserver(() => queueMicrotask(scan)).observe(root, { childList: true, subtree: true });
  scan();
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-rotation-filter],[data-rotation-all]')) return;
  setTimeout(scheduleRepaint, 0);
});
window.addEventListener('resize', () => {
  const panel = root?.querySelector('.rotation-panel');
  if (!panel || !report) return;
  applyDimensions(panel);
  scheduleRepaint();
}, { passive: true });
