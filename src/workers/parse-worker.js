self.window = self;
importScripts('../engine/combat-engine.js');

self.onmessage = async function(event){
  const message = event.data || {};
  if(message.type !== 'parse') return;
  try {
    const file = message.file;
    const rows = await self.NWParser.parseFile(file, {
      onProgress(progress){
        self.postMessage({ type:'progress', progress });
      }
    });
    const meta = rows.meta || {};
    const plainRows = Array.from(rows);
    self.postMessage({ type:'done', rows: plainRows, meta });
  } catch (error) {
    self.postMessage({ type:'error', message: error && error.message ? error.message : String(error) });
  }
};
