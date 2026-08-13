import { access, readFile } from 'node:fs/promises';

for (const path of ['src/v6/copy.js', 'src/v6/drawer-copy.js', 'src/v6/stability.css', 'src/v6/COPY.md']) await access(path);

const [copy, drawerCopy, stability, guide] = await Promise.all([
  readFile('src/v6/copy.js', 'utf8'),
  readFile('src/v6/drawer-copy.js', 'utf8'),
  readFile('src/v6/stability.css', 'utf8'),
  readFile('src/v6/COPY.md', 'utf8')
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

if (failures.length) {
  console.error('Copy regression failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Copy regression passed. Plain-language metric definitions and persistent widget-drawer visibility are present.');
