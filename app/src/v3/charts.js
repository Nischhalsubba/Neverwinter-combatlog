const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const chartByNode = new WeakMap();
const pendingByNode = new WeakMap();
let uPlotPromise = null;
let cssReady = false;

const MAX_POINTS = 1800;
const SERIES_VARS = ['--cyan', '--amber', '--green', '--red', '--blue'];
const AXIS_FONT = '12px Inter, ui-sans-serif, system-ui, sans-serif';

function ensureCss() {
  if (cssReady) return;
  cssReady = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/uplot@1.6.32/dist/uPlot.min.css';
  link.dataset.strikeglassUplot = '1';
  document.head.appendChild(link);
}

async function loadUPlot() {
  if (!uPlotPromise) {
    ensureCss();
    uPlotPromise = import('https://cdn.jsdelivr.net/npm/uplot@1.6.32/+esm').then(module => module.default || module.uPlot || module).catch(() => null);
  }
  return uPlotPromise;
}

export function warmCharts() {
  const idle = window.requestIdleCallback || (callback => setTimeout(callback, 500));
  idle(() => { loadUPlot(); });
}

function cssColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#65e4ff'; }
function compact(value) {
  const n = Number(value) || 0, a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(n).toLocaleString();
}
function timeLabel(seconds) {
  const s = Math.max(0, Number(seconds) || 0), minutes = Math.floor(s / 60), rest = Math.floor(s % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function bucketTimeline(points, maxPoints = MAX_POINTS) {
  if (!Array.isArray(points) || !points.length) return [];
  if (points.length <= maxPoints) return points.map(point => ({ second: Number(point.second) || 0, damage: Number(point.damage) || 0 }));
  const last = Math.max(1, Number(points.at(-1)?.second) || 1);
  const width = Math.max(1, Math.ceil(last / maxPoints));
  const buckets = new Map();
  for (const point of points) {
    const second = Number(point.second) || 0, bucket = Math.floor(second / width) * width;
    buckets.set(bucket, (buckets.get(bucket) || 0) + (Number(point.damage) || 0));
  }
  return Array.from(buckets.entries()).map(([second, damage]) => ({ second, damage })).sort((a, b) => a.second - b.second);
}

function alignSeries(series) {
  const reduced = series.map(item => ({ ...item, points: bucketTimeline(item.points) }));
  const xs = Array.from(new Set(reduced.flatMap(item => item.points.map(point => point.second)))).sort((a, b) => a - b);
  const data = [xs];
  for (const item of reduced) {
    const values = new Map(item.points.map(point => [point.second, point.damage]));
    data.push(xs.map(second => values.get(second) ?? null));
  }
  return { data, reduced };
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
  if (previous) { previous.resizeObserver?.disconnect(); previous.chart?.destroy(); chartByNode.delete(node); }
  node.replaceChildren();
}

function fallback(node, text) {
  clearChart(node);
  const message = document.createElement('div');
  message.className = 'chart-fallback';
  message.textContent = text;
  node.appendChild(message);
}

function chartPlaceholder(node) {
  const placeholder = document.createElement('div');
  placeholder.className = 'chart-lazy-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
  node.appendChild(placeholder);
}

function whenNearViewport(node, callback) {
  let started = false;
  const run = () => {
    if (started || !node.isConnected) return;
    started = true;
    cancelPending(node);
    const launch = () => { if (node.isConnected) callback(); };
    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(launch, { timeout: 350 });
      pendingByNode.set(node, { idleId });
    } else {
      const timeoutId = setTimeout(launch, 0);
      pendingByNode.set(node, { timeoutId });
    }
  };
  if (!('IntersectionObserver' in window)) { run(); return; }
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) run(); }, { rootMargin: '280px 0px' });
  observer.observe(node);
  pendingByNode.set(node, { observer });
}

export function renderTimelineChart(node, series, { ariaLabel = 'Damage over time' } = {}) {
  if (!node) return;
  clearChart(node);
  const normalized = (series || []).filter(item => item?.points?.length);
  if (!normalized.length) { fallback(node, 'No timeline data in this scope.'); return; }
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', ariaLabel);
  chartPlaceholder(node);

  whenNearViewport(node, async () => {
    const UPlot = await loadUPlot();
    if (!UPlot || !node.isConnected) { fallback(node, 'Chart library unavailable. Exact values remain available in the tables.'); return; }
    const { data, reduced } = alignSeries(normalized);
    if (!node.isConnected) return;
    node.replaceChildren();
    const width = Math.max(320, Math.floor(node.getBoundingClientRect().width));
    const height = Math.max(220, Math.min(360, Math.floor(width * .3)));
    const options = {
      width, height, padding: [12, 10, 6, 6], cursor: { drag: { x: true, y: false, setScale: true } }, legend: { show: true }, scales: { x: { time: false }, y: { auto: true } },
      axes: [
        { stroke: cssColor('--muted'), font: AXIS_FONT, grid: { stroke: cssColor('--grid') }, values: (_u, values) => values.map(timeLabel), size: 42 },
        { stroke: cssColor('--muted'), font: AXIS_FONT, grid: { stroke: cssColor('--grid') }, values: (_u, values) => values.map(compact), size: 66 }
      ],
      series: [{}, ...reduced.map((item, index) => ({ label: item.label, stroke: cssColor(SERIES_VARS[index % SERIES_VARS.length]), width: index === 0 ? 2.2 : 1.8, dash: index === 1 ? [8, 4] : index === 2 ? [3, 4] : undefined, points: { show: false }, value: (_u, value) => value == null ? '-' : compact(value) }))]
    };
    const chart = new UPlot(options, data, node);
    const resizeObserver = new ResizeObserver(entries => {
      const nextWidth = Math.floor(entries[0]?.contentRect?.width || 0);
      if (nextWidth > 0) chart.setSize({ width: nextWidth, height: Math.max(220, Math.min(360, Math.floor(nextWidth * .3))) });
    });
    resizeObserver.observe(node);
    chartByNode.set(node, { chart, resizeObserver });
    pendingByNode.delete(node);
    if (reduceMotion.matches) node.classList.add('chart-reduced-motion');
  });
}

export function destroyChart(node) { if (node) clearChart(node); }
