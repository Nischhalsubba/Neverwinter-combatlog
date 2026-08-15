const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const chartByNode = new WeakMap();
const pendingByNode = new WeakMap();
const liveCharts = new Set();
const MAX_POINTS = 1200;
const PREF_KEY = 'strikeglass.graph-studio.v1';
let echartsPromise = null;
let themeObserver = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const compact = value => {
  const n = Number(value) || 0, a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(n).toLocaleString();
};
const timeLabel = value => {
  const n = Math.max(0, Number(value) || 0), h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = Math.floor(n % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
};

function bucketTimeline(points, maxPoints = MAX_POINTS) {
  if (!Array.isArray(points) || !points.length) return [];
  if (points.length <= maxPoints) return points.map(point => ({ second:Number(point.second)||0, damage:Number(point.damage)||0 }));
  const last = Math.max(1, Number(points.at(-1)?.second)||1), width = Math.max(1, Math.ceil(last / maxPoints)), buckets = new Map();
  for (const point of points) {
    const second = Number(point.second)||0, bucket = Math.floor(second / width) * width;
    buckets.set(bucket, (buckets.get(bucket)||0) + (Number(point.damage)||0));
  }
  return Array.from(buckets, ([second, damage]) => ({ second, damage })).sort((a,b) => a.second - b.second);
}

function ensureStyle() {
  if (document.querySelector('link[data-chart-studio-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../v16/chart-studio.css', import.meta.url).href;
  link.dataset.chartStudioStyle = 'true';
  document.head.append(link);
}
function engineUrl() { return new URL('../../vendor/echarts.min.js', import.meta.url).href; }
function loadECharts() {
  if (window.echarts?.init) return Promise.resolve(window.echarts);
  if (echartsPromise) return echartsPromise;
  echartsPromise = new Promise((resolve, reject) => {
    const script = document.querySelector('script[data-strikeglass-echarts]') || document.createElement('script');
    if (!script.dataset.strikeglassEcharts) {
      script.src = engineUrl(); script.async = true; script.dataset.strikeglassEcharts = '6.1.0'; document.head.append(script);
    }
    script.addEventListener('load', () => window.echarts?.init ? resolve(window.echarts) : reject(new Error('ECharts did not initialize.')), { once:true });
    script.addEventListener('error', () => reject(new Error('ECharts failed to load.')), { once:true });
  }).catch(error => { echartsPromise = null; throw error; });
  return echartsPromise;
}

function loadPrefs() {
  try { return { contrast:false, grid:true, points:false, area:false, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
  catch { return { contrast:false, grid:true, points:false, area:false }; }
}
function savePrefs(state) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ contrast:state.contrast, grid:state.grid, points:state.points, area:state.area })); } catch {}
}
const ICON = {
  minus:'M5 12h14', plus:'M12 5v14M5 12h14', reset:'M4 7v5h5M5.2 16a8 8 0 1 0 .4-8.6L4 9',
  contrast:'M12 4a8 8 0 1 0 0 16V4z', grid:'M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16',
  points:'M5 16l4-5 4 3 6-7', area:'M4 18V8l5 4 5-6 6 5v7z', expand:'M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5', image:'M4 5h16v14H4zM7 15l3-3 3 2 3-4 3 5'
};
function control(name, label, pressed = null) {
  const state = pressed == null ? '' : ` aria-pressed="${pressed ? 'true' : 'false'}"`;
  return `<button class="sg-chart-button" type="button" data-sg-chart-action="${name}" aria-label="${esc(label)}" title="${esc(label)}"${state}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg></button>`;
}
function shell(node, series, ariaLabel) {
  const prefs = loadPrefs();
  const focus = series.length > 1 ? `<label class="sg-chart-focus"><span>Focus</span><select data-sg-chart-focus aria-label="Focus one series"><option value="">All series</option>${series.map(item => `<option value="${esc(item.label)}">${esc(item.label)}</option>`).join('')}</select></label>` : '';
  node.classList.add('sg-chart-studio'); node.setAttribute('role','group'); node.setAttribute('aria-label', ariaLabel);
  node.innerHTML = `<div class="sg-chart-toolbar" data-sg-chart-toolbar><div class="sg-chart-tools-primary">${control('minus','Zoom out')}${control('plus','Zoom in')}${control('reset','Reset graph view')}${focus}</div><div class="sg-chart-tools-secondary">${control('contrast','High contrast graph',prefs.contrast)}${control('grid','Show grid',prefs.grid)}${control('points','Show data points',prefs.points)}${control('area','Show area fill',prefs.area)}${control('expand','Expand graph')}${control('image','Download graph image')}</div></div><div class="chart-lazy-placeholder" data-sg-chart-placeholder aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="sg-chart-stage" data-sg-chart-stage tabindex="0" aria-label="${esc(`${ariaLabel}. Drag to pan and use the mouse wheel or graph controls to zoom.`)}"></div><div class="sg-chart-help">Drag to pan · wheel to zoom · hover to highlight · click legend to show or hide a series</div>`;
  return prefs;
}

