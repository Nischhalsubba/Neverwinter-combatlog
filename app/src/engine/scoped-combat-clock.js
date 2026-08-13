const DEFAULT_GAP_SECONDS = 5;
const DEFAULT_BOSS_MERGE_GAP_SECONDS = 15;

function ordered(points) {
  return (points || []).slice().sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0) || (Number(a.lineNo) || 0) - (Number(b.lineNo) || 0));
}

function splitWindows(points, gapSeconds) {
  const windows = [];
  let current = null;
  for (const point of ordered(points)) {
    const time = Number(point.time) || 0;
    if (!current || time - current.end > gapSeconds) {
      current = { start: time, end: time, bossIds: new Set() };
      windows.push(current);
    }
    current.end = Math.max(current.end, time);
    if (point.isBoss && point.targetRef) current.bossIds.add(String(point.targetRef));
  }
  return windows;
}

function shareBoss(left, right) {
  for (const id of left.bossIds) if (right.bossIds.has(id)) return true;
  return false;
}

function absorb(target, addition) {
  target.start = Math.min(target.start, addition.start);
  target.end = Math.max(target.end, addition.end);
  for (const id of addition.bossIds) target.bossIds.add(id);
}

function mergeBossPhases(windows, bossMergeGapSeconds) {
  const merged = [];
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    const previous = merged.at(-1);
    if (previous?.bossIds.size && window.bossIds.size && shareBoss(previous, window) && window.start - previous.end <= bossMergeGapSeconds) {
      absorb(previous, window);
      continue;
    }
    if (previous?.bossIds.size && !window.bossIds.size) {
      const next = windows[index + 1];
      if (next?.bossIds.size && shareBoss(previous, next) && window.start - previous.end <= bossMergeGapSeconds && next.start - window.end <= bossMergeGapSeconds) {
        absorb(previous, window);
        absorb(previous, next);
        index += 1;
        continue;
      }
    }
    merged.push({ start: window.start, end: window.end, bossIds: new Set(window.bossIds) });
  }
  return merged;
}

export function summarizeScopedCombat(points, options = {}) {
  const gapSeconds = Number.isFinite(Number(options.gapSeconds)) ? Number(options.gapSeconds) : DEFAULT_GAP_SECONDS;
  const bossMergeGapSeconds = Number.isFinite(Number(options.bossMergeGapSeconds)) ? Number(options.bossMergeGapSeconds) : DEFAULT_BOSS_MERGE_GAP_SECONDS;
  const windows = mergeBossPhases(splitWindows(points, gapSeconds), bossMergeGapSeconds);
  return {
    combatTime: windows.reduce((sum, window) => sum + Math.max(0, window.end - window.start), 0),
    encounters: windows.length
  };
}
