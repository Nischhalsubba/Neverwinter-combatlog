import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/boss-effects-regression.mjs';
let source = await readFile(path, 'utf8');
const from = "assert.match(index, /src\\/v7\\/boss-effects\\.js/);";
const to = "const runtime = readFileSync(new URL('../src/v12/runtime.js', import.meta.url), 'utf8');\nassert.match(runtime, /import\\('\.\.\\/v7\\/boss-effects\\.js'\\)/, 'Team Debuffs must load boss-effects UI on demand');\nassert.doesNotMatch(index, /type=\\\"module\\\" src=\\\"src\\/v7\\/boss-effects\\.js\\\"/, 'Team Debuffs must not load eagerly');";
if (!source.includes(from)) throw new Error('Missing boss-effects lazy regression migration target');
source = source.replace(from, to);
await writeFile(path, source);
console.log('Migrated boss-effect bootstrap regression to route-lazy contract.');
