import { activationDedupeSeconds, classifyPowerCategory, inferPlayerClass, isRotationCategory, summarizeCategories } from './power-taxonomy.js';

const VERIFY_DAMAGE_TYPE = 'physical';
const EXPLICIT_NON_DAMAGE_TYPES = new Set(['hitpoints','shield','power','triggercomplex']);
const FLAG_CRITICAL = 1 << 0;
const FLAG_FLANK = 1 << 1;
const FLAG_CA = 1 << 2;
const FLAG_DISPLAY = 1 << 3;
const FLAG_IMMUNE = 1 << 4;
const ENCOUNTER_GAP_SECONDS = 5;
const BOSS_MERGE_GAP_SECONDS = 15;

const text = value => String(value == null ? '' : value).trim();
const isPlayer = value => text(value).startsWith('P[');
const isCreature = value => text(value).startsWith('C[');
const isBoss = value => /_boss(?:\]|$)/i.test(text(value));
const isPet = value => /pet_|companion|appointment|summon/i.test(text(value));

function isCanonicalDamage(row) {
  if (!row || Number(row.amount) <= 0) return false;
  if (text(row.damageType).toLowerCase() !== VERIFY_DAMAGE_TYPE) return false;
  const flagsRaw = text(row.flagsRaw).toLowerCase();
  if ((Number(row.flags) & FLAG_DISPLAY) !== 0 || flagsRaw.includes('showpowerdisplayname')) return false;
  if ((Number(row.flags) & FLAG_IMMUNE) !== 0 || flagsRaw.includes('immune')) return false;
  if (row.targetRef === '*' && !isCreature(row.sourceRef)) return false;
  return true;
}

function isHealing(row) {
  const type = text(row.damageType).toLowerCase();
  return type === 'hitpoints' && Number(row.amount) < 0;
}

function isShield(row) {
  return text(row.damageType).toLowerCase() === 'shield' && Number(row.amount) < 0;
}

function isCompanion(row) {
  return isPet(row.ownerRef) || isPet(row.sourceRef) || /companion|pet|summon|appointment/i.test(`${text(row.ownerName)} ${text(row.sourceName)} ${text(row.powerName)}`);
}

function createPower(power, row) {
  return {
    power,
    powerRef: text(row.powerRef),
    damage: 0,
    hits: 0,
    critHits: 0,
    flankHits: 0,
    maxHit: 0,
    companionDamage: 0
  };
}

function createPlayer(ref, name) {
  return {
    ref,
    name: name || ref,
    damage: 0,
    playerDamage: 0,
    companionDamage: 0,
    hits: 0,
    critHits: 0,
    flankHits: 0,
    maxHit: 0,
    maxPower: '',
    firstDamage: null,
    lastDamage: null,
    healingDone: 0,
    healingReceived: 0,
    damageTaken: 0,
    shielded: 0,
    powers: new Map(),
    timeline: new Map(),
    damageSeries: []
  };
}

function ensurePlayer(players, ref, name) {
  if (!isPlayer(ref)) return null;
  let player = players.get(ref);
  if (!player) {
    player = createPlayer(ref, name);
    players.set(ref, player);
  } else if ((!player.name || player.name === ref) && name) {
    player.name = name;
  }
  return player;
}

function splitWindows(series) {
  if (!series?.length) return [];
  const sorted = series.slice().sort((a, b) => a.time - b.time || a.lineNo - b.lineNo);
  const windows = [];
  let current = null;
  for (const point of sorted) {
    if (!current || point.time - current.end > ENCOUNTER_GAP_SECONDS) {
      current = { start: point.time, end: point.time, bossIds: new Set(), damage: 0, hits: 0 };
      windows.push(current);
    }
    current.end = Math.max(current.end, point.time);
    current.damage += point.amount;
    current.hits += 1;
    if (isBoss(point.targetRef)) current.bossIds.add(point.targetRef);
  }
  return windows;
}

