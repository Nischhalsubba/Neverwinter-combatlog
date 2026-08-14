import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const settings = read('src/v13/settings.js');
const css = read('src/v13/settings.css');
const qol = read('src/v8/qol.css');

assert.match(index, /strikeglass\.settings\.v1/);
assert.match(index, /src\/v13\/settings\.css/);
assert.match(index, /src\/v13\/settings\.js/);
assert.match(index, /id="app-settings-button"/);
assert.match(index, /content="light dark"/);
assert.match(settings, /prefers-color-scheme: dark/);
assert.match(settings, /prefers-reduced-motion: reduce/);
assert.match(settings, /localStorage\.setItem/);
assert.match(settings, /trapDialogKeys/);
assert.match(settings, /strikeglass:settings-changed/);
assert.match(css, /data-theme="dark"/);
assert.match(css, /data-contrast="high"/);
assert.match(css, /data-density="compact"/);
assert.match(css, /data-motion="reduced"/);
assert.match(css, /min-height:44px/);
assert.match(qol, /Refined insight strip/);
assert.match(qol, /qol-matters \.qol-insight\{border:0;border-radius:0;box-shadow:none/);

console.log('Settings and accessibility regression passed.');
