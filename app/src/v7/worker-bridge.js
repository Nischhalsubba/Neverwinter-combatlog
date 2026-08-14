(() => {
  if (window.StrikeglassWorkerBridge || typeof window.Worker !== 'function') return;
  const NativeWorker = window.Worker;
  const bridge = { mainWorker: null };

  window.Worker = new Proxy(NativeWorker, {
    construct(Target, args) {
      const worker = Reflect.construct(Target, args);
      const source = String(args?.[0] || '');
      if (source.includes('fast-parse-worker.js')) {
        bridge.mainWorker = worker;
        window.dispatchEvent(new CustomEvent('strikeglass:worker-ready', { detail: { worker } }));
      }
      return worker;
    }
  });

  window.StrikeglassWorkerBridge = bridge;
})();
