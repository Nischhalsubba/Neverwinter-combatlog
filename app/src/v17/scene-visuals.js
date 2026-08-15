import {
  RANGE_EVENT, activeView, compact, currentPlayerRef, currentScope, esc, formatTime, fullScopedDamageRows,
  fullScopedRows, prefs, publishRange, root, scopeKey, verifiedReport
} from './shared.js';

let generation=0;
let densityAbort=null;

async function playerDistribution(){
  if(activeView()!=='players'||root.querySelector('[data-sg-player-distribution]'))return;
  try{const report=await verifiedReport(currentScope());if(activeView()!=='players'||root.querySelector('[data-sg-player-distribution]'))return;const rows=(report.players||[]).map(player=>({name:player.name,damage:Number(player.damage)||0}));const total=rows.reduce((s,r)=>s+r.damage,0)||1;const section=document.createElement('section');section.className='panel sg-player-distribution';section.dataset.sgPlayerDistribution='true';section.innerHTML=`<div class="panel-head"><div><span class="eyebrow">Damage share</span><h2>Party distribution</h2></div><span>${rows.length} players</span></div><div class="sg-share-strip" role="img" aria-label="Party damage share">${rows.map(r=>`<i style="--share:${r.damage/total*100}%" title="${esc(r.name)}"></i>`).join('')}</div><div class="sg-share-legend">${rows.map(r=>`<span><b>${esc(r.name)}</b><small>${(r.damage/total*100).toFixed(1)}%</small></span>`).join('')}</div>`;root.firstElementChild?.insertAdjacentElement('afterend',section);}catch{}
}

async function encounterSparklines(){
  if(activeView()!=='encounters')return;const local=++generation;const rows=Array.from(root.querySelectorAll('tbody tr[data-scope]')).slice(0,40);let index=0;
  const worker=async()=>{while(index<rows.length&&local===generation&&activeView()==='encounters'){const row=rows[index++];if(row.dataset.sgSpark==='true')continue;row.dataset.sgSpark='loading';const [type,idText]=row.dataset.scope.split(':');try{const report=await verifiedReport({type,id:Number(idText),targetOnly:false});if(local!==generation||!row.isConnected)return;const points=report.partyTimeline||[];const max=Math.max(1,...points.map(p=>Number(p.damage)||0));const svg=`<svg class="sg-encounter-spark" viewBox="0 0 120 24" aria-label="Encounter damage sparkline" role="img"><polyline points="${points.slice(0,80).map((p,i)=>`${i/Math.max(1,Math.min(79,points.length-1))*120},${23-(Number(p.damage)||0)/max*21}`).join(' ')}"/></svg>`;row.cells[2]?.insertAdjacentHTML('beforeend',svg);row.dataset.sgSpark='true';}catch{row.dataset.sgSpark='error';}}
  };await Promise.all([worker(),worker()]);
}

function categoryFilter(){
  if(activeView()!=='powers')return;const panel=root.querySelector('.category-panel');const table=root.querySelector('.power-table');if(!panel||!table||panel.dataset.sgCategoryFilter==='true')return;panel.dataset.sgCategoryFilter='true';const status=document.createElement('div');status.className='sg-category-filter';status.hidden=true;panel.append(status);
  panel.querySelectorAll('.analysis-bar-row').forEach(row=>{row.tabIndex=0;const run=()=>{const category=row.querySelector('strong')?.textContent?.trim()||'';for(const tr of table.tBodies[0]?.rows||[]){const value=tr.querySelector('.category-badge')?.textContent?.trim()||'';tr.hidden=value!==category;}status.hidden=false;status.innerHTML=`Showing <strong>${esc(category)}</strong> powers <button type="button" class="button" data-sg-clear-category>Clear</button>`;};row.addEventListener('click',run);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();run();}});});
  status.addEventListener('click',e=>{if(!e.target.closest('[data-sg-clear-category]'))return;for(const tr of table.tBodies[0]?.rows||[])tr.hidden=false;status.hidden=true;});
}

