import { CombatAccumulator, FLAG, isBossRef, isPlayerRef, parseLine } from '../engine/fast-parser-core.js';

const CHUNK_ROWS = 32768;
const YIELD_EVERY_LINES = 8000;
const PARTIAL_SUMMARY_MS = 1500;
const PROGRESS_MS = 120;
const FALLBACK_SLICE_BYTES = 8 * 1024 * 1024;
const SCOPE_CACHE_LIMIT = 12;
const ACTIVE_GAP_SECONDS = 5;

const KIND_TO_CODE = Object.freeze({
  unknown: 0,
  damage: 1,
  healing: 2,
  shield: 3,
  'shield-damage': 4,
  resource: 5,
  meta: 6,
  summon: 7,
  control: 8,
  immune: 9
});
const CODE_TO_KIND = Object.freeze(Object.fromEntries(Object.entries(KIND_TO_CODE).map(([key, value]) => [value, key])));

class StringPool {
  constructor() {
    this.values = [''];
    this.ids = new Map([['', 0]]);
  }
  intern(value) {
    const text = String(value || '');
    const existing = this.ids.get(text);
    if (existing != null) return existing;
    const id = this.values.length;
    this.values.push(text);
    this.ids.set(text, id);
    return id;
  }
  id(value) { return this.ids.get(String(value || '')); }
  get(id) { return this.values[id] || ''; }
}

function createChunk() {
  return {
    length: 0,
    time: new Float64Array(CHUNK_ROWS),
    lineNo: new Uint32Array(CHUNK_ROWS),
    ownerName: new Uint32Array(CHUNK_ROWS),
    ownerRef: new Uint32Array(CHUNK_ROWS),
    sourceName: new Uint32Array(CHUNK_ROWS),
    sourceRef: new Uint32Array(CHUNK_ROWS),
    targetName: new Uint32Array(CHUNK_ROWS),
    targetRef: new Uint32Array(CHUNK_ROWS),
    powerName: new Uint32Array(CHUNK_ROWS),
    powerRef: new Uint32Array(CHUNK_ROWS),
    damageType: new Uint32Array(CHUNK_ROWS),
    flagsRaw: new Uint32Array(CHUNK_ROWS),
    amount: new Float64Array(CHUNK_ROWS),
    baseAmount: new Float64Array(CHUNK_ROWS),
    flags: new Uint16Array(CHUNK_ROWS),
    kind: new Uint8Array(CHUNK_ROWS),
    validDamage: new Uint8Array(CHUNK_ROWS),
    companion: new Uint8Array(CHUNK_ROWS)
  };
}

class CompactRowStore {
  constructor() {
    this.pool = new StringPool();
    this.chunks = [];
    this.length = 0;
    this.encounters = new Map();
    this.monotonic = true;
    this.lastTime = Number.NEGATIVE_INFINITY;
  }

  push(row) {
    let chunk = this.chunks.at(-1);
    if (!chunk || chunk.length >= CHUNK_ROWS) {
      chunk = createChunk();
      this.chunks.push(chunk);
    }
    const slot = chunk.length++;
    this.length += 1;
    if (row.time < this.lastTime) this.monotonic = false;
    this.lastTime = Math.max(this.lastTime, row.time);
    chunk.time[slot] = row.time;
    chunk.lineNo[slot] = row.lineNo;
    chunk.ownerName[slot] = this.pool.intern(row.ownerName);
    chunk.ownerRef[slot] = this.pool.intern(row.ownerRef);
    chunk.sourceName[slot] = this.pool.intern(row.sourceName);
    chunk.sourceRef[slot] = this.pool.intern(row.sourceRef);
    chunk.targetName[slot] = this.pool.intern(row.targetName);
    chunk.targetRef[slot] = this.pool.intern(row.targetRef);
    chunk.powerName[slot] = this.pool.intern(row.powerName);
    chunk.powerRef[slot] = this.pool.intern(row.powerRef);
    chunk.damageType[slot] = this.pool.intern(row.damageType);
    chunk.flagsRaw[slot] = this.pool.intern(row.flagsRaw);
    chunk.amount[slot] = row.amount;
    chunk.baseAmount[slot] = row.baseAmount;
    chunk.flags[slot] = row.flags;
    chunk.kind[slot] = KIND_TO_CODE[row.kind] || 0;
    chunk.validDamage[slot] = row.validDamage ? 1 : 0;
    chunk.companion[slot] = row.companion ? 1 : 0;
  }

