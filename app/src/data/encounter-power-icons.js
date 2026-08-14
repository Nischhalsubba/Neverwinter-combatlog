const CELL = 64;
const SPRITE_WIDTH = 1024;
const SPRITE_HEIGHT = 576;
const ENTRIES = Object.freeze([
  ["Barbarian", "Not so Fast", 0, 0],
  ["Barbarian", "Bloodletter", 64, 0],
  ["Barbarian", "Mighty Leap", 128, 0],
  ["Barbarian", "Indomitable Battle Strike", 192, 0],
  ["Barbarian", "Punishing Charge", 256, 0],
  ["Barbarian", "Hidden Daggers", 320, 0],
  ["Barbarian", "Roar", 384, 0],
  ["Barbarian", "Frenzy", 448, 0],
  ["Barbarian", "Battle Fury", 512, 0],
  ["Barbarian", "Axestorm", 576, 0],
  ["Barbarian", "Takedown", 640, 0],
  ["Barbarian", "Come and Get It", 704, 0],
  ["Barbarian", "Primal Fury", 768, 0],
  ["Barbarian", "Enduring Shout", 832, 0],
  ["Barbarian", "Ignore Weakness", 896, 0],
  ["Bard", "Lunge", 960, 0],
  ["Bard", "Dancing Lights", 0, 64],
  ["Bard", "Flourish", 64, 64],
  ["Bard", "Duet", 128, 64],
  ["Bard", "Improvised Lunge", 192, 64],
  ["Bard", "Improvised Dancing Lights", 256, 64],
  ["Bard", "Ad Libitum", 320, 64],
  ["Bard", "Volti Subito", 384, 64],
  ["Bard", "Contre", 448, 64],
  ["Bard", "Improvised Ad Libitum", 512, 64],
  ["Bard", "Improvised Contre Seconde", 576, 64],
  ["Bard", "Contre Seconde", 640, 64],
  ["Bard", "Mystify", 704, 64],
  ["Bard", "Serenade", 768, 64],
  ["Bard", "Delayed Play", 832, 64],
  ["Bard", "Bassline", 896, 64],
  ["Cleric", "Bastion of Health", 960, 64],
  ["Cleric", "Divine Glow", 0, 128],
  ["Cleric", "Searing Javelin", 64, 128],
  ["Cleric", "Forgemaster's Flame", 128, 128],
  ["Cleric", "Chains of Blazing Light", 192, 128],
  ["Cleric", "Break the Spirit", 256, 128],
  ["Cleric", "Prophecy of Doom", 320, 128],
  ["Cleric", "Daunting Light", 384, 128],
  ["Cleric", "Geas", 448, 128],
  ["Cleric", "Sun Burst", 512, 128],
  ["Cleric", "Healing Word", 576, 128],
  ["Cleric", "Exaltation", 640, 128],
  ["Cleric", "Cleansing Light", 704, 128],
  ["Cleric", "Astral Shield", 768, 128],
  ["Cleric", "Intercession", 832, 128],
  ["Cleric", "Daunting Light", 384, 128],
  ["Cleric", "Geas", 448, 128],
  ["Cleric", "Sun Burst", 512, 128],
  ["Fighter", "Bull Charge", 896, 128],
  ["Fighter", "Anvil of Doom", 960, 128],
  ["Fighter", "Enforced Threat", 0, 192],
  ["Fighter", "Mighty Leap", 64, 192],
  ["Fighter", "Indomitable Battle Strike", 128, 192],
  ["Fighter", "Not So Fast", 192, 192],
  ["Fighter", "Rising Tide", 256, 192],
  ["Fighter", "Retaliate", 320, 192],
  ["Fighter", "Shield Throw", 384, 192],
  ["Fighter", "Knee Breaker", 448, 192],
  ["Fighter", "Shield Slam", 512, 192],
  ["Fighter", "Linebreaker", 576, 192],
  ["Fighter", "Knight's Valor", 640, 192],
  ["Fighter", "Knight's Challenge", 704, 192],
  ["Fighter", "Iron Warrior", 768, 192],
  ["Paladin", "Smite", 832, 192],
  ["Paladin", "Burning Light", 896, 192],
  ["Paladin", "Bane", 960, 192],
  ["Paladin", "Sacred Weapon", 0, 256],
  ["Paladin", "Divine Touch", 64, 256],
  ["Paladin", "Templar's Wrath", 128, 256],
  ["Paladin", "Vow of Enmity", 192, 256],
  ["Paladin", "Absolution", 256, 256],
  ["Paladin", "Binding Oath", 320, 256],
  ["Paladin", "Relentless Avenger", 384, 256],
  ["Paladin", "Divine Shelter", 448, 256],
  ["Paladin", "Banishment", 512, 256],
  ["Paladin", "Cleansing Touch", 576, 256],
  ["Paladin", "Circle of Divinity", 640, 256],
  ["Paladin", "Bond of Virtue", 704, 256],
  ["Ranger", "Cordon of Arrows", 768, 256],
  ["Ranger", "Hindering Shot", 832, 256],
  ["Ranger", "Marauder's Escape", 896, 256],
  ["Ranger", "Constricting Arrow", 960, 256],
  ["Ranger", "Rain of Arrows", 0, 320],
  ["Ranger", "Ambush", 64, 320],
  ["Ranger", "Longstrider's Shot", 128, 320],
  ["Ranger", "Hawk Shot", 192, 320],
  ["Ranger", "Commanding Shot", 256, 320],
  ["Ranger", "Rapid Volley", 320, 320],
  ["Ranger", "Split the Sky", 384, 320],
  ["Ranger", "Boar Hide", 448, 320],
  ["Ranger", "Fox's Cunning", 512, 320],
  ["Ranger", "Binding Arrow", 576, 320],
  ["Ranger", "Thorn Ward", 640, 320],
  ["Rogue", "Blade Flurry", 704, 320],
  ["Rogue", "Lashing Blade", 768, 320],
  ["Rogue", "Path of the Blade", 832, 320],
  ["Rogue", "Smoke Bomb", 896, 320],
  ["Rogue", "Bait and Switch", 960, 320],
  ["Rogue", "Impossible to Catch", 0, 384],
  ["Rogue", "Deft Strike", 64, 384],
  ["Rogue", "Wicked Reminder", 128, 384],
  ["Rogue", "Dazing Strike", 192, 384],
  ["Rogue", "Assassinate", 256, 384],
  ["Rogue", "Vengeance's Pursuit", 320, 384],
  ["Rogue", "Blitz", 384, 384],
  ["Rogue", "Impact Shot", 448, 384],
  ["Rogue", "Shadow Strike", 512, 384],
  ["Rogue", "Shadowy Disappearance", 576, 384],
  ["Warlock", "Arms of Hadar", 640, 384],
  ["Warlock", "Vampiric Embrace", 704, 384],
  ["Warlock", "Blades of Vanquished Armies", 768, 384],
  ["Warlock", "Hadar's Grasp", 832, 384],
  ["Warlock", "Dreadtheft", 896, 384],
  ["Warlock", "Curse Bite", 960, 384],
  ["Warlock", "Fiery Bolt", 0, 448],
  ["Warlock", "Hellfire Ring", 64, 448],
  ["Warlock", "Infernal Spheres", 128, 448],
  ["Warlock", "Killing Flames", 192, 448],
  ["Warlock", "Revitalize", 256, 448],
  ["Warlock", "Pillar of Power", 320, 448],
  ["Warlock", "Wraith's Shadow", 384, 448],
  ["Warlock", "Soulstorm", 448, 448],
  ["Warlock", "Warlock's Bargain", 512, 448],
  ["Wizard", "Entangling Force", 576, 448],
  ["Wizard", "Repel", 640, 448],
  ["Wizard", "Ray of Enfeeblement", 704, 448],
  ["Wizard", "Icy Terrain", 768, 448],
  ["Wizard", "Shield", 832, 448],
  ["Wizard", "Fanning the Flame", 896, 448],
  ["Wizard", "Icy Rays", 960, 448],
  ["Wizard", "Chill Strike", 0, 512],
  ["Wizard", "Conduit of Ice", 64, 512],
  ["Wizard", "Fireball", 128, 512],
  ["Wizard", "Lightning Bolt", 192, 512],
  ["Wizard", "Disintegrate", 256, 512],
  ["Wizard", "Steal Time", 320, 512],
  ["Wizard", "Arcane Tempest", 384, 512],
  ["Wizard", "Arcane Conduit", 448, 512],
  ["Wizard", "Imprisonment", 512, 512],
  ["Wizard", "Shard of the Endless Avalanche", 576, 512],
]);

