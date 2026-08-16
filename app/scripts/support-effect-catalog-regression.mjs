import assert from 'node:assert/strict';
import { SUPPORT_EFFECT_CATALOG, SUPPORT_EFFECT_CATALOG_VERSION, findSupportEffect, isCataloguedEnemyDebuff, isTeamDamageSupportEffect } from '../src/data/support-effect-catalog.js';

assert.equal(SUPPORT_EFFECT_CATALOG_VERSION, 2);
assert.ok(SUPPORT_EFFECT_CATALOG.length >= 70, 'support catalog should retain the workbook and current class-effect coverage');

const normalizeAlias = value => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[’']/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const aliases = new Map();
for (const entry of SUPPORT_EFFECT_CATALOG) {
  for (const value of [entry.name, ...(entry.aliases || [])]) {
    const key = normalizeAlias(value);
    assert.ok(key, `support effect ${entry.id} must not publish an empty name or alias`);
    const previous = aliases.get(key);
    assert.ok(!previous || previous === entry.id, `support-effect alias collision: "${value}" resolves to both ${previous} and ${entry.id}`);
    aliases.set(key, entry.id);
  }
  if (entry.source?.updated) assert.match(String(entry.source.updated), /^\d{4}-\d{2}-\d{2}$/, `${entry.id} source update must use YYYY-MM-DD`);
}

const armor = findSupportEffect('Armor Break');
assert.equal(armor.classification, 'enemy-debuff');
assert.equal(armor.duration, 15);
assert.equal(armor.changes[0].stat, 'Defense');
assert.equal(armor.changes[0].value, 9);
assert.equal(armor.source.section, 'Support Enhancements');
assert.equal(armor.source.updated, '2026-06-13');

assert.equal(findSupportEffect('Advantage Nulification').id, 'advantage-nullification', 'workbook spelling variant remains an alias');
assert.equal(findSupportEffect('Bat Swarm').id, 'swarm-mount');
assert.equal(findSupportEffect("Tyrannosaurus Rex'em").id, 'king-of-spines');
assert.equal(findSupportEffect('Succubus').duration, 5);
assert.equal(findSupportEffect("Spined Devil's Influence").duration, 10);

const commanding = findSupportEffect('Commanding Shot');
assert.equal(commanding.classification, 'enemy-debuff');
assert.equal(commanding.duration, 10);
assert.equal(commanding.source.label, 'Neverwinter Hub');
assert.match(commanding.source.url, /nw-hub\.com\/classes\/ranger/);

const wicked = findSupportEffect('Wicked Reminder');
assert.equal(wicked.duration, 10);
assert.ok(wicked.changes.some(change => change.stat === 'Critical Avoidance' && change.value === 5));

const artifact = findSupportEffect("Demogorgon's Reach");
assert.equal(artifact.classification, 'support-window');
assert.equal(artifact.duration, 6);
assert.equal(artifact.source.section, 'Support Artifacts');

assert.equal(findSupportEffect('Diamond Blessing').classification, 'ally-buff');
assert.equal(findSupportEffect('Controlled Momentum').classification, 'ally-buff');
assert.equal(isCataloguedEnemyDebuff('Controlled Momentum'), false);
assert.equal(isCataloguedEnemyDebuff('Armor Break'), true);
assert.equal(isTeamDamageSupportEffect('Armor Break'), true);
assert.equal(isTeamDamageSupportEffect('Vulnerability'), true);
assert.equal(isTeamDamageSupportEffect('Black Death Scorpion'), true, 'Combat Advantage target effects help party damage');
assert.equal(isTeamDamageSupportEffect('Weapon Break'), false, 'defensive-only enemy Critical Severity reduction is not a party damage debuff');
assert.equal(isTeamDamageSupportEffect('Advantage Nullification'), false, 'enemy Combat Advantage reduction is defensive, not party damage support');
assert.equal(isTeamDamageSupportEffect('Controlled Momentum'), false, 'party buffs stay off the Debuff page');
assert.equal(findSupportEffect('Definitely Not A Real Effect'), null);

console.log('Support effect catalog regression passed.');
