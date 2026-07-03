self.window = self;
importScripts('../engine/combat-engine.js');
try { importScripts('../../class-power-map.js', '../features/category-clarity-layer.js'); } catch (_) {}
importScripts('../engine/summary-engine.js');
importScripts('../engine/artifact-window-engine.js');

self.onmessage = async function(event){
  const message = event.data || {};
  if(message.type !== 'parse') return;
  try {
    const file = message.file;
    const startedAt = Date.now();
    const rows = await self.NWParser.parseFile(file, {
      onProgress(progress){
        self.postMessage({ type:'progress', progress });
      }
    });
    const meta = rows.meta || {};
    self.postMessage({ type:'progress', progress: { phase:'building summary', rows: rows.length, lines: meta.lines || rows.length, bytes: meta.bytes || 0, total: meta.totalBytes || file.size || 0 } });
    let report = null;
    if(self.SGSummaryEngine){
      report = self.SGSummaryEngine.buildReport(rows, { includeCompanions: true });
      report.parseMs = Date.now() - startedAt;
    }
    if(self.SGArtifactWindow){
      self.postMessage({ type:'progress', progress: { phase:'building arti calls', rows: rows.length, lines: meta.lines || rows.length, bytes: meta.bytes || 0, total: meta.totalBytes || file.size || 0 } });
      const players = report && report.players ? report.players : self.NWParser.detectPlayers(rows);
      const artiCall = self.SGArtifactWindow.analyze(rows, players);
      if(report) report.artiCall = artiCall;
    }
    if(report) self.postMessage({ type:'summary', report });
    if(message.summaryOnly){
      self.postMessage({ type:'done', rows: [], meta: Object.assign({}, meta, { summaryOnly: true, rowCount: rows.length }) });
      return;
    }
    self.postMessage({ type:'progress', progress: { phase:'hydrating details', rows: rows.length, lines: meta.lines || rows.length, bytes: meta.bytes || 0, total: meta.totalBytes || file.size || 0 } });
    const plainRows = Array.from(rows);
    self.postMessage({ type:'done', rows: plainRows, meta });
  } catch (error) {
    self.postMessage({ type:'error', message: error && error.message ? error.message : String(error) });
  }
};
