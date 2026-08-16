import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const index = read('src/v29/index.js');
assert.match(index, /\.\/recovery-onboarding\.js/);

const recovery = read('src/v29/recovery-onboarding.js');
for (const marker of [
  'verification-blocked',
  'Reverify analysis',
  'Open Analysis Checks',
  'encounter-select',
  'strikeglass:analysis-ready',
  'strikeglass.analysisTour.seen.v1',
  'localStorage',
  'role',
  'dialog',
  'Verification status',
  'Fight scope',
  'Active player',
  'Evidence and confidence',
  'Where to investigate',
  '[data-sg-trust-rail]'
]) assert.ok(recovery.includes(marker), `recovery/onboarding layer missing ${marker}`);

assert.match(recovery, /scopeSelect\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/, 'Reverify must rerun the current scope through the normal scope-change path');
assert.match(recovery, /nav\?\.querySelector\('\[data-view="diagnostics"\]'\)/, 'Blocked analytics must link to Analysis Checks');
assert.doesNotMatch(recovery, /verification\s*\.\s*status\s*=\s*['"]verified['"]|status\s*:\s*['"]verified['"]/, 'Recovery must never manufacture a verified result');

const css = read('src/v29/recovery-onboarding.css');
for (const marker of [
  '.sg-recovery-actions',
  '.sg-first-run-tip',
  '[data-sg-tour-target="true"]',
  '.qol-boss-debuff-summary .qol-debuff-lines>div',
  'grid-template-columns:minmax(0,1fr) auto',
  'column-gap:16px',
  '@media(max-width:720px)',
  'grid-template-columns:1fr'
]) assert.ok(css.includes(marker), `recovery/onboarding stylesheet missing ${marker}`);

const insights = read('src/v8/insights.js');
assert.match(insights, /qol-boss-debuff-summary/);
assert.match(insights, /qol-debuff-lines/);
assert.match(insights, /<strong>\$\{esc\(effect\.name\)\}<\/strong><span>/, 'Boss debuff name and metric must remain separate semantic elements for responsive spacing');

console.log('Recovery, onboarding, and boss-debuff layout regression passed.');
