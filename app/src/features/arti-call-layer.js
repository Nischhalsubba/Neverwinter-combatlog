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
  let selectedEntityKey = '';
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
    if(['partyDamage','partyDps','callerDamage','callerDps','windowDamage','avgWindowDamage','avgPartyDamage','avgCallerDamage','directDamage','directAvg','directMax','bestCall','bestWindow','followUpDamage','topPlayerDamage','topParticipantDamage','topPowerDamage','dps','damage','avgDamage','maxHit'].includes(key)) return fmt(value);
    if(['time','windowEnd','firstUse','lastUse','minGap','avgGap','windowSeconds','knownCooldownSeconds'].includes(key)) return Number(value) ? sec(value) : '-';
    if(['directCrit','share','crit','flank'].includes(key)) return pct(value);
    if(['calls','users','artifacts','directHits','hits','id','callId','windows','callCount','artifactUseCount','artifactCount'].includes(key)) return num(value);
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
      selectedEntityKey = '';
      saveOptions();
      renderArtiCall();
    };
    if(apply) apply.onclick = update;
    if(seconds) seconds.onkeydown = function(event){ if(event.key === 'Enter') update(); };
    if(companions) companions.onchange = update;
  }
  function entityKey(row){ return row.rawParticipantKey || row.participantKey || [row.sourceType,row.owner,row.participant].join('|'); }
  function addArtifact(set, value){
    String(value || '').split(',').map(v => v.trim()).filter(Boolean).forEach(v => set.add(v));
  }
  function entityRows(result){
    const map = new Map();
    const rows = result && result.perCallParticipants ? result.perCallParticipants : [];
    const winSec = Number(result && result.windowSeconds || options.windowSeconds || 15);
    for(const row of rows){
      const key = entityKey(row);
      if(!map.has(key)) map.set(key, { key, participant: row.participant || '-', owner: row.owner || '-', sourceType: row.sourceType || 'Player', artifactSet: new Set(), windows: [], damage:0, windowSeconds:0, hits:0, critHits:0, flankHits:0, maxHit:0, maxPower:'-' });
      const item = map.get(key);
      addArtifact(item.artifactSet, row.artifact || row.artifacts);
      item.windows.push(row);
      item.damage += row.damage || 0;
      item.windowSeconds += winSec;
      item.hits += row.hits || 0;
      item.critHits += ((row.crit || 0) / 100) * (row.hits || 0);
      item.flankHits += ((row.flank || 0) / 100) * (row.hits || 0);
      if((row.maxHit || 0) > item.maxHit){ item.maxHit = row.maxHit || 0; item.maxPower = row.maxPower || '-'; }
    }
    return Array.from(map.values()).map(item => Object.assign(item, {
      artifactUsed: Array.from(item.artifactSet).join(', ') || '-',
      dps: item.windowSeconds ? item.damage / item.windowSeconds : 0,
      avgDamage: item.hits ? item.damage / item.hits : 0,
      crit: item.hits ? item.critHits / item.hits * 100 : 0,
      flank: item.hits ? item.flankHits / item.hits * 100 : 0
    })).sort((a,b) => b.damage - a.damage);
  }
  function entityName(row){
    return '<span class="source-pill '+(row.sourceType==='Companion'?'companion':'player')+'">'+esc(row.sourceType)+'</span> <button type="button" class="arti-link" data-entity-key="'+attr(row.key)+'">'+esc(row.participant)+'</button>' + (row.sourceType === 'Companion' ? '<small>Owner: '+esc(row.owner)+'</small>' : '');
  }
  function artiMainTable(rows){
    return '<div class="table arti-table arti-entity-table"><table><thead><tr><th>Player / companion</th><th>Artifact used</th><th>Total damage</th><th>Damage / sec</th><th>Avg damage</th><th>Crit rate</th><th>Flank rate</th><th>Highest hit</th></tr></thead><tbody>'+ 
      (rows.length ? rows.map(row => '<tr class="arti-entity-row '+(String(row.key)===String(selectedEntityKey)?'is-selected':'')+'" data-entity-key="'+attr(row.key)+'"><td>'+entityName(row)+'</td><td>'+esc(row.artifactUsed)+'</td><td>'+cell(row.damage,'damage')+'</td><td>'+cell(row.dps,'dps')+'</td><td>'+cell(row.avgDamage,'avgDamage')+'</td><td>'+cell(row.crit,'crit')+'</td><td>'+cell(row.flank,'flank')+'</td><td>'+cell(row.maxHit,'maxHit')+' <small>'+esc(row.maxPower || '')+'</small></td></tr>').join('') : '<tr><td class="empty" colspan="8">No player or companion damage found inside artifact timers.</td></tr>')+
      '</tbody></table></div>';
  }
  function bindEntityRows(){
    qa('.arti-entity-row,.arti-link').forEach(row => row.onclick = function(event){ event.preventDefault(); selectedEntityKey = row.dataset.entityKey || row.closest('[data-entity-key]')?.dataset.entityKey || ''; renderFromReport(currentResult); });
  }
  function mergePowerRows(entity, result){
    const map = new Map();
    const detailRows = result && result.byParticipant ? result.byParticipant.filter(row => (row.rawParticipantKey || row.participantKey) === entity.key || row.participant === entity.participant && row.sourceType === entity.sourceType) : [];
    for(const detail of detailRows){
      for(const power of detail.topPowers || []){
        if(!map.has(power.power)) map.set(power.power, { power:power.power, damage:0, hits:0, critHits:0, flankHits:0, maxHit:0 });
        const item = map.get(power.power);
        item.damage += power.damage || 0;
        item.hits += power.hits || 0;
        item.critHits += ((power.crit || 0) / 100) * (power.hits || 0);
        item.flankHits += ((power.flank || 0) / 100) * (power.hits || 0);
        if((power.maxHit || 0) > item.maxHit) item.maxHit = power.maxHit || 0;
      }
    }
    if(!map.size){
      for(const row of entity.windows || []){
        const key = row.topPower || '-';
        if(!map.has(key)) map.set(key, { power:key, damage:0, hits:0, critHits:0, flankHits:0, maxHit:0 });
        const item = map.get(key);
        item.damage += row.topPowerDamage || 0;
        item.hits += row.hits || 0;
        item.critHits += ((row.crit || 0) / 100) * (row.hits || 0);
        item.flankHits += ((row.flank || 0) / 100) * (row.hits || 0);
        if((row.maxHit || 0) > item.maxHit) item.maxHit = row.maxHit || 0;
      }
    }
    return Array.from(map.values()).map(power => Object.assign(power, { avgDamage: power.hits ? power.damage / power.hits : 0, crit: power.hits ? power.critHits / power.hits * 100 : 0, flank: power.hits ? power.flankHits / power.hits * 100 : 0 })).sort((a,b) => b.damage - a.damage);
  }
  function selectedDetails(result, rows){
    if(!selectedEntityKey) return '<div class="arti-detail muted-detail">Click a player or companion name to view every artifact timer counted for that row.</div>';
    const selected = rows.find(row => String(row.key) === String(selectedEntityKey));
    if(!selected) return '<div class="arti-detail muted-detail">Select a player or companion row to see details.</div>';
    const windows = (selected.windows || []).slice().sort((a,b) => b.damage - a.damage);
    return '<section class="arti-detail"><div class="arti-detail-head"><div><span class="eyebrow">Selected damage source</span><h3>'+esc(selected.participant)+'</h3><p class="mut">This detail lists every artifact timer where this '+esc(String(selected.sourceType).toLowerCase())+' did damage. The main table stays clean because humans can only survive so many rows.</p></div><div><b>'+fmt(selected.damage)+'</b><span>Total counted damage</span></div></div>'+ 
      '<div class="grid2"><div><h3>Artifact timers for this row</h3>'+table(windows,[['callId','Window #'],['artifact','Artifact used'],['caller','Artifact user'],['time','Started at'],['damage','Damage'],['dps','Damage / sec'],['avgDamage','Avg damage'],['crit','Crit rate'],['flank','Flank rate'],['maxHit','Highest hit'],['maxPower','Highest-hit power']],300)+'</div><div><h3>Power breakdown inside those timers</h3>'+table(mergePowerRows(selected, result), [['power','Power'],['damage','Damage'],['hits','Hits'],['avgDamage','Avg'],['crit','Crit rate'],['flank','Flank rate'],['maxHit','Highest hit']],80)+'</div></div></section>';
  }

  function renderFromReport(result){
    currentResult = result;
    const content = q('#content');
    if(!content) return;
    const rows = entityRows(result || {});
    const timers = result && result.artifactTimers ? result.artifactTimers : [];
    const bestRow = rows[0] || null;
    const totalDamage = rows.reduce((total,row) => total + (row.damage || 0), 0);
    const playerHead = (!state.summaryOnly && typeof playerHeader === 'function') ? playerHeader() : '';
    const modeNote = state.summaryOnly ? 'This uses the worker report, so changing the window does not load the huge raw log into the page.' : 'This uses the selected fight filter.';
    content.innerHTML = playerHead + '<section class="panel arti-call-panel"><div class="arti-hero"><div><span class="eyebrow">Arti Call</span><h2>'+esc(result.windowSeconds || options.windowSeconds)+'-second damage after player artifacts</h2><p class="mut">The main table shows one row per player or companion. Each row adds only the damage done inside that player\'s artifact timers. Anything outside those timers is ignored. '+esc(modeNote)+'</p></div><div class="arti-window">'+esc(result.windowSeconds || options.windowSeconds)+'s<br><small>per artifact</small></div></div>'+controls()+
      '<div class="cards">'+
      '<div class="card"><b>'+num(rows.filter(r => r.sourceType === 'Player').length)+'</b><span>Players counted</span></div>'+ 
      '<div class="card"><b>'+num(rows.filter(r => r.sourceType === 'Companion').length)+'</b><span>Companions counted</span></div>'+ 
      '<div class="card"><b>'+num(result.artifactUseCount || 0)+'</b><span>Artifact uses detected</span></div>'+ 
      '<div class="card"><b>'+fmt(totalDamage)+'</b><span>Total counted damage</span></div>'+ 
      '<div class="card"><b>'+esc(bestRow ? bestRow.participant : '-')+'</b><span>Top damage source</span></div>'+ 
      '<div class="card"><b>'+fmt(bestRow ? bestRow.damage : 0)+'</b><span>Top source damage</span></div>'+ 
      '</div>'+ 
      '<h3>Player and companion totals</h3><p class="mut">This is the only main Arti Call table: one row per player or companion, with damage counted only inside artifact timers.</p>'+artiMainTable(rows)+
      selectedDetails(result, rows)+
      '<details class="arti-raw"><summary>Show artifact timers found in this log</summary><p class="mut">Uses and gaps are observed from this uploaded log. They are not used to count damage; your selected damage window is.</p>'+table(timers,[['artifact','Artifact / effect'],['uses','Uses'],['users','Users'],['firstUse','First use'],['lastUse','Last use'],['minGap','Shortest gap'],['avgGap','Average gap'],['windowSeconds','Current damage window'],['knownCooldownSeconds','Known cooldown']])+'</details>'+ 
      '</section>';
    bindControls();
    bindEntityRows();
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

  const css = '.arti-call-panel,.arti-call-panel *{border-radius:0!important}.arti-hero{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:18px;align-items:start;border:1px solid #d8e2ec;background:#fff;padding:14px;margin-bottom:16px}.arti-hero h2{margin:4px 0}.arti-window{border:1px solid #0e1b27;background:#0e1b27;color:#fff;text-align:center;font-size:32px;font-weight:1000;line-height:1;padding:18px 8px}.arti-window small{display:block;margin-top:6px;color:#9fead8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.arti-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;border:1px solid #d8e2ec;background:#f7fafc;padding:12px;margin:0 0 16px}.arti-controls label{display:flex;align-items:center;gap:8px;font-weight:900;color:#23344a}.arti-controls input[type=number]{width:84px;background:#fff;color:#101923;border:1px solid #b8c5d3;padding:8px}.arti-controls button{background:#0e1b27!important;color:#fff!important;border:1px solid #0e1b27!important;padding:9px 14px!important;font-weight:1000}.arti-check input{width:16px;height:16px}.arti-table td:first-child,.arti-table th:first-child{min-width:220px}.artiIcon{width:24px!important;height:24px!important;vertical-align:middle;margin-right:8px;border:1px solid #cbd8e5}.arti-call-panel h3{margin-top:22px!important}.arti-call-panel .mut{max-width:980px}.source-pill{display:inline-block;border:1px solid #b8c5d3;background:#eef4fa;padding:3px 7px;margin-right:6px;font-size:11px;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}.source-pill.companion{background:#fff3e8;border-color:#e5a15b}.arti-entity-table tr{cursor:pointer}.arti-entity-table tr.is-selected{background:#eafaf6!important;outline:2px solid #32b999}.arti-entity-table tr:hover{background:#f4f8fb}.arti-link{border:0;background:transparent;color:#071320;font-weight:1000;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.arti-entity-table small{display:block;color:#69788c;font-size:11px;margin-top:3px}.arti-detail{border:1px solid #d8e2ec;background:#fff;margin-top:18px;padding:14px}.muted-detail{color:#64748b;background:#f8fafc}.arti-detail-head{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:16px;align-items:start}.arti-detail-head b{display:block;font-size:24px}.arti-detail-head span{font-size:11px;text-transform:uppercase;font-weight:900;color:#526174}.arti-raw{border:1px solid #d8e2ec;margin-top:18px;padding:12px;background:#fbfdff}.arti-raw summary{font-weight:1000;cursor:pointer}@media(max-width:800px){.arti-hero,.arti-detail-head{grid-template-columns:1fr}.arti-window{font-size:24px}}';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureTab); else ensureTab();
})();
