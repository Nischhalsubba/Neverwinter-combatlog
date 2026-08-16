import { FLAG, isPlayerRef } from './fast-parser-core.js';

export const NW_HUB_CAPTURED_PROFILE = Object.freeze({
  id: 'nw-hub-captured-2026-08-13-v1',
  source: 'NW-Hub Combat Log Parser',
  encounterGapSeconds: 10,
  minimumPersonalDurationSeconds: 0.001,
  evidence: 'Calibrated against a saved NW-Hub Party Overview and Damage Out capture for combatlog_2026-08-13_00-00-00.log.'
});

function isOutgoingPositivePhysical(row) {
  return Boolean(
    row &&
    isPlayerRef(row.ownerRef) &&
    Number(row.amount) > 0 &&
    String(row.damageType || '').trim().toLowerCase() === 'physical' &&
    (Number(row.flags) & FLAG.SHOW_POWER_DISPLAY_NAME) === 0
  );
}

function isCanonicalPlayerDamage(row) {
  return Boolean(row?.validDamage && isPlayerRef(row.ownerRef) && Number(row.amount) > 0);
}

function clusterTimes(rows, gapSeconds = NW_HUB_CAPTURED_PROFILE.encounterGapSeconds) {
  const source = rows
    .filter(isOutgoingPositivePhysical)
    .map(row => Number(row.time))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!source.length) return [];

  const windows = [];
  let start = source[0];
  let end = source[0];
  for (let index = 1; index < source.length; index += 1) {
    const time = source[index];
    if (time - end <= gapSeconds) {
      end = Math.max(end, time);
      continue;
    }
    windows.push({ start, end, duration: Math.max(0, end - start) });
    start = time;
    end = time;
  }
  windows.push({ start, end, duration: Math.max(0, end - start) });
  return windows;
}

function participated(window, times) {
  for (const time of times) {
    if (time < window.start) continue;
    if (time > window.end) break;
    return true;
  }
  return false;
}

export function buildNwHubCompatibility(rows = [], players = []) {
  const windows = clusterTimes(rows);
  const damageTimes = new Map();
  for (const row of rows) {
    if (!isCanonicalPlayerDamage(row)) continue;
    let times = damageTimes.get(row.ownerRef);
    if (!times) damageTimes.set(row.ownerRef, times = []);
    times.push(Number(row.time) || 0);
  }
  for (const times of damageTimes.values()) times.sort((a, b) => a - b);

  const compatiblePlayers = players.map(player => {
    const times = damageTimes.get(player.ref) || [];
    const combatTime = windows.reduce((sum, window) => sum + (participated(window, times) ? window.duration : 0), 0);
    const personalDuration = Math.max(0, Number(player.duration) || 0);
    const damage = Number(player.damage) || 0;
    return {
      ref: player.ref,
      name: player.name,
      damage,
      hits: Number(player.hits) || 0,
      duration: personalDuration,
      dps: damage / Math.max(NW_HUB_CAPTURED_PROFILE.minimumPersonalDurationSeconds, personalDuration),
      combatTime,
      combatDps: damage / Math.max(NW_HUB_CAPTURED_PROFILE.minimumPersonalDurationSeconds, combatTime),
      participatedEncounters: windows.filter(window => participated(window, times)).length
    };
  });

  return {
    profile: NW_HUB_CAPTURED_PROFILE,
    encounters: windows,
    encounterCount: windows.length,
    encounterTime: windows.reduce((sum, window) => sum + window.duration, 0),
    players: compatiblePlayers
  };
}

export function formatNwHubNumber(value) {
  const number = Number(value) || 0;
  const absolute = Math.abs(number);
  const signed = divisor => (number / divisor).toFixed(1);
  if (absolute >= 1e9) return `${signed(1e9)}B`;
  if (absolute >= 1e6) return `${signed(1e6)}M`;
  if (absolute >= 1e3) return `${signed(1e3)}K`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(number);
}

export function formatNwHubDuration(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
