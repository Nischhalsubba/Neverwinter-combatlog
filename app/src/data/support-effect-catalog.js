const SOURCE_ARAGON_ENHANCEMENTS = Object.freeze({ label: 'Aragon support workbook', section: 'Support Enhancements', updated: '2026-06-13' });
const SOURCE_ARAGON_COMPANIONS = Object.freeze({ label: 'Aragon support workbook', section: 'Support Comps', updated: '2026-03-02' });
const SOURCE_ARAGON_MOUNTS = Object.freeze({ label: 'Aragon support workbook', section: 'Support Mounts', updated: '2025-11-22' });
const SOURCE_ARAGON_ARTIFACTS = Object.freeze({ label: 'Aragon support workbook', section: 'Support Artifacts', updated: '2026-01-25' });
const SOURCE_ARAGON_CONSUMABLES = Object.freeze({ label: 'Aragon support workbook', section: 'Consumables and belt Items', updated: null });
const sourceNwHub = className => Object.freeze({ label: 'Neverwinter Hub', section: `${className} powers`, updated: '2026-08-14', url: `https://nw-hub.com/classes/${className.toLowerCase()}` });

const pct = (stat, value, direction = 'down') => Object.freeze({ stat, value, unit: 'percent', direction });
const rating = (stat, value, direction = 'down') => Object.freeze({ stat, value, unit: 'rating', direction });
const effect = value => Object.freeze({
  aliases: [], duration: null, classification: 'unknown', audience: 'target', effectScope: 'all', changes: [], notes: '', source: null,
  ...value,
  aliases: Object.freeze(value.aliases || []),
  changes: Object.freeze(value.changes || [])
});

