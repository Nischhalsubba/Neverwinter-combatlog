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

// Let detected fights wrap into readable cards instead of hiding them in a horizontal rail.
if (!document.querySelector('link[data-strikeglass-encounter-grid]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../v19/encounter-grid.css', import.meta.url).href;
  stylesheet.dataset.strikeglassEncounterGrid = 'true';
  document.head.append(stylesheet);
}

// Normalize page/component spacing and compact the Overview around drill-down analysis.
if (!document.querySelector('link[data-strikeglass-layout-rhythm]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../v20/layout-rhythm.css', import.meta.url).href;
  stylesheet.dataset.strikeglassLayoutRhythm = 'true';
  document.head.append(stylesheet);
}

// Keep route transitions, selected-player context, and worker progress coherent across lazy features.
if (!document.querySelector('link[data-strikeglass-ui-coherence]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../v21/ui-coherence.css', import.meta.url).href;
  stylesheet.dataset.strikeglassUiCoherence = 'true';
  document.head.append(stylesheet);
}
await import('../v21/ui-coherence.js');
await import('../v20/overview-layout.js');

// Heavy analysis features are loaded on demand by the v12 runtime.
await import('../v12/runtime.js');

// Graph Studio augments plotted and timeline visuals only; it does not own combat data.
await import('../v16/visual-studio.js');

// The v17 visual-analysis workspace adds synchronized exploration on top of verified reports.
await import('../v17/index.js');
