import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bootstrap = read('src/v3/power-drilldown.js');
const layout = read('src/v20/layout-rhythm.css');
const overview = read('src/v20/overview-layout.js');
const lifecycle = read('src/v28/route-lifecycle.js');
const parser = read('src/engine/fast-parser-core.js');
const verification = read('src/engine/verification-engine.js');

for (const token of ['--sg-space-1:4px','--sg-space-2:8px','--sg-space-3:12px','--sg-space-4:16px','--sg-space-5:24px','--sg-space-6:32px']) {
  assert.ok(layout.includes(token), `spacing scale missing ${token}`);
}
assert.match(layout, /\.view-root\{display:grid;gap:var\(--sg-section-gap\);align-content:start\}/);
assert.match(layout, /\.view-root>:is\([^}]+\)\{margin-block:0\}/);
assert.match(layout, /html\[data-density="comfortable"\]/);
for (const selector of ['.workspace .qol-breadcrumbs','.view-root .qol-event-finder-form','.view-root .sg-chart-toolbar','.view-root .sg-v17-controls','.view-root .sg-debuff-toolbar']) assert.ok(layout.includes(selector), `lazy spacing override missing ${selector}`);
assert.match(layout, /\.panel-head\{min-height:44px/);
assert.match(layout, /\.sg-overview-footer button\{min-height:44px/);

assert.match(layout, /\.sg-overview>\.qol-matters\{grid-column:span 8\}/);
assert.match(layout, /\.sg-overview>\.party-metrics\{grid-column:span 4/);
assert.match(layout, /\.qol-insight\{position:relative;min-height:70px/);
assert.match(layout, /\.qol-insight button\{[^}]*width:44px;height:44px;min-height:44px/);
assert.match(layout, /grid-template-columns:minmax\(0,2\.2fr\) minmax\(380px,\.8fr\)/);
assert.match(layout, /repeat\(auto-fit,minmax\(160px,1fr\)\)/);
assert.match(layout, /\.sg-chart-stage,[\s\S]*height:clamp\(260px,22vw,360px\)/);
assert.match(layout, /@media\(max-width:1400px\)/);
assert.match(layout, /@media\(max-width:1024px\)/);
assert.match(layout, /@media\(max-width:760px\)/);
assert.match(layout, /@media\(prefers-reduced-motion:reduce\)/);

for (const marker of [
  "strikeglass.dashboard.v1",
  "strikeglass.overview-layout.v20",
  "{ id: 'party-summary', visible: true, size: 'medium', order: 0 }",
  "{ id: 'timeline', visible: true, size: 'large', order: 2 }",
  "{ id: 'encounters', visible: true, size: 'medium', order: 3 }",
  "index >= 10",
  "index >= 8",
  "index >= 6",
  "workerRequest('diagnostics'",
  "encounter?.type === 'boss'",
  "bossEncountersFromSelect",
  "All ${Math.max(0, totalFightCount)} fights",
  "registerRouteEnhancer('overview-layout'",
  "dashboard-ready",
  "view-rendered"
]) {
  assert.ok(overview.includes(marker), `compact Overview contract missing ${marker}`);
}
assert.ok(lifecycle.includes("document.addEventListener('strikeglass:dashboard-ready'"), 'shared lifecycle owner must subscribe to dashboard-ready');
assert.ok(lifecycle.includes("document.addEventListener('strikeglass:view-rendered'"), 'shared lifecycle owner must subscribe to view-rendered');
assert.doesNotMatch(overview, /MutationObserver/);
assert.doesNotMatch(overview, /fast-parser|verification-engine|effect-intelligence-engine|scoped-combat-clock/);

for (const marker of ['../v20/layout-rhythm.css','data-strikeglass-layout-rhythm','../v20/overview-layout.js']) {
  assert.ok(bootstrap.includes(marker), `v20 bootstrap missing ${marker}`);
}
assert.ok(bootstrap.indexOf('layout-rhythm.css') < bootstrap.indexOf("../v12/runtime.js"), 'layout rhythm must load before route runtime');
assert.ok(bootstrap.indexOf("../v20/overview-layout.js") < bootstrap.indexOf("../v12/runtime.js"), 'Overview compaction must initialize before the dashboard runtime');

assert.ok(parser.includes("CANONICAL_DAMAGE_TYPES = new Set(['physical'])"), 'layout release must retain canonical Physical damage contract');
assert.ok(verification.includes('verifyReport'), 'layout release must retain independent verification');

console.log('Layout rhythm regression passed. Spacing uses one scale, Overview is compact and drill-down oriented, boss shortcuts are complete, and combat engines remain untouched.');
