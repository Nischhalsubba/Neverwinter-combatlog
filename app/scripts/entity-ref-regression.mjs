import assert from 'node:assert/strict';
import { buildShadowReport } from '../src/engine/verification-engine.js';
import { entityTemplate, isBossRef, isMobRef, isPetRef, parseText } from '../src/engine/fast-parser-core.js';

const bossRef = 'C[617426298@32885548 Dragon_Boss_Phase_1]';
const mobRef = 'C[617426299@32885548 Goblin_Standard]';
const petRef = 'C[617426300@32885548 Pet_Wolf]';

assert.equal(entityTemplate(bossRef), 'Dragon_Boss_Phase_1');
assert.equal(isBossRef(bossRef), true, 'opaque creature ids with suffixed boss templates must still be recognized as bosses');
assert.equal(isMobRef(mobRef), true, 'opaque creature ids must still expose mob templates');
assert.equal(isPetRef(petRef), true, 'opaque creature ids must still expose pet templates');

const playerRef = 'P[517426298@32885548 CLGNTURK@Fburhan#48416]';
const lines = [
  `26:08:13:10:00:00.000::CLGNTURK,${playerRef},CLGNTURK,${playerRef},Dragon,${bossRef},Strike,Power_Strike,Physical,,100,100`,
  `26:08:13:10:00:07.000::CLGNTURK,${playerRef},CLGNTURK,${playerRef},Goblin,${mobRef},Strike,Power_Strike,Physical,,50,50`,
  `26:08:13:10:00:14.000::CLGNTURK,${playerRef},CLGNTURK,${playerRef},Dragon,${bossRef},Strike,Power_Strike,Physical,,100,100`
];

const parsed = parseText(lines.join('\n'));
const player = parsed.summary.players.find(item => item.ref === playerRef);
assert.ok(player);
assert.equal(parsed.summary.encounters.length, 1, 'boss/add/boss phases should merge for opaque creature ids');
assert.equal(parsed.summary.encounters[0].type, 'boss');
assert.equal(parsed.summary.encounters[0].label, 'Dragon');
assert.equal(parsed.summary.activeCombatTime, 14);
assert.equal(player.combatTime, 14);

const shadow = buildShadowReport(parsed.rows, { scopeType: 'session', scopeStart: 0, scopeEnd: 14 });
const shadowPlayer = shadow.players.find(item => item.ref === playerRef);
assert.ok(shadowPlayer);
assert.equal(player.combatTime, shadowPlayer.combatTime, 'calculator and verifier combat clocks must agree when _Boss is followed by a template suffix');
assert.equal(player.combatDps, shadowPlayer.combatDps, 'calculator and verifier combat DPS must agree when _Boss is followed by a template suffix');
assert.equal(parsed.summary.activeCombatTime, shadow.activeCombatTime, 'party encounter clocks must agree for suffixed boss templates');

console.log('Entity reference regression passed.');
