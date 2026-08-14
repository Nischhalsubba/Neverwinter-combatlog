import { readFile, writeFile } from 'node:fs/promises';

const read = path => readFile(path, 'utf8');
const write = (path, value) => writeFile(path, value);
function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing finalizer target: ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

let dashboard = await read('src/v6/dashboard.js');
dashboard = replaceOnce(dashboard,
`new MutationObserver(() => {
  closeForViewChange();
  queueMicrotask(enhanceOverview);
}).observe(root || document.body, { childList: true, subtree: false });

nav?.addEventListener('click', () => queueMicrotask(() => {
  closeForViewChange();
  enhanceOverview();
}));

addEventListener('resize', () => syncDraggable(), { passive: true });
queueMicrotask(enhanceOverview);`,
`document.addEventListener('strikeglass:view-rendered', event => {
  closeForViewChange();
  if (event.detail?.view === 'overview') queueMicrotask(enhanceOverview);
});

nav?.addEventListener('click', () => queueMicrotask(closeForViewChange));

let resizeFrame = 0;
addEventListener('resize', () => {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    syncDraggable();
  });
}, { passive: true });
queueMicrotask(enhanceOverview);`,
'dashboard mutation observer');
await write('src/v6/dashboard.js', dashboard);

let drawerCopy = await read('src/v6/drawer-copy.js');
drawerCopy = replaceOnce(drawerCopy,
`new MutationObserver(simplifyDrawer).observe(document.body, { childList: true, subtree: true });
simplifyDrawer();`,
`let copyFrame = 0;
function scheduleDrawerCopy() {
  if (copyFrame) return;
  copyFrame = requestAnimationFrame(() => {
    copyFrame = 0;
    simplifyDrawer();
  });
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-v6-add],.v6-widget-drawer')) scheduleDrawerCopy();
}, { passive: true });
document.addEventListener('change', event => {
  if (event.target.closest('.v6-widget-drawer')) scheduleDrawerCopy();
}, { passive: true });
document.addEventListener('strikeglass:dashboard-ready', scheduleDrawerCopy);
simplifyDrawer();`,
'drawer copy observer');
await write('src/v6/drawer-copy.js', drawerCopy);

await write('scripts/v6-regression.mjs', `import { access, readFile } from 'node:fs/promises';

const required = [
  '../MASTER.md',
  'src/v6/v6.css',
  'src/v6/components.css',
  'src/v6/stability.css',
  'src/v6/dashboard.js',
  'src/v6/dashboard-interactions.js',
  'src/v6/copy.js',
  'src/v6/drawer-copy.js',
  'src/v12/runtime.js'
];
for (const path of required) await access(path);

const [index, dashboard, interactions, copy, drawerCopy, styles, components, stability, runtime] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/v6/dashboard.js', 'utf8'),
  readFile('src/v6/dashboard-interactions.js', 'utf8'),
  readFile('src/v6/copy.js', 'utf8'),
  readFile('src/v6/drawer-copy.js', 'utf8'),
  readFile('src/v6/v6.css', 'utf8'),
  readFile('src/v6/components.css', 'utf8'),
  readFile('src/v6/stability.css', 'utf8'),
  readFile('src/v12/runtime.js', 'utf8')
]);
const failures = [];

for (const marker of ['src/v6/v6.css','src/v6/components.css','src/v6/stability.css','content="#f6f8fb"','content="light"','<strong>Overview</strong>','<strong>Fight Timeline</strong>','<strong>Team Debuffs</strong>','<strong>Analysis Checks</strong>']) {
  if (!index.includes(marker)) failures.push(\`index missing \${marker}\`);
}
for (const eager of ['src/v6/dashboard.js','src/v6/dashboard-interactions.js','src/v6/copy.js','src/v6/drawer-copy.js']) {
  if (index.includes(\`type="module" src="\${eager}"\`)) failures.push(\`dashboard feature must be lazy: \${eager}\`);
}
for (const marker of ["import('../v6/dashboard.js')","import('../v6/dashboard-interactions.js')","import('../v6/drawer-copy.js')",'data-dashboard-customize']) {
  if (!runtime.includes(marker)) failures.push(\`route runtime missing dashboard hook \${marker}\`);
}
for (const marker of ['strikeglass.dashboard.v1','Customize layout','Add widget','Reset layout','data-v6-hide','data-v6-move','data-v6-toggle','data-v6-size','aria-modal','prefers-reduced-motion','strikeglass:view-rendered']) {
  if (!dashboard.includes(marker)) failures.push(\`dashboard missing \${marker}\`);
}
if (/cdn\\.jsdelivr\\.net|gsap@/i.test(dashboard)) failures.push('dashboard must not load GSAP/CDN at runtime');
if (dashboard.includes('new MutationObserver')) failures.push('dashboard must not observe root DOM mutations');
for (const marker of ["event.target.closest?.('[data-v6-drag]')","document.addEventListener('pointerdown'","document.addEventListener('dragend'",'widget.draggable = true','widget.draggable = false']) {
  if (!interactions.includes(marker)) failures.push(\`interaction guard missing \${marker}\`);
}
for (const marker of ["['Session overview', 'Session summary']","['Party Combat DPS', 'Group Active DPS']","['Combat DPS', 'Active DPS']","['Top Damage Powers', 'Top damaging powers']","['Reject reasons', 'Rows we could not read']",'What do these numbers mean?','Damage per second from the first counted hit to the last counted hit.','Idle gaps longer than 5 seconds are ignored','strikeglass:view-rendered']) {
  if (!copy.includes(marker)) failures.push(\`plain-language copy missing \${marker}\`);
}
if (copy.includes('new MutationObserver')) failures.push('plain-language copy must use lifecycle events rather than DOM observers');
for (const marker of ["['Widgets', 'Choose what to show']","['Party Summary', 'Group totals']","['Damage Over Time', 'Damage timeline']","['Encounters', 'Fights']",'scheduleDrawerCopy','strikeglass:dashboard-ready']) {
  if (!drawerCopy.includes(marker)) failures.push(\`drawer copy missing \${marker}\`);
}
if (drawerCopy.includes('new MutationObserver')) failures.push('drawer copy must not observe document.body');
for (const marker of ['--sg-page:#f6f8fb','--sg-text:#0f172a','--sg-primary:#2563eb','--motion-standard:220ms','.v6-dashboard-grid','.v6-widget-drawer','.v6-drawer-scrim','@media(prefers-reduced-motion:reduce)']) {
  if (!styles.includes(marker)) failures.push(\`V6 styles missing \${marker}\`);
}
for (const marker of ['[data-v6-drag]{cursor:grab}', '.v6-widget-action', '@media(max-width:760px)']) if (!components.includes(marker)) failures.push(\`V6 components missing \${marker}\`);
for (const marker of ['.v6-drawer-scrim{','opacity:1','.v6-widget-drawer{','transform:translateX(0)','.v6-data-guide','@media(prefers-reduced-motion:reduce)']) if (!stability.includes(marker)) failures.push(\`V6 stability styles missing \${marker}\`);
if (/\\.v6-drawer-scrim[\\s\\S]*?backdrop-filter\\s*:\\s*blur\\(/i.test(styles + stability)) failures.push('Widget drawer scrim must remain blur-free.');

if (failures.length) {
  console.error('V6 regression failed:');
  for (const failure of failures) console.error(\`- \${failure}\`);
  process.exit(1);
}
console.log('V6 regression passed. Customizable Overview remains available on demand with accessible controls, plain-language copy, lifecycle-driven refresh, and no persistent DOM observers or runtime animation CDN.');
`);

console.log('Finalized observer-free dashboard performance layer.');
