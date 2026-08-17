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
  'strikeglass.analysisTour.seen.v2',
  'localStorage',
  'role',
  'dialog',
  'aria-modal',
  'Welcome to Strikeglass',
  'Verification status',
  'Fight scope',
  'Active player',
  'Evidence and confidence',
  'Where to investigate',
  '[data-sg-trust-rail]',
  'sg-tour-overlay',
  'sg-tour-spotlight-ring',
  'data-sg-tour-shade',
  'choosePlacement',
  'setSpotlight',
  'Why it matters'
]) assert.ok(recovery.includes(marker), `recovery/onboarding layer missing ${marker}`);

for (const shade of ['top', 'left', 'right', 'bottom']) {
  assert.ok(recovery.includes(`data-sg-tour-shade="${shade}"`), `tour overlay missing ${shade} shade`);
}

assert.match(recovery, /scopeSelect\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/, 'Reverify must rerun the current scope through the normal scope-change path');
assert.match(recovery, /nav\?\.querySelector\('\[data-view="diagnostics"\]'\)/, 'Blocked analytics must link to Analysis Checks');
assert.match(recovery, /card\.setAttribute\('aria-modal', 'true'\)/, 'First-run guide should identify itself as a modal interaction to assistive technology');
assert.match(recovery, /event\.key === 'Tab'/, 'First-run guide must trap keyboard focus while the overlay is active');
assert.match(recovery, /placement:\s*'below'/, 'Verification guide should prefer an anchored placement below the top-bar status target');
assert.doesNotMatch(recovery, /verification\s*\.\s*status\s*=\s*['"]verified['"]|status\s*:\s*['"]verified['"]/, 'Recovery must never manufacture a verified result');

const css = read('src/v29/recovery-onboarding.css');
for (const marker of [
  '.sg-recovery-actions',
  '.sg-first-run-tip',
  '.sg-tour-overlay',
  '.sg-tour-shade',
  '.sg-tour-spotlight-ring',
  '.sg-tour-progress-dot',
  '.sg-tour-why',
  '--sg-tour-arrow-x',
  '--sg-tour-arrow-y',
  '[data-sg-tour-target="true"]',
  '.qol-boss-debuff-summary .qol-debuff-lines>div',
  'grid-template-columns:minmax(0,1fr) auto',
  'column-gap:16px',
  '@media(max-width:820px)',
  'grid-template-columns:1fr',
  '@media(prefers-reduced-motion:reduce)'
]) assert.ok(css.includes(marker), `recovery/onboarding stylesheet missing ${marker}`);

assert.match(css, /background:rgba\(9,15,25,\.62\)/, 'Tour should dim the non-highlighted application with a contrast overlay');
assert.match(css, /\.sg-first-run-tip\[data-sg-tour-placement="below"\]::before/, 'Tour card should render a callout arrow for the anchored verification step');
assert.match(css, /min-height:42px/, 'Primary tour navigation should keep accessible pointer target height');

const insights = read('src/v8/insights.js');
assert.match(insights, /qol-boss-debuff-summary/);
assert.match(insights, /qol-debuff-lines/);
assert.match(insights, /<strong>\$\{esc\(effect\.name\)\}<\/strong><span>/, 'Boss debuff name and metric must remain separate semantic elements for responsive spacing');

console.log('Recovery, anchored onboarding, and boss-debuff layout regression passed.');
