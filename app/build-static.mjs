import { cp, mkdir, rm } from 'node:fs/promises';

const copyTargets = [
  ['index.html', 'public/index.html'],
  ['src', 'public/src']
];

await rm('public', { recursive: true, force: true });
await mkdir('public', { recursive: true });

for (const [from, to] of copyTargets) {
  await cp(from, to, { recursive: true, force: true });
}

console.log(`Built Strikeglass V3 with ${copyTargets.length} copy targets.`);
