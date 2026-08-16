import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fingerprintDistance, fingerprintSignature, fingerprintVector, intervalSummary, normalizeFingerprints } from '../src/v29/analysis-model.js';

const [bootstrap, shell, css, evidence, attempts, fingerprints, moment, compare, trends, build] = await Promise.all([
  readFile('src/v3/power-drilldown.js','utf8'),
  readFile('src/v29/composition-shell.js','utf8'),
  readFile('src/v29/index.css','utf8'),
  readFile('src/v29/evidence-map.js','utf8'),
  readFile('src/v29/attempt-lab.js','utf8'),
  readFile('src/v29/fight-fingerprints.js','utf8'),
  readFile('src/v29/moment-inspector.js','utf8'),
  readFile('src/v29/compare-lab.js','utf8'),
  readFile('src/v29/trends.js','utf8'),
  readFile('build-static.mjs','utf8')
]);

assert.match(bootstrap, /v29\/index\.js/, 'v29 platform must load from the compatibility bootstrap');
assert.match(shell, /sg-composition-context/);
assert.match(shell, /sg-investigation-root/);
assert.match(css, /@layer sg\.tokens, sg\.layout, sg\.components, sg\.features, sg\.utilities/);
assert.match(evidence, /while \(cursor != null\)/, 'Evidence Map must not silently cap raw evidence pages');
assert.match(attempts, /unusually long/i, 'Attempt Lab must use evidence-safe timing language');
assert.doesNotMatch(attempts, /missed cast/i, 'Attempt Lab must not claim player intent or cooldown knowledge');
assert.match(fingerprints, /deterministic/i);
assert.match(moment, /while \(cursor != null\)/, 'Moment Inspector must exhaust selected-window raw pages');
assert.match(compare, /Median-relative/);
assert.match(trends, /every detected fight/i);
assert.match(build, /artifactIdentity/);
assert.match(build, /integrations', 'supabase/);

const summary = intervalSummary([10, 11, 12, 13, 35]);
assert.equal(summary.count, 5);
assert.ok(summary.upperFence > summary.median);
const player = { damage: 1000, damageShare: 50, duration: 20, combatTime: 15, crit: 40, flank: 60, companionDamage: 100, dps: 50, combatDps: 66.67, powers: [{ damage: 500 }, { damage: 250 }, { damage: 100 }] };
const vector = fingerprintVector(player, { duration: 20 });
assert.equal(vector.damageShare, .5);
assert.equal(vector.activeRatio, .75);
assert.match(fingerprintSignature(vector), /^[a-f0-9]{8}$/);
const normalized = normalizeFingerprints([{ vector }, { vector: { ...vector, activeRatio: .5 } }]);
assert.ok(fingerprintDistance(normalized.items[0].normalized, normalized.items[1].normalized) > 0);
console.log('Composition, trust, Evidence Map, Attempt Lab, Fight Fingerprints, Moment Inspector, Compare 2.0, longitudinal trends, and production identity regressions passed.');
