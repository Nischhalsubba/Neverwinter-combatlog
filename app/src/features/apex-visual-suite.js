(function(){
  const SG = window.SG || {};
  const storeKey = 'strikeglass.apex.visuals.v2';
  const chartStore = new Map();
  const chartInstances = new Map();
  let idSeq = 0;
  const defaults = { dps:'area', incoming:'area', activation:'heatmap', breakdown:'bar' };
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch (_) { prefs = {}; }

  const chartTypes = [
    ['line','Line'],['area','Area'],['column','Column'],['bar','Bar'],['mixed','Mixed / Combo'],['rangeArea','Range Area'],['timeline','Timeline / Range Bar'],['funnel','Funnel'],['candlestick','Candlestick'],['boxplot','BoxPlot'],['violin','Violin style'],['bubble','Bubble'],['scatter','Scatter'],['heatmap','Heatmap'],['treemap','Treemap'],['slope','Slope'],['pie','Pie'],['donut','Donut'],['radialBar','RadialBar / Circle'],['gauge','Gauge'],['radar','Radar'],['polarArea','Polar Area'],['sparkline','Sparkline'],['dashboard','Dashboard mix']
  ];

  const CD = { EntanglingForce:16, FanningTheFlame:22, Fireball:12, IcyTerrain:19, Repel:11, IcyRays:18, ChillStrike:15, ThornWard:16, ThornStrike:12, HinderingStrike:12, SplitTheSky:18, ThrowCaution:18, HinderingShot:12 };
  const cleanKey = value => String(value || '').replace(/[^a-z0-9]/gi,'');
  const fmt = value => { try { return window.fmt ? window.fmt(value) : Math.round(value || 0).toLocaleString(); } catch (_) { return String(value || 0); } };
  const esc = value => SG.escape ? SG.escape(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dur = value => window.dur ? window.dur(value) : Math.round(value || 0) + 's';

  function getType(kind){ return prefs[kind] || defaults[kind] || 'area'; }
  function setType(kind,type){ prefs[kind] = type; try { localStorage.setItem(storeKey, JSON.stringify(prefs)); } catch (_) {} }
  function downsample(data,max){
    data = data || [];
    if(data.length <= max) return data;
    const bucket = Math.ceil(data.length / max), out = [];
    for(let i=0;i<data.length;i+=bucket){
      let peak = data[i], sum = 0, count = 0;
      for(let j=i;j<Math.min(data.length,i+bucket);j++){ const y = data[j].y || data[j].dps || 0; sum += y; count++; if(y > ((peak.y || peak.dps) || 0)) peak = data[j]; }
      out.push({ x: peak.x ?? peak.time ?? i, y: Math.max((peak.y || peak.dps) || 0, sum / Math.max(1,count)) });
    }
    return out;
  }
  function bucketize(points,count=12){
    points = points || [];
    if(!points.length) return [];
    const size = Math.ceil(points.length / count), out = [];
    for(let i=0;i<points.length;i+=size){
      const slice = points.slice(i,i+size).map(p => p.y || p.dps || 0);
      const label = Math.round(i / Math.max(1,points.length-1) * 100) + '%';
      out.push({ label, value: Math.max(0, ...slice), sum: slice.reduce((a,b)=>a+b,0), values: slice });
    }
    return out;
  }
  function five(values){
    values = (values || []).filter(v => Number.isFinite(v)).sort((a,b)=>a-b);
    if(!values.length) return [0,0,0,0,0];
    const at = p => values[Math.min(values.length-1, Math.floor(p * (values.length-1)))];
    return [values[0], at(.25), at(.5), at(.75), values[values.length-1]];
  }
  function base(type,height=320){
    return { chart:{ type, height, background:'#ffffff', animations:{ enabled:false }, toolbar:{ show:true, tools:{ download:false, selection:true, zoom:true, zoomin:true, zoomout:true, pan:true, reset:true } }, fontFamily:'Inter, system-ui, Segoe UI, Arial, sans-serif' }, colors:['#356bd8','#20a886','#ef735f','#7a62d6','#d18a22'], dataLabels:{ enabled:false }, grid:{ borderColor:'#d8e2ec', strokeDashArray:3 }, legend:{ labels:{ colors:'#101923' } }, tooltip:{ theme:'light' }, xaxis:{ labels:{ style:{ colors:'#23344a' } }, title:{ style:{ color:'#23344a', fontWeight:800 } } }, yaxis:{ labels:{ style:{ colors:'#23344a' }, formatter:v => fmt(v) }, title:{ style:{ color:'#23344a', fontWeight:800 } } }, noData:{ text:'No chart data', style:{ color:'#101923' } } };
  }
  function shell(kind,title,subtitle,payload){
    const id = 'sgx-' + (++idSeq);
    chartStore.set(id,{ kind, payload });
    const selected = getType(kind);
    return `<div class="sgx-chart" data-sgx-id="${id}"><div class="sgx-toolbar sg-no-help"><div><b>${esc(title)}</b><small>${esc(subtitle || '')}</small></div><label>Chart style <select data-sgx-kind="${esc(kind)}">${chartTypes.map(([value,label]) => `<option value="${value}" ${selected===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label></div><div class="sgx-target"></div></div>`;
  }

  function dpsOptions(kind,payload){
    const type = getType(kind);
    const raw = downsample((payload.points || []).map(p => ({ x:Number(p.time ?? p.x ?? 0), y:Number(p.dps ?? p.y ?? 0) })), 720);
    const buckets = bucketize(raw, 14);
    const peak = Math.max(1, ...raw.map(p=>p.y));
    if(type === 'pie' || type === 'donut') return Object.assign(base(type,320), { labels:buckets.map(b=>b.label), series:buckets.map(b=>Math.round(b.sum)), yaxis:undefined });
    if(type === 'polarArea') return Object.assign(base('polarArea',340), { labels:buckets.map(b=>b.label), series:buckets.map(b=>Math.round(b.sum)), yaxis:undefined });
    if(type === 'radialBar' || type === 'gauge') return Object.assign(base('radialBar',330), { series:[Math.round((raw.reduce((a,b)=>a+b.y,0)/Math.max(1,raw.length))/peak*100), Math.round((raw.at(-1)?.y||0)/peak*100)], labels:['Average vs peak','End vs peak'], plotOptions:{ radialBar:{ hollow:{ size:type==='gauge'?'62%':'45%' }, dataLabels:{ value:{ formatter:v=>v+'%' } } } }, yaxis:undefined });
    if(type === 'radar') return Object.assign(base('radar',340), { labels:buckets.map(b=>b.label), series:[{ name:'DPS bucket', data:buckets.map(b=>Math.round(b.value)) }] });
    if(type === 'treemap') return Object.assign(base('treemap',340), { series:[{ data:buckets.map(b=>({ x:b.label, y:Math.round(b.sum) })) }] });
    if(type === 'heatmap') return Object.assign(base('heatmap',300), { series:[{ name:'DPS', data:buckets.map(b=>({ x:b.label, y:Math.round(b.value) })) }], plotOptions:{ heatmap:{ radius:0, shadeIntensity:.45 } } });
    if(type === 'candlestick') return Object.assign(base('candlestick',330), { series:[{ data:buckets.map(b=>({ x:b.label, y:[b.values[0]||0, Math.max(...b.values,0), Math.min(...b.values,0), b.values.at(-1)||0].map(Math.round) })) }] });
    if(type === 'boxplot' || type === 'violin') return Object.assign(base('boxPlot',330), { series:[{ data:buckets.map(b=>({ x:b.label, y:five(b.values).map(Math.round) })) }] });
    if(type === 'rangeArea') return Object.assign(base('rangeArea',320), { series:[{ name:'DPS range', data:raw.map(p=>({ x:p.x, y:[Math.round(p.y*.72), Math.round(p.y)] })) }], stroke:{ curve:'smooth' } });
    if(type === 'timeline') return Object.assign(base('rangeBar',330), { plotOptions:{ bar:{ horizontal:true, rangeBarGroupRows:true } }, xaxis:{ type:'numeric', labels:{ style:{ colors:'#23344a' }, formatter:v=>Math.round(v)+'s' } }, series:[{ name:'Burst windows', data:raw.filter(p=>p.y>peak*.25).slice(0,60).map(p=>({ x:'DPS activity', y:[p.x, p.x+3] })) }] });
    if(type === 'bubble') return Object.assign(base('bubble',320), { series:[{ name:'DPS', data:raw.map(p=>({ x:p.x, y:p.y, z:Math.max(4, p.y/peak*32) })) }], xaxis:{ type:'numeric', labels:{ style:{ colors:'#23344a' }, formatter:v=>Math.round(v)+'s' } } });
    if(type === 'scatter') return Object.assign(base('scatter',320), { series:[{ name:'DPS', data:raw }], xaxis:{ type:'numeric', labels:{ style:{ colors:'#23344a' }, formatter:v=>Math.round(v)+'s' } } });
    if(type === 'bar' || type === 'column' || type === 'funnel') return Object.assign(base('bar',320), { plotOptions:{ bar:{ horizontal:type==='bar'||type==='funnel', isFunnel:type==='funnel' } }, series:[{ name:'DPS bucket', data:buckets.map(b=>({ x:b.label, y:Math.round(b.value) })) }] });
    if(type === 'slope') return Object.assign(base('line',320), { series:[{ name:'Start to end DPS', data:raw.length?[raw[0],raw.at(-1)]:[] }], stroke:{ curve:'straight', width:3 } });
    if(type === 'sparkline') return Object.assign(base('line',150), { chart:Object.assign(base('line',150).chart,{ sparkline:{ enabled:true }, toolbar:{ show:false } }), series:[{ name:'DPS', data:raw }], stroke:{ curve:'smooth', width:2 } });
    if(type === 'mixed' || type === 'dashboard') return Object.assign(base('line',320), { series:[{ name:'DPS', type:'column', data:raw }, { name:'Smoothed', type:'line', data:downsample(raw,180) }], stroke:{ width:[0,3], curve:'smooth' } });
    return Object.assign(base(type==='line'?'line':'area',320), { series:[{ name:'3s rolling DPS', data:raw }], stroke:{ curve:'smooth', width:2 }, fill:{ type:type==='area'?'gradient':'solid', gradient:{ opacityFrom:.35, opacityTo:.05 } }, xaxis:{ type:'numeric', labels:{ style:{ colors:'#23344a' }, formatter:v=>Math.round(v)+'s' }, title:{ text:'Fight time', style:{ color:'#23344a', fontWeight:800 } } }, yaxis:{ labels:{ style:{ colors:'#23344a' }, formatter:v=>fmt(v) }, title:{ text:'DPS', style:{ color:'#23344a', fontWeight:800 } } } });
  }

  function breakdownOptions(kind,payload){
    const type = getType(kind);
    const items = (payload.items || []).slice(0,18).map(x => ({ label:String(x.label || x.power || x.category || 'Item'), value:Number(x.value || x.damage || 0) }));
    if(type === 'pie' || type === 'donut') return Object.assign(base(type,340), { labels:items.map(i=>i.label), series:items.map(i=>Math.round(i.value)), yaxis:undefined });
    if(type === 'polarArea') return Object.assign(base('polarArea',340), { labels:items.map(i=>i.label), series:items.map(i=>Math.round(i.value)), yaxis:undefined });
    if(type === 'radialBar' || type === 'gauge') { const max=Math.max(1,...items.map(i=>i.value)); return Object.assign(base('radialBar',340), { labels:items.slice(0,6).map(i=>i.label), series:items.slice(0,6).map(i=>Math.round(i.value/max*100)), yaxis:undefined }); }
    if(type === 'radar') return Object.assign(base('radar',340), { labels:items.slice(0,10).map(i=>i.label), series:[{ name:'Damage', data:items.slice(0,10).map(i=>Math.round(i.value)) }] });
    if(type === 'treemap') return Object.assign(base('treemap',340), { series:[{ data:items.map(i=>({ x:i.label, y:Math.round(i.value) })) }] });
    if(type === 'heatmap') return Object.assign(base('heatmap',340), { series:[{ name:'Damage', data:items.map(i=>({ x:i.label, y:Math.round(i.value) })) }], plotOptions:{ heatmap:{ radius:0 } } });
    if(type === 'scatter' || type === 'bubble') return Object.assign(base(type,340), { series:[{ name:'Damage', data:items.map((i,n)=> type==='bubble'?{ x:n+1, y:i.value, z:Math.max(6, Math.sqrt(i.value)/900) }:{ x:n+1, y:i.value }) }], xaxis:{ categories:items.map(i=>i.label), labels:{ style:{ colors:'#23344a' } } } });
    if(type === 'timeline') return Object.assign(base('rangeBar',340), { plotOptions:{ bar:{ horizontal:true } }, series:[{ data:items.map((i,n)=>({ x:i.label, y:[0, Math.round(i.value)] })) }] });
    if(type === 'boxplot' || type === 'violin' || type === 'candlestick' || type === 'rangeArea' || type === 'slope') return Object.assign(base('bar',340), { plotOptions:{ bar:{ horizontal:true } }, series:[{ name:'Damage', data:items.map(i=>({ x:i.label, y:Math.round(i.value) })) }] });
    if(type === 'mixed' || type === 'dashboard') return Object.assign(base('line',340), { series:[{ name:'Damage', type:'column', data:items.map(i=>({ x:i.label, y:Math.round(i.value) })) }, { name:'Trend', type:'line', data:items.map(i=>({ x:i.label, y:Math.round(i.value) })) }], stroke:{ width:[0,3] } });
    return Object.assign(base('bar',340), { plotOptions:{ bar:{ horizontal:type!=='column', isFunnel:type==='funnel' } }, series:[{ name:'Damage', data:items.map(i=>({ x:i.label, y:Math.round(i.value) })) }] });
  }

  function activationOptions(kind,payload){
    const type = getType(kind);
    const powers = (payload.powers || []).slice(0,24);
    const start = payload.start || 0, span = Math.max(1, payload.span || 1), bins = 80;
    if(type === 'heatmap'){
      const series = powers.map(p => {
        const values = Array.from({length:bins},(_,i)=>({ x:String(i+1), y:0 }));
        (p.rows || []).forEach(r => { const idx = Math.max(0, Math.min(bins-1, Math.floor((r.time-start)/span*bins))); values[idx].y += r.flags && r.flags.has && r.flags.has('Critical') ? 2 : 1; });
        return { name:p.power, data:values };
      });
      return Object.assign(base('heatmap',Math.max(330,powers.length*22)), { series, chart:Object.assign(base('heatmap').chart,{ height:Math.max(330,powers.length*22), toolbar:{ show:false } }), plotOptions:{ heatmap:{ radius:0, shadeIntensity:.45, colorScale:{ ranges:[{from:0,to:0,color:'#edf3f8',name:'None'},{from:1,to:2,color:'#6fa2ff',name:'Hit'},{from:3,to:999,color:'#ef735f',name:'Burst'}] } } }, xaxis:{ labels:{ show:false }, title:{ text:'Start to end', style:{ color:'#23344a' } } }, yaxis:{ labels:{ style:{ colors:'#101923', fontSize:'11px' } } } });
    }
    if(type === 'timeline') return Object.assign(base('rangeBar',Math.max(330,powers.length*28)), { plotOptions:{ bar:{ horizontal:true, rangeBarGroupRows:true } }, series:[{ name:'Activations', data:powers.flatMap(p => (p.rows || []).slice(0,80).map(r => ({ x:p.power, y:[Math.round(r.time-start), Math.round(r.time-start)+1] }))) }], xaxis:{ type:'numeric', labels:{ style:{ colors:'#23344a' }, formatter:v=>Math.round(v)+'s' } } });
    return breakdownOptions(kind,{ items:powers.map(p=>({ label:p.power, value:p.hits || (p.rows||[]).length || 0 })) });
  }

  function renderAllCharts(){
    if(!window.ApexCharts) return;
    document.querySelectorAll('.sgx-chart').forEach(shell => {
      const id = shell.dataset.sgxId;
      const target = shell.querySelector('.sgx-target');
      const item = chartStore.get(id);
      if(!id || !target || !item || chartInstances.has(id)) return;
      const options = item.kind === 'activation' ? activationOptions(item.kind,item.payload) : (item.kind === 'dps' || item.kind === 'incoming' ? dpsOptions(item.kind,item.payload) : breakdownOptions(item.kind,item.payload));
      const chart = new ApexCharts(target, options);
      chartInstances.set(id, chart);
      chart.render();
    });
    Array.from(chartInstances.entries()).forEach(([id,chart]) => { if(!document.querySelector(`[data-sgx-id="${id}"]`)){ try{ chart.destroy(); } catch(_){} chartInstances.delete(id); chartStore.delete(id); } });
  }
  function scheduleCharts(){ requestAnimationFrame(renderAllCharts); }

  function rollingDps(rows,pid){
    const d = NWParser.validForPlayer(rows,pid).sort((a,b)=>a.time-b.time);
    if(!d.length) return [];
    const out = []; let left=0,right=0,damage=0;
    for(let t=Math.floor(d[0].time); t<=Math.ceil(d[d.length-1].time); t++){
      while(right<d.length && d[right].time<=t){ damage += d[right].amount; right++; }
      while(left<right && d[left].time<=t-3){ damage -= d[left].amount; left++; }
      out.push({ time:t, dps:damage/3 });
    }
    return out;
  }
  function incomingDpsLocal(rows,pid){
    const d = rows.filter(r=>r.targetId===pid && r.damageType==='Physical' && r.amount>0).sort((a,b)=>a.time-b.time);
    if(!d.length) return [];
    const out=[]; let left=0,right=0,damage=0;
    for(let t=Math.floor(d[0].time); t<=Math.ceil(d[d.length-1].time); t++){
      while(right<d.length && d[right].time<=t){ damage += d[right].amount; right++; }
      while(left<right && d[left].time<=t-3){ damage -= d[left].amount; left++; }
      out.push({ time:t, dps:damage/3 });
    }
    return out;
  }

  window.bars = function(title,items,key='power'){
    return '<div class="sgx-breakdown-block">' + shell('breakdown', title, 'Use the chart style menu to switch between ApexCharts views.', { items:(items || []).map(x => ({ label:x[key], value:x.damage })) }) + '</div>';
  };

  window.renderTimeline = function(rows,pid){
    const ps = NWParser.powers(rows,pid);
    let filtered = ps;
    if(state.filter==='class') filtered = ps.filter(p=>['At-Will','Encounter','Daily','Feat','Class Feature'].includes(p.category));
    if(state.filter==='proc') filtered = ps.filter(p=>['Item / Enchant','Mount','Other / Unknown'].includes(p.category));
    if(state.filter==='pets') filtered = ps.filter(p=>p.category==='Pet / Companion');
    const top = filtered.slice(0,18);
    const all = NWParser.validForPlayer(rows,pid);
    const start = all[0]?.time || 0, end = all[all.length-1]?.time || start+1, span = Math.max(1,end-start);
    const freq = top.map(p => { const first=p.rows[0]?.time||0,last=p.rows[p.rows.length-1]?.time||0; return { power:p.power, category:p.category, hits:p.hits, first:first-start, last:last-start, avg:p.hits>1?(last-first)/(p.hits-1):0 }; });
    const cdRows = top.filter(p=>CD[cleanKey(p.power)]).map(p => { const cd=CD[cleanKey(p.power)], uses=p.hits, max=Math.floor(span/cd)+1; return { power:p.power, category:p.category, cd:cd+'s', hits:uses, max, eff:max?uses/max*100:0 }; });
    $('#content').innerHTML = playerHeader() + `<section class="panel"><h3>Rotation timeline</h3>${shell('dps','DPS pace','Rolling 3-second damage. Choose any ApexCharts style from the menu.',{points:rollingDps(rows,pid)})}<div class="filterbar"><button class="${state.filter==='all'?'active':''}" data-filter="all">All</button><button class="${state.filter==='class'?'active':''}" data-filter="class">Class Powers</button><button class="${state.filter==='proc'?'active':''}" data-filter="proc">Procs & Items</button><button class="${state.filter==='pets'?'active':''}" data-filter="pets">Pets</button></div>${shell('activation','Power activations','Switch between heatmap, timeline, bars, donut, radar and other ApexCharts styles.',{powers:top,start,span})}<h3>Power Usage Frequency</h3>${table(freq,[['power','Power'],['category','Category'],['hits','Activations'],['first','First Use'],['last','Last Use'],['avg','Avg Interval']])}<h3>Cooldown Efficiency</h3>${table(cdRows,[['power','Power'],['category','Type'],['cd','CD'],['hits','Uses'],['max','Max'],['eff','Efficiency']])}</section>`;
    $$('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render();});
    scheduleCharts();
  };

  if(typeof deathRows === 'function'){
    window.renderDeaths = function(rows,pid){
      const deaths = deathRows(rows,pid);
      $('#content').innerHTML = playerHeader() + `<section class="panel"><h3>Deaths - ${deaths.length} Total</h3>${shell('incoming','Incoming damage pace','Rolling 3-second incoming damage. Pick any ApexCharts style.',{points:incomingDpsLocal(rows,pid)})}<h3>Death Log</h3>${deaths.map(d=>`<div class="deathCard"><small>${esc(d.timestampRaw)}</small><br>Killed by <b>${esc(d.ownerName)}</b> with <b>${esc(d.powerName)}</b><br><span class="badge red">${fmt(d.amount)} ${esc(d.damageType)}</span> ${d.flags.has('Critical')?'<span class="flag crit">CRIT</span>':''}</div>`).join('') || '<div class="empty">No deaths</div>'}</section>`;
      scheduleCharts();
    };
  }

  document.addEventListener('change', event => {
    const select = event.target.closest('[data-sgx-kind]');
    if(!select) return;
    setType(select.dataset.sgxKind, select.value);
    if(typeof render === 'function') render();
  });

  const css = `.timelineBox{background:#ffffff!important;color:#101923!important;border:1px solid #d8e2ec!important;padding:12px!important}.timelineBox h3,.timelineBox b,.timelineBox small{color:#101923!important}.chart text{fill:#101923!important}.sgx-chart,.sgx-chart *{border-radius:0!important}.sgx-chart{background:#ffffff!important;color:#101923!important;border:1px solid #d8e2ec!important;padding:14px!important;margin:14px 0!important;box-shadow:none!important}.sgx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.sgx-toolbar b{display:block;color:#101923!important;font-size:15px}.sgx-toolbar small{display:block;color:#526174!important;font-size:12px}.sgx-toolbar label{display:flex;align-items:center;gap:8px;color:#23344a!important;font-weight:900}.sgx-toolbar select{min-width:210px;background:#fff!important;color:#101923!important;border:1px solid #b8c5d3!important}.sgx-target{min-height:320px;background:#fff!important}.apexcharts-canvas,.apexcharts-svg{background:#fff!important}.apexcharts-text,.apexcharts-title-text,.apexcharts-legend-text,.apexcharts-xaxis-label,.apexcharts-yaxis-label{fill:#101923!important;color:#101923!important}.apexcharts-tooltip,.apexcharts-menu{color:#101923!important;background:#ffffff!important;border-color:#d8e2ec!important}.apexcharts-tooltip *,.apexcharts-menu *{color:#101923!important}.apexcharts-gridline{stroke:#d8e2ec!important}.filterbar{background:#fff!important;color:#101923!important}.filterbar button{background:#fff!important;color:#101923!important;border:1px solid #b8c5d3!important}.filterbar button.active{background:#0e1b27!important;color:#fff!important}@media(max-width:800px){.sgx-toolbar{display:grid}.sgx-toolbar select{width:100%}}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const oldRender = window.render;
  if(typeof oldRender === 'function') window.render = function(){ oldRender.apply(this, arguments); scheduleCharts(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleCharts); else scheduleCharts();
})();
