import assert from 'node:assert/strict';
import { parseLine, parseText, parseTimestamp } from '../src/engine/fast-parser-core.js';

const standard = '26:04:15:00:00:00.000::Alice,P[1 Alice],Alice,P[1 Alice],Boss,C[9 Dragon_Boss],Arcane Strike,Power_Arcane,Arcane,Critical|CombatAdvantage,1000,1000';
const parsed = parseLine(standard, 1);
assert.equal(parsed.ok, true);
assert.equal(parsed.row.damageType, 'Arcane');
assert.equal(parsed.row.validDamage, true);
assert.equal(parsed.row.amount, 1000);

const legacyComma = '26:04:15:00:00:01.000::Alice, The Brave,P[1 Alice],Summoned, Wolf,C[7 Pet_Wolf],Ancient, Dragon,C[9 Dragon_Boss],Power, With, Comma,Power_Comma,Fire,Critical,500,500';
const recovered = parseLine(legacyComma, 2);
assert.equal(recovered.ok, true);
assert.equal(recovered.row.ownerName, 'Alice, The Brave');
assert.equal(recovered.row.sourceName, 'Summoned, Wolf');
assert.equal(recovered.row.targetName, 'Ancient, Dragon');
assert.equal(recovered.row.powerName, 'Power, With, Comma');
assert.equal(recovered.row.validDamage, true);
assert.equal(recovered.row.companion, true);

const indexed = '42,26:04:15:00:00:02.000::Bob,P[2 Bob],Bob,P[2 Bob],Mob,C[4 Goblin_Standard],Cold Snap,Power_Cold,Cold,Flank,300,300';
assert.equal(parseLine(indexed, 3).ok, true);

const text = [
  standard,
  '26:04:15:00:00:02.000::Alice,P[1 Alice],Alice,P[1 Alice],Boss,C[9 Dragon_Boss],Arcane Strike,Power_Arcane,Physical,,500,500',
  '26:04:15:00:00:30.000::Alice,P[1 Alice],Alice,P[1 Alice],Boss,C[9 Dragon_Boss],Arcane Strike,Power_Arcane,Lightning,Critical,250,250',
  'malformed row without separator'
].join('\n');

const result = parseText(text);
const alice = result.summary.players.find(player => player.ref === 'P[1 Alice]');
assert.ok(alice);
assert.equal(alice.damage, 1750);
assert.equal(alice.hits, 3);
assert.equal(result.summary.rejected, 1);
assert.equal(result.summary.validDamageRows, 3);
assert.equal(result.summary.encounters.length, 2);
assert.ok(alice.dps > 0);
assert.ok(alice.combatDps > alice.dps, 'combat DPS should exclude long idle gaps');

const beforeRollover = parseTimestamp('26:04:30:23:59:59.000');
const afterRollover = parseTimestamp('26:05:01:00:00:01.000');
assert.equal(afterRollover - beforeRollover, 2, 'full date timestamps must remain monotonic across month rollover');
const rollover = parseText([
  '26:04:30:23:59:59.000::Alice,P[1 Alice],Alice,P[1 Alice],Dragon,C[9 Dragon_Boss],Arcane Strike,Power_A,Arcane,,100,100',
  '26:05:01:00:00:01.000::Alice,P[1 Alice],Alice,P[1 Alice],Dragon,C[9 Dragon_Boss],Arcane Strike,Power_A,Arcane,,100,100'
].join('\n'));
assert.equal(rollover.summary.damage, 200);
assert.equal(rollover.summary.combatDuration, 2);
assert.equal(rollover.summary.logDuration, 2);

const incoming = parseText([
  '26:04:15:00:00:00.000::Goblin,C[10 Goblin_Standard],Goblin,C[10 Goblin_Standard],Alice,P[1 Alice],Display,Power_Display,Physical,ShowPowerDisplayName,9999,9999',
  '26:04:15:00:00:01.000::Goblin,C[10 Goblin_Standard],Goblin,C[10 Goblin_Standard],Alice,P[1 Alice],Slash,Power_Slash,Physical,,250,250'
].join('\n'));
const incomingAlice = incoming.summary.players.find(player => player.ref === 'P[1 Alice]');
assert.ok(incomingAlice);
assert.equal(incomingAlice.damageTaken, 250, 'display-name rows must not inflate incoming damage');

const phasedBoss = parseText([
  '26:04:15:00:00:00.000::Alice,P[1 Alice],Alice,P[1 Alice],Dragon,C[9 Dragon_Boss],Arcane Strike,Power_A,Arcane,,100,100',
  '26:04:15:00:00:07.000::Alice,P[1 Alice],Alice,P[1 Alice],Add,C[10 Goblin_Standard],Arcane Strike,Power_A,Arcane,,5000,5000',
  '26:04:15:00:00:14.000::Alice,P[1 Alice],Alice,P[1 Alice],Dragon,C[9 Dragon_Boss],Arcane Strike,Power_A,Arcane,,200,200'
].join('\n'));
assert.equal(phasedBoss.summary.encounters.length, 1, 'boss/add/boss phases within merge tolerance should stay one boss encounter');
assert.equal(phasedBoss.summary.encounters[0].type, 'boss');
assert.equal(phasedBoss.summary.encounters[0].label, 'Dragon');
assert.equal(phasedBoss.summary.encounters[0].damage, 5300);

console.log('Parser regression passed.');