function mergeWindows(series) {
  const source = splitWindows(series).map(window => ({ ...window, bossIds: new Set(window.bossIds) }));
  const merged = [];
  const sameBoss = (a, b) => Array.from(a.bossIds).some(id => b.bossIds.has(id));
  const mergeInto = (target, addition) => {
    target.start = Math.min(target.start, addition.start);
    target.end = Math.max(target.end, addition.end);
    target.damage += addition.damage;
    target.hits += addition.hits;
    for (const id of addition.bossIds) target.bossIds.add(id);
  };

  for (let index = 0; index < source.length; index += 1) {
    const window = source[index];
    const previous = merged.at(-1);
    const windowBoss = window.bossIds.size > 0;
    const previousBoss = previous?.bossIds?.size > 0;
    if (previous && previousBoss && windowBoss && sameBoss(previous, window) && window.start - previous.end <= BOSS_MERGE_GAP_SECONDS) {
      mergeInto(previous, window);
      continue;
    }
    if (previous && previousBoss && !windowBoss) {
      const next = source[index + 1];
      if (next?.bossIds?.size && sameBoss(previous, next) && window.start - previous.end <= BOSS_MERGE_GAP_SECONDS && next.start - window.end <= BOSS_MERGE_GAP_SECONDS) {
        mergeInto(previous, window);
        mergeInto(previous, next);
        index += 1;
        continue;
      }
    }
    merged.push(window);
  }
  return merged;
}

function sumWindowDuration(series) {
  return mergeWindows(series).reduce((sum, window) => sum + Math.max(0, window.end - window.start), 0);
}

function compactPower(power, playerDamage, playerDuration) {
  const category = classifyPowerCategory(power.power, {
    companion: power.companionDamage > 0 && power.companionDamage >= power.damage - 0.001,
    powerRef: power.powerRef
  });
  return {
    power: power.power,
    category,
    damage: power.damage,
    share: playerDamage ? power.damage / playerDamage * 100 : 0,
    hits: power.hits,
    avg: power.hits ? power.damage / power.hits : 0,
    max: power.maxHit,
    crit: power.hits ? power.critHits / power.hits * 100 : 0,
    flank: power.hits ? power.flankHits / power.hits * 100 : 0,
    dps: power.damage / Math.max(1, playerDuration),
    companionDamage: power.companionDamage
  };
}

function finalizePlayer(player, scopeType) {
  const duration = player.firstDamage == null || player.lastDamage == null ? 0 : Math.max(0, player.lastDamage - player.firstDamage);
  const combatTime = scopeType === 'session' ? sumWindowDuration(player.damageSeries) : duration;
  const powers = Array.from(player.powers.values())
    .map(power => compactPower(power, player.damage, duration))
    .sort((a, b) => b.damage - a.damage || a.power.localeCompare(b.power));
  const classInfo = inferPlayerClass(powers);
  return {
    ref: player.ref,
    name: player.name,
    className: classInfo.name,
    classConfidence: classInfo.confidence,
    damage: player.damage,
    playerDamage: player.playerDamage,
    companionDamage: player.companionDamage,
    hits: player.hits,
    dps: player.damage / Math.max(1, duration),
    combatDps: player.damage / Math.max(1, combatTime),
    duration,
    combatTime,
    encounters: scopeType === 'session' ? mergeWindows(player.damageSeries).length : (player.hits ? 1 : 0),
    crit: player.hits ? player.critHits / player.hits * 100 : 0,
    flank: player.hits ? player.flankHits / player.hits * 100 : 0,
    avgHit: player.hits ? player.damage / player.hits : 0,
    maxHit: player.maxHit,
    maxPower: player.maxPower,
    healingDone: player.healingDone,
    healingReceived: player.healingReceived,
    damageTaken: player.damageTaken,
    shielded: player.shielded,
    powers,
    categories: summarizeCategories(powers),
    timeline: Array.from(player.timeline.entries()).map(([second, damage]) => ({ second, damage })).sort((a, b) => a.second - b.second)
  };
}

function suspiciousPositiveType(row) {
  if (!row || Number(row.amount) <= 0 || !isPlayer(row.ownerRef)) return '';
  const type = text(row.damageType).toLowerCase();
  if (!type || type === VERIFY_DAMAGE_TYPE || EXPLICIT_NON_DAMAGE_TYPES.has(type)) return '';
  if ((Number(row.flags) & (FLAG_DISPLAY | FLAG_IMMUNE)) !== 0) return '';
  if (/heal|resource|summon|control/.test(type)) return '';
  return text(row.damageType) || 'Unknown';
}

