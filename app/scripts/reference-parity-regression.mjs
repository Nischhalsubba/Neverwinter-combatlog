import assert from 'node:assert/strict';
import { REALSHAPE_LOG } from '../tests/fixtures/realshape-2026-08-14.mjs';
import { buildStrikeglassSnapshot, compareReferenceSnapshot, REFERENCE_SCHEMA_VERSION } from './reference-parity.mjs';

const snapshot = buildStrikeglassSnapshot(REALSHAPE_LOG);
assert.equal(snapshot.schemaVersion, REFERENCE_SCHEMA_VERSION);
assert.ok(Number.isFinite(snapshot.group.dps), 'group DPS must be derived from the canonical snapshot instead of reading a missing field');
assert.ok(Number.isFinite(snapshot.group.combatDps), 'group Combat DPS must be derived from active combat time');
assert.ok(snapshot.players.length > 0);
assert.ok(snapshot.players.some(player => player.powers.length > 0), 'reference snapshot must expose per-power values');

const player = snapshot.players.find(item => item.powers.length) || snapshot.players[0];
const power = player.powers[0];
const reference = {
  schemaVersion: REFERENCE_SCHEMA_VERSION,
  source: 'Reference fixture',
  definitions: snapshot.definitions,
  group: { ...snapshot.group },
  players: [{
    name: player.name,
    damage: player.damage,
    dps: player.dps,
    activeDps: player.combatDps,
    duration: player.duration,
    inCombatTime: player.combatTime,
    hits: player.hits,
    crit: player.critRate,
    caRate: player.flankRate,
    maxHit: player.maxHit,
    encounters: player.encounters,
    healingDone: player.healingDone,
    damageTaken: player.damageTaken,
    shielded: player.shielded,
    companionDamage: player.companionDamage,
    powers: [{
      name: power.name,
      damage: power.damage,
      hits: power.hits,
      share: power.share,
      avg: power.avg,
      maxHit: power.max,
      crit: power.critRate,
      caRate: power.flankRate
    }]
  }]
};

const exact = compareReferenceSnapshot(snapshot, reference);
assert.equal(exact.hardFailures.length, 0);
assert.equal(exact.unresolvedDefinitions.length, 0);
assert.ok(exact.summary.matched > 0);

const missingDefinition = structuredClone(reference);
delete missingDefinition.definitions.group.dps;
const unresolved = compareReferenceSnapshot(snapshot, missingDefinition);
assert.ok(unresolved.unresolvedDefinitions.some(check => check.owner === 'Group' && check.metric === 'dps'));

const wrongDefinition = structuredClone(reference);
wrongDefinition.definitions.player.dps = 'player-damage/encounter-span';
const definitionMismatch = compareReferenceSnapshot(snapshot, wrongDefinition);
assert.ok(definitionMismatch.hardFailures.some(check => check.owner === player.name && check.metric === 'dps' && check.status === 'definition-mismatch'));

const wrongPower = structuredClone(reference);
wrongPower.players[0].powers[0].damage += 1;
const powerMismatch = compareReferenceSnapshot(snapshot, wrongPower);
assert.ok(powerMismatch.hardFailures.some(check => check.owner.includes(power.name) && check.metric === 'damage'));

console.log('Definition-aware external reference parity regression passed.');
