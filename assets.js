(function(){
  const ROOT='https://nw-hub.com/assets/';
  const DIR={classes:ROOT+'classes/',powers:ROOT+'powers/',mountPowers:ROOT+'mount-powers/',mounts:ROOT+'mounts/',artifacts:ROOT+'artifacts/',companions:ROOT+'companions/',enchantments:ROOT+'enchantments/',overloads:ROOT+'overloads/',buffs:ROOT+'buffs/',debuff:ROOT+'debuff/',mechanics:ROOT+'mechanics/'};
  const CLASS={Barbarian:DIR.classes+'icons/barbarian.webp',Bard:DIR.classes+'icons/bard.webp',Cleric:DIR.classes+'icons/cleric.webp',Fighter:DIR.classes+'icons/fighter.webp',Paladin:DIR.classes+'icons/paladin.webp',Ranger:DIR.classes+'icons/ranger.webp',Rogue:DIR.classes+'icons/rogue.webp',Warlock:DIR.classes+'icons/warlock.webp',Wizard:DIR.classes+'icons/wizard.webp'};
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const slug=s=>norm(s).replace(/\s+/g,'-');
  function classUrl(name){return CLASS[name]||CLASS[Object.keys(CLASS).find(k=>norm(k)===norm(name))]||''}
  function powerUrl(name,cat){const s=slug(name);if(cat==='Mount')return DIR.mountPowers+s+'.webp';if(cat==='Artifact')return DIR.artifacts+s+'.webp';if(cat==='Pet / Companion')return DIR.companions+s+'.webp';if(cat==='Item / Enchant')return DIR.enchantments+s+'.webp';return DIR.powers+s+'.webp'}
  function icon(u,cls,label){return u?'<span class="assetIcon '+(cls||'')+'" title="'+String(label||'')+'" style="background-image:url('+u+')"></span>':'<span class="nwIcon '+(cls||'')+'">?</span>'}
  function html(kind,name,alt,cls,opt){const u=kind==='class'?classUrl(name):powerUrl(name,opt&&opt.category);return icon(u,cls,alt||name)}
  window.NWAssets={ROOT,DIR,CLASS,norm,slug,classUrl,powerUrl,html,powerHtml:(name,cat,cls)=>html('power',name,name,cls||'powerIcon',{category:cat})};
})();
