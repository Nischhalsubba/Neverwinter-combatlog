import assert from 'node:assert/strict';
import { analyzeBossEffects } from '../src/engine/boss-effects.js';

const playerA = 'P[1 PlayerA@test]';
const playerB = 'P[2 PlayerB@test]';
const boss = 'C[90 M32_Trial_Boss_Ice_Demon]';
const base = { targetRef: boss, targetName: 'Boss', validDamage: false, flagsRaw: 'ShowPowerDisplayName', amount: 0, baseAmount: 0 };
const damage = time => ({ ...base, time, validDamage: true, flagsRaw: '', damageType: 'Physical', powerName: 'Hit', ownerRef: playerA, ownerName: 'PlayerA', amount: 100, baseAmount: 100 });
const rows = [
  damage(0), damage(4), damage(8), damage(12),
  { ...base, time: 1, powerName: "Midnight's Malady", damageType: 'DamageSetAll', amount: -0.035 },
  { ...base, time: 1, powerName: "Midnight's Malady", damageType: 'Abs_Awareness', amount: -0.035 },
  { ...base, time: 6, powerName: "Midnight's Malady", damageType: 'DamageSetAll', amount: -0.035 },
  { ...base, time: 6, powerName: "Midnight's Malady", damageType: 'Abs_Awareness', amount: -0.035 },
  { ...base, time: 2, powerName: 'Blood Lust', damageType: 'Physical', amount: 0.03, ownerRef: playerA, ownerName: 'PlayerA' },
  { ...base, time: 5, powerName: 'Blood Lust', damageType: 'Physical', amount: 0.03, ownerRef: playerB, ownerName: 'PlayerB' },
  { ...base, time: 2, powerName: 'Blood Lust', damageType: 'Physical', amount: 900, flagsRaw: 'Critical', ownerRef: playerA, ownerName: 'PlayerA' },
  { ...base, time: 3, powerName: 'Storm Conduit', damageType: 'Null', ownerRef: playerA, ownerName: 'PlayerA' },
  { ...base, time: 4, powerName: 'Unmapped Target Mark', damageType: 'Null', ownerRef: playerA, ownerName: 'PlayerA' }
];

const result = analyzeBossEffects(rows);
assert.equal(result.verification.status, 'verified');
assert.equal(result.activeTime, 12);
const malady = result.effects.find(effect => effect.id === 'midnights-malady');
assert.ok(malady);
assert.equal(malady.applications, 2, 'two metadata rows at the same time count as one application');
assert.equal(Math.round(malady.seconds), 10);
assert.equal(Math.round(malady.uptime), 83);
const blood = result.effects.find(effect => effect.id === 'blood-lust');
assert.equal(blood.sources.length, 2);
assert.equal(blood.applications, 2, 'damage rows with the same power name must not count as applications');
assert.ok(result.otherSignals.some(signal => signal.name === 'Storm Conduit'));
assert.ok(result.otherSignals.some(signal => signal.name === 'Unmapped Target Mark'));
console.log('Boss effect regression passed.');
