import {
  buildShadowReport,
  buildShadowRotation,
  verifyReport as verifyArithmeticReport,
  verifyRotationReport as verifyRotationConsistency,
  VERIFICATION_ENGINE_VERSION as CORE_VERIFICATION_ENGINE_VERSION
} from './verification-engine-core.js';
import { verifyPowerCategories } from './classification-evidence.js';
import { collectDirectRotationMarker, verifyDirectRotationMarkers } from './rotation-direct-verifier.js';

export { buildShadowReport, buildShadowRotation };

function classificationEvidence(primary) {
  const players = [];
  const mismatches = [];
  let checked = 0;
  let unresolved = 0;
  for (const player of primary?.players || []) {
    const result = verifyPowerCategories(player.powers || []);
    checked += result.checked || 0;
    unresolved += result.unresolved || 0;
    for (const mismatch of result.mismatches || []) mismatches.push({ playerRef: player.ref, playerName: player.name, ...mismatch });
    players.push({ ref: player.ref, name: player.name, status: result.status, checked: result.checked, unresolved: result.unresolved, mismatches: result.mismatches });
  }
  return {
    version: 1,
    status: mismatches.length ? 'mismatch' : unresolved ? 'partial' : 'verified',
    checked,
    unresolved,
    mismatches: mismatches.slice(0, 40),
    players
  };
}

export function verifyReport(primary, rows, context = {}, onProgress = null) {
  const arithmetic = verifyArithmeticReport(primary, rows, context, ratio => onProgress?.(Math.min(0.92, ratio * 0.92)));
  const classification = classificationEvidence(primary);
  onProgress?.(1);
  const ok = Boolean(arithmetic.ok) && classification.mismatches.length === 0;
  return {
    ...arithmetic,
    ok,
    status: !arithmetic.ok ? 'mismatch' : classification.mismatches.length ? 'classification-mismatch' : 'verified',
    engine: 'shadow-verifier-v2',
    arithmetic: {
      ok: Boolean(arithmetic.ok),
      engine: arithmetic.engine,
      checksum: arithmetic.checksum || '',
      checkedFields: arithmetic.checkedFields || 0
    },
    classificationEvidence: classification,
    warnings: [
      ...(arithmetic.warnings || []),
      ...(classification.unresolved ? [{ key: 'classification-evidence', value: `${classification.unresolved} power classification${classification.unresolved === 1 ? '' : 's'} have no independent reference evidence and remain inferred.` }] : [])
    ]
  };
}

export function verifyRotationReport(primary, rows, context = {}, onProgress = null) {
  const markers = [];
  let scanned = 0;
  const total = Math.max(1, Number(context.totalRows) || 1);
  function* tappedRows() {
    for (const row of rows || []) {
      const marker = collectDirectRotationMarker(row, context);
      if (marker) markers.push(marker);
      scanned += 1;
      if (scanned % 4096 === 0) onProgress?.(Math.min(0.25, scanned / total * 0.25));
      yield row;
    }
  }

  const consistency = verifyRotationConsistency(primary, tappedRows(), context, ratio => onProgress?.(0.25 + 0.55 * ratio));
  const directEvidence = verifyDirectRotationMarkers(primary, markers);
  onProgress?.(1);
  const ok = Boolean(consistency.ok) && Boolean(directEvidence.ok);
  return {
    ...consistency,
    ok,
    status: !consistency.ok ? 'mismatch'
      : !directEvidence.ok ? 'direct-evidence-mismatch'
      : directEvidence.markers ? 'verified-direct-evidence'
      : 'consistent-inferred',
    engine: 'rotation-verifier-v2',
    consistency: {
      ok: Boolean(consistency.ok),
      engine: consistency.engine,
      checkedActivations: consistency.checkedActivations || 0,
      checksum: consistency.checksum || ''
    },
    directEvidence,
    warnings: [
      ...(consistency.warnings || []),
      ...(directEvidence.markers ? [] : [{ key: 'rotation-direct-evidence', value: 'No explicit Encounter cast markers were available in this scope; activation timing remains inferred.' }])
    ]
  };
}

export const VERIFICATION_ENGINE_VERSION = Math.max(6, Number(CORE_VERIFICATION_ENGINE_VERSION) + 1);
