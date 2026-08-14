import { currentPlayerRef, currentScope, workerRequest } from '../v3/power-popup/worker.js';
import { findEncounterPowerIcon, loadEncounterPowerIconSprite } from '../data/encounter-power-icons.js';

const root = document.getElementById('view-root');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const number0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const number1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const CATEGORY_COLORS = Object.freeze({ 'At-Will':'#55b981', Encounter:'#4f7ff0', Daily:'#ef7b61', Artifact:'#67c5d8', Mount:'#e7b54a' });
const CATEGORY_LABELS = Object.freeze({ 'At-Will':'AW', Encounter:'E', Daily:'D', Artifact:'AR', Mount:'M' });
const MIN_ZOOM = .4;
const MAX_ZOOM = 12;
const MAX_WORLD_WIDTH = 200000;
const BASE_PX_PER_SECOND = 3;
const LANE_HEIGHT = 58;
const OVERSCAN_PX = 90;

let zoom = 1;
let report = null;
let iconSprite = null;
let reportGeneration = 0;
let repaintFrame = 0;
let resizeFrame = 0;
let scrollFrame = 0;
let drag = null;
let syncingScroll = false;
let scopeReportCache = null;
let debuffTiming = { windows: [], applications: [] };
const debuffTimingCache = new Map();
const laneCache = new Map();
const laneHitboxes = new Map();
const applicationBySource = new Map();
let panelResizeObserver = null;

function ensureStyle() {
  if (document.querySelector('link[data-power-timing-v12-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./power-timing-viewport.css', import.meta.url).href;
  link.dataset.powerTimingV12Style = 'true';
  document.head.append(link);
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function formatNumber(value) {
  const n = Number(value) || 0;
  const a = Math.abs(n);
  if (a >= 1e9) return number1.format(n / 1e9) + 'B';
  if (a >= 1e6) return number1.format(n / 1e6) + 'M';
  if (a >= 1e3) return number1.format(n / 1e3) + 'K';
  return number0.format(n);
}
function formatPercent(value) { return number1.format(Number(value) || 0) + '%'; }
function formatTime(value) {
  const n = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(n / 60);
  const seconds = n % 60;
  return minutes ? `${minutes}m ${seconds.toFixed(1)}s` : `${seconds.toFixed(1)}s`;
}

function addStyleLink() { ensureStyle(); }

function selectedCategories(panel) {
  return new Set(Array.from(panel.querySelectorAll('[data-rotation-filter][aria-pressed="true"]')).map(button => button.dataset.rotationFilter));
}
function timelineScrolls(panel) { return Array.from(panel.querySelectorAll('.rotation-scroll')); }
function timelineViewport(panel) {
  const scroll = panel.querySelector('.rotation-scroll');
  return Math.max(320, Math.floor(scroll?.clientWidth || panel.clientWidth || 900));
}
function maxZoomForReport() {
  const duration = Math.max(1, Number(report?.duration) || 1);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, MAX_WORLD_WIDTH / (duration * BASE_PX_PER_SECOND)));
}
function worldWidth(panel) {
  const duration = Math.max(1, Number(report?.duration) || 1);
  return Math.max(timelineViewport(panel), Math.min(MAX_WORLD_WIDTH, Math.ceil(duration * BASE_PX_PER_SECOND * zoom)));
}

