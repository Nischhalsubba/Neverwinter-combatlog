import { CombatAccumulator, parseLine } from '../engine/fast-parser-core.js';

const CHUNK_ROWS = 32768;
const YIELD_EVERY_LINES = 8000;
const PARTIAL_SUMMARY_MS = 1500;
const PROGRESS_MS = 120;
const FALLBACK_SLICE_BYTES = 8 * 1024 * 1024;

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
    time: new Float64Array(CHUNK_ROWS), lineNo: new Uint32Array(CHUNK_ROWS),
    ownerName: new Uint32Array(CHUNK_ROWS), ownerRef: new Uint32Array(CHUNK_ROWS), sourceName: new Uint32Array(CHUNK_ROWS), sourceRef: new Uint32Array(CHUNK_ROWS), targetName: new Uint32Array(CHUNK_ROWS), targetRef: new Uint32Array(CHUNK_ROWS), powerName: new Uint32Array(CHUNK_ROWS), powerRef: new Uint32Array(CHUNK_ROWS), damageType: new Uint32Array(CHUNK_ROWS), flagsRaw: new Uint32Array(CHUNK_ROWS),
    amount: new Float64Array(CHUNK_ROWS), baseAmount: new Float64Array(CHUNK_ROWS), flags: new Uint16Array(CHUNK_ROWS), kind: new Uint8Array(CHUNK_ROWS), validDamage: new Uint8Array(CHUNK_ROWS), companion: new Uint8Array(CHUNK_ROWS)
  };
}

class CompactRowStore {
  constructor() { this.pool = new StringPool(); this.chunks = []; this.length = 0; }
  push(row) {
    let chunk = this.chunks.at(-1);
    if (!chunk || chunk.length >= CHUNK_ROWS) { chunk = createChunk(); this.chunks.push(chunk); }
    const slot = chunk.length++; this.length += 1;
    chunk.time[slot] = row.time; chunk.lineNo[slot] = row.lineNo;
    chunk.ownerName[slot] = this.pool.intern(row.ownerName); chunk.ownerRef[slot] = this.pool.intern(row.ownerRef); chunk.sourceName[slot] = this.pool.intern(row.sourceName); chunk.sourceRef[slot] = this.pool.intern(row.sourceRef); chunk.targetName[slot] = this.pool.intern(row.targetName); chunk.targetRef[slot] = this.pool.intern(row.targetRef); chunk.powerName[slot] = this.pool.intern(row.powerName); chunk.powerRef[slot] = this.pool.intern(row.powerRef); chunk.damageType[slot] = this.pool.intern(row.damageType); chunk.flagsRaw[slot] = this.pool.intern(row.flagsRaw);
    chunk.amount[slot] = row.amount; chunk.baseAmount[slot] = row.baseAmount; chunk.flags[slot] = row.flags; chunk.kind[slot] = KIND_TO_CODE[row.kind] || 0; chunk.validDamage[slot] = row.validDamage ? 1 : 0; chunk.companion[slot] = row.companion ? 1 : 0;
  }
  location(index) { const chunkIndex = Math.floor(index / CHUNK_ROWS); const slot = index % CHUNK_ROWS; const chunk = this.chunks[chunkIndex]; return chunk && slot < chunk.length ? { chunk, slot } : null; }
  row(index) {
    const location = this.location(index); if (!location) return null; const { chunk, slot } = location;
    return { rowIndex: index, time: chunk.time[slot], lineNo: chunk.lineNo[slot], ownerName: this.pool.get(chunk.ownerName[slot]), ownerRef: this.pool.get(chunk.ownerRef[slot]), sourceName: this.pool.get(chunk.sourceName[slot]), sourceRef: this.pool.get(chunk.sourceRef[slot]), targetName: this.pool.get(chunk.targetName[slot]), targetRef: this.pool.get(chunk.targetRef[slot]), powerName: this.pool.get(chunk.powerName[slot]), powerRef: this.pool.get(chunk.powerRef[slot]), damageType: this.pool.get(chunk.damageType[slot]), flagsRaw: this.pool.get(chunk.flagsRaw[slot]), amount: chunk.amount[slot], baseAmount: chunk.baseAmount[slot], flags: chunk.flags[slot], kind: CODE_TO_KIND[chunk.kind[slot]] || 'unknown', validDamage: Boolean(chunk.validDamage[slot]), companion: Boolean(chunk.companion[slot]) };
  }
  page({ cursor = 0, limit = 200, playerRef = '', powerName = '', kind = '', start = null, end = null } = {}) {
    const rows = []; const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200)); const ownerId = playerRef ? this.pool.id(playerRef) : null; const powerId = powerName ? this.pool.id(powerName) : null; const kindCode = kind ? KIND_TO_CODE[kind] : null; let index = Math.max(0, Number(cursor) || 0);
    for (; index < this.length && rows.length < safeLimit; index += 1) {
      const location = this.location(index); if (!location) break; const { chunk, slot } = location; const time = chunk.time[slot];
      if (ownerId != null && chunk.ownerRef[slot] !== ownerId) continue; if (playerRef && ownerId == null) continue; if (powerId != null && chunk.powerName[slot] !== powerId) continue; if (powerName && powerId == null) continue; if (kindCode != null && chunk.kind[slot] !== kindCode) continue; if (start != null && time < Number(start)) continue; if (end != null && time > Number(end)) continue;
      rows.push(this.row(index));
    }
    return { rows, nextCursor: index < this.length ? index : null, scannedTo: index, totalStoredRows: this.length };
  }
  estimatedBytes() { const bytesPerRow = 8 + 4 + (10 * 4) + 8 + 8 + 2 + 1 + 1 + 1; const stringBytes = this.pool.values.reduce((sum, value) => sum + value.length * 2, 0); return this.length * bytesPerRow + stringBytes; }
}

