(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const metricInfo={
    'total damage':{formula:'Sum of all valid outgoing Physical damage rows for the selected player and encounter scope.',math:'Total Damage = damage row 1 + damage row 2 + ... + damage row N'},
    'damage':{formula:'Damage credited to this row or group inside the selected encounter scope.',math:'Damage = sum(amount) for the matching rows'},
    'dps':{formula:'Total damage divided by the full selected duration. Downtime lowers this number.',math:'DPS = Total Damage / Duration'},
    'combat dps':{formula:'Total damage divided by active in-combat time. Better for comparing real output.',math:'Combat DPS = Total Damage / In-Combat Time'},
    'duration':{formula:'Time between the first and last relevant combat row in the selected scope.',math:'Duration = Last combat timestamp - First combat timestamp'},
    'in-combat time':{formula:'Time windows where the selected player was actively dealing valid damage.',math:'In-Combat Time = sum(active encounter combat windows)'},
    'total hits':{formula:'Count of valid outgoing hits for the selected player and scope.',math:'Total Hits = number of valid damage rows'},
    'hits':{formula:'Number of log rows in this group.',math:'Hits = count(rows)'},
    'crit rate':{formula:'Share of valid hits flagged as Critical.',math:'Crit Rate = Critical Hits / Total Hits × 100'},
    'crit%':{formula:'Share of this power\'s hits flagged as Critical.',math:'Crit% = Critical Hits for this power / Total Hits for this power × 100'},
    'flank rate':{formula:'Share of valid hits flagged as combat advantage / flank.',math:'Flank Rate = Combat Advantage Hits / Total Hits × 100'},
    'max':{formula:'Biggest single hit found in the grouped rows.',math:'Max = maximum(amount)'},
    'max hit':{formula:'Largest single outgoing hit in the selected scope.',math:'Max Hit = maximum(valid outgoing hit amount)'},
    'avg':{formula:'Average damage per hit for this power or group.',math:'Average = Damage / Hits'},
    'average':{formula:'Average amount per row in this group.',math:'Average = Total / Count'},
    'share':{formula:'How much of the selected total this row contributes.',math:'Share = Row Damage / Selected Total Damage × 100'},
    '%':{formula:'Share of total damage for the selected player and encounter.',math:'% = Row Damage / Total Damage × 100'},
    'healing done':{formula:'Total outgoing healing credited to the selected player.',math:'Healing Done = sum(abs(negative HitPoints rows owned by player))'},
    'damage taken':{formula:'Total incoming Physical damage against the selected player.',math:'Damage Taken = sum(Physical damage rows where target is player)'},
    'shielded':{formula:'Total shield absorption credited in the log.',math:'Shielded = sum(abs(negative Shield rows))'},
    'companion':{formula:'Damage from rows classified as companion, pet, summon, or appointment-style source.',math:'Companion Damage = sum(companion-classified damage rows)'},
    'encounters':{formula:'Number of encounter windows included in the current scope.',math:'Encounters = count(active encounter windows)'},
    'rank':{formula:'Position after sorting the current table by its main comparison metric.',math:'Rank = sorted order in the current table'}
  };
  function cleanMetric(s){return String(s||'').replace(/\s+/g,' ').replace(/[^a-zA-Z0-9 %]/g,'').trim().toLowerCase()}
  function infoFor(name){const k=cleanMetric(name);return metricInfo[k]||Object.entries(metricInfo).find(([key])=>k.includes(key))?.[1]||{formula:'Calculated from the uploaded combat log for the selected player, encounter and current filters.',math:'Value = grouped and formatted result from matching log rows'};}
  function selectedSummary(){try{if(typeof state==='undefined'||typeof player!=='function'||!window.NWParser)return null;const p=player();const rows=typeof scopeRows==='function'?scopeRows():state.rows;const encs=typeof activeEncounters==='function'?activeEncounters():state.encounters;const m=NWParser.metrics(rows,p.id,encs);return{player:p.name,total:m.total,dps:m.dps,combatDps:m.combatDps,hits:m.hits,duration:m.duration,combatTime:m.combatTime,crit:m.crit,flank:m.flank}}catch(_){return null}}
  function fmt(v){try{return window.fmt?window.fmt(v):String(v)}catch(_){return String(v)}}
  function openDrawer(label,value,context){
    const inf=infoFor(label), s=selectedSummary();
    let d=document.getElementById('metricDrawer');
    if(!d){d=document.createElement('aside');d.id='metricDrawer';d.innerHTML='<button class="metricClose" type="button">Close</button><div class="metricDrawerBody"></div>';document.body.appendChild(d);d.querySelector('.metricClose').onclick=()=>d.classList.remove('open')}
    d.querySelector('.metricDrawerBody').innerHTML='<span class="eyebrow">Metric breakdown</span><h2>'+esc(label||'Value')+'</h2><p class="drawerValue">'+esc(value||'')+'</p><section><h3>How it is calculated</h3><p>'+esc(inf.formula)+'</p><code>'+esc(inf.math)+'</code></section><section><h3>Current context</h3><dl><dt>Player</dt><dd>'+esc(s?.player||'-')+'</dd><dt>Scope</dt><dd>'+esc((typeof state!=='undefined'&&state.encounterId==='all')?'All encounters':'Selected encounter')+'</dd><dt>Table / card</dt><dd>'+esc(context||'-')+'</dd></dl></section><section><h3>Selected player totals</h3><dl><dt>Total damage</dt><dd>'+esc(s?fmt(s.total):'-')+'</dd><dt>DPS</dt><dd>'+esc(s?fmt(s.dps):'-')+'</dd><dt>Combat DPS</dt><dd>'+esc(s?fmt(s.combatDps):'-')+'</dd><dt>Hits</dt><dd>'+esc(s?s.hits.toLocaleString():'-')+'</dd></dl></section>';
    d.classList.add('open');
  }
  function headerForCell(td){const table=td.closest('table');if(!table)return'';const i=[...td.parentElement.children].indexOf(td);return table.querySelectorAll('thead th')[i]?.textContent||''}
  function decorate(){
    document.querySelectorAll('.card:not([data-metric-ready])').forEach(card=>{card.dataset.metricReady='1';const name=card.querySelector('span')?.textContent||'Metric';const val=card.querySelector('b')?.textContent||'';card.classList.add('metricHotspot');card.title=infoFor(name).formula;card.onclick=e=>{e.stopPropagation();openDrawer(name,val,'Summary card')}});
    document.querySelectorAll('td:not([data-metric-ready]), .badge:not([data-metric-ready]), .barrow b:not([data-metric-ready]), .barrow em:not([data-metric-ready]), .compareStats b:not([data-metric-ready])').forEach(el=>{const text=(el.textContent||'').trim();if(!/[0-9]/.test(text))return;el.dataset.metricReady='1';const name=el.tagName==='TD'?headerForCell(el):(el.closest('.compareStats span')?.querySelector('small')?.textContent||el.previousElementSibling?.textContent||'Value');el.classList.add('metricHotspot');el.title=infoFor(name).formula;el.addEventListener('click',e=>{e.stopPropagation();openDrawer(name,text,el.closest('table')?'Table value':'Inline value')},{capture:true})});
  }
  const css='#metricDrawer{position:fixed;z-index:99999;top:0;right:0;width:min(430px,92vw);height:100vh;background:#fff;color:#13202b;border-left:1px solid #d8dde6;box-shadow:-24px 0 60px rgba(0,0,0,.18);transform:translateX(104%);transition:transform .22s ease;padding:22px;overflow:auto;border-radius:0!important}#metricDrawer.open{transform:translateX(0)}.metricClose{float:right;border:1px solid #d8dde6;background:#f7fafc;padding:8px 10px;border-radius:0!important}.drawerValue{font-size:34px;font-weight:900;letter-spacing:-.05em}.metricDrawerBody section{border-top:1px solid #e4e9ef;padding-top:14px;margin-top:14px}.metricDrawerBody code{display:block;background:#f7fafc;border:1px solid #d8dde6;padding:10px;white-space:normal}.metricDrawerBody dl{display:grid;grid-template-columns:130px 1fr;gap:8px}.metricDrawerBody dt{font-weight:800;color:#667789}.metricHotspot{cursor:help;outline-offset:2px}.metricHotspot:hover{outline:1px solid #1fa987;background:#eefbf6!important}';
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  const mo=new MutationObserver(()=>decorate());
  function start(){decorate();mo.observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
