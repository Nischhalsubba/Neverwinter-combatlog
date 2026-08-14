import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'src/v3/app.js',
  'src/v3/charts.js',
  'src/v3/motion.js',
  'src/v3/ambient.js',
  'src/v3/power-drilldown.js',
  'src/v3/power-popup/index.js',
  'src/v3/power-popup/view.js',
  'src/v3/power-popup/worker.js',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js',
  'src/v6/copy.js',
  'src/v6/drawer-copy.js',
  'src/v7/boss-effects.js',
  'src/v8/index.js',
  'src/v8/qol.css',
  'src/v12/runtime.js',
  'src/v12/power-timing-viewport.js',
  'src/v12/power-timing-viewport.css',
  'src/engine/fast-parser-core.js',
  'src/engine/scoped-combat-clock.js',
  'src/engine/power-taxonomy.js',
  'src/engine/verification-engine.js',
  'src/engine/combat-effects.js',
  'src/engine/effect-intelligence-engine.js',
  'src/workers/fast-parse-worker.js'
];

const failures = [];
for (const path of required) {
  try { await access(path); }
  catch { failures.push(`Missing required Strikeglass file: ${path}`); }
}

const files = Object.fromEntries(await Promise.all(required.filter(path => path.endsWith('.js') || path.endsWith('.html')).map(async path => [path, await readFile(path, 'utf8')])));
const index = files['index.html'];
const app = files['src/v3/app.js'];
const charts = files['src/v3/charts.js'];
const motion = files['src/v3/motion.js'];
const ambient = files['src/v3/ambient.js'];
const drilldown = files['src/v3/power-drilldown.js'];
const runtime = files['src/v12/runtime.js'];
const viewport = files['src/v12/power-timing-viewport.js'];
const dashboard = files['src/v6/dashboard.js'];
const copy = files['src/v6/copy.js'];
const bossEffects = files['src/v7/boss-effects.js'];
const worker = files['src/workers/fast-parse-worker.js'];
const core = files['src/engine/fast-parser-core.js'];
const verifier = files['src/engine/verification-engine.js'];
const effectEngine = files['src/engine/effect-intelligence-engine.js'];

for (const marker of [
  'src/v3/styles.css',
  'src/v6/performance.css',
  'type="module" src="src/v3/app.js"',
  'type="module" src="src/v3/power-drilldown.js"',
  'data-view="overview"',
  'data-view="rotation"',
  'data-view="boss"',
  'data-view="debuffs"',
  'data-view="players"',
  'data-view="powers"',
  'data-view="comparison"',
  'data-view="events"',
  'data-view="diagnostics"',
  '<strong>Overview</strong>',
  '<strong>Fight Timeline</strong>',
  '<strong>Team Debuffs</strong>',
  '<strong>Damage &amp; Powers</strong>',
  '<strong>Analysis Checks</strong>',
  'id="encounter-select"',
  'id="boss-target-only"'
]) if (!index.includes(marker)) failures.push(`index missing ${marker}`);

for (const eager of [
  'src/v7/boss-effects.js',
  'src/v11/navigation-shell.js',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js',
  'src/v6/copy.js',
  'src/v6/drawer-copy.js'
]) if (index.includes(`type="module" src="${eager}"`)) failures.push(`heavy feature still eager-loaded: ${eager}`);
if (index.includes('compact.css')) failures.push('Obsolete compact.css is still loaded.');
if (index.toLowerCase().includes('apexcharts')) failures.push('Legacy ApexCharts runtime is still loaded.');

for (const marker of [
  "request('scope-report'",
  "request('rotation-report'",
  "request('raw-page'",
  'requireVerified',
  'verificationBadge',
  'renderRotation',
  'renderComparisonView',
  'renderBoss',
  'rawHitsHtml',
  'renderTimelineChart',
  'StrikeglassViewportTimeline',
  'strikeglass:view-rendered',
  'strikeglass:analysis-ready',
  'data-dashboard-customize'
]) if (!app.includes(marker)) failures.push(`app missing ${marker}`);

for (const marker of [
  'IntersectionObserver',
  'requestIdleCallback',
  'ResizeObserver',
  'desynchronized',
  'bucketTimeline',
  'MAX_POINTS = 1200',
  'native-timeline-chart',
  'destroyChart'
]) if (!charts.includes(marker)) failures.push(`native charts missing ${marker}`);
if (/cdn\.jsdelivr\.net|uplot/i.test(charts)) failures.push('Charts still depend on a runtime CDN/uPlot.');

for (const marker of ['element.animate', 'prefers-reduced-motion', 'translate3d']) {
  if (!motion.includes(marker)) failures.push(`native motion missing ${marker}`);
}
if (/cdn\.jsdelivr\.net|gsap/i.test(motion)) failures.push('Motion still depends on GSAP/CDN runtime.');

