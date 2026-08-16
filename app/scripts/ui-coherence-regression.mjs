import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bootstrap = read('src/v3/power-drilldown.js');
const ui = read('src/v21/ui-coherence.js');
const styles = read('src/v21/ui-coherence.css');
const overview = read('src/v20/overview-layout.js');
const parser = read('src/engine/fast-parser-core.js');
const verifier = read('src/engine/verification-engine.js');

for (const marker of [
  '../v21/ui-coherence.css',
  'data-strikeglass-ui-coherence',
  "await import('../v21/ui-coherence.js')",
  "await import('../v20/overview-layout.js')"
]) assert.ok(bootstrap.includes(marker), `bootstrap missing ${marker}`);
assert.ok(bootstrap.indexOf("../v21/ui-coherence.js") < bootstrap.indexOf("../v12/runtime.js"), 'UI coherence must attach before lazy route tasks run');

for (const marker of [
  'stabilizeOverviewLayout',
  "child.querySelector('[data-player-row]')",
  "classList.add('sg-overview-party', 'sg-overview-full-span')",
  'data-sg-active-player',
  'Change active player',
  'task-progress',
  'effect-intelligence-report',
  'raw-page',
  'data-sg-task-eta',
  'data-sg-parse-eta-card',
  'Estimating ETA',
  'trackerEta',
  'rememberDuration',
  'strikeglass:view-rendered'
]) assert.ok(ui.includes(marker), `UI coherence missing ${marker}`);
assert.doesNotMatch(ui, /fast-parser-core|verification-engine|effect-intelligence-engine/);

for (const marker of [
  '.view-root.sg-overview:not(:has(.v6-dashboard-grid)) > .panel:not(.qol-matters)',
  '.sg-active-player-chip',
  'min-height:44px',
  '.sg-global-task',
  '.sg-inline-progress',
  '.task-progress-copy:has([data-sg-task-eta])',
  '.parse-state .telemetry-grid:has([data-sg-parse-eta-card])',
  '.sg-share-strip i:nth-child(8n+1)',
  '.sg-share-strip i:nth-child(8n+8)',
  '.sg-share-legend span::before'
]) assert.ok(styles.includes(marker), `UI coherence styles missing ${marker}`);

const colors = [...styles.matchAll(/--sg-player-share-color:(#[0-9a-f]{6})/gi)].map(match => match[1].toLowerCase());
assert.equal(new Set(colors).size, 8, 'player distribution must expose eight distinct stable colors');

assert.ok(overview.includes("root.classList.add('sg-overview')"), 'Overview enhancement contract changed unexpectedly');
assert.ok(parser.includes("CANONICAL_DAMAGE_TYPES = new Set(['physical'])"), 'UI work must not change canonical Physical damage handling');
assert.ok(verifier.includes('verifyReport'), 'UI work must retain independent verification');

console.log('UI coherence regression passed. Overview recovery, active-player context, task progress/ETA, parse ETA, and distinct party-share colors are present without changing combat calculations.');