function lowerBound(items, time) {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((Number(items[mid]?.time) || 0) < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function prepareLanes(nextReport) {
  laneCache.clear();
  for (const lane of nextReport?.lanes || []) {
    const activations = [...(lane.activations || [])].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
    let maxDamage = 1;
    for (const item of activations) maxDamage = Math.max(maxDamage, Number(item.damage) || Number(item.amount) || 0);
    laneCache.set(lane.ref, { lane, activations, maxDamage });
  }
}

function prepareApplications() {
  applicationBySource.clear();
  for (const application of debuffTiming.applications || []) {
    const keys = [application.sourceRef, application.sourceName].filter(Boolean);
    for (const key of keys) {
      if (!applicationBySource.has(key)) applicationBySource.set(key, []);
      applicationBySource.get(key).push(application);
    }
  }
  for (const list of applicationBySource.values()) list.sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
}

function debuffsNearActivation(lane, item) {
  const at = Number(item.time) || 0;
  const list = applicationBySource.get(lane.ref) || applicationBySource.get(lane.name) || [];
  if (!list.length) return [];
  const start = Math.max(0, lowerBound(list, at - .9));
  const names = new Set();
  for (let index = start; index < list.length; index += 1) {
    const application = list[index];
    const time = Number(application.time) || 0;
    if (time > at + .9) break;
    names.add(application.name);
  }
  return [...names];
}

function tooltipNode() {
  let node = document.querySelector('[data-power-timing-tooltip]');
  if (node) return node;
  node = document.createElement('div');
  node.className = 'pt-tooltip';
  node.dataset.powerTimingTooltip = 'true';
  node.setAttribute('role', 'tooltip');
  node.hidden = true;
  node.style.left = '0';
  node.style.top = '0';
  document.body.append(node);
  return node;
}
let tooltipKey = '';
let tooltipSize = { width: 0, height: 0 };
let tooltipMoveFrame = 0;
let tooltipPoint = { x: 0, y: 0 };
function placeTooltipNow() {
  tooltipMoveFrame = 0;
  const node = tooltipNode();
  if (node.hidden) return;
  const gap = 14;
  let left = tooltipPoint.x + gap;
  let top = tooltipPoint.y + gap;
  if (left + tooltipSize.width > innerWidth - 10) left = tooltipPoint.x - tooltipSize.width - gap;
  if (top + tooltipSize.height > innerHeight - 10) top = tooltipPoint.y - tooltipSize.height - gap;
  node.style.transform = `translate3d(${Math.max(8, Math.round(left))}px,${Math.max(8, Math.round(top))}px,0)`;
}
function moveTooltip(x, y) {
  tooltipPoint = { x, y };
  if (!tooltipMoveFrame) tooltipMoveFrame = requestAnimationFrame(placeTooltipNow);
}
function showTooltip(key, html, x, y) {
  const node = tooltipNode();
  if (key !== tooltipKey) {
    tooltipKey = key;
    node.innerHTML = html;
    node.hidden = false;
    const rect = node.getBoundingClientRect();
    tooltipSize = { width: rect.width, height: rect.height };
    if (!reduceMotion.matches) node.animate([{ opacity:.2 }, { opacity:1 }], { duration:90, easing:'linear' });
  } else if (node.hidden) node.hidden = false;
  moveTooltip(x, y);
}
function hideTooltip() {
  tooltipKey = '';
  const node = document.querySelector('[data-power-timing-tooltip]');
  if (node) node.hidden = true;
}

function activationTooltip(hit) {
  const item = hit.item;
  const details = Number(item.hits) > 0
    ? `<div class="pt-tooltip-grid"><span>Damage</span><b>${formatNumber(item.damage)}</b><span>Hits</span><b>${formatNumber(item.hits)}</b><span>Highest hit</span><b>${formatNumber(item.maxHit)}</b></div>`
    : '<p class="pt-tooltip-note">No direct damage was logged near this activation.</p>';
  const flags = `<div class="pt-tooltip-flags"><span class="is-crit">Crit ${formatNumber(item.critHits)}</span><span class="is-ca">Combat Adv. ${formatNumber(item.caHits)}</span><span class="is-deflect">Deflected ${formatNumber(item.deflectedHits)}</span></div>`;
  const debuffs = hit.debuffNames?.length ? `<div class="pt-tooltip-debuff"><strong>Team debuff applied</strong><span>${hit.debuffNames.map(esc).join(', ')}</span></div>` : '';
  return `<strong class="pt-tooltip-title">${esc(item.power)}</strong><span class="pt-tooltip-meta">${esc(hit.lane.name)} · ${esc(item.category)} · ${formatTime(item.time)}</span>${details}${flags}${debuffs}`;
}

function categoryTooltipMarkup(category) {
  return `<strong class="pt-tooltip-title">${esc(category.category)}</strong><span class="pt-tooltip-meta">Verified damage in the selected fight</span><div class="pt-tooltip-grid"><span>Total damage</span><b>${formatNumber(category.damage)}</b><span>Share of player damage</span><b>${formatPercent(category.share)}</b><span>Hits</span><b>${formatNumber(category.hits)}</b><span>Powers</span><b>${formatNumber(category.powers)}</b></div>`;
}

function controlsMarkup() {
  return `<div class="pt-toolbar" data-pt-toolbar><div class="pt-legend" aria-label="Hit result legend"><span><i class="is-ca"></i>Combat Adv.</span><span><i class="is-crit"></i>Crit</span><span><i class="is-deflect"></i>Deflected</span><span><i class="is-debuff-apply"></i>Debuff applied</span><span><i class="is-debuff-window"></i>Debuff active</span><span><i class="is-size"></i>Bigger = more damage</span></div><div class="pt-zoom" aria-label="Timeline zoom controls"><button type="button" data-pt-zoom-out aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><output data-pt-zoom-label aria-live="polite">100%</output><button type="button" data-pt-zoom-in aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><button type="button" data-pt-fit aria-label="Fit timeline" title="Fit timeline"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg></button></div></div>`;
}
function updateZoomLabel(panel) {
  const node = panel.querySelector('[data-pt-zoom-label]');
  if (node) node.textContent = `${Math.round(zoom * 100)}%`;
}
function rulerMarkup(duration, width, viewport) {
  const desired = Math.max(6, Math.min(24, Math.ceil(Math.min(width, viewport * 2.5) / 120)));
  return Array.from({ length: desired }, (_, index) => {
    const ratio = desired <= 1 ? 0 : index / (desired - 1);
    return `<span style="left:${ratio * 100}%">${formatTime(duration * ratio)}</span>`;
  }).join('');
}

function ensureLaneSurface(baseCanvas) {
  const scroll = baseCanvas.parentElement;
  if (!scroll) return null;
  let spacer = scroll.querySelector('.pt12-spacer');
  let canvas = scroll.querySelector('canvas.pt12-canvas');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.className = 'pt12-spacer';
    scroll.append(spacer);
  }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'pt12-canvas';
    canvas.dataset.ptLane = baseCanvas.dataset.rotationLane || '';
    canvas.setAttribute('aria-label', baseCanvas.getAttribute('aria-label') || 'Power activation timeline');
    scroll.append(canvas);
  }
  return { scroll, spacer, canvas };
}

