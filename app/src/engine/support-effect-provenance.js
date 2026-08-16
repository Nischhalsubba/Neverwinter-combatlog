import { SUPPORT_EFFECT_CATALOG, findSupportEffect } from '../data/support-effect-catalog.js';

export const SUPPORT_EFFECT_PROVENANCE_VERSION = 1;
export const SUPPORT_EFFECT_REVIEW_SNAPSHOT = Object.freeze({
  game: 'Neverwinter',
  channel: 'live-reference',
  snapshotDate: '2026-08-14',
  reviewedAt: '2026-08-16'
});

export function supportEffectProvenance(effectOrName) {
  const effect = typeof effectOrName === 'string' ? findSupportEffect(effectOrName) : effectOrName;
  if (!effect) return null;
  const sourceUpdated = effect.source?.updated || null;
  const retiredAt = effect.retiredAt || null;
  const supersededBy = effect.supersededBy || null;
  const effectiveFrom = effect.effectiveFrom || sourceUpdated || null;
  const sourceStatus = retiredAt ? 'retired'
    : supersededBy ? 'superseded'
    : effect.source ? (sourceUpdated ? 'reviewed-source' : 'source-date-missing')
    : 'source-missing';
  return Object.freeze({
    id: effect.id,
    name: effect.name,
    game: SUPPORT_EFFECT_REVIEW_SNAPSHOT.game,
    channel: SUPPORT_EFFECT_REVIEW_SNAPSHOT.channel,
    gameDataSnapshot: SUPPORT_EFFECT_REVIEW_SNAPSHOT.snapshotDate,
    strikeglassReviewedAt: SUPPORT_EFFECT_REVIEW_SNAPSHOT.reviewedAt,
    sourceLabel: effect.source?.label || null,
    sourceUrl: effect.source?.url || null,
    sourceUpdated,
    effectiveFrom,
    retiredAt,
    supersededBy,
    status: sourceStatus
  });
}

export function auditSupportEffectProvenance(catalog = SUPPORT_EFFECT_CATALOG) {
  const rows = catalog.map(effect => supportEffectProvenance(effect));
  const needsReview = rows.filter(row => ['source-date-missing', 'source-missing'].includes(row.status));
  return {
    version: SUPPORT_EFFECT_PROVENANCE_VERSION,
    snapshot: SUPPORT_EFFECT_REVIEW_SNAPSHOT,
    total: rows.length,
    current: rows.filter(row => row.status === 'reviewed-source').length,
    retired: rows.filter(row => row.status === 'retired').length,
    superseded: rows.filter(row => row.status === 'superseded').length,
    needsReview: needsReview.length,
    rows,
    reviewItems: needsReview
  };
}