  location(index) {
    const chunkIndex = Math.floor(index / CHUNK_ROWS);
    const slot = index % CHUNK_ROWS;
    const chunk = this.chunks[chunkIndex];
    return chunk && slot < chunk.length ? { chunk, slot } : null;
  }

  timeAt(index) {
    const location = this.location(index);
    return location ? location.chunk.time[location.slot] : Number.NaN;
  }

  lowerBound(time) {
    let lo = 0;
    let hi = this.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.timeAt(mid) < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  upperBound(time) {
    let lo = 0;
    let hi = this.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.timeAt(mid) <= time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  buildEncounterIndex(encounters = []) {
    this.encounters.clear();
    for (const encounter of encounters) {
      const startIndex = this.monotonic ? this.lowerBound(encounter.start) : 0;
      const endIndex = this.monotonic ? this.upperBound(encounter.end) : this.length;
      const bossTargetIds = new Set();
      const bossNames = new Set();
      for (let index = startIndex; index < endIndex; index += 1) {
        const location = this.location(index);
        if (!location) break;
        const { chunk, slot } = location;
        const time = chunk.time[slot];
        if (time < encounter.start || time > encounter.end) continue;
        const targetRef = this.pool.get(chunk.targetRef[slot]);
        if (!isBossRef(targetRef)) continue;
        bossTargetIds.add(chunk.targetRef[slot]);
        const targetName = this.pool.get(chunk.targetName[slot]);
        if (targetName) bossNames.add(targetName);
      }
      this.encounters.set(Number(encounter.id), {
        ...encounter,
        startIndex,
        endIndex,
        bossTargetIds,
        bosses: Array.from(bossNames)
      });
    }
  }

  scopeInfo(scope = {}) {
    if (!scope || scope.type === 'session' || !scope.type) {
      return { type: 'session', id: null, start: 0, end: activeSummary?.duration || 0, startIndex: 0, endIndex: this.length, targetOnly: false, bossTargetIds: new Set() };
    }
    const encounter = this.encounters.get(Number(scope.id));
    if (!encounter) return null;
    if (scope.type === 'boss' && encounter.type !== 'boss') return null;
    return { ...encounter, type: scope.type, targetOnly: Boolean(scope.targetOnly) };
  }

  row(index) {
    const location = this.location(index);
    if (!location) return null;
    const { chunk, slot } = location;
    return {
      rowIndex: index,
      time: chunk.time[slot],
      lineNo: chunk.lineNo[slot],
      ownerName: this.pool.get(chunk.ownerName[slot]),
      ownerRef: this.pool.get(chunk.ownerRef[slot]),
      sourceName: this.pool.get(chunk.sourceName[slot]),
      sourceRef: this.pool.get(chunk.sourceRef[slot]),
      targetName: this.pool.get(chunk.targetName[slot]),
      targetRef: this.pool.get(chunk.targetRef[slot]),
      powerName: this.pool.get(chunk.powerName[slot]),
      powerRef: this.pool.get(chunk.powerRef[slot]),
      damageType: this.pool.get(chunk.damageType[slot]),
      flagsRaw: this.pool.get(chunk.flagsRaw[slot]),
      amount: chunk.amount[slot],
      baseAmount: chunk.baseAmount[slot],
      flags: chunk.flags[slot],
      kind: CODE_TO_KIND[chunk.kind[slot]] || 'unknown',
      validDamage: Boolean(chunk.validDamage[slot]),
      companion: Boolean(chunk.companion[slot])
    };
  }

  page({ cursor = null, limit = 200, playerRef = '', powerName = '', kind = '', start = null, end = null, scope = null } = {}) {
    const info = this.scopeInfo(scope || { type: 'session' });
    if (!info) return { rows: [], nextCursor: null, scannedTo: 0, totalStoredRows: this.length };
    const rows = [];
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const ownerId = playerRef ? this.pool.id(playerRef) : null;
    const powerId = powerName ? this.pool.id(powerName) : null;
    const kindCode = kind ? KIND_TO_CODE[kind] : null;
    const rangeStart = start == null ? info.start : Math.max(info.start, Number(start));
    const rangeEnd = end == null ? info.end : Math.min(info.end, Number(end));
    let index = cursor == null
      ? (this.monotonic ? Math.max(info.startIndex, this.lowerBound(rangeStart)) : info.startIndex)
      : Math.max(info.startIndex, Number(cursor) || 0);
    const maxIndex = this.monotonic ? Math.min(info.endIndex, this.upperBound(rangeEnd)) : info.endIndex;

    for (; index < maxIndex && rows.length < safeLimit; index += 1) {
      const location = this.location(index);
      if (!location) break;
      const { chunk, slot } = location;
      const time = chunk.time[slot];
      if (time < rangeStart || time > rangeEnd) continue;
      if (ownerId != null && chunk.ownerRef[slot] !== ownerId) continue;
      if (playerRef && ownerId == null) continue;
      if (powerId != null && chunk.powerName[slot] !== powerId) continue;
      if (powerName && powerId == null) continue;
      if (kindCode != null && chunk.kind[slot] !== kindCode) continue;
      if (info.targetOnly && info.bossTargetIds.size && !info.bossTargetIds.has(chunk.targetRef[slot])) continue;
      rows.push(this.row(index));
    }
    return { rows, nextCursor: index < maxIndex ? index : null, scannedTo: index, totalStoredRows: this.length };
  }

  estimatedBytes() {
    const bytesPerRow = 8 + 4 + (10 * 4) + 8 + 8 + 2 + 1 + 1 + 1;
    const stringBytes = this.pool.values.reduce((sum, value) => sum + value.length * 2, 0);
    return this.length * bytesPerRow + stringBytes;
  }
}

let activeGeneration = 0;
let activeStore = null;
let activeAccumulator = null;
let activeFileMeta = null;
let activeSummary = null;
const scopeCache = new Map();

function sleep() { return new Promise(resolve => setTimeout(resolve, 0)); }

async function* readDecodedChunks(file) {
  if (file.stream) {
    const reader = file.stream().getReader();
    const decoder = new TextDecoder();
    let bytesRead = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        bytesRead += result.value.byteLength;
        yield { text: decoder.decode(result.value, { stream: true }), bytesRead };
      }
      const tail = decoder.decode();
      if (tail) yield { text: tail, bytesRead };
    } finally {
      reader.releaseLock();
    }
    return;
  }

