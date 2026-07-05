import { readFile, access } from 'node:fs/promises';

const index = await readFile('index.html', 'utf8');
const referencedFiles = Array.from(index.matchAll(/(?:src|href)="([^"]+)"/g))
  .map(match => match[1])
  .filter(path => !path.startsWith('http') && !path.startsWith('#'));

const requiredOrder = [
  'src/core/sg-core.js',
  'src/core/sg-help-primitives.js',
  'src/engine/combat-engine.js',
  'src/engine/summary-engine.js',
  'app.js',
  'class-power-map.js',
  'src/features/category-clarity-layer.js',
  'src/engine/artifact-window-engine.js',
  'src/features/worker-parse-controller.js',
  'src/features/artifact-window-layer.js',
  'src/features/help-controller.js',
  'src/features/upload-flow.js'
];

const failures = [];

for (const file of referencedFiles) {
  try {
    await access(file);
  } catch (_) {
    failures.push(`Missing referenced file: ${file}`);
  }
}

for (let i = 0; i < requiredOrder.length - 1; i++) {
  const current = index.indexOf(requiredOrder[i]);
  const next = index.indexOf(requiredOrder[i + 1]);
  if (current === -1) failures.push(`Missing required runtime file: ${requiredOrder[i]}`);
  if (next === -1) failures.push(`Missing required runtime file: ${requiredOrder[i + 1]}`);
  if (current !== -1 && next !== -1 && current > next) {
    failures.push(`Incorrect load order: ${requiredOrder[i]} must load before ${requiredOrder[i + 1]}`);
  }
}

const core = await readFile('src/core/sg-help-primitives.js', 'utf8');
for (const primitive of ['SG.showTooltip', 'SG.hideTooltip', 'SG.openDrawer']) {
  if (!core.includes(primitive)) failures.push(`Missing help primitive: ${primitive}`);
}

const engine = await readFile('src/engine/combat-engine.js', 'utf8');
for (const exportName of ['window.SGEngine', 'window.NWParser', 'parseFile', 'buildEncounters', 'companionDamage']) {
  if (!engine.includes(exportName)) failures.push(`Missing engine export or capability: ${exportName}`);
}

const summary = await readFile('src/engine/summary-engine.js', 'utf8');
for (const exportName of ['window.SGSummaryEngine', 'buildReport', 'playerMetricSummary', 'enrichPlayer']) {
  if (!summary.includes(exportName)) failures.push(`Missing summary-first capability: ${exportName}`);
}

const artifactEngine = await readFile('src/engine/artifact-window-engine.js', 'utf8');
for (const required of ['window.SGArtifactWindow', 'analyze', 'artifactScore', 'windowSeconds', 'includeCompanions', 'perCallPlayers', 'perCallParticipants', 'byParticipant', 'buildBurstWindows', 'artifactTimers', 'artifactUseCount', 'artifactCatalog', 'avgDamage', 'maxHit', 'crit', 'flank', 'artifactUsed', 'call.time + windowSeconds', 'rowsInWindow(damageByPlayer.get(first.ownerId)']) {
  if (!artifactEngine.includes(required)) failures.push(`Missing artifact engine marker: ${required}`);
}

const worker = await readFile('src/workers/parse-worker.js', 'utf8');
for (const required of ['artifact-window-engine.js', 'report.artiCall', 'summaryOnly', "type:'artifact'", "type:'summary'", "type:'done'"]) {
  if (!worker.includes(required)) failures.push(`Missing worker summary pipeline marker: ${required}`);
}

const workerController = await readFile('src/features/worker-parse-controller.js', 'utf8');
for (const required of ['Fast preview ready', 'raw rows skipped for speed', 'state.artiReport', 'StrikeglassRequestArtiCall', 'summaryOnly']) {
  if (!workerController.includes(required)) failures.push(`Missing worker controller UX marker: ${required}`);
}

const artifactAlias = await readFile('src/features/artifact-window-layer.js', 'utf8');
if (!artifactAlias.includes('arti-call-layer.js')) failures.push('Missing artifact window alias target.');

const artifactLayer = await readFile('src/features/arti-call-layer.js', 'utf8');
for (const required of ['Arti Call', 'reportForCurrentView', 'state.artiReport', 'StrikeglassRequestArtiCall', 'artiWindowSeconds', 'artiIncludeCompanions', 'artiMainTable', 'selectedDetails', 'Artifact windows', 'Player', 'Artifact used', 'Damage / sec', 'Avg damage', 'Crit rate', 'Flank rate', 'Highest hit', 'Each artifact activation starts its own timer', 'Anything before or after is ignored']) {
  if (!artifactLayer.includes(required)) failures.push(`Missing Arti Call marker: ${required}`);
}

if (failures.length) {
  console.error('Smoke test failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Smoke test passed. Checked one-row-per-artifact Arti Call table, per-player timers, worker pipeline, and runtime order.`);