function resizeCanvas(canvas, cssWidth, cssHeight) {
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  if (canvas.style.width !== `${cssWidth}px`) canvas.style.width = `${cssWidth}px`;
  if (canvas.style.height !== `${cssHeight}px`) canvas.style.height = `${cssHeight}px`;
  return dpr;
}

function syncScroll(panel, value, source = null) {
  if (syncingScroll) return;
  syncingScroll = true;
  for (const scroll of timelineScrolls(panel)) {
    if (scroll !== source && Math.abs(scroll.scrollLeft - value) > .5) scroll.scrollLeft = value;
  }
  if (source && Math.abs(source.scrollLeft - value) > .5) source.scrollLeft = value;
  syncingScroll = false;
}

function applyDimensions(panel, anchor = null) {
  if (!report) return;
  const previous = Number(panel.dataset.ptWorldWidth) || worldWidth(panel);
  const width = worldWidth(panel);
  const viewport = timelineViewport(panel);
  panel.dataset.ptWorldWidth = String(width);
  const timeline = panel.querySelector('.rotation-timeline');
  if (timeline) {
    timeline.style.width = `${width}px`;
    timeline.innerHTML = `<div class="rotation-ruler">${rulerMarkup(report.duration, width, viewport)}</div>`;
  }
  for (const base of panel.querySelectorAll('canvas[data-rotation-lane]')) {
    const surface = ensureLaneSurface(base);
    if (!surface) continue;
    surface.spacer.style.width = `${width}px`;
    resizeCanvas(surface.canvas, Math.max(1, surface.scroll.clientWidth), LANE_HEIGHT);
  }
  updateZoomLabel(panel);
  if (anchor) {
    const oldPoint = anchor.scrollLeft + anchor.localX;
    const ratio = previous ? oldPoint / previous : 0;
    syncScroll(panel, Math.max(0, ratio * width - anchor.localX));
  }
}

