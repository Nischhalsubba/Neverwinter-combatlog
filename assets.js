// Asset resolver based on the uploaded images.zip file structure.
(function(){
  const MANIFEST={
    "class:Wizard":"artifacts/Icon_Inventory_Artifacts_Class_Control.webp",
    "class:Cleric":"artifacts/Icon_Inventory_Artifacts_Class_Devoted.webp",
    "class:Barbarian":"artifacts/Icon_Inventory_Artifacts_Class_GreatWeapon.webp",
    "class:Fighter":"artifacts/Icon_Inventory_Artifacts_Class_Guardian.webp",
    "class:Ranger":"artifacts/Icon_Inventory_Artifacts_Class_Hunter.webp",
    "class:Paladin":"artifacts/Icon_Inventory_Artifacts_Class_Paladin.webp",
    "class:Rogue":"artifacts/Icon_Inventory_Artifacts_Class_Trickster.webp",
    "class:Warlock":"artifacts/Icon_Inventory_Artifacts_Class_Warlock.webp",
    "class:Bard":"companions/harper-bard.webp",
    "category:At-Will":"artifacts/Icon_Inventory_Artifact_Dragonboneblades.webp",
    "category:Encounter":"artifacts/Icon_Inventory_Artifacts_Chromatic_Storm.webp",
    "category:Daily":"artifacts/Icon_Inventory_Artifacts_Soulmonger.webp",
    "category:Feat":"enhancements/Power_Icon_Companion_Enhancement_Vulnerability.webp",
    "category:Class Feature":"artifacts/Icon_Inventory_Artifacts_Class_Control.webp",
    "category:Mount":"mounts/empowered-dragonbone-golem.webp",
    "category:Item / Enchant":"enhancements/Power_Icon_Companion_Enhancement_Potency.webp",
    "category:Pet / Companion":"companions/flapjack.webp",
    "category:Artifact":"artifacts/Icon_Inventory_Artifacts_Demogorgon_Revamp.webp",
    "power:Infernal Pounce":"mounts/empowered-dragonbone-golem.webp",
    "power:Tunnel Vision":"enhancements/Power_Icon_Companion_Enhancement_Perfectvision.webp",
    "power:Owlbear Figurine":"mounts/black-owlbear.webp",
    "power:Empowered Owlbear Figurine":"mounts/black-owlbear.webp",
    "power:Mark of the Giant Slayer, Rank 2":"artifacts/Icon_Inventory_Artifacts_Eyeofthegiant.webp",
    "power:Mark of the Giant Slayer":"artifacts/Icon_Inventory_Artifacts_Eyeofthegiant.webp",
    "power:Radiant Weapon":"mounts/radiant-rune-board.webp",
    "power:Enchanter's Hex":"enhancements/Power_Icon_Companion_Enhancement_Vulnerability.webp",
    "power:Blood Lust":"artifacts/Icon_Inventory_Artifacts_BloodCrystalRavenSkull.webp",
    "power:Tentacle Slam":"artifacts/Icon_Inventory_Artifact_M24_Dungeon_Tentacle.webp",
    "power:Loose the Ballista!":"artifacts/Icons_Inventory_Event_Siege_Championsbattlehorn_01.webp",
    "power:Suppressing Fire!":"artifacts/Icons_Inventory_Event_Siege_Championsbattlehorn_01.webp",
    "entity:Herleifr the Everlasting":"artifacts/Icon_Inventory_Artifacts_Winterlantern.webp",
    "entity:Hunang":"artifacts/Icon_Inventory_Artifacts_White_Dragon_Heart.webp",
    "entity:Ber":"artifacts/Icon_Inventory_Artifacts_Black_Dragon_Heart.webp",
    "entity:Epli":"artifacts/Icon_Inventory_Artifacts_Blue_Dragon_Heart.webp",
    "entity:Oddgeir":"artifacts/Icon_Inventory_Artifacts_Horn_Of_Valhalla.webp",
    "entity:Frozen Totem":"artifacts/Icon_Inventory_Artifacts_Symbolofwater.webp",
    "entity:Ice Chunk":"artifacts/Icon_Inventory_Artifacts_Symbolofwater.webp",
    "entity:Fell Troll":"artifacts/Icon_Inventory_Artifacts_Eyeofthegiant.webp"
  };
  const BASES=["./images/","https://nw-hub.com/images/","https://n00bin.github.io/nwc/images/"];
  const norm=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const byNorm=new Map(Object.entries(MANIFEST).map(([k,v])=>[norm(k),v]));
  function path(kind,name){return MANIFEST[kind+":"+name]||byNorm.get(norm(kind+":"+name))||byNorm.get(norm(name))||null}
  function url(kind,name){const p=path(kind,name);return p?BASES[0]+p:null}
  function html(kind,name,alt,cls){const p=path(kind,name);if(!p)return'';const safe=String(alt||name||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));return '<img class="assetIcon '+(cls||'')+'" src="'+BASES[0]+p+'" alt="'+safe+'">'}
  window.NWAssets={MANIFEST,BASES,norm,path,url,html};
})();
