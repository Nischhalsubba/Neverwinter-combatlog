import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'src/v3/styles.css',
  'src/v3/app.js',
  'src/v3/charts.js',
  'src/v3/motion.js',
  'src/v3/ambient.js',
  'src/engine/fast-parser-core.js',
  'src/workers/fast-parse-worker.js'
];
const failures = [];
for (const path of required) {
  try { await access(path); }
  catch { failures.push(`Missing required V4 file: ${path}`); }
}

const index = await readFile('index.html', 'utf8');
for (const marker of ['src/v3/styles.css', 'type="module" src="src/v3/app.js"', 'data-view="comparison"', 'data-view="boss"', 'id="encounter-select"', 'id="boss-target-only"']) {
  if (!index.includes(marker)) failures.push(`index missing ${marker}`);
}
if (index.includes('compact.css')) failures.push('Obsolete compact.css is still loaded.');
if (index.toLowerCase().includes('apexcharts')) failures.push('Legacy ApexCharts runtime is still loaded.');

const app = await readFile('src/v3/app.js', 'utf8');
for (const marker of [
  "request('scope-report'",
  "request('raw-page'",
  'renderComparisonView',
  'renderBoss',
  'renderTimelineChart',
  'bossTargetOnly',
  'compactHtml',
  '1e9', '1e6', '1e3'
]) if (!app.includes(marker)) failures.push(`app missing ${marker}`);

const charts = await readFile('src/v3/charts.js', 'utf8');
for (const marker of ['uplot@1.6.32', 'MAX_POINTS = 1800', 'ResizeObserver', 'destroyChart', 'bucketTimeline']) {
  if (!charts.includes(marker)) failures.push(`charts missing ${marker}`);
}

const worker = await readFile('src/workers/fast-parse-worker.js', 'utf8');
for (const marker of ['class CompactRowStore', 'Float64Array', 'buildEncounterIndex', 'lowerBound(', "message.type === 'scope-report'", 'SCOPE_CACHE_LIMIT', 'targetOnly']) {
  if (!worker.includes(marker)) failures.push(`worker missing ${marker}`);
}

const core = await readFile('src/engine/fast-parser-core.js', 'utf8');
for (const marker of ["'arcane'", "'physical'", "'lightning'", 'recoverLegacyPayload', 'invalid_field_count', 'class CombatAccumulator', 'activeCombatTime']) {
  if (!core.includes(marker)) failures.push(`parser missing ${marker}`);
}

const styles = await readFile('src/v3/styles.css', 'utf8');
for (const marker of ['--cyan:#65e4ff', '--sidebar:232px', '.analysis-toolbar', '.comparison-cards', '.boss-grid', '.chart-host', 'min-height:44px', '@media(prefers-reduced-motion:reduce)']) {
  if (!styles.includes(marker)) failures.push(`styles missing ${marker}`);
}

const ambient = await readFile('src/v3/ambient.js', 'utf8');
for (const marker of ['three@0.185.1', 'renderer.dispose()', 'deviceMemory', '33']) {
  if (!ambient.includes(marker)) failures.push(`ambient missing ${marker}`);
}
const motion = await readFile('src/v3/motion.js', 'utf8');
for (const marker of ['gsap@3.15.0', 'prefers-reduced-motion', 'duration: 0.28', "ease: 'power2.out'"]) {
  if (!motion.includes(marker)) failures.push(`motion missing ${marker}`);
}

if (failures.length) {
  console.error('Smoke test failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Smoke test passed. Scoped worker reports, boss/player comparison, uPlot charts, dense responsive UI, Three.js budget, and GSAP motion contracts are present.');
