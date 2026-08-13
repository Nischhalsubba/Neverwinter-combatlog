(() => {
  const NativeWorker = window.Worker;
  if (!NativeWorker || window.__strikeglassWorkerBridgeInstalled) return;

  window.__strikeglassWorkerBridgeInstalled = true;
  window.__strikeglassWorker = null;

  class StrikeglassWorker extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      const value = String(url || '');
      if (value.includes('fast-parse-worker')) window.__strikeglassWorker = this;
    }
  }

  Object.defineProperty(window, 'Worker', {
    configurable: true,
    writable: true,
    value: StrikeglassWorker
  });
})();
