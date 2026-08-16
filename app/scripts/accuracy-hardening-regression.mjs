import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [accuracy, accuracyCss, scenes, events, docs, referenceDocs] = await Promise.all([
  read('../src/v22/accuracy-ui.js'),
  read('../src/v22/accuracy-ui.css'),
  read('../src/v17/scene-visuals.js'),
  read('../src/v8/events.js'),
  read('../docs/ACCURACY_CONTRACT.md'),
  read('../docs/REFERENCE_PARITY.md')
]);

for (const state of ['Exact', 'Derived', 'Inferred', 'Partial', 'Unknown']) assert.match(accuracy + docs, new RegExp(state));
assert.match(accuracy, /Why this number\?/);
assert.match(accuracy, /Power taxonomy coverage/);
assert.match(accuracy, /Compare a trusted parser result/);
assert.match(accuracy, /Top-hit annotations checked across/);
assert.match(accuracy, /x - previous\[0\] > 5/);
assert.match(accuracy, /Timing verification confirms reconstructed effect windows/);
assert.match(accuracy, /Boss detection: high confidence/);
assert.match(accuracyCss, /--sg-player-color/);

assert.doesNotMatch(scenes, /slice\(0,\s*40\)/, 'encounter sparklines must not silently stop after 40 fights');
assert.match(scenes, /IntersectionObserver/, 'encounter sparklines should load lazily instead of using a content cap');
assert.match(scenes, /dataset\.completeness/, 'event density must expose completeness state');
assert.match(scenes, /Partial · first/, 'partial event density must be visible to players');
assert.match(scenes, /stableColor\(row\.ref\)/, 'party distribution color must be tied to player identity');

assert.match(events, /Continue search/);
assert.match(events, /result-limit/);
assert.match(events, /candidate-limit/);
assert.match(events, /matches per page/);
assert.doesNotMatch(events, /scan limit reached; narrow the filters for later rows/, 'result limit must not be mislabeled as a scan limit');

assert.match(docs, /browser engine.*canonical production engine/is);
assert.match(docs, /Silent row caps are not allowed/i);
assert.match(referenceDocs, /NW-Hub/);
assert.match(referenceDocs, /metric definition/i);

console.log('Accuracy hardening regression passed.');
