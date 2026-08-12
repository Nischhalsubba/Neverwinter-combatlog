(function(){
  if(!window.NWAssets)return;
  const ROOT='https://nw-hub.com/assets/';
  const A={
    'winters wrath':ROOT+'classes/icons/bard.webp',
    'spined devils influence':ROOT+'companions/spined-devil.webp',
    'spined devil influence':ROOT+'companions/spined-devil.webp',
    'duet':ROOT+'powers/duet.webp',
    'loose the ballista':ROOT+'artifacts/alarics_artillery_beacon.webp',
    'ballad of the witch':ROOT+'powers/ballad-of-the-witch.webp',
    'suppressing fire':ROOT+'powers/commanding-shot.webp',
    'witchs finale':ROOT+'companions/shadar-kai-witch.webp',
    'reprisal reflex':ROOT+'powers/reprisal.webp',
    'reprisal':ROOT+'powers/reprisal.webp',
    'mutation':ROOT+'classes/icons/fighter.webp',
    'ethereal vortex':ROOT+'artifacts/realm_engine_core.webp',
    'owlbear figurine':ROOT+'mounts/owlbear.webp',
    'tempest slash':ROOT+'powers/arcane-tempest.webp',
    'anvil of doom':ROOT+'powers/anvil-of-doom.webp',
    'quick strike':ROOT+'classes/icons/fighter.webp',
    'tunnel vision':ROOT+'classes/icons/rogue.webp',
    'stab':ROOT+'powers/sly-flourish-power.webp',
    'assassinate':ROOT+'powers/assassinate.webp',
    'shadow assassination':ROOT+'powers/shadow-strike.webp',
    'realm engine blast':ROOT+'artifacts/realm_engine_core.webp',
    'duelists flurry':ROOT+'powers/duelists-flurry.webp',
    'duelists fury':ROOT+'powers/duelists-flurry.webp',
    'brash strike':ROOT+'powers/brash-strike.webp',
    'bloodletter':ROOT+'powers/bloodletter.webp',
    'not so fast':ROOT+'powers/not-so-fast.webp',
    'grand inspiration':ROOT+'classes/icons/barbarian.webp',
    'whirlwind of blades':ROOT+'powers/whirlwind-of-blades.webp',
    'life lessons':ROOT+'classes/icons/barbarian.webp',
    'roar':ROOT+'powers/roar.webp',
    'sly flourish':ROOT+'powers/sly-flourish-power.webp'
  };
  const oldCandidates=NWAssets.candidates;
  const oldHtml=NWAssets.html;
  const norm=NWAssets.norm;
  const slug=NWAssets.slug;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uniq=a=>[...new Set(a.filter(Boolean))];
  function classFallback(){try{if(typeof player==='function'&&window.NWMeta&&typeof state!=='undefined'){const p=player();const c=NWMeta.inferClassForPlayer(p&&p.id,state.rows);return c&&NWAssets.CLASS&&NWAssets.CLASS[c.name]}}catch(_){}return''}
  function extraCandidates(name,cat){
    const s=slug(name), n=norm(name), out=[];
    if(A[n])out.push(A[n]);
    out.push(ROOT+'powers/'+s+'.webp');
    out.push(ROOT+'powers/fighter/'+s+'.webp');
    out.push(ROOT+'powers/ranger/'+s+'.webp');
    out.push(ROOT+'powers/rogue/'+s+'.webp');
    out.push(ROOT+'powers/bard/'+s+'.webp');
    out.push(ROOT+'mount-powers/'+s+'.webp');
    out.push(ROOT+'artifacts/'+s+'.webp',ROOT+'artifacts/'+s.replace(/-/g,'_')+'.webp');
    out.push(ROOT+'companions/'+s+'.webp',ROOT+'mounts/'+s+'.webp');
    const cls=classFallback();if(cls)out.push(cls);
    return out;
  }
  NWAssets.candidates=function(kind,name,cat){
    if(kind==='class')return oldCandidates?oldCandidates(kind,name,cat):[];
    const base=oldCandidates?oldCandidates(kind,name,cat):[];
    return uniq([...extraCandidates(name,cat),...base]).slice(0,44);
  };
  NWAssets.powerUrl=function(name,cat){return NWAssets.candidates('power',name,cat)[0]||''};
  NWAssets.html=function(kind,name,alt,cls,opt){
    if(kind==='class')return oldHtml?oldHtml(kind,name,alt,cls,opt):'';
    const list=NWAssets.candidates(kind,name,opt&&opt.category);
    return '<img class="assetIcon '+esc(cls||'')+'" src="'+esc(list[0]||'')+'" alt="'+esc(alt||name||'')+'" loading="lazy" data-i="0" data-list="'+list.map(encodeURIComponent).join('|')+'" data-fallback-label="'+esc(name||'')+'">';
  };
  NWAssets.powerHtml=(name,cat,cls)=>NWAssets.html('power',name,name,cls||'powerIcon',{category:cat});
})();
