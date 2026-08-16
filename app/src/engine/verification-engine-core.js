import { activationDedupeSeconds, classifyPowerCategory, inferPlayerClass, isRotationCategory, summarizeCategories } from './power-taxonomy.js';
import { isKnownEncounterPowerName } from '../data/encounter-power-icons.js';

const VERIFY_DAMAGE_TYPE = 'physical';
const EXPLICIT_NON_DAMAGE_TYPES = new Set(['hitpoints','shield','power','triggercomplex']);
const FLAG_CRITICAL = 1 << 0;
const FLAG_FLANK = 1 << 1;
const FLAG_CA = 1 << 2;
const FLAG_DISPLAY = 1 << 3;
const FLAG_IMMUNE = 1 << 4;
const FLAG_DEFLECT = 1 << 5;
const ENCOUNTER_GAP_SECONDS = 5;
const BOSS_MERGE_GAP_SECONDS = 15;
const PROGRESS_ROWS = 4096;

const text = value => String(value == null ? '' : value).trim();
const isPlayer = value => text(value).startsWith('P[');
const isCreature = value => text(value).startsWith('C[');

function verifierCreatureTemplate(value) {
  const raw = text(value);
  if (!raw.startsWith('C[') || !raw.endsWith(']')) return '';
  const body = raw.slice(2, -1).trim();
  const separator = body.search(/\s/);
  if (separator < 0) return '';
  return body.slice(separator).trim();
}

const isBoss = value => verifierCreatureTemplate(value).toLowerCase().includes('_boss');
const isPet = value => /pet_|companion|appointment|summon/i.test(verifierCreatureTemplate(value));

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
  return text(row.damageType).toLowerCase() === 'hitpoints' && Number(row.amount) < 0;
}

function isShield(row) {
  return text(row.damageType).toLowerCase() === 'shield' && Number(row.amount) < 0;
}

function isCompanion(row) {
  return isPet(row.ownerRef) || isPet(row.sourceRef) || /companion|pet|summon|appointment/i.test(`${text(row.ownerName)} ${text(row.sourceName)} ${text(row.powerName)}`);
}

function createPower(power, row) {
  return { power, powerRef: text(row.powerRef), damage: 0, hits: 0, critHits: 0, flankHits: 0, maxHit: 0, companionDamage: 0 };
}

function createPlayer(ref, name) {
  return {
    ref, name: name || ref, damage: 0, playerDamage: 0, companionDamage: 0, hits: 0, critHits: 0, flankHits: 0, maxHit: 0, maxPower: '',
    firstDamage: null, lastDamage: null, healingDone: 0, healingReceived: 0, damageTaken: 0, shielded: 0, powers: new Map(), timeline: new Map(), damageSeries: []
  };
}

function ensurePlayer(players, ref, name) {
  if (!isPlayer(ref)) return null;
  let player = players.get(ref);
  if (!player) { player = createPlayer(ref, name); players.set(ref, player); }
  else if ((!player.name || player.name === ref) && name) player.name = name;
  return player;
}

function seriesInOrder(series) {
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1];
    const current = series[index];
    if (current.time < previous.time || (current.time === previous.time && current.lineNo < previous.lineNo)) return false;
  }
  return true;
}

function orderedSeries(series) {
  if (!series?.length || series.length < 2 || seriesInOrder(series)) return series || [];
  return series.slice().sort((a, b) => a.time - b.time || a.lineNo - b.lineNo);
}

function splitWindows(series) {
  const sorted = orderedSeries(series);
  if (!sorted.length) return [];
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
    if (previous && previousBoss && windowBoss && sameBoss(previous, window) && window.start - previous.end <= BOSS_MERGE_GAP_SECONDS) { mergeInto(previous, window); continue; }
    if (previous && previousBoss && !windowBoss) {
      const next = source[index + 1];
      if (next?.bossIds?.size && sameBoss(previous, next) && window.start - previous.end <= BOSS_MERGE_GAP_SECONDS && next.start - window.end <= BOSS_MERGE_GAP_SECONDS) {
        mergeInto(previous, window); mergeInto(previous, next); index += 1; continue;
      }
    }
    merged.push(window);
  }
  return merged;
}

