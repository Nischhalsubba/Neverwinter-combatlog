(function(){
  if(typeof state==='undefined')return;
  if(state.includeCompanions===undefined)state.includeCompanions=true;
  if(!Array.isArray(state.compareIds))state.compareIds=[];
  const baseScopeRows=scopeRows;
  const baseRender=render;
  const baseCategoryRows=typeof categoryRows==='function'?categoryRows:null;

  function isCompanion(r){
    const c=NWParser.category(r.powerName);
    const txt=(r.sourceName+' '+r.sourceId+' '+r.powerName).toLowerCase();
    return c==='Pet / Companion'||/companion|pet_|appointment|summon/.test(txt);
  }
  function encounterRows(){return baseScopeRows()}
  function rowsForPlayer(pid){const rows=encounterRows();return state.includeCompanions?rows:rows.filter(r=>!(r.ownerId===pid&&isCompanion(r)))}
  function titleScope(){return state.encounterId==='all'?'All encounters':'Focused encounter #'+state.encounterId}
  function safePowerLabel(power,cat){
    if(window.NWMeta&&NWMeta.powerLabel)return NWMeta.powerLabel(power);
    if(window.NWAssets&&NWAssets.powerHtml)return NWAssets.powerHtml(power,cat,'powerIcon')+'<span>'+esc(power)+'</span>';
    return '<span>'+esc(power)+'</span>';
  }
  function info(text){return '<span class="infoDot" title="'+esc(text)+'">i</span>'}
  function ensureTabs(){const tabs=$('#tabs');if(!tabs)return;if(!tabs.querySelector('[data-tab="compare"]'))tabs.insertAdjacentHTML('beforeend','<button data-tab="compare">Compare Players</button><button data-tab="companions">Companions</button>')}
  function ensureControls(){const tb=$('.toolbar');if(!tb||$('#compToggle'))return;tb.insertAdjacentHTML('beforeend','<label class="toggle"><input id="compToggle" type="checkbox" '+(state.includeCompanions?'checked':'')+'> Include companion damage</label>');$('#compToggle').onchange=e=>{state.includeCompanions=e.target.checked;state.rawPower=null;render()}}
  function setActive(){ensureTabs();$$('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));const t=$('#compToggle');if(t)t.checked=state.includeCompanions}
  function cls(p){return window.NWMeta?NWMeta.classBadge(NWMeta.inferClassForPlayer(p.id,state.rows)):esc(inferClass(p.id))}
  function metricRows(){return state.players.map(p=>{const rows=rowsForPlayer(p.id);const m=NWParser.metrics(rows,p.id,activeEncounters());return{p,rows,m}}).sort((a,b)=>b.m.total-a.m.total)}
  function companionTotal(pid){return encounterRows().filter(r=>r.ownerId===pid&&isCompanion(r)&&NWParser.isDamage(r)).reduce((s,r)=>s+r.amount,0)}
  function categoryList(powers,total){if(baseCategoryRows)return baseCategoryRows(powers,total);const m=new Map();for(const p of powers){m.set(p.category,(m.get(p.category)||0)+p.damage)}return Array.from(m,([category,damage])=>({category,damage,share:total?damage/total*100:0})).sort((a,b)=>b.damage-a.damage)}

  playerHeader=function(){
    const p=player();if(!p)return'';
    const rows=rowsForPlayer(p.id);const m=NWParser.metrics(rows,p.id,activeEncounters());
    const tag=state.includeCompanions?'Companions Included':'Player Damage Only';
    return '<div class="playerHead pro"><div><div class="playerName">'+cls(p)+' <span>'+esc(p.name)+'</span> <span class="badge green">'+tag+'</span></div><small class="mut">'+titleScope()+'</small></div><div><span class="badge">'+fmt(m.total)+' damage</span><span class="badge">'+fmt(m.combatDps)+' combat DPS</span><span class="badge red">'+num(deathRows(encounterRows(),p.id).length)+' deaths</span></div></div>';
  };

  renderPlayers=function(){
    const sel=$('#player');sel.innerHTML=state.players.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===state.playerId?'selected':'')+'>'+esc(p.name)+'</option>').join('');
    if(!state.players.length){$('#party').innerHTML='';return}
    const rows=metricRows();let body='';
    rows.forEach((x,i)=>{body+='<tr class="partyRow '+(x.p.id===state.playerId?'selected':'')+'" data-pi="'+state.players.indexOf(x.p)+'"><td>'+num(i+1)+'</td><td><b>'+esc(x.p.name)+'</b></td><td>'+cls(x.p)+'</td><td>'+fmt(x.m.total)+'</td><td>'+fmt(x.m.dps)+'</td><td>'+fmt(x.m.combatDps)+'</td><td>'+num(x.m.hits)+'</td><td>'+dur(x.m.duration)+'</td></tr>'});
    $('#party').innerHTML='<section class="panel partyPanel"><h3>Party Overview '+info('Filtered by the selected boss or mob chip. Click a player row to inspect them below.')+'</h3><div class="table"><table><thead><tr><th>#</th><th>Player</th><th>Class</th><th>Damage</th><th>DPS</th><th>Combat DPS</th><th>Hits</th><th>Duration</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
    $$('.partyRow').forEach(tr=>tr.onclick=()=>{const p=state.players[+tr.dataset.pi];if(p){state.playerId=p.id;state.rawPower=null;render()}});
  };
  scopeRows=function(){const p=player();return p?rowsForPlayer(p.id):encounterRows()};

  chartSvg=function(data){
    if(!data.length)return'<div class="empty">No DPS data</div>';
    const w=1200,h=280,p=38,max=Math.max(...data.map(d=>d.dps),1);
    const x=(i)=>p+(data.length<=1?0:i/(data.length-1)*(w-p*2));
    const y=(v)=>h-p-v/max*(h-p*2);
    const pts=data.map((d,i)=>x(i)+','+y(d.dps)).join(' ');
    const area=p+','+(h-p)+' '+pts+' '+(w-p)+','+(h-p);
    let grid='';for(let i=0;i<=4;i++){const yy=p+i*(h-p*2)/4;grid+='<line x1="'+p+'" y1="'+yy+'" x2="'+(w-p)+'" y2="'+yy+'" stroke="#dbe4ee" stroke-width="1"/>'}
    return '<svg class="chart sgChart" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" role="img" aria-label="Rolling DPS chart"><rect width="'+w+'" height="'+h+'" rx="18" fill="#ffffff"/>'+grid+'<polygon points="'+area+'" fill="#dcecff" opacity=".9"/><polyline fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="'+pts+'"></polyline><text x="'+p+'" y="26" fill="#263645" font-size="18" font-weight="700">Peak 3s DPS: '+fmt(max)+'</text><text x="'+p+'" y="'+(h-10)+'" fill="#637282" font-size="13">Start</text><text x="'+(w-p-34)+'" y="'+(h-10)+'" fill="#637282" font-size="13">End</text></svg>';
  };

  renderTimeline=function(rows,pid){
    const ps=NWParser.powers(rows,pid);let filtered=ps;
    if(state.filter==='class')filtered=ps.filter(p=>['At-Will','Encounter','Daily','Feat','Class Feature'].includes(p.category));
    if(state.filter==='proc')filtered=ps.filter(p=>['Item / Enchant','Mount','Other / Unknown'].includes(p.category));
    if(state.filter==='pets')filtered=ps.filter(p=>p.category==='Pet / Companion');
    const top=filtered.slice(0,16);const all=NWParser.validForPlayer(rows,pid);const start=all[0]?.time||0,end=all[all.length-1]?.time||start+1,span=Math.max(1,end-start);
    const activations=top.map(p=>'<div class="actRow"><b>'+safePowerLabel(p.power,p.category)+'</b><div class="actTrack">'+p.rows.map(r=>'<i class="tick '+(r.flags.has('Critical')?'crit':'')+'" title="'+esc(p.power)+' at '+(r.time-start).toFixed(1)+'s" style="left:'+((r.time-start)/span*100).toFixed(2)+'%"></i>').join('')+'</div></div>').join('');
    const freq=top.map(p=>{const first=p.rows[0]?.time||0,last=p.rows[p.rows.length-1]?.time||0;return{power:p.power,category:p.category,hits:p.hits,first:first-start,last:last-start,avg:p.hits>1?(last-first)/(p.hits-1):0}});
    const cdRows=top.filter(p=>CD[p.power]).map(p=>{const cd=CD[p.power],uses=p.hits,max=Math.max(1,Math.floor((end-start)/cd)+1);return{power:p.power,category:p.category,cd:cd+'s',hits:uses,max,eff:max?uses/max*100:0}});
    const freqBody=freq.map(r=>'<tr><td><b>'+safePowerLabel(r.power,r.category)+'</b></td><td>'+esc(r.category)+'</td><td>'+num(r.hits)+'</td><td>'+r.first.toFixed(1)+'s</td><td>'+r.last.toFixed(1)+'s</td><td>'+r.avg.toFixed(1)+'s</td></tr>').join('');
    const cdBody=cdRows.map(r=>'<tr><td><b>'+safePowerLabel(r.power,r.category)+'</b></td><td>'+esc(r.category)+'</td><td>'+esc(r.cd)+'</td><td>'+num(r.hits)+'</td><td>'+num(r.max)+'</td><td>'+pct(r.eff)+'</td></tr>').join('');
    $('#content').innerHTML=playerHeader()+'<section class="panel"><h3>Rotation timeline '+info('Shows when each top power appeared in the selected combat window. Orange ticks are critical hits.')+'</h3><div class="timelineBox"><h3>DPS pace '+info('Rolling 3-second damage rate. Higher spikes mean stronger burst windows.')+'</h3>'+chartSvg(timelineData(rows,pid))+'</div><div class="filterbar"><button class="'+(state.filter==='all'?'active':'')+'" data-filter="all">All</button><button class="'+(state.filter==='class'?'active':'')+'" data-filter="class">Class Powers</button><button class="'+(state.filter==='proc'?'active':'')+'" data-filter="proc">Procs & Items</button><button class="'+(state.filter==='pets'?'active':'')+'" data-filter="pets">Pets</button></div><div class="timelineBox"><h3>Power activations '+info('Each tick is a logged hit or activation for that power.')+'</h3><div class="activationRows">'+(activations||'<div class="empty">No activations</div>')+'</div></div><h3>Power Usage Frequency '+info('First use, last use and average spacing for the selected power list.')+'</h3><div class="table"><table><thead><tr><th>Power</th><th>Category</th><th>Hits / Activations</th><th>First Use</th><th>Last Use</th><th>Avg Interval</th></tr></thead><tbody>'+freqBody+'</tbody></table></div><h3>Cooldown Efficiency '+info('Uses compared with a simple expected maximum from known cooldowns. Multi-hit powers can exceed 100%.')+'</h3><div class="table"><table><thead><tr><th>Power</th><th>Type</th><th>CD</th><th>Uses</th><th>Max</th><th>Efficiency</th></tr></thead><tbody>'+(cdBody||'<tr><td colspan="6" class="empty">No known cooldowns in this selection</td></tr>')+'</tbody></table></div></section>';
    $$('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
  };

  function selectedCompareIds(){
    const available=metricRows().map(x=>x.p.id);
    state.compareIds=state.compareIds.filter(id=>available.includes(id));
    if(!state.compareIds.length)state.compareIds=available.slice(0,Math.min(2,available.length));
    return state.compareIds.slice(0,4);
  }
  function comparePicker(selected){
    return '<div class="comparePicker"><div><h3>Select players to compare '+info('Pick up to four players. Two players render as two columns; three or four render as a 2x2 grid.')+'</h3><p class="mut">Current scope: '+esc(titleScope())+' · '+(state.includeCompanions?'companions included':'player damage only')+'</p></div><div class="compareChecks">'+metricRows().map(x=>'<label class="compareCheck '+(selected.includes(x.p.id)?'on':'')+'"><input type="checkbox" data-cmp="'+esc(x.p.id)+'" '+(selected.includes(x.p.id)?'checked':'')+'> '+esc(x.p.name)+'</label>').join('')+'</div></div>';
  }
  function miniBars(title,items,key){
    const mx=Math.max(1,...items.map(x=>x.damage));
    return '<div class="miniList"><h4>'+title+'</h4>'+items.slice(0,6).map(x=>'<div class="miniLine"><span>'+(key==='power'?safePowerLabel(x.power,x.category):esc(x[key]))+'</span><div class="miniBar"><i style="width:'+Math.max(2,x.damage/mx*100)+'%"></i></div><em>'+fmt(x.damage)+'</em></div>').join('')+'</div>';
  }
  function compareCard(p){
    const rows=rowsForPlayer(p.id);const m=NWParser.metrics(rows,p.id,activeEncounters());const ps=NWParser.powers(rows,p.id);const cats=categoryList(ps,m.total);const h=typeof healingBreakdown==='function'?healingBreakdown(rows,p.id):{done:{total:0}};const taken=typeof damageTaken==='function'?damageTaken(rows,p.id).total:0;const sh=typeof shielding==='function'?shielding(rows,p.id).total:0;const pet=companionTotal(p.id);
    return '<article class="compareCard"><header><div>'+cls(p)+'<h3>'+esc(p.name)+'</h3><small>'+esc(titleScope())+'</small></div><strong>'+fmt(m.total)+'</strong></header><div class="compareStats"><span><b>'+fmt(m.combatDps)+'</b><small>Combat DPS</small></span><span><b>'+pct(m.crit)+'</b><small>Crit</small></span><span><b>'+pct(m.flank)+'</b><small>Flank</small></span><span><b>'+fmt(pet)+'</b><small>Companion</small></span><span><b>'+fmt(h.done.total)+'</b><small>Healing</small></span><span><b>'+fmt(taken)+'</b><small>Taken</small></span><span><b>'+fmt(sh)+'</b><small>Shielded</small></span><span><b>'+num(m.hits)+'</b><small>Hits</small></span></div>'+miniBars('Top powers',ps,'power')+miniBars('Damage type',cats,'category')+'</article>';
  }
  function renderCompare(){
    const selected=selectedCompareIds();
    $('#content').innerHTML='<section class="panel comparePanel">'+comparePicker(selected)+'<div class="compareGrid count-'+selected.length+'">'+selected.map(id=>{const p=state.players.find(x=>x.id===id);return p?compareCard(p):''}).join('')+'</div></section>';
    $$('[data-cmp]').forEach(cb=>cb.onchange=e=>{const id=e.target.dataset.cmp;let set=new Set(state.compareIds);if(e.target.checked){if(set.size>=4){e.target.checked=false;return}set.add(id)}else set.delete(id);state.compareIds=Array.from(set);renderCompare()});
  }
  function renderCompanions(){
    const rows=encounterRows().filter(r=>isCompanion(r)&&NWParser.isDamage(r));const total=rows.reduce((s,r)=>s+r.amount,0);const map=new Map();
    rows.forEach(r=>{const k=r.ownerId+'|'+r.ownerName+'|'+(r.sourceName||r.powerName)+'|'+r.powerName;if(!map.has(k))map.set(k,{ownerId:r.ownerId,player:r.ownerName,source:r.sourceName||'-',power:r.powerName,damage:0,hits:0});const x=map.get(k);x.damage+=r.amount;x.hits++});
    const list=Array.from(map.values()).sort((a,b)=>b.damage-a.damage);let body=list.map((x,i)=>'<tr data-owner="'+esc(x.ownerId)+'"><td>'+num(i+1)+'</td><td><b>'+esc(x.player)+'</b></td><td>'+esc(x.source)+'</td><td>'+safePowerLabel(x.power,NWParser.category(x.power))+'</td><td>'+fmt(x.damage)+'</td><td>'+pct(total?x.damage/total*100:0)+'</td><td>'+num(x.hits)+'</td></tr>').join('');
    $('#content').innerHTML='<section class="panel"><h3>Companion Damage Ranking '+info('Ranks damage from powers or sources classified as companions or pets in the current encounter filter.')+'</h3><p class="mut">Use this with the toggle above to see how much companion damage changes the player ranking.</p><div class="cards">'+card('Total Companion Damage',fmt(total))+card('Companion Rows',num(rows.length))+card('Contributors',num(new Set(list.map(x=>x.player)).size))+'</div><div class="table"><table><thead><tr><th>#</th><th>Player</th><th>Source</th><th>Power</th><th>Damage</th><th>Share</th><th>Hits</th></tr></thead><tbody>'+(body||'<tr><td colspan="7" class="empty">No companion damage found in this scope</td></tr>')+'</tbody></table></div></section>';
    $$('[data-owner]').forEach(tr=>tr.onclick=()=>{state.playerId=tr.dataset.owner;state.tab='overview';render()});
  }

  render=function(){ensureTabs();ensureControls();if(state.tab==='compare'){renderPlayers();renderChips();setActive();renderCompare();return}if(state.tab==='companions'){renderPlayers();renderChips();setActive();renderCompanions();return}baseRender();ensureTabs();ensureControls();setActive()};
  const st=document.createElement('style');st.textContent='.partyRow{cursor:pointer}.partyRow.selected td{background:rgba(70,215,183,.08)!important}.toggle{display:inline-flex;align-items:center;gap:6px}.infoDot{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;border:1px solid #52637a;color:#46d7b7;font-size:10px}.sgChart{min-height:280px}.timelineBox .assetIcon,.timelineBox .nwIcon,.table .assetIcon,.table .nwIcon{vertical-align:middle}.actRow b{display:flex;align-items:center;gap:6px}.actTrack{background:#dfe8f2!important}.tick{background:#2563eb!important}.tick.crit{background:#e56652!important}.miniBar{height:10px;background:#e7edf3;border-radius:999px;overflow:hidden}.miniBar i{display:block;height:100%;background:linear-gradient(90deg,#1fb99a,#3e6fd9);border-radius:999px}.comparePicker{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:18px}.compareChecks{display:flex;gap:8px;flex-wrap:wrap}.compareCheck{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:#f7fafc;border:1px solid #d6e0ea;font-weight:800}.compareCheck.on{background:#e9fbf3;border-color:#9fdcc6}.compareGrid{display:grid;gap:16px}.compareGrid.count-1{grid-template-columns:1fr}.compareGrid.count-2{grid-template-columns:repeat(2,minmax(0,1fr))}.compareGrid.count-3,.compareGrid.count-4{grid-template-columns:repeat(2,minmax(0,1fr))}.compareCard{background:#fff;border:1px solid #dce4ec;border-radius:24px;padding:16px}.compareCard header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.compareCard header h3{margin:8px 0 4px}.compareCard header strong{font-size:30px;letter-spacing:-.05em}.compareStats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.compareStats span{background:#f8fafc;border:1px solid #e0e7ef;border-radius:14px;padding:10px}.compareStats b{display:block;font-size:18px}.compareStats small{color:#637282;text-transform:uppercase;font-size:10px;font-weight:900}.miniList{margin-top:12px}.miniList h4{margin:0 0 8px}.miniLine{display:grid;grid-template-columns:minmax(140px,1fr) 1fr 70px;gap:8px;align-items:center;padding:5px 0;border-top:1px solid #edf1f5}.miniLine span{display:flex;align-items:center;gap:5px}.miniLine em{text-align:right;font-style:normal}@media(max-width:1100px){.compareGrid.count-2,.compareGrid.count-3,.compareGrid.count-4{grid-template-columns:1fr}.compareStats{grid-template-columns:repeat(2,1fr)}}';document.head.appendChild(st);
  render();
})();
