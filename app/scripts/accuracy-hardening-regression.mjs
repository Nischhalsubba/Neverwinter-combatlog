import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { activationRule, isExplicitEncounterMarker } from '../src/engine/power-activation-registry.js';
import { verifyDirectRotationMarkers } from '../src/engine/rotation-direct-verifier.js';
import { auditSupportEffectProvenance, supportEffectProvenance } from '../src/engine/support-effect-provenance.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [accuracy, accuracyCss, scenes, events, docs, referenceDocs, finalization, verifier] = await Promise.all([
  read('../src/v22/accuracy-ui.js'),
  read('../src/v22/accuracy-ui.css'),
  read('../src/v17/scene-visuals.js'),
  read('../src/v8/events.js'),
  read('../docs/ACCURACY_CONTRACT.md'),
  read('../docs/REFERENCE_PARITY.md'),
  read('../src/v26/accuracy-finalization.js'),
  read('../src/engine/verification-engine.js')
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

assert.match(finalization, /Excluded event audit/);
assert.match(finalization, /Novel positive event pattern/);
assert.match(finalization, /Unclassified power report/);
assert.match(finalization, /Mechanic provenance/);
assert.match(finalization, /page\.nextCursor/);
assert.match(verifier, /classificationEvidence/);
assert.match(verifier, /rotation-direct-verifier/);
assert.match(verifier, /verified-direct-evidence/);

const directMarker = { ownerRef: 'P[1 Player]', sourceRef: '*', powerName: 'Split the Sky', damageType: 'Power', amount: -1, companion: false };
assert.equal(isExplicitEncounterMarker(directMarker), true);
assert.equal(activationRule({ power: 'Split the Sky', category: 'Encounter', explicitMarker: true }).evidence, 'direct');
assert.equal(activationRule({ power: 'Unknown Hit', category: 'Encounter' }).evidence, 'inferred');
const direct = verifyDirectRotationMarkers({ activationCount: 2, lanes: [{ ref: 'P[1 Player]', activations: [{ time: 1, power: 'Split the Sky' }, { time: 4, power: 'Other' }] }] }, [{ ownerRef: 'P[1 Player]', power: 'Split the Sky', time: 1.05, lineNo: 10 }]);
assert.equal(direct.ok, true);
assert.equal(direct.directCoverage, 0.5);
assert.equal(verifyDirectRotationMarkers({ activationCount: 0, lanes: [] }, [{ ownerRef: 'P[1 Player]', power: 'Split the Sky', time: 1, lineNo: 10 }]).ok, false);

const armor = supportEffectProvenance('Armor Break');
assert.equal(armor.game, 'Neverwinter');
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(armor.gameDataSnapshot));
assert.ok(armor.sourceLabel);
const provenance = auditSupportEffectProvenance();
assert.ok(provenance.total >= 70);
assert.equal(provenance.rows.length, provenance.total);

assert.match(docs, /browser engine.*canonical production engine/is);
assert.match(docs, /Silent row caps are not allowed/i);
assert.match(referenceDocs, /NW-Hub/);
assert.match(referenceDocs, /metric[- ]definition/i);

console.log('Accuracy hardening regression passed.');
