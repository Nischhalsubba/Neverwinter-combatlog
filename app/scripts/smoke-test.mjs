import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'src/v3/styles.css',
  'src/v3/readability.css',
  'src/v3/analysis-features.css',
  'src/v3/power-drilldown.css',
  'src/v3/app.js',
  'src/v3/power-drilldown.js',
  'src/v3/power-popup/index.js',
  'src/v3/power-popup/view.js',
  'src/v3/power-popup/worker.js',
  'src/v3/charts.js',
  'src/v3/motion.js',
  'src/v3/ambient.js',
  'src/v6/v6.css',
  'src/v6/components.css',
  'src/v6/stability.css',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js',
  'src/v6/copy.js',
  'src/v6/drawer-copy.js',
  'src/v8/index.js',
  'src/v8/core.js',
  'src/v8/navigation.js',
  'src/v8/qol.css',
  'src/engine/fast-parser-core.js',
  'src/engine/scoped-combat-clock.js',
  'src/engine/power-taxonomy.js',
  'src/engine/verification-engine.js',
  'src/engine/combat-effects.js',
  'src/workers/fast-parse-worker.js'
];
const failures = [];
for (const path of required) {
  try { await access(path); }
  catch { failures.push(`Missing required Strikeglass file: ${path}`); }
}

const index = await readFile('index.html', 'utf8');
for (const marker of [
  'src/v3/styles.css',
  'src/v3/readability.css',
  'src/v3/analysis-features.css',
  'src/v3/power-drilldown.css',
  'src/v6/v6.css',
  'src/v6/components.css',
  'src/v6/stability.css',
  'type="module" src="src/v3/app.js"',
  'type="module" src="src/v3/power-drilldown.js"',
  'type="module" src="src/v6/dashboard.js"',
  'type="module" src="src/v6/dashboard-interactions.js"',
  'type="module" src="src/v6/copy.js"',
  'type="module" src="src/v6/drawer-copy.js"',
  'content="#f6f8fb"',
  'content="light"',
  'Double checked',
  '<span>Summary</span>',
  '<span>Power Timing</span>',
  '<span>Compare Players</span>',
  '<span>Log Health</span>',
  'data-view="rotation"',
  'data-view="comparison"',
  'data-view="boss"',
  'data-view="powers"',
  'id="encounter-select"',
  'id="boss-target-only"'
]) if (!index.includes(marker)) failures.push(`index missing ${marker}`);
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

const dashboard = await readFile('src/v6/dashboard.js', 'utf8');
for (const marker of [
  "STORAGE_KEY = 'strikeglass.dashboard.v1'",
  'Customize layout',
  'Add widget',
  'DEFAULT_LAYOUT',
  'data-v6-drawer-id',
  'data-v6-size',
  'data-v6-toggle',
  'data-v6-move',
  'localStorage.setItem',
  "gsap@3.15.0",
  'prefers-reduced-motion',
  'MutationObserver',
  'aria-modal',
  'Reset layout'
]) if (!dashboard.includes(marker)) failures.push(`V6 dashboard missing ${marker}`);

const interactions = await readFile('src/v6/dashboard-interactions.js', 'utf8');
for (const marker of [
  "event.target.closest?.('[data-v6-drag]')",
  "document.addEventListener('pointerdown'",
  'widget.draggable = true',
  'widget.draggable = false'
]) if (!interactions.includes(marker)) failures.push(`V6 dashboard interaction guard missing ${marker}`);

const copy = await readFile('src/v6/copy.js', 'utf8');
for (const marker of [
  "['Session overview', 'Session summary']",
  "['Combat DPS', 'Active DPS']",
  "['Reject reasons', 'Rows we could not read']",
  'What do these numbers mean?',
  'Damage per second from the first counted hit to the last counted hit.'
]) if (!copy.includes(marker)) failures.push(`V6 plain-language copy missing ${marker}`);

const drawerCopy = await readFile('src/v6/drawer-copy.js', 'utf8');
for (const marker of [
  "['Widgets', 'Choose what to show']",
  "['Top Damage Powers', 'Top damaging powers']",
  'observe(document.body, { childList: true, subtree: true })'
]) if (!drawerCopy.includes(marker)) failures.push(`V6 drawer copy missing ${marker}`);

