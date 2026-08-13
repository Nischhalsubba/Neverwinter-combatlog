let requestSequence = 0;

export function currentPlayerRef() {
  return document.getElementById('player-select')?.value || '';
}

export function currentScope() {
  const value = document.getElementById('encounter-select')?.value || 'session';
  if (value === 'session') return { type: 'session' };
  const [type, idText] = value.split(':');
  const id = Number(idText);
  if (!Number.isFinite(id)) return { type: 'session' };
  return {
    type: type === 'boss' ? 'boss' : 'encounter',
    id,
    targetOnly: type === 'boss' && Boolean(document.getElementById('boss-target-only')?.checked)
  };
}

export function workerRequest(type, payload = {}, timeoutMs = 30000) {
  const worker = window.__strikeglassWorker || null;
  if (!worker) return Promise.reject(new Error('The combat-data worker is not ready yet.'));
  const requestId = `power-popup:${Date.now()}:${++requestSequence}`;
  return new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const onMessage = event => {
      const message = event.data || {};
      if (message.requestId !== requestId || message.type === 'task-progress') return;
      cleanup();
      if (message.error) return reject(new Error(message.error));
      if ('report' in message) resolve(message.report);
      else if ('page' in message) resolve(message.page);
      else resolve(message);
    };
    worker.addEventListener('message', onMessage);
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Power details took too long to load.'));
    }, timeoutMs);
    worker.postMessage({ type, requestId, ...payload });
  });
}
