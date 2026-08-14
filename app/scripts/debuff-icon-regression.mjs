import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findEncounterPowerIcon } from '../src/data/encounter-power-icons.js';

for (const power of ['Commanding Shot', 'Thorn Ward', 'Wicked Reminder', "Wraith's Shadow", 'Break the Spirit']) {
  assert.ok(findEncounterPowerIcon(power), `${power} should reuse the validated class-power icon catalog`);
}

const ui = await readFile(new URL('../src/v7/boss-effects.js', import.meta.url), 'utf8');
assert.match(ui, /ENCOUNTER_POWER_ICON_SPRITE/);
assert.match(ui, /findEncounterPowerIcon/);
assert.match(ui, /function effectIcon/);
assert.match(ui, /debuff-power-icon/);

const css = await readFile(new URL('../src/v7/boss-effects.css', import.meta.url), 'utf8');
assert.match(css, /\.debuff-power-icon/);
assert.match(css, /32px/);

console.log('Debuff icon regression passed.');
