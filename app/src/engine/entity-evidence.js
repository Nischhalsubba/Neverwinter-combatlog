import { entityTemplate, isBossRef, isCreatureRef, isMobRef, isPetRef, isPlayerRef } from './fast-parser-core.js';

export const ENTITY_EVIDENCE_VERSION = 1;

const companionText = value => /companion|pet|summon|appointment/i.test(String(value || ''));

export function companionRowEvidence(row) {
  if (!row?.validDamage || !row.companion) return null;
  const ownerTemplate = entityTemplate(row.ownerRef);
  const sourceTemplate = entityTemplate(row.sourceRef);
  if (isPetRef(row.ownerRef)) {
    return { level: 'direct-template', confidence: 'high', reason: `Owner creature template identifies a companion-like entity${ownerTemplate ? `: ${ownerTemplate}` : '.'}` };
  }
  if (isPetRef(row.sourceRef)) {
    return { level: 'direct-template', confidence: 'high', reason: `Source creature template identifies a companion-like entity${sourceTemplate ? `: ${sourceTemplate}` : '.'}` };
  }
  const text = [row.ownerName, row.sourceName, row.powerName].filter(Boolean).join(' · ');
  if (companionText(text)) {
    return { level: 'text-inferred', confidence: 'medium', reason: `Companion attribution comes from companion-like event text${text ? `: ${text}` : '.'}` };
  }
  return { level: 'unresolved', confidence: 'low', reason: 'Row is marked companion damage but no direct entity-template or companion-text evidence was recovered.' };
}

export function unresolvedCreatureSource(row) {
  return Boolean(
    row?.validDamage && !row.companion && isPlayerRef(row.ownerRef) && isCreatureRef(row.sourceRef) && row.sourceRef !== row.ownerRef
  );
}

export function summarizeCompanionEvidence(rows = [], playerRef = '') {
  const summary = {
    version: ENTITY_EVIDENCE_VERSION,
    companionDamage: 0,
    directTemplateDamage: 0,
    textInferredDamage: 0,
    unresolvedCompanionDamage: 0,
    unresolvedCreatureSourceDamage: 0,
    companionHits: 0,
    directTemplateHits: 0,
    textInferredHits: 0,
    unresolvedHits: 0,
    unresolvedCreatureSourceHits: 0,
    confidence: 'unknown',
    directCoverage: 0,
    evidence: []
  };

  for (const row of rows) {
    if (!row?.validDamage || Number(row.amount) <= 0) continue;
    if (playerRef && row.ownerRef !== playerRef) continue;
    if (row.companion) {
      const amount = Number(row.amount) || 0;
      const evidence = companionRowEvidence(row);
      summary.companionDamage += amount;
      summary.companionHits += 1;
      if (evidence?.level === 'direct-template') {
        summary.directTemplateDamage += amount;
        summary.directTemplateHits += 1;
      } else if (evidence?.level === 'text-inferred') {
        summary.textInferredDamage += amount;
        summary.textInferredHits += 1;
      } else {
        summary.unresolvedCompanionDamage += amount;
        summary.unresolvedHits += 1;
      }
      if (summary.evidence.length < 8 && evidence) {
        summary.evidence.push({ power: row.powerName || 'Unknown', amount, level: evidence.level, reason: evidence.reason });
      }
      continue;
    }
    if (unresolvedCreatureSource(row)) {
      summary.unresolvedCreatureSourceDamage += Number(row.amount) || 0;
      summary.unresolvedCreatureSourceHits += 1;
    }
  }

  summary.directCoverage = summary.companionDamage ? summary.directTemplateDamage / summary.companionDamage : 0;
  if (!summary.companionDamage) summary.confidence = 'not-observed';
  else if (summary.unresolvedCompanionDamage > 0) summary.confidence = 'low';
  else if (summary.directCoverage >= 0.95) summary.confidence = 'high';
  else summary.confidence = 'medium';
  return summary;
}

export function bossTargetEvidence(ref) {
  const template = entityTemplate(ref);
  if (!isCreatureRef(ref)) return { classification: 'not-creature', confidence: 'none', template, reason: 'Target is not a creature entity reference.' };
  if (isBossRef(ref)) return { classification: 'boss', confidence: 'high', template, reason: `Creature template contains the canonical _boss marker${template ? `: ${template}` : '.'}` };
  if (isMobRef(ref)) return { classification: 'mob', confidence: 'high', template, reason: `Creature template contains a standard non-boss rank marker${template ? `: ${template}` : '.'}` };
  return { classification: 'unknown-creature', confidence: 'unknown', template, reason: `Creature template does not contain a recognized boss or mob rank marker${template ? `: ${template}` : '.'}` };
}

export function summarizeEncounterEntityEvidence(rows = []) {
  const targets = new Map();
  for (const row of rows) {
    if (!row?.validDamage || Number(row.amount) <= 0 || !isCreatureRef(row.targetRef)) continue;
    let target = targets.get(row.targetRef);
    if (!target) {
      const evidence = bossTargetEvidence(row.targetRef);
      target = {
        ref: row.targetRef,
        name: row.targetName || evidence.template || row.targetRef,
        template: evidence.template,
        classification: evidence.classification,
        confidence: evidence.confidence,
        reason: evidence.reason,
        damage: 0,
        hits: 0
      };
      targets.set(row.targetRef, target);
    }
    target.damage += Number(row.amount) || 0;
    target.hits += 1;
  }
  const ordered = [...targets.values()].sort((a, b) => b.damage - a.damage || b.hits - a.hits || a.name.localeCompare(b.name));
  const bossTargets = ordered.filter(target => target.classification === 'boss');
  const unknownTargets = ordered.filter(target => target.classification === 'unknown-creature');
  return {
    version: ENTITY_EVIDENCE_VERSION,
    bossTargets,
    unknownTargets,
    allTargets: ordered,
    bossDamage: bossTargets.reduce((sum, target) => sum + target.damage, 0),
    bossHits: bossTargets.reduce((sum, target) => sum + target.hits, 0),
    confidence: bossTargets.length ? 'high' : unknownTargets.length ? 'unknown' : 'not-observed',
    reason: bossTargets.length
      ? 'Boss classification is inferred from explicit _boss markers in creature entity templates.'
      : unknownTargets.length
        ? 'No canonical _boss marker was observed; one or more creature templates are unclassified.'
        : 'No creature target rows were available in this scope.'
  };
}
