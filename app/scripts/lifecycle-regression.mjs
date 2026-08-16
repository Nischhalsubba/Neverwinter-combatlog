import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const lifecycle = await read('src/v28/route-lifecycle.js');
const migrated = new Map(await Promise.all([
  ['visual-analysis-workspace', 'src/v17/index.js'],
  ['overview-layout', 'src/v20/overview-layout.js'],
  ['accuracy-ui', 'src/v22/accuracy-ui.js'],
  ['semantic-guidance', 'src/v23/semantic-guidance.js'],
  ['evidence-coverage', 'src/v24/evidence-coverage.js'],
  ['entity-evidence', 'src/v25/entity-evidence.js'],
  ['accuracy-finalization', 'src/v26/accuracy-finalization.js']
].map(async ([name, path]) => [name, { path, source: await read(path) }])));

for (const event of [
  'strikeglass:view-rendered',
  'strikeglass:analysis-ready',
  'strikeglass:dashboard-ready',
  'strikeglass:settings-changed',
  'strikeglass:worker-ready'
]) {
  const matches = lifecycle.match(new RegExp(event.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];
  assert.equal(matches.length, 1, `${event} must have one shared lifecycle subscription`);
}

assert.match(lifecycle, /scopeSelect\?\.addEventListener\('change'/, 'lifecycle owner must observe scope changes');
assert.match(lifecycle, /playerSelect\?\.addEventListener\('change'/, 'lifecycle owner must observe player changes');
assert.equal((lifecycle.match(/new MutationObserver/g) || []).length, 1, 'post-render surfaces must share one root observer');
assert.match(lifecycle, /requestAnimationFrame\(flush\)/, 'lifecycle owner must batch refreshes into one animation frame');

for (const [name, { path, source }] of migrated) {
  assert.match(source, /registerRouteEnhancer/, `${path} must register with the shared lifecycle owner`);
  assert.match(source, new RegExp(`registerRouteEnhancer\\(['\"]${name}['\"]`), `${path} must have a stable lifecycle registration name`);
  assert.doesNotMatch(source, /document\.addEventListener\('strikeglass:view-rendered'/, `${path} must not own view-rendered globally`);
  assert.doesNotMatch(source, /document\.addEventListener\('strikeglass:analysis-ready'/, `${path} must not own analysis-ready globally`);
  assert.doesNotMatch(source, /window\.addEventListener\('strikeglass:worker-ready'/, `${path} must not own worker-ready globally`);
  assert.doesNotMatch(source, /new MutationObserver/, `${path} must not create a competing root observer`);
}

const accuracy = migrated.get('accuracy-ui').source;
assert.match(accuracy, /root\?\.addEventListener\('change'/, 'graph-control interaction remains feature-owned rather than lifecycle-owned');
assert.match(accuracy, /root-children-changed/, 'accuracy UI must still react to lazily inserted graph/dashboard children');

const overview = migrated.get('overview-layout').source;
assert.match(overview, /dashboard-ready/, 'Overview must still react when the on-demand dashboard finishes loading');
assert.match(overview, /analysis-ready/, 'Overview must reset cached diagnostics for a newly parsed log');

const packageJson = JSON.parse(await read('package.json'));
assert.match(packageJson.scripts.syntax, /src\/v28\/route-lifecycle\.js/, 'syntax gate must include lifecycle owner');
assert.match(packageJson.scripts.test, /lifecycle-regression\.mjs/, 'normal release tests must include lifecycle ownership regression');

console.log('Route lifecycle regression passed. Post-render analytics share one event fan-in and one root observer while feature interactions remain locally owned.');
