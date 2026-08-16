import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseText } from '../src/engine/fast-parser-core.js';

export const REFERENCE_SCHEMA_VERSION = 2;

const DEFINITIONS = Object.freeze({
  damage: 'positive-physical-canonical-player-owned',
  group: Object.freeze({
    damage: 'positive-physical-canonical-player-owned',
    dps: 'group-damage/selected-combat-span',
    combatDps: 'group-damage/reconstructed-active-combat-time',
    duration: 'selected-combat-span',
    combatTime: 'reconstructed-active-combat-time',
    hits: 'canonical-damage-rows'
  }),
  player: Object.freeze({
    damage: 'positive-physical-canonical-player-owned',
    dps: 'player-damage/personal-first-last-hit-span',
    combatDps: 'player-damage/reconstructed-active-damage-time',
    duration: 'personal-first-last-hit-span',
    combatTime: 'reconstructed-active-damage-time',
    hits: 'canonical-damage-rows',
    critRate: 'critical-canonical-hits/canonical-hits',
    flankRate: 'flank-or-combat-advantage-canonical-hits/canonical-hits',
    maxHit: 'maximum-canonical-hit',
    encounters: 'reconstructed-player-damage-windows',
    healingDone: 'observed-healing-events',
    damageTaken: 'canonical-physical-damage-received',
    shielded: 'observed-shield-events',
    companionDamage: 'canonical-damage-inferred-companion-attribution'
  }),
  power: Object.freeze({
    damage: 'canonical-player-damage-by-power',
    hits: 'canonical-damage-rows-by-power',
    share: 'power-damage/player-damage-percent',
    avg: 'power-damage/power-hits',
    max: 'maximum-canonical-power-hit',
    critRate: 'critical-power-hits/power-hits',
    flankRate: 'flank-or-combat-advantage-power-hits/power-hits'
  })
});

const DEFINITION_SENSITIVE = new Set([
  'group.dps', 'group.combatDps', 'group.duration', 'group.combatTime',
  'player.dps', 'player.combatDps', 'player.duration', 'player.combatTime', 'player.encounters'
]);

const finite = value => Number.isFinite(Number(value));
const key = value => String(value || '').trim().toLowerCase();
const safeDivide = (numerator, denominator) => Number(numerator) / Math.max(1, Number(denominator) || 0);

function powerSnapshot(power) {
  return {
    name: power.power,
    ref: power.powerRef || '',
    damage: power.damage,
    hits: power.hits,
    share: power.share,
    avg: power.avg,
    max: power.max,
    critRate: power.crit,
    flankRate: power.flank,
    companionDamage: power.companionDamage
  };
}

export function buildStrikeglassSnapshot(text) {
  const parsed = parseText(text);
  const result = parsed.summary;
  const groupHits = result.players.reduce((sum, player) => sum + (Number(player.hits) || 0), 0);
  const groupDps = safeDivide(result.damage, result.combatDuration);
  const groupCombatDps = safeDivide(result.damage, result.activeCombatTime);

  return {
    schemaVersion: REFERENCE_SCHEMA_VERSION,
    source: 'Strikeglass browser engine',
    contract: 'canonical Physical damage',
    definitions: DEFINITIONS,
    scope: {
      type: 'full-session',
      lines: result.lines,
      parsed: result.parsed,
      rejected: result.rejected,
      canonicalDamageRows: result.validDamageRows,
      encounters: result.encounters.length
    },
    group: {
      damage: result.damage,
      dps: groupDps,
      combatDps: groupCombatDps,
      duration: result.combatDuration,
      combatTime: result.activeCombatTime,
      hits: groupHits
    },
    players: result.players.map(player => {
      const detail = parsed.accumulator.playerReport(player.ref) || player;
      return {
        name: player.name,
        ref: player.ref,
        damage: player.damage,
        dps: player.dps,
        combatDps: player.combatDps,
        duration: player.duration,
        combatTime: player.combatTime,
        hits: player.hits,
        critRate: player.crit,
        flankRate: player.flank,
        maxHit: player.maxHit,
        encounters: player.encounters,
        healingDone: player.healingDone,
        damageTaken: player.damageTaken,
        shielded: player.shielded,
        companionDamage: player.companionDamage,
        powers: (detail.powers || []).map(powerSnapshot)
      };
    })
  };
}

function expectedValue(source, metric) {
  if (!source) return undefined;
  if (metric === 'combatDps') return source.combatDps ?? source.activeDps;
  if (metric === 'flankRate') return source.flankRate ?? source.caRate ?? source.flank;
  if (metric === 'critRate') return source.critRate ?? source.crit;
  if (metric === 'max') return source.max ?? source.maxHit;
  if (metric === 'combatTime') return source.combatTime ?? source.activeTime ?? source.inCombatTime;
  return source[metric];
}

function referenceDefinition(reference, ownerType, metric) {
  return reference.definitions?.[ownerType]?.[metric]
    ?? (metric === 'damage' ? reference.definitions?.damage : undefined);
}

function actualDefinition(ownerType, metric) {
  return DEFINITIONS[ownerType]?.[metric] ?? (metric === 'damage' ? DEFINITIONS.damage : undefined);
}

