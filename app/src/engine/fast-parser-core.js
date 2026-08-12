const DAMAGE_TYPES = new Set([
  'physical', 'arcane', 'cold', 'fire', 'lightning', 'necrotic',
  'poison', 'psychic', 'radiant', 'thunder', 'force', 'untyped'
]);

export const FLAG = Object.freeze({
  CRITICAL: 1 << 0,
  FLANK: 1 << 1,
  COMBAT_ADVANTAGE: 1 << 2,
  SHOW_POWER_DISPLAY_NAME: 1 << 3,
  IMMUNE: 1 << 4
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
  const match = normalizeText(value).match(/^C\[(?:\d+)\s+(.+)\]$/);
  return match ? match[1] : '';
}

export function isBossRef(value) {
  return entityTemplate(value).includes('_Boss');
}

export function isMobRef(value) {
  const template = entityTemplate(value);
  return !template.includes('_Boss') && ['_Solo', '_Elite', '_Standard', '_Minion'].some(token => template.includes(token));
}

export function isPetRef(value) {
  return PET_RE.test(entityTemplate(value));
}

export function parseTimestamp(raw) {
  const text = normalizeText(raw);
  if (!text) return Number.NaN;

  const parts = text.split(':');
  if (parts.length >= 4) {
    const second = Number(parts.at(-1));
    const minute = Number(parts.at(-2));
    const hour = Number(parts.at(-3));
    const day = parts.length >= 6 ? Number(parts.at(-4)) : 0;
    if ([second, minute, hour, day].every(Number.isFinite)) {
      return day * 86400 + hour * 3600 + minute * 60 + second;
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
  if (row.amount > 0 && DAMAGE_TYPES.has(type)) return 'damage';
  return 'unknown';
}

export function isValidDamage(row) {
  if (classifyEvent(row) !== 'damage') return false;
  if (row.amount <= 0) return false;
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
    activeCombatTime: 0,
    healingDone: 0,
    healingReceived: 0,
    damageTaken: 0,
    shielded: 0,
    powers: new Map(),
    timeline: new Map()
  };
}

function updatePower(player, row) {
  let power = player.powers.get(row.powerName);
  if (!power) {
    power = {
      power: row.powerName,
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
    damage: power.damage,
    hits: power.hits,
    share: totalDamage ? (power.damage / totalDamage) * 100 : 0,
    avg: power.hits ? power.damage / power.hits : 0,
    max: power.maxHit,
    crit: power.hits ? (power.critHits / power.hits) * 100 : 0,
    flank: power.hits ? (power.flankHits / power.hits) * 100 : 0,
    companionDamage: power.companionDamage
  };
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
    this.rejectReasons = new Map();
    this.rejectedSamples = [];
    this.encounters = [];
    this.currentEncounter = null;
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

  ingest(row) {
    this.lines = Math.max(this.lines, row.lineNo || this.lines + 1);
    this.parsed += 1;
    if (this.firstAbs == null) this.firstAbs = row.abs;
    row.time = Math.max(0, row.abs - this.firstAbs);
    this.maxTime = Math.max(this.maxTime, row.time);

    addCount(this.eventTypes, row.damageType || 'Unknown');
    if (row.kind === 'unknown') addCount(this.unknownTypes, row.damageType || 'Unknown');

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

    if (row.kind === 'damage' && targetPlayer && row.amount > 0) targetPlayer.damageTaken += row.amount;

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

    if (ownerPlayer.firstDamage == null) ownerPlayer.firstDamage = row.time;
    if (ownerPlayer.lastDamage != null) {
      const gap = row.time - ownerPlayer.lastDamage;
      if (gap >= 0 && gap <= this.encounterGapSeconds) ownerPlayer.activeCombatTime += gap;
    }
    ownerPlayer.lastDamage = row.time;
    updatePower(ownerPlayer, row);

    const secondBucket = Math.floor(row.time);
    ownerPlayer.timeline.set(secondBucket, (ownerPlayer.timeline.get(secondBucket) || 0) + row.amount);
    this.updateEncounter(row);
    return row;
  }

  updateEncounter(row) {
    const needsNew = this.lastPartyDamageAt == null || row.time - this.lastPartyDamageAt > this.encounterGapSeconds;
    if (needsNew) {
      this.currentEncounter = {
        start: row.time,
        end: row.time,
        damage: 0,
        hits: 0,
        bossIds: new Set(),
        enemyNames: new Map()
      };
      this.encounters.push(this.currentEncounter);
    }

    const encounter = this.currentEncounter;
    encounter.end = row.time;
    encounter.damage += row.amount;
    encounter.hits += 1;
    if (isBossRef(row.targetRef)) encounter.bossIds.add(row.targetRef);
    if (isCreatureRef(row.targetRef) && !isPetRef(row.targetRef)) addCount(encounter.enemyNames, row.targetName || entityTemplate(row.targetRef) || row.targetRef, row.amount);
    this.lastPartyDamageAt = row.time;
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
      enemies: mapToSortedEntries(encounter.enemyNames, 4).map(item => item.key)
    }));

    const merged = [];
    const sameBoss = (a, b) => Array.from(a.bossIds).some(id => b.bossIds.has(id));
    for (const encounter of source) {
      const previous = merged.at(-1);
      if (previous && previous.type === 'boss' && encounter.type === 'boss' && sameBoss(previous, encounter) && encounter.start - previous.end <= this.bossMergeGapSeconds) {
        previous.end = encounter.end;
        previous.duration = previous.end - previous.start;
        previous.damage += encounter.damage;
        previous.hits += encounter.hits;
        for (const id of encounter.bossIds) previous.bossIds.add(id);
        previous.enemies = Array.from(new Set([...previous.enemies, ...encounter.enemies])).slice(0, 4);
      } else {
        merged.push(encounter);
      }
    }

    return merged.map((encounter, index) => ({
      id: index + 1,
      start: encounter.start,
      end: encounter.end,
      duration: encounter.duration,
      damage: encounter.damage,
      hits: encounter.hits,
      type: encounter.type,
      label: encounter.type === 'boss' ? (encounter.enemies.join(', ') || `Boss ${index + 1}`) : `Combat ${index + 1}`
    }));
  }

  compactPlayer(player, { includePowers = false, includeTimeline = false } = {}) {
    const duration = player.firstDamage == null || player.lastDamage == null ? 0 : Math.max(0, player.lastDamage - player.firstDamage);
    const combatTime = Math.max(0, player.activeCombatTime);
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

    return {
      version: 3,
      partial,
      lines: this.lines,
      parsed: this.parsed,
      rejected: this.rejected,
      validDamageRows: this.validDamageRows,
      duration: this.maxTime,
      damage: this.damage,
      healing: this.healing,
      shielded: this.shielded,
      players,
      encounters: partial ? [] : this.mergedEncounters(),
      eventTypes: mapToSortedEntries(this.eventTypes, 24),
      unknownTypes: mapToSortedEntries(this.unknownTypes, 24),
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
  DAMAGE_TYPES,
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
