import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ENCOUNTER_POWER_ICON_COUNT,
  ENCOUNTER_POWER_ICON_SPRITE,
  encounterPowerClasses,
  findEncounterPowerIcon,
  isKnownEncounterPowerName,
  normalizePowerName
} from '../src/data/encounter-power-icons.js';
import { classifyPowerCategory, inferPlayerClass } from '../src/engine/power-taxonomy.js';
import { buildShadowRotation } from '../src/engine/verification-engine.js';

assert.equal(ENCOUNTER_POWER_ICON_COUNT, 141, 'Expected all 141 class Encounter mappings.');
assert.equal(normalizePowerName("Forgemaster’s Flame"), normalizePowerName("Forgemaster's Flame"));
assert.equal(normalizePowerName('Not So Fast'), normalizePowerName('Not so Fast'));

const sprite = await readFile(new URL('../src/data/power-icons/encounter-power-icons.webp', import.meta.url));
assert.ok(sprite.length > 100000, 'Encounter icon sprite is unexpectedly small.');
assert.equal(sprite.subarray(0, 4).toString('ascii'), 'RIFF');
assert.equal(sprite.subarray(8, 12).toString('ascii'), 'WEBP');

const realLogEncounterNames = [
  'Ad Libitum','Arms of Hadar','Bastion of Health','Binding Arrow','Bloodletter','Chains of Blazing Light',
  'Chill Strike','Circle of Divinity','Come and Get It','Constricting Arrow','Curse Bite','Dancing Lights',
  'Daunting Light','Divine Shelter','Enduring Shout','Enforced Threat','Entangling Force','Fanning the Flame',
  'Fiery Bolt','Fireball','Forgemaster\'s Flame','Frenzy','Hadar\'s Grasp','Hindering Shot','Icy Rays','Icy Terrain',
  'Impact Shot','Ignore Weakness','Iron Warrior','Killing Flames','Knight\'s Valor','Lashing Blade','Longstrider\'s Shot',
  'Lunge','Mystify','Not so Fast','Pillar of Power','Prophecy of Doom','Punishing Charge','Relentless Avenger',
  'Repel','Retaliate','Revitalize','Rising Tide','Roar','Sacred Weapon','Searing Javelin','Shadow Strike',
  'Shield Throw','Smite','Soulstorm','Split the Sky','Takedown','Thorn Ward','Vampiric Embrace','Warlock\'s Bargain'
];
for (const power of realLogEncounterNames) {
  assert.equal(isKnownEncounterPowerName(power), true, `${power} is missing from the Encounter catalog.`);
  assert.equal(classifyPowerCategory(power), 'Encounter', `${power} was not classified as Encounter.`);
}

const barbarianNotSoFast = findEncounterPowerIcon('Not so Fast', 'Barbarian');
const fighterNotSoFast = findEncounterPowerIcon('Not So Fast', 'Fighter');
assert.ok(barbarianNotSoFast && fighterNotSoFast);
assert.notDeepEqual([barbarianNotSoFast.x, barbarianNotSoFast.y], [fighterNotSoFast.x, fighterNotSoFast.y], 'Class-specific Not So Fast icons must stay distinct.');
assert.equal(findEncounterPowerIcon('Not so Fast', 'Unknown'), null, 'Ambiguous cross-class names must not guess an icon.');

assert.deepEqual(encounterPowerClasses('Shield Throw'), ['Fighter']);
assert.deepEqual(encounterPowerClasses('Sacred Weapon'), ['Paladin']);
assert.equal(inferPlayerClass([
  { power: 'Shield Throw', damage: 1000 },
  { power: 'Enforced Threat', damage: 800 },
  { power: 'Iron Warrior', damage: 500 }
]).name, 'Fighter');
assert.equal(inferPlayerClass([
  { power: 'Sacred Weapon', damage: 1000 },
  { power: 'Smite', damage: 800 },
  { power: 'Relentless Avenger', damage: 500 }
]).name, 'Paladin');

for (const power of realLogEncounterNames) {
  const classes = encounterPowerClasses(power);
  const icon = classes.length === 1 ? findEncounterPowerIcon(power, classes[0]) : null;
  if (classes.length === 1) assert.ok(icon, `${power} has no icon for ${classes[0]}.`);
}

const shadowRotation = buildShadowRotation([
  {
    ownerName: 'Tank', ownerRef: 'P[1 Tank]', sourceName: '', sourceRef: '*', targetName: '', targetRef: '*',
    powerName: "Knight's Valor", powerRef: 'Pn.test', damageType: 'Power', flagsRaw: '', flags: 0,
    amount: -5, baseAmount: 0, time: 10, lineNo: 1, companion: false
  },
  {
    ownerName: 'Bard', ownerRef: 'P[2 Bard]', sourceName: '', sourceRef: '*', targetName: 'Boss', targetRef: 'C[3 M_Boss]',
    powerName: 'Mystify', powerRef: 'Pn.proc', damageType: 'Physical', flagsRaw: '', flags: 0,
    amount: 1000, baseAmount: 1000, time: 12, lineNo: 2, companion: false
  }
], { scopeStart: 0, scopeEnd: 20, totalRows: 2, targetOnly: false });
assert.equal(shadowRotation.activationCount, 1, 'Encounter rotation should use cast markers instead of generated Encounter damage procs.');
assert.equal(shadowRotation.lanes[0].activations[0].power, "Knight's Valor");
assert.equal(shadowRotation.lanes[0].activations[0].amount, 0);

const workerSource = await readFile(new URL('../src/workers/fast-parse-worker.js', import.meta.url), 'utf8');
assert.match(workerSource, /catalogEncounter/);
assert.match(workerSource, /encounterMarker/);
assert.match(workerSource, /isKnownEncounterPowerName/);

assert.ok(ENCOUNTER_POWER_ICON_SPRITE.width >= 1024);
assert.ok(ENCOUNTER_POWER_ICON_SPRITE.height >= 512);
console.log(`Encounter icon regression passed for ${realLogEncounterNames.length} real-log power names.`);