function compareNumber(checks, { owner, ownerType, metric, actual, expected, reference }) {
  if (expected == null || expected === '') return;
  const path = `${ownerType}.${metric}`;
  const actualDef = actualDefinition(ownerType, metric);
  const expectedDef = referenceDefinition(reference, ownerType, metric);

  if (DEFINITION_SENSITIVE.has(path)) {
    if (!expectedDef || expectedDef === 'unknown') {
      checks.push({ owner, metric, status: 'definition-required', strikeglass: actual, reference: expected, strikeglassDefinition: actualDef, referenceDefinition: expectedDef || null });
      return;
    }
    if (actualDef !== expectedDef) {
      checks.push({ owner, metric, status: 'definition-mismatch', strikeglass: actual, reference: expected, strikeglassDefinition: actualDef, referenceDefinition: expectedDef });
      return;
    }
  }

  const a = Number(actual);
  const b = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    checks.push({ owner, metric, status: 'invalid', strikeglass: actual, reference: expected });
    return;
  }
  const tolerance = Math.max(0.001, Math.abs(b) * 1e-9);
  checks.push({
    owner,
    metric,
    status: Math.abs(a - b) <= tolerance ? 'match' : 'mismatch',
    strikeglass: a,
    reference: b,
    delta: a - b,
    definition: actualDef || null
  });
}

function normalizeReferencePlayers(reference) {
  return Array.isArray(reference.players)
    ? reference.players
    : Object.entries(reference.players || {}).map(([name, value]) => ({ name, ...value }));
}

function normalizeReferencePowers(player) {
  return Array.isArray(player?.powers)
    ? player.powers
    : Object.entries(player?.powers || {}).map(([name, value]) => ({ name, ...value }));
}

function findPlayer(players, expected) {
  if (expected.ref) {
    const byRef = players.find(player => player.ref === expected.ref);
    if (byRef) return byRef;
  }
  return players.find(player => key(player.name) === key(expected.name));
}

function findPower(powers, expected) {
  if (expected.ref) {
    const byRef = powers.find(power => power.ref === expected.ref);
    if (byRef) return byRef;
  }
  return powers.find(power => key(power.name) === key(expected.name ?? expected.power));
}

export function compareReferenceSnapshot(strikeglass, reference) {
  const checks = [];
  const groupMetrics = ['damage', 'dps', 'combatDps', 'duration', 'combatTime', 'hits'];
  for (const metric of groupMetrics) {
    compareNumber(checks, {
      owner: 'Group', ownerType: 'group', metric,
      actual: strikeglass.group[metric], expected: expectedValue(reference.group, metric), reference
    });
  }

  const playerMetrics = [
    'damage', 'dps', 'combatDps', 'duration', 'combatTime', 'hits', 'critRate', 'flankRate',
    'maxHit', 'encounters', 'healingDone', 'damageTaken', 'shielded', 'companionDamage'
  ];
  const powerMetrics = ['damage', 'hits', 'share', 'avg', 'max', 'critRate', 'flankRate'];

  for (const expectedPlayer of normalizeReferencePlayers(reference)) {
    const actualPlayer = findPlayer(strikeglass.players, expectedPlayer);
    if (!actualPlayer) {
      checks.push({ owner: expectedPlayer.name || expectedPlayer.ref || 'Unknown player', metric: 'player', status: 'missing' });
      continue;
    }
    for (const metric of playerMetrics) {
      compareNumber(checks, {
        owner: actualPlayer.name, ownerType: 'player', metric,
        actual: actualPlayer[metric], expected: expectedValue(expectedPlayer, metric), reference
      });
    }

    for (const expectedPower of normalizeReferencePowers(expectedPlayer)) {
      const actualPower = findPower(actualPlayer.powers || [], expectedPower);
      const label = `${actualPlayer.name} · ${expectedPower.name || expectedPower.power || expectedPower.ref || 'Unknown power'}`;
      if (!actualPower) {
        checks.push({ owner: label, metric: 'power', status: 'missing' });
        continue;
      }
      for (const metric of powerMetrics) {
        compareNumber(checks, {
          owner: label, ownerType: 'power', metric,
          actual: actualPower[metric], expected: expectedValue(expectedPower, metric), reference
        });
      }
    }
  }

  const hardFailures = checks.filter(check => ['mismatch', 'missing', 'invalid', 'definition-mismatch'].includes(check.status));
  const unresolvedDefinitions = checks.filter(check => check.status === 'definition-required');
  return {
    schemaVersion: REFERENCE_SCHEMA_VERSION,
    reference: reference.source || 'external parser',
    sourceUrl: reference.sourceUrl || null,
    checks,
    summary: {
      matched: checks.filter(check => check.status === 'match').length,
      hardFailures: hardFailures.length,
      unresolvedDefinitions: unresolvedDefinitions.length,
      total: checks.length
    },
    hardFailures,
    unresolvedDefinitions
  };
}

async function runCli() {
  const [, , logPath, referencePath] = process.argv;
  if (!logPath) {
    console.error('Usage: node scripts/reference-parity.mjs <combat.log> [reference.json]');
    process.exit(2);
  }

  const text = await readFile(logPath, 'utf8');
  const strikeglass = buildStrikeglassSnapshot(text);
  if (!referencePath) {
    console.log(JSON.stringify(strikeglass, null, 2));
    return;
  }

  const reference = JSON.parse(await readFile(referencePath, 'utf8'));
  const comparison = compareReferenceSnapshot(strikeglass, reference);
  console.log(JSON.stringify(comparison, null, 2));
  if (comparison.hardFailures.length || comparison.unresolvedDefinitions.length) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) await runCli();
