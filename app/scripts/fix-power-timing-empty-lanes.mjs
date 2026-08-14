import fs from 'node:fs';

function patch(file, before, after, label) {
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

patch('app/src/workers/fast-parse-worker.js',
`  for (const lane of lanes.values()) {
    lane.rows.sort((a, b) => a.time - b.time || a.lineNo - b.lineNo);`,
`  for (const lane of lanes.values()) {
    if (!lane.rows.length) continue;
    lane.rows.sort((a, b) => a.time - b.time || a.lineNo - b.lineNo);`,
'worker empty lane');

patch('app/src/engine/verification-engine.js',
`  for (const lane of rotationCandidates(rows, context, onProgress).values()) {
    const ordered = orderedSeries(lane.rows);`,
`  for (const lane of rotationCandidates(rows, context, onProgress).values()) {
    if (!lane.rows.length) continue;
    const ordered = orderedSeries(lane.rows);`,
'verifier empty lane');

if (fs.existsSync('app/scripts/fix-power-timing-empty-lanes.mjs')) fs.rmSync('app/scripts/fix-power-timing-empty-lanes.mjs');
console.log('Empty generated Encounter lanes removed.');
