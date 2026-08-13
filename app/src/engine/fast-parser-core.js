const KNOWN_DAMAGE_TYPES = new Set([
  'physical', 'arcane', 'cold', 'fire', 'lightning', 'necrotic',
  'poison', 'psychic', 'radiant', 'thunder', 'force', 'untyped'
]);
const CANONICAL_DAMAGE_TYPES = new Set(['physical']);

export const FLAG = Object.freeze({
  CRITICAL: 1 << 0,
  FLANK: 1 << 1,
  COMBAT_ADVANTAGE: 1 << 2,
  SHOW_POWER_DISPLAY_NAME: 1 << 3,
  IMMUNE: 1 << 4,
  DEFLECT: 1 << 5,
  KILL: 1 << 6,
  SHIELD_BREAK: 1 << 7
});

const PET_RE = /pet_|companion|appointment|summon/i;
const COMPANION_TEXT_RE = /companion|pet|summon|appointment/i;
const ENTITY_REF_RE = /^(?:P|C)\[[\s\S]*\]$/;

export function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

export function isPlayerRef(value) {
  return normalizeText(value).startsWith('P[');
}

export function isCreatureRef(value) {
  return normalizeText(value).startsWith('C[');
}

export function isEntityRef(value) {
  const text = normalizeText(value);
  return ENTITY_REF_RE.test(text) || text === '*';
}

export function entityTemplate(value) {
  const match = normalizeText(value).match(/^C\[(?:[^\s\]]+)\s+([\s\S]+)\]$/);
  return match ? match[1] : '';
}

export function isBossRef(value) {
  return entityTemplate(value).toLowerCase().includes('_boss');
}

export function isMobRef(value) {
  const template = entityTemplate(value).toLowerCase();
  return !template.includes('_boss') && ['_solo', '_elite', '_standard', '_minion'].some(token => template.includes(token));
}

export function isPetRef(value) {
  return PET_RE.test(entityTemplate(value));
}

const DATE_EPOCH_CACHE = new Map();
let lastDateKey = Number.NaN;
let lastDateEpoch = Number.NaN;

function dateEpochSeconds(year, month, day) {
  const key = year * 10000 + month * 100 + day;
  if (key === lastDateKey) return lastDateEpoch;
  const cached = DATE_EPOCH_CACHE.get(key);
  if (cached != null) {
    lastDateKey = key;
    lastDateEpoch = cached;
    return cached;
  }

  const epochMs = Date.UTC(year, month - 1, day);
  const date = new Date(epochMs);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return Number.NaN;
  const epoch = epochMs / 1000;
  if (DATE_EPOCH_CACHE.size >= 32) DATE_EPOCH_CACHE.delete(DATE_EPOCH_CACHE.keys().next().value);
  DATE_EPOCH_CACHE.set(key, epoch);
  lastDateKey = key;
  lastDateEpoch = epoch;
  return epoch;
}

function utcTimestamp(year, month, day, hour, minute, second) {
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return Number.NaN;
  if (year < 0 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second >= 60) return Number.NaN;
  const normalizedYear = year < 100 ? 2000 + year : year;
  const dayEpoch = dateEpochSeconds(normalizedYear, month, day);
  if (!Number.isFinite(dayEpoch)) return Number.NaN;
  const totalMilliseconds = Math.round(second * 1000);
  if (totalMilliseconds < 0 || totalMilliseconds >= 60000) return Number.NaN;
  return dayEpoch + hour * 3600 + minute * 60 + totalMilliseconds / 1000;
}

