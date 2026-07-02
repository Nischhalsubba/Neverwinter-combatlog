(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const metricInfo={
    'total damage':{formula:'Sum of valid outgoing Physical damage rows owned by the selected player in the current encounter scope.',math:'Total Damage = Σ row.amount where ownerId = selectedPlayer AND damageType = Physical AND amount > 0'},
    'damage':{formula:'Damage credited to this table row, power, category, player, or group inside the current scope.',math:'Damage = Σ amount for rows matching this group'},
    'dps':{formula:'Total damage divided by the full first-hit to last-hit duration. Downtime lowers this.',math:'DPS = Total Damage / (lastValidDamageTime - firstValidDamageTime)'},
    'combat dps':{formula:'Total damage divided by active combat time. This is the better endgame comparison number when downtime exists.',math:'Combat DPS = Total Damage / Σ active encounter combat windows'},
    'duration':{formula:'Elapsed time between the first and last relevant row in the selected scope.',math:'Duration = max(row.time) - min(row.time)'},
    'in-combat time':{formula:'Time where the selected player was actively contributing valid combat rows.',math:'In-Combat Time = Σ merged active windows from valid player rows'},
    'total hits':{formula:'Count of valid outgoing damage rows for the selected player and scope.',math:'Total Hits = count(valid outgoing damage rows)'},
    'hits':{formula:'Number of rows in this power/group.',math:'Hits = count(group rows)'},
    'crit rate':{formula:'Percent of valid hits with the Critical flag.',math:'Crit Rate = Critical Hits / Total Hits × 100'},
    'crit%':{formula:'Percent of this power/group hits with the Critical flag.',math:'Crit% = Critical hits in group / Hits in group × 100'},
    'flank rate':{formula:'Percent of valid hits with Combat Advantage / Flank flag.',math:'Flank Rate = Flank Hits / Total Hits × 100'},
    'max':{formula:'Largest single row amount inside this power/group.',math:'Max = max(row.amount)'},
    'max hit':{formula:'Largest single outgoing damage row in the selected scope.',math:'Max Hit = max(valid outgoing damage row.amount)'},
    'avg':{formula:'Average amount per hit for this power/group.',math:'Average = Damage / Hits'},
    'average':{formula:'Average amount per row in this group.',math:'Average = Total / Count'},
    'share':{formula:'How much of the selected total this row contributes.',math:'Share = Row Damage / Selected Total Damage × 100'},
    '%':{formula:'How much of total selected damage this power/category contributes.',math:'% = Row Damage / Selected Player Total Damage × 100'},
    'healing done':{formula:'Outgoing healing credited to the selected player.',math:'Healing Done = Σ abs(row.amount) where row.damageType = HitPoints AND row.amount < 0 AND ownerId = selectedPlayer'},
    'damage taken':{formula:'Incoming Physical damage against the selected player.',math:'Damage Taken = Σ row.amount where targetId = selectedPlayer AND damageType = Physical AND amount > 0'},
    'shielded':{formula:'Shield absorption credited in the log.',math:'Shielded = Σ abs(row.amount) where damageType = Shield AND amount < 0'},
    'companion':{formula:'Damage from rows classified as pet, companion, summon, or appointment-style sources.',math:'Companion Damage = Σ damage rows where category(power/source) = Pet / Companion'},
    'encounters':{formula:'Number of encounter windows included in the current filter.',math:'Encounters = count(active encounter windows in scope)'},
    'rank':{formula:'Position after sorting the current table by its primary metric.',math:'Rank = sorted index + 1'}
  };
  function cleanMetric(s){return String(s||'').replace(/\s+/g,' ').replace(/[^a-zA-Z0-9 %]/g,'').trim().toLowerCase()}
  function infoFor(name){const k=cleanMetric(name);return metricInfo[k]||Object.entries(metricInfo).find(([key])=>k.includes(key))?.[1]||{formula:'Grouped result from matching combat-log rows under the current player, encounter, companion-toggle, and tab filters.',math:'Value = aggregate(matching rows)'};}
  function rows(){try{return typeof scopeRows==='function'?scopeRows():state.rows||[]}catch(_){return[]}}
  function selectedSummary(){try{if(typeof state==='undefined'||typeof player!=='function'||!window.NWParser)return null;const p=player();const r=rows();const encs=typeof activeEncounters==='function'?activeEncounters():state.encounters;const m=NWParser.metrics(r,p.id,encs);const valid=NWParser.validForPlayer(r,p.id);const crit=valid.filter(x=>x.flags&&x.flags.has('Critical')).length;const flank=valid.filter(x=>x.flags&&Array.from(x.flags).some(f=>/flank|combat advantage/i.test(f))).length;return{player:p.name,total:m.total,dps:m.dps,combatDps:m.combatDps,hits:m.hits,duration:m.duration,combatTime:m.combatTime,crit:m.crit,flank:m.flank,rowCount:r.length,validRows:valid.length,critRows:crit,flankRows:flank,encounters:(encs||[]).length}}catch(_){return null}}
  function fmt(v){try{return window.fmt?window.fmt(v):String(v)}catch(_){return String(v)}}
  function dur(v){try{return window.dur?window.dur(v):String(v)+'s'}catch(_){return String(v)}}
  function openDrawer(label,value,context){
    const inf=infoFor(label), s=selectedSummary();
    let d=document.getElementById('metricDrawer');
    if(!d){d=document.createElement('aside');d.id='metricDrawer';d.innerHTML='<button class="metricClose" type="button">Close</button><div class="metricDrawerBody"></div>';document.body.appendChild(d);d.querySelector('.metricClose').onclick=()=>d.classList.remove('open')}
    d.querySelector('.metricDrawerBody').innerHTML='<span class="eyebrow">Metric breakdown</span><h2>'+esc(label||'Value')+'</h2><p class="drawerValue">'+esc(value||'')+'</p><section><h3>Formula</h3><p>'+esc(inf.formula)+'</p><code>'+esc(inf.math)+'</code></section><section><h3>Current scope filters</h3><dl><dt>Player</dt><dd>'+esc(s?.player||'-')+'</dd><dt>Encounter scope</dt><dd>'+esc((typeof state!=='undefined'&&state.encounterId==='all')?'All encounters':'Selected encounter #'+state.encounterId)+'</dd><dt>Companions</dt><dd>'+esc((typeof state!=='undefined'&&state.includeCompanions===false)?'Excluded':'Included')+'</dd><dt>Clicked from</dt><dd>'+esc(context||'-')+'</dd></dl></section><section><h3>Raw ingredients</h3><dl><dt>Rows in scope</dt><dd>'+esc(s?s.rowCount.toLocaleString():'-')+'</dd><dt>Valid player rows</dt><dd>'+esc(s?s.validRows.toLocaleString():'-')+'</dd><dt>Critical rows</dt><dd>'+esc(s?s.critRows.toLocaleString():'-')+'</dd><dt>Flank rows</dt><dd>'+esc(s?s.flankRows.toLocaleString():'-')+'</dd><dt>Encounter windows</dt><dd>'+esc(s?s.encounters.toLocaleString():'-')+'</dd></dl></section><section><h3>Selected player totals</h3><dl><dt>Total damage</dt><dd>'+esc(s?fmt(s.total):'-')+'</dd><dt>DPS</dt><dd>'+esc(s?fmt(s.dps):'-')+'</dd><dt>Combat DPS</dt><dd>'+esc(s?fmt(s.combatDps):'-')+'</dd><dt>Duration</dt><dd>'+esc(s?dur(s.duration):'-')+'</dd><dt>In-combat time</dt><dd>'+esc(s?dur(s.combatTime):'-')+'</dd><dt>Hits</dt><dd>'+esc(s?s.hits.toLocaleString():'-')+'</dd></dl></section><section><h3>Endgame note</h3><p>DPS is sensitive to downtime. Combat DPS is usually the cleaner comparison for boss windows, but companion toggles and encounter scope can change both numbers hard. Humans then argue about it in chat, naturally.</p></section>';
    d.classList.add('open');
  }
  function headerForCell(td){const table=td.closest('table');if(!table)return'';const i=[...td.parentElement.children].indexOf(td);return table.querySelectorAll('thead th')[i]?.textContent||''}
  function decorate(){
    document.querySelectorAll('.card:not([data-metric-ready])').forEach(card=>{card.dataset.metricReady='1';const name=card.querySelector('span')?.textContent||'Metric';const val=card.querySelector('b')?.textContent||'';card.classList.add('metricHotspot');card.title=infoFor(name).formula;card.onclick=e=>{e.stopPropagation();openDrawer(name,val,'Summary card')}});
    document.querySelectorAll('td:not([data-metric-ready]), .badge:not([data-metric-ready]), .barrow b:not([data-metric-ready]), .barrow em:not([data-metric-ready]), .compareStats b:not([data-metric-ready])').forEach(el=>{const text=(el.textContent||'').trim();if(!/[0-9]/.test(text))return;el.dataset.metricReady='1';const name=el.tagName==='TD'?headerForCell(el):(el.closest('.compareStats span')?.querySelector('small')?.textContent||el.previousElementSibling?.textContent||'Value');el.classList.add('metricHotspot');el.title=infoFor(name).formula;el.addEventListener('click',e=>{e.stopPropagation();openDrawer(name,text,el.closest('table')?'Table value':'Inline value')},{capture:true})});
  }
  const css='#metricDrawer{position:fixed;z-index:99999;top:0;right:0;width:min(520px,94vw);height:100vh;background:#fff;color:#13202b;border-left:1px solid #d8dde6;box-shadow:-24px 0 60px rgba(0,0,0,.18);transform:translateX(104%);transition:transform .22s ease;padding:22px;overflow:auto;border-radius:0!important}#metricDrawer.open{transform:translateX(0)}.metricClose{float:right;border:1px solid #d8dde6;background:#f7fafc;padding:8px 10px;border-radius:0!important}.drawerValue{font-size:34px;font-weight:900;letter-spacing:-.05em}.metricDrawerBody section{border-top:1px solid #e4e9ef;padding-top:14px;margin-top:14px}.metricDrawerBody code{display:block;background:#f7fafc;border:1px solid #d8dde6;padding:10px;white-space:normal}.metricDrawerBody dl{display:grid;grid-template-columns:150px 1fr;gap:8px}.metricDrawerBody dt{font-weight:800;color:#667789}.metricHotspot{cursor:help;outline-offset:2px}.metricHotspot:hover{outline:1px solid #1fa987;background:#eefbf6!important}';
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  const mo=new MutationObserver(()=>decorate());
  function start(){decorate();mo.observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