let activeGeneration = 0, activeStore = null, activeAccumulator = null, activeFileMeta = null;
function sleep() { return new Promise(resolve => setTimeout(resolve, 0)); }
async function* readDecodedChunks(file) {
  if (file.stream) {
    const reader = file.stream().getReader(); const decoder = new TextDecoder(); let bytesRead = 0;
    try { while (true) { const result = await reader.read(); if (result.done) break; bytesRead += result.value.byteLength; yield { text: decoder.decode(result.value, { stream: true }), bytesRead }; } const tail = decoder.decode(); if (tail) yield { text: tail, bytesRead }; }
    finally { reader.releaseLock(); }
    return;
  }
  let offset = 0; const decoder = new TextDecoder();
  while (offset < file.size) { const end = Math.min(file.size, offset + FALLBACK_SLICE_BYTES); const buffer = await file.slice(offset, end).arrayBuffer(); offset = end; yield { text: decoder.decode(buffer, { stream: offset < file.size }), bytesRead: offset }; }
  const tail = decoder.decode(); if (tail) yield { text: tail, bytesRead: offset };
}
function postProgress(file, phase, bytesRead, lineNo, startedAt) { self.postMessage({ type: 'progress', progress: { phase, bytesRead, totalBytes: file.size || 0, lineNo, parsed: activeAccumulator ? activeAccumulator.parsed : 0, rejected: activeAccumulator ? activeAccumulator.rejected : 0, storedRows: activeStore ? activeStore.length : 0, elapsedMs: performance.now() - startedAt } }); }
function attachMeta(summary) { return Object.assign({}, summary, { file: activeFileMeta, storedRows: activeStore ? activeStore.length : 0, estimatedStoreBytes: activeStore ? activeStore.estimatedBytes() : 0 }); }

async function parseFile(file, generation) {
  const startedAt = performance.now(); activeStore = new CompactRowStore(); activeAccumulator = new CombatAccumulator(); activeFileMeta = { name: file.name || 'combat.log', size: file.size || 0, type: file.type || '' };
  let lineNo = 0, carry = '', lastProgressAt = 0, lastPartialAt = 0, bytesRead = 0;
  for await (const chunk of readDecodedChunks(file)) {
    if (generation !== activeGeneration) return; bytesRead = chunk.bytesRead; const text = carry + chunk.text; const lines = text.split(/\r?\n/); carry = lines.pop() || '';
    for (const raw of lines) {
      lineNo += 1; const parsed = parseLine(raw, lineNo); if (!parsed.ok) activeAccumulator.reject(lineNo, raw, parsed.reason, parsed.detail); else activeStore.push(activeAccumulator.ingest(parsed.row));
      if (lineNo % YIELD_EVERY_LINES === 0) { const now = performance.now(); if (now - lastProgressAt >= PROGRESS_MS) { postProgress(file, 'parsing', bytesRead, lineNo, startedAt); lastProgressAt = now; } if (now - lastPartialAt >= PARTIAL_SUMMARY_MS) { self.postMessage({ type: 'partial-summary', summary: attachMeta(activeAccumulator.snapshot({ partial: true })) }); lastPartialAt = now; } await sleep(); if (generation !== activeGeneration) return; }
    }
  }
  if (carry.trim()) { lineNo += 1; const parsed = parseLine(carry, lineNo); if (!parsed.ok) activeAccumulator.reject(lineNo, carry, parsed.reason, parsed.detail); else activeStore.push(activeAccumulator.ingest(parsed.row)); }
  postProgress(file, 'finalizing', bytesRead, lineNo, startedAt); const summary = attachMeta(activeAccumulator.snapshot()); summary.parseMs = Math.round(performance.now() - startedAt); self.postMessage({ type: 'summary', summary }); self.postMessage({ type: 'done', summary });
}

self.onmessage = event => {
  const message = event.data || {};
  if (message.type === 'parse') { activeGeneration += 1; const generation = activeGeneration; parseFile(message.file, generation).catch(error => { if (generation !== activeGeneration) return; self.postMessage({ type: 'error', message: error && error.message ? error.message : String(error) }); }); return; }
  if (message.type === 'cancel') { activeGeneration += 1; return; }
  if (message.type === 'dispose') { activeGeneration += 1; activeStore = null; activeAccumulator = null; activeFileMeta = null; return; }
  if (message.type === 'player-report') { const report = activeAccumulator ? activeAccumulator.playerReport(message.playerRef) : null; self.postMessage({ type: 'player-report', requestId: message.requestId, report }); return; }
  if (message.type === 'raw-page') { const page = activeStore ? activeStore.page(message.options || {}) : { rows: [], nextCursor: null, scannedTo: 0, totalStoredRows: 0 }; self.postMessage({ type: 'raw-page', requestId: message.requestId, page }); return; }
  if (message.type === 'diagnostics') { const summary = activeAccumulator ? attachMeta(activeAccumulator.snapshot()) : null; self.postMessage({ type: 'diagnostics', requestId: message.requestId, summary }); }
};
