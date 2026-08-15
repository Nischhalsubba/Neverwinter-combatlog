import { clearVisualCaches, ensureStyle } from './shared.js';
import { scanGraphs, scheduleGraphScan } from './graph-tools.js';
import { clearDebuffTimeline, scheduleDebuffTimeline } from './debuff-timeline.js';
import { bindTimelineSync } from './timeline-sync.js';
import { clearAttemptVisuals, scheduleAttemptVisuals } from './attempt-visuals.js';
import { resetScenes, scanScenes } from './scene-visuals.js';

let scheduled=0;
function scan(){ensureStyle();scheduleGraphScan();scheduleDebuffTimeline();scheduleAttemptVisuals();bindTimelineSync().catch(()=>{});scanScenes();}
function schedule(){if(scheduled)return;scheduled=requestAnimationFrame(()=>{scheduled=0;scan();});}

document.addEventListener('strikeglass:view-rendered',schedule);
document.getElementById('app-nav')?.addEventListener('click',()=>setTimeout(schedule,0));
document.getElementById('encounter-select')?.addEventListener('change',()=>{clearDebuffTimeline();clearAttemptVisuals();resetScenes();setTimeout(schedule,0);});
window.addEventListener('strikeglass:worker-ready',()=>{clearVisualCaches();clearDebuffTimeline();clearAttemptVisuals();resetScenes();setTimeout(schedule,0);});
new MutationObserver(schedule).observe(document.getElementById('view-root')||document.body,{childList:true,subtree:false});
ensureStyle();scan();
