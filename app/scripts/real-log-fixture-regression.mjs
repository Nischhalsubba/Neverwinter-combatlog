import assert from 'node:assert/strict';
import { parseText } from '../src/engine/fast-parser-core.js';
import { REALSHAPE_EXPECTED as expected, REALSHAPE_LOG } from '../tests/fixtures/realshape-2026-08-14.mjs';

const summary = parseText(REALSHAPE_LOG).summary;

function near(actual, wanted, label, relative = 1e-9) {
  const tolerance = Math.max(1e-6, Math.abs(Number(wanted) || 0) * relative);
  assert.ok(Math.abs(Number(actual) - Number(wanted)) <= tolerance, `${label}: expected ${wanted}, got ${actual}`);
}

assert.equal(summary.rejected, expected.rejected, 'real-shape rejected row count');
assert.equal(summary.validDamageRows, expected.validDamageRows, 'real-shape canonical damage row count');
near(summary.damage, expected.group.damage, 'real-shape group damage');
assert.equal(summary.hits, expected.group.hits, 'real-shape group hit count');
assert.equal(summary.encounters.length, expected.encounters.length, 'real-shape encounter count');

for (let index = 0; index < expected.encounters.length; index += 1) {
  const actual = summary.encounters[index];
  const wanted = expected.encounters[index];
  assert.equal(actual.type, wanted.type, `encounter ${index + 1} type`);
  near(actual.damage, wanted.damage, `encounter ${index + 1} damage`);
  assert.equal(actual.hits, wanted.hits, `encounter ${index + 1} hits`);
  near(actual.start, wanted.start, `encounter ${index + 1} start`);
  near(actual.end, wanted.end, `encounter ${index + 1} end`);
}

for (const [ref, wanted] of Object.entries(expected.players)) {
  const actual = summary.players.find(player => player.ref === ref);
  assert.ok(actual, `missing real-shape player ${ref}`);
  near(actual.damage, wanted.damage, `${wanted.name} damage`);
  assert.equal(actual.hits, wanted.hits, `${wanted.name} hits`);
  near(actual.dps, wanted.dps, `${wanted.name} DPS`);
  near(actual.companionDamage, wanted.companion, `${wanted.name} companion damage`);
}

for (const [type, count] of Object.entries(expected.nonCanonicalPositiveTypes || {})) {
  assert.equal(summary.nonCanonicalDamageTypes.find(item => item.key === type)?.value || 0, count, `${type} positive non-canonical rows`);
}

console.log('Anonymized real-log fixture regression passed.');
