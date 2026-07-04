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
  let selectedWindowId = '';
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
      selectedWindowId = '';
      saveOptions();
      renderArtiCall();
    };
    if(apply) apply.onclick = update;
    if(seconds) seconds.onkeydown = function(event){ if(event.key === 'Enter') update(); };
    if(companions) companions.onchange = update;
  }
  function windowRow(row){
    const parts = row.participants || [];
    const hits = parts.reduce((sum, part) => sum + (part.hits || 0), 0);
    const crits = parts.reduce((sum, part) => sum + (part.crits || 0), 0);
    const flanks = parts.reduce((sum, part) => sum + (part.flanks || 0), 0);
    let maxHit = 0;
    let maxPower = '';
    for(const part of parts){
      if((part.maxHit || 0) > maxHit){ maxHit = part.maxHit || 0; maxPower = part.maxPower || ''; }
    }
    return {
      id: row.id,
      player: row.callers || row.player || '-',
      artifact: row.artifacts || row.artifact || '-',
      time: row.time,
      windowEnd: row.windowEnd,
      damage: row.partyDamage || 0,
      dps: row.partyDps || 0,
      hits,
      avgDamage: hits ? (row.partyDamage || 0) / hits : 0,
      crit: hits ? crits / hits * 100 : 0,
      flank: hits ? flanks / hits * 100 : 0,
      maxHit,
      maxPower,
      raw: row
    };
  }
  function mainRows(result){ return (result.windows || []).map(windowRow).sort((a,b) => b.damage - a.damage); }
  function artiMainTable(rows){
    return '<div class="table arti-table arti-window-table"><table><thead><tr><th>Player</th><th>Artifact used</th><th>Total damage</th><th>Damage / sec</th><th>Avg damage</th><th>Crit rate</th><th>Flank rate</th><th>Highest hit</th></tr></thead><tbody>'+ 
      (rows.length ? rows.map(row => '<tr class="arti-window-row '+(String(row.id)===String(selectedWindowId)?'is-selected':'')+'" data-window-id="'+attr(row.id)+'"><td><button type="button" class="arti-link" data-window-id="'+attr(row.id)+'">'+esc(row.player)+'</button><small>'+sec(row.time)+' to '+sec(row.windowEnd)+'</small></td><td>'+icon(row.artifact)+' '+esc(row.artifact)+'</td><td>'+cell(row.damage,'damage')+'</td><td>'+cell(row.dps,'dps')+'</td><td>'+cell(row.avgDamage,'avgDamage')+'</td><td>'+cell(row.crit,'crit')+'</td><td>'+cell(row.flank,'flank')+'</td><td>'+cell(row.maxHit,'maxHit')+' <small>'+esc(row.maxPower || '')+'</small></td></tr>').join('') : '<tr><td class="empty" colspan="8">No artifact activation windows found.</td></tr>')+
      '</tbody></table></div>';
  }
  function bindWindowRows(){
    qa('.arti-window-row,.arti-link').forEach(row => row.onclick = function(event){ event.preventDefault(); selectedWindowId = row.dataset.windowId || row.closest('[data-window-id]')?.dataset.windowId || ''; renderFromReport(currentResult); });
  }
  function powerBreakdown(parts){
    const map = new Map();
    for(const part of parts || []){
      for(const power of part.powers || []){
        if(!map.has(power.power)) map.set(power.power, { power:power.power, damage:0, hits:0, crits:0, flanks:0, maxHit:0 });
        const item = map.get(power.power);
        item.damage += power.damage || 0;
        item.hits += power.hits || 0;
        item.crits += power.crits || 0;
        item.flanks += power.flanks || 0;
        if((power.maxHit || 0) > item.maxHit) item.maxHit = power.maxHit || 0;
      }
    }
    return Array.from(map.values()).map(power => Object.assign(power, { avgDamage: power.hits ? power.damage / power.hits : 0, crit: power.hits ? power.crits / power.hits * 100 : 0, flank: power.hits ? power.flanks / power.hits * 100 : 0 })).sort((a,b) => b.damage - a.damage);
  }
  function selectedDetails(result){
    if(!selectedWindowId) return '<div class="arti-detail muted-detail">Click a player name to view the damage breakdown for that exact artifact timer.</div>';
    const selected = (result.windows || []).find(row => String(row.id) === String(selectedWindowId));
    if(!selected) return '<div class="arti-detail muted-detail">Select a player row to see details.</div>';
    const summary = windowRow(selected);
    const parts = (selected.participants || []).map(part => ({ sourceType: part.sourceType, participant: part.participant, owner: part.owner, damage: part.damage, dps: part.dps, hits: part.hits, avgDamage: part.avgDamage, crit: part.crit, flank: part.flank, maxHit: part.maxHit, maxPower: part.maxPower }));
    return '<section class="arti-detail"><div class="arti-detail-head"><div><span class="eyebrow">Selected artifact timer</span><h3>'+esc(summary.player)+' used '+esc(summary.artifact)+'</h3><p class="mut">This detail only includes damage from '+sec(summary.time)+' to '+sec(summary.windowEnd)+'. Everything before and after that timer is ignored.</p></div><div><b>'+fmt(summary.damage)+'</b><span>Total damage</span></div></div>'+ 
      '<div class="grid2"><div><h3>Player and companion split</h3>'+table(parts,[['sourceType','Type'],['participant','Name'],['damage','Damage'],['dps','Damage / sec'],['avgDamage','Avg damage'],['crit','Crit rate'],['flank','Flank rate'],['maxHit','Highest hit'],['maxPower','Highest-hit power']],40)+'</div><div><h3>Power breakdown inside timer</h3>'+table(powerBreakdown(selected.participants || []), [['power','Power'],['damage','Damage'],['hits','Hits'],['avgDamage','Avg'],['crit','Crit rate'],['flank','Flank rate'],['maxHit','Highest hit']],80)+'</div></div></section>';
  }

  function renderFromReport(result){
    currentResult = result;
    const content = q('#content');
    if(!content) return;
    const rows = mainRows(result || {});
    const timers = result && result.artifactTimers ? result.artifactTimers : [];
    const bestRow = rows[0] || null;
    const totalDamage = rows.reduce((total,row) => total + (row.damage || 0), 0);
    const playerHead = (!state.summaryOnly && typeof playerHeader === 'function') ? playerHeader() : '';
    const modeNote = state.summaryOnly ? 'This uses the worker report, so changing the window does not load the huge raw log into the page.' : 'This uses the selected fight filter.';
    content.innerHTML = playerHead + '<section class="panel arti-call-panel"><div class="arti-hero"><div><span class="eyebrow">Arti Call</span><h2>'+esc(result.windowSeconds || options.windowSeconds)+'-second damage after each player artifact</h2><p class="mut">Each artifact activation starts its own timer for that player. The table only counts that player and their companion damage inside the timer. Anything before or after is ignored. '+esc(modeNote)+'</p></div><div class="arti-window">'+esc(result.windowSeconds || options.windowSeconds)+'s<br><small>per artifact</small></div></div>'+controls()+
      '<div class="cards">'+
      '<div class="card"><b>'+num(rows.length)+'</b><span>Artifact windows</span></div>'+ 
      '<div class="card"><b>'+num(result.artifactUseCount || rows.length)+'</b><span>Artifact uses detected</span></div>'+ 
      '<div class="card"><b>'+fmt(totalDamage)+'</b><span>Counted damage only</span></div>'+ 
      '<div class="card"><b>'+fmt(bestRow ? bestRow.damage : 0)+'</b><span>Best window damage</span></div>'+ 
      '<div class="card"><b>'+esc(bestRow ? bestRow.player : '-')+'</b><span>Best player window</span></div>'+ 
      '<div class="card"><b>'+esc(bestRow ? bestRow.artifact : '-')+'</b><span>Best artifact window</span></div>'+ 
      '</div>'+ 
      '<h3>Artifact windows</h3><p class="mut">This is the only main Arti Call table: player, artifact, and damage stats inside that player’s selected timer.</p>'+artiMainTable(rows)+
      selectedDetails(result)+
      '<details class="arti-raw"><summary>Show artifact timers found in this log</summary><p class="mut">Uses and gaps are observed from this uploaded log. They are not used to count damage; your selected damage window is.</p>'+table(timers,[['artifact','Artifact / effect'],['uses','Uses'],['users','Users'],['firstUse','First use'],['lastUse','Last use'],['minGap','Shortest gap'],['avgGap','Average gap'],['windowSeconds','Current damage window'],['knownCooldownSeconds','Known cooldown']])+'</details>'+ 
      '</section>';
    bindControls();
    bindWindowRows();
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

  const css = '.arti-call-panel,.arti-call-panel *{border-radius:0!important}.arti-hero{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:18px;align-items:start;border:1px solid #d8e2ec;background:#fff;padding:14px;margin-bottom:16px}.arti-hero h2{margin:4px 0}.arti-window{border:1px solid #0e1b27;background:#0e1b27;color:#fff;text-align:center;font-size:32px;font-weight:1000;line-height:1;padding:18px 8px}.arti-window small{display:block;margin-top:6px;color:#9fead8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.arti-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;border:1px solid #d8e2ec;background:#f7fafc;padding:12px;margin:0 0 16px}.arti-controls label{display:flex;align-items:center;gap:8px;font-weight:900;color:#23344a}.arti-controls input[type=number]{width:84px;background:#fff;color:#101923;border:1px solid #b8c5d3;padding:8px}.arti-controls button{background:#0e1b27!important;color:#fff!important;border:1px solid #0e1b27!important;padding:9px 14px!important;font-weight:1000}.arti-check input{width:16px;height:16px}.arti-table td:first-child,.arti-table th:first-child{min-width:190px}.artiIcon{width:24px!important;height:24px!important;vertical-align:middle;margin-right:8px;border:1px solid #cbd8e5}.arti-call-panel h3{margin-top:22px!important}.arti-call-panel .mut{max-width:980px}.arti-window-table tr{cursor:pointer}.arti-window-table tr.is-selected{background:#eafaf6!important;outline:2px solid #32b999}.arti-window-table tr:hover{background:#f4f8fb}.arti-link{border:0;background:transparent;color:#071320;font-weight:1000;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.arti-window-table small{display:block;color:#69788c;font-size:11px;margin-top:3px}.arti-detail{border:1px solid #d8e2ec;background:#fff;margin-top:18px;padding:14px}.muted-detail{color:#64748b;background:#f8fafc}.arti-detail-head{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:16px;align-items:start}.arti-detail-head b{display:block;font-size:24px}.arti-detail-head span{font-size:11px;text-transform:uppercase;font-weight:900;color:#526174}.arti-raw{border:1px solid #d8e2ec;margin-top:18px;padding:12px;background:#fbfdff}.arti-raw summary{font-weight:1000;cursor:pointer}@media(max-width:800px){.arti-hero,.arti-detail-head{grid-template-columns:1fr}.arti-window{font-size:24px}}';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureTab); else ensureTab();
})();
