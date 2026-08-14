import assert from 'node:assert/strict';
import { FLAG } from '../src/engine/fast-parser-core.js';
import { analyzeEffectIntelligence } from '../src/engine/effect-intelligence-engine.js';

const player = 'P[1 Ranger@test]';
const player2 = 'P[2 Warlock@test]';
const boss = 'C[90 M33_Test_Boss]';
const creature = 'C[91 Pet_Test_Companion]';

function hit(time, { ownerRef = player, ownerName = 'Ranger', powerName = 'Rapid Shot', amount = 100, baseAmount = 100, flags = FLAG.CRITICAL | FLAG.FLANK } = {}) {
  return {
    time,
    lineNo: Math.round(time * 100),
    ownerRef,
    ownerName,
    sourceRef: ownerRef,
    sourceName: ownerName,
    targetRef: boss,
    targetName: 'Boss',
    powerName,
    powerRef: 'Power',
    damageType: 'Physical',
    flags,
    flagsRaw: flags & FLAG.CRITICAL ? 'Critical|Flank' : '',
    amount,
    baseAmount,
    kind: 'damage',
    validDamage: true,
    companion: false
  };
}

const rows = [];
for (let index = 0; index < 6; index += 1) rows.push(hit(index * .6, { amount: 100 + (index % 2), baseAmount: 100 }));
rows.push(hit(5, { powerName: 'Thorn Ward', amount: 115, baseAmount: 100 }));
for (let index = 0; index < 9; index += 1) rows.push(hit(5.3 + index * .7, { amount: 130 + (index % 3), baseAmount: 100 }));
for (let index = 0; index < 5; index += 1) rows.push(hit(5.45 + index * 1.1, { ownerRef: player2, ownerName: 'Warlock', powerName: 'Hellish Rebuke', amount: 129 + (index % 2), baseAmount: 100 }));
rows.push(hit(9, { powerName: 'Thorn Ward', amount: 116, baseAmount: 100 }));
rows.push({
  time: 7,
  lineNo: 700,
  ownerRef: creature,
  ownerName: 'Enemy mechanic',
  sourceRef: creature,
  sourceName: 'Enemy mechanic',
  targetRef: boss,
  targetName: 'Boss',
  powerName: 'Vulnerability Up',
  powerRef: '',
  damageType: 'Physical',
  flags: FLAG.SHOW_POWER_DISPLAY_NAME,
  flagsRaw: 'ShowPowerDisplayName',
  amount: .2,
  baseAmount: 0,
  kind: 'unknown',
  validDamage: false,
  companion: false
});
rows.push(hit(18, { amount: 100, baseAmount: 100 }));
rows.push(hit(20, { amount: 101, baseAmount: 100 }));
rows.push(hit(21, { powerName: 'Commanding Shot', amount: 110, baseAmount: 100 }));

const report = analyzeEffectIntelligence(rows, { scope: { type: 'boss', id: 1 }, scopeStart: 0, scopeEnd: 22 });
assert.equal(report.verification.ok, true);
assert.ok(['verified', 'attention'].includes(report.verification.status));

const thorn = report.teamEffects.find(effect => effect.name === 'Thorn Ward');
assert.ok(thorn, 'successful Thorn Ward hits should create a known-rule team debuff');
assert.equal(thorn.sourceType, 'Class power');
assert.equal(thorn.duration, 10);
assert.equal(thorn.applications, 2, 'separate Thorn Ward hits should be preserved as refresh applications');
assert.equal(thorn.targets.length, 1);
assert.equal(thorn.targets[0].intervals.length, 1, 'overlapping refreshes should merge into one continuous interval');
assert.ok(thorn.targets[0].intervals[0].start > 5, 'a hit-triggered debuff starts after the triggering hit');
assert.ok(thorn.targets[0].intervals[0].end >= 19, 'the second hit should refresh the ten-second window');
assert.equal(thorn.verification.timelineVerified, true);
assert.ok(thorn.verification.empirical.comparableHits >= 5, 'damage verifier should find matched samples inside the predicted window');
assert.ok((thorn.verification.empirical.medianUplift || 0) > .2, 'debuff-window damage should be measurably above the clean amount/baseAmount baseline');
assert.ok(['matched', 'supported'].includes(thorn.verification.empirical.status));
assert.notEqual(thorn.verification.confidence, 'UNRESOLVED');

assert.ok(report.timing.windows.length > 0, 'verified timed effects should produce Party Rotation windows');
assert.ok(report.timing.applications.some(item => item.name === 'Thorn Ward'));
const commanding = report.teamEffects.find(effect => effect.name === 'Commanding Shot');
assert.ok(commanding, 'a known class debuff near the fight boundary should still be reconstructed');
assert.equal(commanding.targets[0].verified, true, 'independent interval verification must clip to the selected fight boundary');
assert.ok(commanding.targets[0].intervals[0].end <= 22 + 1e-6, 'timed effects must not extend beyond the selected scope');
assert.ok(report.timing.windows.every(window => window.effectIds.every(id => !id.includes('|'))), 'timeline windows expose canonical effect ids, not internal interval keys');
assert.ok(report.states.definitions.some(state => state.effectIds.includes(thorn.id)), 'target-state interning should include the active Thorn Ward state');
assert.ok(!report.teamEffects.some(effect => effect.name === 'Vulnerability Up'), 'creature-origin Vulnerability Up must remain an enemy mechanic, not a team debuff');
assert.ok(report.baseline.cleanObservations >= 3);
assert.ok(report.baseline.comparableBuckets >= 1);
assert.match(report.baseline.note, /amount\/baseAmount/);

console.log('Effect intelligence regression passed.');
