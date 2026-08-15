// Compatibility bootstrap for route-aware enhancements.
// Load the shared layout contract before analysis views become visible.
if (!document.querySelector('link[data-strikeglass-fluid-layout]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../v15/fluid-desktop.css', import.meta.url).href;
  stylesheet.dataset.strikeglassFluidLayout = 'true';
  document.head.append(stylesheet);
}

// Keep form controls stable after the global 44px interaction-target rules are applied.
if (!document.querySelector('link[data-strikeglass-control-fixes]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../v18/control-fixes.css', import.meta.url).href;
  stylesheet.dataset.strikeglassControlFixes = 'true';
  document.head.append(stylesheet);
}

// Heavy analysis features are loaded on demand by the v12 runtime.
await import('../v12/runtime.js');

// Graph Studio augments plotted and timeline visuals only; it does not own combat data.
await import('../v16/visual-studio.js');

// The v17 visual-analysis workspace adds synchronized exploration on top of verified reports.
await import('../v17/index.js');