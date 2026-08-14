import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  { ...base, time: 7, powerName: 'Blood Lust', damageType: 'Physical', amount: 0.03, ownerRef: '', ownerName: '' },
  { ...base, time: 2, powerName: 'Blood Lust', damageType: 'Physical', amount: 900, flagsRaw: 'Critical', ownerRef: playerA, ownerName: 'PlayerA' },
  { ...base, time: 3, powerName: 'Storm Conduit', damageType: 'Null', ownerRef: playerA, ownerName: 'PlayerA' },
  { ...base, time: 4, powerName: 'Shadow of Demise', damageType: 'Null', ownerRef: playerB, ownerName: 'PlayerB' },
  { ...base, time: 10, powerName: 'Shadow of Demise', damageType: 'ApplyPower', ownerRef: playerB, ownerName: 'PlayerB' },
  { ...base, time: 4, powerName: 'Unmapped Target Mark', damageType: 'Null', ownerRef: playerA, ownerName: 'PlayerA' },
  { ...base, time: 5, powerName: 'Immune Target Mark', damageType: 'Null', flagsRaw: 'Immune|ShowPowerDisplayName', ownerRef: playerA, ownerName: 'PlayerA' }
];

const result = analyzeBossEffects(rows);
assert.equal(result.verification.status, 'verified');
assert.equal(result.activeTime, 12);
assert.equal(result.effects.length, 4, 'all four known boss effects should be timed');

const malady = result.effects.find(effect => effect.id === 'midnights-malady');
assert.ok(malady);
assert.equal(malady.applications, 2, 'two metadata rows at the same time count as one application');
assert.equal(Math.round(malady.seconds), 10);
assert.equal(Math.round(malady.uptime), 83);

const blood = result.effects.find(effect => effect.id === 'blood-lust');
assert.ok(blood);
assert.equal(blood.sources.length, 3, 'ownerless applications stay visible as an unknown source');
assert.equal(blood.applications, 3, 'valid ownerless Blood Lust markers must still count as boss debuff applications');
assert.ok(blood.sources.some(source => source.name === 'Source not recorded'));

const storm = result.effects.find(effect => effect.id === 'storm-conduit');
assert.ok(storm);
assert.equal(storm.applications, 1);
assert.equal(storm.sources.length, 1);
assert.equal(Math.round(storm.sources[0].seconds), 9);
assert.equal(Math.round(storm.sources[0].uptime), 75);

const demise = result.effects.find(effect => effect.id === 'shadow-of-demise');
assert.ok(demise);
assert.equal(demise.applications, 1, 'the ApplyPower expiry row must not count as a new application');
assert.equal(demise.sources.length, 1);
assert.equal(Math.round(demise.sources[0].seconds), 6);
assert.equal(Math.round(demise.sources[0].uptime), 50);

assert.ok(!result.otherSignals.some(signal => signal.name === 'Storm Conduit'));
assert.ok(!result.otherSignals.some(signal => signal.name === 'Shadow of Demise'));
assert.ok(result.otherSignals.some(signal => signal.name === 'Unmapped Target Mark'));
assert.ok(!result.otherSignals.some(signal => signal.name === 'Immune Target Mark'));

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bridgeAt = index.indexOf('src/v7/worker-bridge.js');
const appAt = index.indexOf('src/v3/app.js');
assert.ok(bridgeAt >= 0 && bridgeAt < appAt, 'worker bridge must load before the combat app creates its worker');
assert.match(index, /src\/v7\/boss-effects\.css/);
assert.match(index, /src\/v7\/boss-effects\.js/);

const engine = readFileSync(new URL('../src/engine/boss-effects.js', import.meta.url), 'utf8');
assert.match(engine, /id: 'storm-conduit'/);
assert.match(engine, /id: 'shadow-of-demise'/);
assert.match(engine, /duration: 10/);
assert.match(engine, /duration: 6/);
assert.doesNotMatch(engine, /\.slice\(0, 12\)/);
assert.doesNotMatch(engine, /powerName !== 'Blood Lust' \|\| !isPlayerRef/);

const ui = readFileSync(new URL('../src/v7/boss-effects.js', import.meta.url), 'utf8');
assert.match(ui, /dataset\.view = 'debuffs'/);
assert.match(ui, />Debuff Uptime</);
assert.match(ui, /What does uptime mean\?/);
assert.match(ui, /Who applied it/);
assert.match(ui, /Player not recorded in the log/);
assert.match(ui, /Helps everyone/);
assert.match(ui, /Only helps that player/);
assert.match(ui, /Effects found but not timed yet/);
assert.match(ui, /limit: 500/);
assert.match(ui, /targetOnly: true/);
assert.doesNotMatch(ui, />Team debuffs</);
assert.doesNotMatch(ui, />Personal target effects</);
assert.doesNotMatch(ui, /boss-target rows/);

const css = readFileSync(new URL('../src/v7/boss-effects.css', import.meta.url), 'utf8');
assert.match(css, /min-height:64px/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /max-width:700px/);
console.log('Boss effect regression passed.');
