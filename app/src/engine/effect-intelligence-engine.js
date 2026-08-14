import { FLAG, isBossRef, isCreatureRef, isPlayerRef } from './fast-parser-core.js';
import { analyzeBossEffects, buildActiveWindows } from './boss-effects.js';
import { analyzeCombatEffects } from './combat-effects.js';
import { SUPPORT_EFFECT_CATALOG, isTeamDamageSupportEffect } from '../data/support-effect-catalog.js';

const EPSILON = 1e-6;
const MIN_BASELINE_SAMPLES = 3;
const MIN_EFFECT_SAMPLES = 5;
const EXPLAINED_UPLIFT = 0.01;
const UNEXPLAINED_UPLIFT = 0.12;

const normalize = value => String(value == null ? '' : value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`]/g, "'")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = value => String(value == null ? '' : value).trim();

function median(values) {
  if (!values.length) return null;
  const ordered = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function quantile(values, ratio) {
  if (!values.length) return null;
  const ordered = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.min(ordered.length - 1, (ordered.length - 1) * ratio));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return ordered[lower];
  const weight = index - lower;
  return ordered[lower] * (1 - weight) + ordered[upper] * weight;
}

function mergeIntervals(intervals) {
  const ordered = (intervals || [])
    .map(interval => ({ ...interval, start: number(interval.start), end: number(interval.end) }))
    .filter(interval => interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end + EPSILON) {
      merged.push({ ...interval, sourceRefs: new Set(interval.sourceRefs || []), sourceNames: new Set(interval.sourceNames || []) });
      continue;
    }
    previous.end = Math.max(previous.end, interval.end);
    for (const value of interval.sourceRefs || []) previous.sourceRefs.add(value);
    for (const value of interval.sourceNames || []) previous.sourceNames.add(value);
  }
  return merged.map(interval => ({
    ...interval,
    sourceRefs: Array.from(interval.sourceRefs || []),
    sourceNames: Array.from(interval.sourceNames || [])
  }));
}

function intersectIntervals(intervals, windows) {
  const source = mergeIntervals(intervals);
  const active = mergeIntervals(windows);
  const out = [];
  let left = 0;
  let right = 0;
  while (left < source.length && right < active.length) {
    const start = Math.max(source[left].start, active[right].start);
    const end = Math.min(source[left].end, active[right].end);
    if (end > start) out.push({ start, end });
    if (source[left].end < active[right].end) left += 1;
    else right += 1;
  }
  return mergeIntervals(out);
}

const intervalSeconds = intervals => (intervals || []).reduce((sum, item) => sum + Math.max(0, number(item.end) - number(item.start)), 0);

const CATALOG_BY_NAME = new Map();
for (const definition of SUPPORT_EFFECT_CATALOG) {
  for (const name of [definition.name, ...(definition.aliases || [])]) {
    const key = normalize(name);
    if (key && !CATALOG_BY_NAME.has(key)) CATALOG_BY_NAME.set(key, definition);
  }
}

function catalogDefinition(name) {
  return CATALOG_BY_NAME.get(normalize(name)) || null;
}

function isTeamEffect(effect) {
  if (!effect) return false;
  if (effect.id === 'midnights-malady' || effect.name === "Midnight's Malady") return true;
  return isTeamDamageSupportEffect(effect);
}

function sourceType(effect) {
  if (effect?.sourceType) return effect.sourceType;
  if (effect?.id === 'midnights-malady') return 'Ring';
  const family = text(effect?.family);
  if (family === 'companion-enhancement') return 'Enhancement';
  if (family === 'class-power') return 'Class power';
  if (family === 'class-feat' || family === 'class-effect') return 'Class effect';
  if (family === 'companion') return 'Companion';
  if (family === 'mount') return 'Mount';
  if (family === 'artifact') return 'Artifact';
  return 'Team debuff';
}

function sourceName(effect) {
  if (effect?.sourceName) return effect.sourceName;
  if (effect?.id === 'midnights-malady') return "Eilistraee's Grace";
  return '';
}

function definitionMeta(effect) {
  return {
    id: effect.id || `effect-${normalize(effect.name).replace(/\s+/g, '-')}`,
    name: effect.name,
    family: effect.family || (effect.id === 'midnights-malady' ? 'ring' : 'unknown'),
    classification: effect.classification || (effect.id === 'midnights-malady' ? 'enemy-debuff' : 'unknown'),
    description: effect.description || 'Helps the party deal more damage to the target.',
    duration: Number.isFinite(Number(effect.duration)) && Number(effect.duration) > 0 ? Number(effect.duration) : null,
    refreshes: Boolean(effect.refreshes),
    effectScope: effect.effectScope || 'all',
    changes: (effect.changes || []).map(change => ({ ...change })),
    source: effect.source || null,
    sourceType: sourceType(effect),
    sourceName: sourceName(effect)
  };
}

function applicationKey(application) {
  const source = application.sourceRef || application.sourceName;
  const tick = Math.round(number(application.time) * 20);
  return `${application.effectId}|${application.targetRef}|${source}|${tick}`;
}

function applicationPriority(method) {
  if (method === 'explicit-status') return 3;
  if (method === 'stat-modifier') return 3;
  if (method === 'power-hit') return 2;
  if (method === 'power-cast') return 1;
  return 0;
}

function registerApplication(map, application) {
  if (!application.effectId || !application.targetRef || !Number.isFinite(Number(application.time))) return;
  const key = applicationKey(application);
  const existing = map.get(key);
  if (!existing || applicationPriority(application.method) > applicationPriority(existing.method)) map.set(key, application);
}

function applicationsFromCombat(combat, map, definitions) {
  const candidates = [
    ...(combat?.debuffsOnEnemies || []),
    ...(combat?.targetAdvantageEffects || [])
  ].filter(isTeamEffect);
  for (const effect of candidates) {
    const meta = definitionMeta(effect);
    definitions.set(meta.id, meta);
    for (const event of effect.timeline || []) {
      registerApplication(map, {
        effectId: meta.id,
        effectName: meta.name,
        time: number(event.time),
        targetRef: text(event.targetRef),
        targetName: text(event.targetName) || text(event.targetRef),
        sourceRef: text(event.sourceRef),
        sourceName: text(event.sourceName) || 'Source not recorded',
        method: 'explicit-status',
        lineNo: null,
        postHit: false
      });
    }
  }
}

function inferredApplications(rows, map, definitions) {
  for (const row of rows || []) {
    if (!row || !isCreatureRef(row.targetRef) || !isPlayerRef(row.ownerRef) || row.companion) continue;
    if ((row.flags & FLAG.IMMUNE) !== 0) continue;
    if (row.kind !== 'damage' || number(row.amount) <= 0) continue;
    const definition = catalogDefinition(row.powerName);
    if (!definition || !isTeamDamageSupportEffect(definition)) continue;
    if (!['class-power', 'class-feat', 'class-effect'].includes(definition.family)) continue;
    const meta = definitionMeta(definition);
    definitions.set(meta.id, meta);
    registerApplication(map, {
      effectId: meta.id,
      effectName: meta.name,
      time: number(row.time),
      targetRef: text(row.targetRef),
      targetName: text(row.targetName) || text(row.targetRef),
      sourceRef: text(row.ownerRef),
      sourceName: text(row.ownerName) || 'Unknown player',
      method: 'power-hit',
      lineNo: Number.isFinite(Number(row.lineNo)) ? Number(row.lineNo) : null,
      postHit: true
    });
  }
}

function groupApplications(applications, definitions) {
  const groups = new Map();
  for (const application of applications) {
    const definition = definitions.get(application.effectId);
    if (!definition) continue;
    let group = groups.get(application.effectId);
    if (!group) {
      group = { definition, applications: [], sources: new Map(), targets: new Map() };
      groups.set(application.effectId, group);
    }
    group.applications.push(application);
    const sourceKey = application.sourceRef || application.sourceName;
    const source = group.sources.get(sourceKey) || { ref: application.sourceRef, name: application.sourceName, applications: 0 };
    source.applications += 1;
    group.sources.set(sourceKey, source);
    const targetKey = application.targetRef;
    const target = group.targets.get(targetKey) || { ref: application.targetRef, name: application.targetName, applications: 0 };
    target.applications += 1;
    group.targets.set(targetKey, target);
  }
  return groups;
}

function shadowUnionSeconds(times, duration, scopeStart, scopeEnd) {
  const ordered = times.slice().sort((a, b) => a - b);
  if (!ordered.length || !duration) return 0;
  const clippedSeconds = (start, end) => Math.max(0, Math.min(scopeEnd, end) - Math.max(scopeStart, start));
  let start = ordered[0];
  let end = ordered[0] + duration;
  let seconds = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const time = ordered[index];
    if (time > end) {
      seconds += clippedSeconds(start, end);
      start = time;
      end = time + duration;
    } else {
      end = Math.max(end, time + duration);
    }
  }
  return seconds + clippedSeconds(start, end);
}

function activeWindowsForTarget(rows, targetRef) {
  return buildActiveWindows((rows || []).filter(row => row?.targetRef === targetRef));
}

function buildIntervals(groups, rows, scopeStart, scopeEnd) {
  const byEffect = new Map();
  const allIntervals = [];
  const mismatches = [];
  for (const [effectId, group] of groups) {
    const duration = group.definition.duration;
    const targets = new Map();
    if (duration) {
      for (const application of group.applications) {
        const start = Math.max(scopeStart, number(application.time) + (application.postHit ? EPSILON : 0));
        const end = Math.min(scopeEnd, start + duration);
        if (end <= start) continue;
        const list = targets.get(application.targetRef) || [];
        list.push({
          effectId,
          start,
          end,
          targetRef: application.targetRef,
          targetName: application.targetName,
          sourceRefs: application.sourceRef ? [application.sourceRef] : [],
          sourceNames: application.sourceName ? [application.sourceName] : []
        });
        targets.set(application.targetRef, list);
      }
    }
    const compactTargets = [];
    for (const [targetRef, intervals] of targets) {
      const merged = mergeIntervals(intervals);
      const rawSeconds = intervalSeconds(merged);
      const shadow = shadowUnionSeconds(
        group.applications.filter(item => item.targetRef === targetRef).map(item => number(item.time) + (item.postHit ? EPSILON : 0)),
        duration,
        scopeStart,
        scopeEnd
      );
      const independentMatch = Math.abs(rawSeconds - shadow) <= 1e-5;
      if (!independentMatch) mismatches.push(`${group.definition.name} interval reconstruction on ${targetRef}`);
      const activeWindows = activeWindowsForTarget(rows, targetRef);
      const clipped = intersectIntervals(merged, activeWindows);
      const activeTime = intervalSeconds(activeWindows);
      const seconds = intervalSeconds(clipped);
      compactTargets.push({
        ref: targetRef,
        name: group.targets.get(targetRef)?.name || targetRef,
        applications: group.targets.get(targetRef)?.applications || 0,
        intervals: merged,
        activeTime,
        seconds,
        uptime: activeTime > 0 ? seconds / activeTime * 100 : null,
        verified: independentMatch
      });
      allIntervals.push(...merged);
    }
    byEffect.set(effectId, compactTargets);
  }
  return { byEffect, allIntervals, mismatches };
}

function internStates(allIntervals, scopeStart, scopeEnd) {
  const states = [{ id: 0, effectIds: [], count: 0 }];
  const stateIds = new Map([['', 0]]);
  const byTarget = new Map();
  for (const interval of allIntervals) {
    const list = byTarget.get(interval.targetRef) || [];
    list.push({ time: interval.start, type: 1, effectId: interval.effectId });
    list.push({ time: interval.end, type: -1, effectId: interval.effectId });
    byTarget.set(interval.targetRef, list);
  }
  const segmentsByTarget = new Map();
  const intern = active => {
    const effectIds = Array.from(active).sort();
    const key = effectIds.join('|');
    if (stateIds.has(key)) return stateIds.get(key);
    const id = states.length;
    states.push({ id, effectIds, count: effectIds.length });
    stateIds.set(key, id);
    return id;
  };
  for (const [targetRef, events] of byTarget) {
    events.sort((a, b) => a.time - b.time || a.type - b.type || a.effectId.localeCompare(b.effectId));
    const active = new Set();
    const segments = [];
    let cursor = scopeStart;
    let index = 0;
    while (index < events.length) {
      const time = Math.max(scopeStart, Math.min(scopeEnd, events[index].time));
      if (time > cursor) segments.push({ start: cursor, end: time, stateId: intern(active) });
      while (index < events.length && Math.abs(events[index].time - time) <= EPSILON && events[index].type < 0) {
        active.delete(events[index].effectId);
        index += 1;
      }
      while (index < events.length && Math.abs(events[index].time - time) <= EPSILON && events[index].type > 0) {
        active.add(events[index].effectId);
        index += 1;
      }
      cursor = time;
    }
    if (cursor < scopeEnd) segments.push({ start: cursor, end: scopeEnd, stateId: intern(active) });
    segmentsByTarget.set(targetRef, segments);
  }
  return { states, segmentsByTarget };
}

function stateAt(segments, time) {
  if (!segments?.length) return 0;
  let lo = 0;
  let hi = segments.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (segments[mid].end <= time) lo = mid + 1;
    else hi = mid;
  }
  const segment = segments[lo];
  return segment && segment.start <= time && time < segment.end ? segment.stateId : 0;
}

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

function isObservationRow(row) {
  if (!row || row.kind !== 'damage' || number(row.amount) <= 0 || number(row.baseAmount) <= 0) return false;
  if (!isPlayerRef(row.ownerRef) || !isCreatureRef(row.targetRef) || row.companion) return false;
  if ((row.flags & (FLAG.IMMUNE | FLAG.SHOW_POWER_DISPLAY_NAME)) !== 0) return false;
  const ratio = number(row.amount) / number(row.baseAmount);
  return Number.isFinite(ratio) && ratio > 0 && ratio < 50;
}

function createObservation(row, stateId) {
  const flags = hitFlags(row);
  return {
    time: number(row.time),
    lineNo: number(row.lineNo),
    ownerRef: text(row.ownerRef),
    ownerName: text(row.ownerName),
    targetRef: text(row.targetRef),
    powerName: text(row.powerName),
    damageType: normalize(row.damageType),
    amount: number(row.amount),
    baseAmount: number(row.baseAmount),
    rawBaseRatio: number(row.amount) / number(row.baseAmount),
    flags,
    stateId,
    key: baselineKey(row, flags, false),
    relaxedKey: baselineKey(row, flags, true)
  };
}

function buildBaselineBank(rows, stateModel) {
  const observations = [];
  const exact = new Map();
  const relaxed = new Map();
  for (const row of rows || []) {
    if (!isObservationRow(row)) continue;
    const segments = stateModel.segmentsByTarget.get(text(row.targetRef));
    const stateId = stateAt(segments, number(row.time));
    const observation = createObservation(row, stateId);
    observations.push(observation);
    if (stateId !== 0) continue;
    const exactList = exact.get(observation.key) || [];
    exactList.push(observation.rawBaseRatio);
    exact.set(observation.key, exactList);
    const relaxedList = relaxed.get(observation.relaxedKey) || [];
    relaxedList.push(observation.rawBaseRatio);
    relaxed.set(observation.relaxedKey, relaxedList);
  }
  const summarize = map => new Map(Array.from(map.entries()).map(([key, values]) => [key, {
    samples: values.length,
    median: median(values),
    p10: quantile(values, .10),
    p90: quantile(values, .90)
  }]));
  return { observations, exact: summarize(exact), relaxed: summarize(relaxed) };
}

function lookupBaseline(bank, observation) {
  const exact = bank.exact.get(observation.key);
  if (exact?.samples >= MIN_BASELINE_SAMPLES) return { ...exact, level: 'exact' };
  const relaxed = bank.relaxed.get(observation.relaxedKey);
  if (relaxed?.samples >= MIN_BASELINE_SAMPLES) return { ...relaxed, level: 'relaxed' };
  return null;
}

function measurementMode(definition) {
  if (definition.classification === 'target-advantage') return 'combat-advantage-state';
  const stats = new Set((definition.changes || []).map(change => change.stat));
  if (stats.has('Damage Taken') || stats.has('Defense') || stats.has('Awareness')) return 'damage-baseline';
  if (stats.has('Critical Avoidance')) return 'critical-rate';
  if (stats.has('Deflect')) return 'deflect-rate';
  return 'timeline-evidence';
}

function observationApplies(definition, observation) {
  const scope = definition.effectScope || 'all';
  if (scope === 'all') return true;
  const damageType = observation.damageType;
  if (scope === 'physical') return damageType === 'physical';
  if (scope === 'physical-projectile') return damageType === 'physical';
  if (scope === 'magical-projectile') return damageType !== 'physical';
  if (scope === 'dragons') return false;
  return true;
}

function verifyEffectWithDamage(definition, targets, bank) {
  const mode = measurementMode(definition);
  const intervals = targets.flatMap(target => target.intervals.map(interval => ({ ...interval, targetRef: target.ref })));
  if (!definition.duration || !intervals.length) {
    return { status: 'not-timed', mode, comparableHits: 0, players: 0, observableCoverage: 0, directionAgreement: null, medianUplift: null };
  }
  if (mode !== 'damage-baseline') {
    return { status: 'evidence-only', mode, comparableHits: 0, players: 0, observableCoverage: 0, directionAgreement: null, medianUplift: null };
  }
  const uplifts = [];
  const players = new Set();
  const observedSeconds = new Set();
  let baselineSamples = 0;
  for (const observation of bank.observations) {
    if (!observationApplies(definition, observation)) continue;
    const interval = intervals.find(item => item.targetRef === observation.targetRef && observation.time >= item.start && observation.time < item.end);
    if (!interval) continue;
    const baseline = lookupBaseline(bank, observation);
    if (!baseline || !baseline.median) continue;
    baselineSamples += baseline.samples;
    const uplift = observation.rawBaseRatio / baseline.median - 1;
    if (!Number.isFinite(uplift)) continue;
    uplifts.push(uplift);
    players.add(observation.ownerRef);
    observedSeconds.add(`${observation.targetRef}|${Math.floor(observation.time)}`);
  }
  const comparableHits = uplifts.length;
  const totalSeconds = Math.max(1, Math.ceil(intervalSeconds(intervals)));
  const observableCoverage = Math.min(1, observedSeconds.size / totalSeconds);
  if (!comparableHits) {
    return { status: 'no-baseline', mode, comparableHits: 0, players: 0, observableCoverage, directionAgreement: null, medianUplift: null, baselineSamples: 0 };
  }
  const directionAgreement = uplifts.filter(value => value > EXPLAINED_UPLIFT).length / comparableHits;
  const medianUplift = median(uplifts);
  let status = 'limited';
  if (comparableHits >= 12 && players.size >= 2 && directionAgreement >= .65) status = 'matched';
  else if (comparableHits >= MIN_EFFECT_SAMPLES && directionAgreement >= .60) status = 'supported';
  else if (comparableHits >= 8 && directionAgreement < .45) status = 'mismatch';
  return {
    status,
    mode,
    comparableHits,
    players: players.size,
    observableCoverage,
    directionAgreement,
    medianUplift,
    p25Uplift: quantile(uplifts, .25),
    p75Uplift: quantile(uplifts, .75),
    baselineSamples
  };
}

function effectConfidence(timelineVerified, empirical) {
  if (!timelineVerified || empirical.status === 'mismatch') return 'UNRESOLVED';
  if (empirical.status === 'matched') return 'VERIFIED';
  if (empirical.status === 'supported' || empirical.status === 'evidence-only') return 'HIGH';
  return 'MEDIUM';
}

function teamWindows(effects, scopeStart, scopeEnd) {
  const events = [];
  for (const effect of effects) {
    for (const target of effect.targets || []) {
      for (const interval of target.intervals || []) {
        events.push({ start: interval.start, end: interval.end, effectId: effect.id, name: effect.name });
      }
    }
  }
  const boundaries = [];
  for (const item of events) {
    boundaries.push({ time: item.start, type: 1, item });
    boundaries.push({ time: item.end, type: -1, item });
  }
  boundaries.sort((a, b) => a.time - b.time || a.type - b.type);
  const windows = [];
  const active = new Map();
  let cursor = scopeStart;
  let index = 0;
  while (index < boundaries.length) {
    const time = Math.max(scopeStart, Math.min(scopeEnd, boundaries[index].time));
    if (time > cursor && active.size) {
      windows.push({
        start: cursor - scopeStart,
        end: time - scopeStart,
        effectIds: Array.from(new Set(Array.from(active.values()).map(value => value.effectId))).sort(),
        names: Array.from(new Set(Array.from(active.values()).map(value => value.name))).sort()
      });
    }
    while (index < boundaries.length && Math.abs(boundaries[index].time - time) <= EPSILON && boundaries[index].type < 0) {
      active.delete(`${boundaries[index].item.effectId}|${boundaries[index].item.start}|${boundaries[index].item.end}`);
      index += 1;
    }
    while (index < boundaries.length && Math.abs(boundaries[index].time - time) <= EPSILON && boundaries[index].type > 0) {
      const item = boundaries[index].item;
      active.set(`${item.effectId}|${item.start}|${item.end}`, item);
      index += 1;
    }
    cursor = time;
  }
  return windows;
}

function findUnexplainedWindows(bank, stateModel, scopeStart, scopeEnd) {
  const buckets = new Map();
  for (const observation of bank.observations) {
    if (observation.stateId !== 0) continue;
    const baseline = lookupBaseline(bank, observation);
    if (!baseline?.median) continue;
    const uplift = observation.rawBaseRatio / baseline.median - 1;
    if (!Number.isFinite(uplift)) continue;
    const second = Math.floor(observation.time - scopeStart);
    if (second < 0 || scopeStart + second > scopeEnd) continue;
    const bucket = buckets.get(second) || { second, uplifts: [], players: new Set(), hits: 0 };
    bucket.uplifts.push(uplift);
    bucket.players.add(observation.ownerRef);
    bucket.hits += 1;
    buckets.set(second, bucket);
  }
  const candidates = Array.from(buckets.values())
    .map(bucket => ({
      second: bucket.second,
      hits: bucket.hits,
      players: bucket.players.size,
      medianUplift: median(bucket.uplifts),
      agreement: bucket.uplifts.filter(value => value >= UNEXPLAINED_UPLIFT).length / Math.max(1, bucket.uplifts.length)
    }))
    .filter(bucket => bucket.hits >= 6 && bucket.players >= 2 && bucket.medianUplift >= UNEXPLAINED_UPLIFT && bucket.agreement >= .75)
    .sort((a, b) => a.second - b.second);
  const windows = [];
  for (const candidate of candidates) {
    const previous = windows.at(-1);
    if (previous && candidate.second <= previous.endSecond + 1) {
      previous.endSecond = candidate.second;
      previous.hits += candidate.hits;
      previous.players = Math.max(previous.players, candidate.players);
      previous.uplifts.push(candidate.medianUplift);
      continue;
    }
    windows.push({ startSecond: candidate.second, endSecond: candidate.second, hits: candidate.hits, players: candidate.players, uplifts: [candidate.medianUplift] });
  }
  return windows.map(window => ({
    start: window.startSecond,
    end: Math.min(scopeEnd - scopeStart, window.endSecond + 1),
    hits: window.hits,
    players: window.players,
    medianUplift: median(window.uplifts),
    status: 'UNRESOLVED'
  }));
}

function compactEffect(group, targets, empirical, timelineVerified) {
  const definition = group.definition;
  const applications = group.applications.slice().sort((a, b) => a.time - b.time || (a.lineNo || 0) - (b.lineNo || 0));
  const confidence = effectConfidence(timelineVerified, empirical);
  return {
    ...definition,
    applications: applications.length,
    timeline: applications.map(item => ({
      time: item.time,
      sourceRef: item.sourceRef,
      sourceName: item.sourceName,
      targetRef: item.targetRef,
      targetName: item.targetName,
      method: item.method,
      lineNo: item.lineNo
    })),
    sources: Array.from(group.sources.values()).sort((a, b) => b.applications - a.applications || a.name.localeCompare(b.name)),
    targets: targets.map(target => ({ ...target })),
    verification: {
      timelineVerified,
      empirical,
      confidence,
      publishUptime: timelineVerified && empirical.status !== 'mismatch'
    }
  };
}

export function analyzeEffectIntelligence(rows, options = {}) {
  const source = Array.isArray(rows) ? rows : Array.from(rows || []);
  let observedStart = Infinity;
  let observedEnd = -Infinity;
  for (const row of source) {
    const time = Number(row?.time);
    if (!Number.isFinite(time)) continue;
    if (time < observedStart) observedStart = time;
    if (time > observedEnd) observedEnd = time;
  }
  const scopeStart = Number.isFinite(Number(options.scopeStart)) ? Number(options.scopeStart) : (Number.isFinite(observedStart) ? observedStart : 0);
  const scopeEnd = Number.isFinite(Number(options.scopeEnd)) ? Number(options.scopeEnd) : (Number.isFinite(observedEnd) ? observedEnd : scopeStart);
  const combat = analyzeCombatEffects(source);
  const bossRows = source.filter(row => isBossRef(row?.targetRef));
  const boss = bossRows.length ? analyzeBossEffects(bossRows) : null;
  const applications = new Map();
  const definitions = new Map();
  applicationsFromCombat(combat, applications, definitions);
  inferredApplications(source, applications, definitions);
  const orderedApplications = Array.from(applications.values()).sort((a, b) => a.time - b.time || (a.lineNo || 0) - (b.lineNo || 0));
  const groups = groupApplications(orderedApplications, definitions);
  const intervalModel = buildIntervals(groups, source, scopeStart, scopeEnd);
  const stateModel = internStates(intervalModel.allIntervals, scopeStart, scopeEnd);
  const baseline = buildBaselineBank(source, stateModel);
  const effects = [];
  for (const [effectId, group] of groups) {
    const targets = intervalModel.byEffect.get(effectId) || [];
    const empirical = verifyEffectWithDamage(group.definition, targets, baseline);
    const timelineVerified = intervalModel.mismatches.every(message => !message.startsWith(group.definition.name));
    effects.push(compactEffect(group, targets, empirical, timelineVerified));
  }
  const sourceOrder = { Enhancement: 0, Ring: 1, 'Class power': 2, 'Class effect': 3, Companion: 4, Mount: 5, Artifact: 6, 'Team debuff': 7 };
  effects.sort((a, b) => (sourceOrder[a.sourceType] ?? 20) - (sourceOrder[b.sourceType] ?? 20) || a.name.localeCompare(b.name));
  const deterministicOk = Boolean(combat.verification?.ok) && (!boss || boss.verification?.ok) && intervalModel.mismatches.length === 0;
  const empiricalMismatches = effects.filter(effect => effect.verification.empirical.status === 'mismatch').map(effect => effect.name);
  const unexplainedAmplification = findUnexplainedWindows(baseline, stateModel, scopeStart, scopeEnd);
  const timingApplications = effects.flatMap(effect => effect.timeline.map(item => ({
    time: Math.max(0, item.time - scopeStart),
    name: effect.name,
    effectId: effect.id,
    sourceRef: item.sourceRef,
    sourceName: item.sourceName,
    targetRef: item.targetRef,
    method: item.method
  }))).sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
  const baselineBuckets = Array.from(baseline.exact.values()).filter(item => item.samples >= MIN_BASELINE_SAMPLES).length;
  return {
    version: 1,
    scope: {
      ...(options.scope || {}),
      start: scopeStart,
      end: scopeEnd,
      duration: Math.max(0, scopeEnd - scopeStart)
    },
    teamEffects: effects,
    timing: {
      windows: teamWindows(effects.filter(effect => effect.verification.publishUptime), scopeStart, scopeEnd),
      applications: timingApplications
    },
    states: {
      definitions: stateModel.states,
      targets: Array.from(stateModel.segmentsByTarget.entries()).map(([targetRef, segments]) => ({ targetRef, segments }))
    },
    baseline: {
      observations: baseline.observations.length,
      cleanObservations: baseline.observations.filter(item => item.stateId === 0).length,
      comparableBuckets: baselineBuckets,
      note: 'Damage verification compares amount/baseAmount against matched clean samples; it does not replace known game-rule timing.'
    },
    unexplainedAmplification,
    summary: {
      teamEffects: effects.length,
      timedEffects: effects.filter(effect => effect.duration).length,
      verifiedEffects: effects.filter(effect => effect.verification.confidence === 'VERIFIED').length,
      unresolvedEffects: effects.filter(effect => effect.verification.confidence === 'UNRESOLVED').length,
      applications: effects.reduce((sum, effect) => sum + effect.applications, 0),
      effectStates: stateModel.states.length,
      baselineBuckets,
      unexplainedWindows: unexplainedAmplification.length
    },
    verification: {
      ok: deterministicOk,
      status: deterministicOk ? (empiricalMismatches.length ? 'attention' : 'verified') : 'blocked',
      deterministic: {
        combatEffects: combat.verification?.status || 'unavailable',
        bossEffects: boss?.verification?.status || 'not-applicable',
        intervalReconstruction: intervalModel.mismatches.length ? 'blocked' : 'verified'
      },
      empiricalMismatches,
      intervalMismatches: intervalModel.mismatches,
      confidence: empiricalMismatches.length ? 'REVIEW' : 'VERIFIED'
    }
  };
}