export function parseTimestamp(raw) {
  const text = normalizeText(raw);
  if (!text) return Number.NaN;

  const parts = text.split(':');
  if (parts.length === 6) {
    return utcTimestamp(
      Number(parts[0]), Number(parts[1]), Number(parts[2]),
      Number(parts[3]), Number(parts[4]), Number(parts[5])
    );
  }
  if (parts.length === 4) {
    const day = Number(parts[0]);
    const hour = Number(parts[1]);
    const minute = Number(parts[2]);
    const second = Number(parts[3]);
    if ([day, hour, minute, second].every(Number.isFinite) && day >= 0 && hour >= 0 && hour < 24 && minute >= 0 && minute < 60 && second >= 0 && second < 60) {
      return day * 86400 + hour * 3600 + minute * 60 + second;
    }
  }
  if (parts.length === 3) {
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    const second = Number(parts[2]);
    if ([hour, minute, second].every(Number.isFinite) && hour >= 0 && minute >= 0 && minute < 60 && second >= 0 && second < 60) {
      return hour * 3600 + minute * 60 + second;
    }
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed / 1000 : Number.NaN;
}

export function tokenizeCsv(text) {
  const out = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      out.push(cell.trim());
      cell = '';
      continue;
    }

    cell += char;
  }

  out.push(cell.trim());
  return out;
}

function recoverLegacyPayload(tokens) {
  if (tokens.length === 12) return tokens;
  if (tokens.length < 12) return null;

  const tail = tokens.slice(-5);
  const head = tokens.slice(0, -5);
  const refIndexes = [];

  for (let index = 0; index < head.length; index += 1) {
    if (isEntityRef(head[index])) refIndexes.push(index);
    if (refIndexes.length === 3) break;
  }

  if (refIndexes.length !== 3) return null;
  const [ownerIndex, sourceIndex, targetIndex] = refIndexes;
  if (!(ownerIndex < sourceIndex && sourceIndex < targetIndex)) return null;

  const ownerName = head.slice(0, ownerIndex).join(', ').trim();
  const ownerRef = head[ownerIndex];
  const sourceName = head.slice(ownerIndex + 1, sourceIndex).join(', ').trim();
  const sourceRef = head[sourceIndex];
  const targetName = head.slice(sourceIndex + 1, targetIndex).join(', ').trim();
  const targetRef = head[targetIndex];
  const powerName = head.slice(targetIndex + 1).join(', ').trim();

  if (!powerName) return null;
  return [ownerName, ownerRef, sourceName, sourceRef, targetName, targetRef, powerName, ...tail];
}

function stripOptionalIndex(prefix) {
  const comma = prefix.indexOf(',');
  if (comma <= 0) return prefix;
  const first = prefix.slice(0, comma).trim();
  return /^\d+$/.test(first) ? prefix.slice(comma + 1) : prefix;
}

export function parseFlags(raw) {
  let bits = 0;
  const text = normalizeText(raw);
  if (!text) return bits;
  for (const flag of text.split('|')) {
    const value = flag.trim().toLowerCase();
    if (value === 'critical') bits |= FLAG.CRITICAL;
    else if (value === 'flank') bits |= FLAG.FLANK;
    else if (value === 'combatadvantage') bits |= FLAG.COMBAT_ADVANTAGE;
    else if (value === 'showpowerdisplayname') bits |= FLAG.SHOW_POWER_DISPLAY_NAME;
    else if (value === 'immune') bits |= FLAG.IMMUNE;
    else if (value === 'dodge' || value === 'deflect' || value === 'deflected') bits |= FLAG.DEFLECT;
    else if (value === 'kill') bits |= FLAG.KILL;
    else if (value === 'shieldbreak') bits |= FLAG.SHIELD_BREAK;
  }
  return bits;
}

export function classifyEvent(row) {
  const type = normalizeText(row.damageType).toLowerCase();
  const flagsText = normalizeText(row.flagsRaw).toLowerCase();

  if ((row.flags & FLAG.IMMUNE) !== 0 || flagsText.includes('immune')) return 'immune';
  if (type === 'hitpoints' && row.amount < 0) return 'healing';
  if (type.includes('heal') || flagsText.includes('heal')) return 'healing';
  if (type === 'shield') return row.amount < 0 ? 'shield' : 'shield-damage';
  if (type === 'power' || type.includes('resource') || flagsText.includes('resource')) return 'resource';
  if (type === 'triggercomplex') return 'meta';
  if (type.includes('summon') || flagsText.includes('summon')) return 'summon';
  if (type.includes('control') || flagsText.includes('control')) return 'control';
  if (row.amount > 0 && KNOWN_DAMAGE_TYPES.has(type)) return 'damage';
  return 'unknown';
}

