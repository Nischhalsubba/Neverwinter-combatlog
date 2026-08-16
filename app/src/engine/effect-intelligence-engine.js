import { FLAG, isCreatureRef, isPlayerRef } from './fast-parser-core.js';
import { analyzeEffectIntelligence as analyzeCoreEffectIntelligence } from './effect-intelligence-engine-core.js';

const MIN_BASELINE_SAMPLES = 3;
const MIN_EXACT_MATCH_HITS = 5;
const MIN_EXACT_COVERAGE = 0.5;

const text = value => String(value == null ? '' : value).trim();
const normalize = value => text(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`]/g, "'")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

function hitFlags(row) {
  return {
    crit: (row.flags & FLAG.CRITICAL) !== 0,
    ca: (row.flags & (FLAG.FLANK | FLAG.COMBAT_ADVANTAGE)) !== 0,
    deflected: (row.flags & FLAG.DEFLECT) !== 0
  };
}

function baselineKey(row, flags, relaxed = false) {
  return [
    text(row.ownerRef), normalize(row.powerName), relaxed ? '*' : text(row.targetRef), normalize(row.damageType),
    flags.crit ? 'c' : '-', flags.ca ? 'a' : '-', flags.deflected ? 'd' : '-'
  ].join('|');
}

function observationRow(row) {
  if (!row || row.kind !== 'damage' || Number(row.amount) <= 0 || Number(row.baseAmount) <= 0) return false;
  if (!isPlayerRef(row.ownerRef) || !isCreatureRef(row.targetRef) || row.companion) return false;
  if ((row.flags & (FLAG.IMMUNE | FLAG.SHOW_POWER_DISPLAY_NAME)) !== 0) return false;
  const ratio = Number(row.amount) / Number(row.baseAmount);
  return Number.isFinite(ratio) && ratio > 0 && ratio < 50;
}

function stateAt(segments, time) {
  if (!segments?.length) return 0;
  let low = 0;
  let high = segments.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (Number(segments[middle].end) <= time) low = middle + 1;
    else high = middle;
  }
  const segment = segments[low];
  return segment && Number(segment.start) <= time && time < Number(segment.end) ? Number(segment.stateId) || 0 : 0;
}

function observationApplies(effect, row) {
  const scope = effect.effectScope || 'all';
  const damageType = normalize(row.damageType);
  if (scope === 'all') return true;
  if (scope === 'physical' || scope === 'physical-projectile') return damageType === 'physical';
  if (scope === 'magical-projectile') return damageType !== 'physical';
  if (scope === 'dragons') return false;
  return true;
}

function buildBaselineBank(rows, report) {
  const stateByTarget = new Map((report.states?.targets || []).map(item => [text(item.targetRef), item.segments || []]));
  const observations = [];
  const exact = new Map();
  const relaxed = new Map();
  for (const row of rows || []) {
    if (!observationRow(row)) continue;
    const flags = hitFlags(row);
    const item = {
      row,
      time: Number(row.time),
      targetRef: text(row.targetRef),
      exactKey: baselineKey(row, flags, false),
      relaxedKey: baselineKey(row, flags, true),
      stateId: stateAt(stateByTarget.get(text(row.targetRef)), Number(row.time))
    };
    observations.push(item);
    if (item.stateId !== 0) continue;
    exact.set(item.exactKey, (exact.get(item.exactKey) || 0) + 1);
    relaxed.set(item.relaxedKey, (relaxed.get(item.relaxedKey) || 0) + 1);
  }
  return { observations, exact, relaxed };
}

function qualityForEffect(effect, bank) {
  if (effect.verification?.empirical?.mode !== 'damage-baseline') return null;
  const intervals = (effect.targets || []).flatMap(target => (target.intervals || []).map(interval => ({
    start: Number(interval.start),
    end: Number(interval.end),
    targetRef: text(target.ref)
  })));
  let exactComparableHits = 0;
  let relaxedComparableHits = 0;
  let exactBaselineSamples = 0;
  let relaxedBaselineSamples = 0;

  for (const observation of bank.observations) {
    if (!observationApplies(effect, observation.row)) continue;
    const active = intervals.some(interval => interval.targetRef === observation.targetRef && observation.time >= interval.start && observation.time < interval.end);
    if (!active) continue;
    const exactSamples = bank.exact.get(observation.exactKey) || 0;
    if (exactSamples >= MIN_BASELINE_SAMPLES) {
      exactComparableHits += 1;
      exactBaselineSamples += exactSamples;
      continue;
    }
    const relaxedSamples = bank.relaxed.get(observation.relaxedKey) || 0;
    if (relaxedSamples >= MIN_BASELINE_SAMPLES) {
      relaxedComparableHits += 1;
      relaxedBaselineSamples += relaxedSamples;
    }
  }

  const comparableHits = exactComparableHits + relaxedComparableHits;
  const exactCoverage = comparableHits ? exactComparableHits / comparableHits : 0;
  const level = !comparableHits
    ? 'none'
    : !relaxedComparableHits
      ? 'exact'
      : !exactComparableHits
        ? 'relaxed'
        : 'mixed';
  return {
    level,
    exactComparableHits,
    relaxedComparableHits,
    exactBaselineSamples,
    relaxedBaselineSamples,
    exactCoverage
  };
}

function applyEvidencePolicy(report, rows) {
  const bank = buildBaselineBank(rows, report);
  for (const effect of report.teamEffects || []) {
    const quality = qualityForEffect(effect, bank);
    if (!quality) continue;
    const empirical = effect.verification?.empirical;
    Object.assign(empirical, {
      baselineQuality: quality.level,
      exactComparableHits: quality.exactComparableHits,
      relaxedComparableHits: quality.relaxedComparableHits,
      exactBaselineSamples: quality.exactBaselineSamples,
      relaxedBaselineSamples: quality.relaxedBaselineSamples,
      exactBaselineCoverage: quality.exactCoverage
    });

    const strongestEvidence = empirical.status === 'matched';
    const enoughExactEvidence = quality.exactComparableHits >= MIN_EXACT_MATCH_HITS && quality.exactCoverage >= MIN_EXACT_COVERAGE;
    if (strongestEvidence && !enoughExactEvidence) {
      empirical.status = 'supported';
      empirical.policyDowngrade = 'insufficient-exact-baseline';
      if (effect.verification.confidence === 'VERIFIED') effect.verification.confidence = 'HIGH';
    }
  }

  if (report.summary) {
    report.summary.verifiedEffects = (report.teamEffects || []).filter(effect => effect.verification?.confidence === 'VERIFIED').length;
    report.summary.relaxedBaselineEffects = (report.teamEffects || []).filter(effect => effect.verification?.empirical?.baselineQuality === 'relaxed').length;
  }
  report.evidencePolicy = {
    version: 2,
    exactBaselineRequiredForStrongestTier: true,
    minimumExactComparableHits: MIN_EXACT_MATCH_HITS,
    minimumExactCoverage: MIN_EXACT_COVERAGE
  };
  return report;
}

export function analyzeEffectIntelligence(rows, options = {}) {
  const source = Array.isArray(rows) ? rows : Array.from(rows || []);
  return applyEvidencePolicy(analyzeCoreEffectIntelligence(source, options), source);
}
