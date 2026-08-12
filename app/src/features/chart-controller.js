(function(){
  const SG = window.SG || {};
  const storeKey='strikeglass.chart.type.v1';
  const activationKey='strikeglass.activation.chart.v1';
  const charts=new Map();
  const dataStore=new Map();
  let chartSeq=0;
  let chartType=localStorage.getItem(storeKey)||'area';
  let activationMode=localStorage.getItem(activationKey)||'heatmap';

  function fmt(v){try{return window.fmt?window.fmt(v):String(Math.round(v||0).toLocaleString())}catch(e){return String(v||0)}}
  function esc(s){return SG.escape?SG.escape(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function downsample(data,maxPoints){
    if(!Array.isArray(data)||data.length<=maxPoints)return data||[];
    const bucket=Math.ceil(data.length/maxPoints), out=[];
    for(let i=0;i<data.length;i+=bucket){
      let peak=data[i], sum=0, count=0;
      for(let j=i;j<Math.min(data.length,i+bucket);j++){sum+=data[j].dps||0;count++;if((data[j].dps||0)>(peak.dps||0))peak=data[j];}
      out.push({time:peak.time,dps:Math.max(peak.dps||0,sum/Math.max(1,count))});
    }
    return out;
  }

  function fallbackSvg(data){
    if(!data.length)return'<div class="empty">No chart data</div>';
    const w=1200,h=260,p=32,max=Math.max(...data.map(d=>d.dps),1);
    const pts=data.map((d,i)=>`${p+i/Math.max(1,data.length-1)*(w-p*2)},${h-p-d.dps/max*(h-p*2)}`).join(' ');
    return `<svg class="chart sg-fallback-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><rect x="0" y="0" width="${w}" height="${h}" fill="#fff"></rect><polyline fill="none" stroke="#356bd8" stroke-width="2" points="${pts}"></polyline><text x="${p}" y="24" fill="#101923">Peak 3s DPS: ${fmt(max)}</text></svg>`;
  }

  function chartSvg(data){
    const sampled=downsample(data,640);
    const id='sg-apex-'+(++chartSeq);
    dataStore.set(id,sampled);
    const peak=Math.max(0,...sampled.map(d=>d.dps||0));
    return `<div class="sg-chart-shell" data-chart-id="${id}"><div class="sg-chart-toolbar sg-no-help"><div><b>Rolling DPS chart</b><small>Peak 3s DPS: ${esc(fmt(peak))} · ${sampled.length.toLocaleString()} plotted points</small></div><label>Chart type <select data-sg-chart-type><option value="area" ${chartType==='area'?'selected':''}>Area</option><option value="line" ${chartType==='line'?'selected':''}>Line</option><option value="bar" ${chartType==='bar'?'selected':''}>Column</option><option value="scatter" ${chartType==='scatter'?'selected':''}>Scatter</option></select></label></div><div class="sg-apex-target"></div><noscript>${fallbackSvg(sampled)}</noscript></div>`;
  }

  function optionsFor(data){
    const seriesData=data.map(p=>({x:Number(p.time||0),y:Math.round(p.dps||0)}));
    const isBar=chartType==='bar';
    const type=chartType==='scatter'?'scatter':isBar?'bar':chartType==='line'?'line':'area';
    return {
      chart:{type,height:280,animations:{enabled:data.length<450},toolbar:{show:true,tools:{download:false,selection:true,zoom:true,zoomin:true,zoomout:true,pan:true,reset:true}},background:'#ffffff',fontFamily:'Inter, system-ui, Segoe UI, Arial, sans-serif'},
      series:[{name:'3s rolling DPS',data:seriesData}],
      stroke:{curve:'smooth',width:type==='line'||type==='area'?2:0},
      fill:{type:type==='area'?'gradient':'solid',gradient:{shadeIntensity:.25,opacityFrom:.35,opacityTo:.04,stops:[0,95,100]}},
      colors:['#356bd8'],
      dataLabels:{enabled:false},
      markers:{size:type==='scatter'?3:0},
      grid:{borderColor:'#d8e2ec',strokeDashArray:3,padding:{left:12,right:18}},
      xaxis:{type:'numeric',tickAmount:8,labels:{style:{colors:'#42536a'},formatter:v=>Math.round(v)+'s'},title:{text:'Fight time',style:{color:'#42536a',fontWeight:800}}},
      yaxis:{labels:{style:{colors:'#42536a'},formatter:v=>fmt(v)},title:{text:'DPS',style:{color:'#42536a',fontWeight:800}}},
      tooltip:{theme:'light',x:{formatter:v=>Math.round(v)+'s'},y:{formatter:v=>fmt(v)+' DPS'}},
      noData:{text:'No DPS data'}
    };
  }

  function renderApexCharts(){
    if(!window.ApexCharts)return;
    document.querySelectorAll('.sg-chart-shell').forEach(shell=>{
      const id=shell.dataset.chartId;
      const target=shell.querySelector('.sg-apex-target');
      if(!id||!target||charts.has(id))return;
      const data=dataStore.get(id)||[];
      const chart=new ApexCharts(target,optionsFor(data));
      charts.set(id,chart);
      chart.render();
    });
    for(const [id,chart] of Array.from(charts.entries())){
      if(!document.querySelector(`[data-chart-id="${id}"]`)){try{chart.destroy()}catch(e){}charts.delete(id);dataStore.delete(id)}
    }
  }

  function renderActivationHeatmap(){
    if(!window.ApexCharts||activationMode!=='heatmap')return;
    document.querySelectorAll('.activationRows:not([data-apexified])').forEach(box=>{
      const rows=[...box.querySelectorAll('.actRow')].slice(0,24);
      if(!rows.length)return;
      const bins=80;
      const series=rows.map(row=>{
        const label=(row.querySelector('b')?.textContent||'Power').trim();
        const values=Array.from({length:bins},(_,i)=>({x:String(i+1),y:0}));
        row.querySelectorAll('.tick').forEach(tick=>{
          const left=parseFloat((tick.getAttribute('style')||'').match(/left:([0-9.]+)/)?.[1]||'0');
          const idx=Math.max(0,Math.min(bins-1,Math.floor(left/100*bins)));
          values[idx].y += tick.classList.contains('crit')?2:1;
        });
        return {name:label,data:values};
      });
      box.dataset.apexified='1';
      box.innerHTML=`<div class="sg-chart-toolbar sg-no-help"><div><b>Power activation heatmap</b><small>Blue intensity shows activity density across fight time. Critical hits count heavier.</small></div><label>Activation view <select data-sg-activation-mode><option value="heatmap" selected>Heatmap</option><option value="legacy">Legacy rows</option></select></label></div><div class="sg-activation-chart"></div>`;
      const chart=new ApexCharts(box.querySelector('.sg-activation-chart'),{
        chart:{type:'heatmap',height:Math.max(320,rows.length*22),animations:{enabled:false},toolbar:{show:false},fontFamily:'Inter, system-ui, Segoe UI, Arial, sans-serif'},
        series,
        dataLabels:{enabled:false},
        colors:['#356bd8'],
        plotOptions:{heatmap:{shadeIntensity:.45,radius:0,colorScale:{ranges:[{from:0,to:0,color:'#e8eef5',name:'None'},{from:1,to:2,color:'#6fa2ff',name:'Hit'},{from:3,to:999,color:'#ef735f',name:'Burst'}]}}},
        xaxis:{labels:{show:false},title:{text:'Start → End',style:{color:'#42536a'}}},
        yaxis:{labels:{style:{colors:'#101923',fontSize:'11px'}}},
        tooltip:{theme:'light',y:{formatter:v=>v+' weighted hits'}}
      });
      chart.render();
    });
  }

  function renderAll(){requestAnimationFrame(()=>{renderApexCharts();renderActivationHeatmap();});}

  document.addEventListener('change',event=>{
    const chartSelect=event.target.closest('[data-sg-chart-type]');
    if(chartSelect){chartType=chartSelect.value;localStorage.setItem(storeKey,chartType);if(typeof render==='function')render();return;}
    const activationSelect=event.target.closest('[data-sg-activation-mode]');
    if(activationSelect){activationMode=activationSelect.value;localStorage.setItem(activationKey,activationMode);if(typeof render==='function')render();}
  });

  const css='.sg-chart-shell,.sg-chart-shell *{border-radius:0!important}.sg-chart-shell{background:#fff;border:1px solid #d8e2ec;padding:12px}.sg-chart-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.sg-chart-toolbar b{display:block;color:#101923}.sg-chart-toolbar small{display:block;color:#5f6e7e}.sg-apex-target,.sg-activation-chart{min-height:280px}.apexcharts-text,.apexcharts-title-text,.apexcharts-legend-text{fill:#101923!important;color:#101923!important}.apexcharts-tooltip{color:#101923!important}.activationRows[data-apexified]{background:#fff!important;border:1px solid #d8e2ec!important;padding:12px!important}.sg-fallback-chart text{font-weight:800}@media(max-width:760px){.sg-chart-toolbar{display:grid}.sg-apex-target{min-height:220px}}';
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  window.chartSvg=chartSvg;
  const oldRender=window.render;
  if(typeof oldRender==='function')window.render=function(){oldRender();renderAll();};
  const mo=new MutationObserver(renderAll);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mo.observe(document.body,{childList:true,subtree:true});renderAll();});
  else{mo.observe(document.body,{childList:true,subtree:true});renderAll();}
})();