  let offset = 0;
  const decoder = new TextDecoder();
  while (offset < file.size) {
    const end = Math.min(file.size, offset + FALLBACK_SLICE_BYTES);
    const buffer = await file.slice(offset, end).arrayBuffer();
    offset = end;
    yield { text: decoder.decode(buffer, { stream: offset < file.size }), bytesRead: offset };
  }
  const tail = decoder.decode();
  if (tail) yield { text: tail, bytesRead: offset };
}

function postProgress(file, phase, bytesRead, lineNo, startedAt) {
  self.postMessage({
    type: 'progress',
    progress: {
      phase,
      bytesRead,
      totalBytes: file.size || 0,
      lineNo,
      parsed: activeAccumulator ? activeAccumulator.parsed : 0,
      rejected: activeAccumulator ? activeAccumulator.rejected : 0,
      storedRows: activeStore ? activeStore.length : 0,
      elapsedMs: performance.now() - startedAt
    }
  });
}

function attachMeta(summary) {
  return Object.assign({}, summary, {
    file: activeFileMeta,
    storedRows: activeStore ? activeStore.length : 0,
    estimatedStoreBytes: activeStore ? activeStore.estimatedBytes() : 0
  });
}

function powerResult(power, totalDamage, duration) {
  return {
    power: power.power,
    damage: power.damage,
    share: totalDamage ? power.damage / totalDamage * 100 : 0,
    hits: power.hits,
    avg: power.hits ? power.damage / power.hits : 0,
    max: power.maxHit,
    crit: power.hits ? power.critHits / power.hits * 100 : 0,
    flank: power.hits ? power.flankHits / power.hits * 100 : 0,
    dps: power.damage / Math.max(1, duration),
    companionDamage: power.companionDamage
  };
}

