import { isKnownEncounterPowerName } from '../data/encounter-power-icons.js';

export const CLASSIFICATION_EVIDENCE_VERSION = 1;

export function independentCategoryEvidence(power) {
  if (!power) return null;
  const name = String(power.power || power.name || '');
  const damage = Number(power.damage) || 0;
  const companionDamage = Number(power.companionDamage) || 0;
  if (damage > 0 && companionDamage >= damage - 0.001) {
    return { expected: 'Pet / Companion', reason: 'All counted damage is attributed to a companion source.' };
  }
  if (isKnownEncounterPowerName(name)) {
    return { expected: 'Encounter', reason: 'Power is independently present in the encounter-power reference data.' };
  }
  return null;
}

export function verifyPowerCategories(powers = []) {
  const checks = [];
  const unresolved = [];
  for (const power of powers) {
    const evidence = independentCategoryEvidence(power);
    if (!evidence) {
      unresolved.push({ power: power.power || power.name || 'Unknown', category: power.category || 'Other / Unknown' });
      continue;
    }
    checks.push({
      power: power.power || power.name || 'Unknown',
      actual: power.category || 'Other / Unknown',
      expected: evidence.expected,
      reason: evidence.reason,
      match: (power.category || 'Other / Unknown') === evidence.expected
    });
  }
  const mismatches = checks.filter(check => !check.match);
  return {
    version: CLASSIFICATION_EVIDENCE_VERSION,
    status: mismatches.length ? 'mismatch' : unresolved.length ? 'partial' : 'verified',
    checked: checks.length,
    unresolved: unresolved.length,
    mismatches,
    checks,
    unresolvedPowers: unresolved
  };
}
