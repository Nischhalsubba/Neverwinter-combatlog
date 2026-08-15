import {
  EVENT_PAGE_SIZE,
  compact,
  copyText,
  currentPlayerRef,
  currentScope,
  downloadText,
  esc,
  pct,
  root,
  verifiedReport,
  workerRequest
} from '../v8/core.js';
import { destroyChart, renderTimelineChart } from '../v3/charts.js';

export {
  EVENT_PAGE_SIZE,
  compact,
  copyText,
  currentPlayerRef,
  currentScope,
  downloadText,
  esc,
  pct,
  root,
  verifiedReport,
  workerRequest,
  renderTimelineChart,
  destroyChart
};

export const PREF_KEY = 'strikeglass.visual-analysis.v1';
export const RANGE_EVENT = 'strikeglass:visual-range';
export const MAX_RAW_SCAN = 50000;
export const GRAPH_POLL_LIMIT = 50;

const rawCache = new Map();
const effectCache = new Map();

export function ensureStyle() {
  if (document.querySelector('link[data-analysis-visuals-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./analysis-visuals.css', import.meta.url).href;
  link.dataset.analysisVisualsStyle = 'true';
  document.head.append(link);
}

function readPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return {
      preset: parsed.preset || 'standard',
      mode: ['damage', 'dps', 'cumulative'].includes(parsed.mode) ? parsed.mode : 'damage',
      smoothing: [1, 3, 5, 10, 30].includes(Number(parsed.smoothing)) ? Number(parsed.smoothing) : 5,
      xScale: parsed.xScale === 'percent' ? 'percent' : 'time',
      order: ['damage', 'dps', 'alphabetical', 'party'].includes(parsed.order) ? parsed.order : 'damage',
      lineScale: [1, 1.25, 1.5].includes(Number(parsed.lineScale)) ? Number(parsed.lineScale) : 1,
      legend: parsed.legend === 'bottom' ? 'bottom' : 'top',
      motion: ['system', 'on', 'off'].includes(parsed.motion) ? parsed.motion : 'system',
      annotations: {
        bigHits: parsed.annotations?.bigHits !== false,
        kills: parsed.annotations?.kills !== false,
        support: parsed.annotations?.support !== false,
        debuffs: parsed.annotations?.debuffs !== false,
        boundaries: parsed.annotations?.boundaries !== false
      },
      sharedRanges: parsed.sharedRanges && typeof parsed.sharedRanges === 'object' ? parsed.sharedRanges : {}
    };
  } catch {
    return {
      preset: 'standard', mode: 'damage', smoothing: 5, xScale: 'time', order: 'damage',
      lineScale: 1, legend: 'top', motion: 'system',
      annotations: { bigHits: true, kills: true, support: true, debuffs: true, boundaries: true },
      sharedRanges: {}
    };
  }
}

export const prefs = readPrefs();

export function savePrefs() {
  try {
    prefs.sharedRanges = Object.fromEntries(Object.entries(prefs.sharedRanges || {}).slice(-24));
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // Visualization preferences are optional.
  }
}

export function scopeKey(scope = currentScope()) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${Number(scope.id)}:${scope.targetOnly ? 'target' : 'window'}`;
}

export function activeView() {
  return document.querySelector('#app-nav [data-view].is-active')?.dataset.view || '';
}

export function formatTime(value) {
  const n = Math.max(0, Number(value) || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function number(value, digits = 1) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Number(value) || 0);
}

export function setSharedRange(key, start, end) {
  prefs.sharedRanges[key] = { start: Math.max(0, Number(start) || 0), end: Math.max(0, Number(end) || 0) };
  savePrefs();
}

export function publishRange({ key = scopeKey(), start, end, origin = 'chart', source = '' }) {
  setSharedRange(key, start, end);
  window.dispatchEvent(new CustomEvent(RANGE_EVENT, { detail: { scopeKey: key, start, end, origin, source } }));
}

export function intervalOverlap(start, end, a, b) {
  return Math.max(0, Math.min(end, b) - Math.max(start, a));
}

export function mergeIntervals(intervals) {
  const ordered = (intervals || []).filter(item => item.end > item.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const item of ordered) {
    const previous = out.at(-1);
    if (!previous || item.start > previous.end) out.push({ ...item });
    else previous.end = Math.max(previous.end, item.end);
  }
  return out;
}

export async function rawRowsForRange(scope, start, end, { playerRef = '', kind = '', validDamageOnly = false, cap = MAX_RAW_SCAN } = {}) {
  const key = `${scopeKey(scope)}|${playerRef}|${kind}|${validDamageOnly ? 1 : 0}|${Math.floor(start * 10)}|${Math.ceil(end * 10)}|${cap}`;
  if (rawCache.has(key)) return rawCache.get(key);
  const promise = (async () => {
    const rows = [];
    let cursor = null;
    do {
      const page = await workerRequest('raw-page', { options: { cursor, limit: EVENT_PAGE_SIZE, scope, start, end, playerRef, kind, validDamageOnly } }, 45000);
      if (page?.verification?.status !== 'verified') throw new Error('Events are waiting for the second accuracy check.');
      rows.push(...(page.rows || []));
      cursor = page.nextCursor;
      if (rows.length >= cap) break;
      await new Promise(resolve => setTimeout(resolve, 0));
    } while (cursor != null);
    return { rows: rows.slice(0, cap), complete: cursor == null };
  })().catch(error => { rawCache.delete(key); throw error; });
  rawCache.set(key, promise);
  if (rawCache.size > 12) rawCache.delete(rawCache.keys().next().value);
  return promise;
}

export async function fullScopedRows(scope) {
  return rawRowsForRange(scope, 0, Number.MAX_SAFE_INTEGER, { cap: MAX_RAW_SCAN });
}

export async function fullScopedDamageRows(scope, playerRef = '') {
  return rawRowsForRange(scope, 0, Number.MAX_SAFE_INTEGER, { playerRef, kind: 'damage', validDamageOnly: true, cap: MAX_RAW_SCAN });
}

export async function effectReport(scope = currentScope()) {
  const key = scopeKey(scope);
  if (effectCache.has(key)) return effectCache.get(key);
  const promise = workerRequest('effect-intelligence-report', { scope }, 90000).then(report => {
    if (!report || report.verification?.status === 'blocked') throw new Error('Verified effect timing is unavailable.');
    return report;
  }).catch(error => { effectCache.delete(key); throw error; });
  effectCache.set(key, promise);
  if (effectCache.size > 8) effectCache.delete(effectCache.keys().next().value);
  return promise;
}

export function clearVisualCaches() {
  rawCache.clear();
  effectCache.clear();
}
