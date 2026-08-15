import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shared=read('src/v17/shared.js'),graphs=read('src/v17/graph-tools.js'),debuffs=read('src/v17/debuff-timeline.js'),timeline=read('src/v17/timeline-sync.js'),attempts=read('src/v17/attempt-visuals.js'),scenes=read('src/v17/scene-visuals.js'),index=read('src/v17/index.js'),css=read('src/v17/analysis-visuals.css'),bootstrap=read('src/v3/power-drilldown.js');
assert.match(shared,/strikeglass:visual-range/);assert.match(shared,/sharedRanges/);assert.match(shared,/effect-intelligence-report/);
for(const token of ['cumulative','Rolling DPS','Undo','Redo','Fight %','Legend order','Pin series','Analyze range','Download CSV','Big hits','Debuffs'])assert.match(graphs,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(graphs,/sampling:'lttb'/);assert.match(graphs,/dataZoom/);assert.match(graphs,/rawRowsForRange/);assert.match(graphs,/effect-intelligence-report/);assert.match(graphs,/markLine/);
assert.match(debuffs,/Debuff uptime timeline/);assert.match(debuffs,/sg-debuff-window/);assert.match(debuffs,/publishRange/);assert.match(timeline,/fight-timeline/);assert.match(timeline,/data-pt-zoom-in/);
assert.match(attempts,/Attempt damage comparison/);assert.match(attempts,/Debuff uptime delta/);assert.match(scenes,/Party distribution/);assert.match(scenes,/sg-encounter-spark/);assert.match(scenes,/sg-category-filter/);assert.match(scenes,/Event density/);assert.match(scenes,/Analysis checks at a glance/);
assert.match(index,/scanGraphs/);assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/prefers-reduced-motion:reduce/);
for(const forbidden of ['fast-parser-core','verification-engine','effect-intelligence-engine']){assert.doesNotMatch(graphs,new RegExp(forbidden));assert.doesNotMatch(debuffs,new RegExp(forbidden));assert.doesNotMatch(scenes,new RegExp(forbidden));}
assert.match(bootstrap,/v17\/index\.js/);
console.log('Visual analysis workspace regression passed.');
