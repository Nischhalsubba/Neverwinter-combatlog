import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const settings = read('src/v13/settings.css');
const polish = read('src/v14/global-polish.css');
const hardening = read('src/v14/ux-hardening.js');
const qolIndex = read('src/v8/index.js');

assert.match(settings, /^@import url\("\.\.\/v14\/global-polish\.css"\);/);
assert.match(qolIndex, /import '\.\.\/v14\/ux-hardening\.js';/);

for (const token of ['--sg-space-1','--sg-space-2','--sg-space-3','--sg-space-4','--sg-space-5','--sg-space-6','--sg-control-h:44px']) {
  assert.match(polish, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(polish, /@media\(max-width:1024px\)/);
assert.match(polish, /@media\(max-width:768px\)/);
assert.match(polish, /@media\(max-width:420px\)/);
assert.match(polish, /data-theme="dark"/);
assert.match(polish, /data-contrast="high"/);
assert.match(polish, /data-density="compact"/);
assert.match(polish, /data-density="comfortable"/);
assert.match(polish, /prefers-reduced-motion:reduce/);
assert.match(polish, /qol-breadcrumbs/);
assert.match(polish, /qol-event-finder-form/);
assert.match(polish, /boss-effect-card/);
assert.match(polish, /qol-sticky-table thead th/);
assert.match(polish, /outline:2px solid var\(--sg-focus\)/);

assert.match(hardening, /\.nav-copy strong/);
assert.match(hardening, /Current analysis location/);
assert.match(hardening, /main\.tabIndex = -1/);
assert.match(hardening, /Scrollable combat data table/);
assert.match(hardening, /strikeglass:settings-changed/);
assert.doesNotMatch(hardening, /scope-report|raw-page|verifyReport|damage\s*[+*/-]=/);

console.log('Global UX polish regression passed.');