export function isValidDamage(row) {
  if (classifyEvent(row) !== 'damage') return false;
  if (row.amount <= 0) return false;
  if (!CANONICAL_DAMAGE_TYPES.has(normalizeText(row.damageType).toLowerCase())) return false;
  if ((row.flags & FLAG.SHOW_POWER_DISPLAY_NAME) !== 0) return false;
  if (row.targetRef === '*' && !isCreatureRef(row.sourceRef)) return false;
  return true;
}

export function isCompanionRow(row) {
  if (isPetRef(row.ownerRef) || isPetRef(row.sourceRef)) return true;
  return COMPANION_TEXT_RE.test(`${row.ownerName} ${row.sourceName} ${row.powerName}`);
}

export function parseLine(rawLine, lineNo = 0) {
  const line = String(rawLine == null ? '' : rawLine).replace(/^\uFEFF/, '').trim();
  if (!line) return { ok: false, reason: 'empty' };
  if (/^index\s*,/i.test(line)) return { ok: false, reason: 'header' };

  const separatorIndex = line.indexOf('::');
  if (separatorIndex < 0) return { ok: false, reason: 'missing_timestamp_separator' };

  const rawPrefix = stripOptionalIndex(line.slice(0, separatorIndex).trim());
  const payload = line.slice(separatorIndex + 2).trim();
  let fields = tokenizeCsv(payload);
  if (fields.length !== 12) fields = recoverLegacyPayload(fields);
  if (!fields || fields.length !== 12) {
    return { ok: false, reason: 'invalid_field_count', detail: `found ${fields ? fields.length : 'unrecoverable'} fields` };
  }

  const amountText = fields[10].replace(/,/g, '').trim();
  const baseAmountText = fields[11].replace(/,/g, '').trim();
  if (!amountText) return { ok: false, reason: 'invalid_magnitude' };
  if (!baseAmountText) return { ok: false, reason: 'invalid_base_magnitude' };
  const amount = Number(amountText);
  const baseAmount = Number(baseAmountText);
  if (!Number.isFinite(amount)) return { ok: false, reason: 'invalid_magnitude' };
  if (!Number.isFinite(baseAmount)) return { ok: false, reason: 'invalid_base_magnitude' };

  const abs = parseTimestamp(rawPrefix);
  if (!Number.isFinite(abs)) return { ok: false, reason: 'invalid_timestamp' };

  const row = {
    lineNo,
    timestampRaw: rawPrefix,
    abs,
    time: 0,
    ownerName: fields[0],
    ownerRef: fields[1],
    sourceName: fields[2],
    sourceRef: fields[3],
    targetName: fields[4],
    targetRef: fields[5],
    powerName: fields[6] || 'Unknown',
    powerRef: fields[7],
    damageType: fields[8],
    flagsRaw: fields[9],
    flags: parseFlags(fields[9]),
    amount,
    baseAmount
  };
  row.kind = classifyEvent(row);
  row.validDamage = isValidDamage(row);
  row.companion = row.validDamage && isCompanionRow(row);
  return { ok: true, row };
}

function addCount(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function mapToSortedEntries(map, limit = Infinity) {
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, limit);
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
    encounterWindows: [],
    currentEncounter: null,
    lastEncounterDamageAt: null
  };
}

