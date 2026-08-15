// Compatibility bootstrap for route-aware enhancements.
// Load the shared layout contract before analysis views become visible.
if (!document.querySelector('link[data-strikeglass-fluid-layout]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../v15/fluid-desktop.css', import.meta.url).href;
  stylesheet.dataset.strikeglassFluidLayout = 'true';
  document.head.append(stylesheet);
}

// Heavy analysis features are loaded on demand by the v12 runtime.
await import('../v12/runtime.js');

// Graph Studio augments plotted and timeline visuals only; it does not own combat data.
await import('../v16/visual-studio.js');
