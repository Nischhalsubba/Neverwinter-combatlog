import { destroyChart, esc, renderTimelineChart, verifiedReport, workerRequest } from './shared.js';

let token=0;
let observer=null;

async function enhance(dialog){
  const result=dialog.querySelector('[data-qol-attempt-result]');if(!result||result.dataset.sgAttemptVisuals==='true'||!result.querySelector('.qol-compare-grid'))return;
  const a=dialog.querySelector('[data-qol-attempt-a]')?.value,b=dialog.querySelector('[data-qol-attempt-b]')?.value;if(!a||!b||a===b)return;
  const local=++token;result.dataset.sgAttemptVisuals='loading';
  try{
    const aId=Number(a.split(':')[1]),bId=Number(b.split(':')[1]);
    const [ar,br,ae,be]=await Promise.all([
      verifiedReport({type:'boss',id:aId,targetOnly:false}),verifiedReport({type:'boss',id:bId,targetOnly:false}),
      workerRequest('effect-intelligence-report',{scope:{type:'boss',id:aId,targetOnly:false}},90000).catch(()=>null),
      workerRequest('effect-intelligence-report',{scope:{type:'boss',id:bId,targetOnly:false}},90000).catch(()=>null)
    ]);
    if(local!==token||!dialog.isConnected)return;
    const host=document.createElement('section');host.className='panel sg-attempt-visuals';host.innerHTML=`<div class="panel-head"><div><span class="eyebrow">Same boss, two clocks</span><h2>Attempt damage comparison</h2></div><span>Use Fight % to normalize duration</span></div><div class="chart-host" data-chart id="attempt-compare-chart-${local}"></div>${effectDeltaMarkup(ae,be)}`;
    const delta=result.querySelector('.qol-delta');(delta||result.firstElementChild)?.insertAdjacentElement(delta?'afterend':'beforebegin',host);
    renderTimelineChart(host.querySelector('[data-chart]'),[
      {label:'Attempt A',points:ar.partyTimeline||[]},{label:'Attempt B',points:br.partyTimeline||[]}
    ],{ariaLabel:'Boss attempt damage comparison'});
    result.dataset.sgAttemptVisuals='true';
  }catch{result.dataset.sgAttemptVisuals='error';}
}

function effectMap(report){return new Map((report?.teamEffects||[]).map(effect=>[effect.id,effect]));}
function uptime(effect){const targets=(effect?.targets||[]).filter(target=>target.verified&&Number.isFinite(Number(target.uptime)));return targets.length?targets.reduce((sum,target)=>sum+Number(target.uptime),0)/targets.length:null;}
function effectDeltaMarkup(a,b){const left=effectMap(a),right=effectMap(b),ids=[...new Set([...left.keys(),...right.keys()])];if(!ids.length)return'';return `<div class="sg-attempt-effects"><h3>Debuff uptime delta</h3>${ids.map(id=>{const ea=left.get(id),eb=right.get(id),ua=uptime(ea),ub=uptime(eb),name=eb?.name||ea?.name||id;if(ua==null&&ub==null)return'';return `<div class="sg-attempt-effect"><span>${esc(name)}</span><div><i style="--a:${Math.max(0,ua||0)}%"></i><b style="--b:${Math.max(0,ub||0)}%"></b></div><small>A ${ua==null?'—':ua.toFixed(1)+'%'} · B ${ub==null?'—':ub.toFixed(1)+'%'}</small></div>`;}).join('')}</div>`;}

function scan(){const dialog=document.querySelector('.qol-modal');if(!dialog)return;enhance(dialog);if(!observer){observer=new MutationObserver(()=>enhance(dialog));observer.observe(dialog,{childList:true,subtree:true});}}
export function scheduleAttemptVisuals(){requestAnimationFrame(scan);}
export function clearAttemptVisuals(){token+=1;observer?.disconnect();observer=null;document.querySelectorAll('[id^="attempt-compare-chart-"]').forEach(destroyChart);}
