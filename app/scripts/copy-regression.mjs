import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

for (const path of ['src/v6/copy.js', 'src/v6/drawer-copy.js', 'src/v6/stability.css', 'src/v6/COPY.md', 'src/v11/navigation-shell.js']) await access(path);

const [copy, drawerCopy, stability, guide, navigation] = await Promise.all([
  readFile('src/v6/copy.js', 'utf8'),
  readFile('src/v6/drawer-copy.js', 'utf8'),
  readFile('src/v6/stability.css', 'utf8'),
  readFile('src/v6/COPY.md', 'utf8'),
  readFile('src/v11/navigation-shell.js', 'utf8')
]);

const failures = [];
for (const marker of ['Group Active DPS', 'Active DPS', 'Group share', 'What do these numbers mean?', 'Rows we could not read']) {
  if (!copy.includes(marker)) failures.push(`copy layer missing ${marker}`);
}
for (const marker of ['Choose what to show', 'Top damaging powers', 'Damage timeline', 'Detected fights you can open quickly.']) {
  if (!drawerCopy.includes(marker)) failures.push(`drawer copy missing ${marker}`);
}
for (const marker of ['.v6-widget-drawer{', 'transform:translateX(0)', 'opacity:1']) {
  if (!stability.includes(marker)) failures.push(`drawer stability missing ${marker}`);
}
for (const marker of ['Prefer `fight` over `scope`', 'Do not rename a metric in a way that changes its mathematical meaning.']) {
  if (!guide.includes(marker)) failures.push(`copy guide missing ${marker}`);
}
for (const marker of [
  "['overview', 'Overview', 'Session totals and the main story']",
  "['rotation', 'Fight Timeline', 'When powers and team debuffs happened']",
  "['debuffs', 'Team Debuffs', 'What made the boss take more damage']",
  "['powers', 'Damage & Powers', 'What the selected player used']",
  "['diagnostics', 'Analysis Checks', 'Parser and engine verification']"
]) {
  if (!navigation.includes(marker)) failures.push(`navigation copy missing ${marker}`);
}
if (!navigation.includes("label: 'Analyze'")) failures.push('navigation is missing the Analyze group');
if (!navigation.includes("label: 'Advanced'")) failures.push('navigation is missing the Advanced group');
if (!navigation.includes("title.textContent = active.textContent")) failures.push('workspace title must follow the active navigation item');

assert.ok(copy.includes("observe(viewRoot, { childList: true, subtree: false })"), 'copy observer must only watch top-level view swaps');
assert.ok(!copy.includes("observe(viewRoot, { childList: true, subtree: true })"), 'copy observer must not rescan the whole UI for chart mutations');

if (failures.length) {
  console.error('Copy regression failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Copy regression passed. Plain-language metric definitions, navigation labels, and persistent widget-drawer visibility are present.');
await import('./seo-regression.mjs');