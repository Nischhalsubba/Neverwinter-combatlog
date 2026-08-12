(function(){
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function norm(s){return window.NWAssets&&NWAssets.norm?NWAssets.norm(s):String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  const extraGroups={
    'Observed Feats / Class Features':['Glowing Flames','Rimefire Smolder','Shatter Strike','Reprisal Reflex','Mutation','Grand Inspiration','Life Lessons','Battle Awareness','Blade Storm','Combat Superiority','Back Alley Tactics','Raging Criticals','Wrathful Determination'],
    'Observed Mount / Artifact / Companion':['Infernal Pounce','Owlbear Figurine','Realm Engine Blast','Ethereal Vortex','Loose the Ballista!','Spined Devil\'s Influence','Winter\'s Wrath','Tunnel Vision','Radiant Weapon','Enchanter\'s Hex'],
    'Observed Bard Extras':['Blaze Flamenco','Phantasmal Concerto','Duet','Ballad of the Witch','Witch\'s Finale','Suppressing Fire!','Volti Subito','Tailwind Mambo','Vamos Alla']
  };
  const classNames=['Barbarian','Bard','Cleric','Fighter','Paladin','Ranger','Rogue','Warlock','Wizard'];
  let activeGroup='Ranger';
  let searchText='';

  function groupData(name){
    const map=window.NWClassPowerMap||{};
    if(map[name])return {name,kind:'Class power',items:Array.from(new Set(map[name]||[])).sort()};
    const items=extraGroups[name]||[];
    const kind=name.includes('Mount')?'Mount / Item / Companion':name.includes('Feat')?'Feat / Class Feature':'Mixed observed effect';
    return {name,kind,items};
  }

  function matchData(name,kind){
    const cat=kind&&kind.includes('Mount')?'Mount':kind&&kind.includes('Feat')?'Feat':'Encounter';
    const list=(window.NWAssets&&NWAssets.candidates)?NWAssets.candidates('power',name,cat):[];
    const first=list[0]||'';
    const file=first.split('/').pop()||'';
    const exact=norm(file.replace(/\.(webp|png|jpg|gif|svg)$/i,''))===norm(name);
    return {url:first,file,exact,count:list.length};
  }

  function row(name,kind){
    const m=matchData(name,kind);
    const status=m.exact?'Exact':m.url?'Fallback':'Missing';
    const statusClass=m.exact?'good':m.url?'fallback':'bad';
    return '<tr><td><b>'+esc(name)+'</b></td><td>'+esc(kind||'Class power')+'</td><td><code>'+esc(m.file||'No candidate')+'</code></td><td>'+esc(String(m.count))+'</td><td><span class="matchPill '+statusClass+'">'+status+'</span></td></tr>';
  }

  function groupButtons(){
    const names=[...classNames,...Object.keys(extraGroups)];
    return names.map(name=>{
      const data=groupData(name);
      return '<button type="button" class="codexGroupButton '+(activeGroup===name?'active':'')+'" data-codex-group="'+esc(name)+'"><b>'+esc(name)+'</b><small>'+data.items.length+' entries</small></button>';
    }).join('');
  }

  function tableForActive(){
    const data=groupData(activeGroup);
    const items=searchText?data.items.filter(item=>item.toLowerCase().includes(searchText)):data.items;
    return '<div class="codexTableWrap"><div class="codexTableHead"><h3>'+esc(data.name)+'</h3><p>'+esc(data.kind)+' audit. Rows render only for this selected group, so the app does not fire hundreds of image requests in one click. A modest invention called not freezing.</p></div><table><thead><tr><th>Name</th><th>Type</th><th>Matched filename</th><th>Candidates</th><th>Status</th></tr></thead><tbody>'+items.map(item=>row(item,data.kind)).join('')+'</tbody></table></div>';
  }

  function renderShell(){
    return '<section class="panel codexPanel"><div class="codexHead"><div><span class="eyebrow">Asset Codex</span><h2>Power name → image filename matching</h2><p>Pick one class or effect group on the left. Strikeglass checks exact and fallback NW-Hub asset candidates without loading every icon image at once.</p></div><input id="codexSearch" class="sg-no-help" placeholder="Search inside selected group"></div><div class="codexLayout"><nav class="codexGroupList sg-no-help">'+groupButtons()+'</nav><div id="codexContent">'+tableForActive()+'</div></div></section>';
  }

  function renderCodex(){
    const content=document.querySelector('#content');
    if(!content)return;
    content.innerHTML=renderShell();
    bindCodex();
  }

  function renderCodexSoon(){
    const content=document.querySelector('#content');
    if(content)content.innerHTML='<section class="panel codexPanel"><span class="eyebrow">Asset Codex</span><h2>Preparing lightweight audit…</h2><p class="mut">Loading one group only. No remote icon stampede this time, shocking restraint.</p></section>';
    requestAnimationFrame(renderCodex);
  }

  const oldRender=window.render;
  if(typeof oldRender==='function')window.render=function(){
    if(typeof state!=='undefined'&&state.tab==='assets'){
      if(typeof renderPlayers==='function')renderPlayers();
      if(typeof renderChips==='function')renderChips();
      document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='assets'));
      renderCodexSoon();
      return;
    }
    oldRender();
  };

  function ensureTab(){
    const tabs=document.querySelector('#tabs');
    if(!tabs||tabs.querySelector('[data-tab="assets"]'))return;
    tabs.insertAdjacentHTML('beforeend','<button data-tab="assets" class="sg-no-help" type="button">Asset Codex</button>');
    tabs.querySelector('[data-tab="assets"]').onclick=()=>{if(typeof state!=='undefined'){state.tab='assets';render();}};
  }

  function bindCodex(){
    document.querySelectorAll('[data-codex-group]').forEach(btn=>btn.onclick=()=>{activeGroup=btn.dataset.codexGroup;renderCodex();});
    const q=document.getElementById('codexSearch');
    if(q){q.value=searchText;q.oninput=()=>{searchText=q.value.toLowerCase().trim();document.getElementById('codexContent').innerHTML=tableForActive();};}
  }

  const css='.codexPanel,.codexPanel *{border-radius:0!important}.codexHead{display:grid;grid-template-columns:1fr minmax(220px,340px);gap:16px;align-items:start;margin-bottom:16px}.codexHead h2{margin:4px 0}.codexHead p{max-width:860px}.codexLayout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px}.codexGroupList{border:1px solid #d8e2ec;background:#fff;align-self:start}.codexGroupButton{width:100%;display:grid;text-align:left;gap:3px;border:0!important;border-bottom:1px solid #d8e2ec!important;background:#fff!important;padding:12px!important}.codexGroupButton:hover{background:#f1f6f9!important}.codexGroupButton.active{background:#0e1b27!important;color:#fff!important}.codexGroupButton small{color:#667789;font-weight:800}.codexGroupButton.active small{color:#9fead8}.codexTableWrap{border:1px solid #d8e2ec;background:#fff;overflow:auto}.codexTableHead{padding:14px;border-bottom:1px solid #d8e2ec}.codexTableHead h3{margin:0 0 6px!important}.codexTableHead p{margin:0;color:#667789}.codexTableWrap table{width:100%;border-collapse:collapse}.codexTableWrap th,.codexTableWrap td{padding:10px;border-bottom:1px solid #e4eaf1;text-align:left}.codexTableWrap code{font-size:12px}.matchPill{display:inline-block;padding:3px 7px;border:1px solid #cbd8e5;font-weight:900;font-size:11px;text-transform:uppercase}.matchPill.good{background:#e9fbf3;color:#176b52}.matchPill.fallback{background:#fff7e8;color:#8a5a17}.matchPill.bad{background:#fff0f2;color:#b33b4b}@media(max-width:900px){.codexHead,.codexLayout{grid-template-columns:1fr}.codexGroupList{display:grid;grid-template-columns:repeat(2,1fr)}}';
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureTab);else ensureTab();
})();
