import { readFile } from 'node:fs/promises';
import { parseText } from '../src/engine/fast-parser-core.js';

const [, , logPath, referencePath] = process.argv;
if (!logPath) {
  console.error('Usage: node scripts/reference-parity.mjs <combat.log> [reference.json]');
  process.exit(2);
}

const text = await readFile(logPath, 'utf8');
const result = parseText(text).summary;
const strikeglass = {
  source: 'Strikeglass browser engine',
  contract: 'canonical Physical damage',
  group: {
    damage: result.damage,
    dps: result.partyDps,
    activeDps: result.partyCombatDps,
    duration: result.combatDuration,
    hits: result.hits
  },
  players: result.players.map(player => ({
    name: player.name,
    ref: player.ref,
    damage: player.damage,
    dps: player.dps,
    activeDps: player.combatDps,
    hits: player.hits,
    critRate: player.crit,
    caRate: player.flank,
    companionDamage: player.companionDamage
  }))
};

if (!referencePath) {
  console.log(JSON.stringify(strikeglass, null, 2));
  process.exit(0);
}

const reference = JSON.parse(await readFile(referencePath, 'utf8'));
const checks = [];
const compare = (owner, metric, actual, expected) => {
  if (expected == null) return;
  const a = Number(actual), b = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    checks.push({ owner, metric, status: 'invalid', strikeglass: actual, reference: expected });
    return;
  }
  const tolerance = Math.max(0.001, Math.abs(b) * 1e-9);
  checks.push({ owner, metric, status: Math.abs(a - b) <= tolerance ? 'match' : 'mismatch', strikeglass: a, reference: b, delta: a - b });
};

for (const [metric, actual] of Object.entries(strikeglass.group)) compare('Group', metric, actual, reference.group?.[metric]);
const byName = new Map(strikeglass.players.map(player => [player.name.trim().toLowerCase(), player]));
const referencePlayers = Array.isArray(reference.players) ? reference.players : Object.entries(reference.players || {}).map(([name, value]) => ({ name, ...value }));
for (const expected of referencePlayers) {
  const actual = byName.get(String(expected.name || '').trim().toLowerCase());
  if (!actual) {
    checks.push({ owner: expected.name, metric: 'player', status: 'missing' });
    continue;
  }
  for (const metric of ['damage', 'dps', 'activeDps', 'hits', 'critRate', 'caRate']) compare(actual.name, metric, actual[metric], expected[metric]);
}

const mismatches = checks.filter(check => check.status !== 'match');
console.log(JSON.stringify({ reference: reference.source || 'external parser', checks, mismatches: mismatches.length }, null, 2));
process.exitCode = mismatches.length ? 1 : 0;
