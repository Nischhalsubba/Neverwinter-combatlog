(function(){
  const DETAIL_LIMIT_BYTES = 25 * 1024 * 1024;
  function txt(p){
    const phase = p.phase || 'parsing';
    const rows = Number(p.rows || 0).toLocaleString();
    const lines = Number(p.lines || 0).toLocaleString();
    const mb = p.bytes ? ' · ' + (p.bytes / 1048576).toFixed(1) + ' MB' : '';
    return phase + ' in worker · ' + rows + ' rows · ' + lines + ' lines' + mb;
  }
  function esc(s){return String(s||'').replace(/[&<>]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[m];});}
  function num(value){try{return window.fmt?window.fmt(value):Math.round(value||0).toLocaleString();}catch(_){return String(value||0);}}
  function time(value){try{return window.dur?window.dur(value):Math.round(value||0)+'s';}catch(_){return String(value||0)+'s';}}
  function row(player,index){
    return '<tr><td>'+(index+1)+'</td><td><b>'+esc(player.name)+'</b></td><td>'+num(player.damage)+'</td><td>'+num(player.combatDps)+'</td><td>'+Number(player.hits||0).toLocaleString()+'</td><td>'+Number(player.crit||0).toFixed(1)+'%</td><td>'+Number(player.flank||0).toFixed(1)+'%</td></tr>';
  }
  function powerRow(power){
    return '<tr><td><b>'+esc(power.power)+'</b></td><td>'+esc(power.category||'Unknown')+'</td><td>'+num(power.damage)+'</td><td>'+Number(power.share||0).toFixed(1)+'%</td><td>'+Number(power.hits||0).toLocaleString()+'</td></tr>';
  }
  function renderSummary(report,file,summaryOnly){
    const content = document.querySelector('#content');
    if(!content || !report) return;
    const top = report.preview && report.preview.topPlayer;
    const powers = top && top.powers ? top.powers.slice(0,10) : [];
    const encounters = report.preview && report.preview.visibleEncounters ? report.preview.visibleEncounters : [];
    const modeText = summaryOnly ? 'This log is very large, so Strikeglass is staying in fast report mode instead of loading every raw row into the page.' : 'Full detail is still hydrating. The first report is ready now.';
    content.innerHTML = '<section class="panel sg-fast-summary"><div class="sg-fast-head"><div><span class="eyebrow">Fast preview ready</span><h2>Summary is ready.</h2><p class="mut">'+modeText+'</p></div><div class="sg-fast-stat"><b>'+Number(report.rowCount||0).toLocaleString()+'</b><span>parsed rows</span></div></div><div class="cards">'+
      '<div class="card"><b>'+Number((report.players||[]).length).toLocaleString()+'</b><span>Players found</span></div>'+ 
      '<div class="card"><b>'+Number((report.encounters||[]).length).toLocaleString()+'</b><span>Fight windows</span></div>'+ 
      '<div class="card"><b>'+esc(top?top.name:'-')+'</b><span>Top damage preview</span></div>'+ 
      '<div class="card"><b>'+num(top?top.damage:0)+'</b><span>Top total damage</span></div>'+ 
      '<div class="card"><b>'+num(top?top.combatDps:0)+'</b><span>Top combat DPS</span></div>'+ 
      '<div class="card"><b>'+time(top?top.combatTime:0)+'</b><span>Top fighting time</span></div>'+ 
      '<div class="card"><b>'+Number(report.artiCall&&report.artiCall.callCount||0).toLocaleString()+'</b><span>Arti calls found</span></div>'+ 
      '</div><div class="grid2"><div><h3>Party preview</h3><div class="table"><table><thead><tr><th>#</th><th>Player</th><th>Damage</th><th>Combat DPS</th><th>Hits</th><th>Crit</th><th>Combat Adv.</th></tr></thead><tbody>'+(report.party||[]).slice(0,10).map(row).join('')+'</tbody></table></div></div><div><h3>Top powers preview</h3><div class="table"><table><thead><tr><th>Power</th><th>Type</th><th>Damage</th><th>Share</th><th>Hits</th></tr></thead><tbody>'+powers.map(powerRow).join('')+'</tbody></table></div></div></div><h3>Boss windows found</h3><div class="sg-enc-preview">'+(encounters.length?encounters.map(enc=>'<span><b>'+esc(enc.label)+'</b><small>'+time(enc.duration)+'</small></span>').join(''):'<p class="mut">No visible boss windows found yet.</p>')+'</div><p class="mut">File: '+esc(file && file.name ? file.name : 'combat log')+'</p></section>';
  }
  function parseWorker(file,onProgress,onSummary,summaryOnly){
    return new Promise(function(resolve,reject){
      if(!window.Worker)return reject(new Error('Worker not supported'));
      var worker=new Worker('src/workers/parse-worker.js');
      var finished=false;
      worker.onmessage=function(event){
        var msg=event.data||{};
        if(msg.type==='progress'&&onProgress)onProgress(msg.progress||{});
        if(msg.type==='summary'&&onSummary)onSummary(msg.report||null);
        if(msg.type==='done'){
          finished=true;
          worker.terminate();
          var rows=msg.rows||[];
          rows.meta=msg.meta||{};
          resolve(rows);
        }
        if(msg.type==='error'){
          finished=true;
          worker.terminate();
          reject(new Error(msg.message||'Worker parse failed'));
        }
      };
      worker.onerror=function(event){if(!finished){worker.terminate();reject(new Error(event.message||'Worker parse failed'));}};
      worker.postMessage({type:'parse',file:file,summaryOnly:!!summaryOnly});
    });
  }
  async function parseSmart(file,onProgress,onSummary,summaryOnly){
    if(file&&file.size>2097152&&window.Worker){
      try{return await parseWorker(file,onProgress,onSummary,summaryOnly);}catch(e){console.warn('worker parse fallback',e);}
    }
    const rows = await NWParser.parseFile(file,{onProgress:onProgress});
    if(window.SGSummaryEngine && onSummary){
      const report = window.SGSummaryEngine.buildReport(rows,{includeCompanions:true});
      if(window.SGArtifactWindow) report.artiCall = window.SGArtifactWindow.analyze(rows, report.players || []);
      onSummary(report);
    }
    return rows;
  }
  async function load(file){
    var status=document.querySelector('#status');
    var content=document.querySelector('#content');
    var summaryOnly = !!(file && file.size > DETAIL_LIMIT_BYTES);
    try{
      if(!file)return;
      status.textContent='Opening '+file.name+'...';
      state.rows=[];
      state.players=[];
      state.encounters=[];
      state.playerId=null;
      state.encounterId='all';
      state.rawPower=null;
      state.fastReport=null;
      state.artiReport=null;
      state.summaryOnly=false;
      content.innerHTML='<section class="panel"><h2>Parsing combat log</h2><p class="mut">Large files parse in a worker first. Huge files stay in fast report mode so the browser does not freeze.</p></section>';
      state.rows=await parseSmart(file,function(p){status.textContent=txt(p);},function(report){
        state.fastReport=report;
        state.artiReport=report && report.artiCall ? report.artiCall : null;
        status.textContent=summaryOnly?'Fast report ready · raw rows skipped for speed.':'Fast summary ready · hydrating full details...';
        renderSummary(report,file,summaryOnly);
      },summaryOnly);
      if(state.rows.meta && state.rows.meta.summaryOnly){
        state.summaryOnly=true;
        state.players=(state.fastReport&&state.fastReport.players)||[];
        state.playerId=state.fastReport&&state.fastReport.defaultPlayerId;
        status.textContent='Fast report mode: parsed '+Number(state.rows.meta.rowCount||state.fastReport?.rowCount||0).toLocaleString()+' rows without loading raw rows into the page.';
        return;
      }
      if(!state.rows.length)throw new Error('No valid combat rows found.');
      state.fastReport=null;
      state.players=NWParser.detectPlayers(state.rows);
      if(!state.players.length)throw new Error('Rows parsed, but no player-owned combat data was found.');
      state.playerId=state.players[0].id;
      state.encounterId='all';
      state.rawPower=null;
      state.showHidden=false;
      state.filter='all';
      rebuildEncounters();
      var skipped=state.rows.meta&&state.rows.meta.skipped?' · skipped '+state.rows.meta.skipped.toLocaleString()+' noisy lines':'';
      var lines=state.rows.meta&&state.rows.meta.lines?state.rows.meta.lines:state.rows.length;
      status.textContent='Parsed '+state.rows.length.toLocaleString()+' rows from '+lines.toLocaleString()+' lines'+skipped+'.';
      render();
    }catch(e){
      console.error(e);
      status.textContent='Parser error';
      content.innerHTML='<section class="panel"><h2>Parser error</h2><p class="mut">'+esc(e.message||e)+'</p></section>';
    }
  }
  function install(){var input=document.getElementById('file');if(input){input.onchange=function(){load(input.files&&input.files[0]);};window.StrikeglassParseFile=load;}}
  const css='.sg-fast-summary,.sg-fast-summary *{border-radius:0!important}.sg-fast-head{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:18px;align-items:start}.sg-fast-stat{border:1px solid #d8e2ec;background:#f5f8fb;padding:14px}.sg-fast-stat b{display:block;font-size:26px}.sg-fast-stat span{font-size:11px;text-transform:uppercase;font-weight:900;color:#526174}.sg-enc-preview{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px}.sg-enc-preview span{display:grid;border:1px solid #d8e2ec;background:#fff;padding:8px 10px;min-width:160px}.sg-enc-preview small{color:#526174;font-weight:800}@media(max-width:800px){.sg-fast-head{grid-template-columns:1fr}}';
  if(!document.getElementById('sg-worker-controller-style')){var st=document.createElement('style');st.id='sg-worker-controller-style';st.textContent=css;document.head.appendChild(st);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
