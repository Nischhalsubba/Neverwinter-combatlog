(function(){
  const SG = window.SG || {};
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const esc = value => SG.escape ? SG.escape(value) : String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = value => { try { return window.fmt ? window.fmt(value) : Math.round(value || 0).toLocaleString(); } catch (_) { return String(value || 0); } };
  const num = value => Math.round(Number(value) || 0).toLocaleString();
  const pct = value => (Number(value) || 0).toFixed(1) + '%';
  const sec = value => (Number(value) || 0).toFixed(1) + 's';
  const storeKey = 'strikeglass.arti.options.v1';
  let options = { windowSeconds: 15, includeCompanions: true };
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
    if(['partyDamage','partyDps','callerDamage','callerDps','windowDamage','avgWindowDamage','avgPartyDamage','avgCallerDamage','directDamage','directAvg','directMax','bestCall','followUpDamage','topPlayerDamage','dps','damage'].includes(key)) return fmt(value);
    if(['time','windowEnd'].includes(key)) return sec(value);
    if(['directCrit','share'].includes(key)) return pct(value);
    if(['calls','users','artifacts','directHits','hits','id','callId'].includes(key)) return num(value);
    if(key === 'artifact') return icon(value) + ' <b>' + esc(value) + '</b>';
    return esc(value);
  }
  function table(rows, cols, limit){
    rows = rows || [];
    const shown = limit ? rows.slice(0, limit) : rows;
    const note = limit && rows.length > limit ? '<p class="mut">Showing first '+num(limit)+' rows out of '+num(rows.length)+' to keep the page fast.</p>' : '';
    return note + '<div class="table arti-table"><table><thead><tr>' + cols.map(col => '<th>' + esc(col[1]) + '</th>').join('') + '</tr></thead><tbody>' +
      (shown.length ? shown.map(row => '<tr>' + cols.map(col => '<td>' + cell(row[col[0]], col[0]) + '</td>').join('') + '</tr>').join('') : '<tr><td class="empty" colspan="' + cols.length + '">No artifact calls found in this view.</td></tr>') +
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
      saveOptions();
      renderArtiCall();
    };
    if(apply) apply.onclick = update;
    if(seconds) seconds.onkeydown = function(event){ if(event.key === 'Enter') update(); };
    if(companions) companions.onchange = update;
  }

  function renderFromReport(result){
    const content = q('#content');
    if(!content) return;
    const windows = result && result.windows ? result.windows : [];
    const perCallPlayers = result && result.perCallPlayers ? result.perCallPlayers : [];
    const best = windows[0] || null;
    const totalParty = windows.reduce((total,row) => total + (row.partyDamage || row.windowDamage || 0), 0);
    const totalCaller = windows.reduce((total,row) => total + (row.callerDamage || row.windowDamage || 0), 0);
    const totalDirect = windows.reduce((total,row) => total + (row.directDamage || 0), 0);
    const playerHead = (!state.summaryOnly && typeof playerHeader === 'function') ? playerHeader() : '';
    const modeNote = state.summaryOnly ? 'This uses the worker report, so changing the window does not load the huge raw log into the page.' : 'This uses the selected fight filter.';
    content.innerHTML = playerHead + '<section class="panel arti-call-panel"><div class="arti-hero"><div><span class="eyebrow">Arti Call</span><h2>'+esc(result.windowSeconds || options.windowSeconds)+'-second damage after artifact use</h2><p class="mut">When an artifact-like effect is used, Strikeglass checks how much damage the whole party and each player did after that call. '+esc(modeNote)+'</p></div><div class="arti-window">'+esc(result.windowSeconds || options.windowSeconds)+'s<br><small>after use</small></div></div>'+controls()+
      '<div class="cards">'+
      '<div class="card"><b>'+num(windows.length)+'</b><span>Artifact calls found</span></div>'+ 
      '<div class="card"><b>'+fmt(totalParty)+'</b><span>Party damage in call windows</span></div>'+ 
      '<div class="card"><b>'+fmt(totalCaller)+'</b><span>Caller damage in windows</span></div>'+ 
      '<div class="card"><b>'+fmt(totalDirect)+'</b><span>Direct artifact damage</span></div>'+ 
      '<div class="card"><b>'+esc(best ? best.topPlayer : '-')+'</b><span>Best player inside a call</span></div>'+ 
      '<div class="card"><b>'+fmt(best ? (best.partyDamage || best.windowDamage || 0) : 0)+'</b><span>Best party call damage</span></div>'+ 
      '</div>'+ 
      '<h3>Call windows</h3><p class="mut">Each row is one artifact call. Party damage is everyone’s damage in that window. Caller damage is only the player who used the artifact.</p>'+table(windows,[['id','#'],['player','Caller'],['artifact','Artifact / effect'],['time','Used at'],['partyDamage','Party damage'],['partyDps','Party DPS'],['callerDamage','Caller damage'],['callerDps','Caller DPS'],['topPlayer','Top player'],['topPlayerDamage','Top player damage'],['directDamage','Direct artifact damage'],['confidence','Match']],300)+
      '<h3>Player damage inside each call</h3><p class="mut">This answers: after this artifact was called, how much did each player actually do?</p>'+table(perCallPlayers,[['callId','Call #'],['artifact','Artifact / effect'],['caller','Caller'],['time','Used at'],['player','Player'],['damage','Damage in window'],['dps','Window DPS'],['hits','Hits'],['share','Share']],500)+
      '<h3>By player</h3><p class="mut">This adds each player’s damage across all artifact call windows.</p>'+table(result.byPlayer,[['player','Player'],['calls','Call windows'],['artifacts','Different artifacts'],['windowDamage','Total window damage'],['avgWindowDamage','Avg per window'],['bestCall','Best window'],['bestArtifact','Best artifact window']])+
      '<h3>By caller</h3><p class="mut">This only counts damage by the player who used the artifact.</p>'+table(result.byCaller || [], [['player','Caller'],['calls','Calls'],['artifacts','Different artifacts'],['callerDamage','Caller window damage'],['avgCallerDamage','Avg caller damage'],['directDamage','Direct artifact damage'],['bestCall','Best caller window'],['bestArtifact','Best artifact']])+
      '<h3>By artifact</h3>'+table(result.byArtifact,[['artifact','Artifact / effect'],['calls','Calls'],['users','Users'],['partyDamage','Party window damage'],['avgPartyDamage','Avg party damage'],['callerDamage','Caller damage'],['directDamage','Direct damage'],['directHits','Direct hits'],['bestUser','Best user'],['bestCall','Best party call']])+
      '<h3>Direct artifact damage rows</h3>'+table(result.direct,[['player','Player'],['artifact','Artifact / effect'],['directDamage','Damage'],['directHits','Hits'],['directAvg','Avg hit'],['directMax','Max hit'],['directCrit','Crit%'],['time','First call'],['confidence','Match']])+
      '<p class="mut">Rows marked Review may need more mapping later. The app is careful here because combat logs are weird little paperwork monsters.</p></section>';
    bindControls();
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

  const css = '.arti-call-panel,.arti-call-panel *{border-radius:0!important}.arti-hero{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:18px;align-items:start;border:1px solid #d8e2ec;background:#fff;padding:14px;margin-bottom:16px}.arti-hero h2{margin:4px 0}.arti-window{border:1px solid #0e1b27;background:#0e1b27;color:#fff;text-align:center;font-size:32px;font-weight:1000;line-height:1;padding:18px 8px}.arti-window small{display:block;margin-top:6px;color:#9fead8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.arti-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;border:1px solid #d8e2ec;background:#f7fafc;padding:12px;margin:0 0 16px}.arti-controls label{display:flex;align-items:center;gap:8px;font-weight:900;color:#23344a}.arti-controls input[type=number]{width:84px;background:#fff;color:#101923;border:1px solid #b8c5d3;padding:8px}.arti-controls button{background:#0e1b27!important;color:#fff!important;border:1px solid #0e1b27!important;padding:9px 14px!important;font-weight:1000}.arti-check input{width:16px;height:16px}.arti-table td:first-child,.arti-table th:first-child{width:52px}.artiIcon{width:24px!important;height:24px!important;vertical-align:middle;margin-right:8px;border:1px solid #cbd8e5}.arti-call-panel h3{margin-top:22px!important}.arti-call-panel .mut{max-width:980px}@media(max-width:800px){.arti-hero{grid-template-columns:1fr}.arti-window{font-size:24px}}';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureTab); else ensureTab();
})();