function createScopedPlayer(ref, name) {
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
    healingDone: 0,
    healingReceived: 0,
    damageTaken: 0,
    shielded: 0,
    firstDamage: null,
    lastDamage: null,
    activeCombatTime: 0,
    powers: new Map(),
    timeline: new Map()
  };
}

function touchPower(player, powerName) {
  let power = player.powers.get(powerName);
  if (!power) {
    power = { power: powerName || 'Unknown', damage: 0, hits: 0, critHits: 0, flankHits: 0, maxHit: 0, companionDamage: 0 };
    player.powers.set(powerName, power);
  }
  return power;
}

function compactScopedPlayer(player, scopeDuration) {
  const duration = player.firstDamage == null || player.lastDamage == null ? 0 : Math.max(0, player.lastDamage - player.firstDamage);
  const combatTime = Math.max(0, player.activeCombatTime);
  return {
    ref: player.ref,
    name: player.name,
    damage: player.damage,
    playerDamage: player.playerDamage,
    companionDamage: player.companionDamage,
    damageShare: 0,
    hits: player.hits,
    dps: player.damage / Math.max(1, duration),
    combatDps: player.damage / Math.max(1, combatTime),
    duration,
    scopeDuration,
    combatTime,
    crit: player.hits ? player.critHits / player.hits * 100 : 0,
    flank: player.hits ? player.flankHits / player.hits * 100 : 0,
    avgHit: player.hits ? player.damage / player.hits : 0,
    maxHit: player.maxHit,
    maxPower: player.maxPower,
    healingDone: player.healingDone,
    healingReceived: player.healingReceived,
    damageTaken: player.damageTaken,
    shielded: player.shielded,
    powers: Array.from(player.powers.values()).map(power => powerResult(power, player.damage, duration)).sort((a, b) => b.damage - a.damage || a.power.localeCompare(b.power)),
    timeline: Array.from(player.timeline.entries()).map(([second, damage]) => ({ second, damage })).sort((a, b) => a.second - b.second)
  };
}

function activeTimeFromSortedTimes(times) {
  if (!times || times.length < 2) return 0;
  let total = 0;
  let previous = times[0];
  for (let index = 1; index < times.length; index += 1) {
    const current = times[index];
    const gap = current - previous;
    if (gap >= 0 && gap <= ACTIVE_GAP_SECONDS) total += gap;
    previous = current;
  }
  return total;
}

function cacheSet(key, value) {
  if (scopeCache.has(key)) scopeCache.delete(key);
  scopeCache.set(key, value);
  while (scopeCache.size > SCOPE_CACHE_LIMIT) scopeCache.delete(scopeCache.keys().next().value);
}

function scopeKey(scope) {
  if (!scope || !scope.type || scope.type === 'session') return 'session';
  return `${scope.type}:${Number(scope.id)}:${scope.targetOnly ? 'target' : 'window'}`;
}

