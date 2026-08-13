import { access, readFile } from 'node:fs/promises';

const required = [
  '../MASTER.md',
  'src/v6/v6.css',
  'src/v6/components.css',
  'src/v6/stability.css',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js',
  'src/v6/copy.js'
];

for (const path of required) await access(path);

const [index, dashboard, interactions, copy, styles, components, stability] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/v6/dashboard.js', 'utf8'),
  readFile('src/v6/dashboard-interactions.js', 'utf8'),
  readFile('src/v6/copy.js', 'utf8'),
  readFile('src/v6/v6.css', 'utf8'),
  readFile('src/v6/components.css', 'utf8'),
  readFile('src/v6/stability.css', 'utf8')
]);

const failures = [];

for (const marker of [
  'src/v6/v6.css',
  'src/v6/components.css',
  'src/v6/stability.css',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js',
  'src/v6/copy.js',
  'content="#f6f8fb"',
  'content="light"',
  '<span>Summary</span>',
  '<span>Power Timing</span>',
  '<span>Compare Players</span>',
  '<span>Log Health</span>',
  '<span>Fight</span>',
  '<span>Showing</span>'
]) if (!index.includes(marker)) failures.push(`index missing ${marker}`);

for (const marker of [
  'strikeglass.dashboard.v1',
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
  "['Session overview', 'Session summary']",
  "['Party Combat DPS', 'Group Active DPS']",
  "['Combat DPS', 'Active DPS']",
  "['Top Damage Powers', 'Top damaging powers']",
  "['Reject reasons', 'Rows we could not read']",
  'What do these numbers mean?',
  'Damage per second from the first counted hit to the last counted hit.',
  'Idle gaps longer than 5 seconds are ignored',
  'Counting Physical damage only · your log stays on this device',
  'MutationObserver'
]) if (!copy.includes(marker)) failures.push(`plain-language copy missing ${marker}`);

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

for (const marker of [
  '.v6-drawer-scrim{',
  'opacity:1',
  '.v6-widget-drawer{',
  'transform:translateX(0)',
  '.v6-data-guide',
  '@media(prefers-reduced-motion:reduce)'
]) if (!stability.includes(marker)) failures.push(`V6 stability styles missing ${marker}`);

if (/\.v6-drawer-scrim[\s\S]*?backdrop-filter\s*:\s*blur\(/i.test(styles + stability)) {
  failures.push('Widget drawer scrim must remain blur-free.');
}

const baseDrawerHidden = /\.v6-widget-drawer\{[\s\S]*?transform:translateX\(24px\);[\s\S]*?opacity:0/.test(styles);
const stableDrawerVisible = /\.v6-widget-drawer\{[\s\S]*?transform:translateX\(0\);[\s\S]*?opacity:1/.test(stability);
if (baseDrawerHidden && !stableDrawerVisible) failures.push('Widget drawer can return to its hidden base state after GSAP clears inline styles.');

if (failures.length) {
  console.error('V6 regression failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('V6 regression passed. Drawer visibility, plain-language labels, data definitions, widget controls, accessibility hooks, and reduced-motion contracts are present.');
