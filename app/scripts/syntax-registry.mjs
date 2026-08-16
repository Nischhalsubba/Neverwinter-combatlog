import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

const roots = ['src', 'scripts', 'tests'];
const excluded = new Set(['node_modules', 'public', 'vendor', 'test-artifacts']);
const files = ['build-static.mjs', 'worker.js'];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(path);
  }
}

for (const root of roots) await walk(root);
files.sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Syntax check failed: ${relative(process.cwd(), file)}`);
    process.exit(result.status || 1);
  }
}
console.log(`Syntax registry passed for ${files.length} JavaScript modules.`);
