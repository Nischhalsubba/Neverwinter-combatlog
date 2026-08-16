import assert from 'node:assert/strict';
import { parseLine } from '../src/engine/fast-parser-core.js';
import { bossTargetEvidence, companionRowEvidence, summarizeCompanionEvidence, summarizeEncounterEntityEvidence } from '../src/engine/entity-evidence.js';

const parse = (line, lineNo) => {
  const result = parseLine(line, lineNo);
  assert.equal(result.ok, true, `fixture row ${lineNo} must parse`);
  return result.row;
};

const directCompanion = parse('2026:08:14:10:00:00.000::Player,P[1 Player@test],Wolf,C[10 Pet_Wolf_Companion],Boss,C[99 M33_Test_Boss],Bite,Power,Physical,,120,100', 1);
const textCompanion = parse('2026:08:14:10:00:01.000::Player,P[1 Player@test],Player,P[1 Player@test],Boss,C[99 M33_Test_Boss],Companion Strike,Power,Physical,,80,70', 2);
const ordinary = parse('2026:08:14:10:00:02.000::Player,P[1 Player@test],Player,P[1 Player@test],Boss,C[99 M33_Test_Boss],Encounter Hit,Power,Physical,,300,250', 3);
const unresolvedCreature = parse('2026:08:14:10:00:03.000::Player,P[1 Player@test],Mystery,C[11 M33_Mystery_Helper],Boss,C[99 M33_Test_Boss],Mystery Hit,Power,Physical,,40,35', 4);

assert.equal(directCompanion.companion, true);
assert.equal(companionRowEvidence(directCompanion).level, 'direct-template');
assert.equal(textCompanion.companion, true);
assert.equal(companionRowEvidence(textCompanion).level, 'text-inferred');

const companion = summarizeCompanionEvidence([directCompanion, textCompanion, ordinary, unresolvedCreature], 'P[1 Player@test]');
assert.equal(companion.companionDamage, 200);
assert.equal(companion.directTemplateDamage, 120);
assert.equal(companion.textInferredDamage, 80);
assert.equal(companion.unresolvedCreatureSourceDamage, 40, 'unresolved creature-source damage stays outside companion attribution');
assert.equal(companion.confidence, 'medium');
assert.equal(companion.directCoverage, 0.6);

const boss = bossTargetEvidence('C[99 M33_Test_Boss]');
assert.equal(boss.classification, 'boss');
assert.equal(boss.confidence, 'high');
assert.match(boss.reason, /_boss/i);
const mob = bossTargetEvidence('C[88 M33_Test_Elite]');
assert.equal(mob.classification, 'mob');
const unknown = bossTargetEvidence('C[77 M33_Opaque_Target]');
assert.equal(unknown.classification, 'unknown-creature');
assert.equal(unknown.confidence, 'unknown');

const encounter = summarizeEncounterEntityEvidence([directCompanion, textCompanion, ordinary, unresolvedCreature]);
assert.equal(encounter.bossTargets.length, 1);
assert.equal(encounter.bossTargets[0].hits, 4);
assert.equal(encounter.confidence, 'high');

console.log('Entity attribution evidence regression passed.');
