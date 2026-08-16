import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const chartStudio = read('src/v3/charts.js');
const visualStudio = read('src/v16/visual-studio.js');
const style = read('src/v16/chart-studio.css');
const bootstrap = read('src/v3/power-drilldown.js');
const vendor = read('scripts/vendor-echarts.mjs');
const build = read('build-static.mjs');

assert.match(bootstrap, /v16\/visual-studio\.js/);
assert.match(vendor, /VERSION = '6\.1\.0'/);
assert.match(vendor, /3b8ed4bcd17f7c838d86d4920af588f1a0aeb389/);
assert.match(vendor, /raw\.githubusercontent\.com\/apache\/echarts/);
assert.match(vendor, /gitBlobSha/);
assert.match(build, /await copy\('vendor', 'vendor'\)/, 'production build must retain the vendored chart runtime');
assert.match(build, /asset-manifest\.json/, 'production build must publish an asset manifest');
assert.match(build, /build-manifest\.json/, 'production build must publish reproducible build identity');

for (const control of ['minus','plus','reset','contrast','grid','points','area','expand','image']) {
  assert.match(chartStudio, new RegExp(`data-sg-chart-action=\\"\\$\\{name\\}\\"|${control}`), `missing ${control} graph control`);
}
assert.match(chartStudio, /dataZoom/);
assert.match(chartStudio, /type:'inside'/);
assert.match(chartStudio, /type:'slider'/);
assert.match(chartStudio, /emphasis:\{ focus:'series'/);
assert.match(chartStudio, /aria:\s*\{[\s\S]*?show:\s*true/);
assert.match(chartStudio, /decal:\s*\{ show:\s*state\.contrast \}/);
assert.match(chartStudio, /legendselectchanged/);
assert.match(chartStudio, /getDataURL/);
assert.match(chartStudio, /IntersectionObserver/);
assert.match(chartStudio, /fallbackRenderer/);
assert.match(chartStudio, /ResizeObserver/);
assert.match(chartStudio, /prefers-reduced-motion/);
assert.match(chartStudio, /sampling:'lttb'/);

assert.match(visualStudio, /Focus player/);
assert.match(visualStudio, /data-pt-zoom-in/);
assert.match(visualStudio, /data-pt-zoom-out/);
assert.match(visualStudio, /sg-pt-contrast/);
assert.match(visualStudio, /sg-pt-expanded/);
assert.match(visualStudio, /analysis-bar-row/);
assert.match(style, /\.sg-chart-expanded/);
assert.match(style, /\.sg-chart-button\{width:44px;height:44px/);
assert.match(style, /\.chart-lazy-placeholder \+ \.sg-chart-stage\{display:none\}/);
assert.match(style, /\.pt-zoom button\{width:44px;height:44px;min-height:44px\}/);
assert.match(visualStudio, /setTimeout\(scheduleScan, 100\)/);
assert.doesNotMatch(visualStudio, /requestAnimationFrame\(scheduleScan\)/);
assert.match(style, /\.rotation-lane\.sg-lane-muted/);
assert.match(style, /@media\(max-width:768px\)/);
assert.match(style, /prefers-reduced-motion:reduce/);

for (const forbidden of ['fast-parser-core', 'verification-engine', 'effect-intelligence-engine', 'boss-effects.js']) {
  assert.doesNotMatch(chartStudio, new RegExp(forbidden));
  assert.doesNotMatch(visualStudio, new RegExp(forbidden));
}

console.log('Graph Studio visualization regression passed.');
