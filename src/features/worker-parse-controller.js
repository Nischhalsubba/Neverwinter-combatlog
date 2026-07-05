(function(){
  const FAST_MODE = true;
  let activeWorker = null;
  let requestSeq = 0;
  let renderSeq = 0;
  let lastProgressRender = 0;
  const pendingArtifact = new Map();
  const pendingPlayer = new Map();

  function esc(s){return String(s||'').replace(/[&<>]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[m];});}
  function num(value){try{return window.fmt?window.fmt(value):Math.round(value||0).toLocaleString();}catch(_){return String(value||0);}}
  function time(value){try{return window.dur?window.dur(value):Math.round(value||0)+'s';}catch(_){return String(value||0)+'s';}}
  function pct(value){return (Number(value)||0).toFixed(1)+'%';}
  function progressPercent(p){
    const total = Number(p && (p.total || p.totalBytes) || 0);
    const bytes = Number(p && p.bytes || 0);
    if(total > 0) return Math.max(0, Math.min(100, bytes / total * 100));
    if(p && p.phase === 'building summary') return 92;
    return 8;
  }
  function txt(p){
    const phase = p.phase || 'reading log';
    const rows = Number(p.rows || 0).toLocaleString();
    const lines = Number(p.lines || 0).toLocaleString();
    const total = Number(p.total || p.totalBytes || 0);
    const bytes = Number(p.bytes || 0);
    const mb = total ? ' · ' + (bytes / 1048576).toFixed(1) + ' / ' + (total / 1048576).toFixed(1) + ' MB' : (bytes ? ' · ' + (bytes / 1048576).toFixed(1) + ' MB' : '');
    return phase + ' · ' + progressPercent(p).toFixed(0) + '% · ' + rows + ' rows · ' + lines + ' lines' + mb;
  }
  function row(player,index){
    return '<tr><td>'+(index+1)+'</td><td><b>'+esc(player.name)+'</b></td><td>'+num(player.damage)+'</td><td>'+num(player.combatDps)+'</td><td>'+Number(player.hits||0).toLocaleString()+'</td><td>'+Number(player.crit||0).toFixed(1)+'%</td><td>'+Number(player.flank||0).toFixed(1)+'%</td></tr>';
  }
  function powerRow(power){
    return '<tr><td><b>'+esc(power.power)+'</b></td><td>'+esc(power.category||'Unknown')+'</td><td>'+num(power.damage)+'</td><td>'+Number(power.share||0).toFixed(1)+'%</td><td>'+Number(power.hits||0).toLocaleString()+'</td></tr>';
  }
  function skeletonRows(count, cols){
    return Array.from({length:count}).map(() => '<tr>'+Array.from({length:cols}).map(() => '<td><span class="sg-skel-line"></span></td>').join('')+'</tr>').join('');
  }
  function renderSkeleton(file, progress){
    const content = document.querySelector('#content');
    const party = document.querySelector('#party');
    const chips = document.querySelector('#chips');
    const percent = progressPercent(progress || {});
    const phase = (progress && progress.phase) || 'reading log';
    if(chips) chips.innerHTML = '<span class="sg-skel-chip"></span><span class="sg-skel-chip wide"></span><span class="sg-skel-chip"></span>';
    if(party) party.innerHTML = '<section class="panel sg-skeleton-panel"><h3>Party Overview</h3><div class="table"><table><thead><tr><th>#</th><th>Player</th><th>Class</th><th>Damage</th><th>DPS</th><th>Hits</th></tr></thead><tbody>'+skeletonRows(6,6)+'</tbody></table></div></section>';
    if(content) content.innerHTML = '<section class="panel sg-loading-shell"><div class="sg-load-head"><div><span class="eyebrow">Parsing in background</span><h2>Building a fast report first</h2><p class="mut">The log stays inside a Web Worker. The page only asks for the data the current screen needs, so it should stay clickable instead of turning into browser soup.</p></div><b>'+percent.toFixed(0)+'%</b></div><div class="sg-progress"><i style="width:'+percent.toFixed(1)+'%"></i></div><div class="sg-load-meta"><span>'+esc(phase)+'</span><span>'+esc(file && file.name ? file.name : 'combat log')+'</span></div><div class="cards sg-card-skeleton"><div class="card"><b class="sg-skel-block"></b><span></span></div><div class="card"><b class="sg-skel-block"></b><span></span></div><div class="card"><b class="sg-skel-block"></b><span></span></div><div class="card"><b class="sg-skel-block"></b><span></span></div></div><div class="grid2"><div class="sg-skel-box"></div><div class="sg-skel-box"></div></div></section>';
  }
  function throttledSkeleton(file, progress){
    const now = performance && performance.now ? performance.now() : Date.now();
    if(now - lastProgressRender < 120 && progress && progress.phase !== 'building summary') return;
    lastProgressRender = now;
    renderSkeleton(file, progress || {});
  }
  function table(rows, cols){
    return '<div class="table"><table><thead><tr>'+cols.map(col => '<th>'+esc(col[1])+'</th>').join('')+'</tr></thead><tbody>'+(rows && rows.length ? rows.map(r => '<tr>'+cols.map(col => '<td>'+cell(r[col[0]], col[0])+'</td>').join('')+'</tr>').join('') : '<tr><td class="empty" colspan="'+cols.length+'">No rows</td></tr>')+'</tbody></table></div>';
  }
  function cell(value, key){
    if(value == null) return '-';
    if(['damage','dps','combatDps','avg','max','healingDone','healingReceived','damageTaken','shielded'].includes(key)) return num(value);
    if(['share','crit','flank'].includes(key)) return pct(value);
    if(['duration','combatTime'].includes(key)) return time(value);
    if(['hits'].includes(key)) return Number(value || 0).toLocaleString();
    return esc(value);
  }
  function disposeWorker(){
    if(activeWorker){ try { activeWorker.postMessage({type:'dispose'}); } catch (_) { try { activeWorker.terminate(); } catch (__) {} } }
    activeWorker = null;
    pendingArtifact.clear();
    pendingPlayer.clear();
  }
  function renderPlayersFromReport(report){
    const select = document.querySelector('#player');
    if(select){
      const players = report && report.party && report.party.length ? report.party : (report.players || []);
      select.innerHTML = players.map(player => '<option value="'+esc(player.id)+'" '+(player.id===state.playerId?'selected':'')+'>'+esc(player.name)+'</option>').join('');
    }
    const party = document.querySelector('#party');
    if(party){
      const rows = (report.party || []).slice(0, 80).map((player,index) => ({ rank:index+1, name:player.name, damage:player.damage, dps:player.dps, combatDps:player.combatDps, hits:player.hits, duration:player.duration }));
      party.innerHTML = '<section class="panel"><h3>Party Overview</h3>'+table(rows,[['rank','#'],['name','Player'],['damage','Damage'],['dps','DPS'],['combatDps','Combat DPS'],['hits','Hits'],['duration','Duration']])+'</section>';
    }
  }
  function renderChipsFromReport(report){
    const chips = document.querySelector('#chips');
    if(!chips) return;
    const list = (report.preview && report.preview.visibleEncounters ? report.preview.visibleEncounters : report.encounters || []).slice(0, 16);
    chips.innerHTML = '<button class="chip '+(state.encounterId==='all'?'active':'')+'" data-fast-e="all">All encounters</button>' + list.map(enc => '<button class="chip '+esc(enc.type||'')+' '+(String(enc.id)===String(state.encounterId)?'active':'')+'" data-fast-e="'+esc(enc.id)+'">'+esc(enc.type==='boss'?'Boss':'Mob')+' #'+esc(enc.id)+' '+esc(enc.label)+' <span class="mut">'+time(enc.duration)+'</span></button>').join('');
    Array.from(chips.querySelectorAll('[data-fast-e]')).forEach(button => button.onclick = function(){ state.encounterId = button.dataset.fastE || 'all'; state.rawPower = null; render(); });
  }
  function renderSummary(report,file,summaryOnly){
    const content = document.querySelector('#content');
    if(!content || !report) return;
    const top = report.preview && report.preview.topPlayer;
    const powers = top && top.powers ? top.powers.slice(0,10) : [];
    const encounters = report.preview && report.preview.visibleEncounters ? report.preview.visibleEncounters : [];
    const modeText = 'The full log is parsed in the worker, but raw rows are not loaded into the page. Screens request small reports when you click them.';
    content.innerHTML = '<section class="panel sg-fast-summary"><div class="sg-fast-head"><div><span class="eyebrow">Fast preview ready</span><h2>Summary is ready.</h2><p class="mut">'+modeText+'</p></div><div class="sg-fast-stat"><b>'+Number(report.rowCount||0).toLocaleString()+'</b><span>parsed rows</span></div></div><div class="cards">'+
      '<div class="card"><b>'+Number((report.players||[]).length).toLocaleString()+'</b><span>Players found</span></div>'+ 
      '<div class="card"><b>'+Number((report.encounters||[]).length).toLocaleString()+'</b><span>Fight windows</span></div>'+ 
      '<div class="card"><b>'+esc(top?top.name:'-')+'</b><span>Top damage preview</span></div>'+ 
      '<div class="card"><b>'+num(top?top.damage:0)+'</b><span>Top total damage</span></div>'+ 
      '<div class="card"><b>'+num(top?top.combatDps:0)+'</b><span>Top combat DPS</span></div>'+ 
      '<div class="card"><b>'+time(top?top.combatTime:0)+'</b><span>Top fighting time</span></div>'+ 
      '</div><div class="grid2"><div><h3>Party preview</h3><div class="table"><table><thead><tr><th>#</th><th>Player</th><th>Damage</th><th>Combat DPS</th><th>Hits</th><th>Crit</th><th>Combat Adv.</th></tr></thead><tbody>'+(report.party||[]).slice(0,10).map(row).join('')+'</tbody></table></div></div><div><h3>Top powers preview</h3><div class="table"><table><thead><tr><th>Power</th><th>Type</th><th>Damage</th><th>Share</th><th>Hits</th></tr></thead><tbody>'+powers.map(powerRow).join('')+'</tbody></table></div></div></div><h3>Boss windows found</h3><div class="sg-enc-preview">'+(encounters.length?encounters.map(enc=>'<span><b>'+esc(enc.label)+'</b><small>'+time(enc.duration)+'</small></span>').join(''):'<p class="mut">No visible boss windows found yet.</p>')+'</div><p class="mut">File: '+esc(file && file.name ? file.name : 'combat log')+'</p></section>';
  }
  function handleWorkerMessage(worker,event,onProgress,onSummary,resolve,reject,summaryOnly){
    var msg=event.data||{};
    if(msg.type==='progress'&&onProgress)onProgress(msg.progress||{});
    if(msg.type==='summary'&&onSummary)onSummary(msg.report||null);
    if(msg.type==='artifact'){
      const pending = pendingArtifact.get(msg.requestId);
      if(pending){ pending.resolve(msg.report); pendingArtifact.delete(msg.requestId); }
    }
    if(msg.type==='artifact-error'){
      const pending = pendingArtifact.get(msg.requestId);
      if(pending){ pending.reject(new Error(msg.message || 'Artifact recompute failed')); pendingArtifact.delete(msg.requestId); }
    }
    if(msg.type==='player-report'){
      const pending = pendingPlayer.get(msg.requestId);
      if(pending){ pending.resolve(msg.report); pendingPlayer.delete(msg.requestId); }
    }
    if(msg.type==='player-report-error'){
      const pending = pendingPlayer.get(msg.requestId);
      if(pending){ pending.reject(new Error(msg.message || 'Screen report failed')); pendingPlayer.delete(msg.requestId); }
    }
    if(msg.type==='done'){
      var rows=msg.rows||[];
      rows.meta=msg.meta||{};
      activeWorker = worker;
      resolve(rows);
    }
    if(msg.type==='error'){
      try { worker.terminate(); } catch (_) {}
      if(activeWorker===worker) activeWorker=null;
      reject(new Error(msg.message||'Worker parse failed'));
    }
  }
  function parseWorker(file,onProgress,onSummary,summaryOnly){
    return new Promise(function(resolve,reject){
      if(!window.Worker)return reject(new Error('Worker not supported'));
      if(activeWorker) disposeWorker();
      var worker=new Worker('src/workers/parse-worker.js');
      worker.onmessage=function(event){ handleWorkerMessage(worker,event,onProgress,onSummary,resolve,reject,summaryOnly); };
      worker.onerror=function(event){ try { worker.terminate(); } catch (_) {} reject(new Error(event.message||'Worker parse failed')); };
      worker.postMessage({type:'parse',file:file,summaryOnly:true});
    });
  }
  window.StrikeglassRequestArtiCall = function(options){
    return new Promise(function(resolve,reject){
      if(!activeWorker) return reject(new Error('No active worker report.'));
      const id = ++requestSeq;
      pendingArtifact.set(id,{resolve,reject});
      activeWorker.postMessage({type:'artifact', requestId:id, options:options || {}});
    });
  };
  window.StrikeglassRequestPlayerReport = function(options){
    return new Promise(function(resolve,reject){
      if(!activeWorker) return reject(new Error('No active worker report.'));
      const id = ++requestSeq;
      pendingPlayer.set(id,{resolve,reject});
      activeWorker.postMessage({type:'player-report', requestId:id, options:options || {}});
    });
  };
  async function parseSmart(file,onProgress,onSummary,summaryOnly){
    if(window.Worker){
      try{return await parseWorker(file,onProgress,onSummary,true);}catch(e){console.warn('worker parse fallback',e);}
    }
    const rows = await NWParser.parseFile(file,{onProgress:onProgress});
    if(window.SGSummaryEngine && onSummary){
      const report = window.SGSummaryEngine.buildReport(rows,{includeCompanions:true});
      onSummary(report);
    }
    return rows;
  }
  function renderFastLoading(label){
    const content = document.querySelector('#content');
    if(content) content.innerHTML = '<section class="panel sg-loading-shell"><h2>'+esc(label || 'Loading screen report')+'</h2><div class="sg-progress indeterminate"><i></i></div><div class="cards sg-card-skeleton"><div class="card"><b class="sg-skel-block"></b></div><div class="card"><b class="sg-skel-block"></b></div><div class="card"><b class="sg-skel-block"></b></div></div><div class="sg-skel-box"></div></section>';
  }
  function renderPlayerOverview(report){
    const p = report && report.player;
    if(!p){ document.querySelector('#content').innerHTML = '<section class="panel"><div class="empty">No player report found.</div></section>'; return; }
    const max = p.max || {};
    const cards = [
      ['Total Damage', num(p.damage)], ['DPS', num(p.dps)], ['Combat DPS', num(p.combatDps)], ['Duration', time(p.duration)], ['In-combat time', time(p.combatTime)], ['Total hits', Number(p.hits||0).toLocaleString()], ['Crit rate', pct(p.crit)], ['Flank rate', pct(p.flank)], ['Max hit '+(max.powerName?'('+esc(max.powerName)+')':''), num(max.amount||0)], ['Healing done', num(p.healingDone)], ['Damage taken', num(p.damageTaken)], ['Shielded', num(p.shielded)]
    ].map(item => '<div class="card"><b>'+item[1]+'</b><span>'+item[0]+'</span></div>').join('');
    const powers = (p.powers || []).slice(0, 12);
    const cats = (p.categories || []).slice(0, 10);
    document.querySelector('#content').innerHTML = '<section class="panel"><h3>'+esc(p.name)+' summary</h3><p class="mut">This screen is loaded from the worker. The page receives only the summary needed here, not the whole log.</p><div class="cards">'+cards+'</div><div class="grid2"><div><h3>Top powers</h3>'+table(powers,[['power','Power'],['category','Type'],['damage','Damage'],['share','%'],['hits','Hits'],['avg','Avg'],['max','Max'],['crit','Crit %']])+'</div><div><h3>Damage by category</h3>'+table(cats,[['category','Category'],['damage','Damage'],['share','%']])+'</div></div></section>';
  }
  function renderPlayerDamage(report){
    const p = report && report.player;
    const powers = p && p.powers ? p.powers : [];
    document.querySelector('#content').innerHTML = '<section class="panel"><h3>Power Damage - '+powers.length+' powers</h3><p class="mut">Loaded on demand from the worker for the selected player and fight.</p>'+table(powers,[['power','Power'],['category','Category'],['hits','Hits'],['damage','Damage'],['share','%'],['avg','Avg damage'],['max','Highest hit'],['crit','Crit rate']])+'</section>';
  }
  function renderTotalsOnly(report, title){
    const p = report && report.player;
    if(!p){ document.querySelector('#content').innerHTML = '<section class="panel"><div class="empty">No data.</div></section>'; return; }
    document.querySelector('#content').innerHTML = '<section class="panel"><h3>'+esc(title)+'</h3><p class="mut">Fast mode keeps the giant raw hit list in the worker. This screen currently loads totals first instead of dragging every combat row into the page.</p><div class="cards"><div class="card"><b>'+num(p.healingDone)+'</b><span>Healing done</span></div><div class="card"><b>'+num(p.healingReceived)+'</b><span>Healing received</span></div><div class="card"><b>'+num(p.damageTaken)+'</b><span>Damage taken</span></div><div class="card"><b>'+num(p.shielded)+'</b><span>Shielded</span></div><div class="card"><b>'+num(p.companionDamage)+'</b><span>Companion damage</span></div></div></section>';
  }
  function renderFastTab(){
    const report = state.fastReport;
    if(!report) return false;
    renderPlayersFromReport(report);
    renderChipsFromReport(report);
    Array.from(document.querySelectorAll('#tabs button')).forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
    if(state.tab === 'formulas'){
      if(typeof renderFormulas === 'function') renderFormulas();
      return true;
    }
    if(['timeline','timing','pos','deaths','other'].includes(state.tab)){
      document.querySelector('#content').innerHTML = '<section class="panel"><h3>'+esc(state.tab)+'</h3><p class="mut">This tab needs raw event lists. Raw rows are kept in the worker so the browser stays responsive. A screen-specific worker report can be added here next without loading the whole log into the page.</p></section>';
      return true;
    }
    const seq = ++renderSeq;
    renderFastLoading('Loading '+state.tab+' from worker');
    window.StrikeglassRequestPlayerReport({ playerId: state.playerId, encounterId: state.encounterId, mode: state.split, includeCompanions: true }).then(function(screenReport){
      if(seq !== renderSeq) return;
      if(state.tab === 'damage') renderPlayerDamage(screenReport);
      else if(['healing','taken','shield'].includes(state.tab)) renderTotalsOnly(screenReport, state.tab === 'healing' ? 'Healing' : state.tab === 'taken' ? 'Survival' : 'Shielding');
      else renderPlayerOverview(screenReport);
    }).catch(function(error){
      if(seq !== renderSeq) return;
      document.querySelector('#content').innerHTML = '<section class="panel"><h2>Screen report error</h2><p class="mut">'+esc(error.message || error)+'</p></section>';
    });
    return true;
  }
  const originalRender = window.render;
  window.render = function(){
    if(state && state.summaryOnly && state.fastReport && state.tab !== 'arti') return renderFastTab();
    return originalRender.apply(this, arguments);
  };
  async function load(file){
    var status=document.querySelector('#status');
    var content=document.querySelector('#content');
    try{
      if(!file)return;
      disposeWorker();
      lastProgressRender = 0;
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
      renderSkeleton(file,{phase:'preparing worker',bytes:0,total:file.size});
      state.rows=await parseSmart(file,function(p){status.textContent=txt(p);throttledSkeleton(file,p);},function(report){
        state.fastReport=report;
        state.artiReport=report && report.artiCall ? report.artiCall : null;
        status.textContent='Fast summary ready · keeping raw rows in worker for speed.';
        renderSummary(report,file,true);
      },true);
      if(state.rows.meta && state.rows.meta.summaryOnly){
        state.summaryOnly=true;
        state.players=(state.fastReport&&state.fastReport.players)||[];
        state.playerId=state.fastReport&&state.fastReport.defaultPlayerId;
        state.encounters=(state.fastReport&&state.fastReport.encounters)||[];
        status.textContent='Fast mode: parsed '+Number(state.rows.meta.rowCount||state.fastReport?.rowCount||0).toLocaleString()+' rows. Raw rows stay in worker, not the page.';
        render();
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
  function install(){
    var input=document.getElementById('file');
    if(input){input.onchange=function(){load(input.files&&input.files[0]);};window.StrikeglassParseFile=load;}
    var player=document.getElementById('player');
    if(player) player.onchange=function(){state.playerId=player.value;state.encounterId='all';state.rawPower=null;if(!state.summaryOnly&&typeof rebuildEncounters==='function')rebuildEncounters();render();};
    var mode=document.getElementById('mode');
    if(mode) mode.onchange=function(){state.split=mode.value;state.encounterId='all';if(!state.summaryOnly&&typeof rebuildEncounters==='function')rebuildEncounters();render();};
    var tabs=document.getElementById('tabs');
    if(tabs) tabs.onclick=function(event){const button=event.target.closest('button');if(button&&button.dataset.tab){state.tab=button.dataset.tab;state.rawPower=null;render();}};
  }
  const css='.sg-fast-summary,.sg-fast-summary *,.sg-loading-shell,.sg-loading-shell *{border-radius:0!important}.sg-fast-head,.sg-load-head{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:18px;align-items:start}.sg-fast-stat,.sg-load-head>b{border:1px solid #d8e2ec;background:#f5f8fb;padding:14px}.sg-load-head>b{font-size:30px;text-align:center;color:#0e1b27}.sg-fast-stat b{display:block;font-size:26px}.sg-fast-stat span{font-size:11px;text-transform:uppercase;font-weight:900;color:#526174}.sg-enc-preview{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px}.sg-enc-preview span{display:grid;border:1px solid #d8e2ec;background:#fff;padding:8px 10px;min-width:160px}.sg-enc-preview small{color:#526174;font-weight:800}.sg-progress{height:14px;border:1px solid #cad7e5;background:#edf3f8;margin:16px 0;overflow:hidden}.sg-progress i{display:block;height:100%;background:linear-gradient(90deg,#3f73d8,#35b99e);transition:width .18s linear}.sg-progress.indeterminate i{width:35%;animation:sgslide 1.1s linear infinite}.sg-load-meta{display:flex;justify-content:space-between;gap:12px;color:#526174;font-weight:800}.sg-skel-line,.sg-skel-block,.sg-skel-chip,.sg-skel-box{display:block;background:linear-gradient(90deg,#edf3f8,#f8fbfd,#edf3f8);background-size:220% 100%;animation:sgshine 1.1s linear infinite}.sg-skel-line{height:14px;width:80%}.sg-skel-block{height:28px;width:70%;margin:8px 0}.sg-skel-chip{height:36px;width:150px;border:1px solid #d8e2ec}.sg-skel-chip.wide{width:260px}.sg-skel-box{height:220px;border:1px solid #d8e2ec;margin-top:16px}.sg-card-skeleton .card span{height:10px}.sg-skeleton-panel{opacity:.82}@keyframes sgshine{from{background-position:220% 0}to{background-position:-220% 0}}@keyframes sgslide{from{transform:translateX(-120%)}to{transform:translateX(320%)}}@media(max-width:800px){.sg-fast-head,.sg-load-head{grid-template-columns:1fr}.sg-load-meta{display:block}}';
  if(!document.getElementById('sg-worker-controller-style')){var st=document.createElement('style');st.id='sg-worker-controller-style';st.textContent=css;document.head.appendChild(st);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
