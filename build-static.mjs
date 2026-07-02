import { cp, mkdir } from 'node:fs/promises';

const copyTargets = [
  ['index.html', 'public/index.html'],
  ['styles.css', 'public/styles.css'],
  ['parser.js', 'public/parser.js'],
  ['app.js', 'public/app.js'],
  ['assets.js', 'public/assets.js'],
  ['asset-coverage-layer.js', 'public/asset-coverage-layer.js'],
  ['class-power-map.js', 'public/class-power-map.js'],
  ['recovery.js', 'public/recovery.js'],
  ['power-icon-fix.js', 'public/power-icon-fix.js'],
  ['feature-layer.js', 'public/feature-layer.js'],
  ['ui-redesign.js', 'public/ui-redesign.js'],
  ['legend-layer.js', 'public/legend-layer.js'],
  ['guided-ux-layer.js', 'public/guided-ux-layer.js'],
  ['class-detection-layer.js', 'public/class-detection-layer.js'],
  ['asset-codex-layer.js', 'public/asset-codex-layer.js'],
  ['src', 'public/src']
];

await mkdir('public', { recursive: true });

for (const [from, to] of copyTargets) {
  await cp(from, to, { recursive: true, force: true });
}

console.log(`Built Strikeglass with ${copyTargets.length} copy targets.`);