if (/cdn\.jsdelivr\.net|three@|WebGLRenderer|requestAnimationFrame\(frame\)/i.test(ambient)) failures.push('Decorative ambient runtime still consumes network/GPU animation resources.');

if (!drilldown.includes("../v12/runtime.js")) failures.push('Power drilldown must bootstrap the route-aware runtime.');
for (const forbidden of ["../v8/index.js", "../v10/power-timing-interactions.js", "./power-popup/index.js"]) {
  if (drilldown.includes(forbidden)) failures.push(`Power drilldown eagerly loads ${forbidden}`);
}

for (const marker of [
  'requestIdleCallback',
  'PerformanceObserver',
  'probeFrames',
  "import('../v7/boss-effects.js')",
  "import('../v8/index.js')",
  "import('./power-timing-viewport.js')",
  "import('../v6/dashboard.js')"
]) if (!runtime.includes(marker)) failures.push(`route runtime missing ${marker}`);

for (const marker of [
  'MAX_ZOOM = 12',
  'MAX_WORLD_WIDTH = 200000',
  'OVERSCAN_PX',
  'lowerBound',
  'scroll.clientWidth',
  'desynchronized',
  'requestAnimationFrame',
  'effect-intelligence-report',
  'loadEncounterPowerIconSprite'
]) if (!viewport.includes(marker)) failures.push(`viewport timeline missing ${marker}`);
if (viewport.includes('MAX_TIMELINE_WIDTH = 30000')) failures.push('Viewport timeline reintroduced fixed 30k canvas allocation.');

for (const marker of [
  "STORAGE_KEY = 'strikeglass.dashboard.v1'",
  'Customize layout',
  'DEFAULT_LAYOUT',
  'data-v6-drawer-id',
  'aria-modal',
  'Reset layout',
  'prefers-reduced-motion'
]) if (!dashboard.includes(marker)) failures.push(`Dashboard feature missing ${marker}`);
if (/cdn\.jsdelivr\.net|gsap@/i.test(dashboard)) failures.push('Dashboard still loads GSAP from a CDN.');

for (const marker of [
  "['Session overview', 'Session summary']",
  "['Combat DPS', 'Active DPS']",
  'What do these numbers mean?',
  'strikeglass:view-rendered'
]) if (!copy.includes(marker)) failures.push(`Plain-language copy layer missing ${marker}`);
if (copy.includes('new MutationObserver')) failures.push('Copy layer still observes DOM mutations in the render hot path.');

if (bossEffects.includes('new MutationObserver')) failures.push('Team Debuffs route still uses a DOM MutationObserver instead of explicit view lifecycle events.');
if (!bossEffects.includes('strikeglass:view-rendered')) failures.push('Team Debuffs route missing explicit view lifecycle integration.');

for (const marker of [
  'class CompactRowStore',
  'Float64Array',
  "message.type === 'scope-report'",
  "message.type === 'rotation-report'",
  "message.type === 'effect-intelligence-report'",
  'verifyReport',
  'verifyRotationReport',
  'SCOPE_CACHE_LIMIT'
]) if (!worker.includes(marker)) failures.push(`Worker missing ${marker}`);

for (const marker of [
  'CANONICAL_DAMAGE_TYPES',
  "new Set(['physical'])",
  'class CombatAccumulator',
  'mergedPlayerEncounters',
  'combatDuration',
  'DATE_EPOCH_CACHE'
]) if (!core.includes(marker)) failures.push(`Parser missing ${marker}`);

for (const marker of ['buildShadowReport', 'verifyReport', 'buildShadowRotation', 'verifyRotationReport', "engine: 'shadow-verifier-v1'"]) {
  if (!verifier.includes(marker)) failures.push(`Verifier missing ${marker}`);
}
for (const marker of ['analyzeEffectIntelligence', 'baseline', 'interval', 'verification']) {
  if (!effectEngine.toLowerCase().includes(marker.toLowerCase())) failures.push(`Effect Intelligence missing ${marker}`);
}

const powerPopup = files['src/v3/power-popup/index.js'];
for (const marker of ['data-power-popup-trigger', 'aria-haspopup', 'focusTrap', 'closePopup']) {
  if (!powerPopup.includes(marker)) failures.push(`In-place power popup missing ${marker}`);
}
const powerPopupView = files['src/v3/power-popup/view.js'];
for (const marker of ['aria-modal', 'Power details', 'Average hit', 'Flank / CA', 'Load 250 more']) {
  if (!powerPopupView.includes(marker)) failures.push(`Power popup view missing ${marker}`);
}

if (failures.length) {
  console.error('Smoke test failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Smoke test passed. Core combat verification, Effect Intelligence, plain-language routes, route-lazy features, viewport Power Timing, native Canvas charts, native motion, and in-place power details are present without runtime chart/motion/WebGL CDN dependencies.');