export function buildShadowReport(rows, context = {}) {
  const scopeType = context.scopeType || 'session';
  const targetOnly = Boolean(context.targetOnly);
  const bossTargets = context.bossTargets instanceof Set ? context.bossTargets : new Set(context.bossTargets || []);
  const players = new Map();
  const partyTimeline = new Map();
  const partySeries = [];
  const suspicious = new Map();
  let damage = 0;
  let hits = 0;
  let healing = 0;
  let shielded = 0;

  for (const row of rows || []) {
    const owner = ensurePlayer(players, row.ownerRef, row.ownerName);
    const target = ensurePlayer(players, row.targetRef, row.targetName);
    const amount = Number(row.amount) || 0;

    if (isHealing(row)) {
      const value = Math.abs(amount);
      healing += value;
      if (owner) owner.healingDone += value;
      if (target) target.healingReceived += value;
    }
    if (isShield(row) && target) {
      const value = Math.abs(amount);
      shielded += value;
      target.shielded += value;
    }
    if (isCanonicalDamage(row) && target) target.damageTaken += amount;

    const suspiciousType = suspiciousPositiveType(row);
    if (suspiciousType) suspicious.set(suspiciousType, (suspicious.get(suspiciousType) || 0) + 1);

    if (!owner || !isCanonicalDamage(row)) continue;
    if (targetOnly && bossTargets.size && !bossTargets.has(row.targetRef)) continue;

    const companion = isCompanion(row);
    const time = Number(row.time) || 0;
    damage += amount;
    hits += 1;
    owner.damage += amount;
    owner.hits += 1;
    if (companion) owner.companionDamage += amount;
    else owner.playerDamage += amount;
    if ((Number(row.flags) & FLAG_CRITICAL) !== 0 || /(?:^|\|)critical(?:\||$)/i.test(text(row.flagsRaw))) owner.critHits += 1;
    if ((Number(row.flags) & (FLAG_FLANK | FLAG_CA)) !== 0 || /(?:^|\|)(?:flank|combatadvantage)(?:\||$)/i.test(text(row.flagsRaw))) owner.flankHits += 1;
    if (amount > owner.maxHit) { owner.maxHit = amount; owner.maxPower = text(row.powerName) || 'Unknown'; }
    owner.firstDamage = owner.firstDamage == null ? time : Math.min(owner.firstDamage, time);
    owner.lastDamage = owner.lastDamage == null ? time : Math.max(owner.lastDamage, time);
    const point = { time, lineNo: Number(row.lineNo) || 0, targetRef: row.targetRef, amount };
    owner.damageSeries.push(point);
    partySeries.push(point);

    const powerName = text(row.powerName) || 'Unknown';
    let power = owner.powers.get(powerName);
    if (!power) {
      power = createPower(powerName, row);
      owner.powers.set(powerName, power);
    }
    power.damage += amount;
    power.hits += 1;
    if ((Number(row.flags) & FLAG_CRITICAL) !== 0 || /(?:^|\|)critical(?:\||$)/i.test(text(row.flagsRaw))) power.critHits += 1;
    if ((Number(row.flags) & (FLAG_FLANK | FLAG_CA)) !== 0 || /(?:^|\|)(?:flank|combatadvantage)(?:\||$)/i.test(text(row.flagsRaw))) power.flankHits += 1;
    if (amount > power.maxHit) power.maxHit = amount;
    if (companion) power.companionDamage += amount;

    const second = Math.max(0, Math.floor(time - (Number(context.scopeStart) || 0)));
    owner.timeline.set(second, (owner.timeline.get(second) || 0) + amount);
    partyTimeline.set(second, (partyTimeline.get(second) || 0) + amount);
  }

  const compactPlayers = Array.from(players.values())
    .map(player => finalizePlayer(player, scopeType))
    .filter(player => player.damage || player.healingDone || player.damageTaken || player.shielded)
    .sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));
  for (const player of compactPlayers) player.damageShare = damage ? player.damage / damage * 100 : 0;

  const mergedParty = mergeWindows(partySeries);
  const firstParty = partySeries.length ? Math.min(...partySeries.map(point => point.time)) : 0;
  const lastParty = partySeries.length ? Math.max(...partySeries.map(point => point.time)) : firstParty;
  const duration = Math.max(0, lastParty - firstParty);
  const activeCombatTime = scopeType === 'session'
    ? mergedParty.reduce((sum, window) => sum + Math.max(0, window.end - window.start), 0)
    : (partySeries.length ? Math.max(0, Number(context.scopeEnd) - Number(context.scopeStart)) : 0);

  return {
    damage,
    hits,
    duration: scopeType === 'session' ? duration : Math.max(0, Number(context.scopeEnd) - Number(context.scopeStart)),
    activeCombatTime,
    partyDps: damage / Math.max(1, scopeType === 'session' ? duration : Math.max(0, Number(context.scopeEnd) - Number(context.scopeStart))),
    partyCombatDps: damage / Math.max(1, activeCombatTime),
    healing,
    shielded,
    players: compactPlayers,
    partyTimeline: Array.from(partyTimeline.entries()).map(([second, bucketDamage]) => ({ second, damage: bucketDamage })).sort((a, b) => a.second - b.second),
    suspiciousPositiveTypes: Array.from(suspicious.entries()).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key)).slice(0, 12)
  };
}

