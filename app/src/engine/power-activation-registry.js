import { isKnownEncounterPowerName } from '../data/encounter-power-icons.js';

export const POWER_ACTIVATION_REGISTRY_VERSION = 1;
export const DIRECT_MARKER_TOLERANCE_SECONDS = 0.25;

const FALLBACK_SECONDS = Object.freeze({
  'At-Will': 0.35,
  Encounter: 2.5,
  Daily: 6,
  Artifact: 8,
  Mount: 8
});

export function isExplicitEncounterMarker(row) {
  if (!row || !isKnownEncounterPowerName(row.powerName || row.power || '')) return false;
  if (String(row.ownerRef || '').startsWith('P[') === false) return false;
  if (String(row.sourceRef || '') !== '*') return false;
  if (String(row.damageType || '').trim().toLowerCase() !== 'power') return false;
  if (!(Number(row.amount) < 0)) return false;
  if (row.companion) return false;
  return true;
}

export function activationRule({ power = '', category = '', powerRef = '', explicitMarker = false } = {}) {
  const name = String(power || '').trim();
  const ref = String(powerRef || '').toLowerCase();
  if ((explicitMarker || (category === 'Encounter' && isKnownEncounterPowerName(name)))) {
    return Object.freeze({
      mode: 'explicit-resource-marker',
      evidence: 'direct',
      dedupeSeconds: 0.05,
      assignmentWindowSeconds: Math.max(0.35, FALLBACK_SECONDS.Encounter),
      reason: 'Neverwinter emitted a negative Power resource marker for a referenced Encounter power.'
    });
  }
  const dedupeSeconds = FALLBACK_SECONDS[category] ?? 1;
  const refEvidence = /combat_power_mount|mount/.test(ref) ? 'mount-reference'
    : /artifact|sigil_of_|storyteller|journal/.test(ref) ? 'artifact-reference'
    : '';
  return Object.freeze({
    mode: 'damage-row-grouping',
    evidence: 'inferred',
    dedupeSeconds,
    assignmentWindowSeconds: dedupeSeconds,
    reason: refEvidence
      ? `No direct cast marker was observed; ${refEvidence.replace('-', ' ')} supports the category while timing remains inferred.`
      : `No direct cast marker was observed; ${category || 'power'} timing uses the documented category fallback.`
  });
}

export function activationDedupeSeconds(category, power = '', powerRef = '', explicitMarker = false) {
  return activationRule({ category, power, powerRef, explicitMarker }).dedupeSeconds;
}

export function activationAssignmentWindowSeconds(category, power = '', powerRef = '', explicitMarker = false) {
  return activationRule({ category, power, powerRef, explicitMarker }).assignmentWindowSeconds;
}

export function activationEvidenceLabel(input = {}) {
  const rule = activationRule(input);
  return rule.evidence === 'direct' ? 'Direct cast marker' : 'Inferred from damage rows';
}