function compactPower(power, playerDamage, playerDuration) {
  const category = classifyPowerCategory(power.power, {
    companion: power.companionDamage > 0 && power.companionDamage >= power.damage - 0.001,
    powerRef: power.powerRef
  });
  return {
    power: power.power, category, damage: power.damage, share: playerDamage ? power.damage / playerDamage * 100 : 0, hits: power.hits,
    avg: power.hits ? power.damage / power.hits : 0, max: power.maxHit, crit: power.hits ? power.critHits / power.hits * 100 : 0,
    flank: power.hits ? power.flankHits / power.hits * 100 : 0, dps: power.damage / Math.max(1, playerDuration), companionDamage: power.companionDamage
  };
}

function finalizePlayer(player) {
  const duration = player.firstDamage == null || player.lastDamage == null ? 0 : Math.max(0, player.lastDamage - player.firstDamage);
  const mergedPlayerWindows = mergeWindows(player.damageSeries);
  const combatTime = mergedPlayerWindows.reduce((sum, window) => sum + Math.max(0, window.end - window.start), 0);
  const powers = Array.from(player.powers.values()).map(power => compactPower(power, player.damage, duration)).sort((a, b) => b.damage - a.damage || a.power.localeCompare(b.power));
  const classInfo = inferPlayerClass(powers);
  return {
    ref: player.ref, name: player.name, className: classInfo.name, classConfidence: classInfo.confidence, damage: player.damage, playerDamage: player.playerDamage,
    companionDamage: player.companionDamage, hits: player.hits, dps: player.damage / Math.max(1, duration), combatDps: player.damage / Math.max(1, combatTime),
    duration, combatTime, encounters: mergedPlayerWindows.length, crit: player.hits ? player.critHits / player.hits * 100 : 0,
    flank: player.hits ? player.flankHits / player.hits * 100 : 0, avgHit: player.hits ? player.damage / player.hits : 0, maxHit: player.maxHit, maxPower: player.maxPower,
    healingDone: player.healingDone, healingReceived: player.healingReceived, damageTaken: player.damageTaken, shielded: player.shielded, powers,
    categories: summarizeCategories(powers), timeline: Array.from(player.timeline.entries()).map(([second, damage]) => ({ second, damage })).sort((a, b) => a.second - b.second)
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

function reportProgress(callback, processed, total) {
  if (!callback || processed % PROGRESS_ROWS !== 0) return;
  callback(total > 0 ? Math.min(1, processed / total) : 0);
}

export function buildShadowReport(rows, context = {}, onProgress = null) {
  const scopeType = context.scopeType || 'session';
  const targetOnly = Boolean(context.targetOnly);
  const bossTargets = context.bossTargets instanceof Set ? context.bossTargets : new Set(context.bossTargets || []);
  const totalRows = Number(context.totalRows) || 0;
  const players = new Map();
  const partyTimeline = new Map();
  const partySeries = [];
  const suspicious = new Map();
  let damage = 0, hits = 0, healing = 0, shielded = 0, processed = 0;
  let firstParty = Number.POSITIVE_INFINITY;
  let lastParty = Number.NEGATIVE_INFINITY;

  for (const row of rows || []) {
    processed += 1;
    reportProgress(onProgress, processed, totalRows);
    const owner = ensurePlayer(players, row.ownerRef, row.ownerName);
    const target = ensurePlayer(players, row.targetRef, row.targetName);
    const amount = Number(row.amount) || 0;
    if (isHealing(row)) {
      const value = Math.abs(amount); healing += value; if (owner) owner.healingDone += value; if (target) target.healingReceived += value;
    }
    if (isShield(row) && target) { const value = Math.abs(amount); shielded += value; target.shielded += value; }
    if (isCanonicalDamage(row) && target) target.damageTaken += amount;
    const suspiciousType = suspiciousPositiveType(row);
    if (suspiciousType) suspicious.set(suspiciousType, (suspicious.get(suspiciousType) || 0) + 1);
    if (!owner || !isCanonicalDamage(row)) continue;
    if (targetOnly && bossTargets.size && !bossTargets.has(row.targetRef)) continue;

    const companion = isCompanion(row);
    const time = Number(row.time) || 0;
    firstParty = Math.min(firstParty, time);
    lastParty = Math.max(lastParty, time);
    damage += amount; hits += 1; owner.damage += amount; owner.hits += 1;
    if (companion) owner.companionDamage += amount; else owner.playerDamage += amount;
    if ((Number(row.flags) & FLAG_CRITICAL) !== 0 || /(?:^|\|)critical(?:\||$)/i.test(text(row.flagsRaw))) owner.critHits += 1;
    if ((Number(row.flags) & (FLAG_FLANK | FLAG_CA)) !== 0 || /(?:^|\|)(?:flank|combatadvantage)(?:\||$)/i.test(text(row.flagsRaw))) owner.flankHits += 1;
    if (amount > owner.maxHit) { owner.maxHit = amount; owner.maxPower = text(row.powerName) || 'Unknown'; }
    owner.firstDamage = owner.firstDamage == null ? time : Math.min(owner.firstDamage, time);
    owner.lastDamage = owner.lastDamage == null ? time : Math.max(owner.lastDamage, time);
    const point = { time, lineNo: Number(row.lineNo) || 0, targetRef: row.targetRef, amount };
    owner.damageSeries.push(point); partySeries.push(point);

    const powerName = text(row.powerName) || 'Unknown';
    let power = owner.powers.get(powerName);
    if (!power) { power = createPower(powerName, row); owner.powers.set(powerName, power); }
    power.damage += amount; power.hits += 1;
    if ((Number(row.flags) & FLAG_CRITICAL) !== 0 || /(?:^|\|)critical(?:\||$)/i.test(text(row.flagsRaw))) power.critHits += 1;
    if ((Number(row.flags) & (FLAG_FLANK | FLAG_CA)) !== 0 || /(?:^|\|)(?:flank|combatadvantage)(?:\||$)/i.test(text(row.flagsRaw))) power.flankHits += 1;
    if (amount > power.maxHit) power.maxHit = amount;
    if (companion) power.companionDamage += amount;
    const second = Math.max(0, Math.floor(time - (Number(context.scopeStart) || 0)));
    owner.timeline.set(second, (owner.timeline.get(second) || 0) + amount);
    partyTimeline.set(second, (partyTimeline.get(second) || 0) + amount);
  }
  onProgress?.(1);

  const compactPlayers = Array.from(players.values()).map(finalizePlayer).filter(player => player.damage || player.healingDone || player.damageTaken || player.shielded).sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));
  for (const player of compactPlayers) player.damageShare = damage ? player.damage / damage * 100 : 0;
  const mergedParty = mergeWindows(partySeries);
  const duration = Number.isFinite(firstParty) && Number.isFinite(lastParty) ? Math.max(0, lastParty - firstParty) : 0;
  const activeCombatTime = mergedParty.reduce((sum, window) => sum + Math.max(0, window.end - window.start), 0);
  const scopedDuration = scopeType === 'session' ? duration : Math.max(0, Number(context.scopeEnd) - Number(context.scopeStart));
  return {
    damage, hits, duration: scopedDuration, activeCombatTime, partyDps: damage / Math.max(1, scopedDuration), partyCombatDps: damage / Math.max(1, activeCombatTime), healing, shielded,
    players: compactPlayers, partyTimeline: Array.from(partyTimeline.entries()).map(([second, bucketDamage]) => ({ second, damage: bucketDamage })).sort((a, b) => a.second - b.second),
    suspiciousPositiveTypes: Array.from(suspicious.entries()).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key)).slice(0, 12)
  };
}

