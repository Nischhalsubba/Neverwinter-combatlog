(function(){
  const SG = window.SG || {};
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const esc = value => SG.escape ? SG.escape(value) : String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = value => { try { return window.fmt ? window.fmt(value) : Math.round(value || 0).toLocaleString(); } catch (_) { return String(value || 0); } };
  const num = value => Math.round(Number(value) || 0).toLocaleString();
  const pct = value => (Number(value) || 0).toFixed(1) + '%';
  const sec = value => (Number(value) || 0).toFixed(1) + 's';
  function icon(name){ return window.NWAssets && NWAssets.powerHtml ? NWAssets.powerHtml(name, 'Artifact', 'artiIcon') : ''; }

  function reportForCurrentView(){
    if(typeof state === 'undefined') return null;
    if(state.artiReport) return state.artiReport;
    if(window.SGArtifactWindow && state.rows && state.rows.length){
      const rows = typeof scopeRows === 'function' ? scopeRows() : state.rows;
      return window.SGArtifactWindow.analyze(rows, state.players || []);
    }
    return null;
  }

  function cell(value, key){
    if(value == null) return '-';
    if(['windowDamage','avgWindowDamage','directDamage','directAvg','directMax','bestCall','followUpDamage','windowDps'].includes(key)) return fmt(value);
    if(['time','windowEnd'].includes(key)) return sec(value);
    if(['directCrit'].includes(key)) return pct(value);
    if(['calls','users','artifacts','directHits','id'].includes(key)) return num(value);
    if(key === 'artifact') return icon(value) + ' <b>' + esc(value) + '</b>';
    return esc(value);
  }
  function table(rows, cols){
    rows = rows || [];
    return '<div class="table arti-table"><table><thead><tr>' + cols.map(col => '<th>' + esc(col[1]) + '</th>').join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(row => '<tr>' + cols.map(col => '<td>' + cell(row[col[0]], col[0]) + '</td>').join('') + '</tr>').join('') : '<tr><td class="empty" colspan="' + cols.length + '">No artifact calls found in this view.</td></tr>') +
      '</tbody></table></div>';
  }

  function renderFromReport(result){
    const content = q('#content');
    if(!content) return;
    const windows = result && result.windows ? result.windows : [];
    const best = windows[0] || null;
    const totalWindow = windows.reduce((total,row) => total + (row.windowDamage || 0), 0);
    const totalDirect = windows.reduce((total,row) => total + (row.directDamage || 0), 0);
    const playerHead = (!state.summaryOnly && typeof playerHeader === 'function') ? playerHeader() : '';
    const modeNote = state.summaryOnly ? 'This view is using the worker prebuilt report, so it does not scan the huge raw log again. That is the point, because browsers are not immortal.' : 'This uses the selected fight filter when raw rows are available.';
    content.innerHTML = playerHead + '<section class="panel arti-call-panel"><div class="arti-hero"><div><span class="eyebrow">Arti Call</span><h2>15-second damage after artifact use</h2><p class="mut">When an artifact-like effect is used, Strikeglass checks how much damage that player did in the next 15 seconds. '+esc(modeNote)+'</p></div><div class="arti-window">15s<br><small>after use</small></div></div>'+
      '<div class="cards">'+
      '<div class="card"><b>'+num(windows.length)+'</b><span>Artifact calls found</span></div>'+
      '<div class="card"><b>'+fmt(totalWindow)+'</b><span>Damage inside call windows</span></div>'+
      '<div class="card"><b>'+fmt(totalDirect)+'</b><span>Direct artifact damage</span></div>'+
      '<div class="card"><b>'+esc(best ? best.player : '-')+'</b><span>Best call player</span></div>'+
      '<div class="card"><b>'+fmt(best ? best.windowDamage : 0)+'</b><span>Best 15s call damage</span></div>'+
      '<div class="card"><b>'+esc(best ? best.artifact : '-')+'</b><span>Best call artifact</span></div>'+
      '</div>'+
      '<h3>Call windows</h3><p class="mut">Use this to check if players actually burst after artifact calls. High window damage means the call was followed by real output.</p>'+table(windows,[['id','#'],['player','Player'],['artifact','Artifact / effect'],['time','Used at'],['windowDamage','Damage next 15s'],['windowDps','15s DPS'],['directDamage','Artifact damage'],['directHits','Artifact hits'],['followUpPower','Top follow-up'],['confidence','Match']])+
      '<h3>By player</h3>'+table(result.byPlayer,[['player','Player'],['calls','Calls'],['artifacts','Different artifacts'],['windowDamage','Total 15s damage'],['avgWindowDamage','Avg after call'],['directDamage','Direct artifact damage'],['bestCall','Best call'],['bestArtifact','Best artifact']])+
      '<h3>By artifact</h3>'+table(result.byArtifact,[['artifact','Artifact / effect'],['calls','Calls'],['users','Users'],['windowDamage','Total 15s damage'],['avgWindowDamage','Avg after call'],['directDamage','Direct damage'],['directHits','Direct hits'],['bestUser','Best user'],['bestCall','Best call']])+
      '<h3>Direct artifact damage rows</h3>'+table(result.direct,[['player','Player'],['artifact','Artifact / effect'],['directDamage','Damage'],['directHits','Hits'],['directAvg','Avg hit'],['directMax','Max hit'],['directCrit','Crit%'],['time','First call'],['confidence','Match']])+
      '<p class="mut">Rows marked Review may need more mapping later. The app is careful here because combat logs are weird little paperwork monsters.</p></section>';
  }

  function renderArtiCall(){
    const content = q('#content');
    if(!content) return;
    if(typeof state === 'undefined' || ((!state.rows || !state.rows.length) && !state.artiReport)){
      content.innerHTML = '<section class="panel"><div class="empty">Upload a combat log first.</div></section>';
      return;
    }
    content.innerHTML = '<section class="panel"><h2>Preparing Arti Call...</h2><p class="mut">Using the prebuilt worker report when available so this tab does not freeze the app.</p></section>';
    requestAnimationFrame(function(){
      const result = reportForCurrentView();
      if(!result){ content.innerHTML = '<section class="panel"><div class="empty">No Arti Call data available for this log.</div></section>'; return; }
      renderFromReport(result);
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

  const css = '.arti-call-panel,.arti-call-panel *{border-radius:0!important}.arti-hero{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:18px;align-items:start;border:1px solid #d8e2ec;background:#fff;padding:14px;margin-bottom:16px}.arti-hero h2{margin:4px 0}.arti-window{border:1px solid #0e1b27;background:#0e1b27;color:#fff;text-align:center;font-size:32px;font-weight:1000;line-height:1;padding:18px 8px}.arti-window small{display:block;margin-top:6px;color:#9fead8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.arti-table td:first-child,.arti-table th:first-child{width:52px}.artiIcon{width:24px!important;height:24px!important;vertical-align:middle;margin-right:8px;border:1px solid #cbd8e5}.arti-call-panel h3{margin-top:22px!important}.arti-call-panel .mut{max-width:980px}@media(max-width:800px){.arti-hero{grid-template-columns:1fr}.arti-window{font-size:24px}}';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureTab); else ensureTab();
})();