function palette(contrast) {
  return contrast
    ? [css('--blue','#2457d6'),css('--red','#b42318'),css('--green','#067647'),css('--amber','#9a6700'),css('--cyan','#007c91')]
    : [css('--blue','#4f7ff0'),css('--amber','#d59a28'),css('--green','#3d9a68'),css('--red','#d85c61'),css('--cyan','#429ab3')];
}
function optionFor(state) {
  const muted = css('--muted','#687887'), gridColor = css('--grid','rgba(90,110,125,.16)'), colors = palette(state.contrast);
  const maxTime = Math.max(1, ...state.series.flatMap(item => item.points.map(point => point.second)));
  const selected = state.focus ? Object.fromEntries(state.series.map(item => [item.label, item.label === state.focus])) : undefined;
  return {
    animation:!reduceMotion.matches, animationDuration:160, color:colors,
    aria:{ show:true, description:state.ariaLabel, decal:{ show:state.contrast } },
    legend:{ show:state.series.length>1, type:'scroll', top:4, right:8, selected, textStyle:{color:muted,fontSize:12}, inactiveColor:css('--line-strong','#aeb9c2') },
    grid:{ left:64, right:22, top:state.series.length>1?42:18, bottom:70 },
    tooltip:{ trigger:'axis', confine:true, axisPointer:{type:'cross',lineStyle:{type:'dashed',color:css('--blue','#4f7ff0')}}, backgroundColor:css('--panel','#fff'), borderColor:css('--line-strong','#c5cdd4'), textStyle:{color:css('--text','#17212b')}, formatter(params){ const rows=Array.isArray(params)?params:[params], at=Number(rows[0]?.value?.[0]??0); return `<strong>${timeLabel(at)}</strong>${rows.map(row=>`<div class="sg-chart-tooltip-row"><span><i style="background:${esc(row.color)}"></i>${esc(row.seriesName)}</span><b>${compact(row.value?.[1]??0)}</b></div>`).join('')}`; } },
    xAxis:{ type:'value', min:0, max:maxTime, boundaryGap:false, axisLabel:{color:muted,formatter:timeLabel,hideOverlap:true}, axisTick:{show:false}, axisLine:{lineStyle:{color:css('--line-strong','#aeb8c1')}}, splitLine:{show:state.grid,lineStyle:{color:gridColor}}, name:'Fight time', nameLocation:'middle', nameGap:30, nameTextStyle:{color:muted,fontSize:11} },
    yAxis:{ type:'value', min:0, axisLabel:{color:muted,formatter:compact}, axisTick:{show:false}, axisLine:{show:false}, splitLine:{show:state.grid,lineStyle:{color:gridColor}} },
    dataZoom:[
      { type:'inside', start:state.start, end:state.end, filterMode:'none', zoomOnMouseWheel:true, moveOnMouseMove:true, moveOnMouseWheel:false },
      { type:'slider', start:state.start, end:state.end, filterMode:'none', height:20, bottom:16, brushSelect:true, textStyle:{color:muted}, fillerColor:css('--accent-soft','rgba(79,127,240,.16)'), handleStyle:{color:css('--blue','#4f7ff0')} }
    ],
    series:state.series.map((item,index)=>({ name:item.label, type:'line', data:item.points.map(point=>[point.second,point.damage]), showSymbol:state.points, symbol:['circle','rect','triangle','diamond','roundRect'][index%5], symbolSize:state.contrast?7:5, sampling:'lttb', lineStyle:{width:state.contrast?3:2,type:['solid','dashed','dotted'][index%3]}, areaStyle:state.area?{opacity:state.contrast ? .12 : .08}:undefined, emphasis:{ focus:'series', lineStyle:{width:state.contrast?4.5:3.5} }, blur:{lineStyle:{opacity:.18},itemStyle:{opacity:.18}} }))
  };
}

