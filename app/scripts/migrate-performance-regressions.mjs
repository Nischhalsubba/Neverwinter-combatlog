import { readFile, writeFile } from 'node:fs/promises';

{
  const path = 'scripts/boss-effects-regression.mjs';
  let source = await readFile(path, 'utf8');
  const from = "assert.match(index, /src\\/v7\\/boss-effects\\.js/);";
  const to = "const runtime = readFileSync(new URL('../src/v12/runtime.js', import.meta.url), 'utf8');\nassert.match(runtime, /import\\('\.\.\\/v7\\/boss-effects\\.js'\\)/, 'Team Debuffs must load boss-effects UI on demand');\nassert.doesNotMatch(index, /type=\\\"module\\\" src=\\\"src\\/v7\\/boss-effects\\.js\\\"/, 'Team Debuffs must not load eagerly');";
  if (!source.includes(from)) throw new Error('Missing boss-effects lazy regression migration target');
  source = source.replace(from, to);
  await writeFile(path, source);
}

{
  const path = 'scripts/qol-regression.mjs';
  let source = await readFile(path, 'utf8');
  const from = `const loader = read('src/v3/power-drilldown.js');
assert.match(loader, /ensureQolStyle/);
assert.match(loader, /\\.\\.\\/v8\\/qol\\.css/);
assert.match(loader, /await ensureQolStyle\\(\\)/);
assert.match(loader, /await import\\('\\.\\/power-popup\\/index\\.js'\\)/);
assert.match(loader, /await import\\('\\.\\.\\/v8\\/index\\.js'\\)/);
assert.ok(loader.indexOf('await ensureQolStyle()') < loader.indexOf("await import('../v8/index.js')"), 'QoL CSS must be ready before QoL controls are created');
assert.doesNotMatch(loader, /powersNav\\.click|returnToOrigin|originView/);`;
  const to = `const loader = read('src/v3/power-drilldown.js');
const runtime = read('src/v12/runtime.js');
assert.match(loader, /\\.\\.\\/v12\\/runtime\\.js/);
assert.doesNotMatch(loader, /\\.\\.\\/v8\\/index\\.js/);
assert.doesNotMatch(loader, /power-popup\\/index\\.js/);
assert.match(runtime, /function ensureQolStyle/);
assert.match(runtime, /\\.\\.\\/v8\\/qol\\.css/);
assert.match(runtime, /import\\('\\.\\.\\/v8\\/index\\.js'\\)/);
assert.match(runtime, /import\\('\\.\\.\\/v3\\/power-popup\\/index\\.js'\\)/);
assert.match(runtime, /requestIdleCallback/);
assert.ok(runtime.indexOf('ensureQolStyle();') < runtime.indexOf("import('../v8/index.js')"), 'QoL stylesheet must be requested before QoL controls are imported');
assert.doesNotMatch(loader, /powersNav\\.click|returnToOrigin|originView/);`;
  if (!source.includes(from)) throw new Error('Missing QoL lazy regression migration target');
  source = source.replace(from, to);
  await writeFile(path, source);
}

console.log('Migrated route-lazy regressions for Team Debuffs and QoL.');
