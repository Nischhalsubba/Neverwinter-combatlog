import assert from 'node:assert/strict';
import {
  NW_HUB_CAPTURED_PROFILE,
  buildNwHubCompatibility,
  formatNwHubDuration,
  formatNwHubNumber
} from '../src/engine/nwhub-compatibility.js';
import { capturedDamageOut, capturedPartyOverview } from '../tests/fixtures/nwhub/aug13-captured-reference.mjs';

assert.equal(NW_HUB_CAPTURED_PROFILE.encounterGapSeconds, 10, 'captured NW-Hub encounter profile must keep the calibrated 10-second inactivity boundary');
assert.equal(NW_HUB_CAPTURED_PROFILE.minimumPersonalDurationSeconds, 0.001, 'NW-Hub zero-span DPS compatibility must preserve the captured millisecond floor');
assert.equal(capturedPartyOverview.length, 15, 'saved Party Overview capture must retain all 15 visible players');

for (const row of capturedPartyOverview) {
  assert.equal(formatNwHubNumber(row.damage), row.expected.damage, `${row.id} damage display must match the saved NW-Hub capture`);
  const dps = row.damage / Math.max(NW_HUB_CAPTURED_PROFILE.minimumPersonalDurationSeconds, row.duration);
  assert.equal(formatNwHubNumber(dps), row.expected.dps, `${row.id} personal DPS display must match the saved NW-Hub capture`);
  assert.equal(Number(row.hits).toLocaleString('en-US'), row.expected.hits, `${row.id} hit count must match the saved NW-Hub capture`);
  assert.equal(formatNwHubDuration(row.duration), row.expected.duration, `${row.id} duration display must match the saved NW-Hub capture`);
  assert.ok(row.expected.combatDps, `${row.id} captured Combat DPS must remain stored as an independent reference-clock observation`);
}

for (const row of capturedDamageOut) {
  const actual = [
    Number(row.hits).toLocaleString('en-US'),
    formatNwHubNumber(row.damage),
    `${row.share.toFixed(1)}%`,
    formatNwHubNumber(row.avg),
    formatNwHubNumber(row.max),
    `${row.crit.toFixed(1)}%`
  ];
  assert.deepEqual(actual, row.expected, `${row.power} Damage Out metrics must match the saved NW-Hub capture`);
}

const syntheticRows = [
  { time: 0, ownerRef: 'P[1]', amount: 100, damageType: 'physical', flags: 0, validDamage: true },
  { time: 8, ownerRef: 'P[2]', amount: 50, damageType: 'physical', flags: 0, validDamage: true },
  { time: 9, ownerRef: 'P[1]', amount: 100, damageType: 'physical', flags: 0, validDamage: true },
  { time: 21, ownerRef: 'P[1]', amount: 100, damageType: 'physical', flags: 0, validDamage: true },
  { time: 29, ownerRef: 'P[2]', amount: 50, damageType: 'physical', flags: 0, validDamage: true }
];
const syntheticPlayers = [
  { ref: 'P[1]', name: 'Player 1', damage: 300, hits: 3, duration: 21 },
  { ref: 'P[2]', name: 'Player 2', damage: 100, hits: 2, duration: 21 }
];
const compatibility = buildNwHubCompatibility(syntheticRows, syntheticPlayers);
assert.equal(compatibility.encounterCount, 2, 'NW-Hub compatibility clock must split party combat after more than ten seconds without outgoing Physical damage');
assert.equal(compatibility.encounters[0].duration, 9, 'first compatibility encounter must use the observed party span');
assert.equal(compatibility.encounters[1].duration, 8, 'second compatibility encounter must use the observed party span');
assert.equal(compatibility.players[0].participatedEncounters, 2, 'player encounter participation must be derived from canonical damage inside party windows');
assert.equal(compatibility.players[1].participatedEncounters, 2, 'party encounter participation must remain player-specific');
assert.notEqual(compatibility.players[0].combatDps, compatibility.players[0].dps, 'NW-Hub Combat DPS compatibility must remain a separate clock from Personal DPS');

console.log('Captured NW-Hub parity regression passed. Saved Party Overview Damage/DPS/Hits/Duration and visible Damage Out power metrics match the captured reference display; Combat DPS remains an explicitly separate compatibility clock.');
