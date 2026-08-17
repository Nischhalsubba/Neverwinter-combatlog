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
    evidenceStatus: !arithmetic.ok ? 'arithmetic-mismatch' : classification.mismatches.length ? 'classification-mismatch' : classification.unresolved ? 'verified-arithmetic-partial-classification' : 'verified-arithmetic-and-classification',
    arithmetic: {
      ok: Boolean(arithmetic.ok),
      engine: arithmetic.engine,
      coreEngine: 'shadow-verifier-v1',
      checksum: arithmetic.checksum || '',
      checkedFields: arithmetic.checkedFields || 0
    },
    classificationEvidence: classification,
    arithmeticCore: { engine: 'shadow-verifier-v1', preserved: true },
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

  // Rotation reconstruction and direct cast-marker evidence are separate evidence dimensions.
  // A direct marker mismatch must remain visible, but it must not masquerade as a disagreement
  // between the primary rotation builder and the independent shadow reconstruction.
  const ok = Boolean(consistency.ok);
  const evidenceStatus = !consistency.ok ? 'consistency-mismatch'
    : !directEvidence.ok ? 'direct-evidence-mismatch'
    : directEvidence.markers ? 'verified-direct-evidence'
    : 'consistent-inferred';
  const directEvidenceWarnings = !directEvidence.markers
    ? [{ key: 'rotation-direct-evidence', value: 'No explicit Encounter cast markers were available in this scope; activation timing remains inferred.' }]
    : !directEvidence.ok
      ? [{
          key: 'rotation-direct-evidence-mismatch',
          value: `${directEvidence.unmatched} explicit Encounter cast marker${directEvidence.unmatched === 1 ? '' : 's'} did not align with the reconstructed activations. The independent rotation reconstruction still agrees, so the timeline remains available as inferred analysis while the direct-evidence conflict is shown for review.`
        }]
      : [];

  return {
    ...consistency,
    ok,
    status: ok ? 'verified' : 'mismatch',
    evidenceStatus,
    engine: 'rotation-verifier-v3',
    consistency: {
      ok: Boolean(consistency.ok),
      engine: consistency.engine,
      checkedActivations: consistency.checkedActivations || 0,
      checksum: consistency.checksum || ''
    },
    directEvidence,
    warnings: [
      ...(consistency.warnings || []),
      ...directEvidenceWarnings
    ]
  };
}

export const VERIFICATION_ENGINE_VERSION = Math.max(7, Number(CORE_VERIFICATION_ENGINE_VERSION) + 1);