function densitySvg(buckets,max){return `<svg viewBox="0 0 1000 54" preserveAspectRatio="none" aria-hidden="true"><polyline points="${buckets.map((value,index)=>`${index/Math.max(1,buckets.length-1)*1000},${52-value/max*48}`).join(' ')}"/></svg>`;}
async function rawDensity(){
  if(activeView()!=='events'||root.querySelector('[data-sg-event-density]'))return;const panel=root.querySelector('.qol-event-finder')||root.querySelector(':scope > .panel');if(!panel)return;densityAbort?.abort();densityAbort=new AbortController();const local=densityAbort;
  try{const report=await verifiedReport(currentScope());const offset=Number(report.scope?.start)||0,duration=Math.max(1,Number(report.duration)||Number(report.scope?.duration)||1);const {rows}=await fullScopedRows(currentScope());if(local.signal.aborted||activeView()!=='events')return;const bucketCount=120,buckets=Array(bucketCount).fill(0);for(const row of rows){const relative=Number(row.time)-offset;if(relative<0||relative>duration)continue;buckets[Math.min(bucketCount-1,Math.floor(relative/duration*bucketCount))]+=1;}const max=Math.max(1,...buckets);const section=document.createElement('section');section.className='panel sg-event-density';section.dataset.sgEventDensity='true';section.innerHTML=`<div class="panel-head"><div><span class="eyebrow">Event density</span><h2>Where the log gets busy</h2></div><span>Click to select ±5s</span></div><button type="button" class="sg-event-density-plot" aria-label="Select a time window from event density">${densitySvg(buckets,max)}<i data-sg-density-selection></i></button>`;panel.insertAdjacentElement('beforebegin',section);section.querySelector('button').addEventListener('click',e=>{const rect=e.currentTarget.getBoundingClientRect();const at=Math.max(0,Math.min(duration,(e.clientX-rect.left)/rect.width*duration));const start=Math.max(0,at-5),end=Math.min(duration,at+5);publishRange({key:scopeKey(),start,end,origin:'events',source:'event-density'});const finder=root.querySelector('[data-qol-event-form]');if(finder){finder.elements.start.value=(offset+start).toFixed(1);finder.elements.end.value=(offset+end).toFixed(1);}});window.addEventListener(RANGE_EVENT,e=>{const d=e.detail||{};if(d.scopeKey!==scopeKey())return;const selection=section.querySelector('[data-sg-density-selection]');selection.style.left=`${d.start/duration*100}%`;selection.style.width=`${Math.max(.5,(d.end-d.start)/duration*100)}%`;},{signal:local.signal});}catch{}
}

function diagnosticsBars(){
  if(activeView()!=='diagnostics'||root.querySelector('[data-sg-diagnostic-visuals]'))return;const panels=Array.from(root.querySelectorAll('.panel'));if(!panels.length)return;const entries=[];for(const panel of panels){for(const row of panel.querySelectorAll('tr')){const cells=row.cells;if(!cells||cells.length<2)continue;const label=cells[0].textContent.trim(),raw=cells[cells.length-1].textContent.replace(/,/g,'').trim();const value=Number(raw);if(Number.isFinite(value)&&value>=0)entries.push({label,value});}}
  if(entries.length<2)return;const max=Math.max(1,...entries.map(e=>e.value));const section=document.createElement('section');section.className='panel sg-diagnostic-visuals';section.dataset.sgDiagnosticVisuals='true';section.innerHTML=`<div class="panel-head"><div><span class="eyebrow">Health signals</span><h2>Analysis checks at a glance</h2></div><span>${entries.length} numeric checks</span></div><div class="sg-diagnostic-bars">${entries.slice(0,12).map(item=>`<div><span>${esc(item.label)}</span><i><b style="--value:${item.value/max*100}%"></b></i><strong>${compact(item.value)}</strong></div>`).join('')}</div>`;root.firstElementChild?.insertAdjacentElement('beforebegin',section);
}

export function scanScenes(){playerDistribution();categoryFilter();diagnosticsBars();rawDensity();encounterSparklines();}
export function resetScenes(){generation+=1;densityAbort?.abort();densityAbort=null;}
