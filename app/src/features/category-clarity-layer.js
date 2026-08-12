(function(){
  if(!window.NWParser) return;
  const originalCategory = NWParser.category;
  const originalPowers = NWParser.powers;
  const norm = value => String(value || '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  const exact = new Map();
  function add(category,names){ names.forEach(name => exact.set(norm(name), category)); }

  add('At-Will', [
    'Magic Missile','Ray of Frost','Chilling Cloud','Scorching Burst','Electric Shot','Rapid Shot','Aimed Shot','Clear the Ground','Relentless Slash','Brash Strike','Sure Strike','Cleave','Heavy Slash','Threatening Rush','Sly Flourish','Cloud of Steel','Duelist\'s Flurry','Hellish Rebuke','Eldritch Blast','Hand of Blight','Lance of Faith','Sacred Flame','Soothe','Valorous Strike','Radiant Slam','Arpeggio','Dancing Lights','Fleche'
  ]);
  add('Encounter', [
    'Icy Rays','Chill Strike','Repel','Entangling Force','Shield','Ray of Enfeeblement','Icy Terrain','Disintegrate','Fanning the Flame','Fireball','Conduit of Ice','Sudden Storm','Thorn Ward','Thorn Strike','Hindering Strike','Hindering Shot','Split the Sky','Throw Caution','Plant Growth','Cordon of Arrows','Constricting Arrow','Rain of Arrows','Commanding Shot','Disruptive Shot','Marauder\'s Rush','Boar Charge','Bloodletter','Not So Fast','Mighty Leap','Indomitable Battle Strike','Punishing Charge','Takedown','Roar','Axestorm','Anvil of Doom','Griffon\'s Wrath','Commander's Strike','Linebreaker','Shield Throw','Bull Charge','Enforced Threat','Knee Breaker','Dazing Strike','Lashing Blade','Assassinate','Path of the Blade','Smoke Bomb','Impact Shot','Wicked Reminder','Shadow Strike','Vengeance\'s Pursuit','Killing Flames','Pillar of Power','Vampiric Embrace','Hadar\'s Grasp','Arms of Hadar','Warlock\'s Bargain','Fiery Bolt','Dreadtheft','Soul Scorch','Forgemaster\'s Flame','Daunting Light','Searing Javelin','Chains of Blazing Light','Break the Spirit','Prophecy of Doom','Divine Glow','Exaltation','Bastion of Health','Sunburst','Healing Word','Divine Word','Smite','Bane','Binding Oath','Burning Light','Templar\'s Wrath','Divine Touch','Radiant Charge','Duet','Volti Subito','Blaze Flamenco','Phantasmal Concerto','Rejuvenating Carol','Sheltering Etude','Defender\'s Minuet','Curtain Call','Vamos Alla!'
  ]);
  add('Daily', [
    'Ice Knife','Furious Immolation','Arcane Singularity','Oppressive Force','Forest Ghost','Seismic Shot','Avalanche of Steel','Savage Advance','Spinning Strike','Crescendo','Slam','Villain\'s Menace','Earthshaker','Second Wind','Bloodbath','Shocking Execution','Courage Breaker','Tyrannical Curse','Brood of Hadar','Soulstorm','Hammer of Fate','Scales of Judgement','Guardian of Faith','Hallowed Ground','Divine Judgment','Heroism','Divine Protector','Shield of Faith','Aurora Fantasia','Desperate Finale'
  ]);
  add('Feat', [
    'Rimefire Smolder','Glowing Flames','Shatter Strike','Reprisal Reflex','Mutation','Raging Criticals','Life Lessons','Grasping Roots','Blade Storm','Back Alley Tactics','No Pity, No Mercy','Parting Blasphemy','Angel of Death','Perfect Balance','Prayer of Opportunity','Critical Touch','Truly Inspired','Battlefield Ostinato'
  ]);
  add('Class Feature', [
    'Smolder','Storm Spell','Chilling Presence','Eye of the Storm','Arcane Presence','Twin-Blade Storm','Aspect of the Pack','Aspect of the Serpent','Combat Superiority','Threatening Presence','Skillful Infiltrator','Sneak Attack','Warlock\'s Curse','Dark Prayers','Holy Fervor','Critical Insight','Aura of Courage','Aura of Restoration','Aura of Protection','Battle Harmony','Musician\'s Flow'
  ]);
  add('Mount', [
    'Infernal Pounce','Tunnel Vision','Grand Inspiration','Radiant Weapon','War Triceratops','Legendary Snail','Armored Griffon','Celestial Lion\'s Presence'
  ]);
  add('Item / Enchant', [
    'Owlbear Figurine','Empowered Owlbear Figurine','Mark of the Giant Slayer, Rank 2','Spined Devil\'s Influence','Lightning Flash','Enchanter\'s Hex','Ethereal Vortex','Realm Engine Blast','Tentacle Slam','Blood Lust','Savage Pincers','Conflagrate'
  ]);
  add('Pet / Companion', [
    'Tail Sting','Giant Toad Tongue Lash','Loose the Ballista!','Suppressing Fire!','Winter\'s Wrath','Witch\'s Finale','Slash','Thrust','Instructional Aid'
  ]);

  const classPowerNames = new Set();
  Object.values(window.NWClassPowerMap || {}).forEach(list => (list || []).forEach(name => classPowerNames.add(norm(name))));

  function betterCategory(power, previous){
    const key = norm(power);
    if(exact.has(key)) return exact.get(key);
    if(previous && previous !== 'Other / Unknown') return previous;
    if(classPowerNames.has(key)) return 'Class Power';
    if(/companion|pet|summon|appointment|tail sting|toad|pincer/i.test(power)) return 'Pet / Companion';
    if(/mount|infernal|tunnel vision|radiant weapon|grand inspiration/i.test(power)) return 'Mount';
    if(/artifact|enchant|figurine|mark of|hex|vortex|tentacle|blood lust/i.test(power)) return 'Item / Enchant';
    return previous || 'Other / Unknown';
  }

  NWParser.category = function(power){ return betterCategory(power, originalCategory ? originalCategory(power) : 'Other / Unknown'); };
  NWParser.powers = function(){
    const rows = originalPowers.apply(NWParser, arguments);
    return rows.map(row => Object.assign({}, row, { category: betterCategory(row.power, row.category) }));
  };

  window.StrikeglassCategory = { category: NWParser.category, exactCount: exact.size };
})();
