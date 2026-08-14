import { isBossRef, isCreatureRef, isPlayerRef } from './fast-parser-core.js';
import { BOSS_EFFECT_DEFINITIONS, buildActiveWindows } from './boss-effects.js';

export const COMPANION_DEBUFFS = Object.freeze([
  Object.freeze({ id: 'armor-break', name: 'Armor Break', duration: 15, description: 'Lowers enemy Defense by up to 7.5%.' }),
  Object.freeze({ id: 'dulled-senses', name: 'Dulled Senses', duration: 15, description: 'Lowers enemy Awareness by up to 7.5%.' }),
  Object.freeze({ id: 'vulnerability', name: 'Vulnerability', duration: 15, description: 'Lowers enemy Critical Avoidance by up to 7.5%.' }),
  Object.freeze({ id: 'weapon-break', name: 'Weapon Break', duration: 15, description: 'Lowers enemy Critical Severity by up to 7.5%.' }),
  Object.freeze({ id: 'slowed-reactions', name: 'Slowed Reactions', duration: null, description: 'Lowers enemy Deflect while the effect is active.' })
]);

const COMPANION_BY_NAME = new Map(COMPANION_DEBUFFS.map(effect => [effect.name, effect]));
const BOSS_BY_NAME = new Map(BOSS_EFFECT_DEFINITIONS.map(effect => [effect.name, effect]));

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function hasDisplayFlag(row) {
  return /(?:^|\|)ShowPowerDisplayName(?:\||$)/i.test(text(row?.flagsRaw));
}

function isImmune(row) {
  return /(?:^|\|)Immune(?:\||$)/i.test(text(row?.flagsRaw)) || row?.kind === 'immune';
}

function statusSignature(row) {
  if (!row || !row.powerName || !row.targetRef || row.targetRef === '*' || !hasDisplayFlag(row)) return false;
  const type = text(row.damageType).toLowerCase();
  const amount = Math.abs(number(row.amount));
  if (type === 'null' || type === 'applypower') return true;
  if (type.startsWith('abs_') || type.includes('damageset')) return true;
  if (type.includes('control')) return true;
  return amount > 0 && amount <= 1;
}

function actorIdentity(row) {
  if (row?.ownerRef && row.ownerRef !== '*') return { ref: text(row.ownerRef), name: text(row.ownerName) || 'Unknown source' };
  if (row?.sourceRef && row.sourceRef !== '*') return { ref: text(row.sourceRef), name: text(row.sourceName) || 'Unknown source' };
  const name = text(row?.ownerName) || text(row?.sourceName);
  return { ref: '', name: name || 'Source not recorded' };
}

function targetIdentity(row) {
  const ref = text(row?.targetRef);
  const name = text(row?.targetName) || ref || 'Target not recorded';
  const kind = isPlayerRef(ref) ? 'player' : isBossRef(ref) ? 'boss' : isCreatureRef(ref) ? 'enemy' : 'other';
  return { ref, name, kind };
}

function effectMeta(name) {
  const companion = COMPANION_BY_NAME.get(name);
  if (companion) return { ...companion, family: 'companion', type: 'Known debuff' };
  const boss = BOSS_BY_NAME.get(name);
  if (boss) return { id: boss.id, name: boss.name, duration: boss.duration, description: boss.description, family: 'boss', type: boss.type };
  return { id: '', name, duration: null, description: '', family: 'unknown', type: 'Effect found' };
}

function applicationAllowed(row, meta) {
  if (!statusSignature(row) || isImmune(row)) return false;
  if (meta.family === 'boss') {
    const definition = BOSS_BY_NAME.get(meta.name);
    return Boolean(definition?.match(row));
  }
  return true;
}

function applicationKey(row, direction) {
  const actor = actorIdentity(row);
  const tick = Math.round(number(row.time) * 20);
  return `${direction}|${text(row.powerName)}|${text(row.targetRef)}|${actor.ref || actor.name}|${tick}`;
}

