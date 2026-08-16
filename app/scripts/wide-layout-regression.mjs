import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bootstrap = read('src/v3/power-drilldown.js');
const layout = read('src/v15/fluid-desktop.css');
const legacy = read('src/v6/v6.css');
const encounterGrid = read('src/v19/encounter-grid.css');

assert.match(bootstrap, /v15\/fluid-desktop\.css/);
assert.match(bootstrap, /dataset\.strikeglassFluidLayout/);
assert.ok(bootstrap.indexOf('fluid-desktop.css') < bootstrap.indexOf("v12/runtime.js"), 'fluid layout must be requested before route-aware analysis runtime');
assert.match(bootstrap, /v19\/encounter-grid\.css/);
assert.match(bootstrap, /dataset\.strikeglassEncounterGrid/);
assert.ok(bootstrap.indexOf('encounter-grid.css') < bootstrap.indexOf("v12/runtime.js"), 'encounter grid must be requested before analysis views render');

assert.match(legacy, /\.empty-state,\.parse-state,\.workspace\{max-width:1600px\}/, 'fixture should retain the legacy cap this layer overrides');
assert.match(layout, /--sg-workspace-max:3200px/);
assert.match(layout, /\.workspace\{[\s\S]*?width:min\(100%,var\(--sg-workspace-max\)\);[\s\S]*?max-width:var\(--sg-workspace-max\);[\s\S]*?margin-inline:0 auto;/);
assert.doesNotMatch(layout, /\.workspace[^}]*margin(?:-inline)?:\s*auto\s*;/, 'wide workspace must not be centered into two giant gutters');
assert.doesNotMatch(layout, /transform:\s*scale\(/, 'do not fake responsive sizing by scaling the application');

for (const width of [1440, 1600, 1920, 2560, 3440]) {
  assert.match(layout, new RegExp(`@media\\(min-width:${width}px\\)`), `missing ${width}px wide-screen contract`);
}
assert.match(layout, /@media\(max-width:1200px\)/, 'existing compact/tablet contract must remain explicit');

assert.match(layout, /--sidebar:268px/);
assert.match(layout, /--sidebar:276px/);
assert.match(layout, /--sidebar:288px/);
assert.match(layout, /\.nav-copy strong\{font-size:13\.5px\}/);
assert.match(layout, /td,table\{font-size:14px\}/);
assert.match(layout, /\.analysis-toolbar\{[\s\S]*?minmax\(420px,1\.5fr\)/);
assert.match(layout, /\.overview-grid\{grid-template-columns:minmax\(0,1\.8fr\)/);
assert.match(layout, /\.boss-grid\{grid-template-columns:minmax\(0,1\.82fr\)/);
assert.match(layout, /\.diagnostic-grid\{grid-template-columns:minmax\(340px,\.42fr\)/);
assert.match(layout, /\.comparison-cards\{grid-template-columns:repeat\(auto-fit,minmax\(310px,1fr\)\)\}/);

for (const selector of ['.table-wrap', '.chart-panel', '.rotation-shell', '.power-timing-shell']) {
  assert.ok(layout.includes(selector), `${selector} must participate in the fluid data-surface contract`);
}
assert.match(layout, /body\.power-drilldown-open \.raw-hits-panel\{width:min\(1680px/);
assert.match(layout, /\.qol-modal\{width:min\(1480px/);
assert.match(layout, /\.qol-sticky-table \.table-wrap\{max-height:min\(76vh,980px\)\}/);

assert.match(encounterGrid, /\.encounter-strip\{[\s\S]*?display:grid;[\s\S]*?repeat\(auto-fit,minmax\(220px,1fr\)\)[\s\S]*?overflow:visible;/);
assert.match(encounterGrid, /\.encounter-chip\{[\s\S]*?min-width:0;[\s\S]*?width:100%;/);
assert.match(encounterGrid, /\.v6-widget\[data-widget-id="encounters"\] \.encounter-strip\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/);
assert.match(encounterGrid, /@media\(min-width:1600px\)/);
assert.match(encounterGrid, /@media\(min-width:2560px\)/);
assert.match(encounterGrid, /@media\(max-width:760px\)/);
assert.doesNotMatch(encounterGrid, /\.encounter-strip\{[^}]*overflow-x\s*:\s*auto/i, 'detected fights must not return to a horizontal-only rail');

console.log('Wide desktop and ultrawide layout regression passed.');