function rotationCandidates(rows, context = {}, onProgress = null) {
  const targetOnly = Boolean(context.targetOnly);
  const bossTargets = context.bossTargets instanceof Set ? context.bossTargets : new Set(context.bossTargets || []);
  const totalRows = Number(context.totalRows) || 0;
  const byPlayer = new Map();
  let processed = 0;
  for (const row of rows || []) {
    processed += 1; reportProgress(onProgress, processed, totalRows);
    if (!isPlayer(row.ownerRef)) continue;
    const power = text(row.powerName) || 'Unknown';
    const category = classifyPowerCategory(power, { companion: false, powerRef: row.powerRef });
    if (!isRotationCategory(category)) continue;

    const catalogEncounter = category === 'Encounter' && isKnownEncounterPowerName(power);
    const encounterMarker = catalogEncounter && !targetOnly &&
      text(row.damageType).toLowerCase() === 'power' &&
      Number(row.amount) < 0 &&
      text(row.sourceRef) === '*' &&
      !isCompanion(row);
    const targetAccepted = !targetOnly || !bossTargets.size || bossTargets.has(row.targetRef);
    const damageCandidate = isCanonicalDamage(row) && !isCompanion(row) && targetAccepted;
    if (!encounterMarker && !damageCandidate) continue;

    let lane = byPlayer.get(row.ownerRef);
    if (!lane) { lane = { ref: row.ownerRef, name: text(row.ownerName) || row.ownerRef, rows: [], damageRows: [] }; byPlayer.set(row.ownerRef, lane); }
    if (damageCandidate) lane.damageRows.push({ time: Number(row.time) || 0, lineNo: Number(row.lineNo) || 0, power, category, amount: Number(row.amount) || 0, flags: Number(row.flags) || 0, flagsRaw: text(row.flagsRaw) });
    if (catalogEncounter && !targetOnly) {
      if (!encounterMarker) continue;
    } else if (!damageCandidate) continue;
    lane.rows.push({
      time: Number(row.time) || 0,
      lineNo: Number(row.lineNo) || 0,
      power,
      category,
      amount: encounterMarker ? 0 : Number(row.amount) || 0
    });
  }
  onProgress?.(1);
  return byPlayer;
}

