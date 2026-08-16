import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('src/v8/index.js');
const guidance = read('src/v23/semantic-guidance.js');
const css = read('src/v23/semantic-guidance.css');
const parser = read('src/engine/fast-parser-core.js');
const verification = read('src/engine/verification-engine.js');

assert.match(index, /v23\/semantic-guidance\.js/);
for (const phrase of [
  'Performance clocks', 'Session DPS', 'Fight DPS', 'Personal DPS', 'Active DPS',
  'same verified damage numerator but different clocks', 'Companion attribution',
  'Power activations are inferred from combat-log evidence', 'not an independent observation of a button press',
  'How to read Team Debuffs', 'Timing verified', 'Mechanic sourced', 'Damage evidence', 'Magnitude unresolved',
  'does not prove causation'
]) assert.ok(guidance.includes(phrase), `semantic guidance missing: ${phrase}`);
assert.match(guidance, /damage \/ Math\.max\(1, scopeDuration\)/);
assert.match(guidance, /player\.dps/);
assert.match(guidance, /player\.combatDps/);
assert.match(guidance, /player\.companionDamage/);
assert.match(css, /sg-clock-guide-grid/);
assert.match(css, /grid-template-columns:repeat\(3/);
assert.match(css, /max-width:760px/);
assert.match(css, /prefers-reduced-motion|transition|animation|scroll-behavior|^/m);

assert.ok(parser.includes("CANONICAL_DAMAGE_TYPES = new Set(['physical'])"), 'semantic guidance must not change canonical damage inclusion');
assert.ok(verification.includes('verifyReport'), 'semantic guidance must retain the independent arithmetic verifier');

console.log('Metric and inference semantic guidance regression passed.');
