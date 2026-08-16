import { DIRECT_MARKER_TOLERANCE_SECONDS, isExplicitEncounterMarker } from './power-activation-registry.js';

export const ROTATION_DIRECT_VERIFIER_VERSION = 1;

export function collectDirectRotationMarker(row, context = {}) {
  if (context.targetOnly || !isExplicitEncounterMarker(row)) return null;
  const origin = Number(context.scopeStart) || 0;
  return {
    ownerRef: String(row.ownerRef || ''),
    ownerName: String(row.ownerName || ''),
    power: String(row.powerName || row.power || 'Unknown'),
    time: Math.max(0, (Number(row.time) || 0) - origin),
    lineNo: Number(row.lineNo) || 0
  };
}

function nearestActivation(lane, marker) {
  let best = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const activation of lane?.activations || []) {
    if (String(activation.power || '') !== marker.power) continue;
    const delta = Math.abs((Number(activation.time) || 0) - marker.time);
    if (delta < bestDelta) {
      best = activation;
      bestDelta = delta;
    }
  }
  return { activation: best, delta: bestDelta };
}

export function verifyDirectRotationMarkers(primary, markers = []) {
  const lanes = new Map((primary?.lanes || []).map(lane => [lane.ref, lane]));
  const misses = [];
  const matchedKeys = new Set();
  let matched = 0;
  for (const marker of markers) {
    const lane = lanes.get(marker.ownerRef);
    const nearest = nearestActivation(lane, marker);
    if (!nearest.activation || nearest.delta > DIRECT_MARKER_TOLERANCE_SECONDS) {
      misses.push({ ...marker, reason: !lane ? 'player-lane-missing' : 'activation-not-at-marker' });
      continue;
    }
    matched += 1;
    matchedKeys.add(`${marker.ownerRef}|${marker.power}|${Number(nearest.activation.time).toFixed(3)}`);
  }
  const totalActivations = Number(primary?.activationCount) || (primary?.lanes || []).reduce((sum, lane) => sum + (lane.activations?.length || 0), 0);
  const agreement = markers.length ? matched / markers.length : 1;
  return {
    version: ROTATION_DIRECT_VERIFIER_VERSION,
    ok: misses.length === 0,
    status: misses.length ? 'mismatch' : markers.length ? 'verified-direct' : 'no-direct-markers',
    markers: markers.length,
    matched,
    unmatched: misses.length,
    markerAgreement: agreement,
    directCoverage: totalActivations ? matchedKeys.size / totalActivations : 0,
    totalActivations,
    toleranceSeconds: DIRECT_MARKER_TOLERANCE_SECONDS,
    misses: misses.slice(0, 40)
  };
}