const powerDrilldown = await readFile('src/v3/power-drilldown.js', 'utf8');
for (const marker of [
  'ensureQolStyle',
  "new URL('../v8/qol.css', import.meta.url)",
  'await ensureQolStyle()',
  "await import('./power-popup/index.js')",
  "await import('../v8/index.js')"
]) if (!powerDrilldown.includes(marker)) failures.push(`power drilldown loader missing ${marker}`);
if (powerDrilldown.indexOf('await ensureQolStyle()') > powerDrilldown.indexOf("await import('../v8/index.js')")) failures.push('QoL controls can run before their stylesheet is ready.');
if (/powersNav\.click|returnToOrigin|originView/.test(powerDrilldown)) failures.push('power drilldown loader reintroduced route-changing drilldown state.');

const powerPopup = await readFile('src/v3/power-popup/index.js', 'utf8');
for (const marker of [
  'data-power-popup-trigger',
  'powerPopupPlayer',
  'currentScope()',
  "kind: 'damage'",
  'validDamageOnly: true',
  'aria-haspopup',
  'MutationObserver',
  'focusTrap',
  'closePopup'
]) if (!powerPopup.includes(marker)) failures.push(`in-place power popup missing ${marker}`);

const powerPopupView = await readFile('src/v3/power-popup/view.js', 'utf8');
for (const marker of [
  'aria-modal',
  'Power details',
  'Verified hits from the current player and fight.',
  'Average hit',
  'Flank / CA',
  'power-popup-backdrop',
  'Load 250 more'
]) if (!powerPopupView.includes(marker)) failures.push(`power popup view missing ${marker}`);

const powerPopupWorker = await readFile('src/v3/power-popup/worker.js', 'utf8');
for (const marker of ['StrikeglassWorkerBridge?.mainWorker', 'workerRequest', 'currentPlayerRef', 'currentScope']) {
  if (!powerPopupWorker.includes(marker)) failures.push(`power popup worker missing ${marker}`);
}

const qolIndex = await readFile('src/v8/index.js', 'utf8');
for (const marker of ['./navigation.js','./insights.js','./player-actions.js','./attempts.js','./events.js','./tables.js','./command.js']) {
  if (!qolIndex.includes(marker)) failures.push(`QoL entrypoint missing ${marker}`);
}

const qolStyles = await readFile('src/v8/qol.css', 'utf8');
for (const marker of ['.qol-breadcrumbs', '.qol-fight-nav{display:flex;grid-column:1/-1;align-items:center', 'appearance:none', 'max-height:44px']) {
  if (!qolStyles.includes(marker)) failures.push(`QoL styles missing ${marker}`);
}

const combatEffects = await readFile('src/engine/combat-effects.js', 'utf8');
for (const marker of ['Armor Break', 'Dulled Senses', 'Vulnerability', 'Weapon Break', 'Slowed Reactions', 'analyzeCombatEffects', 'immuneEffects']) {
  if (!combatEffects.includes(marker)) failures.push(`combat effect discovery missing ${marker}`);
}

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

const v6Styles = await readFile('src/v6/v6.css', 'utf8');
for (const marker of [
  '--sg-page:#f6f8fb',
  '--sg-text:#0f172a',
  '--sg-primary:#2563eb',
  '--motion-standard:220ms',
  '.v6-dashboard-grid',
  '.v6-widget-drawer',
  '.v6-widget-toggle',
  '.v6-drawer-scrim',
  '.power-drilldown-backdrop',
  'body{font-size:16px}',
  '@media(prefers-reduced-motion:reduce)'
]) if (!v6Styles.includes(marker)) failures.push(`V6 styles missing ${marker}`);
if (/backdrop-filter\s*:\s*blur\(/i.test(v6Styles.match(/\.v6-drawer-scrim[\s\S]*?\}/)?.[0] || '')) failures.push('V6 widget drawer must not blur its scrim.');

const stability = await readFile('src/v6/stability.css', 'utf8');
for (const marker of ['.v6-drawer-scrim{', 'opacity:1', '.v6-widget-drawer{', 'transform:translateX(0)', '.v6-data-guide']) {
  if (!stability.includes(marker)) failures.push(`V6 drawer stability missing ${marker}`);
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
for (const marker of ['three@0.185.1', 'renderer.dispose()', 'deviceMemory', '33', 'const count = 64', 'color: 0x60a5fa']) {
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
console.log('Smoke test passed. V6 light design tokens, persistent widget controls, plain-language analytics, dual-engine verification, scoped combat clocks, player comparison, live rotation counts, in-place raw-hit drilldowns, styled QoL navigation, full fight effect discovery, uPlot charts, Three.js idle budget, and GSAP motion contracts are present.');
