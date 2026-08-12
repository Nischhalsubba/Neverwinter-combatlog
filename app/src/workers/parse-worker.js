self.window = self;
importScripts('../engine/combat-engine.js');
try { importScripts('../../class-power-map.js', '../features/category-clarity-layer.js'); } catch (_) {}
try { importScripts('../data/artifact-catalog.js'); } catch (_) {}
importScripts('../engine/summary-engine.js');
importScripts('../engine/artifact-window-engine.js');

let currentRows = null;
let currentPlayers = null;

function plainEncounter(encounter, index){
  return {
    id: encounter.id || index + 1,
    label: encounter.label,
    type: encounter.type,
    visible: !!encounter.visible,
    start: Number(encounter.start || 0),
    end: Number(encounter.end || 0),
    duration: Number(encounter.duration || 0)
  };
}
function rowsInEncounter(rows, encounter){
  if(!encounter) return rows;
  const start = Number(encounter.start || 0);
  const end = Number(encounter.end || start);
  return rows.filter(row => row.time >= start && row.time <= end);
}
function buildArtifact(options){
  if(!currentRows || !self.SGArtifactWindow) return null;
  const players = currentPlayers || self.NWParser.detectPlayers(currentRows);
  return self.SGArtifactWindow.analyze(currentRows, players, options || {});
}
function buildPlayerReport(options){
  if(!currentRows || !self.SGSummaryEngine) return null;
  const rows = currentRows;
  const includeCompanions = !options || options.includeCompanions !== false;
  const players = currentPlayers || self.NWParser.detectPlayers(rows);
  const player = players.find(item => item.id === options.playerId) || players[0];
  if(!player) return null;
  const encountersRaw = self.NWParser.buildEncounters(rows, player.id, options.mode || 'player');
  const encounterId = options.encounterId == null ? 'all' : String(options.encounterId);
  const selectedEncounter = encounterId === 'all' ? null : encountersRaw.find(item => String(item.id) === encounterId);
  const scopedRows = selectedEncounter ? rowsInEncounter(rows, selectedEncounter) : rows;
  const activeEncounters = selectedEncounter ? [selectedEncounter] : encountersRaw;
  const base = self.SGSummaryEngine.playerMetricSummary(scopedRows, player, activeEncounters, { includeCompanions });
  const enriched = self.SGSummaryEngine.enrichPlayer(scopedRows, base, { includeCompanions });
  return {
    player: enriched,
    playerId: player.id,
    encounterId,
    rowCount: scopedRows.length,
    totalRows: rows.length,
    encounters: encountersRaw.map(plainEncounter),
    visibleEncounters: encountersRaw.filter(item => item.visible).slice(0, 24).map(plainEncounter)
  };
}

self.onmessage = async function(event){
  const message = event.data || {};
  if(message.type === 'artifact'){
    try {
      const report = buildArtifact(message.options || {});
      self.postMessage({ type:'artifact', requestId: message.requestId, report });
    } catch (error) {
      self.postMessage({ type:'artifact-error', requestId: message.requestId, message: error && error.message ? error.message : String(error) });
    }
    return;
  }
  if(message.type === 'player-report'){
    try {
      const report = buildPlayerReport(message.options || {});
      self.postMessage({ type:'player-report', requestId: message.requestId, report });
    } catch (error) {
      self.postMessage({ type:'player-report-error', requestId: message.requestId, message: error && error.message ? error.message : String(error) });
    }
    return;
  }
  if(message.type === 'dispose'){
    currentRows = null;
    currentPlayers = null;
    self.close();
    return;
  }
  if(message.type !== 'parse') return;
  try {
    const file = message.file;
    const startedAt = Date.now();
    currentRows = await self.NWParser.parseFile(file, {
      onProgress(progress){
        self.postMessage({ type:'progress', progress });
      }
    });
    const rows = currentRows;
    const meta = rows.meta || {};
    self.postMessage({ type:'progress', progress: { phase:'building summary', rows: rows.length, lines: meta.lines || rows.length, bytes: meta.bytes || 0, total: meta.totalBytes || file.size || 0 } });
    let report = null;
    if(self.SGSummaryEngine){
      report = self.SGSummaryEngine.buildReport(rows, { includeCompanions: true });
      report.parseMs = Date.now() - startedAt;
      currentPlayers = report && report.players ? report.players : self.NWParser.detectPlayers(rows);
    } else {
      currentPlayers = self.NWParser.detectPlayers(rows);
    }
    if(report) self.postMessage({ type:'summary', report });
    self.postMessage({ type:'done', rows: [], meta: Object.assign({}, meta, { summaryOnly: true, rowCount: rows.length, workerResident: true }) });
  } catch (error) {
    self.postMessage({ type:'error', message: error && error.message ? error.message : String(error) });
  }
};
