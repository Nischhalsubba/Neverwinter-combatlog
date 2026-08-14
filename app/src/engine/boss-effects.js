const ACTIVE_GAP_SECONDS = 5;

export const BOSS_EFFECT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'midnights-malady',
    name: "Midnight's Malady",
    duration: 5,
    audience: 'team',
    type: 'Team debuff',
    description: 'Defense and Awareness reduced by 3.5%',
    match(row) {
      if (row?.powerName !== "Midnight's Malady") return false;
      if (!hasDisplayFlag(row)) return false;
      return row.damageType === 'DamageSetAll' || row.damageType === 'Abs_Awareness';
    }
  }),
  Object.freeze({
    id: 'blood-lust',
    name: 'Blood Lust',
    duration: 10,
    audience: 'personal',
    type: 'Personal debuff',
    description: 'Target takes more damage from the player who applied it',
    match(row) {
      if (row?.powerName !== 'Blood Lust' || !isPlayerRef(row?.ownerRef) || !hasDisplayFlag(row)) return false;
      return row.damageType === 'Physical' && Number(row.amount) > 0 && Number(row.amount) <= 0.1;
    }
  })
]);

const DEFINITION_BY_NAME = new Map(BOSS_EFFECT_DEFINITIONS.map(definition => [definition.name, definition]));

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function isPlayerRef(value) {
  return text(value).startsWith('P[');
}

function hasDisplayFlag(row) {
  return /(?:^|\|)ShowPowerDisplayName(?:\||$)/i.test(text(row?.flagsRaw));
}

function isImmune(row) {
  return /(?:^|\|)Immune(?:\||$)/i.test(text(row?.flagsRaw));
}

function isCandidateSignal(row) {
  if (!row || isImmune(row) || !hasDisplayFlag(row) || !row.powerName || !row.targetRef) return false;
  if (DEFINITION_BY_NAME.has(row.powerName)) return true;
  if (!isPlayerRef(row.ownerRef)) return false;
  const type = text(row.damageType).toLowerCase();
  const amount = Math.abs(number(row.amount));
  if (type === 'null' || type === 'applypower') return true;
  if (type.startsWith('abs_') || type.includes('damageset')) return true;
  return amount > 0 && amount <= 1;
}

function orderedTimes(values) {
  return values
    .map(value => Number(value))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function buildActiveWindows(rows, gapSeconds = ACTIVE_GAP_SECONDS) {
  const times = orderedTimes((rows || []).filter(row => row?.validDamage).map(row => row.time));
  if (!times.length) return [];
  const windows = [];
  let current = { start: times[0], end: times[0] };
  for (let index = 1; index < times.length; index += 1) {
    const time = times[index];
    if (time - current.end > gapSeconds) {
      windows.push(current);
      current = { start: time, end: time };
    } else {
      current.end = Math.max(current.end, time);
    }
  }
  windows.push(current);
  return windows;
}

function totalWindowTime(windows) {
  return (windows || []).reduce((sum, window) => sum + Math.max(0, number(window.end) - number(window.start)), 0);
}

function mergeIntervals(intervals) {
  const ordered = (intervals || [])
    .map(interval => ({ start: number(interval.start), end: number(interval.end) }))
    .filter(interval => interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) merged.push({ ...interval });
    else previous.end = Math.max(previous.end, interval.end);
  }
  return merged;
}

function intersectIntervals(intervals, windows) {
  const result = [];
  const source = mergeIntervals(intervals);
  const active = mergeIntervals(windows);
  let left = 0;
  let right = 0;
  while (left < source.length && right < active.length) {
    const start = Math.max(source[left].start, active[right].start);
    const end = Math.min(source[left].end, active[right].end);
    if (end > start) result.push({ start, end });
    if (source[left].end < active[right].end) left += 1;
    else right += 1;
  }
  return mergeIntervals(result);
}

