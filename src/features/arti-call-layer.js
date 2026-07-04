(function(){
  const SG = window.SG || {};
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const esc = value => SG.escape ? SG.escape(value) : String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const attr = value => esc(value).replace(/`/g,'&#96;');
  const fmt = value => { try { return window.fmt ? window.fmt(value) : Math.round(value || 0).toLocaleString(); } catch (_) { return String(value || 0); } };
  const num = value => Math.round(Number(value) || 0).toLocaleString();
  const pct = value => (Number(value) || 0).toFixed(1) + '%';
  const sec = value => (Number(value) || 0).toFixed(1) + 's';
  const storeKey = 'strikeglass.arti.options.v1';
  let options = { windowSeconds: 15, includeCompanions: true };
  let currentResult = null;
  let selectedParticipantKey = '';
  try { options = Object.assign(options, JSON.parse(localStorage.getItem(storeKey) || '{}')); } catch (_) {}
  function saveOptions(){ try { localStorage.setItem(storeKey, JSON.stringify(options)); } catch (_) {} }
  function icon(name){ return window.NWAssets && NWAssets.powerHtml ? NWAssets.powerHtml(name, 'Artifact', 'artiIcon') : ''; }

  async function reportForCurrentView(){
    if(typeof state === 'undefined') return null;
    const opts = { windowSeconds: options.windowSeconds, includeCompanions: options.includeCompanions };
    if(state.summaryOnly && window.StrikeglassRequestArtiCall){
      return await window.StrikeglassRequestArtiCall(opts);
    }
    if(window.SGArtifactWindow && state.rows && state.rows.length){
      const rows = typeof scopeRows === 'function' ? scopeRows() : state.rows;
      return window.SGArtifactWindow.analyze(rows, state.players || [], opts);
    }
    return state.artiReport || null;
  }

  function cell(value, key){
    if(value == null) return '-';
    if(['partyDamage','partyDps','callerDamage','callerDps','windowDamage','avgWindowDamage','avgPartyDamage','avgCallerDamage','directDamage','directAvg','directMax','bestCall','bestWindow','followUpDamage','topPlayerDamage','topParticipantDamage','topPowerDamage','dps','damage','avgDamage'].includes(key)) return fmt(value);
    if(['time','windowEnd'].includes(key)) return sec(value);
    if(['directCrit','share'].includes(key)) return pct(value);
    if(['calls','users','artifacts','directHits','hits','id','callId','windows'].includes(key)) return num(value);
    if(key === 'artifact') return icon(value) + ' <b>' + esc(value) + '</b>';
    return esc(value);
  }
  function table(rows, cols, limit){
    rows = rows || [];
    const shown = limit ? rows.slice(0, limit) : rows;
    const note = limit && rows.length > limit ? '<p class="mut">Showing first '+num(limit)+' rows out of '+num(rows.length)+' to keep the page fast.</p>' : '';
    return note + '<div class="table arti-table"><table><thead><tr>' + cols.map(col => '<th>' + esc(col[1]) + '</th>').join('') + '</tr></thead><tbody>' +
      (shown.length ? shown.map(row => '<tr>' + cols.map(col => '<td>' + cell(row[col[0]], col[0]) + '</td>').join('') + '</tr>').join('') : '<tr><td class="empty" colspan="' + cols.length + '">No data found in this view.</td></tr>') +
      '</tbody></table></div>';
  }
  function controls(){
    return '<div class="arti-controls sg-no-help"><label>Damage window <input id="artiWindowSeconds" type="number" min="3" max="60" step="1" value="'+esc(options.windowSeconds)+'"> seconds</label><label class="arti-check"><input id="artiIncludeCompanions" type="checkbox" '+(options.includeCompanions?'checked':'')+'> Include companion damage</label><button id="artiRefresh" type="button">Apply</button></div>';
  }
  function bindControls(){
    const seconds = q('#artiWindowSeconds');
    const companions = q('#artiIncludeCompanions');
    const apply = q('#artiRefresh');
    const update = function(){
      options.windowSeconds = Math.max(3, Math.min(60, Number(seconds && seconds.value || 15)));
      options.includeCompanions = !!(companions && companions.checked);
      selectedParticipantKey = '';
      saveOptions();
      renderArtiCall();
    };
    if(apply) apply.onclick = update;
    if(seconds) seconds.onkeydown = function(event){ if(event.key === 'Enter') update(); };
    if(companions) companions.onchange = update;
  }
  function participantTable(rows){
    rows = rows || [];
    if(!selectedParticipantKey && rows[0]) selectedParticipantKey = rows[0].participantKey;
    return '<div class="table arti-table participant-table"><table><thead><tr><th>Type</th><th>Player / companion</th><th>Owner</th><th>Windows</th><th>Damage in windows</th><th>Avg per window</th><th>Hits</th><th>Best window</th><th>Best artifact window</th><th>Top power</th></tr></thead><tbody>'+
      (rows.length ? rows.map(row => '<tr class="arti-participant-row '+(row.participantKey===selectedParticipantKey?'is-selected':'')+'" data-participant-key="'+attr(row.participantKey)+'"><td><span class="source-pill '+(row.sourceType==='Companion'?'companion':'player')+'">'+esc(row.sourceType)+'</span></td><td><b>'+esc(row.participant)+'</b></td><td>'+esc(row.owner || '-')+'</td><td>'+cell(row.windows,'windows')+'</td><td>'+cell(row.damage,'damage')+'</td><td>'+cell(row.avgWindowDamage,'avgWindowDamage')+'</td><td>'+cell(row.hits,'hits')+'</td><td>'+cell(row.bestWindow,'bestWindow')+'</td><td>'+esc(row.bestArtifact || '-')+'</td><td>'+esc(row.topPower || '-')+' <small>'+cell(row.topPowerDamage,'topPowerDamage')+'</small></td></tr>').join('') : '<tr><td class="empty" colspan="10">No player or companion damage found in artifact windows.</td></tr>')+
      '</tbody></table></div>';
  }
  function bindParticipantRows(){
    qa('.arti-participant-row').forEach(row => row.onclick = function(){ selectedParticipantKey = row.dataset.participantKey || ''; renderFromReport(currentResult); });
  }
  function selectedDetails(result){
    const participants = result.byParticipant || [];
    if(!selectedParticipantKey && participants[0]) selectedParticipantKey = participants[0].participantKey;
    const selected = participants.find(row => row.participantKey === selectedParticipantKey) || participants[0] || null;
    if(!selected) return '<h3>Breakdown</h3><div class="empty">Click a player or companion row to see details.</div>';
    const rows = (result.perCallParticipants || []).filter(row => row.participantKey === selected.participantKey).sort((a,b) => b.damage - a.damage);
    return '<section class="arti-detail"><div class="arti-detail-head"><div><span class="eyebrow">Selected breakdown</span><h3>'+esc(selected.participant)+'</h3><p class="mut">These are the artifact windows where this '+esc(selected.sourceType.toLowerCase())+' did damage. Click another row above to switch the breakdown.</p></div><div><b>'+fmt(selected.damage)+'</b><span>Total window damage</span></div></div>'+ 
      '<div class="grid2"><div><h3>Windows for this character</h3>'+table(rows,[['callId','Call #'],['artifact','Artifact / effect'],['caller','Caller'],['time','Used at'],['damage','Damage'],['dps','Window DPS'],['hits','Hits'],['share','Window share'],['topPower','Top power'],['topPowerDamage','Top power damage']],300)+'</div><div><h3>Power breakdown</h3>'+table(selected.topPowers || [], [['power','Power'],['damage','Damage'],['hits','Hits']],40)+'</div></div></section>';
  }

  function renderFromReport(result){
    currentResult = result;
    const content = q('#content');
    if(!content) return;
    const windows = result && result.windows ? result.windows : [];
    const participants = result && result.byParticipant ? result.byParticipant : [];
    const bestParticipant = participants[0] || null;
    const totalParty = windows.reduce((total,row) => total + (row.partyDamage || row.windowDamage || 0), 0);
    const totalDirect = windows.reduce((total,row) => total + (row.directDamage || 0), 0);
    const playerHead = (!state.summaryOnly && typeof playerHeader === 'function') ? playerHeader() : '';
    const modeNote = state.summaryOnly ? 'This uses the worker report, so changing the window does not load the huge raw log into the page.' : 'This uses the selected fight filter.';
    content.innerHTML = playerHead + '<section class="panel arti-call-panel"><div class="arti-hero"><div><span class="eyebrow">Arti Call</span><h2>'+esc(result.windowSeconds || options.windowSeconds)+'-second damage after artifact use</h2><p class="mut">Instead of dumping every call first, this view starts with the useful answer: how much each player and companion did inside artifact call windows. '+esc(modeNote)+'</p></div><div class="arti-window">'+esc(result.windowSeconds || options.windowSeconds)+'s<br><small>after use</small></div></div>'+controls()+
      '<div class="cards">'+
      '<div class="card"><b>'+num(windows.length)+'</b><span>Artifact calls found</span></div>'+ 
      '<div class="card"><b>'+fmt(totalParty)+'</b><span>Total party damage in windows</span></div>'+ 
      '<div class="card"><b>'+fmt(totalDirect)+'</b><span>Direct artifact damage</span></div>'+ 
      '<div class="card"><b>'+num(participants.filter(row => row.sourceType === 'Player').length)+'</b><span>Players with window damage</span></div>'+ 
      '<div class="card"><b>'+num(participants.filter(row => row.sourceType === 'Companion').length)+'</b><span>Companions with window damage</span></div>'+ 
      '<div class="card"><b>'+esc(bestParticipant ? bestParticipant.participant : '-')+'</b><span>Top player / companion</span></div>'+ 
      '</div>'+ 
      '<h3>Damage by player and companion</h3><p class="mut">This is the main Arti Call view. It adds each player and companion damage across all artifact windows in the selected fight. Click a row to see the call-by-call breakdown.</p>'+participantTable(participants)+
      selectedDetails(result)+
      '<h3>By artifact</h3><p class="mut">This shows which artifact-like effects created the biggest party burst windows.</p>'+table(result.byArtifact,[['artifact','Artifact / effect'],['calls','Calls'],['users','Users'],['partyDamage','Party window damage'],['avgPartyDamage','Avg party damage'],['callerDamage','Caller damage'],['directDamage','Direct damage'],['directHits','Direct hits'],['bestUser','Best user'],['bestCall','Best party call']])+
      '<h3>By caller</h3><p class="mut">This only counts damage by the player who used the artifact, not the whole party.</p>'+table(result.byCaller || [], [['player','Caller'],['calls','Calls'],['artifacts','Different artifacts'],['callerDamage','Caller window damage'],['avgCallerDamage','Avg caller damage'],['directDamage','Direct artifact damage'],['bestCall','Best caller window'],['bestArtifact','Best artifact']])+
      '<details class="arti-raw"><summary>Show raw call windows</summary><p class="mut">This is hidden by default because hundreds of call rows are noisy and slow to read. Humanity survives one sensible default.</p>'+table(windows,[['id','#'],['player','Caller'],['artifact','Artifact / effect'],['time','Used at'],['partyDamage','Party damage'],['partyDps','Party DPS'],['callerDamage','Caller damage'],['topParticipant','Top player / companion'],['topParticipantDamage','Top damage'],['directDamage','Direct artifact damage'],['confidence','Match']],300)+'</details>'+ 
      '<p class="mut">Rows marked Review may need more mapping later. The app is careful here because combat logs are weird little paperwork monsters.</p></section>';
    bindControls();
    bindParticipantRows();
  }

  function renderArtiCall(){
    const content = q('#content');
    if(!content) return;
    if(typeof state === 'undefined' || ((!state.rows || !state.rows.length) && !state.artiReport && !state.summaryOnly)){
      content.innerHTML = '<section class="panel"><div class="empty">Upload a combat log first.</div></section>';
      return;
    }
    content.innerHTML = '<section class="panel"><h2>Preparing Arti Call...</h2><p class="mut">Using the worker report when available so this tab does not freeze the app.</p></section>';
    Promise.resolve().then(reportForCurrentView).then(function(result){
      if(!result){ content.innerHTML = '<section class="panel"><div class="empty">No Arti Call data available for this log.</div></section>'; return; }
      state.artiReport = result;
      renderFromReport(result);
    }).catch(function(error){
      content.innerHTML = '<section class="panel"><h2>Arti Call error</h2><p class="mut">'+esc(error.message || error)+'</p></section>';
    });
  }

  function ensureTab(){
    const tabs = q('#tabs');
    if(!tabs || tabs.querySelector('[data-tab="arti"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = 'arti';
    button.textContent = 'Arti Call';
    button.onclick = function(){ state.tab = 'arti'; render(); };
    const compare = tabs.querySelector('[data-tab="compare"]') || tabs.querySelector('[data-tab="formulas"]');
    tabs.insertBefore(button, compare ? compare.nextSibling : null);
  }

  const previousRender = window.render;
  window.render = function(){
    ensureTab();
    if(typeof state !== 'undefined' && state.tab === 'arti'){
      if(!state.summaryOnly){
        if(typeof renderPlayers === 'function') renderPlayers();
        if(typeof renderChips === 'function') renderChips();
      }
      qa('#tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === 'arti'));
      renderArtiCall();
      return;
    }
    previousRender.apply(this, arguments);
    ensureTab();
  };

  const css = '.arti-call-panel,.arti-call-panel *{border-radius:0!important}.arti-hero{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:18px;align-items:start;border:1px solid #d8e2ec;background:#fff;padding:14px;margin-bottom:16px}.arti-hero h2{margin:4px 0}.arti-window{border:1px solid #0e1b27;background:#0e1b27;color:#fff;text-align:center;font-size:32px;font-weight:1000;line-height:1;padding:18px 8px}.arti-window small{display:block;margin-top:6px;color:#9fead8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.arti-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;border:1px solid #d8e2ec;background:#f7fafc;padding:12px;margin:0 0 16px}.arti-controls label{display:flex;align-items:center;gap:8px;font-weight:900;color:#23344a}.arti-controls input[type=number]{width:84px;background:#fff;color:#101923;border:1px solid #b8c5d3;padding:8px}.arti-controls button{background:#0e1b27!important;color:#fff!important;border:1px solid #0e1b27!important;padding:9px 14px!important;font-weight:1000}.arti-check input{width:16px;height:16px}.arti-table td:first-child,.arti-table th:first-child{width:52px}.artiIcon{width:24px!important;height:24px!important;vertical-align:middle;margin-right:8px;border:1px solid #cbd8e5}.arti-call-panel h3{margin-top:22px!important}.arti-call-panel .mut{max-width:980px}.source-pill{display:inline-block;border:1px solid #b8c5d3;background:#eef4fa;padding:3px 7px;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}.source-pill.companion{background:#fff3e8;border-color:#e5a15b}.participant-table tr{cursor:pointer}.participant-table tr.is-selected{background:#eafaf6!important;outline:2px solid #32b999}.participant-table tr:hover{background:#f4f8fb}.arti-detail{border:1px solid #d8e2ec;background:#fff;margin-top:18px;padding:14px}.arti-detail-head{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:16px;align-items:start}.arti-detail-head b{display:block;font-size:24px}.arti-detail-head span{font-size:11px;text-transform:uppercase;font-weight:900;color:#526174}.arti-raw{border:1px solid #d8e2ec;margin-top:18px;padding:12px;background:#fbfdff}.arti-raw summary{font-weight:1000;cursor:pointer}@media(max-width:800px){.arti-hero,.arti-detail-head{grid-template-columns:1fr}.arti-window{font-size:24px}}';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureTab); else ensureTab();
})();