export function normalizePowerName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘'`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeClassName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

const byClassAndName = new Map();
const byName = new Map();
for (const [className, name, x, y] of ENTRIES) {
  const item = Object.freeze({ className, name, x, y, width: CELL, height: CELL });
  const nameKey = normalizePowerName(name);
  byClassAndName.set(`${normalizeClassName(className)}|${nameKey}`, item);
  const matches = byName.get(nameKey) || [];
  matches.push(item);
  byName.set(nameKey, matches);
}

function sameCell(items) {
  if (!items.length) return false;
  return items.every(item => item.x === items[0].x && item.y === items[0].y);
}

export function isKnownEncounterPowerName(powerName) {
  return byName.has(normalizePowerName(powerName));
}

export function encounterPowerClasses(powerName) {
  const matches = byName.get(normalizePowerName(powerName)) || [];
  return Array.from(new Set(matches.map(item => item.className)));
}

export function findEncounterPowerIcon(powerName, className = '') {
  const nameKey = normalizePowerName(powerName);
  if (!nameKey) return null;
  const classKey = normalizeClassName(className);
  if (classKey) {
    const exact = byClassAndName.get(`${classKey}|${nameKey}`);
    if (exact) return exact;
  }
  const matches = byName.get(nameKey) || [];
  if (matches.length === 1 || sameCell(matches)) return matches[0] || null;
  return null;
}

export const ENCOUNTER_POWER_ICON_COUNT = ENTRIES.length;
export const ENCOUNTER_POWER_ICON_SPRITE = Object.freeze({
  url: new URL('./power-icons/encounter-power-icons.webp', import.meta.url).href,
  width: SPRITE_WIDTH,
  height: SPRITE_HEIGHT,
  cell: CELL
});

let spritePromise = null;
export function loadEncounterPowerIconSprite() {
  if (spritePromise) return spritePromise;
  if (typeof Image === 'undefined') return Promise.reject(new Error('Power icon sprite can only be loaded in a browser.'));
  spritePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Encounter power icons could not be loaded.'));
    image.src = ENCOUNTER_POWER_ICON_SPRITE.url;
  }).catch(error => { spritePromise = null; throw error; });
  return spritePromise;
}
