import { RANGE_EVENT, activeView, effectReport, esc, formatTime, prefs, publishRange, root, scopeKey } from './shared.js';

let state = null;
let scanFrame = 0;

function lanes(report) {
  const start = Number(report.scope?.start) || 0;
  return (report.teamEffects || []).filter(effect => effect.verification?.publishUptime !== false && (effect.targets || []).some(target => target.intervals?.length)).map(effect => ({
    id:effect.id, name:effect.name, source:effect.sourceName || effect.sourceType || 'Team effect',
    applications:(effect.timeline || []).map(item => ({ ...item, time:Math.max(0,Number(item.time)-start) })),
    targets:(effect.targets || []).map(target => ({ ...target, intervals:(target.intervals || []).map(item => ({ start:Math.max(0,Number(item.start)-start), end:Math.max(0,Number(item.end)-start), sourceNames:item.sourceNames || [] })) }))
  }));
}

function markup(report) {
  const items = lanes(report); const duration = Math.max(.1,Number(report.scope?.duration)||0);
  return `<section class="panel sg-debuff-timeline" data-sg-debuff-timeline tabindex="0" aria-label="Team debuff uptime timeline">
    <div class="panel-head"><div><span class="eyebrow">Shared fight clock</span><h2>Debuff uptime timeline</h2></div><span>${items.length} timed effects</span></div>
    <div class="sg-debuff-toolbar"><label><span>Focus effect</span><select data-sg-debuff-focus><option value="">All effects</option>${items.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></label><button class="button" type="button" data-sg-debuff-reset>Reset view</button><output data-sg-debuff-range>${formatTime(0)} – ${formatTime(duration)}</output></div>
    <div class="sg-debuff-ruler" aria-hidden="true">${Array.from({length:7},(_,i)=>`<span style="left:${i/6*100}%">${formatTime(duration*i/6)}</span>`).join('')}</div>
    <div class="sg-debuff-lanes">${items.map(item=>`<article class="sg-debuff-lane" data-sg-debuff-id="${esc(item.id)}"><header><strong>${esc(item.name)}</strong><span>${esc(item.source)}</span></header><div class="sg-debuff-track" data-sg-debuff-track>${item.targets.flatMap(target=>target.intervals.map(interval=>`<button type="button" class="sg-debuff-window" style="--left:${interval.start/duration*100}%;--width:${Math.max(.15,(interval.end-interval.start)/duration*100)}%" title="${esc(target.name || target.ref)} · ${formatTime(interval.start)}–${formatTime(interval.end)}${interval.sourceNames?.length ? ` · ${esc(interval.sourceNames.join(', '))}`:''}"><span class="visually-hidden">${esc(item.name)} active on ${esc(target.name || target.ref)} from ${formatTime(interval.start)} to ${formatTime(interval.end)}</span></button>`)).join('')}${item.applications.map(app=>`<i class="sg-debuff-application" style="--left:${Math.min(100,app.time/duration*100)}%" title="Applied ${formatTime(app.time)} · ${esc(app.sourceName || 'source')}"></i>`).join('')}</div></article>`).join('')}</div>
    <div class="sg-debuff-brush" data-sg-debuff-brush><i data-sg-debuff-selection></i></div>
    <p class="sg-debuff-help">Drag the selection strip to inspect a combat interval. The same range is mirrored to Damage graphs and Fight Timeline.</p>
  </section>`;
}

function setRange(nextStart,nextEnd,{publish=true}={}) {
  if (!state) return; const max=state.duration; const start=Math.max(0,Math.min(max,Number(nextStart)||0)); const end=Math.max(start,Math.min(max,Number(nextEnd)||max)); state.start=start; state.end=end;
  const selection=state.node.querySelector('[data-sg-debuff-selection]'); if(selection){selection.style.left=`${start/max*100}%`;selection.style.width=`${Math.max(.25,(end-start)/max*100)}%`;}
  const out=state.node.querySelector('[data-sg-debuff-range]'); if(out) out.textContent=`${formatTime(start)} – ${formatTime(end)}`;
  state.node.querySelectorAll('.sg-debuff-window').forEach(window=>{ const left=parseFloat(window.style.getPropertyValue('--left'))/100*max; const width=parseFloat(window.style.getPropertyValue('--width'))/100*max; window.classList.toggle('is-outside',left+width<start||left>end); });
  if(publish) publishRange({key:state.key,start,end,origin:'debuff',source:'debuff-timeline'});
}

function bind(node,report) {
  const duration=Math.max(.1,Number(report.scope?.duration)||0); state={node,duration,key:scopeKey(),start:0,end:duration,abort:new AbortController()};
  const saved=prefs.sharedRanges?.[state.key]; if(saved) setRange(saved.start,saved.end,{publish:false}); else setRange(0,duration,{publish:false});
  node.querySelector('[data-sg-debuff-focus]')?.addEventListener('change',e=>node.querySelectorAll('[data-sg-debuff-id]').forEach(lane=>{ const focus=e.target.value; lane.classList.toggle('is-muted',Boolean(focus)&&lane.dataset.sgDebuffId!==focus); }));
  node.querySelector('[data-sg-debuff-reset]')?.addEventListener('click',()=>setRange(0,duration));
  const brush=node.querySelector('[data-sg-debuff-brush]'); let drag=null;
  const position=e=>{const rect=brush.getBoundingClientRect();return Math.max(0,Math.min(duration,(e.clientX-rect.left)/Math.max(1,rect.width)*duration));};
  brush?.addEventListener('pointerdown',e=>{drag={start:position(e),id:e.pointerId};brush.setPointerCapture(e.pointerId);setRange(drag.start,drag.start+.05);});
  brush?.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const current=position(e);setRange(Math.min(drag.start,current),Math.max(drag.start,current));});
  const end=e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;}; brush?.addEventListener('pointerup',end); brush?.addEventListener('pointercancel',end);
  window.addEventListener(RANGE_EVENT,e=>{const d=e.detail||{};if(d.scopeKey!==state.key||d.source==='debuff-timeline')return;setRange(d.start,d.end,{publish:false});},{signal:state.abort.signal});
}

async function enhance() {
  if(activeView()!=='debuffs'||!root)return; const page=root.querySelector('[data-debuff-page]'); if(!page||page.querySelector('[data-sg-debuff-timeline]'))return;
  try{const report=await effectReport();if(activeView()!=='debuffs'||!page.isConnected)return;const health=page.querySelector('.effect-health-strip');(health||page.firstElementChild)?.insertAdjacentHTML(health?'afterend':'beforebegin',markup(report));const node=page.querySelector('[data-sg-debuff-timeline]');if(node)bind(node,report);}catch{}
}

export function scheduleDebuffTimeline(){if(scanFrame)return;scanFrame=requestAnimationFrame(()=>{scanFrame=0;enhance();});}
export function clearDebuffTimeline(){state?.abort.abort();state=null;}
