const root = document.getElementById('view-root');
const nav = document.getElementById('app-nav');
const scopeSelect = document.getElementById('encounter-select');
const playerSelect = document.getElementById('player-select');

const enhancers = new Map();
const pendingReasons = new Set();
let pendingDetail = null;
let frame = 0;

function activeView() {
  return nav?.querySelector('[data-view].is-active')?.dataset.view || '';
}

function flush() {
  frame = 0;
  if (!pendingReasons.size) return;
  const reasons = [...pendingReasons];
  pendingReasons.clear();
  const detail = pendingDetail;
  pendingDetail = null;
  const context = Object.freeze({
    view: activeView(),
    reasons: Object.freeze(reasons),
    reason: reasons.at(-1) || 'refresh',
    detail
  });
  for (const [name, enhancer] of enhancers) {
    try {
      enhancer(context);
    } catch (error) {
      if (localStorage.getItem('strikeglass.debugPerf') === '1') {
        console.warn(`[Strikeglass] lifecycle enhancer ${name} failed`, error);
      }
    }
  }
}

export function requestRouteRefresh(reason = 'manual', detail = null) {
  pendingReasons.add(String(reason || 'manual'));
  if (detail != null) pendingDetail = detail;
  if (!frame) frame = requestAnimationFrame(flush);
}

export function registerRouteEnhancer(name, enhancer, { runNow = true } = {}) {
  if (!name || typeof enhancer !== 'function') throw new TypeError('Route enhancer registration requires a name and function.');
  enhancers.set(String(name), enhancer);
  if (runNow) requestRouteRefresh(`register:${name}`);
  return () => enhancers.delete(String(name));
}

function lifecycleEvent(reason) {
  return event => requestRouteRefresh(reason, event?.detail || null);
}

document.addEventListener('strikeglass:view-rendered', lifecycleEvent('view-rendered'));
document.addEventListener('strikeglass:analysis-ready', lifecycleEvent('analysis-ready'));
document.addEventListener('strikeglass:dashboard-ready', lifecycleEvent('dashboard-ready'));
document.addEventListener('strikeglass:settings-changed', lifecycleEvent('settings-changed'));
window.addEventListener('strikeglass:worker-ready', lifecycleEvent('worker-ready'));
scopeSelect?.addEventListener('change', lifecycleEvent('scope-change'));
playerSelect?.addEventListener('change', lifecycleEvent('player-change'));

if (root) {
  new MutationObserver(() => requestRouteRefresh('root-children-changed'))
    .observe(root, { childList: true, subtree: false });
}

export const routeLifecycle = Object.freeze({
  register: registerRouteEnhancer,
  refresh: requestRouteRefresh,
  activeView
});
