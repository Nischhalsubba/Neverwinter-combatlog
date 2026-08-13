const CATEGORY_BY_POWER = new Map([
  ['Chilling Cloud','At-Will'],['Magic Missile','At-Will'],['Electric Shot','At-Will'],['Rapid Shot','At-Will'],['Sly Flourish','At-Will'],['Cleave','At-Will'],['Brash Strike','At-Will'],['Lance of Faith','At-Will'],['Arpeggio','At-Will'],['Eldritch Blast','At-Will'],
  ['Icy Rays','Encounter'],['Chill Strike','Encounter'],['Repel','Encounter'],['Entangling Force','Encounter'],['Fanning the Flame','Encounter'],['Fanned Flame','Encounter'],['Gathering Flame','Encounter'],['Fireball','Encounter'],['Icy Terrain','Encounter'],['Thorn Ward','Encounter'],['Thorn Strike','Encounter'],['Hindering Strike','Encounter'],['Split the Sky','Encounter'],['Throw Caution','Encounter'],['Hindering Shot','Encounter'],['Dazing Strike','Encounter'],['Lashing Blade','Encounter'],['Assassinate','Encounter'],['Anvil of Doom','Encounter'],['Not so Fast','Encounter'],['Bloodletter','Encounter'],['Duet','Encounter'],['Volti Subito','Encounter'],['Blaze Flamenco','Encounter'],['Phantasmal Concerto','Encounter'],['Ray of Enfeeblement','Encounter'],['Killing Flames','Encounter'],['Pillar of Power','Encounter'],
  ['Ice Knife','Daily'],['Furious Immolation','Daily'],['Forest Ghost','Daily'],['Whirlwind of Blades','Daily'],['Crescendo','Daily'],['Bloodbath','Daily'],['Slam','Daily'],
  ['Infernal Pounce','Mount'],['Tunnel Vision','Mount'],['Grand Inspiration','Mount'],['Radiant Weapon','Mount'],
  ['Rimefire Smolder','Feat'],['Shatter Strike','Feat'],['Glowing Flames','Feat'],['Grasping Roots','Feat'],['Reprisal Reflex','Feat'],['Mutation','Feat'],['Life Lessons','Feat'],['Smolder','Class Feature'],['Battle Awareness','Class Feature'],
  ['Mark of the Giant Slayer, Rank 2','Item / Enchant'],['Empowered Owlbear Figurine','Item / Enchant'],['Owlbear Figurine','Item / Enchant'],["Spined Devil's Influence",'Item / Enchant'],['Lightning Flash','Item / Enchant'],["Enchanter's Hex",'Item / Enchant'],['Ethereal Vortex','Item / Enchant'],['Realm Engine Blast','Item / Enchant'],
  ['Loose the Ballista!','Pet / Companion'],['Suppressing Fire!','Pet / Companion'],['Slash','Pet / Companion'],['Thrust','Pet / Companion'],['Instructional Aid','Pet / Companion'],["Winter's Wrath",'Pet / Companion'],["Witch's Finale",'Pet / Companion'],['Tail Sting','Pet / Companion'],
  ['Blood Lust','Other / Unknown'],['Tentacle Slam','Other / Unknown'],['Infection','Other / Unknown']
]);

const ARTIFACT_NAMES = new Set([
  "Alaric's Artillery Beacon",'Apocalypse Dagger',"Arcturia's Music Box",'Beacon of Meteor Swarm','Beacon of Simril','Beacon of the Astral Sea',"Belial's Portal Stone",'Blood Crystal Raven Skull','Book of Vile Darkness',"Bruenor's Helm",'Champion\'s Banner','Crimson Calamity','Decanter of Atropal Essence','Deck of a Few Things','Demogorgon\'s Reach','Dragonbone Blades','Emblem of the Seldarine','Eye of Lathandar','Eye of Odran','Eye of the Giant','Forgehammer of Gond','Fragmented Key of Stars','Globe of the Third Eye','Golden Memories','Halaster\'s Blast Scepter','Heart of the Black Dragon','Heart of the Blue Dragon','Heart of the Green Dragon','Heart of the Red Dragon','Heart of the White Dragon','Horn of Valhalla','Jewel of the North',"Kessell's Spheres of Annihilation",'Lantern of Revelation',"Lostmauth's Horn of Blasting",'Mythallar Fragment',"Neverwinter's Standard",'Prototype Realm Engine','Realm Engine Core','Rod of Imperial Restraint','Shard of Orcus\' Wand','Shard of Valindra\'s Crown','Siege Master\'s War Horn','Sigil of the Barbarian','Sigil of the Bard','Sigil of the Cleric','Sigil of the Fighter','Sigil of the Paladin','Sigil of the Ranger','Sigil of the Rogue','Sigil of the Warlock','Sigil of the Wizard','Soul Sight Crystal','Staff of Flowers','Sword of Zariel','Tiamat\'s Arcane Globe','Tiamat\'s Orb of Majesty','Token of Chromatic Storm','Tome of Ascendance','Trobriand\'s Ring','Tymora\'s Spinning Coin','Wheel of Elements','Wyvern Venom Coated Knives'
].map(value => value.toLowerCase()));

