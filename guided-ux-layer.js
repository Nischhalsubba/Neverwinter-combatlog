(function(){
  const CLASSES=['Unknown','Barbarian','Bard','Cleric','Fighter','Paladin','Ranger','Rogue','Warlock','Wizard'];
  const storeKey='strikeglass.classOverrides.v1';
  const overrides=(()=>{try{return JSON.parse(localStorage.getItem(storeKey)||'{}')}catch(_){return{}}})();
  function saveOverrides(){try{localStorage.setItem(storeKey,JSON.stringify(overrides))}catch(_){}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function byId(id){return document.getElementById(id)}

  if(window.NWMeta&&NWMeta.inferClassForPlayer){
    const baseInfer=NWMeta.inferClassForPlayer;
    NWMeta.inferClassForPlayer=function(pid,scope){
      if(overrides[pid])return {name:overrides[pid],confidence:100,manual:true,icon:'?',color:(NWMeta.CLASS_DEFS[overrides[pid]]||{}).color||'#8b95aa'};
      const r=baseInfer(pid,scope);
      if(r&&r.name&&r.name!=='Unknown'&&(Number(r.confidence)||0)<45)return {name:'Unknown',confidence:0,lowConfidence:true,icon:'?',color:'#8b95aa'};
      return r;
    };
    const baseBadge=NWMeta.classBadge;
    NWMeta.classBadge=function(cls){
      const html=baseBadge(cls);
      if(cls&&cls.manual)return html.replace('</span>','<small title="Manually corrected">manual</small></span>');
      if(cls&&cls.lowConfidence)return '<span class="classPill lowConfidence"><span class="nwIcon classIcon">?</span> Unknown<small>low confidence</small></span>';
      return html;
    };
  }

  function addLogHelp(){
    const main=document.querySelector('main');
    if(!main||byId('logHelp'))return;
    const html='<section id="logHelp" class="logHelp"><div class="logHelpHead"><div><span class="eyebrow">Need a combat log?</span><h2>Start logging in under a minute</h2><p>Use these steps in Neverwinter, then upload the generated log file here. No account, no server upload, no circus tent.</p></div><button id="hideLogHelp" type="button">Hide guide</button></div><div class="logSteps"><article><b>1</b><h3>Enable logging</h3><p>Open game chat and type <code>/combatlog 1</code>, then press Enter.</p></article><article><b>2</b><h3>Play content</h3><p>Run your dungeon, trial, boss practice, or training target session.</p></article><article><b>3</b><h3>Stop logging</h3><p>Type <code>/combatlog 0</code> when finished so the file is easier to review.</p></article><article><b>4</b><h3>Upload the file</h3><p>Look for <code>Neverwinter\\Live\\logs\\GameClient.log</code>. A common path is <code>C:\\Users\\Public\\Games\\Cryptic Studios\\Neverwinter\\Live\\logs\\GameClient.log</code>.</p></article></div></section>';
    main.insertAdjacentHTML('afterbegin',html);
    byId('hideLogHelp').onclick=()=>{byId('logHelp').style.display='none'};
  }

  function addClassFix(){
    const head=document.querySelector('.playerHead');
    if(!head||head.querySelector('.classFix')||typeof state==='undefined')return;
    const p=(typeof player==='function')?player():null;
    if(!p)return;
    const inferred=window.NWMeta&&NWMeta.inferClassForPlayer?NWMeta.inferClassForPlayer(p.id,state.rows):{name:'Unknown'};
    const current=overrides[p.id]||inferred.name||'Unknown';
    const options=CLASSES.map(c=>'<option value="'+c+'" '+(c===current?'selected':'')+'>'+c+'</option>').join('');
    const note=inferred.lowConfidence?'Auto-detection was unsure. Pick the class once and Strikeglass remembers it.':'Wrong class? Correct it here. This is saved in your browser.';
    head.insertAdjacentHTML('beforeend','<label class="classFix"><span>Class correction</span><select id="classFixSelect">'+options+'</select><small>'+esc(note)+'</small></label>');
    const sel=byId('classFixSelect');
    sel.onchange=()=>{if(sel.value==='Unknown')delete overrides[p.id];else overrides[p.id]=sel.value;saveOverrides();if(typeof render==='function')render()};
  }

  function readableChips(){
    if(typeof state==='undefined'||!Array.isArray(state.encounters)||!state.encounters.length||typeof dur!=='function')return;
    const box=byId('chips');
    if(!box)return;
    const visible=state.showHidden?state.encounters:state.encounters.filter(e=>e.visible);
    const hidden=state.encounters.length-state.encounters.filter(e=>e.visible).length;
    const chips='<button class="chip '+(state.encounterId==='all'?'active':'')+'" data-e="all">All encounters</button>'+visible.map(e=>'<button class="chip '+e.type+' '+(String(e.id)===String(state.encounterId)?'active':'')+'" data-e="'+e.id+'"><span class="chipType">'+(e.type==='boss'?'Boss':'Mob')+'</span><b>#'+e.id+' '+esc(e.label)+'</b><small>'+dur(e.duration)+'</small></button>').join('')+(hidden?'<button id="hidden" class="chip ghost disclosure">'+(state.showHidden?'Hide non-boss pulls':'Show '+hidden+' extra mob pulls')+' <span>↕</span></button>':'');
    box.innerHTML='<section class="encounterGuide"><div class="encounterCopy"><span class="eyebrow">Encounter filters</span><h2>Choose the fight you want to inspect</h2><p>Click any boss or mob chip. Party Overview, player details, comparison and companion ranking will all follow that same filter.</p></div><div class="encounterChips">'+chips+'</div></section>';
    box.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{state.encounterId=b.dataset.e;state.rawPower=null;if(typeof render==='function')render()});
    const h=byId('hidden');if(h)h.onclick=()=>{state.showHidden=!state.showHidden;if(typeof render==='function')render()};
  }

  function enhance(){addLogHelp();setTimeout(addClassFix,0)}
  const originalRender=window.render;
  if(typeof originalRender==='function'){
    window.render=function(){originalRender();readableChips();enhance()};
  }
  const originalRenderChips=window.renderChips;
  if(typeof originalRenderChips==='function')window.renderChips=readableChips;
  const css='.logHelp{grid-column:1/-1;background:#fff;border:1px solid #ded5c8;border-radius:30px;padding:22px;box-shadow:0 22px 70px rgba(23,32,43,.10)}.logHelpHead{display:flex;justify-content:space-between;gap:16px;align-items:start}.logHelp h2,.encounterGuide h2{margin:4px 0 6px;color:#14202b}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#1fb99a;font-weight:900}.logSteps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}.logSteps article{background:#f8fafc;border:1px solid #dce4ec;border-radius:20px;padding:14px}.logSteps b{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#111d2a;color:#fff}.logSteps h3{margin:10px 0 6px}.logSteps code{background:#eef3f7;border:1px solid #d6e0ea;border-radius:7px;padding:2px 6px;color:#7a2f9f}.encounterGuide{width:100%;background:#fff;border:1px solid #ded5c8;border-radius:28px;padding:18px;box-shadow:0 16px 45px rgba(23,32,43,.08)}.encounterCopy{margin-bottom:12px}.encounterCopy p{max-width:820px}.encounterChips{display:flex;gap:10px;flex-wrap:wrap}.encounterChips .chip{display:inline-grid;grid-template-columns:auto;gap:2px;align-items:center;text-align:left}.encounterChips .chipType{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#637282}.encounterChips .chip small{color:#637282}.disclosure{border-style:dashed!important}.classFix{display:grid;gap:4px;min-width:190px}.classFix span{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#9edfd2;font-weight:900}.classFix select{min-width:170px}.classFix small{max-width:230px;color:#b8cadb}.lowConfidence{border-color:#d99028!important}@media(max-width:1100px){.logSteps{grid-template-columns:1fr 1fr}.logHelpHead{flex-direction:column}}@media(max-width:680px){.logSteps{grid-template-columns:1fr}}';
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{readableChips();enhance()});else{readableChips();enhance()}
})();