function sessionReport() {
  const key = 'session';
  const cached = scopeCache.get(key);
  if (cached) return cached;
  const summary = activeSummary || attachMeta(activeAccumulator.snapshot());
  const duration = summary.combatDuration ?? summary.duration ?? 0;
  const combatStart = summary.combatStart ?? 0;
  const combatEnd = summary.combatEnd ?? (combatStart + duration);
  const activeCombatTime = summary.activeCombatTime ?? 0;
  const timelineOffset = Math.floor(combatStart);
  const players = (summary.players || []).map(base => {
    const detail = activeAccumulator.playerReport(base.ref);
    const playerDuration = base.duration || 0;
    const powers = (detail?.powers || []).map(power => ({ ...power, dps: power.damage / Math.max(1, playerDuration) }));
    const timeline = (detail?.timeline || []).map(point => ({ second: Math.max(0, point.second - timelineOffset), damage: point.damage }));
    return {
      ...base,
      damageShare: summary.damage ? base.damage / summary.damage * 100 : 0,
      avgHit: base.hits ? base.damage / base.hits : 0,
      powers,
      timeline
    };
  });
  const partyMap = new Map();
  for (const player of players) {
    for (const point of player.timeline || []) partyMap.set(point.second, (partyMap.get(point.second) || 0) + point.damage);
  }
  const report = {
    scope: { type: 'session', id: null, targetOnly: false, label: 'Full session', start: combatStart, end: combatEnd },
    damage: summary.damage || 0,
    hits: summary.validDamageRows || 0,
    duration,
    logDuration: summary.logDuration ?? summary.duration ?? 0,
    activeCombatTime,
    partyDps: (summary.damage || 0) / Math.max(1, duration),
    partyCombatDps: (summary.damage || 0) / Math.max(1, activeCombatTime),
    healing: summary.healing || 0,
    shielded: summary.shielded || 0,
    players: players.sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name)),
    partyTimeline: Array.from(partyMap.entries()).map(([second, damage]) => ({ second, damage })).sort((a, b) => a.second - b.second)
  };
  cacheSet(key, report);
  return report;
}