function sync(state) {
  const toolbar = state.node.querySelector('[data-sg-chart-toolbar]');
  for (const key of ['contrast','grid','points','area']) toolbar?.querySelector(`[data-sg-chart-action="${key}"]`)?.setAttribute('aria-pressed', state[key] ? 'true' : 'false');
  const focus = toolbar?.querySelector('[data-sg-chart-focus]'); if (focus) focus.value = state.focus;
}
function rerender(state) { if (state.chart && state.stage.isConnected) { state.chart.setOption(optionFor(state), {notMerge:true,lazyUpdate:true}); sync(state); } }
function zoom(state, factor) {
  const span=Math.max(1,state.end-state.start), next=Math.max(.5,Math.min(100,span*factor)), center=(state.start+state.end)/2;
  state.start=Math.max(0,center-next/2); state.end=Math.min(100,center+next/2); if (state.end-state.start<next) { if (state.start===0) state.end=Math.min(100,next); else { state.start=Math.max(0,100-next); state.end=100; } }
  state.chart?.dispatchAction({type:'dataZoom',dataZoomIndex:[0,1],start:state.start,end:state.end});
}
function expand(state, active) {
  const panel=state.node.closest('.chart-panel')||state.node; panel.classList.toggle('sg-chart-expanded',active); document.body.classList.toggle('sg-visual-expanded',active); state.expanded=active; state.node.querySelector('[data-sg-chart-action="expand"]')?.setAttribute('aria-pressed',active?'true':'false'); requestAnimationFrame(()=>state.chart?.resize());
}
function reset(state) { state.start=0; state.end=100; state.focus=''; state.chart?.dispatchAction({type:'dataZoom',dataZoomIndex:[0,1],start:0,end:100}); rerender(state); }
function exportImage(state) { const link=document.createElement('a'); link.href=state.chart.getDataURL({type:'png',pixelRatio:2,backgroundColor:css('--panel','#fff')}); link.download=`strikeglass-${state.node.id||'graph'}.png`; document.body.append(link); link.click(); link.remove(); }
function bind(state) {
  state.node.querySelector('[data-sg-chart-toolbar]')?.addEventListener('click',event=>{ const button=event.target.closest('[data-sg-chart-action]'); if(!button)return; const action=button.dataset.sgChartAction; if(action==='minus')zoom(state,1.35); else if(action==='plus')zoom(state,.72); else if(action==='reset')reset(state); else if(['contrast','grid','points','area'].includes(action)){state[action]=!state[action];savePrefs(state);rerender(state);} else if(action==='expand')expand(state,!state.expanded); else if(action==='image'&&state.chart)exportImage(state); });
  state.node.querySelector('[data-sg-chart-focus]')?.addEventListener('change',event=>{state.focus=event.target.value;rerender(state);});
  state.stage.addEventListener('keydown',event=>{ if(event.key==='+'||event.key==='='){event.preventDefault();zoom(state,.72);} else if(event.key==='-'){event.preventDefault();zoom(state,1.35);} else if(event.key==='0'){event.preventDefault();reset(state);} else if(event.key.toLowerCase()==='c'){event.preventDefault();state.contrast=!state.contrast;savePrefs(state);rerender(state);} else if(event.key==='Escape'&&state.expanded){event.preventDefault();expand(state,false);} });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.expanded)expand(state,false);},{signal:state.abort.signal});
}