export const SUPPORT_EFFECT_CATALOG = Object.freeze([
  effect({ id: 'armor-break', name: 'Armor Break', classification: 'enemy-debuff', family: 'companion-enhancement', duration: 15, changes: [pct('Defense', 9)], description: 'Lowers enemy Defense by 9%.', source: SOURCE_ARAGON_ENHANCEMENTS }),
  effect({ id: 'dulled-senses', name: 'Dulled Senses', classification: 'enemy-debuff', family: 'companion-enhancement', duration: 15, changes: [pct('Awareness', 9)], description: 'Lowers enemy Awareness by 9%.', source: SOURCE_ARAGON_ENHANCEMENTS }),
  effect({ id: 'vulnerability', name: 'Vulnerability', classification: 'enemy-debuff', family: 'companion-enhancement', duration: 15, changes: [pct('Critical Avoidance', 9)], description: 'Lowers enemy Critical Avoidance by 9%.', source: SOURCE_ARAGON_ENHANCEMENTS }),
  effect({ id: 'slowed-reactions', name: 'Slowed Reactions', classification: 'enemy-debuff', family: 'companion-enhancement', changes: [pct('Deflect', 9)], description: 'Lowers enemy Deflect by 9%.', source: SOURCE_ARAGON_ENHANCEMENTS }),
  effect({ id: 'advantage-nullification', name: 'Advantage Nullification', aliases: ['Advantage Nulification'], classification: 'enemy-debuff', family: 'companion-enhancement', changes: [pct('Combat Advantage', 9)], description: 'Lowers enemy Combat Advantage by 9%.', source: SOURCE_ARAGON_ENHANCEMENTS }),
  effect({ id: 'weapon-break', name: 'Weapon Break', classification: 'enemy-debuff', family: 'companion-enhancement', duration: 15, changes: [pct('Critical Severity', 9)], description: 'Lowers enemy Critical Severity by 9%.', source: SOURCE_ARAGON_ENHANCEMENTS }),

  effect({ id: 'spined-devil-debuff', name: 'Spined Devil', aliases: ["Spined Devil's Influence"], classification: 'enemy-debuff', family: 'companion', duration: 10, changes: [pct('Damage Taken', 10, 'up')], description: 'Increases damage taken by the enemy by 10%.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'wormungandr-debuff', name: 'Wormungandr', classification: 'enemy-debuff', family: 'companion', changes: [pct('Damage Taken', 2.5, 'up')], description: 'Increases damage taken by its target by up to 2.5%.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'riotous-rothe-debuff', name: 'Riotous Rothe', classification: 'enemy-debuff', family: 'companion', changes: [pct('Outgoing Damage', 10)], description: 'Reduces damage dealt by nearby enemies by 10%.', notes: 'The workbook notes boss behavior was bugged when tested.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'black-death-scorpion-ca', name: 'Black Death Scorpion', classification: 'target-advantage', family: 'companion', description: 'Makes the target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'pseudodragon-ca', name: 'Pseudodragon', classification: 'target-advantage', family: 'companion', description: 'Can make its target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'blink-dog-ca', name: 'Blink Dog', aliases: ['Blinkdog'], classification: 'target-advantage', family: 'companion', description: 'Can make its target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'panther-ca', name: 'Panther', classification: 'target-advantage', family: 'companion', description: 'Can make its target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'swashbuckler-ca', name: 'Swashbuckler', classification: 'target-advantage', family: 'companion', description: 'Can make its target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'dancing-blade-ca', name: 'Dancing Blade', classification: 'target-advantage', family: 'companion', description: 'Can make its target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'yeth-hound-ca', name: 'Yeth Hound', classification: 'target-advantage', family: 'companion', description: 'Can make its target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'cantankerous-mage-ca', name: 'Cantankerous Mage', classification: 'target-advantage', family: 'companion', description: 'Can make its target grant Combat Advantage.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'rattigan-debuff', name: 'Rattigan the Wise', aliases: ['Rattigan'], classification: 'enemy-debuff', family: 'companion', changes: [pct('Damage Taken', 1, 'up')], description: 'Increases damage taken by its target by about 1%.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'lysaera-debuff', name: 'Lysaera', classification: 'enemy-debuff', family: 'companion', changes: [pct('Awareness', 0.25), pct('Accuracy', 0.25)], description: 'Reduces target Awareness and Accuracy by up to 0.25%.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'blaspheme-assassin-debuff', name: 'Blaspheme Assassin', classification: 'enemy-debuff', family: 'companion', changes: [rating('Defense', 1000), rating('Deflect', 1000)], description: 'Reduces the target’s Defense and Deflect ratings.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'succubus-incubus-debuff', name: 'Succubus / Incubus', aliases: ['Succubus', 'Incubus', 'Succubus/Incubus'], classification: 'enemy-debuff', family: 'companion', duration: 5, changes: [pct('Damage Taken', 10, 'up')], description: 'Increases damage taken by enemies hit by 10%.', notes: 'The workbook says this does not stack with Spined Devil.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'zariel-debuff', name: 'Zariel', classification: 'enemy-debuff', family: 'companion', changes: [pct('Damage Taken', 1, 'up')], description: 'Increases damage taken by the target by about 1%.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'sehanine-debuff', name: 'Priestess of Sehanine Moonbow', classification: 'enemy-debuff', family: 'companion', changes: [rating('Critical Chance', 100)], description: 'Reduces enemy Critical Chance while also supporting allied Critical Strike.', source: SOURCE_ARAGON_COMPANIONS }),

  effect({ id: 'drizzt-party-buff', name: "Drizzt Do'Urden", aliases: ['Drizzt'], classification: 'ally-buff', family: 'companion', changes: [pct('Damage', 3, 'up')], description: 'Party damage buff.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'portobello-party-buff', name: 'Portobello DaVinci', aliases: ['Portobello'], classification: 'ally-buff', family: 'companion', description: 'Party Power and Combat Advantage buff.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'flapjack-party-buff', name: 'Flapjack', classification: 'ally-buff', family: 'companion', description: 'Party Combat Advantage buff.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'tutor-party-buff', name: 'Tutor', classification: 'ally-buff', family: 'companion', description: 'Party Combat Advantage buff.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'etrien-party-buff', name: 'Etrien', aliases: ['Harper Bard'], classification: 'ally-buff', family: 'companion', description: 'Party Power and Critical Strike buff.', source: SOURCE_ARAGON_COMPANIONS }),
  effect({ id: 'controlled-momentum', name: 'Controlled Momentum', classification: 'ally-buff', family: 'class-effect', description: 'A party damage support effect, not an enemy debuff.' }),

  effect({ id: 'hags-cauldron', name: "Hag's Enchanted Cauldron", aliases: ["Hag's Cauldron", "Hag's Cooking Cauldron"], classification: 'enemy-debuff', family: 'mount', changes: [pct('Defense', 7.5), pct('Critical Avoidance', 7.5)], description: 'Reduces enemy Defense and Critical Avoidance by 7.5%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'ollie-octie', name: 'Ollie the Octie', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 15, 'up')], description: 'Increases damage taken by the target by 15%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'red-dragon-mount', name: 'Red Dragon', classification: 'enemy-debuff', family: 'mount', changes: [pct('Critical Avoidance', 15), pct('Outgoing Damage', 15)], description: 'Reduces target Critical Avoidance and outgoing damage by 15%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'snowtusk', name: 'Snowtusk', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 16, 'up'), pct('Outgoing Damage', 16)], description: 'Increases target damage taken and reduces outgoing damage by 16%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'twice-paled-alder', name: 'Twice-Paled Alder', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 16, 'up'), pct('Outgoing Damage', 16)], description: 'Increases target damage taken and reduces outgoing damage by 16%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'glorious-undead-lion', name: 'Glorious Undead Lion', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 16, 'up'), pct('Accuracy', 16)], description: 'Increases target damage taken and reduces Accuracy by 16%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'phantom-panther-mount', name: 'Phantom Panther', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 16, 'up'), pct('Critical Strike', 16)], description: 'Increases target damage taken and reduces Critical Strike by 16%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'swarm-mount', name: 'Swarm', aliases: ['Bat Swarm'], classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 15, 'up'), pct('Outgoing Damage', 15), pct('Critical Chance', 15)], description: 'Increases damage taken while reducing enemy damage and Critical Chance.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'eclipse-lion', name: 'Eclipse Lion', aliases: ['Neo Eclipse Lion', '(neo) Eclipse Lion'], classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 15, 'up'), pct('Outgoing Damage', 15)], description: 'Increases target damage taken and reduces outgoing damage by 15%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'king-of-spines', name: 'King of Spines / Tyrannosaur', aliases: ['King of Spines', 'Tyrannosaur', "Tyrannosaurus Rex'em", 'Mythic Tyrannosaurus Rex’em'], classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 15, 'up')], description: 'Increases damage taken by the target; also roots controllable targets.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'brain-stealer-dragon', name: 'Brain Stealer Dragon', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 15, 'up')], description: 'Increases damage taken by targets by 15%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'bestial-fire-archon', name: 'Bestial Fire Archon', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 15, 'up')], description: 'Increases damage taken by targets inside its magma pools by 15%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'balgora', name: 'Balgora', aliases: ["Hell's Impact"], classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 11, 'up')], description: 'Increases damage taken by targets by 11%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'recon-balloons', name: 'Reconnaissance Balloons', classification: 'enemy-debuff', family: 'mount', changes: [pct('Damage Taken', 7.5, 'up')], description: 'Increases damage taken by targets by 7.5%.', source: SOURCE_ARAGON_MOUNTS }),
  effect({ id: 'salamander-mount', name: 'Salamander', classification: 'enemy-debuff', family: 'mount', changes: [pct('Deflect', 15), pct('Outgoing Damage', 15), pct('Critical Chance', 13)], description: 'Slows the target and reduces Deflect, damage, and Critical Chance.', source: SOURCE_ARAGON_MOUNTS }),

  effect({ id: 'adamantine-strike-debuff', name: 'Adamantine Strike', classification: 'enemy-debuff', family: 'class-power', duration: 10, changes: [pct('Damage Taken', 5, 'up')], description: 'Increases target damage taken by 5% for 10 seconds.', source: sourceNwHub('Barbarian') }),
  effect({ id: 'disarming-takedown-debuff', name: 'Disarming Takedown', classification: 'enemy-debuff', family: 'class-feat', duration: 10, effectScope: 'physical', changes: [pct('Damage Taken', 5, 'up')], description: 'Makes the target take 5% more physical damage for 10 seconds.', source: sourceNwHub('Barbarian') }),
  effect({ id: 'crushing-advance-debuff', name: 'Crushing Advance', classification: 'enemy-debuff', family: 'class-feat', duration: 12, changes: [pct('Outgoing Damage', 12)], description: 'Reduces target damage dealt by 12% for 12 seconds.', source: sourceNwHub('Barbarian') }),
  effect({ id: 'dancing-lights-debuff', name: 'Dancing Lights', classification: 'enemy-debuff', family: 'class-power', duration: 6, changes: [pct('Outgoing Damage', 5)], description: 'Reduces target damage dealt by 5% for 6 seconds.', source: sourceNwHub('Bard') }),
  effect({ id: 'break-the-spirit-debuff', name: 'Break the Spirit', classification: 'enemy-debuff', family: 'class-power', duration: 10, effectScope: 'magical-projectile', changes: [pct('Damage Taken', 10, 'up')], description: 'Makes the target take 10% more magical and projectile damage for 10 seconds.', source: sourceNwHub('Cleric') }),
  effect({ id: 'geas-debuff', name: 'Geas', classification: 'enemy-debuff', family: 'class-power', duration: 6, changes: [pct('Outgoing Damage', 5)], description: 'Reduces target damage dealt by 5% for 6 seconds.', source: sourceNwHub('Cleric') }),
  effect({ id: 'commanding-shot-debuff', name: 'Commanding Shot', classification: 'enemy-debuff', family: 'class-power', duration: 10, changes: [pct('Damage Taken', 10, 'up')], description: 'Increases target damage taken by 10% for 10 seconds.', source: sourceNwHub('Ranger') }),
  effect({ id: 'thorn-ward-debuff', name: 'Thorn Ward', classification: 'enemy-debuff', family: 'class-power', duration: 10, effectScope: 'physical-projectile', refreshes: true, changes: [pct('Damage Taken', 10, 'up')], description: 'Makes the target take 10% more physical and projectile damage; hits refresh the 10-second effect.', source: sourceNwHub('Ranger') }),
  effect({ id: 'disheartening-strike-debuff', name: 'Disheartening Strike', classification: 'enemy-debuff', family: 'class-power', duration: 10, effectScope: 'physical-projectile', changes: [pct('Damage Taken', 5, 'up')], description: 'Makes the target take 5% more physical and projectile damage for 10 seconds.', source: sourceNwHub('Rogue') }),
  effect({ id: 'smoke-bomb-advantage', name: 'Smoke Bomb', classification: 'target-advantage', family: 'class-power', duration: 4, description: 'While stealthed, allies gain Combat Advantage against enemies inside the smoke bomb.', source: sourceNwHub('Rogue') }),
  effect({ id: 'wicked-reminder-debuff', name: 'Wicked Reminder', classification: 'enemy-debuff', family: 'class-power', duration: 10, effectScope: 'physical', changes: [pct('Damage Taken', 10, 'up'), pct('Critical Avoidance', 5)], description: 'Makes the target take 10% more physical damage; the stealthed version also lowers Critical Avoidance by 5%.', source: sourceNwHub('Rogue') }),
  effect({ id: 'shadow-strike-debuff', name: 'Shadow Strike', classification: 'enemy-debuff', family: 'class-power', duration: 10, effectScope: 'physical-projectile', changes: [pct('Damage Taken', 5, 'up')], description: 'Makes the target take 5% more physical and projectile damage for 10 seconds.', source: sourceNwHub('Rogue') }),
  effect({ id: 'courage-breaker-debuff', name: 'Courage Breaker', classification: 'enemy-debuff', family: 'class-power', duration: 8, changes: [pct('Outgoing Damage', 15), pct('Movement', 70)], description: 'Reduces attack damage by 15% and slows the target for 8 seconds.', source: sourceNwHub('Rogue') }),
  effect({ id: 'wraiths-shadow-debuff', name: "Wraith's Shadow", classification: 'enemy-debuff', family: 'class-power', duration: 6, changes: [pct('Outgoing Damage', 5)], description: 'Reduces target damage dealt by 5% and slows the target for 6 seconds.', source: sourceNwHub('Warlock') }),

  ...[
    ["Demogorgon's Reach", 6], ['Mythallar Fragment', 10], ["Halaster's Blast Scepter", 10], ["Xeleth's Blast Scepter", 10], ["Frozen Storyteller's Journal", 15], ['Nightflame Censer', 10], ['Wyvern Knives', 10], ['Dragonbone Blades', 10], ["Assassin's Dice", 15], ['Tentacle Rod', 10], ["Crystal of Soul's Flight", 10], ["Marco's Mystic Marker", 10], ['Token of Chromatic Storm', 10], ['Beacon of Meteor Swarm', 10], ['Lantern of Revelation', 10], ['Spelljammer', 10], ["Black Dragon's Mark", 10], ['Heart of the Volcano', 10], ['Heart of the Black Dragon', 10], ['Charm of the Serpent', 10], ['Jewel of Caldera', 10], ['Jewel of the North', 10], ['Thirst', 10], ['Demon Skull', 10], ['Broken Halo', 10], ['Sealing Parchment', 10], ['Wand of Domination', 10], ['Marilith Mask', 10], ['Realm Engine Core', 10], ['Bloodbrass Pistol', 10], ['Grace of Pelor', 15]
  ].map(([name, duration]) => effect({ id: `support-artifact-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, classification: 'support-window', family: 'artifact', duration, description: 'Support artifact window. Exact debuff semantics are only shown when the combat log identifies them safely.', source: SOURCE_ARAGON_ARTIFACTS })),

  effect({ id: 'diamond-blessing', name: 'Diamond Blessing', classification: 'ally-buff', family: 'consumable', duration: 15 * 60, changes: [pct('Damage', 5, 'up')], description: 'Player damage buff.', source: SOURCE_ARAGON_CONSUMABLES }),
  effect({ id: 'oil-of-sharpness', name: 'Oil of Sharpness', classification: 'ally-buff', family: 'consumable', duration: 15 * 60, changes: [pct('Damage', 3, 'up')], description: 'Player damage buff.', source: SOURCE_ARAGON_CONSUMABLES }),
  effect({ id: 'potion-dragon-slaying', name: 'Potion of Dragon Slaying, Rank 5', aliases: ['Potion of Dragon Slaying'], classification: 'ally-buff', family: 'consumable', duration: 60 * 60, effectScope: 'dragons', changes: [pct('Damage', 10, 'up')], description: 'Player damage buff against dragons.', source: SOURCE_ARAGON_CONSUMABLES })
]);

function normalize(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const BY_NAME = new Map();
for (const entry of SUPPORT_EFFECT_CATALOG) {
  for (const name of [entry.name, ...(entry.aliases || [])]) {
    const key = normalize(name);
    if (key && !BY_NAME.has(key)) BY_NAME.set(key, entry);
  }
}

export function findSupportEffect(value) {
  return BY_NAME.get(normalize(value)) || null;
}

export function isCataloguedEnemyDebuff(value) {
  return findSupportEffect(value)?.classification === 'enemy-debuff';
}

export function describeEffectChanges(entry) {
  return (entry?.changes || []).map(change => {
    const direction = change.direction === 'up' ? 'increased' : 'reduced';
    const value = change.unit === 'percent' ? `${change.value}%` : String(change.value);
    return `${change.stat} ${direction} by ${value}`;
  });
}

export const SUPPORT_EFFECT_CATALOG_VERSION = 1;
