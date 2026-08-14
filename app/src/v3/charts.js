const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const chartByNode = new WeakMap();
const pendingByNode = new WeakMap();
const MAX_POINTS = 1200;
const SERIES_VARS = ['--cyan', '--amber', '--green', '--red', '--blue'];
const AXIS_FONT = '11px ui-sans-serif,system-ui,sans-serif';

function compact(value) {
  const n = Number(value) || 0;
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(n).toLocaleString();
}
function timeLabel(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(s / 60);
  return `${minutes}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function bucketTimeline(points, maxPoints = MAX_POINTS) {
  if (!Array.isArray(points) || !points.length) return [];
  if (points.length <= maxPoints) return points.map(point => ({ second:Number(point.second) || 0, damage:Number(point.damage) || 0 }));
  const last = Math.max(1, Number(points.at(-1)?.second) || 1);
  const width = Math.max(1, Math.ceil(last / maxPoints));
  const buckets = new Map();
  for (const point of points) {
    const second = Number(point.second) || 0;
    const bucket = Math.floor(second / width) * width;
    buckets.set(bucket, (buckets.get(bucket) || 0) + (Number(point.damage) || 0));
  }
  return Array.from(buckets, ([second, damage]) => ({ second, damage })).sort((a, b) => a.second - b.second);
}

function cancelPending(node) {
  const pending = pendingByNode.get(node);
  if (!pending) return;
  pending.observer?.disconnect();
  if (pending.idleId != null && window.cancelIdleCallback) window.cancelIdleCallback(pending.idleId);
  if (pending.timeoutId != null) clearTimeout(pending.timeoutId);
  pendingByNode.delete(node);
}

function clearChart(node) {
  cancelPending(node);
  const previous = chartByNode.get(node);
  if (previous) {
    previous.resizeObserver?.disconnect();
    if (previous.frame) cancelAnimationFrame(previous.frame);
    chartByNode.delete(node);
  }
  node.replaceChildren();
}

function fallback(node, text) {
  clearChart(node);
  const message = document.createElement('div');
  message.className = 'chart-fallback';
  message.textContent = text;
  node.append(message);
}

function chartPlaceholder(node) {
  const placeholder = document.createElement('div');
  placeholder.className = 'chart-lazy-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
  node.append(placeholder);
}

function whenNearViewport(node, callback) {
  let started = false;
  const run = () => {
    if (started || !node.isConnected) return;
    started = true;
    cancelPending(node);
    const launch = () => { if (node.isConnected) callback(); };
    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(launch, { timeout: 250 });
      pendingByNode.set(node, { idleId });
    } else {
      const timeoutId = setTimeout(launch, 0);
      pendingByNode.set(node, { timeoutId });
    }
  };
  if (!('IntersectionObserver' in window)) { run(); return; }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) run();
  }, { rootMargin:'240px 0px' });
  observer.observe(node);
  pendingByNode.set(node, { observer });
}

function makeRenderer(node, normalized) {
  const canvas = document.createElement('canvas');
  canvas.className = 'native-timeline-chart';
  canvas.setAttribute('aria-hidden', 'true');
  node.replaceChildren(canvas);

  const series = normalized.map((item, index) => ({
    label:item.label,
    points:bucketTimeline(item.points),
    color:cssColor(SERIES_VARS[index % SERIES_VARS.length], ['#65e4ff','#ffbf69','#63f5b0','#ff6f78','#4fa3ff'][index % 5])
  }));
  let maxX = 1;
  let maxY = 1;
  for (const item of series) for (const point of item.points) {
    maxX = Math.max(maxX, point.second);
    maxY = Math.max(maxY, point.damage);
  }
  const state = { width:0, height:0, frame:0, resizeObserver:null };

  const draw = () => {
    state.frame = 0;
    if (!canvas.isConnected) return;
    const width = Math.max(320, Math.floor(node.clientWidth || 320));
    const height = Math.max(220, Math.min(340, Math.floor(width * .28)));
    if (width === state.width && height === state.height && canvas.dataset.drawn === 'true') return;
    state.width = width;
    state.height = height;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d', { alpha:false, desynchronized:true });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const background = cssColor('--panel', '#0f1720');
    const grid = cssColor('--grid', 'rgba(120,145,162,.18)');
    const muted = cssColor('--muted', '#8494a3');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const left = 64;
    const right = 12;
    const top = 16;
    const bottom = 32;
    const plotWidth = Math.max(1, width - left - right);
    const plotHeight = Math.max(1, height - top - bottom);
    ctx.font = AXIS_FONT;
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i += 1) {
      const ratio = i / 4;
      const y = top + plotHeight * ratio;
      ctx.strokeStyle = grid;
      ctx.beginPath(); ctx.moveTo(left, y + .5); ctx.lineTo(width - right, y + .5); ctx.stroke();
      ctx.fillStyle = muted;
      ctx.textAlign = 'right';
      ctx.fillText(compact(maxY * (1 - ratio)), left - 8, y);
    }
    for (let i = 0; i <= 6; i += 1) {
      const ratio = i / 6;
      const x = left + plotWidth * ratio;
      ctx.fillStyle = muted;
      ctx.textAlign = i === 0 ? 'left' : i === 6 ? 'right' : 'center';
      ctx.fillText(timeLabel(maxX * ratio), x, height - 13);
    }

    for (const item of series) {
      if (!item.points.length) continue;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      let started = false;
      for (const point of item.points) {
        const x = left + (point.second / maxX) * plotWidth;
        const y = top + (1 - point.damage / maxY) * plotHeight;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    canvas.dataset.drawn = 'true';
  };

  const schedule = () => {
    if (state.frame) return;
    state.frame = requestAnimationFrame(draw);
  };
  state.resizeObserver = new ResizeObserver(entries => {
    const width = Math.floor(entries[0]?.contentRect?.width || 0);
    if (width > 0 && Math.abs(width - state.width) > 1) schedule();
  });
  state.resizeObserver.observe(node);
  chartByNode.set(node, state);
  schedule();
}

export function warmCharts() {
  // The native Canvas renderer has no library or network dependency to warm.
}

export function renderTimelineChart(node, series, { ariaLabel = 'Damage over time' } = {}) {
  if (!node) return;
  clearChart(node);
  const normalized = (series || []).filter(item => item?.points?.length);
  if (!normalized.length) { fallback(node, 'No timeline data in this scope.'); return; }
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', ariaLabel);
  chartPlaceholder(node);
  whenNearViewport(node, () => {
    if (!node.isConnected) return;
    makeRenderer(node, normalized);
    pendingByNode.delete(node);
    if (reduceMotion.matches) node.classList.add('chart-reduced-motion');
  });
}

export function destroyChart(node) { if (node) clearChart(node); }
