import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'src/v3/styles.css',
  'src/v3/readability.css',
  'src/v3/analysis-features.css',
  'src/v3/power-drilldown.css',
  'src/v3/app.js',
  'src/v3/power-drilldown.js',
  'src/v3/charts.js',
  'src/v3/motion.js',
  'src/v3/ambient.js',
  'src/engine/fast-parser-core.js',
  'src/engine/scoped-combat-clock.js',
  'src/engine/power-taxonomy.js',
  'src/engine/verification-engine.js',
  'src/workers/fast-parse-worker.js'
];
const failures = [];
for (const path of required) {
  try { await access(path); }
  catch { failures.push(`Missing required V5 file: ${path}`); }
}

const index = await readFile('index.html', 'utf8');
for (const marker of ['src/v3/styles.css', 'src/v3/readability.css', 'src/v3/analysis-features.css', 'src/v3/power-drilldown.css', 'type="module" src="src/v3/app.js"', 'type="module" src="src/v3/power-drilldown.js"', 'data-view="rotation"', 'data-view="comparison"', 'data-view="boss"', 'data-view="powers"', 'id="encounter-select"', 'id="boss-target-only"']) {
  if (!index.includes(marker)) failures.push(`index missing ${marker}`);
}
if (index.includes('compact.css')) failures.push('Obsolete compact.css is still loaded.');
if (index.toLowerCase().includes('apexcharts')) failures.push('Legacy ApexCharts runtime is still loaded.');

const app = await readFile('src/v3/app.js', 'utf8');
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
  'Damage out',
  'Debuff% = (Damage / Base',
  'renderTimelineChart',
  'bossTargetOnly',
  'compactHtml',
  'Select 2–5 players',
  'Verified active combat time',
  'data-rotation-all',
  'visible /',
  '1e9', '1e6', '1e3'
]) if (!app.includes(marker)) failures.push(`app missing ${marker}`);

const powerDrilldown = await readFile('src/v3/power-drilldown.js', 'utf8');
for (const marker of [
  'POWER_BAR_SELECTOR',
  'Open raw hit details',
  'Total damage',
  'Average hit',
  'Flank / CA',
  'power-drilldown-backdrop',
  'aria-modal',
  "[data-view=\"powers\"]",
  'raw-hits-panel',
  'MutationObserver'
]) if (!powerDrilldown.includes(marker)) failures.push(`power drilldown missing ${marker}`);

const charts = await readFile('src/v3/charts.js', 'utf8');
for (const marker of ['uplot@1.6.32', 'MAX_POINTS = 1800', 'AXIS_FONT', 'ResizeObserver', 'destroyChart', 'bucketTimeline']) {
  if (!charts.includes(marker)) failures.push(`charts missing ${marker}`);
}

const worker = await readFile('src/workers/fast-parse-worker.js', 'utf8');
for (const marker of ['class CompactRowStore', 'Float64Array', 'buildEncounterIndex', 'lowerBound(', "message.type === 'scope-report'", "message.type === 'rotation-report'", 'verifyReport', 'verifyRotationReport', 'validDamageOnly', 'SCOPE_CACHE_LIMIT', 'targetOnly', 'partyCombatDps', 'combatDuration', 'summarizeScopedCombat']) {
  if (!worker.includes(marker)) failures.push(`worker missing ${marker}`);
}

const core = await readFile('src/engine/fast-parser-core.js', 'utf8');
for (const marker of ['CANONICAL_DAMAGE_TYPES', "new Set(['physical'])", 'KNOWN_DAMAGE_TYPES', 'recoverLegacyPayload', 'invalid_field_count', 'class CombatAccumulator', 'mergedPlayerEncounters', 'combatDuration', 'DATE_EPOCH_CACHE', 'nonCanonicalDamageTypes']) {
  if (!core.includes(marker)) failures.push(`parser missing ${marker}`);
}

const scopedClock = await readFile('src/engine/scoped-combat-clock.js', 'utf8');
for (const marker of ['summarizeScopedCombat', 'DEFAULT_GAP_SECONDS = 5', 'DEFAULT_BOSS_MERGE_GAP_SECONDS = 15', 'mergeBossPhases']) {
  if (!scopedClock.includes(marker)) failures.push(`scoped clock missing ${marker}`);
}

const verifier = await readFile('src/engine/verification-engine.js', 'utf8');
for (const marker of ['buildShadowReport', 'verifyReport', 'buildShadowRotation', 'verifyRotationReport', "VERIFY_DAMAGE_TYPE = 'physical'", "engine: 'shadow-verifier-v1'"]) {
  if (!verifier.includes(marker)) failures.push(`verifier missing ${marker}`);
}

const taxonomy = await readFile('src/engine/power-taxonomy.js', 'utf8');
for (const marker of ['classifyPowerCategory', 'summarizeCategories', 'inferPlayerClass', 'activationDedupeSeconds', "'Pet / Companion'", "'Item / Enchant'"]) {
  if (!taxonomy.includes(marker)) failures.push(`taxonomy missing ${marker}`);
}

const styles = await readFile('src/v3/styles.css', 'utf8');
for (const marker of ['--cyan:#65e4ff', '--sidebar:232px', '.analysis-toolbar', '.comparison-cards', '.boss-grid', '.chart-host', 'min-height:44px', '@media(prefers-reduced-motion:reduce)']) {
  if (!styles.includes(marker)) failures.push(`styles missing ${marker}`);
}

const readability = await readFile('src/v3/readability.css', 'utf8');
for (const marker of ['--muted:#b7c7d1', '--muted-2:#9fb4c1', 'body{font-size:14px', 'table{font-size:13px', '.eyebrow{font-size:11px', '.chart-host .u-legend{font-size:12px']) {
  if (!readability.includes(marker)) failures.push(`readability styles missing ${marker}`);
}

const features = await readFile('src/v3/analysis-features.css', 'utf8');
for (const marker of ['.verification-strip', '.reference-metrics', '.analysis-bars', '.raw-hits-panel', '.rotation-shell', '.class-badge', '.analysis-toolbar .field:has(#player-select)']) {
  if (!features.includes(marker)) failures.push(`analysis styles missing ${marker}`);
}

const powerDrilldownStyles = await readFile('src/v3/power-drilldown.css', 'utf8');
for (const marker of [
  '.power-drilldown-trigger',
  '.power-drilldown-backdrop',
  'body.power-drilldown-open .workspace{z-index:auto}',
  'body.power-drilldown-open .view-root',
  'backdrop-filter:none',
  'body.power-drilldown-open .raw-hits-panel',
  'background:#09141d',
  '.power-hit-summary',
  'min-width:44px',
  '@media(prefers-reduced-motion:reduce)'
]) if (!powerDrilldownStyles.includes(marker)) failures.push(`power drilldown styles missing ${marker}`);
if (/backdrop-filter\s*:\s*blur\(/i.test(powerDrilldownStyles)) failures.push('Power drilldown must not blur its modal backdrop.');

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
console.log('Smoke test passed. Dual-engine verification, scoped combat clocks, interactive comparison controls, live rotation counts, crisp clickable power raw-hit drilldowns, raw-hit traceability, category analysis, readable contrast, scoped reports, uPlot charts, Three.js budget, and GSAP motion contracts are present.');