function updatePower(player, row) {
  let power = player.powers.get(row.powerName);
  if (!power) {
    power = {
      power: row.powerName,
      powerRef: row.powerRef || '',
      damage: 0,
      hits: 0,
      critHits: 0,
      flankHits: 0,
      maxHit: 0,
      companionDamage: 0
    };
    player.powers.set(row.powerName, power);
  }
  power.damage += row.amount;
  power.hits += 1;
  if ((row.flags & FLAG.CRITICAL) !== 0) power.critHits += 1;
  if ((row.flags & (FLAG.FLANK | FLAG.COMBAT_ADVANTAGE)) !== 0) power.flankHits += 1;
  if (row.amount > power.maxHit) power.maxHit = row.amount;
  if (row.companion) power.companionDamage += row.amount;
}

function compactPower(power, totalDamage) {
  return {
    power: power.power,
    powerRef: power.powerRef || '',
    damage: power.damage,
    hits: power.hits,
    share: totalDamage ? (power.damage / totalDamage) * 100 : 0,
    avg: power.hits ? power.damage / power.hits : 0,
    max: power.maxHit,
    maxHit: power.maxHit,
    crit: power.hits ? (power.critHits / power.hits) * 100 : 0,
    critHits: power.critHits,
    flank: power.hits ? (power.flankHits / power.hits) * 100 : 0,
    flankHits: power.flankHits,
    companionDamage: power.companionDamage
  };
}

