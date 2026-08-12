import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'src/v3/styles.css',
  'src/v3/app.js',
  'src/v3/motion.js',
  'src/v3/ambient.js',
  'src/engine/fast-parser-core.js',
  'src/workers/fast-parse-worker.js'
];

const failures = [];
for (const path of required) {
  try { await access(path); }
  catch { failures.push(`Missing required V3 file: ${path}`); }
}

const index = await readFile('index.html', 'utf8');
for (const marker of ['src/v3/styles.css', 'type="module" src="src/v3/app.js"', 'id="parse-state"', 'id="workspace"', 'id="drop-zone"']) {
  if (!index.includes(marker)) failures.push(`index.html missing marker: ${marker}`);
}
if (index.includes('apexcharts')) failures.push('Legacy ApexCharts runtime is still loaded by index.html.');

const app = await readFile('src/v3/app.js', 'utf8');
for (const marker of ["new Worker(new URL('../workers/fast-parse-worker.js'", "type: 'module'", "requestWorker('player-report'", "requestWorker('raw-page'", 'drawTimeline', 'estimatedStoreBytes']) {
  if (!app.includes(marker)) failures.push(`V3 app missing marker: ${marker}`);
}

const worker = await readFile('src/workers/fast-parse-worker.js', 'utf8');
for (const marker of ["import { CombatAccumulator, parseLine }", 'class CompactRowStore', 'Float64Array', "type: 'partial-summary'", "message.type === 'raw-page'", 'FALLBACK_SLICE_BYTES']) {
  if (!worker.includes(marker)) failures.push(`Worker missing marker: ${marker}`);
}

const core = await readFile('src/engine/fast-parser-core.js', 'utf8');
for (const marker of ["'arcane'", "'physical'", "'lightning'", 'recoverLegacyPayload', 'invalid_field_count', 'class CombatAccumulator', 'activeCombatTime']) {
  if (!core.includes(marker)) failures.push(`Parser core missing marker: ${marker}`);
}

const styles = await readFile('src/v3/styles.css', 'utf8');
for (const marker of ['prefers-reduced-motion', 'min-height: 44px', '--duration-micro', '@media (max-width: 760px)']) {
  if (!styles.includes(marker)) failures.push(`V3 styles missing marker: ${marker}`);
}

const ambient = await readFile('src/v3/ambient.js', 'utf8');
for (const marker of ['three@0.185.1', 'renderer.dispose()', 'deviceMemory', '33']) {
  if (!ambient.includes(marker)) failures.push(`Ambient layer missing performance marker: ${marker}`);
}

const motion = await readFile('src/v3/motion.js', 'utf8');
for (const marker of ['gsap@3.15.0', 'prefers-reduced-motion', 'duration: 0.28', "ease: 'power2.out'"]) {
  if (!motion.includes(marker)) failures.push(`Motion layer missing marker: ${marker}`);
}

if (failures.length) {
  console.error('Smoke test failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Smoke test passed. V3 worker architecture, parser diagnostics, responsive UI, Three.js budget, and GSAP motion contracts are present.');
