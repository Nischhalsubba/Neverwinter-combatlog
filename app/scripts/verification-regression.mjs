import assert from 'node:assert/strict';
import { parseText } from '../src/engine/fast-parser-core.js';
import { buildShadowReport, buildShadowRotation, verifyReport, verifyRotationReport } from '../src/engine/verification-engine.js';

const fixture = [
  '26:08:12:00:00:00.000::Nefarius,P[1 Nefarius],Nefarius,P[1 Nefarius],Dragon,C[9 Dragon_Boss],Chilling Cloud,Power_Chilling_Cloud,Physical,Critical|CombatAdvantage,2800000000,24000000',
  '26:08:12:00:30:00.000::Nefarius,P[1 Nefarius],Nefarius,P[1 Nefarius],Dragon,C[9 Dragon_Boss],Icy Rays,Power_Icy_Rays,Arcane,,9000000000,9000000000',
  '26:08:12:00:59:59.000::Nefarius,P[1 Nefarius],Nefarius,P[1 Nefarius],Dragon,C[9 Dragon_Boss],Icy Rays,Power_Icy_Rays,Physical,Critical,2800000000,24000000'
].join('\n');

const parsed = parseText(fixture);
assert.equal(parsed.summary.damage, 5600000000, 'non-Physical positive rows must not enter trusted reference totals');
assert.equal(parsed.summary.validDamageRows, 2);
assert.equal(parsed.summary.nonCanonicalDamageTypes.find(item => item.key === 'Arcane')?.value, 1);

const context = { scopeType: 'session', scopeStart: 0, scopeEnd: 3599, targetOnly: false, bossTargets: [] };
const shadow = buildShadowReport(parsed.rows, context);
assert.equal(shadow.damage, 5600000000);
assert.equal(shadow.duration, 3599);
assert.equal(shadow.players[0].dps, 5600000000 / 3599);
assert.ok(shadow.players[0].dps > 1_550_000 && shadow.players[0].dps < 1_560_000, 'reference-style 5.6B / 59m59s should display as roughly 1.6M DPS');

const primary = structuredClone(shadow);
primary.verification = undefined;
const good = verifyReport(primary, parsed.rows, context);
assert.equal(good.status, 'verified');
assert.equal(good.mismatches.length, 0);

const corrupt = structuredClone(primary);
corrupt.players[0].dps += 25_000;
const bad = verifyReport(corrupt, parsed.rows, context);
assert.equal(bad.status, 'mismatch');
assert.ok(bad.mismatches.some(item => item.path.includes('.dps')), 'verifier must block altered DPS before publication');

const rotation = buildShadowRotation(parsed.rows, context);
const rotationGood = verifyRotationReport(rotation, parsed.rows, context);
assert.equal(rotationGood.status, 'verified');
const corruptedRotation = structuredClone(rotation);
if (corruptedRotation.lanes[0]?.activations[0]) corruptedRotation.lanes[0].activations[0].time += 1;
const rotationBad = verifyRotationReport(corruptedRotation, parsed.rows, context);
assert.equal(rotationBad.status, 'mismatch');

console.log('Verification regression passed.');
