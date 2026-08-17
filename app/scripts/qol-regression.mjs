import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const loader = read('src/v3/power-drilldown.js');
const runtime = read('src/v12/runtime.js');
assert.match(loader, /\.\.\/v12\/runtime\.js/);
assert.doesNotMatch(loader, /\.\.\/v8\/index\.js/);
assert.doesNotMatch(loader, /power-popup\/index\.js/);
assert.match(runtime, /function ensureQolStyle/);
assert.match(runtime, /\.\.\/v8\/qol\.css/);
assert.match(runtime, /import\('\.\.\/v8\/index\.js'\)/);
assert.match(runtime, /import\('\.\.\/v3\/power-popup\/index\.js'\)/);
assert.match(runtime, /requestIdleCallback/);
assert.ok(runtime.indexOf('ensureQolStyle();') < runtime.indexOf("import('../v8/index.js')"), 'QoL stylesheet must be requested before QoL controls are imported');
assert.doesNotMatch(loader, /powersNav\.click|returnToOrigin|originView/);

const popup = read('src/v3/power-popup/index.js');
assert.match(popup, /data-power-popup-trigger/);
assert.match(popup, /powerPopupPlayer/);
assert.match(popup, /currentScope\(\)/);

const worker = read('src/v3/power-popup/worker.js');
assert.match(worker, /StrikeglassWorkerBridge\?\.mainWorker/);

const index = read('src/v8/index.js');
for (const module of ['navigation','insights','player-actions','attempts','events','tables','command']) {
  assert.match(index, new RegExp(`\\./${module}\\.js`));
}

const navigation = read('src/v8/navigation.js');
assert.match(navigation, /qol-breadcrumbs/);
assert.match(navigation, /aria-current="page"/);
assert.match(navigation, /currentViewButton/);
assert.match(navigation, /Previous fight/);
assert.match(navigation, /Next fight/);
assert.match(navigation, /All fights/);
assert.match(navigation, /Bosses only/);
assert.match(navigation, /Hide tiny fights/);
assert.match(navigation, /Compare attempts/);
assert.match(navigation, /event\.key\.toLowerCase\(\) === 'j'/);
assert.match(navigation, /event\.key\.toLowerCase\(\) === 'k'/);

const insights = read('src/v8/insights.js');
assert.match(insights, /What mattered in this fight\?/);
assert.match(insights, /Debuff uptime/);
assert.match(insights, /verifiedBossEffects/);

const attempts = read('src/v8/attempts.js');
assert.match(attempts, /Compare .*attempt/i);
assert.match(attempts, /verifiedReport/);
assert.match(attempts, /verifiedBossEffects/);

const events = read('src/v8/events.js');
for (const copy of ['Power contains','Target contains','Minimum amount','Critical','Flank / CA','Immune only','Copy this event']) {
  assert.match(events, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(events, /MAX_RESULTS = 250/);
assert.match(events, /MAX_CANDIDATES_PER_PASS = 50000/);
assert.match(events, /matches per page/);
assert.match(events, /Continue search/);
assert.match(events, /result-limit/);
assert.match(events, /candidate-limit/);
assert.match(events, /state\.cursor/);
assert.doesNotMatch(events, /scan limit reached; narrow the filters for later rows/);
assert.match(events, /data-power-popup-player/);

const tables = read('src/v8/tables.js');
assert.match(tables, /Copy fight summary/);
assert.match(tables, /Export CSV/);
assert.match(tables, /Columns/);
assert.match(tables, /localStorage|savePrefs/);
for (const marker of [
  'HEADER_HELP',
  "damage: 'Total damage dealt.'",
  "avg: 'Average damage per hit.'",
  'data-qol-header-help-button',
  'aria-label',
  'aria-describedby',
  'pointerenter',
  "addEventListener('focus'",
  'showHeaderTooltip',
  'hideHeaderTooltip'
]) assert.ok(tables.includes(marker), `table header help missing ${marker}`);
assert.match(tables, /allTables\.forEach\(addHeaderHelp\)/, 'Every rendered table should receive header help, including compact and popup tables');
assert.match(tables, /header\.append\(button\)/, 'Help control should sit beside the visible table heading');

const command = read('src/v8/command.js');
assert.match(command, /Quick navigation/);
assert.match(command, /event\.key === '\/'/);
assert.match(command, /event\.key\.toLowerCase\(\) === 'k'/);

const css = read('src/v8/qol.css');
assert.match(css, /qol-fight-nav\{display:flex;grid-column:1\/-1;align-items:center/);
assert.match(css, /max-height:44px/);
assert.match(css, /appearance:none/);
assert.match(css, /qol-breadcrumbs/);
assert.match(css, /min-height:44px/);
assert.match(css, /max-width:1024px/);
assert.match(css, /max-width:768px/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css, /qol-sticky-table/);
for (const marker of [
  '.qol-header-help',
  ".qol-header-help::before{content:'?'}",
  '.qol-header-help::after',
  'inset:-10px',
  '.qol-header-tooltip',
  '.qol-header-tooltip.is-visible'
]) assert.ok(css.includes(marker), `table header help stylesheet missing ${marker}`);

const controlFixes = read('src/v18/control-fixes.css');
for (const marker of [
  '.qol-event-finder .qol-event-checks .button[type="submit"]',
  'block-size:44px',
  'max-block-size:44px',
  'display:inline-flex',
  'gap:8px',
  '.qol-event-finder .qol-event-checks .button[type="submit"] svg',
  'inline-size:16px',
  'block-size:16px',
  'fill:none',
  'stroke:currentColor'
]) {
  assert.ok(controlFixes.includes(marker), `event-search control repair missing ${marker}`);
}
assert.doesNotMatch(controlFixes, /\.qol-event-finder[\s\S]*?button\[type="submit"\][^{]*\{[^}]*block-size\s*:\s*(?:1[5-9]\d|[2-9]\d{2,})px/i, 'Search events button must not inherit an oversized SVG-driven height');

const parser = read('src/engine/fast-parser-core.js');
const verification = read('src/engine/verification-engine.js');
assert.ok(parser.includes("CANONICAL_DAMAGE_TYPES = new Set(['physical'])"), 'QoL release must retain the canonical damage contract');
assert.ok(verification.includes('verifyReport'), 'QoL release must retain independent report verification');

console.log('QoL regression passed.');
