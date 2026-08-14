import { currentPlayerRef, currentScope, workerRequest } from '../v3/power-popup/worker.js';
import { analyzeBossEffects } from '../engine/boss-effects.js';

export { currentPlayerRef, currentScope, workerRequest };

export const root = document.getElementById('view-root');
export const workspace = document.getElementById('workspace');
export const nav = document.getElementById('app-nav');
export const scopeSelect = document.getElementById('encounter-select');
export const playerSelect = document.getElementById('player-select');
export const bossOnly = document.getElementById('boss-target-only');
export const toastRegion = document.getElementById('toast-region');
export const STORAGE_KEY = 'strikeglass.qol.v1';
export const EVENT_PAGE_SIZE = 500;

const ICONS = Object.freeze({
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  copy: '<path d="M9 9h10v10H9zM5 5h10v4M5 5v10h4"/>',
  compare: '<path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3"/>',
  columns: '<path d="M4 5h16v14H4zM10 5v14M15 5v14"/>',
  export: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  more: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>'
});

export function ensureQolStyles() {
  if (document.querySelector('link[data-qol-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./qol.css', import.meta.url).href;
  link.dataset.qolStyle = 'true';
  document.head.append(link);
}

export function ensureSkipLink() {
  if (document.querySelector('.skip-link')) return;
  const link = document.createElement('a');
  link.className = 'skip-link';
  link.href = '#main-stage';
  link.textContent = 'Skip to analysis';
  document.body.prepend(link);
}

export function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

export function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function integer(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(number(value));
}

export function decimal(value, digits = 1) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(number(value));
}

export function pct(value) {
  return `${decimal(value, 1)}%`;
}

export function compact(value) {
  const n = number(value);
  const a = Math.abs(n);
  if (a >= 1e9) return `${decimal(n / 1e9, 1)}B`;
  if (a >= 1e6) return `${decimal(n / 1e6, 1)}M`;
  if (a >= 1e3) return `${decimal(n / 1e3, 1)}K`;
  return integer(n);
}

export function duration(value) {
  const n = Math.max(0, number(value));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${decimal(n, 1)}s`;
}

export function timeLabel(value) {
  const seconds = Math.max(0, number(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function loadPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return {
      bossesOnly: Boolean(parsed?.bossesOnly),
      hideTiny: Boolean(parsed?.hideTiny),
      columns: parsed?.columns && typeof parsed.columns === 'object' ? parsed.columns : {}
    };
  } catch {
    return { bossesOnly: false, hideTiny: false, columns: {} };
  }
}

export const prefs = loadPrefs();

export function savePrefs() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* Preferences are optional. */ }
}

export function activeView() {
  return nav?.querySelector('[data-view].is-active')?.dataset.view || 'overview';
}

export function activeViewLabel() {
  return nav?.querySelector('[data-view].is-active span')?.textContent?.trim() || 'Summary';
}

export function scopeFromValue(value, targetOnly = false) {
  if (!value || value === 'session') return { type: 'session' };
  const [type, idText] = String(value).split(':');
  const id = Number(idText);
  if (!Number.isFinite(id)) return { type: 'session' };
  return { type: type === 'boss' ? 'boss' : 'encounter', id, targetOnly: type === 'boss' && Boolean(targetOnly) };
}

export function scopeKey(scope = currentScope()) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${scope.id}:${scope.targetOnly ? 'target' : 'window'}`;
}

export function optionScope(option) {
  return scopeFromValue(option?.value || 'session', false);
}

export function selectedScopeLabel() {
  return scopeSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Full session';
}

export function bossName(option) {
  if (!option || !String(option.value).startsWith('boss:')) return '';
  return String(option.textContent || '').replace(/^Boss\s+\d+\s*[^A-Za-z0-9]*\s*/i, '').trim();
}

export function bossAttempts(option = scopeSelect?.selectedOptions?.[0]) {
  const name = bossName(option);
  if (!name || !scopeSelect) return [];
  return Array.from(scopeSelect.options).filter(item => item.value.startsWith('boss:') && bossName(item) === name);
}

export function qolToast(text, tone = 'info') {
  if (!toastRegion) return;
  toastRegion.innerHTML = `<div class="toast ${esc(tone)}">${esc(text)}</div>`;
  clearTimeout(qolToast.timer);
  qolToast.timer = setTimeout(() => { toastRegion.innerHTML = ''; }, 4200);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    qolToast('Copied to clipboard.', 'good');
    return true;
  } catch {
    qolToast('Could not copy. Your browser blocked clipboard access.', 'bad');
    return false;
  }
}

export function downloadText(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function waitFor(selector, timeoutMs = 5000) {
  return new Promise(resolve => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (!found) return;
      observer.disconnect();
      resolve(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(document.querySelector(selector)); }, timeoutMs);
  });
}

export function navigate(view) {
  const button = nav?.querySelector(`[data-view="${CSS.escape(view)}"]`);
  if (button && !button.disabled) button.click();
}

export function setPlayer(ref, { render = true } = {}) {
  if (!playerSelect || !ref) return false;
  const option = Array.from(playerSelect.options).find(item => item.value === ref);
  if (!option) return false;
  playerSelect.value = ref;
  if (render) playerSelect.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function setScopeValue(value) {
  if (!scopeSelect) return false;
  const option = Array.from(scopeSelect.options).find(item => item.value === value);
  if (!option) return false;
  scopeSelect.value = value;
  scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

const reportCache = new Map();
const bossEffectCache = new Map();

export async function verifiedReport(scope = currentScope()) {
  const key = scopeKey(scope);
  if (reportCache.has(key)) return reportCache.get(key);
  const promise = workerRequest('scope-report', { scope }).then(report => {
    if (report?.verification?.status !== 'verified') throw new Error('This view is waiting for the second accuracy check.');
    return report;
  }).catch(error => {
    reportCache.delete(key);
    throw error;
  });
  reportCache.set(key, promise);
  return promise;
}

export async function verifiedBossEffects(id) {
  const key = Number(id);
  if (bossEffectCache.has(key)) return bossEffectCache.get(key);
  const promise = (async () => {
    const rows = [];
    let cursor = null;
    do {
      const page = await workerRequest('raw-page', { options: {
        cursor,
        limit: EVENT_PAGE_SIZE,
        scope: { type: 'boss', id: key, targetOnly: true }
      }}, 45000);
      if (page?.verification?.status !== 'verified') throw new Error('Boss effects are waiting for the second accuracy check.');
      rows.push(...(page.rows || []));
      cursor = page.nextCursor;
    } while (cursor != null);
    const result = analyzeBossEffects(rows);
    if (!result.verification?.ok) throw new Error('Boss effects did not pass their independent second check.');
    return result;
  })().catch(error => {
    bossEffectCache.delete(key);
    throw error;
  });
  bossEffectCache.set(key, promise);
  return promise;
}

export function clearCaches() {
  reportCache.clear();
  bossEffectCache.clear();
}
