import assert from 'node:assert/strict';
import { analyzeCombatEffects, COMPANION_DEBUFFS } from '../src/engine/combat-effects.js';

const player = 'P[1 Player@test]';
const boss = 'C[90 M32_Trial_Boss_Test]';
const add = 'C[91 M32_Trial_Add_Standard]';
const giant = 'C[45 M33_Undead_Skeletalfrostgiant_Solo]';
const base = { validDamage: false, flagsRaw: 'ShowPowerDisplayName', amount: 0, baseAmount: 0, sourceRef: '*', sourceName: '' };
const damage = (time, targetRef = boss, targetName = 'Boss') => ({ ...base, time, targetRef, targetName, validDamage: true, flagsRaw: '', damageType: 'Physical', powerName: 'Hit', ownerRef: player, ownerName: 'Player', amount: 100, baseAmount: 100 });
const enemyEffect = (time, powerName, damageType, amount, targetRef = boss, targetName = 'Boss', ownerRef = player, ownerName = 'Player') => ({ ...base, time, powerName, damageType, amount, targetRef, targetName, ownerRef, ownerName });
const playerEffect = (time, powerName, damageType, flagsRaw = 'ShowPowerDisplayName') => ({ ...base, time, powerName, damageType, flagsRaw, targetRef: player, targetName: 'Player', ownerRef: giant, ownerName: 'Skeletal Frost Giant' });

const rows = [
  damage(0), damage(5), damage(10),
  damage(2, add, 'Add'), damage(6, add, 'Add'),
  enemyEffect(1, 'Armor Break', 'Physical', -0.09),
  enemyEffect(1, 'Armor Break', 'Abs_Defense', -0.09),
  enemyEffect(2, 'Dulled Senses', 'Abs_Awareness', -0.09),
  enemyEffect(3, 'Vulnerability', 'Abs_CriticalAvoidance', -0.09),
  enemyEffect(4, 'Weapon Break', 'Abs_CriticalSeverity', -0.09),
  enemyEffect(2.5, 'Slowed Reactions', 'Null', 0),
  enemyEffect(3.2, 'Advantage Nullification', 'Abs_CombatAdvantage', -0.09),
  enemyEffect(3.5, 'Commanding Shot', 'Physical', 0.1),
  enemyEffect(4.5, 'Controlled Momentum', 'Physical', 0.02),
  enemyEffect(5.5, 'Vulnerability Up', 'Physical', 0.2, boss, 'Boss', giant, 'Skeletal Frost Giant'),
  enemyEffect(6.5, 'Unmapped Target Mark', 'Null', 0),
  playerEffect(5, 'Armor Breaking Charge', 'ApplyPower'),
  playerEffect(5.2, 'Shattered Armor', 'Null'),
  playerEffect(6, 'Immune Target Mark', 'Null', 'Immune|ShowPowerDisplayName')
];

const result = analyzeCombatEffects(rows);
assert.equal(result.verification.status, 'verified');
assert.equal(result.verification.mismatches.length, 0);

const armor = result.debuffsOnEnemies.find(effect => effect.name === 'Armor Break');
assert.ok(armor);
assert.equal(armor.applications, 1, 'duplicate metadata at the same timestamp must count as one application');
assert.equal(armor.family, 'companion-enhancement');
assert.equal(armor.classification, 'enemy-debuff');
assert.equal(armor.duration, 15);
assert.equal(armor.changes[0].value, 9, 'current enhancement catalog uses the 2026 workbook magnitude');
assert.equal(armor.timedTargets.length, 1);
assert.equal(armor.timedTargets[0].verified, true);
assert.equal(Math.round(armor.timedTargets[0].uptime), 90);

for (const name of ['Dulled Senses', 'Vulnerability', 'Weapon Break']) {
  const effect = result.debuffsOnEnemies.find(item => item.name === name);
  assert.ok(effect, `${name} must be discoverable as a real enemy debuff`);
  assert.equal(effect.duration, 15, `${name} keeps the previously verified 15-second duration`);
  assert.ok(effect.timedTargets.some(target => target.verified), `${name} should receive independently checked target uptime`);
}

const slowed = result.debuffsOnEnemies.find(effect => effect.name === 'Slowed Reactions');
assert.ok(slowed);
assert.equal(slowed.duration, null, 'unknown duration must not be invented');
assert.equal(slowed.timedTargets.length, 0);
assert.ok(result.debuffsOnEnemies.some(effect => effect.name === 'Advantage Nullification'));

const classDebuff = result.debuffsOnEnemies.find(effect => effect.name === 'Commanding Shot');
assert.ok(classDebuff, 'current NW-Hub class debuffs should be classified from the sourced catalog');
assert.equal(classDebuff.duration, 10);
assert.equal(classDebuff.source?.label, 'Neverwinter Hub');
assert.ok(classDebuff.timedTargets.some(target => target.verified));

const controlled = result.allyBuffs.find(effect => effect.name === 'Controlled Momentum');
assert.ok(controlled, 'party buffs must stay out of the enemy debuff list even when the raw row points at a creature');
assert.ok(!result.debuffsOnEnemies.some(effect => effect.name === 'Controlled Momentum'));
assert.ok(!result.onEnemies.some(effect => effect.name === 'Controlled Momentum'));

const mechanic = result.enemyMechanics.find(effect => effect.name === 'Vulnerability Up');
assert.ok(mechanic, 'creature-origin status rows should be separated as encounter mechanics');
assert.ok(!result.debuffsOnEnemies.some(effect => effect.name === 'Vulnerability Up'));
assert.ok(!result.onEnemies.some(effect => effect.name === 'Vulnerability Up'));

const unknown = result.unclassifiedEnemyEffects.find(effect => effect.name === 'Unmapped Target Mark');
assert.ok(unknown);
assert.equal(unknown.timedTargets.length, 0);

assert.ok(result.onPlayers.some(effect => effect.name === 'Armor Breaking Charge'));
assert.ok(result.onPlayers.some(effect => effect.name === 'Shattered Armor'));
assert.ok(!result.onPlayers.some(effect => effect.name === 'Immune Target Mark'));
assert.ok(result.immuneEffects.some(effect => effect.name === 'Immune Target Mark'));

const definitions = new Map(COMPANION_DEBUFFS.map(effect => [effect.name, effect]));
for (const name of ['Armor Break', 'Dulled Senses', 'Vulnerability', 'Weapon Break']) {
  assert.equal(definitions.get(name)?.duration, 15);
}
assert.equal(definitions.get('Slowed Reactions')?.duration, null);

console.log('Combat effect regression passed.');
