const nav = document.getElementById('app-nav');
const root = document.getElementById('view-root');
const idle = (callback, timeout = 1200) => {
  if ('requestIdleCallback' in window) return requestIdleCallback(callback, { timeout });
  return setTimeout(callback, Math.min(timeout, 350));
};

const loads = new Map();
const loadOnce = (key, loader) => {
  if (!loads.has(key)) loads.set(key, Promise.resolve().then(loader).catch(error => {
    loads.delete(key);
    if (localStorage.getItem('strikeglass.debugPerf') === '1') console.warn(`[Strikeglass] ${key} failed to load`, error);
    return null;
  }));
  return loads.get(key);
};

function ensureQolStyle() {
  const existing = document.querySelector('link[data-qol-style]');
  if (existing) return existing;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../v8/qol.css', import.meta.url).href;
  link.dataset.qolStyle = 'true';
  document.head.append(link);
  return link;
}

function loadQol() {
  ensureQolStyle();
  return loadOnce('qol', () => import('../v8/index.js'));
}

function loadCopy() {
  return loadOnce('copy', () => import('../v6/copy.js'));
}

function loadPowerTools() {
  ensureQolStyle();
  return loadOnce('power-tools', async () => {
    await Promise.all([
      import('../v3/power-popup/index.js'),
      import('../v9/encounter-power-icons.js')
    ]);
    return true;
  });
}

function loadRotation() {
  window.StrikeglassViewportTimeline = true;
  return loadOnce('rotation', async () => {
    await loadPowerTools();
    return import('./power-timing-viewport.js');
  });
}

function loadDebuffs() {
  return loadOnce('debuffs', () => import('../v7/boss-effects.js'));
}

function loadDashboard() {
  return loadOnce('dashboard', async () => {
    await Promise.all([
      import('../v6/dashboard.js'),
      import('../v6/dashboard-interactions.js'),
      import('../v6/drawer-copy.js')
    ]);
    document.dispatchEvent(new CustomEvent('strikeglass:dashboard-ready'));
    return true;
  });
}

function loadForView(view, { background = false } = {}) {
  const run = () => {
    if (view === 'rotation') return loadRotation();
    if (view === 'powers') return Promise.all([loadPowerTools(), loadQol(), loadOnce('power-interactions', () => import('./power-timing-viewport.js'))]);
    if (view === 'debuffs') return loadDebuffs();
    if (view === 'overview' && localStorage.getItem('strikeglass.dashboard.v1')) return loadDashboard();
    return loadQol();
  };
  if (!background) return run();
  idle(run, 1600);
  return null;
}

const perf = window.StrikeglassPerf = window.StrikeglassPerf || {
  longTasks: [],
  routes: [],
  frameProbes: []
};

function installLongTaskObserver() {
  if (!('PerformanceObserver' in window) || perf.longTaskObserver) return;
  try {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        perf.longTasks.push({ start: Math.round(entry.startTime), duration: Math.round(entry.duration) });
        if (perf.longTasks.length > 80) perf.longTasks.splice(0, perf.longTasks.length - 80);
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
    perf.longTaskObserver = observer;
  } catch {}
}

let routeStart = 0;
let routeName = '';
function beginRoute(view) {
  routeStart = performance.now();
  routeName = view || '';
}
function endRoute(view) {
  if (!routeStart || routeName !== view) return;
  const duration = performance.now() - routeStart;
  perf.routes.push({ view, duration: Math.round(duration * 10) / 10, at: Date.now() });
  if (perf.routes.length > 60) perf.routes.splice(0, perf.routes.length - 60);
  routeStart = 0;
}

perf.probeFrames = function probeFrames(duration = 1200) {
  const started = performance.now();
  const intervals = [];
  let last = started;
  return new Promise(resolve => {
    const tick = now => {
      intervals.push(now - last);
      last = now;
      if (now - started < duration) return requestAnimationFrame(tick);
      const samples = intervals.slice(2).sort((a, b) => a - b);
      const pick = q => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))] || 0;
      const result = {
        samples: samples.length,
        p50: pick(.5),
        p95: pick(.95),
        worst: samples.at(-1) || 0,
        target120Hz: pick(.95) <= 10
      };
      perf.frameProbes.push(result);
      if (perf.frameProbes.length > 20) perf.frameProbes.shift();
      resolve(result);
    };
    requestAnimationFrame(tick);
  });
};

installLongTaskObserver();

nav?.addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button || button.disabled) return;
  const view = button.dataset.view || '';
  beginRoute(view);
  if (view === 'rotation') window.StrikeglassViewportTimeline = true;
  loadForView(view);
}, true);

nav?.addEventListener('pointerover', event => {
  const button = event.target.closest('[data-view]');
  if (!button || button.disabled || button.dataset.perfWarmed === 'true') return;
  button.dataset.perfWarmed = 'true';
  loadForView(button.dataset.view || '', { background: true });
}, { passive: true });

root?.addEventListener('click', event => {
  if (event.target.closest('[data-dashboard-customize]')) loadDashboard();
});

document.addEventListener('strikeglass:analysis-ready', () => {
  idle(() => Promise.all([loadQol(), loadCopy()]), 1800);
  if (localStorage.getItem('strikeglass.dashboard.v1')) loadForView('overview', { background: true });
});

document.addEventListener('strikeglass:view-rendered', event => {
  const view = event.detail?.view || '';
  endRoute(view);
  loadForView(view, { background: view !== 'rotation' && view !== 'debuffs' && view !== 'powers' });
});

document.addEventListener('strikeglass:dashboard-ready', () => {
  document.dispatchEvent(new CustomEvent('strikeglass:copy-refresh'));
});

if (localStorage.getItem('strikeglass.debugPerf') === '1') {
  console.info('[Strikeglass] 120Hz runtime diagnostics enabled. Use StrikeglassPerf.probeFrames().');
}