function intervalTime(intervals) {
  return (intervals || []).reduce((sum, interval) => sum + Math.max(0, interval.end - interval.start), 0);
}

function sourceIdentity(row) {
  const ref = text(row?.ownerRef);
  const name = text(row?.ownerName);
  return { ref, name: name || (ref ? 'Unknown player' : 'Source not recorded') };
}

function applicationKey(definition, row) {
  const target = text(row.targetRef);
  const source = definition.audience === 'personal' ? text(row.ownerRef) : '';
  const tick = Math.round(number(row.time) * 20);
  return `${definition.id}|${target}|${source}|${tick}`;
}

function collectPrimary(rows) {
  const effects = new Map();
  const unknown = new Map();
  const seen = new Set();

  for (const row of rows || []) {
    if (!isCandidateSignal(row)) continue;
    const definition = DEFINITION_BY_NAME.get(row.powerName);
    if (!definition || !definition.match(row)) {
      if (!definition) {
        const key = text(row.powerName) || 'Unknown signal';
        const item = unknown.get(key) || { name: key, applications: 0, sources: new Set() };
        item.applications += 1;
        const source = sourceIdentity(row);
        if (source.ref || source.name !== 'Source not recorded') item.sources.add(source.name);
        unknown.set(key, item);
      }
      continue;
    }

    const key = applicationKey(definition, row);
    if (seen.has(key)) continue;
    seen.add(key);
    let effect = effects.get(definition.id);
    if (!effect) {
      effect = { definition, applications: [], bySource: new Map() };
      effects.set(definition.id, effect);
    }
    const source = sourceIdentity(row);
    const application = { time: number(row.time), sourceRef: source.ref, sourceName: source.name };
    effect.applications.push(application);
    const sourceKey = source.ref || source.name;
    let sourceGroup = effect.bySource.get(sourceKey);
    if (!sourceGroup) {
      sourceGroup = { ref: source.ref, name: source.name, applications: [] };
      effect.bySource.set(sourceKey, sourceGroup);
    }
    sourceGroup.applications.push(application);
  }

  return { effects, unknown };
}

function coverage(applications, duration, activeWindows, activeTime) {
  const intervals = applications.map(application => ({ start: application.time, end: application.time + duration }));
  const clipped = intersectIntervals(intervals, activeWindows);
  const seconds = intervalTime(clipped);
  return { seconds, uptime: activeTime > 0 ? seconds / activeTime * 100 : 0, intervals: clipped };
}

function compactPrimary(collected, activeWindows) {
  const activeTime = totalWindowTime(activeWindows);
  const effects = Array.from(collected.effects.values()).map(effect => {
    const definition = effect.definition;
    const bySource = Array.from(effect.bySource.values()).map(source => {
      const result = coverage(source.applications, definition.duration, activeWindows, activeTime);
      return { ref: source.ref, name: source.name, applications: source.applications.length, seconds: result.seconds, uptime: result.uptime };
    }).sort((a, b) => b.uptime - a.uptime || b.applications - a.applications || a.name.localeCompare(b.name));
    const teamCoverage = definition.audience === 'team'
      ? coverage(effect.applications, definition.duration, activeWindows, activeTime)
      : null;
    return {
      id: definition.id,
      name: definition.name,
      type: definition.type,
      audience: definition.audience,
      description: definition.description,
      duration: definition.duration,
      applications: effect.applications.length,
      seconds: teamCoverage?.seconds ?? null,
      uptime: teamCoverage?.uptime ?? null,
      sources: bySource
    };
  }).sort((a, b) => (a.audience === b.audience ? a.name.localeCompare(b.name) : a.audience === 'team' ? -1 : 1));

  const otherSignals = Array.from(collected.unknown.values())
    .map(item => ({ name: item.name, applications: item.applications, sources: Array.from(item.sources).sort() }))
    .sort((a, b) => b.applications - a.applications || a.name.localeCompare(b.name))
    .slice(0, 12);

  return { activeTime, activeWindows, effects, otherSignals };
}

