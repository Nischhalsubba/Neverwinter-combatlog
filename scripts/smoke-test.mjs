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
  'src/features/worker-parse-controller.js',
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

const worker = await readFile('src/workers/parse-worker.js', 'utf8');
for (const required of ['summary-engine.js', "type:'summary'", "type:'done'"]) {
  if (!worker.includes(required)) failures.push(`Missing worker summary pipeline marker: ${required}`);
}

const workerController = await readFile('src/features/worker-parse-controller.js', 'utf8');
for (const required of ['Fast preview ready', 'hydrating full details', 'parseWorker(file,onProgress,onSummary)']) {
  if (!workerController.includes(required)) failures.push(`Missing worker controller UX marker: ${required}`);
}

if (failures.length) {
  console.error('Smoke test failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Smoke test passed. Checked ${referencedFiles.length} referenced files, runtime order, and summary-first worker pipeline.`);