const CLASS_HINTS = Object.freeze({
  Wizard: ['Chilling Cloud','Magic Missile','Icy Rays','Chill Strike','Repel','Entangling Force','Icy Terrain','Ice Knife','Rimefire Smolder','Smolder'],
  Ranger: ['Electric Shot','Rapid Shot','Thorn Ward','Thorn Strike','Hindering Strike','Hindering Shot','Split the Sky','Forest Ghost','Grasping Roots'],
  Barbarian: ['Cleave','Brash Strike','Anvil of Doom','Not so Fast','Bloodletter','Slam'],
  Rogue: ['Sly Flourish','Dazing Strike','Lashing Blade','Assassinate','Whirlwind of Blades','Bloodbath'],
  Warlock: ['Eldritch Blast','Killing Flames','Pillar of Power'],
  Cleric: ['Lance of Faith'],
  Bard: ['Arpeggio','Duet','Volti Subito','Blaze Flamenco','Phantasmal Concerto']
});

const ACTIVATION_CATEGORIES = new Set(['At-Will','Encounter','Daily','Artifact','Mount']);

export function classifyPowerCategory(powerName, { companion = false, powerRef = '' } = {}) {
  const name = String(powerName || 'Unknown').trim() || 'Unknown';
  if (companion) return 'Pet / Companion';
  const direct = CATEGORY_BY_POWER.get(name);
  if (direct) return direct;
  const lower = name.toLowerCase();
  const ref = String(powerRef || '').toLowerCase();
  if (ARTIFACT_NAMES.has(lower) || /artifact|sigil_of_|storyteller|journal/.test(ref)) return 'Artifact';
  if (/mount|combat_power_mount/.test(ref)) return 'Mount';
  if (/belt|potion|consumable/.test(ref)) return 'Item / Enchant';
  return 'Other / Unknown';
}

export function summarizeCategories(powers = []) {
  const map = new Map();
  let total = 0;
  for (const power of powers) total += Number(power.damage) || 0;
  for (const power of powers) {
    const category = power.category || classifyPowerCategory(power.power, { companion: (power.companionDamage || 0) > 0 });
    let entry = map.get(category);
    if (!entry) {
      entry = { category, damage: 0, hits: 0, powers: 0, share: 0 };
      map.set(category, entry);
    }
    entry.damage += Number(power.damage) || 0;
    entry.hits += Number(power.hits) || 0;
    entry.powers += 1;
  }
  const rows = Array.from(map.values());
  for (const row of rows) row.share = total ? row.damage / total * 100 : 0;
  return rows.sort((a, b) => b.damage - a.damage || a.category.localeCompare(b.category));
}

export function inferPlayerClass(powers = []) {
  const scores = new Map();
  const evidence = new Map();
  for (const [className, hints] of Object.entries(CLASS_HINTS)) {
    scores.set(className, 0);
    evidence.set(className, []);
    const hintSet = new Set(hints);
    for (const power of powers) {
      if (!hintSet.has(power.power)) continue;
      const weight = Math.max(1, Math.log10(Math.max(10, Number(power.damage) || 0)));
      scores.set(className, scores.get(className) + weight);
      evidence.get(className).push(power.power);
    }
  }
  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const [bestName = 'Unknown', bestScore = 0] = ranked[0] || [];
  const secondScore = ranked[1]?.[1] || 0;
  if (bestScore <= 0) return { name: 'Unknown', confidence: 0, evidence: [] };
  const confidence = Math.max(0, Math.min(1, (bestScore - secondScore) / Math.max(1, bestScore)));
  return { name: bestName, confidence, evidence: evidence.get(bestName).slice(0, 5) };
}

export function isRotationCategory(category) {
  return ACTIVATION_CATEGORIES.has(category);
}

export function activationDedupeSeconds(category) {
  if (category === 'At-Will') return 0.35;
  if (category === 'Encounter') return 2.5;
  if (category === 'Daily') return 6;
  if (category === 'Artifact' || category === 'Mount') return 8;
  return 1;
}

export const POWER_TAXONOMY_VERSION = 1;
