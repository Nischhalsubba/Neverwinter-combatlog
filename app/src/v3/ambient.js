import './worker-bridge.js';

// Strikeglass keeps the analysis surface GPU-idle until a data visualization
// explicitly needs a canvas. Decorative WebGL was intentionally removed from
// the application shell so high-refresh interactions do not compete for GPU time.
export async function startAmbient(root) {
  if (root) root.replaceChildren();
}

export function stopAmbient() {}
