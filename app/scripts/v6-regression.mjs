import { access, readFile } from 'node:fs/promises';

const required = [
  '../MASTER.md',
  'src/v6/v6.css',
  'src/v6/components.css',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js'
];

for (const path of required) await access(path);

const [index, dashboard, interactions, styles, components] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/v6/dashboard.js', 'utf8'),
  readFile('src/v6/dashboard-interactions.js', 'utf8'),
  readFile('src/v6/v6.css', 'utf8'),
  readFile('src/v6/components.css', 'utf8')
]);

const failures = [];

for (const marker of [
  'src/v6/v6.css',
  'src/v6/components.css',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js',
  'content="#f6f8fb"',
  'content="light"'
]) if (!index.includes(marker)) failures.push(`index missing ${marker}`);

for (const marker of [
  "strikeglass.dashboard.v1",
  'Customize layout',
  'Add widget',
  'Reset layout',
  'data-v6-hide',
  'data-v6-move',
  'data-v6-toggle',
  'data-v6-size',
  'aria-modal',
  'prefers-reduced-motion',
  'gsap@3.15.0'
]) if (!dashboard.includes(marker)) failures.push(`dashboard missing ${marker}`);

for (const marker of [
  "event.target.closest?.('[data-v6-drag]')",
  "document.addEventListener('pointerdown'",
  "document.addEventListener('dragend'",
  'widget.draggable = true',
  'widget.draggable = false'
]) if (!interactions.includes(marker)) failures.push(`interaction guard missing ${marker}`);

for (const marker of [
  '--sg-page:#f6f8fb',
  '--sg-text:#0f172a',
  '--sg-primary:#2563eb',
  '--motion-standard:220ms',
  '.v6-dashboard-grid',
  '.v6-widget-drawer',
  '.v6-drawer-scrim',
  '@media(prefers-reduced-motion:reduce)'
]) if (!styles.includes(marker)) failures.push(`V6 styles missing ${marker}`);

for (const marker of ['[data-v6-drag]{cursor:grab}', '.v6-widget-action', '@media(max-width:760px)']) {
  if (!components.includes(marker)) failures.push(`V6 components missing ${marker}`);
}

if (/\.v6-drawer-scrim[\s\S]*?backdrop-filter\s*:\s*blur\(/i.test(styles)) {
  failures.push('Widget drawer scrim must remain blur-free.');
}

if (failures.length) {
  console.error('V6 regression failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('V6 regression passed. Light design tokens, persistent widget controls, handle-only dragging, accessibility hooks, and reduced-motion contracts are present.');