function rotationCandidates(rows, context = {}) {
  const targetOnly = Boolean(context.targetOnly);
  const bossTargets = context.bossTargets instanceof Set ? context.bossTargets : new Set(context.bossTargets || []);
  const byPlayer = new Map();
  for (const row of rows || []) {
    if (!isPlayer(row.ownerRef) || !isCanonicalDamage(row) || isCompanion(row)) continue;
    if (targetOnly && bossTargets.size && !bossTargets.has(row.targetRef)) continue;
    const category = classifyPowerCategory(row.powerName, { companion: false, powerRef: row.powerRef });
    if (!isRotationCategory(category)) continue;
    let lane = byPlayer.get(row.ownerRef);
    if (!lane) {
      lane = { ref: row.ownerRef, name: text(row.ownerName) || row.ownerRef, rows: [] };
      byPlayer.set(row.ownerRef, lane);
    }
    lane.rows.push({
      time: Number(row.time) || 0,
      lineNo: Number(row.lineNo) || 0,
      power: text(row.powerName) || 'Unknown',
      category,
      amount: Number(row.amount) || 0
    });
  }
  return byPlayer;
}

export function buildShadowRotation(rows, context = {}) {
  const origin = Number(context.scopeStart) || 0;
  const lanes = [];
  let activationCount = 0;
  for (const lane of rotationCandidates(rows, context).values()) {
    lane.rows.sort((a, b) => a.time - b.time || a.lineNo - b.lineNo);
    const lastByPower = new Map();
    const activations = [];
    for (const row of lane.rows) {
      const previous = lastByPower.get(row.power);
      const threshold = activationDedupeSeconds(row.category);
      if (previous != null && row.time - previous < threshold) continue;
      lastByPower.set(row.power, row.time);
      activations.push({
        time: Math.max(0, row.time - origin),
        power: row.power,
        category: row.category,
        amount: row.amount
      });
    }
    activationCount += activations.length;
    lanes.push({ ref: lane.ref, name: lane.name, activations });
  }
  lanes.sort((a, b) => a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref));
  return { lanes, activationCount };
}

function nearlyEqual(a, b) {
  const left = Number(a) || 0;
  const right = Number(b) || 0;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Math.max(0.01, scale * 1e-9);
}

function compareNumber(mismatches, path, actual, expected) {
  if (!nearlyEqual(actual, expected)) mismatches.push({ path, primary: Number(actual) || 0, verifier: Number(expected) || 0 });
}

function comparePlayers(mismatches, primaryPlayers = [], shadowPlayers = []) {
  const shadowByRef = new Map(shadowPlayers.map(player => [player.ref, player]));
  for (const player of primaryPlayers) {
    const shadow = shadowByRef.get(player.ref);
    if (!shadow) {
      mismatches.push({ path: `players.${player.ref}`, primary: 'present', verifier: 'missing' });
      continue;
    }
    for (const field of ['damage','playerDamage','companionDamage','hits','dps','combatDps','duration','combatTime','encounters','crit','flank','avgHit','maxHit','healingDone','healingReceived','damageTaken','shielded']) {
      compareNumber(mismatches, `players.${player.ref}.${field}`, player[field], shadow[field]);
    }
    if (text(player.maxPower) !== text(shadow.maxPower)) mismatches.push({ path: `players.${player.ref}.maxPower`, primary: text(player.maxPower), verifier: text(shadow.maxPower) });

    const shadowPowerByName = new Map((shadow.powers || []).map(power => [power.power, power]));
    for (const power of player.powers || []) {
      const check = shadowPowerByName.get(power.power);
      if (!check) {
        mismatches.push({ path: `players.${player.ref}.powers.${power.power}`, primary: 'present', verifier: 'missing' });
        continue;
      }
      for (const field of ['damage','share','hits','avg','max','crit','flank','dps','companionDamage']) {
        compareNumber(mismatches, `players.${player.ref}.powers.${power.power}.${field}`, power[field], check[field]);
      }
      if (text(power.category) !== text(check.category)) mismatches.push({ path: `players.${player.ref}.powers.${power.power}.category`, primary: text(power.category), verifier: text(check.category) });
    }
  }
  if (primaryPlayers.length !== shadowPlayers.length) mismatches.push({ path: 'players.length', primary: primaryPlayers.length, verifier: shadowPlayers.length });
}

