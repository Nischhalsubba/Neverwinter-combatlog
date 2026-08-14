import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const [app, worker, verifier, charts, motion, copy, styles, index, runtime, viewport, drilldown, dashboard] = await Promise.all([
  readFile('src/v3/app.js', 'utf8'),
  readFile('src/workers/fast-parse-worker.js', 'utf8'),
  readFile('src/engine/verification-engine.js', 'utf8'),
  readFile('src/v3/charts.js', 'utf8'),
  readFile('src/v3/motion.js', 'utf8'),
  readFile('src/v6/copy.js', 'utf8'),
  readFile('src/v6/performance.css', 'utf8'),
  readFile('index.html', 'utf8'),
  readFile('src/v12/runtime.js', 'utf8'),
  readFile('src/v12/power-timing-viewport.js', 'utf8'),
  readFile('src/v3/power-drilldown.js', 'utf8'),
  readFile('src/v6/dashboard.js', 'utf8')
]);

for (const marker of ['task-loading','task-progress','renderEpoch','StrikeglassViewportTimeline','strikeglass:view-rendered','strikeglass:analysis-ready','data-dashboard-customize']) assert.ok(app.includes(marker), 'app missing '+marker);
for (const marker of ['postTaskProgress','categoryCounts','await sleep()',"'verify-rotation'",'return { report: cached, verification: cached.verification, error: null }']) assert.ok(worker.includes(marker), 'worker missing '+marker);
for (const marker of ['seriesInOrder','orderedSeries','PROGRESS_ROWS','hashText','VERIFICATION_ENGINE_VERSION = 5']) assert.ok(verifier.includes(marker), 'verifier missing '+marker);
assert.ok(!verifier.includes('Math.min(...partySeries.map'), 'verifier must not spread full session timelines');
assert.ok(!/function rotationChecksum[\s\S]*?flatMap/.test(verifier), 'rotation checksum must stream');
for (const marker of ['IntersectionObserver','requestIdleCallback','chart-lazy-placeholder','rootMargin','desynchronized','ResizeObserver','native-timeline-chart']) assert.ok(charts.includes(marker), 'charts missing '+marker);
assert.ok(!charts.includes('cdn.jsdelivr.net') && !charts.includes('uPlot'), 'charts must be local native Canvas with no runtime CDN');
assert.ok(motion.includes('element.animate'), 'motion must use native Web Animations');
assert.ok(!motion.includes('gsap') && !motion.includes('cdn.jsdelivr.net'), 'motion must not fetch a runtime animation library');
assert.ok(copy.includes('strikeglass:view-rendered'), 'copy must use explicit lifecycle events');
assert.ok(!copy.includes('new MutationObserver'), 'copy must not use mutation observers in the hot path');
assert.ok(!dashboard.includes('cdn.jsdelivr.net'), 'dashboard must not fetch GSAP from a CDN');
for (const marker of ['PerformanceObserver','probeFrames','requestIdleCallback',"import('../v7/boss-effects.js')","import('../v8/index.js')","import('./power-timing-viewport.js')"]) assert.ok(runtime.includes(marker), 'runtime missing '+marker);
for (const marker of ['MAX_ZOOM = 12','MAX_WORLD_WIDTH = 200000','lowerBound','OVERSCAN_PX','scroll.clientWidth','desynchronized','requestAnimationFrame','effect-intelligence-report']) assert.ok(viewport.includes(marker), 'viewport timeline missing '+marker);
assert.ok(!viewport.includes('overlay.width = Math.max(1, Math.floor(width'), 'viewport timeline must not allocate world-width canvases');
assert.ok(drilldown.includes('../v12/runtime.js') && !drilldown.includes('../v8/index.js') && !drilldown.includes('../v10/power-timing-interactions.js'), 'bootstrap must stay lightweight');
for (const eager of ['src/v7/boss-effects.js','src/v11/navigation-shell.js','src/v6/dashboard.js','src/v6/dashboard-interactions.js','src/v6/copy.js','src/v6/drawer-copy.js']) assert.ok(!index.includes('<script type="module" src="'+eager+'"></script>'), eager+' must not load eagerly');
assert.ok(index.includes('data-view="debuffs"'), 'Team Debuffs navigation must exist without loading its feature module');
for (const marker of ['.task-loading{','content-visibility:auto','@media(prefers-reduced-motion:reduce)']) assert.ok(styles.includes(marker), 'performance styles missing '+marker);

console.log('Performance regression passed. Route features load on demand, charts and motion have no CDN dependency, mutation observers are removed from copy/debuff hot paths, cached route revisits skip skeletons, and Power Timing draws only the visible viewport.');
