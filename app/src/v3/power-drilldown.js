async function ensureQolStyle() {
  const existing = document.querySelector('link[data-qol-style]');
  if (existing?.sheet) return;

  const link = existing || document.createElement('link');
  if (!existing) {
    link.rel = 'stylesheet';
    link.href = new URL('../v8/qol.css', import.meta.url).href;
    link.dataset.qolStyle = 'true';
    document.head.append(link);
  }

  await Promise.race([
    new Promise(resolve => link.addEventListener('load', resolve, { once: true })),
    new Promise(resolve => link.addEventListener('error', resolve, { once: true })),
    new Promise(resolve => setTimeout(resolve, 2500))
  ]);
}

await ensureQolStyle();
await import('./power-popup/index.js');
await import('../v8/index.js');
await import('../v9/encounter-power-icons.js');
await import('../v10/power-timing-interactions.js');