function applyShadowRotationDetails(activations, damageRows) {
  const byPower = new Map();
  for (const activation of activations) {
    Object.assign(activation, { damage: 0, hits: 0, critHits: 0, caHits: 0, deflectedHits: 0, maxHit: 0 });
    const list = byPower.get(activation.power) || [];
    list.push(activation);
    byPower.set(activation.power, list);
  }
  for (const row of damageRows) {
    const candidates = byPower.get(row.power);
    if (!candidates) continue;
    let selected = null;
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      const delta = row.time - candidate._absoluteTime;
      if (delta < -0.15) continue;
      if (delta > activationDedupeSeconds(candidate.category)) break;
      selected = candidate;
      break;
    }
    if (!selected) continue;
    const amount = Number(row.amount) || 0;
    selected.damage += amount;
    selected.hits += 1;
    const raw = text(row.flagsRaw);
    if ((row.flags & FLAG_CRITICAL) !== 0 || /(?:^|\|)critical(?:\||$)/i.test(raw)) selected.critHits += 1;
    if ((row.flags & (FLAG_FLANK | FLAG_CA)) !== 0 || /(?:^|\|)(?:flank|combatadvantage)(?:\||$)/i.test(raw)) selected.caHits += 1;
    if ((row.flags & FLAG_DEFLECT) !== 0 || /(?:^|\|)deflect(?:ed)?(?:\||$)/i.test(raw)) selected.deflectedHits += 1;
    selected.maxHit = Math.max(selected.maxHit, amount);
  }
  for (const activation of activations) delete activation._absoluteTime;
}