function checksum(report) {
  const source = [report.damage, report.hits, report.duration, report.activeCombatTime]
    .concat((report.players || []).flatMap(player => [player.ref, player.damage, player.hits, player.dps, player.combatDps, player.maxHit]))
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function rotationChecksum(rotation) {
  const source = (rotation.lanes || []).flatMap(lane => [lane.ref, ...(lane.activations || []).flatMap(item => [item.time, item.power, item.category, item.amount])]).join('|');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function verifyReport(primary, rows, context = {}) {
  const shadow = buildShadowReport(rows, context);
  const mismatches = [];
  for (const field of ['damage','hits','duration','activeCombatTime','partyDps','partyCombatDps','healing','shielded']) {
    compareNumber(mismatches, field, primary?.[field], shadow[field]);
  }
  comparePlayers(mismatches, primary?.players || [], shadow.players || []);
  const primaryTimelineDamage = (primary?.partyTimeline || []).reduce((sum, point) => sum + (Number(point.damage) || 0), 0);
  const shadowTimelineDamage = (shadow.partyTimeline || []).reduce((sum, point) => sum + (Number(point.damage) || 0), 0);
  compareNumber(mismatches, 'partyTimeline.damage', primaryTimelineDamage, shadowTimelineDamage);

  const ok = mismatches.length === 0;
  return {
    ok,
    status: ok ? 'verified' : 'mismatch',
    engine: 'shadow-verifier-v1',
    checkedPlayers: shadow.players.length,
    checkedPowers: shadow.players.reduce((sum, player) => sum + (player.powers?.length || 0), 0),
    checkedFields: 8 + shadow.players.length * 17 + shadow.players.reduce((sum, player) => sum + (player.powers?.length || 0) * 10, 0),
    checksum: checksum(shadow),
    mismatches: mismatches.slice(0, 40),
    warnings: shadow.suspiciousPositiveTypes
  };
}

export function verifyRotationReport(primary, rows, context = {}) {
  const shadow = buildShadowRotation(rows, context);
  const mismatches = [];
  if ((primary?.activationCount || 0) !== shadow.activationCount) {
    mismatches.push({ path: 'activationCount', primary: primary?.activationCount || 0, verifier: shadow.activationCount });
  }
  const primaryByRef = new Map((primary?.lanes || []).map(lane => [lane.ref, lane]));
  for (const lane of shadow.lanes) {
    const actual = primaryByRef.get(lane.ref);
    if (!actual) {
      mismatches.push({ path: `lanes.${lane.ref}`, primary: 'missing', verifier: 'present' });
      continue;
    }
    if ((actual.activations || []).length !== lane.activations.length) {
      mismatches.push({ path: `lanes.${lane.ref}.activations.length`, primary: (actual.activations || []).length, verifier: lane.activations.length });
      continue;
    }
    for (let index = 0; index < lane.activations.length; index += 1) {
      const left = actual.activations[index];
      const right = lane.activations[index];
      if (!nearlyEqual(left?.time, right.time) || text(left?.power) !== right.power || text(left?.category) !== right.category || !nearlyEqual(left?.amount, right.amount)) {
        mismatches.push({ path: `lanes.${lane.ref}.activations.${index}`, primary: left || null, verifier: right });
        if (mismatches.length >= 40) break;
      }
    }
    if (mismatches.length >= 40) break;
  }
  if ((primary?.lanes || []).length !== shadow.lanes.length) mismatches.push({ path: 'lanes.length', primary: (primary?.lanes || []).length, verifier: shadow.lanes.length });
  const ok = mismatches.length === 0;
  return {
    ok,
    status: ok ? 'verified' : 'mismatch',
    engine: 'shadow-verifier-v1',
    checkedActivations: shadow.activationCount,
    checkedLanes: shadow.lanes.length,
    checksum: rotationChecksum(shadow),
    mismatches: mismatches.slice(0, 40),
    warnings: []
  };
}

export const VERIFICATION_ENGINE_VERSION = 2;