function setZoom(panel, next, anchor = null) {
  zoom = Math.max(MIN_ZOOM, Math.min(maxZoomForReport(), Number(next) || 1));
  applyDimensions(panel, anchor);
  scheduleRepaint();
}
function fitZoom(panel) {
  const duration = Math.max(1, Number(report?.duration) || 1);
  const next = timelineViewport(panel) / (duration * BASE_PX_PER_SECOND);
  setZoom(panel, Math.max(MIN_ZOOM, Math.min(1, next)));
  syncScroll(panel, 0);
}

function drawDebuffWindows(ctx, scrollLeft, viewportWidth, world, height) {
  const duration = Math.max(1, Number(report?.duration) || 1);
  const visibleStart = scrollLeft / world * duration;
  const visibleEnd = (scrollLeft + viewportWidth) / world * duration;
  ctx.save();
  ctx.fillStyle = 'rgba(83,128,76,.20)';
  for (const window of debuffTiming.windows || []) {
    if (window.end < visibleStart) continue;
    if (window.start > visibleEnd) break;
    const left = window.start / duration * world - scrollLeft;
    const right = window.end / duration * world - scrollLeft;
    if (right > 0 && left < viewportWidth) ctx.fillRect(Math.max(0, left), 0, Math.max(1, Math.min(viewportWidth, right) - Math.max(0, left)), height);
  }
  ctx.restore();
}
function drawDebuffGlow(ctx, x, y, size) {
  ctx.save();
  ctx.strokeStyle = '#c96ce7';
  ctx.shadowColor = 'rgba(201,108,231,.8)';
  ctx.shadowBlur = 9;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8, 6);
  ctx.stroke();
  ctx.restore();
}
function markerSize(item, maxDamage) {
  const damage = Math.max(0, Number(item.damage) || Number(item.amount) || 0);
  if (!damage || !maxDamage) return 22;
  return 22 + Math.sqrt(damage / maxDamage) * 10;
}
function drawFallbackMarker(ctx, category, x, y, size, hovered) {
  const color = CATEGORY_COLORS[category] || '#8093a1';
  const label = CATEGORY_LABELS[category] || '?';
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = hovered ? color : 'transparent';
  ctx.shadowBlur = hovered ? 9 : 0;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,.82)';
  ctx.lineWidth = hovered ? 2.1 : 1.2;
  if (category === 'Daily') {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath(); ctx.roundRect(-size * .34, -size * .34, size * .68, size * .68, 3); ctx.fill(); ctx.stroke();
    ctx.rotate(-Math.PI / 4);
  } else if (category === 'At-Will') {
    ctx.beginPath(); ctx.arc(0, 0, size * .39, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.roundRect(-size * .4, -size * .4, size * .8, size * .8, 5); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#071018';
  ctx.font = `800 ${Math.max(8, Math.round(size * .27))}px ui-monospace,monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 0);
  ctx.restore();
}
function drawIndicators(ctx, item, x, y, size) {
  const indicators = [];
  if ((Number(item.caHits) || 0) > 0) indicators.push('#62a9f5');
  if ((Number(item.critHits) || 0) > 0) indicators.push('#f2c94c');
  if ((Number(item.deflectedHits) || 0) > 0) indicators.push('#a9b4bd');
  const spacing = 7;
  const start = x - (indicators.length - 1) * spacing / 2;
  indicators.forEach((color, index) => {
    ctx.fillStyle = color; ctx.strokeStyle = 'rgba(7,16,24,.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(start + index * spacing, y + size * .53, 3.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
}

function drawLane(panel, surface, prepared, hoveredKey = '') {
  const { scroll, canvas } = surface;
  const viewportWidth = Math.max(1, scroll.clientWidth);
  const dpr = resizeCanvas(canvas, viewportWidth, LANE_HEIGHT);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewportWidth, LANE_HEIGHT);
  const world = Number(panel.dataset.ptWorldWidth) || worldWidth(panel);
  const scrollLeft = scroll.scrollLeft;
  const duration = Math.max(1, Number(report?.duration) || 1);
  const pxToTime = duration / world;
  const startTime = Math.max(0, (scrollLeft - OVERSCAN_PX) * pxToTime);
  const endTime = Math.min(duration, (scrollLeft + viewportWidth + OVERSCAN_PX) * pxToTime);
  const categories = selectedCategories(panel);
  const activations = prepared.activations;
  let start = Math.max(0, lowerBound(activations, startTime) - 1);
  const hitboxes = [];

  drawDebuffWindows(ctx, scrollLeft, viewportWidth, world, LANE_HEIGHT);
  ctx.strokeStyle = 'rgba(120,145,162,.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 50.5); ctx.lineTo(viewportWidth, 50.5); ctx.stroke();

  for (let index = start; index < activations.length; index += 1) {
    const item = activations[index];
    const time = Number(item.time) || 0;
    if (time > endTime) break;
    if (time < startTime || !categories.has(item.category)) continue;
    const x = time / duration * world - scrollLeft;
    if (x < -40 || x > viewportWidth + 40) continue;
    const key = `${prepared.lane.ref}:${index}:${time}:${item.power}`;
    const hovered = key === hoveredKey;
    const size = markerSize(item, prepared.maxDamage) + (hovered ? 4 : 0);
    const y = 24;
    if (item.category === 'Encounter') {
      const icon = findEncounterPowerIcon(item.power, prepared.lane.className);
      if (icon && iconSprite) {
        ctx.save();
        ctx.shadowColor = hovered ? 'rgba(79,127,240,.72)' : 'rgba(79,127,240,.25)';
        ctx.shadowBlur = hovered ? 10 : 4;
        ctx.fillStyle = 'rgba(7,16,24,.94)';
        ctx.strokeStyle = hovered ? '#8ca9ff' : '#4f7ff0';
        ctx.lineWidth = hovered ? 2.3 : 1.3;
        ctx.beginPath(); ctx.roundRect(x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4, 5); ctx.fill(); ctx.stroke();
        ctx.drawImage(iconSprite, icon.x, icon.y, icon.width, icon.height, x - size / 2, y - size / 2, size, size);
        ctx.restore();
      } else drawFallbackMarker(ctx, item.category, x, y, size, hovered);
    } else drawFallbackMarker(ctx, item.category, x, y, size, hovered);
    const debuffNames = debuffsNearActivation(prepared.lane, item);
    if (debuffNames.length) drawDebuffGlow(ctx, x, y, size);
    drawIndicators(ctx, item, x, y, size);
    hitboxes.push({ x, y, radius: Math.max(16, size * .62), item, lane: prepared.lane, key, debuffNames });
  }
  laneHitboxes.set(prepared.lane.ref, hitboxes);
}

function nearestHit(canvas, lane, event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let nearest = null;
  let best = Infinity;
  for (const hit of laneHitboxes.get(lane.ref) || []) {
    const dx = x - hit.x;
    const dy = y - hit.y;
    const squared = dx * dx + dy * dy;
    if (squared <= hit.radius * hit.radius && squared < best) { nearest = hit; best = squared; }
  }
  return nearest;
}

function bindCanvas(panel, surface, prepared) {
  const canvas = surface.canvas;
  if (canvas.dataset.ptBound === 'true') return;
  canvas.dataset.ptBound = 'true';
  let hovered = '';
  let pointerFrame = 0;
  let pointerEvent = null;
  const processPointer = () => {
    pointerFrame = 0;
    const event = pointerEvent;
    if (!event || drag) return;
    const hit = nearestHit(canvas, prepared.lane, event);
    const next = hit?.key || '';
    if (next !== hovered) {
      hovered = next;
      drawLane(panel, surface, prepared, hovered);
    }
    if (hit) showTooltip(hit.key, activationTooltip(hit), event.clientX, event.clientY);
    else hideTooltip();
  };
  canvas.addEventListener('pointermove', event => {
    pointerEvent = event;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(processPointer);
  }, { passive:true });
  canvas.addEventListener('pointerleave', () => {
    hovered = '';
    hideTooltip();
    drawLane(panel, surface, prepared, '');
  }, { passive:true });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { pointerId:event.pointerId, startX:event.clientX, startScroll:surface.scroll.scrollLeft, panel, source:surface.scroll, pendingX:event.clientX, frame:0 };
    canvas.setPointerCapture(event.pointerId);
    panel.classList.add('is-panning');
    hideTooltip();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.pendingX = event.clientX;
    if (drag.frame) return;
    drag.frame = requestAnimationFrame(() => {
      if (!drag) return;
      drag.frame = 0;
      syncScroll(panel, drag.startScroll - (drag.pendingX - drag.startX), drag.source);
      scheduleRepaint();
    });
  }, { passive:true });
  const end = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.frame) cancelAnimationFrame(drag.frame);
    drag = null;
    panel.classList.remove('is-panning');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function bindScrollAndWheel(panel) {
  for (const scroll of timelineScrolls(panel)) {
    if (scroll.dataset.pt12ScrollBound === 'true') continue;
    scroll.dataset.pt12ScrollBound = 'true';
    scroll.addEventListener('scroll', () => {
      if (syncingScroll) return;
      const value = scroll.scrollLeft;
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        syncScroll(panel, value, scroll);
        scheduleRepaint();
      });
    }, { passive:true });
    scroll.addEventListener('wheel', event => {
      if (event.shiftKey) {
        event.preventDefault();
        syncScroll(panel, scroll.scrollLeft + event.deltaY + event.deltaX, scroll);
        scheduleRepaint();
        return;
      }
      event.preventDefault();
      const rect = scroll.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom(panel, zoom * factor, { scrollLeft:scroll.scrollLeft, localX });
    }, { passive:false });
  }
}

function paintRotation(panel) {
  if (!report || report.verification?.status !== 'verified' || !panel.isConnected) return;
  panel.dataset.powerTimingV12 = 'true';
  applyDimensions(panel);
  bindScrollAndWheel(panel);
  for (const base of panel.querySelectorAll('canvas[data-rotation-lane]')) {
    const prepared = laneCache.get(base.dataset.rotationLane || '');
    const surface = prepared ? ensureLaneSurface(base) : null;
    if (!prepared || !surface) continue;
    bindCanvas(panel, surface, prepared);
    drawLane(panel, surface, prepared, '');
  }
}
function scheduleRepaint() {
  if (repaintFrame) return;
  repaintFrame = requestAnimationFrame(() => {
    repaintFrame = 0;
    const panel = root?.querySelector('.rotation-panel');
    if (panel) paintRotation(panel);
  });
}

function ensureControls(panel) {
  if (!panel.querySelector('[data-pt-toolbar]')) panel.querySelector('.panel-head')?.insertAdjacentHTML('afterend', controlsMarkup());
  if (panel.dataset.pt12ControlsBound === 'true') return;
  panel.dataset.pt12ControlsBound = 'true';
  panel.querySelector('[data-pt-zoom-out]')?.addEventListener('click', () => setZoom(panel, zoom / 1.25));
  panel.querySelector('[data-pt-zoom-in]')?.addEventListener('click', () => setZoom(panel, zoom * 1.25));
  panel.querySelector('[data-pt-fit]')?.addEventListener('click', () => fitZoom(panel));
}
function enhanceHelp(panel) {
  const help = panel.querySelector('.rotation-help');
  if (help) help.textContent = 'Every verified player power use shares one clock. Drag to pan, wheel to zoom, and Shift + wheel to scroll. Only the visible time window is drawn, so deep zoom stays responsive. Purple glow marks a known team debuff application; green bands come from Effect Intelligence.';
}

async function loadTeamDebuffTiming(scope) {
  const effectReport = await workerRequest('effect-intelligence-report', { scope }, 90000);
  if (!effectReport || effectReport.verification?.status === 'blocked') throw new Error('Verified effect timing is unavailable for this fight.');
  return effectReport.timing || { windows:[], applications:[] };
}

async function enhanceRotation(panel) {
  if (panel.dataset.pt12Enhancing === 'true' || panel.dataset.pt12Ready === 'true') return;
  panel.dataset.pt12Enhancing = 'true';
  const generation = ++reportGeneration;
  try {
    ensureControls(panel);
    enhanceHelp(panel);
    const scope = currentScope();
    const [nextReport, sprite] = await Promise.all([
      workerRequest('rotation-report', { scope }, 45000),
      loadEncounterPowerIconSprite().catch(() => null)
    ]);
    if (generation !== reportGeneration || !panel.isConnected || nextReport?.verification?.status !== 'verified') return;
    report = nextReport;
    iconSprite = sprite;
    prepareLanes(report);
    debuffTiming = { windows:[], applications:[] };
    prepareApplications();
    panel.dataset.pt12Ready = 'true';
    fitZoom(panel);
    paintRotation(panel);

    panelResizeObserver?.disconnect();
    panelResizeObserver = new ResizeObserver(() => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        if (!panel.isConnected) return;
        applyDimensions(panel);
        scheduleRepaint();
      });
    });
    panelResizeObserver.observe(panel);

    const cacheKey = JSON.stringify(scope);
    if (debuffTimingCache.has(cacheKey)) {
      debuffTiming = debuffTimingCache.get(cacheKey);
      prepareApplications();
      scheduleRepaint();
    } else {
      loadTeamDebuffTiming(scope).then(timing => {
        if (generation !== reportGeneration || !panel.isConnected) return;
        timing.windows = [...(timing.windows || [])].sort((a,b) => a.start - b.start || a.end - b.end);
        debuffTimingCache.set(cacheKey, timing);
        if (debuffTimingCache.size > 6) debuffTimingCache.delete(debuffTimingCache.keys().next().value);
        debuffTiming = timing;
        prepareApplications();
        scheduleRepaint();
      }).catch(() => {});
    }
  } finally {
    panel.dataset.pt12Enhancing = 'false';
  }
}

async function enhanceCategoryBars(panel) {
  const key = `${JSON.stringify(currentScope())}|${currentPlayerRef()}`;
  if (!scopeReportCache || scopeReportCache.key !== key) {
    const scoped = await workerRequest('scope-report', { scope:currentScope() }, 45000);
    if (scoped?.verification?.status !== 'verified') return;
    scopeReportCache = { key, report:scoped };
  }
  const player = scopeReportCache.report.players?.find(item => item.ref === currentPlayerRef()) || scopeReportCache.report.players?.[0];
  if (!player) return;
  const byCategory = new Map((player.categories || []).map(category => [category.category, category]));
  for (const row of panel.querySelectorAll('.analysis-bar-row')) {
    if (row.dataset.ptCategoryBound === 'true') continue;
    const category = byCategory.get(row.querySelector('strong')?.textContent?.trim() || '');
    if (!category) continue;
    row.dataset.ptCategoryBound = 'true';
    row.tabIndex = 0;
    row.setAttribute('aria-label', `${category.category}: ${formatNumber(category.damage)} damage, ${formatPercent(category.share)}`);
    let frame = 0;
    let lastEvent = null;
    const show = event => {
      lastEvent = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = row.getBoundingClientRect();
        const x = lastEvent?.clientX || rect.left + rect.width / 2;
        const y = lastEvent?.clientY || rect.top + rect.height / 2;
        showTooltip(`category:${category.category}`, categoryTooltipMarkup(category), x, y);
      });
    };
    row.addEventListener('pointerenter', show, { passive:true });
    row.addEventListener('pointermove', show, { passive:true });
    row.addEventListener('pointerleave', hideTooltip, { passive:true });
    row.addEventListener('focus', show);
    row.addEventListener('blur', hideTooltip);
  }
}

async function scan() {
  addStyleLink();
  const rotationPanel = root?.querySelector('.rotation-panel');
  if (rotationPanel) await enhanceRotation(rotationPanel).catch(() => {});
  const categoryPanel = root?.querySelector('.category-panel');
  if (categoryPanel) enhanceCategoryBars(categoryPanel).catch(() => {});
}

document.addEventListener('strikeglass:view-rendered', () => scan());
document.addEventListener('click', event => {
  if (!event.target.closest('[data-rotation-filter],[data-rotation-all]')) return;
  requestAnimationFrame(scheduleRepaint);
});
window.addEventListener('strikeglass:worker-ready', () => {
  scopeReportCache = null;
  debuffTimingCache.clear();
});

ensureStyle();
scan();