export function buildShadowRotation(rows, context = {}, onProgress = null) {
  const origin = Number(context.scopeStart) || 0;
  const lanes = [];
  let activationCount = 0;
  for (const lane of rotationCandidates(rows, context, onProgress).values()) {
    if (!lane.rows.length) continue;
    const ordered = orderedSeries(lane.rows);
    const lastByPower = new Map();
    const activations = [];
    for (const row of ordered) {
      const previous = lastByPower.get(row.power);
      const threshold = activationDedupeSeconds(row.category);
      if (previous != null && row.time - previous < threshold) continue;
      lastByPower.set(row.power, row.time);
      activations.push({ time: Math.max(0, row.time - origin), power: row.power, category: row.category, amount: row.amount, _absoluteTime: row.time });
    }
    applyShadowRotationDetails(activations, lane.damageRows);
    activationCount += activations.length;
    lanes.push({ ref: lane.ref, name: lane.name, activations });
  }
  lanes.sort((a, b) => a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref));
  return { lanes, activationCount };
}

function nearlyEqual(a, b) {
  const left = Number(a) || 0, right = Number(b) || 0;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Math.max(0.01, scale * 1e-9);
}
function compareNumber(mismatches, path, actual, expected) { if (!nearlyEqual(actual, expected)) mismatches.push({ path, primary: Number(actual) || 0, verifier: Number(expected) || 0 }); }

function comparePlayers(mismatches, primaryPlayers = [], shadowPlayers = []) {
  const shadowByRef = new Map(shadowPlayers.map(player => [player.ref, player]));
  for (const player of primaryPlayers) {
    const shadow = shadowByRef.get(player.ref);
    if (!shadow) { mismatches.push({ path: `players.${player.ref}`, primary: 'present', verifier: 'missing' }); continue; }
    for (const field of ['damage','playerDamage','companionDamage','hits','duration','combatTime','dps','combatDps','encounters','crit','flank','avgHit','maxHit','healingDone','healingReceived','damageTaken','shielded']) compareNumber(mismatches, `players.${player.ref}.${field}`, player[field], shadow[field]);
    if (text(player.maxPower) !== text(shadow.maxPower)) mismatches.push({ path: `players.${player.ref}.maxPower`, primary: text(player.maxPower), verifier: text(shadow.maxPower) });
    const shadowPowerByName = new Map((shadow.powers || []).map(power => [power.power, power]));
    for (const power of player.powers || []) {
      const check = shadowPowerByName.get(power.power);
      if (!check) { mismatches.push({ path: `players.${player.ref}.powers.${power.power}`, primary: 'present', verifier: 'missing' }); continue; }
      for (const field of ['damage','share','hits','avg','max','crit','flank','dps','companionDamage']) compareNumber(mismatches, `players.${player.ref}.powers.${power.power}.${field}`, power[field], check[field]);
      if (text(power.category) !== text(check.category)) mismatches.push({ path: `players.${player.ref}.powers.${power.power}.category`, primary: text(power.category), verifier: text(check.category) });
    }
  }
  if (primaryPlayers.length !== shadowPlayers.length) mismatches.push({ path: 'players.length', primary: primaryPlayers.length, verifier: shadowPlayers.length });
}

function hashText(hash, value) {
  const source = String(value ?? '');
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  hash ^= 124;
  return Math.imul(hash, 16777619);
}

