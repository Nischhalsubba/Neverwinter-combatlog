(function(){
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function norm(s){return window.NWAssets&&NWAssets.norm?NWAssets.norm(s):String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function slug(s){return window.NWAssets&&NWAssets.slug?NWAssets.slug(s):norm(s).replace(/\s+/g,'-')}
  function icon(name,cat){return window.NWAssets&&NWAssets.powerHtml?NWAssets.powerHtml(name,cat||'Encounter','codexIcon'):''}
  function classIcon(cls){return window.NWAssets&&NWAssets.html?NWAssets.html('class',cls,cls,'codexIcon'):''}
  const extraGroups={
    'Observed Feats / Class Features':['Glowing Flames','Rimefire Smolder','Shatter Strike','Reprisal Reflex','Mutation','Grand Inspiration','Life Lessons','Battle Awareness','Blade Storm','Combat Superiority','Back Alley Tactics','Raging Criticals','Wrathful Determination'],
    'Observed Mount / Artifact / Companion':['Infernal Pounce','Owlbear Figurine','Realm Engine Blast','Ethereal Vortex','Loose the Ballista!','Spined Devil\'s Influence','Winter\'s Wrath','Tunnel Vision','Radiant Weapon','Enchanter\'s Hex'],
    'Observed Bard Extras':['Blaze Flamenco','Phantasmal Concerto','Duet','Ballad of the Witch','Witch\'s Finale','Suppressing Fire!','Volti Subito','Tailwind Mambo','Vamos Alla']
  };
  function getClasses(){
    const map=window.NWClassPowerMap||{};
    const classes=['Barbarian','Bard','Cleric','Fighter','Paladin','Ranger','Rogue','Warlock','Wizard'];
    return classes.map(cls=>({name:cls,powers:Array.from(new Set(map[cls]||[])).sort()}));
  }
  function matchData(name,cat){
    const list=(window.NWAssets&&NWAssets.candidates)?NWAssets.candidates('power',name,cat||'Encounter'):[];
    const first=list[0]||'';
    const file=first.split('/').pop()||'';
    const exact=norm(file.replace(/\.(webp|png|jpg|gif|svg)$/i,''))===norm(name);
    return {url:first,file,exact,count:list.length};
  }
  function row(name,cat){const m=matchData(name,cat);return '<tr><td>'+icon(name,cat)+'<b>'+esc(name)+'</b></td><td>'+esc(cat||'Class power')+'</td><td>'+esc(m.file||'No candidate')+'</td><td><span class="matchPill '+(m.exact?'good':m.url?'fallback':'bad')+'">'+(m.exact?'Exact':m.url?'Fallback':'Missing')+'</span></td></tr>'}
  function renderCodex(){
    let clsHtml=getClasses().map(c=>'<details class="codexGroup" open><summary>'+classIcon(c.name)+'<b>'+esc(c.name)+'</b><small>'+c.powers.length+' powers</small></summary><table><thead><tr><th>Power</th><th>Source</th><th>Matched image filename</th><th>Status</th></tr></thead><tbody>'+c.powers.map(p=>row(p,'Encounter')).join('')+'</tbody></table></details>').join('');
    let extraHtml=Object.entries(extraGroups).map(([g,list])=>'<details class="codexGroup" open><summary><span class="codexIcon blank"></span><b>'+esc(g)+'</b><small>'+list.length+' entries</small></summary><table><thead><tr><th>Name</th><th>Type</th><th>Matched image filename</th><th>Status</th></tr></thead><tbody>'+list.map(x=>row(x,g.includes('Mount')?'Mount':g.includes('Feat')?'Feat':'Encounter')).join('')+'</tbody></table></details>').join('');
    return '<section class="panel codexPanel"><div class="codexHead"><div><span class="eyebrow">Asset Codex</span><h2>Power name → image filename matching</h2><p>Every class power is listed against the current NW-Hub asset candidate. Fallback means the exact image name was not found, so Strikeglass tries nearby class, feat, mount, artifact, companion and generic folders.</p></div><input id="codexSearch" placeholder="Search power or filename"></div><div id="codexContent">'+clsHtml+extraHtml+'</div></section>';
  }
  const oldRender=window.render;
  if(typeof oldRender==='function')window.render=function(){if(typeof state!=='undefined'&&state.tab==='assets'){if(typeof renderPlayers==='function')renderPlayers();if(typeof renderChips==='function')renderChips();document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='assets'));document.querySelector('#content').innerHTML=renderCodex();bindCodex();return}oldRender()};
  function ensureTab(){const tabs=document.querySelector('#tabs');if(tabs&&!tabs.querySelector('[data-tab="assets"]')){tabs.insertAdjacentHTML('beforeend','<button data-tab="assets">Asset Codex</button>');tabs.querySelector('[data-tab="assets"]').onclick=()=>{state.tab='assets';render()}}}
  function bindCodex(){const q=document.getElementById('codexSearch');if(!q)return;q.oninput=()=>{const s=q.value.toLowerCase();document.querySelectorAll('.codexGroup tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(s)?'':'none')}}
  const css='.codexPanel,.codexPanel *{border-radius:0!important}.codexHead{display:grid;grid-template-columns:1fr minmax(220px,340px);gap:16px;align-items:start;margin-bottom:16px}.codexHead h2{margin:4px 0}.codexHead p{max-width:860px}.codexGroup{border:1px solid #d8e2ec;margin:0 0 12px;background:#fff}.codexGroup summary{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f1f5f9;cursor:pointer}.codexGroup summary small{margin-left:auto;color:#667789;font-weight:800}.codexGroup table{width:100%;border-collapse:collapse}.codexGroup th,.codexGroup td{padding:10px;border-top:1px solid #e4eaf1;text-align:left}.codexGroup td:first-child{display:flex;align-items:center;gap:8px}.codexIcon{width:28px;height:28px}.codexIcon.blank{display:inline-block;background:#0e1b27}.matchPill{display:inline-block;padding:3px 7px;border:1px solid #cbd8e5;font-weight:900;font-size:11px;text-transform:uppercase}.matchPill.good{background:#e9fbf3;color:#176b52}.matchPill.fallback{background:#fff7e8;color:#8a5a17}.matchPill.bad{background:#fff0f2;color:#b33b4b}@media(max-width:900px){.codexHead{grid-template-columns:1fr}.codexGroup{overflow:auto}}';
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureTab);else ensureTab();
})();
