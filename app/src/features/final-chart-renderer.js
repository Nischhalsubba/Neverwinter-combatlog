(function(){
  const storeKey = 'strikeglass.final.chart.choice.v1';
  const charts = new Map();
  const data = new Map();
  let seq = 0;
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch (_) { prefs = {}; }

  const choices = [
    ['line','Line'],['area','Area'],['column','Column'],['bar','Bar'],['mixed','Mixed / Combo'],['rangeArea','Range Area'],['timeline','Timeline / Range Bar'],['funnel','Funnel'],['candlestick','Candlestick'],['boxplot','BoxPlot'],['violin','Violin style'],['bubble','Bubble'],['scatter','Scatter'],['heatmap','Heatmap'],['treemap','Treemap'],['slope','Slope'],['pie','Pie'],['donut','Donut'],['radialBar','RadialBar / Circle'],['gauge','Gauge'],['radar','Radar'],['polarArea','Polar Area'],['sparkline','Sparkline'],['dashboard','Dashboard mix']
  ];
  const defaults = { overview:'bar', dps:'area', activation:'heatmap', incoming:'area' };
  const CD = { EntanglingForce:16,FanningTheFlame:22,Fireball:12,IcyTerrain:19,Repel:11,IcyRays:18,ChillStrike:15,ThornWard:16,ThornStrike:12,HinderingStrike:12,SplitTheSky:18,ThrowCaution:18,HinderingShot:12 };

  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const key = s => String(s||'').replace(/[^a-z0-9]/gi,'');
  const html = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = v => { try { return window.fmt ? window.fmt(v) : Math.round(v||0).toLocaleString(); } catch (_) { return String(v||0); } };
  const pct = v => (Number(v)||0).toFixed(1) + '%';
  const dur = v => window.dur ? window.dur(v) : Math.round(v||0) + 's';
  function get(kind){ return prefs[kind] || defaults[kind] || 'area'; }
  function set(kind,type){ prefs[kind]=type; try{ localStorage.setItem(storeKey, JSON.stringify(prefs)); }catch(_){} }
  function card(label,value){ return `<div class="card"><b>${html(value)}</b><span>${html(label)}</span></div>`; }
  function sum(rows,fn){ return (rows||[]).reduce((a,b)=>a+(fn(b)||0),0); }
  function group(rows,fn){ const m=new Map(); (rows||[]).forEach(r=>{ const k=fn(r); if(!m.has(k))m.set(k,[]); m.get(k).push(r); }); return m; }
  function tableSimple(rows,cols){ return `<div class="table"><table><thead><tr>${cols.map(c=>`<th>${html(c[1])}</th>`).join('')}</tr></thead><tbody>${(rows||[]).map(r=>`<tr>${cols.map(c=>`<td>${cell(r[c[0]],c[0])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="empty">No rows</td></tr>`}</tbody></table></div>`; }
  function cell(v,k){ if(v==null)return '-'; if(['damage','total','avg','max','done','taken','shielded','dps','combatDps','value'].includes(k))return fmt(v); if(['share','crit','flank','eff'].includes(k))return pct(v); if(['hits','ticks','rank','maxUses'].includes(k))return Math.round(v||0).toLocaleString(); if(['first','last','time','avgInterval'].includes(k))return Number(v||0).toFixed(1)+'s'; return html(v); }

  function down(points,max=700){
    points = points || [];
    if(points.length <= max) return points;
    const step = Math.ceil(points.length/max), out=[];
    for(let i=0;i<points.length;i+=step){ let peak=points[i], total=0, n=0; for(let j=i;j<Math.min(points.length,i+step);j++){ const y=points[j].y||0; total+=y; n++; if(y>(peak.y||0))peak=points[j]; } out.push({x:peak.x,y:Math.max(peak.y||0,total/Math.max(1,n))}); }
    return out;
  }
  function buckets(points,count=12){
    points=points||[]; if(!points.length)return [];
    const size=Math.ceil(points.length/count), out=[];
    for(let i=0;i<points.length;i+=size){ const vals=points.slice(i,i+size).map(p=>p.y||0); out.push({label:Math.round(i/Math.max(1,points.length-1)*100)+'%', value:Math.max(0,...vals), sum:vals.reduce((a,b)=>a+b,0), values:vals}); }
    return out;
  }
  function five(vals){ vals=(vals||[]).filter(Number.isFinite).sort((a,b)=>a-b); if(!vals.length)return [0,0,0,0,0]; const at=p=>vals[Math.min(vals.length-1,Math.floor(p*(vals.length-1)))]; return [vals[0],at(.25),at(.5),at(.75),vals[vals.length-1]]; }
  function base(type,height=330){ return { chart:{type,height,background:'#fff',animations:{enabled:false},toolbar:{show:true,tools:{download:false,selection:true,zoom:true,zoomin:true,zoomout:true,pan:true,reset:true}},fontFamily:'Inter, system-ui, Segoe UI, Arial, sans-serif'}, colors:['#356bd8','#20a886','#ef735f','#7a62d6','#d18a22'], dataLabels:{enabled:false}, grid:{borderColor:'#d8e2ec',strokeDashArray:3}, legend:{labels:{colors:'#101923'}}, tooltip:{theme:'light'}, xaxis:{labels:{style:{colors:'#23344a'}}}, yaxis:{labels:{style:{colors:'#23344a'},formatter:v=>fmt(v)}}, noData:{text:'No chart data',style:{color:'#101923'}} }; }
  function selector(kind){ const chosen=get(kind); return `<select data-final-chart-kind="${kind}" class="sg-no-help">${choices.map(([v,l])=>`<option value="${v}" ${v===chosen?'selected':''}>${html(l)}</option>`).join('')}</select>`; }
  function shell(kind,title,subtitle,payload){ const id='final-chart-'+(++seq); data.set(id,{kind,payload}); return `<div class="final-chart" data-final-chart="${id}"><div class="final-chart-toolbar sg-no-help"><div><b>${html(title)}</b><small>${html(subtitle)}</small></div><label>Chart style ${selector(kind)}</label></div><div class="final-chart-target"></div></div>`; }

  function optionsFromPoints(kind,payload){
    const type=get(kind), raw=down((payload.points||[]).map(p=>({x:Number(p.time??p.x??0),y:Number(p.dps??p.y??0)})),720), b=buckets(raw,14), peak=Math.max(1,...raw.map(p=>p.y));
    if(type==='pie'||type==='donut') return Object.assign(base(type),{labels:b.map(x=>x.label),series:b.map(x=>Math.round(x.sum)),yaxis:undefined});
    if(type==='polarArea') return Object.assign(base('polarArea'),{labels:b.map(x=>x.label),series:b.map(x=>Math.round(x.sum)),yaxis:undefined});
    if(type==='radialBar'||type==='gauge') return Object.assign(base('radialBar'),{labels:['Average vs peak','End vs peak'],series:[Math.round((sum(raw,x=>x.y)/Math.max(1,raw.length))/peak*100),Math.round((raw.at(-1)?.y||0)/peak*100)],plotOptions:{radialBar:{hollow:{size:type==='gauge'?'62%':'45%'},dataLabels:{value:{formatter:v=>v+'%'}}}},yaxis:undefined});
    if(type==='radar') return Object.assign(base('radar'),{labels:b.map(x=>x.label),series:[{name:'Bucket',data:b.map(x=>Math.round(x.value))}]});
    if(type==='treemap') return Object.assign(base('treemap'),{series:[{data:b.map(x=>({x:x.label,y:Math.round(x.sum)}))}]});
    if(type==='heatmap') return Object.assign(base('heatmap'),{series:[{name:'DPS',data:b.map(x=>({x:x.label,y:Math.round(x.value)}))}],plotOptions:{heatmap:{radius:0,shadeIntensity:.45}}});
    if(type==='candlestick') return Object.assign(base('candlestick'),{series:[{data:b.map(x=>({x:x.label,y:[x.values[0]||0,Math.max(...x.values,0),Math.min(...x.values,0),x.values.at(-1)||0].map(Math.round)}))}]});
    if(type==='boxplot'||type==='violin') return Object.assign(base('boxPlot'),{series:[{data:b.map(x=>({x:x.label,y:five(x.values).map(Math.round)}))}]});
    if(type==='rangeArea') return Object.assign(base('rangeArea'),{series:[{name:'Range',data:raw.map(p=>({x:p.x,y:[Math.round(p.y*.7),Math.round(p.y)]}))}],stroke:{curve:'smooth'}});
    if(type==='timeline') return Object.assign(base('rangeBar'),{plotOptions:{bar:{horizontal:true,rangeBarGroupRows:true}},xaxis:{type:'numeric',labels:{style:{colors:'#23344a'},formatter:v=>Math.round(v)+'s'}},series:[{name:'Active windows',data:raw.filter(p=>p.y>peak*.25).slice(0,60).map(p=>({x:'Activity',y:[p.x,p.x+3]}))}]});
    if(type==='bubble') return Object.assign(base('bubble'),{series:[{name:'DPS',data:raw.map(p=>({x:p.x,y:p.y,z:Math.max(4,p.y/peak*32)}))}],xaxis:{type:'numeric',labels:{style:{colors:'#23344a'},formatter:v=>Math.round(v)+'s'}}});
    if(type==='scatter') return Object.assign(base('scatter'),{series:[{name:'DPS',data:raw}],xaxis:{type:'numeric',labels:{style:{colors:'#23344a'},formatter:v=>Math.round(v)+'s'}}});
    if(type==='bar'||type==='column'||type==='funnel') return Object.assign(base('bar'),{plotOptions:{bar:{horizontal:type!=='column',isFunnel:type==='funnel'}},series:[{name:'Bucket',data:b.map(x=>({x:x.label,y:Math.round(x.value)}))}]});
    if(type==='slope') return Object.assign(base('line'),{series:[{name:'Start to end',data:raw.length?[raw[0],raw.at(-1)]:[]}],stroke:{curve:'straight',width:3}});
    if(type==='sparkline') return Object.assign(base('line',160),{chart:Object.assign(base('line',160).chart,{sparkline:{enabled:true},toolbar:{show:false}}),series:[{name:'DPS',data:raw}],stroke:{curve:'smooth',width:2}});
    if(type==='mixed'||type==='dashboard') return Object.assign(base('line'),{series:[{name:'Value',type:'column',data:raw},{name:'Trend',type:'line',data:down(raw,180)}],stroke:{width:[0,3],curve:'smooth'}});
    return Object.assign(base(type==='line'?'line':'area'),{series:[{name:'3s rolling value',data:raw}],stroke:{curve:'smooth',width:2},fill:{type:type==='area'?'gradient':'solid',gradient:{opacityFrom:.35,opacityTo:.05}},xaxis:{type:'numeric',labels:{style:{colors:'#23344a'},formatter:v=>Math.round(v)+'s'}},yaxis:{labels:{style:{colors:'#23344a'},formatter:v=>fmt(v)}}});
  }
  function optionsFromBreakdown(kind,payload){
    const type=get(kind), items=(payload.items||[]).slice(0,18).map(x=>({label:String(x.label||'Item'),value:Number(x.value||0)}));
    if(type==='pie'||type==='donut') return Object.assign(base(type),{labels:items.map(i=>i.label),series:items.map(i=>Math.round(i.value)),yaxis:undefined});
    if(type==='polarArea') return Object.assign(base('polarArea'),{labels:items.map(i=>i.label),series:items.map(i=>Math.round(i.value)),yaxis:undefined});
    if(type==='radialBar'||type==='gauge'){const max=Math.max(1,...items.map(i=>i.value));return Object.assign(base('radialBar'),{labels:items.slice(0,6).map(i=>i.label),series:items.slice(0,6).map(i=>Math.round(i.value/max*100)),yaxis:undefined});}
    if(type==='radar') return Object.assign(base('radar'),{labels:items.slice(0,10).map(i=>i.label),series:[{name:'Value',data:items.slice(0,10).map(i=>Math.round(i.value))}]});
    if(type==='treemap') return Object.assign(base('treemap'),{series:[{data:items.map(i=>({x:i.label,y:Math.round(i.value)}))}]});
    if(type==='heatmap') return Object.assign(base('heatmap'),{series:[{name:'Value',data:items.map(i=>({x:i.label,y:Math.round(i.value)}))}],plotOptions:{heatmap:{radius:0}}});
    if(type==='scatter'||type==='bubble') return Object.assign(base(type),{series:[{name:'Value',data:items.map((i,n)=>type==='bubble'?{x:n+1,y:i.value,z:Math.max(6,Math.sqrt(i.value)/900)}:{x:n+1,y:i.value})}],xaxis:{categories:items.map(i=>i.label),labels:{style:{colors:'#23344a'}}}});
    if(type==='timeline') return Object.assign(base('rangeBar'),{plotOptions:{bar:{horizontal:true}},series:[{data:items.map(i=>({x:i.label,y:[0,Math.round(i.value)]}))}]});
    if(type==='mixed'||type==='dashboard') return Object.assign(base('line'),{series:[{name:'Value',type:'column',data:items.map(i=>({x:i.label,y:Math.round(i.value)}))},{name:'Trend',type:'line',data:items.map(i=>({x:i.label,y:Math.round(i.value)}))}],stroke:{width:[0,3]}});
    return Object.assign(base('bar'),{plotOptions:{bar:{horizontal:type!=='column',isFunnel:type==='funnel'}},series:[{name:'Value',data:items.map(i=>({x:i.label,y:Math.round(i.value)}))}]});
  }
  function optionsFromActivation(kind,payload){
    const type=get(kind), powers=(payload.powers||[]).slice(0,24), start=payload.start||0, span=Math.max(1,payload.span||1), bins=80;
    if(type==='heatmap'){
      const series=powers.map(p=>{const vals=Array.from({length:bins},(_,i)=>({x:String(i+1),y:0}));(p.rows||[]).forEach(r=>{const idx=Math.max(0,Math.min(bins-1,Math.floor((r.time-start)/span*bins)));vals[idx].y += r.flags&&r.flags.has&&r.flags.has('Critical')?2:1;});return{name:p.power,data:vals};});
      return Object.assign(base('heatmap',Math.max(340,powers.length*23)),{chart:Object.assign(base('heatmap').chart,{height:Math.max(340,powers.length*23),toolbar:{show:false}}),series,plotOptions:{heatmap:{radius:0,shadeIntensity:.45,colorScale:{ranges:[{from:0,to:0,color:'#edf3f8',name:'None'},{from:1,to:2,color:'#6fa2ff',name:'Hit'},{from:3,to:999,color:'#ef735f',name:'Burst'}]}}},xaxis:{labels:{show:false},title:{text:'Start to end',style:{color:'#23344a'}}},yaxis:{labels:{style:{colors:'#101923',fontSize:'11px'}}}});
    }
    if(type==='timeline') return Object.assign(base('rangeBar',Math.max(340,powers.length*28)),{plotOptions:{bar:{horizontal:true,rangeBarGroupRows:true}},series:[{name:'Activations',data:powers.flatMap(p=>(p.rows||[]).slice(0,80).map(r=>({x:p.power,y:[Math.round(r.time-start),Math.round(r.time-start)+1]})))}],xaxis:{type:'numeric',labels:{style:{colors:'#23344a'},formatter:v=>Math.round(v)+'s'}}});
    return optionsFromBreakdown(kind,{items:powers.map(p=>({label:p.power,value:p.hits||(p.rows||[]).length||0}))});
  }
  function renderCharts(){
    if(!window.ApexCharts) return;
    document.querySelectorAll('.final-chart').forEach(el=>{ const id=el.dataset.finalChart, target=el.querySelector('.final-chart-target'), item=data.get(id); if(!id||!target||!item||charts.has(id))return; const opts=item.payload.mode==='activation'?optionsFromActivation(item.kind,item.payload):(item.payload.mode==='breakdown'?optionsFromBreakdown(item.kind,item.payload):optionsFromPoints(item.kind,item.payload)); const chart=new ApexCharts(target,opts); charts.set(id,chart); chart.render(); });
    Array.from(charts.entries()).forEach(([id,chart])=>{if(!document.querySelector(`[data-final-chart="${id}"]`)){try{chart.destroy()}catch(_){}charts.delete(id);data.delete(id);}});
  }
  function schedule(){ requestAnimationFrame(renderCharts); }

  function rolling(rows,pid){ const d=NWParser.validForPlayer(rows,pid).sort((a,b)=>a.time-b.time); if(!d.length)return[]; const out=[]; let left=0,right=0,damage=0; for(let t=Math.floor(d[0].time);t<=Math.ceil(d[d.length-1].time);t++){while(right<d.length&&d[right].time<=t){damage+=d[right].amount;right++;}while(left<right&&d[left].time<=t-3){damage-=d[left].amount;left++;}out.push({time:t,dps:damage/3});} return out; }
  function incoming(rows,pid){ const d=rows.filter(r=>r.targetId===pid&&r.damageType==='Physical'&&r.amount>0).sort((a,b)=>a.time-b.time); if(!d.length)return[]; const out=[]; let left=0,right=0,damage=0; for(let t=Math.floor(d[0].time);t<=Math.ceil(d[d.length-1].time);t++){while(right<d.length&&d[right].time<=t){damage+=d[right].amount;right++;}while(left<right&&d[left].time<=t-3){damage-=d[left].amount;left++;}out.push({time:t,dps:damage/3});} return out; }
  function cats(powers,total){return Array.from(group(powers,p=>p.category)).map(([label,rs])=>{const value=sum(rs,r=>r.damage);return{label,value,share:total?value/total*100:0};}).sort((a,b)=>b.value-a.value);}
  function overview(rows,pid,encs){const m=NWParser.metrics(rows,pid,encs), ps=NWParser.powers(rows,pid), h=sum(rows.filter(r=>r.ownerId===pid&&r.damageType==='HitPoints'&&r.amount<0),r=>Math.abs(r.amount)), taken=sum(rows.filter(r=>r.targetId===pid&&r.damageType==='Physical'&&r.amount>0),r=>r.amount), shield=sum(rows.filter(r=>r.targetId===pid&&r.damageType==='Shield'&&r.amount<0),r=>Math.abs(r.amount)), max=m.max; q('#content').innerHTML=(typeof playerHeader==='function'?playerHeader():'')+`<section class="panel"><h3>Overview</h3><div class="cards">${card('Total Damage',fmt(m.total))}${card('DPS',fmt(m.dps))}${card('Combat DPS',fmt(m.combatDps))}${card('Duration',dur(m.duration))}${card('In-Combat Time',dur(m.combatTime))}${card('Total Hits',Math.round(m.hits).toLocaleString())}${card('Crit Rate',pct(m.crit))}${card('Flank Rate',pct(m.flank))}${card('Max Hit '+(max?'('+html(max.powerName)+')':''),fmt(max?.amount||0))}${card('Encounters',encs.length)}${card('Healing Done',fmt(h))}${card('Damage Taken',fmt(taken))}${card('Shielded',fmt(shield))}</div><div class="grid2"><div>${shell('overview','Top damage powers','Switch this breakdown between every ApexCharts style.',{mode:'breakdown',items:ps.slice(0,12).map(p=>({label:p.power,value:p.damage}))})}</div><div>${shell('overview','Damage by category','Same data, different ApexCharts styles.',{mode:'breakdown',items:cats(ps,m.total)})}</div></div></section>`; schedule();}
  function timeline(rows,pid){ const ps=NWParser.powers(rows,pid); let filtered=ps; if(state.filter==='class')filtered=ps.filter(p=>['At-Will','Encounter','Daily','Feat','Class Feature'].includes(p.category)); if(state.filter==='proc')filtered=ps.filter(p=>['Item / Enchant','Mount','Other / Unknown'].includes(p.category)); if(state.filter==='pets')filtered=ps.filter(p=>p.category==='Pet / Companion'); const top=filtered.slice(0,18), all=NWParser.validForPlayer(rows,pid), start=all[0]?.time||0, end=all[all.length-1]?.time||start+1, span=Math.max(1,end-start); const freq=top.map(p=>{const first=p.rows[0]?.time||0,last=p.rows[p.rows.length-1]?.time||0;return{power:p.power,category:p.category,hits:p.hits,first:first-start,last:last-start,avgInterval:p.hits>1?(last-first)/(p.hits-1):0};}); const cdRows=top.filter(p=>CD[key(p.power)]).map(p=>{const cd=CD[key(p.power)], uses=p.hits, maxUses=Math.floor(span/cd)+1;return{power:p.power,category:p.category,cd:cd+'s',hits:uses,maxUses,eff:maxUses?uses/maxUses*100:0};}); q('#content').innerHTML=(typeof playerHeader==='function'?playerHeader():'')+`<section class="panel"><h3>Rotation timeline</h3>${shell('dps','DPS pace','Rolling 3-second damage. Choose Line, Area, Column, Heatmap, Timeline, Treemap, Donut, Radar and more.',{points:rolling(rows,pid)})}<div class="filterbar"><button class="${state.filter==='all'?'active':''}" data-filter="all">All</button><button class="${state.filter==='class'?'active':''}" data-filter="class">Class Powers</button><button class="${state.filter==='proc'?'active':''}" data-filter="proc">Procs & Items</button><button class="${state.filter==='pets'?'active':''}" data-filter="pets">Pets</button></div>${shell('activation','Power activations','This chart can also switch to every supported ApexCharts style.',{mode:'activation',powers:top,start,span})}<h3>Power Usage Frequency</h3>${tableSimple(freq,[['power','Power'],['category','Category'],['hits','Activations'],['first','First Use'],['last','Last Use'],['avgInterval','Avg Interval']])}<h3>Cooldown Efficiency</h3>${tableSimple(cdRows,[['power','Power'],['category','Type'],['cd','CD'],['hits','Uses'],['maxUses','Max'],['eff','Efficiency']])}</section>`; qa('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render();}); schedule(); }
  function deaths(rows,pid){ const list=typeof deathRows==='function'?deathRows(rows,pid):[]; q('#content').innerHTML=(typeof playerHeader==='function'?playerHeader():'')+`<section class="panel"><h3>Deaths - ${list.length} Total</h3>${shell('incoming','Incoming damage pace','Rolling 3-second incoming damage with all ApexCharts styles available.',{points:incoming(rows,pid)})}<h3>Death Log</h3>${list.map(d=>`<div class="deathCard"><small>${html(d.timestampRaw)}</small><br>Killed by <b>${html(d.ownerName)}</b> with <b>${html(d.powerName)}</b><br><span class="badge red">${fmt(d.amount)} ${html(d.damageType)}</span> ${d.flags.has('Critical')?'<span class="flag crit">CRIT</span>':''}</div>`).join('')||'<div class="empty">No deaths</div>'}</section>`; schedule(); }

  const previousRender = window.render;
  window.render = function(){
    if(typeof renderPlayers==='function')renderPlayers();
    if(typeof renderChips==='function')renderChips();
    qa('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
    if(!state.playerId){ q('#content').innerHTML='<section class="panel"><div class="empty">Upload a combat log</div></section>'; return; }
    const rows=typeof scopeRows==='function'?scopeRows():state.rows, pid=state.playerId, encs=typeof activeEncounters==='function'?activeEncounters():state.encounters;
    if(state.tab==='overview') return overview(rows,pid,encs);
    if(state.tab==='timeline') return timeline(rows,pid);
    if(state.tab==='deaths') return deaths(rows,pid);
    previousRender.apply(this,arguments); schedule();
  };
  document.addEventListener('change',e=>{const s=e.target.closest('[data-final-chart-kind]'); if(!s)return; set(s.dataset.finalChartKind,s.value); render();});
  const css = `.timelineBox{background:#fff!important;color:#101923!important;border:1px solid #d8e2ec!important}.timelineBox h3,.timelineBox text,.chart text{color:#101923!important;fill:#101923!important}.final-chart,.final-chart *{border-radius:0!important}.final-chart{background:#fff!important;color:#101923!important;border:1px solid #d8e2ec!important;padding:14px!important;margin:14px 0!important}.final-chart-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.final-chart-toolbar b{display:block;color:#101923!important;font-size:15px}.final-chart-toolbar small{display:block;color:#526174!important;font-size:12px}.final-chart-toolbar label{display:flex;align-items:center;gap:8px;color:#23344a!important;font-weight:900}.final-chart-toolbar select{min-width:220px;background:#fff!important;color:#101923!important;border:1px solid #b8c5d3!important}.final-chart-target{min-height:330px;background:#fff!important}.apexcharts-canvas,.apexcharts-svg{background:#fff!important}.apexcharts-text,.apexcharts-title-text,.apexcharts-legend-text,.apexcharts-xaxis-label,.apexcharts-yaxis-label{fill:#101923!important;color:#101923!important}.apexcharts-tooltip,.apexcharts-menu{color:#101923!important;background:#fff!important;border-color:#d8e2ec!important}.apexcharts-tooltip *,.apexcharts-menu *{color:#101923!important}.apexcharts-gridline{stroke:#d8e2ec!important}.filterbar{background:#fff!important;color:#101923!important}.filterbar button{background:#fff!important;color:#101923!important;border:1px solid #b8c5d3!important}.filterbar button.active{background:#0e1b27!important;color:#fff!important}@media(max-width:800px){.final-chart-toolbar{display:grid}.final-chart-toolbar select{width:100%}}`;
  const style=document.createElement('style'); style.textContent=css; document.head.appendChild(style);
})();