function checksum(report) {
  let hash = 2166136261;
  for (const value of [report.damage, report.hits, report.duration, report.activeCombatTime]) hash = hashText(hash, value);
  for (const player of report.players || []) for (const value of [player.ref, player.damage, player.hits, player.dps, player.combatDps, player.maxHit]) hash = hashText(hash, value);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function rotationChecksum(rotation) {
  let hash = 2166136261;
  for (const lane of rotation.lanes || []) {
    hash = hashText(hash, lane.ref);
    for (const item of lane.activations || []) for (const value of [item.time, item.power, item.category, item.amount, item.damage, item.hits, item.critHits, item.caHits, item.deflectedHits, item.maxHit]) hash = hashText(hash, value);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function verifyReport(primary, rows, context = {}, onProgress = null) {
  const shadow = buildShadowReport(rows, context, onProgress);
  const mismatches = [];
  for (const field of ['damage','hits','duration','activeCombatTime','partyDps','partyCombatDps','healing','shielded']) compareNumber(mismatches, field, primary?.[field], shadow[field]);
  comparePlayers(mismatches, primary?.players || [], shadow.players || []);
  const primaryTimelineDamage = (primary?.partyTimeline || []).reduce((sum, point) => sum + (Number(point.damage) || 0), 0);
  const shadowTimelineDamage = (shadow.partyTimeline || []).reduce((sum, point) => sum + (Number(point.damage) || 0), 0);
  compareNumber(mismatches, 'partyTimeline.damage', primaryTimelineDamage, shadowTimelineDamage);
  const ok = mismatches.length === 0;
  return {
    ok, status: ok ? 'verified' : 'mismatch', engine: 'shadow-verifier-v1', checkedPlayers: shadow.players.length,
    checkedPowers: shadow.players.reduce((sum, player) => sum + (player.powers?.length || 0), 0),
    checkedFields: 8 + shadow.players.length * 17 + shadow.players.reduce((sum, player) => sum + (player.powers?.length || 0) * 10, 0),
    checksum: checksum(shadow), mismatches: mismatches.slice(0, 40), warnings: shadow.suspiciousPositiveTypes
  };
}

export function verifyRotationReport(primary, rows, context = {}, onProgress = null) {
  const shadow = buildShadowRotation(rows, context, onProgress);
  const mismatches = [];
  if ((primary?.activationCount || 0) !== shadow.activationCount) mismatches.push({ path: 'activationCount', primary: primary?.activationCount || 0, verifier: shadow.activationCount });
  const primaryByRef = new Map((primary?.lanes || []).map(lane => [lane.ref, lane]));
  for (const lane of shadow.lanes) {
    const actual = primaryByRef.get(lane.ref);
    if (!actual) { mismatches.push({ path: `lanes.${lane.ref}`, primary: 'missing', verifier: 'present' }); continue; }
    if ((actual.activations || []).length !== lane.activations.length) { mismatches.push({ path: `lanes.${lane.ref}.activations.length`, primary: (actual.activations || []).length, verifier: lane.activations.length }); continue; }
    for (let index = 0; index < lane.activations.length; index += 1) {
      const left = actual.activations[index], right = lane.activations[index];
      if (!nearlyEqual(left?.time, right.time) || text(left?.power) !== right.power || text(left?.category) !== right.category || !nearlyEqual(left?.amount, right.amount)) {
        mismatches.push({ path: `lanes.${lane.ref}.activations.${index}`, primary: left || null, verifier: right });
        if (mismatches.length >= 40) break;
      }
      for (const field of ['damage','hits','critHits','caHits','deflectedHits','maxHit']) {
        compareNumber(mismatches, `lanes.${lane.ref}.activations.${index}.${field}`, left?.[field], right[field]);
        if (mismatches.length >= 40) break;
      }
    }
    if (mismatches.length >= 40) break;
  }
  if ((primary?.lanes || []).length !== shadow.lanes.length) mismatches.push({ path: 'lanes.length', primary: (primary?.lanes || []).length, verifier: shadow.lanes.length });
  const ok = mismatches.length === 0;
  return { ok, status: ok ? 'verified' : 'mismatch', engine: 'shadow-verifier-v1', checkedActivations: shadow.activationCount, checkedLanes: shadow.lanes.length, checksum: rotationChecksum(shadow), mismatches: mismatches.slice(0, 40), warnings: [] };
}

export const VERIFICATION_ENGINE_VERSION = 5;