function mergeMinimalWindows(source, bossMergeGapSeconds) {
  const windows = source.map(window => ({
    start: window.start,
    end: window.end,
    damage: window.damage || 0,
    hits: window.hits || 0,
    bossIds: new Set(window.bossIds || [])
  }));
  const merged = [];
  const sameBoss = (a, b) => Array.from(a.bossIds).some(id => b.bossIds.has(id));
  const mergeInto = (target, addition) => {
    target.start = Math.min(target.start, addition.start);
    target.end = Math.max(target.end, addition.end);
    target.damage += addition.damage;
    target.hits += addition.hits;
    for (const id of addition.bossIds) target.bossIds.add(id);
  };

  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    const previous = merged.at(-1);
    if (previous?.bossIds.size && window.bossIds.size && sameBoss(previous, window) && window.start - previous.end <= bossMergeGapSeconds) {
      mergeInto(previous, window);
      continue;
    }
    if (previous?.bossIds.size && !window.bossIds.size) {
      const next = windows[index + 1];
      if (next?.bossIds.size && sameBoss(previous, next) && window.start - previous.end <= bossMergeGapSeconds && next.start - window.end <= bossMergeGapSeconds) {
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

export class CombatAccumulator {
  constructor({ encounterGapSeconds = 5, bossMergeGapSeconds = 15, maxRejectedSamples = 40 } = {}) {
    this.encounterGapSeconds = encounterGapSeconds;
    this.bossMergeGapSeconds = bossMergeGapSeconds;
    this.maxRejectedSamples = maxRejectedSamples;
    this.firstAbs = null;
    this.maxTime = 0;
    this.lines = 0;
    this.parsed = 0;
    this.rejected = 0;
    this.validDamageRows = 0;
    this.damage = 0;
    this.healing = 0;
    this.shielded = 0;
    this.players = new Map();
    this.eventTypes = new Map();
    this.unknownTypes = new Map();
    this.nonCanonicalDamageTypes = new Map();
    this.rejectReasons = new Map();
    this.rejectedSamples = [];
    this.encounters = [];
    this.currentEncounter = null;
    this.firstPartyDamageAt = null;
    this.lastPartyDamageAt = null;
  }

  ensurePlayer(ref, name) {
    if (!isPlayerRef(ref)) return null;
    let player = this.players.get(ref);
    if (!player) {
      player = createPlayer(ref, name);
      this.players.set(ref, player);
    } else if ((!player.name || player.name === ref) && name) {
      player.name = name;
    }
    return player;
  }

  reject(lineNo, raw, reason, detail = '') {
    this.lines = Math.max(this.lines, lineNo);
    if (reason === 'empty' || reason === 'header') return;
    this.rejected += 1;
    addCount(this.rejectReasons, reason);
    if (this.rejectedSamples.length < this.maxRejectedSamples) {
      this.rejectedSamples.push({ lineNo, reason, detail, preview: String(raw || '').slice(0, 320) });
    }
  }

  updatePlayerEncounter(player, row) {
    const needsNew = player.lastEncounterDamageAt == null || row.time - player.lastEncounterDamageAt > this.encounterGapSeconds;
    if (needsNew) {
      player.currentEncounter = { start: row.time, end: row.time, damage: 0, hits: 0, bossIds: new Set() };
      player.encounterWindows.push(player.currentEncounter);
    }
    const encounter = player.currentEncounter;
    encounter.end = row.time;
    encounter.damage += row.amount;
    encounter.hits += 1;
    if (isBossRef(row.targetRef)) encounter.bossIds.add(row.targetRef);
    player.lastEncounterDamageAt = row.time;
  }

  ingest(row) {
    this.lines = Math.max(this.lines, row.lineNo || this.lines + 1);
    this.parsed += 1;
    if (this.firstAbs == null) this.firstAbs = row.abs;
    row.time = Math.max(0, row.abs - this.firstAbs);
    this.maxTime = Math.max(this.maxTime, row.time);

    addCount(this.eventTypes, row.damageType || 'Unknown');
    if (row.kind === 'unknown') addCount(this.unknownTypes, row.damageType || 'Unknown');
    if (row.kind === 'damage' && row.amount > 0 && !row.validDamage) {
      const type = normalizeText(row.damageType) || 'Unknown';
      if (type.toLowerCase() !== 'physical') addCount(this.nonCanonicalDamageTypes, type);
    }

    const ownerPlayer = this.ensurePlayer(row.ownerRef, row.ownerName);
    const targetPlayer = this.ensurePlayer(row.targetRef, row.targetName);

    if (row.kind === 'healing') {
      const value = Math.abs(row.amount);
      this.healing += value;
      if (ownerPlayer) ownerPlayer.healingDone += value;
      if (targetPlayer) targetPlayer.healingReceived += value;
    }

    if (row.kind === 'shield' && targetPlayer) {
      const value = Math.abs(row.amount);
      this.shielded += value;
      targetPlayer.shielded += value;
    }

    if (row.validDamage && targetPlayer && row.amount > 0) targetPlayer.damageTaken += row.amount;

    if (!row.validDamage || !ownerPlayer) return row;

    this.validDamageRows += 1;
    this.damage += row.amount;
    ownerPlayer.damage += row.amount;
    ownerPlayer.hits += 1;
    if (row.companion) ownerPlayer.companionDamage += row.amount;
    else ownerPlayer.playerDamage += row.amount;
    if ((row.flags & FLAG.CRITICAL) !== 0) ownerPlayer.critHits += 1;
    if ((row.flags & (FLAG.FLANK | FLAG.COMBAT_ADVANTAGE)) !== 0) ownerPlayer.flankHits += 1;
    if (row.amount > ownerPlayer.maxHit) {
      ownerPlayer.maxHit = row.amount;
      ownerPlayer.maxPower = row.powerName;
    }

    if (ownerPlayer.firstDamage == null || row.time < ownerPlayer.firstDamage) ownerPlayer.firstDamage = row.time;
    if (ownerPlayer.lastDamage == null || row.time > ownerPlayer.lastDamage) ownerPlayer.lastDamage = row.time;
    updatePower(ownerPlayer, row);
    this.updatePlayerEncounter(ownerPlayer, row);

    const secondBucket = Math.floor(row.time);
    ownerPlayer.timeline.set(secondBucket, (ownerPlayer.timeline.get(secondBucket) || 0) + row.amount);
    this.updateEncounter(row);
    return row;
  }

  updateEncounter(row) {
    const previousDamageAt = this.lastPartyDamageAt;
    const needsNew = previousDamageAt == null || row.time - previousDamageAt > this.encounterGapSeconds;
    if (this.firstPartyDamageAt == null) this.firstPartyDamageAt = row.time;

    if (needsNew) {
      this.currentEncounter = {
        start: row.time,
        end: row.time,
        damage: 0,
        hits: 0,
        bossIds: new Set(),
        bossNames: new Map(),
        enemyNames: new Map()
      };
      this.encounters.push(this.currentEncounter);
    }

    const encounter = this.currentEncounter;
    encounter.end = row.time;
    encounter.damage += row.amount;
    encounter.hits += 1;
    if (isBossRef(row.targetRef)) {
      encounter.bossIds.add(row.targetRef);
      addCount(encounter.bossNames, row.targetName || entityTemplate(row.targetRef) || row.targetRef, row.amount);
    }
    if (isCreatureRef(row.targetRef) && !isPetRef(row.targetRef)) addCount(encounter.enemyNames, row.targetName || entityTemplate(row.targetRef) || row.targetRef, row.amount);
    this.lastPartyDamageAt = row.time;
  }

  mergedPlayerEncounters(player) {
    return mergeMinimalWindows(player.encounterWindows || [], this.bossMergeGapSeconds);
  }

  mergedEncounters() {
    const source = this.encounters.map((encounter, index) => ({
      id: index + 1,
      start: encounter.start,
      end: encounter.end,
      duration: Math.max(0, encounter.end - encounter.start),
      damage: encounter.damage,
      hits: encounter.hits,
      bossIds: new Set(encounter.bossIds),
      type: encounter.bossIds.size ? 'boss' : 'mob',
      bosses: mapToSortedEntries(encounter.bossNames, 4).map(item => item.key),
      enemies: mapToSortedEntries(encounter.enemyNames, 4).map(item => item.key)
    }));

    const sameBoss = (a, b) => Array.from(a.bossIds).some(id => b.bossIds.has(id));
    const mergeInto = (target, addition) => {
      target.end = Math.max(target.end, addition.end);
      target.start = Math.min(target.start, addition.start);
      target.duration = Math.max(0, target.end - target.start);
      target.damage += addition.damage;
      target.hits += addition.hits;
      for (const id of addition.bossIds) target.bossIds.add(id);
      target.bosses = Array.from(new Set([...target.bosses, ...addition.bosses])).slice(0, 4);
      target.enemies = Array.from(new Set([...target.enemies, ...addition.enemies])).slice(0, 4);
      if (target.bossIds.size) target.type = 'boss';
      return target;
    };

    const merged = [];
    for (let index = 0; index < source.length; index += 1) {
      const encounter = source[index];
      const previous = merged.at(-1);

      if (previous?.type === 'boss' && encounter.type === 'boss' && sameBoss(previous, encounter) && encounter.start - previous.end <= this.bossMergeGapSeconds) {
        mergeInto(previous, encounter);
        continue;
      }

      if (previous?.type === 'boss' && encounter.type === 'mob') {
        const next = source[index + 1];
        if (
          next?.type === 'boss' &&
          sameBoss(previous, next) &&
          encounter.start - previous.end <= this.bossMergeGapSeconds &&
          next.start - encounter.end <= this.bossMergeGapSeconds
        ) {
          mergeInto(previous, encounter);
          mergeInto(previous, next);
          index += 1;
          continue;
        }
      }

      merged.push(encounter);
    }

    return merged.map((encounter, index) => ({
      id: index + 1,
      start: encounter.start,
      end: encounter.end,
      duration: encounter.duration,
      damage: encounter.damage,
      hits: encounter.hits,
      type: encounter.type,
      label: encounter.type === 'boss'
        ? (encounter.bosses.join(', ') || encounter.enemies.join(', ') || `Boss ${index + 1}`)
        : `Combat ${index + 1}`
    }));
  }

  compactPlayer(player, { includePowers = false, includeTimeline = false } = {}) {
    const duration = player.firstDamage == null || player.lastDamage == null ? 0 : Math.max(0, player.lastDamage - player.firstDamage);
    const mergedPlayerEncounters = this.mergedPlayerEncounters(player);
    const combatTime = mergedPlayerEncounters.reduce((sum, encounter) => sum + Math.max(0, encounter.end - encounter.start), 0);
    const result = {
      ref: player.ref,
      name: player.name,
      damage: player.damage,
      playerDamage: player.playerDamage,
      companionDamage: player.companionDamage,
      hits: player.hits,
      dps: player.damage / Math.max(1, duration),
      combatDps: player.damage / Math.max(1, combatTime),
      duration,
      combatTime,
      encounters: mergedPlayerEncounters.length,
      crit: player.hits ? (player.critHits / player.hits) * 100 : 0,
      flank: player.hits ? (player.flankHits / player.hits) * 100 : 0,
      maxHit: player.maxHit,
      maxPower: player.maxPower,
      healingDone: player.healingDone,
      healingReceived: player.healingReceived,
      damageTaken: player.damageTaken,
      shielded: player.shielded
    };

    if (includePowers) {
      result.powers = Array.from(player.powers.values())
        .map(power => compactPower(power, player.damage))
        .sort((a, b) => b.damage - a.damage || a.power.localeCompare(b.power));
    }

    if (includeTimeline) {
      result.timeline = Array.from(player.timeline.entries())
        .map(([second, damage]) => ({ second, damage }))
        .sort((a, b) => a.second - b.second);
    }

    return result;
  }

  snapshot({ partial = false } = {}) {
    const players = Array.from(this.players.values())
      .map(player => this.compactPlayer(player))
      .filter(player => player.hits || player.damage || player.healingDone || player.damageTaken)
      .sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));
    const combatStart = this.firstPartyDamageAt == null ? 0 : this.firstPartyDamageAt;
    const combatEnd = this.lastPartyDamageAt == null ? combatStart : this.lastPartyDamageAt;
    const encounters = partial ? [] : this.mergedEncounters();
    const activeCombatTime = partial
      ? 0
      : encounters.reduce((sum, encounter) => sum + Math.max(0, encounter.duration), 0);

    return {
      version: 5,
      partial,
      lines: this.lines,
      parsed: this.parsed,
      rejected: this.rejected,
      validDamageRows: this.validDamageRows,
      duration: this.maxTime,
      logDuration: this.maxTime,
      combatStart,
      combatEnd,
      combatDuration: Math.max(0, combatEnd - combatStart),
      activeCombatTime,
      damage: this.damage,
      healing: this.healing,
      shielded: this.shielded,
      players,
      encounters,
      eventTypes: mapToSortedEntries(this.eventTypes, 24),
      unknownTypes: mapToSortedEntries(this.unknownTypes, 24),
      nonCanonicalDamageTypes: mapToSortedEntries(this.nonCanonicalDamageTypes, 24),
      rejectReasons: mapToSortedEntries(this.rejectReasons, 24),
      rejectedSamples: partial ? [] : this.rejectedSamples.slice()
    };
  }

  playerReport(ref) {
    const player = this.players.get(ref);
    return player ? this.compactPlayer(player, { includePowers: true, includeTimeline: true }) : null;
  }
}

export function parseText(text, options = {}) {
  const accumulator = new CombatAccumulator(options);
  const rows = [];
  let lineNo = 0;
  for (const raw of String(text || '').split(/\r?\n/)) {
    lineNo += 1;
    const parsed = parseLine(raw, lineNo);
    if (!parsed.ok) {
      accumulator.reject(lineNo, raw, parsed.reason, parsed.detail);
      continue;
    }
    const row = accumulator.ingest(parsed.row);
    rows.push(row);
  }
  return { rows, summary: accumulator.snapshot(), accumulator };
}

export const FastParser = Object.freeze({
  KNOWN_DAMAGE_TYPES,
  CANONICAL_DAMAGE_TYPES,
  parseTimestamp,
  tokenizeCsv,
  parseFlags,
  parseLine,
  classifyEvent,
  isValidDamage,
  isCompanionRow,
  isPlayerRef,
  isCreatureRef,
  isBossRef,
  isMobRef,
  isPetRef,
  CombatAccumulator,
  parseText
});