function directionFor(row) {
  if (isPlayerRef(row?.targetRef)) return 'player';
  if (isCreatureRef(row?.targetRef)) return 'enemy';
  return 'other';
}

function pushCount(map, identity) {
  const key = identity.ref || identity.name;
  let item = map.get(key);
  if (!item) {
    item = { ...identity, applications: 0, times: [] };
    map.set(key, item);
  }
  item.applications += 1;
  return item;
}

function collect(rows) {
  const groups = new Map();
  const seen = new Set();
  const immune = new Map();

  for (const row of rows || []) {
    if (!statusSignature(row)) continue;
    const direction = directionFor(row);
    if (direction === 'other') continue;
    const name = text(row.powerName) || 'Unknown effect';
    const meta = effectMeta(name);
    if (isImmune(row)) {
      immune.set(name, (immune.get(name) || 0) + 1);
      continue;
    }
    if (!applicationAllowed(row, meta)) continue;
    const key = applicationKey(row, direction);
    if (seen.has(key)) continue;
    seen.add(key);

    const groupKey = `${direction}|${name}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        direction,
        name,
        meta,
        applications: 0,
        events: [],
        sources: new Map(),
        targets: new Map(),
        damageTypes: new Set()
      };
      groups.set(groupKey, group);
    }

    const source = actorIdentity(row);
    const target = targetIdentity(row);
    const time = number(row.time);
    group.applications += 1;
    group.events.push({ time, sourceRef: source.ref, sourceName: source.name, targetRef: target.ref, targetName: target.name, targetKind: target.kind });
    pushCount(group.sources, source).times.push(time);
    pushCount(group.targets, target).times.push(time);
    if (row.damageType) group.damageTypes.add(text(row.damageType));
  }

  return { groups, immune };
}

function mergeIntervals(intervals) {
  const ordered = intervals
    .map(interval => ({ start: number(interval.start), end: number(interval.end) }))
    .filter(interval => interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const result = [];
  for (const interval of ordered) {
    const previous = result.at(-1);
    if (!previous || interval.start > previous.end) result.push({ ...interval });
    else previous.end = Math.max(previous.end, interval.end);
  }
  return result;
}

function intervalSeconds(intervals) {
  return intervals.reduce((sum, interval) => sum + Math.max(0, interval.end - interval.start), 0);
}

function clipIntervals(intervals, windows) {
  const effects = mergeIntervals(intervals);
  const active = mergeIntervals(windows);
  const clipped = [];
  let left = 0;
  let right = 0;
  while (left < effects.length && right < active.length) {
    const start = Math.max(effects[left].start, active[right].start);
    const end = Math.min(effects[left].end, active[right].end);
    if (end > start) clipped.push({ start, end });
    if (effects[left].end < active[right].end) left += 1;
    else right += 1;
  }
  return mergeIntervals(clipped);
}

function targetWindows(rows, targetRef) {
  return buildActiveWindows((rows || []).filter(row => row?.targetRef === targetRef));
}

function primaryCoverage(times, effectDuration, windows) {
  const activeTime = intervalSeconds(windows);
  const intervals = times.map(time => ({ start: time, end: time + effectDuration }));
  const seconds = intervalSeconds(clipIntervals(intervals, windows));
  return { activeTime, seconds, uptime: activeTime > 0 ? seconds / activeTime * 100 : 0 };
}

function shadowWindows(rows, targetRef, gapSeconds = 5) {
  const times = (rows || [])
    .filter(row => row?.validDamage && row?.targetRef === targetRef)
    .map(row => Number(row.time))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!times.length) return [];
  const windows = [];
  let start = times[0];
  let end = times[0];
  for (let index = 1; index < times.length; index += 1) {
    const time = times[index];
    if (time - end > gapSeconds) {
      windows.push([start, end]);
      start = time;
      end = time;
    } else {
      end = time;
    }
  }
  windows.push([start, end]);
  return windows;
}

function shadowCoverage(times, effectDuration, rows, targetRef) {
  const windows = shadowWindows(rows, targetRef);
  const activeTime = windows.reduce((sum, window) => sum + Math.max(0, window[1] - window[0]), 0);
  const raw = times.map(time => [time, time + effectDuration]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const interval of raw) {
    const previous = merged.at(-1);
    if (!previous || interval[0] > previous[1]) merged.push(interval.slice());
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  let seconds = 0;
  for (const effect of merged) {
    for (const active of windows) {
      const start = Math.max(effect[0], active[0]);
      const end = Math.min(effect[1], active[1]);
      if (end > start) seconds += end - start;
    }
  }
  return { activeTime, seconds, uptime: activeTime > 0 ? seconds / activeTime * 100 : 0 };
}

function nearlyEqual(left, right, tolerance = 1e-6) {
  return Math.abs(number(left) - number(right)) <= tolerance;
}

function timedTargets(group, rows, mismatches) {
  if (group.meta.family !== 'companion' || !Number.isFinite(group.meta.duration) || group.meta.duration <= 0 || group.direction !== 'enemy') return [];
  return Array.from(group.targets.values()).map(target => {
    const primary = primaryCoverage(target.times, group.meta.duration, targetWindows(rows, target.ref));
    const shadow = shadowCoverage(target.times, group.meta.duration, rows, target.ref);
    const ok = nearlyEqual(primary.activeTime, shadow.activeTime) && nearlyEqual(primary.seconds, shadow.seconds) && nearlyEqual(primary.uptime, shadow.uptime);
    if (!ok) mismatches.push(`${group.name} on ${target.name}`);
    return {
      ref: target.ref,
      name: target.name,
      kind: target.kind,
      applications: target.applications,
      activeTime: primary.activeTime,
      seconds: primary.seconds,
      uptime: primary.uptime,
      verified: ok && primary.activeTime > 0
    };
  });
}

function compactGroup(group, rows, mismatches) {
  const targets = Array.from(group.targets.values())
    .map(target => ({ ref: target.ref, name: target.name, kind: target.kind, applications: target.applications }))
    .sort((a, b) => b.applications - a.applications || a.name.localeCompare(b.name));
  const sources = Array.from(group.sources.values())
    .map(source => ({ ref: source.ref, name: source.name, applications: source.applications }))
    .sort((a, b) => b.applications - a.applications || a.name.localeCompare(b.name));
  return {
    direction: group.direction,
    name: group.name,
    id: group.meta.id,
    type: group.meta.type,
    family: group.meta.family,
    description: group.meta.description,
    duration: group.meta.duration,
    applications: group.applications,
    sources,
    targets,
    timedTargets: timedTargets(group, rows, mismatches),
    damageTypes: Array.from(group.damageTypes).sort()
  };
}

export function analyzeCombatEffects(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const collected = collect(source);
  const mismatches = [];
  const effects = Array.from(collected.groups.values())
    .map(group => compactGroup(group, source, mismatches))
    .sort((a, b) => {
      const knownA = a.family === 'unknown' ? 1 : 0;
      const knownB = b.family === 'unknown' ? 1 : 0;
      return knownA - knownB || b.applications - a.applications || a.name.localeCompare(b.name);
    });
  const immuneEffects = Array.from(collected.immune.entries())
    .map(([name, applications]) => ({ name, applications }))
    .sort((a, b) => b.applications - a.applications || a.name.localeCompare(b.name));
  const timed = effects.flatMap(effect => effect.timedTargets);
  return {
    effects,
    onEnemies: effects.filter(effect => effect.direction === 'enemy'),
    onPlayers: effects.filter(effect => effect.direction === 'player'),
    immuneEffects,
    verification: {
      ok: mismatches.length === 0,
      status: mismatches.length ? 'blocked' : 'verified',
      checkedTargets: timed.length,
      mismatches
    }
  };
}