function buildShadow(rows) {
  const activeTimes = orderedTimes((rows || []).filter(row => row?.validDamage).map(row => row.time));
  const windows = [];
  let start = null;
  let end = null;
  for (const time of activeTimes) {
    if (start == null) { start = time; end = time; continue; }
    if (time - end > ACTIVE_GAP_SECONDS) {
      windows.push([start, end]);
      start = time;
      end = time;
    } else end = time;
  }
  if (start != null) windows.push([start, end]);
  const activeTime = windows.reduce((sum, pair) => sum + Math.max(0, pair[1] - pair[0]), 0);
  const seen = new Set();
  const events = new Map();

  for (const row of rows || []) {
    const definition = DEFINITION_BY_NAME.get(row?.powerName);
    if (!definition || !definition.match(row) || isImmune(row)) continue;
    const key = applicationKey(definition, row);
    if (seen.has(key)) continue;
    seen.add(key);
    const source = sourceIdentity(row);
    const sourceKey = source.ref || source.name;
    const effect = events.get(definition.id) || { definition, all: [], source: new Map() };
    effect.all.push(number(row.time));
    const list = effect.source.get(sourceKey) || { name: source.name, ref: source.ref, times: [] };
    list.times.push(number(row.time));
    effect.source.set(sourceKey, list);
    events.set(definition.id, effect);
  }

  const calculate = (times, duration) => {
    const raw = times.map(time => [time, time + duration]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const joined = [];
    for (const pair of raw) {
      const previous = joined.at(-1);
      if (!previous || pair[0] > previous[1]) joined.push(pair.slice());
      else previous[1] = Math.max(previous[1], pair[1]);
    }
    let seconds = 0;
    for (const effect of joined) {
      for (const active of windows) {
        const left = Math.max(effect[0], active[0]);
        const right = Math.min(effect[1], active[1]);
        if (right > left) seconds += right - left;
      }
    }
    return seconds;
  };

  const summary = new Map();
  for (const [id, event] of events) {
    const definition = event.definition;
    const sources = new Map();
    for (const [sourceKey, source] of event.source) {
      sources.set(sourceKey, {
        applications: source.times.length,
        seconds: calculate(source.times, definition.duration)
      });
    }
    summary.set(id, {
      applications: event.all.length,
      seconds: definition.audience === 'team' ? calculate(event.all, definition.duration) : null,
      sources
    });
  }
  return { activeTime, summary };
}

function nearlyEqual(left, right, tolerance = 1e-6) {
  return Math.abs(number(left) - number(right)) <= tolerance;
}

function verify(primary, rows) {
  const shadow = buildShadow(rows);
  const mismatches = [];
  if (!nearlyEqual(primary.activeTime, shadow.activeTime)) mismatches.push('boss active time');
  for (const effect of primary.effects) {
    const check = shadow.summary.get(effect.id);
    if (!check) { mismatches.push(`${effect.name} missing in second check`); continue; }
    if (check.applications !== effect.applications) mismatches.push(`${effect.name} application count`);
    if (effect.audience === 'team' && !nearlyEqual(check.seconds, effect.seconds)) mismatches.push(`${effect.name} uptime`);
    for (const source of effect.sources) {
      const key = source.ref || source.name;
      const second = check.sources.get(key);
      if (!second || second.applications !== source.applications || !nearlyEqual(second.seconds, source.seconds)) {
        mismatches.push(`${effect.name} ${source.name} uptime`);
      }
    }
  }
  return {
    ok: mismatches.length === 0,
    status: mismatches.length ? 'blocked' : 'verified',
    checkedEffects: primary.effects.length,
    mismatches
  };
}

export function analyzeBossEffects(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const activeWindows = buildActiveWindows(source);
  const primary = compactPrimary(collectPrimary(source), activeWindows);
  const verification = verify(primary, source);
  return { ...primary, verification };
}