function aggregateScope(scope) {
  if (!activeStore || !activeAccumulator) return null;
  const key = scopeKey(scope);
  if (key === 'session') return sessionReport();
  const cached = scopeCache.get(key);
  if (cached) return cached;
  const info = activeStore.scopeInfo(scope);
  if (!info) return null;

  const players = new Map();
  const partyTimeline = new Map();
  let damage = 0;
  let hits = 0;
  let healing = 0;
  let shielded = 0;
  let activeCombatTime = 0;
  let lastPartyDamageAt = null;
  const unorderedPartyTimes = activeStore.monotonic ? null : [];
  const duration = Math.max(0, info.end - info.start);

  const ensurePlayer = (refId, nameId) => {
    const ref = activeStore.pool.get(refId);
    if (!isPlayerRef(ref)) return null;
    let player = players.get(ref);
    if (!player) {
      player = createScopedPlayer(ref, activeStore.pool.get(nameId));
      players.set(ref, player);
    }
    return player;
  };

  for (let index = info.startIndex; index < info.endIndex; index += 1) {
    const location = activeStore.location(index);
    if (!location) break;
    const { chunk, slot } = location;
    const rowTime = chunk.time[slot];
    if (rowTime < info.start || rowTime > info.end) continue;
    const kind = CODE_TO_KIND[chunk.kind[slot]] || 'unknown';
    const owner = ensurePlayer(chunk.ownerRef[slot], chunk.ownerName[slot]);
    const target = ensurePlayer(chunk.targetRef[slot], chunk.targetName[slot]);
    const amount = chunk.amount[slot];

    if (kind === 'healing') {
      const value = Math.abs(amount);
      healing += value;
      if (owner) owner.healingDone += value;
      if (target) target.healingReceived += value;
    }
    if (kind === 'shield' && target) {
      const value = Math.abs(amount);
      shielded += value;
      target.shielded += value;
    }
    if (chunk.validDamage[slot] && target && amount > 0) target.damageTaken += amount;

    if (!chunk.validDamage[slot] || !owner) continue;
    if (info.targetOnly && info.bossTargetIds.size && !info.bossTargetIds.has(chunk.targetRef[slot])) continue;

    damage += amount;
    hits += 1;
    owner.damage += amount;
    owner.hits += 1;
    if (chunk.companion[slot]) owner.companionDamage += amount;
    else owner.playerDamage += amount;
    if ((chunk.flags[slot] & FLAG.CRITICAL) !== 0) owner.critHits += 1;
    if ((chunk.flags[slot] & (FLAG.FLANK | FLAG.COMBAT_ADVANTAGE)) !== 0) owner.flankHits += 1;
    const powerName = activeStore.pool.get(chunk.powerName[slot]) || 'Unknown';
    if (amount > owner.maxHit) { owner.maxHit = amount; owner.maxPower = powerName; }
    const relativeTime = Math.max(0, chunk.time[slot] - info.start);
    if (activeStore.monotonic) {
      if (owner.firstDamage == null) owner.firstDamage = relativeTime;
      if (owner.lastDamage != null) {
        const gap = relativeTime - owner.lastDamage;
        if (gap >= 0 && gap <= ACTIVE_GAP_SECONDS) owner.activeCombatTime += gap;
      }
      owner.lastDamage = relativeTime;
      if (lastPartyDamageAt != null) {
        const gap = relativeTime - lastPartyDamageAt;
        if (gap >= 0 && gap <= ACTIVE_GAP_SECONDS) activeCombatTime += gap;
      }
      lastPartyDamageAt = relativeTime;
    } else {
      owner.firstDamage = owner.firstDamage == null ? relativeTime : Math.min(owner.firstDamage, relativeTime);
      owner.lastDamage = owner.lastDamage == null ? relativeTime : Math.max(owner.lastDamage, relativeTime);
      if (!owner.damageTimes) owner.damageTimes = [];
      owner.damageTimes.push(relativeTime);
      unorderedPartyTimes.push(relativeTime);
    }

    const power = touchPower(owner, powerName);
    power.damage += amount;
    power.hits += 1;
    if ((chunk.flags[slot] & FLAG.CRITICAL) !== 0) power.critHits += 1;
    if ((chunk.flags[slot] & (FLAG.FLANK | FLAG.COMBAT_ADVANTAGE)) !== 0) power.flankHits += 1;
    if (amount > power.maxHit) power.maxHit = amount;
    if (chunk.companion[slot]) power.companionDamage += amount;

    const second = Math.floor(relativeTime);
    owner.timeline.set(second, (owner.timeline.get(second) || 0) + amount);
    partyTimeline.set(second, (partyTimeline.get(second) || 0) + amount);
  }

  if (!activeStore.monotonic) {
    unorderedPartyTimes.sort((a, b) => a - b);
    activeCombatTime = activeTimeFromSortedTimes(unorderedPartyTimes);
    for (const player of players.values()) {
      if (!player.damageTimes) continue;
      player.damageTimes.sort((a, b) => a - b);
      player.activeCombatTime = activeTimeFromSortedTimes(player.damageTimes);
      delete player.damageTimes;
    }
  }

  const compactPlayers = Array.from(players.values())
    .map(player => compactScopedPlayer(player, duration))
    .filter(player => player.damage || player.healingDone || player.damageTaken)
    .sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));
  for (const player of compactPlayers) player.damageShare = damage ? player.damage / damage * 100 : 0;

  const report = {
    scope: {
      type: info.type,
      id: info.id,
      targetOnly: info.targetOnly,
      label: info.label,
      bosses: info.bosses || [],
      start: info.start,
      end: info.end
    },
    damage,
    hits,
    duration,
    activeCombatTime,
    partyDps: damage / Math.max(1, duration),
    partyCombatDps: damage / Math.max(1, activeCombatTime),
    healing,
    shielded,
    players: compactPlayers,
    partyTimeline: Array.from(partyTimeline.entries()).map(([second, bucketDamage]) => ({ second, damage: bucketDamage })).sort((a, b) => a.second - b.second)
  };
  cacheSet(key, report);
  return report;
}

function selectPlayers(report, playerRefs = []) {
  if (!report) return null;
  if (!Array.isArray(playerRefs) || !playerRefs.length) return report;
  const wanted = new Set(playerRefs);
  return { ...report, players: report.players.filter(player => wanted.has(player.ref)) };
}