function fallbackRenderer(state) {
  const canvas=document.createElement('canvas'); canvas.className='native-timeline-chart'; state.stage.replaceChildren(canvas); state.node.classList.add('sg-chart-fallback'); state.node.querySelector('.sg-chart-help').textContent='Advanced graph engine unavailable · showing local fallback';
  const draw=()=>{ const width=Math.max(320,state.stage.clientWidth||320),height=Math.max(240,Math.min(400,width*.3)),dpr=Math.min(1.5,devicePixelRatio||1); canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=css('--panel','#fff');ctx.fillRect(0,0,width,height);const l=64,r=16,t=20,b=38,pw=width-l-r,ph=height-t-b,maxX=Math.max(1,...state.series.flatMap(x=>x.points.map(p=>p.second))),maxY=Math.max(1,...state.series.flatMap(x=>x.points.map(p=>p.damage)));state.series.forEach((item,index)=>{if(state.focus&&item.label!==state.focus)return;ctx.strokeStyle=palette(state.contrast)[index%5];ctx.lineWidth=state.contrast?3:2;ctx.setLineDash(index%3===1?[7,4]:index%3===2?[2,4]:[]);ctx.beginPath();item.points.forEach((p,i)=>{const x=l+p.second/maxX*pw,y=t+(1-p.damage/maxY)*ph;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.setLineDash([])}); };
  draw(); state.fallbackObserver=new ResizeObserver(draw); state.fallbackObserver.observe(state.stage);
}

function cancelPending(node){const pending=pendingByNode.get(node);pending?.observer?.disconnect();pendingByNode.delete(node);}
function whenNearViewport(node,callback){let started=false;const run=()=>{if(started||!node.isConnected)return;started=true;cancelPending(node);const launch=()=>node.isConnected&&callback();window.requestIdleCallback?window.requestIdleCallback(launch,{timeout:250}):setTimeout(launch,0)};if(!('IntersectionObserver'in window)){run();return;}const observer=new IntersectionObserver(entries=>entries.some(entry=>entry.isIntersecting)&&run(),{rootMargin:'320px 0px'});observer.observe(node);pendingByNode.set(node,{observer});}
async function start(state){state.node.querySelector('[data-sg-chart-placeholder]')?.remove();try{const echarts=await loadECharts();if(!state.stage.isConnected||state.abort.signal.aborted)return;state.chart=echarts.init(state.stage,null,{renderer:'canvas',useDirtyRect:true,devicePixelRatio:Math.min(2,devicePixelRatio||1)});state.chart.setOption(optionFor(state));state.chart.on('datazoom',event=>{const item=event.batch?.[0]||event;if(Number.isFinite(item.start))state.start=item.start;if(Number.isFinite(item.end))state.end=item.end;});state.chart.on('legendselectchanged',event=>{const visible=Object.entries(event.selected||{}).filter(([,v])=>v).map(([name])=>name);state.focus=visible.length===1?visible[0]:'';sync(state);});state.resizeObserver=new ResizeObserver(()=>requestAnimationFrame(()=>state.chart?.resize()));state.resizeObserver.observe(state.stage);liveCharts.add(state);}catch{if(state.stage.isConnected&&!state.abort.signal.aborted)fallbackRenderer(state);}}
function installThemeObserver(){if(themeObserver)return;themeObserver=new MutationObserver(()=>{for(const state of liveCharts)rerender(state)});themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-contrast','class','style']});}

export function warmCharts(){ensureStyle();if(document.querySelector('link[data-echarts-preload]'))return;const link=document.createElement('link');link.rel='preload';link.as='script';link.href=engineUrl();link.dataset.echartsPreload='true';document.head.append(link);}
export function renderTimelineChart(node,series,{ariaLabel='Damage over time'}={}){if(!node)return;destroyChart(node);ensureStyle();installThemeObserver();const normalized=(series||[]).map(item=>({label:String(item?.label||'Series'),points:bucketTimeline(item?.points||[])})).filter(item=>item.points.length);if(!normalized.length){node.innerHTML='<div class="chart-fallback">No timeline data in this scope.</div>';return;}const prefs=shell(node,normalized,ariaLabel),state={node,stage:node.querySelector('[data-sg-chart-stage]'),series:normalized,ariaLabel,start:0,end:100,focus:'',expanded:false,...prefs,chart:null,resizeObserver:null,fallbackObserver:null,abort:new AbortController()};chartByNode.set(node,state);bind(state);whenNearViewport(node,()=>start(state));}
export function destroyChart(node){if(!node)return;cancelPending(node);const state=chartByNode.get(node);if(!state)return;state.abort.abort();state.resizeObserver?.disconnect();state.fallbackObserver?.disconnect();if(state.chart&&!state.chart.isDisposed?.())state.chart.dispose();if(state.expanded)document.body.classList.remove('sg-visual-expanded');liveCharts.delete(state);chartByNode.delete(node);}
