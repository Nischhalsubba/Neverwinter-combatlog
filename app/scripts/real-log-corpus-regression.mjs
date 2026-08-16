import assert from 'node:assert/strict';
import { parseText } from '../src/engine/fast-parser-core.js';
import { buildShadowReport } from '../src/engine/verification-engine.js';
import { FIXTURE as shortBoss, LOG as shortBossLog } from '../tests/fixtures/real-corpus/short-boss.mjs';
import { FIXTURE as phasedBoss, LOG as phasedBossLog } from '../tests/fixtures/real-corpus/phased-boss.mjs';
import { FIXTURE as companionHeavy, LOG as companionHeavyLog } from '../tests/fixtures/real-corpus/companion-heavy.mjs';
import { FIXTURE as messyComma, LOG as messyCommaLog } from '../tests/fixtures/real-corpus/messy-unquoted-comma.mjs';
import { FIXTURE as longGap, LOG as longGapLog } from '../tests/fixtures/real-corpus/long-gap-session.mjs';

const corpus = [
  ['short-boss', shortBoss, shortBossLog],
  ['phased-boss', phasedBoss, phasedBossLog],
  ['companion-heavy', companionHeavy, companionHeavyLog],
  ['messy-unquoted-comma', messyComma, messyCommaLog],
  ['long-gap-session', longGap, longGapLog]
];

function near(actual, expected, label, relative = 1e-9) {
  const tolerance = Math.max(1e-6, Math.abs(Number(expected) || 0) * relative);
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function nearTime(actual, expected, label) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= 0.001, `${label}: expected ${expected}, got ${actual}`);
}

function positiveNonPhysicalTypes(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    if (!(Number(row.amount) > 0)) continue;
    const damageType = String(row.damageType || 'Unknown').trim() || 'Unknown';
    if (damageType.toLowerCase() === 'physical') continue;
    counts.set(damageType, (counts.get(damageType) || 0) + 1);
  }
  return counts;
}

for (const [name, fixture, log] of corpus) {
  assert.ok(log.length > 0, `${name} fixture must decode`);
  assert.ok(!/@(?:imortal|jack|shanil|lichking|minaaries)/i.test(log), `${name} must not contain source account handles`);
  const parsed = parseText(log);
  const summary = parsed.summary;
  const wanted = fixture.expected;

  assert.equal(summary.rejected, wanted.rejected, `${name} rejected rows`);
  assert.equal(summary.validDamageRows, wanted.validDamageRows, `${name} canonical damage rows`);
  near(summary.damage, wanted.damage, `${name} group damage`);
  assert.equal(summary.players.reduce((sum, player) => sum + (Number(player.hits) || 0), 0), wanted.hits, `${name} group hits`);
  if (wanted.combatDuration != null) nearTime(summary.combatDuration, wanted.combatDuration, `${name} combat span`);
  assert.equal(summary.encounters.length, wanted.encounters, `${name} encounter count`);
  assert.deepEqual(summary.encounters.map(encounter => encounter.type), wanted.encounterTypes || [], `${name} encounter types`);

  for (const [ref, expectedPlayer] of Object.entries(wanted.players || {})) {
    const player = summary.players.find(item => item.ref === ref);
    assert.ok(player, `${name} missing ${expectedPlayer.name}`);
    near(player.damage, expectedPlayer.damage, `${name} ${expectedPlayer.name} damage`);
    assert.equal(player.hits, expectedPlayer.hits, `${name} ${expectedPlayer.name} hits`);
    nearTime(player.duration, expectedPlayer.duration, `${name} ${expectedPlayer.name} elapsed time`);
    near(player.dps, player.damage / Math.max(1, player.duration), `${name} ${expectedPlayer.name} DPS formula`, 1e-12);
    near(player.companionDamage, expectedPlayer.companionDamage, `${name} ${expectedPlayer.name} companion damage`);
  }

  const broadPositive = positiveNonPhysicalTypes(parsed.rows);
  for (const [eventType, count] of Object.entries(wanted.nonCanonicalPositiveTypes || {})) {
    assert.equal(broadPositive.get(eventType) || 0, count, `${name} ${eventType} positive non-Physical rows`);
  }
  for (const item of summary.nonCanonicalDamageTypes || []) {
    assert.ok((broadPositive.get(item.key) || 0) >= item.value, `${name} non-canonical damage audit cannot exceed all positive non-Physical ${item.key} rows`);
  }

  if (summary.validDamageRows > 0) {
    const shadow = buildShadowReport(parsed.rows, { scopeType: 'session', totalRows: parsed.rows.length });
    near(shadow.damage, wanted.damage, `${name} shadow group damage`);
    assert.equal(shadow.hits, wanted.hits, `${name} shadow group hits`);
    if (wanted.combatDuration != null) nearTime(shadow.duration, wanted.combatDuration, `${name} shadow combat span`);
    for (const [ref, expectedPlayer] of Object.entries(wanted.players || {})) {
      const player = shadow.players.find(item => item.ref === ref);
      assert.ok(player, `${name} shadow missing ${expectedPlayer.name}`);
      near(player.damage, expectedPlayer.damage, `${name} shadow ${expectedPlayer.name} damage`);
      assert.equal(player.hits, expectedPlayer.hits, `${name} shadow ${expectedPlayer.name} hits`);
      nearTime(player.duration, expectedPlayer.duration, `${name} shadow ${expectedPlayer.name} elapsed time`);
      near(player.companionDamage, expectedPlayer.companionDamage, `${name} shadow ${expectedPlayer.name} companion damage`);
    }
  }
}

assert.match(messyCommaLog, /Valkariel, the Corrupted/, 'messy fixture must retain the real unquoted comma shape');
assert.equal(parseText(messyCommaLog).summary.rejected, 0, 'legacy unquoted comma recovery must remain lossless for the real fixture');
assert.ok(longGap.expected.combatDuration > 40000, 'long-gap fixture must preserve a many-hour source timestamp span');
assert.ok(Object.values(companionHeavy.expected.players).some(player => player.companionDamage / Math.max(1, player.damage) > 0.2), 'companion-heavy fixture must materially exercise companion attribution');

console.log('Expanded anonymized real-log corpus regression passed.');