async function parseFile(file, generation) {
  const startedAt = performance.now();
  activeStore = new CompactRowStore();
  activeAccumulator = new CombatAccumulator();
  activeSummary = null;
  activeFileMeta = { name: file.name || 'combat.log', size: file.size || 0, type: file.type || '' };
  scopeCache.clear();
  let lineNo = 0;
  let carry = '';
  let lastProgressAt = 0;
  let lastPartialAt = 0;
  let bytesRead = 0;

  for await (const chunk of readDecodedChunks(file)) {
    if (generation !== activeGeneration) return;
    bytesRead = chunk.bytesRead;
    const text = carry + chunk.text;
    const lines = text.split(/\r?\n/);
    carry = lines.pop() || '';

    for (const raw of lines) {
      lineNo += 1;
      const parsed = parseLine(raw, lineNo);
      if (!parsed.ok) activeAccumulator.reject(lineNo, raw, parsed.reason, parsed.detail);
      else activeStore.push(activeAccumulator.ingest(parsed.row));

      if (lineNo % YIELD_EVERY_LINES === 0) {
        const now = performance.now();
        if (now - lastProgressAt >= PROGRESS_MS) {
          postProgress(file, 'parsing', bytesRead, lineNo, startedAt);
          lastProgressAt = now;
        }
        if (now - lastPartialAt >= PARTIAL_SUMMARY_MS) {
          self.postMessage({ type: 'partial-summary', summary: attachMeta(activeAccumulator.snapshot({ partial: true })) });
          lastPartialAt = now;
        }
        await sleep();
        if (generation !== activeGeneration) return;
      }
    }
  }

  if (carry.trim()) {
    lineNo += 1;
    const parsed = parseLine(carry, lineNo);
    if (!parsed.ok) activeAccumulator.reject(lineNo, carry, parsed.reason, parsed.detail);
    else activeStore.push(activeAccumulator.ingest(parsed.row));
  }

  postProgress(file, 'indexing', bytesRead, lineNo, startedAt);
  activeSummary = attachMeta(activeAccumulator.snapshot());
  activeStore.buildEncounterIndex(activeSummary.encounters);
  postProgress(file, 'finalizing', bytesRead, lineNo, startedAt);
  activeSummary.parseMs = Math.round(performance.now() - startedAt);
  self.postMessage({ type: 'summary', summary: activeSummary });
  self.postMessage({ type: 'done', summary: activeSummary });
}

self.onmessage = event => {
  const message = event.data || {};
  if (message.type === 'parse') {
    activeGeneration += 1;
    const generation = activeGeneration;
    parseFile(message.file, generation).catch(error => {
      if (generation !== activeGeneration) return;
      self.postMessage({ type: 'error', message: error?.message || String(error) });
    });
    return;
  }
  if (message.type === 'cancel') {
    activeGeneration += 1;
    return;
  }
  if (message.type === 'dispose') {
    activeGeneration += 1;
    activeStore = null;
    activeAccumulator = null;
    activeSummary = null;
    activeFileMeta = null;
    scopeCache.clear();
    return;
  }
  if (message.type === 'player-report') {
    const report = activeAccumulator ? activeAccumulator.playerReport(message.playerRef) : null;
    self.postMessage({ type: 'player-report', requestId: message.requestId, report });
    return;
  }
  if (message.type === 'scope-report') {
    const report = selectPlayers(aggregateScope(message.scope || { type: 'session' }), message.playerRefs || []);
    self.postMessage({ type: 'scope-report', requestId: message.requestId, report });
    return;
  }
  if (message.type === 'raw-page') {
    const page = activeStore ? activeStore.page(message.options || {}) : { rows: [], nextCursor: null, scannedTo: 0, totalStoredRows: 0 };
    self.postMessage({ type: 'raw-page', requestId: message.requestId, page });
    return;
  }
  if (message.type === 'diagnostics') {
    const summary = activeSummary || (activeAccumulator ? attachMeta(activeAccumulator.snapshot()) : null);
    self.postMessage({ type: 'diagnostics', requestId: message.requestId, summary });
  }
};
