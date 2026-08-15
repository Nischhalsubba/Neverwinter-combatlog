import { RANGE_EVENT, currentScope, prefs, publishRange, scopeKey, verifiedReport } from './shared.js';

let suppress=false;
let scrollFrame=0;

function panel(){return document.querySelector('#view-root .rotation-panel[data-power-timing-v12="true"],#view-root .rotation-panel');}
function scrolls(node){return Array.from(node?.querySelectorAll('.rotation-scroll')||[]);}
function duration(node){const ruler=node?.querySelector('.rotation-timeline');const width=Number(node?.dataset.ptWorldWidth)||ruler?.scrollWidth||1;const first=scrolls(node)[0];const viewport=Math.max(1,first?.clientWidth||1);const seconds=Math.max(1,Number(node?.dataset.sgFightDuration)||1);return {width,viewport,seconds};}

function visibleRange(node){const first=scrolls(node)[0];if(!first)return null;const meta=duration(node);return {start:first.scrollLeft/meta.width*meta.seconds,end:(first.scrollLeft+meta.viewport)/meta.width*meta.seconds,meta};}

function broadcast(node){if(suppress)return;const range=visibleRange(node);if(!range)return;publishRange({key:scopeKey(),start:range.start,end:range.end,origin:'timeline',source:'fight-timeline'});}

function applyRange(node,start,end){const first=scrolls(node)[0];if(!first)return;const meta=duration(node);const widthSeconds=Math.max(.1,Number(end)-Number(start));const desiredZoom=Math.max(.4,Math.min(12,meta.viewport/(widthSeconds*3)));const currentZoom=Math.max(.01,(parseFloat(node.querySelector('[data-pt-zoom-label]')?.textContent)||100)/100);suppress=true;
  const factor=desiredZoom/currentZoom; if(factor>1.03){const clicks=Math.min(16,Math.ceil(Math.log(factor)/Math.log(1.25)));for(let i=0;i<clicks;i++)node.querySelector('[data-pt-zoom-in]')?.click();} else if(factor<.97){const clicks=Math.min(16,Math.ceil(Math.log(1/factor)/Math.log(1.25)));for(let i=0;i<clicks;i++)node.querySelector('[data-pt-zoom-out]')?.click();}
  requestAnimationFrame(()=>{const after=duration(node);const left=Math.max(0,Number(start)/after.seconds*after.width);for(const scroller of scrolls(node))scroller.scrollLeft=left;suppress=false;});
}

export async function bindTimelineSync(){const node=panel();if(!node||node.dataset.sgRangeSync==='true')return;node.dataset.sgRangeSync='true';try{const report=await verifiedReport(currentScope());node.dataset.sgFightDuration=String(Math.max(1,Number(report.duration)||Number(report.scope?.duration)||1));}catch{node.dataset.sgFightDuration='1';}for(const scroller of scrolls(node))scroller.addEventListener('scroll',()=>{if(scrollFrame)cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;broadcast(node);});},{passive:true});node.querySelector('[data-pt-zoom-in]')?.addEventListener('click',()=>requestAnimationFrame(()=>broadcast(node)));node.querySelector('[data-pt-zoom-out]')?.addEventListener('click',()=>requestAnimationFrame(()=>broadcast(node)));node.querySelector('[data-pt-fit]')?.addEventListener('click',()=>requestAnimationFrame(()=>broadcast(node)));
  window.addEventListener(RANGE_EVENT,e=>{const d=e.detail||{};if(d.scopeKey!==scopeKey()||d.source==='fight-timeline')return;applyRange(node,d.start,d.end);});
  const saved=prefs.sharedRanges?.[scopeKey()];if(saved)applyRange(node,saved.start,saved.end);
}
