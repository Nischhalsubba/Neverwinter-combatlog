(function(){
  const root = typeof window !== 'undefined' ? window : self;
  const names = [
    "Alaric's Artillery Beacon",
    "Apocalypse Dagger",
    "Arcturia's Music Box",
    "Arcturia's Resonating Music Box",
    "Arma Egg On",
    "Assassin's Dice",
    "Assassin's Knife",
    "Astral Seed Tendril",
    "Aurora's Whole Realms Catalogue",
    "Beacon of Meteor Swarm",
    "Beacon of Simril",
    "Beacon of the Astral Sea",
    "Belial's Portal Stone",
    "Black Dragon's Mark",
    "Black Ice Beholder",
    "Bloodbrass Pistol",
    "Blood Crystal Raven Skull",
    "Bloodcrystal Raven Skull",
    "Blue Dragon's Mark",
    "Book of Vile Darkness",
    "Broken Halo",
    "Bruenor's Helm",
    "Champion's Banner",
    "Charm of the Serpent",
    "Crimson Calamity",
    "Crystal of Souls Flight",
    "Darkened Storyteller's Journal",
    "Decanter of Atropal Essence",
    "Deck of a Few Things",
    "Defender's Banner",
    "Demogorgon's Reach",
    "Demon Skull",
    "Draconic Essence",
    "Dragonbone Blades",
    "Dragonbone Wand",
    "Emblem of the Seldarine",
    "Empowered Illusionist's Mask",
    "Envenomed Storyteller's Journal",
    "Erratic Drift Globe",
    "Eye of Lathandar",
    "Eye of Odran",
    "Eye of the Giant",
    "Flask of Brewing",
    "Flayed Storyteller's Journal",
    "Forgehammer of Gond",
    "Fragmented Key of Stars",
    "Frozen Storyteller's Journal",
    "Globe of the Third Eye",
    "Golden Memories",
    "Gond's Anvil of Creation",
    "Grace of Pelor",
    "Green Dragon's Mark",
    "Halaster's Blast Scepter",
    "Heart of the Black Dragon",
    "Heart of the Blue Dragon",
    "Heart of the Green Dragon",
    "Heart of the Red Dragon",
    "Heart of the Volcano",
    "Heart of the White Dragon",
    "Horn of Valhalla",
    "Illusionist's Mask",
    "Imbued Staff of Flowers",
    "Jewel of the Caldera",
    "Jewel of the North",
    "Kessell's Spheres of Annihilation",
    "Lantern of Revelation",
    "Lostmauth's Horn of Blasting",
    "Manticore Talon",
    "Marco's Mystic Marker",
    "Marilith Mask",
    "Mystic Bolt",
    "Mythallar Fragment",
    "Neverwinter's Standard",
    "Nightflame Censer",
    "Oghma's Token of Free Movement",
    "Portable Spelljammer Detector",
    "Prototype Realm Engine",
    "Realm Engine Core",
    "Red Dragon's Mark",
    "Refulgent Diamond Pin",
    "Repurposed Phylactery",
    "Ring of Fowl Weather",
    "Rod of Imperial Restraint",
    "Rod of Pain",
    "Scintillating Symbol of Air",
    "Scintillating Symbol of Earth",
    "Scintillating Symbol of Fire",
    "Scintillating Symbol of Water",
    "Sealing Parchment",
    "Searing Conduit of Magma",
    "Shard of Orcus' Wand",
    "Shard of Valindra's Crown",
    "Siege Master's War Horn",
    "Siegebreaker's Banner",
    "Sigil of the Barbarian",
    "Sigil of the Bard",
    "Sigil of the Cleric",
    "Sigil of the Controller",
    "Sigil of the Devoted",
    "Sigil of the Fighter",
    "Sigil of the Great Weapon",
    "Sigil of the Guardian",
    "Sigil of the Hunter",
    "Sigil of the Nine",
    "Sigil of the Oathbound Paladin",
    "Sigil of the Paladin",
    "Sigil of the Ranger",
    "Sigil of the Rogue",
    "Sigil of the Scourge",
    "Sigil of the Trickster",
    "Sigil of the Warlock",
    "Sigil of the Wizard",
    "Skull Lord Staff",
    "Soul Sight Crystal",
    "Sovereign's Sporestaff",
    "Sparkling Fey Emblem",
    "Sphere of Black Ice",
    "Staff of Flowers",
    "Sword of Zariel",
    "Symbol of Air",
    "Symbol of Earth",
    "Symbol of Fire",
    "Symbol of Water",
    "Tactician's Banner",
    "Tarokka Deck",
    "Tentacle Rod",
    "Thayan Book of the Dead",
    "Thirst",
    "Tiamat's Arcane Globe",
    "Tiamat's Orb of Majesty",
    "Token of Chromatic Storm",
    "Tome of Ascendance",
    "Trobriand's Overcharged Ring",
    "Trobriand's Ring",
    "Tymora's Mystical Coin",
    "Tymora's Spinning Coin",
    "Vanguard's Banner",
    "Vibrating Erratic Drift Globe",
    "Wand of Domination",
    "Waters of Elah'zad",
    "Waukeen's Horde",
    "Wheel of Elements",
    "White Dragon's Mark",
    "Wrath of Kossuth",
    "Wyvern Venom Coated Knives",
    "Xeleth's Blast Scepter"
  ];

  function norm(value){
    return String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  function slug(name){
    return norm(name).replace(/\s+/g, '_');
  }
  function uniqueByNorm(items){
    const seen = new Set();
    return items.filter(name => {
      const key = norm(name);
      if(!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const artifacts = uniqueByNorm(names).map(name => {
    const imageSlug = slug(name);
    return {
      name,
      normalized: norm(name),
      slug: imageSlug,
      type: 'Artifact',
      url: 'https://nw-hub.com/assets/artifacts/' + imageSlug + '.webp'
    };
  });
  const byNorm = new Map();
  const bySlug = new Map();
  for(const item of artifacts){
    byNorm.set(item.normalized, item);
    bySlug.set(item.slug, item);
  }

  function matchArtifact(value){
    const clean = norm(value);
    if(!clean) return null;
    const slugged = clean.replace(/\s+/g, '_');
    if(byNorm.has(clean)) return byNorm.get(clean);
    if(bySlug.has(slugged)) return bySlug.get(slugged);
    for(const item of artifacts){
      const words = item.normalized.split(' ').filter(word => word.length > 2);
      const matching = words.filter(word => clean.includes(word));
      if(item.normalized.includes(clean) && clean.length >= 6) return item;
      if(matching.length >= Math.min(2, words.length) && words.length <= 4) return item;
      if(matching.length >= 3) return item;
    }
    return null;
  }
  function isArtifact(value){ return !!matchArtifact(value); }

  root.SGArtifactCatalog = { artifacts, names: artifacts.map(item => item.name), byNorm, bySlug, norm, slug, matchArtifact, isArtifact };

  if(root.NWParser && typeof root.NWParser.category === 'function'){
    const originalCategory = root.NWParser.category;
    root.NWParser.category = function(powerName){
      if(matchArtifact(powerName)) return 'Artifact';
      return originalCategory.apply(this, arguments);
    };
  }
})();
