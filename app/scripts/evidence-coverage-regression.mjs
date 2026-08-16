import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('src/v8/index.js');
const coverage = read('src/v24/evidence-coverage.js');
const css = read('src/v24/evidence-coverage.css');
const parser = read('src/engine/fast-parser-core.js');
const effectWrapper = read('src/engine/effect-intelligence-engine.js');
const effectCore = read('src/engine/effect-intelligence-engine-core.js');
const effect = `${effectWrapper}\n${effectCore}`;

assert.match(index, /v24\/evidence-coverage\.js/);
for (const text of [
  'How much of this timeline is directly marked by the log?',
  'Explicit Encounter markers', 'Direct marker coverage', 'Marker agreement',
  'not automatically an error', 'independent spot-check',
  'What the debuff conclusions are based on', 'Comparable damage hits',
  'Baseline samples used', 'Observable coverage', 'Direction agreement',
  'Median observed uplift', 'not a claim that the debuff alone caused every observed change',
  'Exact target', 'Cross-target', 'Exact coverage',
  'cannot earn the strongest effect confidence by itself'
]) assert.ok(coverage.includes(text), `evidence coverage missing: ${text}`);
assert.match(coverage, /kind: 'resource'/);
assert.match(coverage, /isKnownEncounterPowerName/);
assert.match(coverage, /row\.sourceRef === '\*'/);
assert.match(coverage, /Math\.abs\(Number\(activation\.time\) - markerTime\) <= 0\.25/);
assert.match(coverage, /effect\.verification\?\.empirical/);
assert.match(coverage, /empirical\.comparableHits/);
assert.match(coverage, /empirical\.baselineSamples/);
assert.match(coverage, /empirical\.exactComparableHits/);
assert.match(coverage, /empirical\.relaxedComparableHits/);
assert.match(css, /sg-evidence-table/);
assert.match(css, /grid-template-columns:repeat\(4/);
assert.ok(parser.includes("CANONICAL_DAMAGE_TYPES = new Set(['physical'])"), 'evidence presentation must not change damage inclusion');
assert.match(effectWrapper, /analyzeCoreEffectIntelligence/, 'public Effect Intelligence wrapper must keep the preserved core engine');
assert.match(effect, /timelineVerified && empirical\.status !== 'mismatch'/, 'effect publication fail-closed contract must remain intact');
assert.match(effectWrapper, /exactBaselineRequiredForStrongestTier: true/, 'strongest effect evidence tier must require exact-target baseline support');

console.log('Direct evidence coverage regression passed.');
