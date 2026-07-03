(function(){
  const WINDOW_SECONDS = 15;
  const SAME_ARTI_COOLDOWN_SECONDS = 10;
  const SG = window.SG || {};
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const esc = value => SG.escape ? SG.escape(value) : String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = value => { try { return window.fmt ? window.fmt(value) : Math.round(value || 0).toLocaleString(); } catch (_) { return String(value || 0); } };
  const num = value => Math.round(Number(value) || 0).toLocaleString();
  const pct = value => (Number(value) || 0).toFixed(1) + '%';
  const sec = value => (Number(value) || 0).toFixed(1) + 's';
  const dur = value => { try { return window.dur ? window.dur(value) : Math.round(value || 0) + 's'; } catch (_) { return String(value || 0) + 's'; } };
  const norm = value => (window.NWAssets && NWAssets.norm) ? NWAssets.norm(value) : String(value || '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  const knownArtifactNames = new Set([
    'blood crystal raven skull','blood lust','tentacle slam','eye of the giant','mythallar fragment','sparkling fey emblem','wyvern venom coated knives','charm of the serpent','thayan book of the dead','lantern of revelation','sigil of the controller','sigil of the devoted','sigil of the great weapon','sigil of the guardian','sigil of the hunter','sigil of the oathbound paladin','sigil of the scourge','sigil of the trickster','horn of blasting','champion battle horn','blast scepter','wheel of elements','heart of the black dragon','heart of the blue dragon','heart of the green dragon','heart of the red dragon','heart of the white dragon','storyteller journal','frozen journal','flayed storyteller journal','darkened storyteller journal','envenomed storyteller journal','owlbear figurine','empowered owlbear figurine','realm engine blast','ethereal vortex','savage pincers','conflagrate','spined devils influence','winters wrath','mark of the giant slayer'
  ]);
  const artifactWords = ['artifact','sigil','journal','emblem','lantern','horn','skull','crystal','mythallar','scepter','wheel','heart','book','knives','serpent','giant slayer','figurine','vortex','tentacle','blood lust','raven','pincers','conflagrate'];

  function categoryOf(power){ try { return window.NWParser && NWParser.category ? NWParser.category(power) : 'Other / Unknown'; } catch (_) { return 'Other / Unknown'; } }
  function isPlayer(id){ return String(id || '').startsWith('P['); }
  function isDamage(row){ return window.NWParser && NWParser.isDamage ? NWParser.isDamage(row) : row.damageType === 'Physical' && row.amount > 0; }
  function icon(name){ return window.NWAssets && NWAssets.powerHtml ? NWAssets.powerHtml(name, 'Artifact', 'artiIcon') : ''; }
  function confidenceLabel(score){ if(score >= 80) return 'High'; if(score >= 50) return 'Medium'; return 'Review'; }

  function artifactScore(row){
    const text = norm([row.powerName, row.sourceName, row.ownerName, row.powerId, row.sourceId].join(' '));
    const power = norm(row.powerName);
    const category = categoryOf(row.powerName);
    let score = 0;
    if(knownArtifactNames.has(power)) score += 90;
    if(category === 'Artifact') score += 90;
    if(category === 'Item / Enchant') score += 45;
    for(const word of artifactWords){ if(text.includes(norm(word))) score += 20; }
    if(category === 'Mount' || category === 'Pet / Companion' || category === 'At-Will' || category === 'Encounter' || category === 'Daily' || category === 'Feat' || category === 'Class Feature') score -= 55;
    if(/companion|pet|summon|appointment|mount power/.test(text)) score -= 45;
    if(/enchant|overload|poison|weapon enchant|armor enchant/.test(text)) score -= 15;
    return Math.max(0, Math.min(100, score));
  }

  function candidateArtifactRows(rows){
    return rows.filter(row => isPlayer(row.ownerId) && row.powerName && artifactScore(row) >= 40)
      .sort((a,b) => a.time - b.time || a.lineNo - b.lineNo);
  }

  function dedupeCalls(rows){
    const lastByKey = new Map();
    const calls = [];
    for(const row of candidateArtifactRows(rows)){
      const key = row.ownerId + '|' + norm(row.powerName);
      const previous = lastByKey.get(key);
      if(previous != null && row.time - previous < SAME_ARTI_COOLDOWN_SECONDS) continue;
      lastByKey.set(key, row.time);
      calls.push(row);
    }
    return calls;
  }

  function indexDamageRows(rows, players){
    const map = new Map();
    const valid = window.NWParser && NWParser.validForPlayer;
    for(const player of players){
      const list = valid ? NWParser.validForPlayer(rows, player.id, { includeCompanions: true }) : rows.filter(row => row.ownerId === player.id && isDamage(row));
      map.set(player.id, list.sort((a,b) => a.time - b.time || a.lineNo - b.lineNo));
    }
    return map;
  }

  function rowsInWindow(sortedRows, start, end){
    const out = [];
    for(const row of sortedRows || []){
      if(row.time < start) continue;
      if(row.time > end) break;
      out.push(row);
    }
    return out;
  }

  function topPower(windowRows){
    const map = new Map();
    for(const row of windowRows){ map.set(row.powerName, (map.get(row.powerName) || 0) + row.amount); }
    let best = null;
    for(const [power, damage] of map){ if(!best || damage > best.damage) best = { power, damage }; }
    return best || { power:'-', damage:0 };
  }

  function analyze(rows, players){
    const playerMap = new Map(players.map(player => [player.id, player]));
    const damageByPlayer = indexDamageRows(rows, players);
    const calls = dedupeCalls(rows);
    const windows = calls.map((call, index) => {
      const player = playerMap.get(call.ownerId) || { id: call.ownerId, name: call.ownerName || 'Unknown' };
      const start = call.time;
      const end = call.time + WINDOW_SECONDS;
      const playerDamageRows = rowsInWindow(damageByPlayer.get(call.ownerId) || [], start, end);
      const directRows = playerDamageRows.filter(row => norm(row.powerName) === norm(call.powerName));
      const damage = playerDamageRows.reduce((total,row) => total + row.amount, 0);
      const directDamage = directRows.reduce((total,row) => total + row.amount, 0);
      const top = topPower(playerDamageRows);
      const crits = directRows.filter(row => row.flags && row.flags.has && row.flags.has('Critical')).length;
      const score = artifactScore(call);
      return {
        id: index + 1,
        playerId: player.id,
        player: player.name,
        artifact: call.powerName,
        category: categoryOf(call.powerName),
        time: start,
        windowEnd: end,
        windowDamage: damage,
        windowDps: damage / WINDOW_SECONDS,
        directDamage,
        directHits: directRows.length,
        directAvg: directRows.length ? directDamage / directRows.length : 0,
        directMax: directRows.length ? Math.max(...directRows.map(row => row.amount)) : 0,
        directCrit: directRows.length ? crits / directRows.length * 100 : 0,
        followUpPower: top.power,
        followUpDamage: top.damage,
        score,
        confidence: confidenceLabel(score)
      };
    });
    return { windows, byPlayer: aggregateByPlayer(windows), byArtifact: aggregateByArtifact(windows), direct: aggregateDirect(windows) };
  }

  function aggregateByPlayer(windows){
    const map = new Map();
    for(const row of windows){
      if(!map.has(row.player)) map.set(row.player, { player: row.player, calls: 0, windowDamage: 0, directDamage: 0, bestCall: 0, bestArtifact: '-', uniqueArtifacts: new Set() });
      const item = map.get(row.player);
      item.calls++;
      item.windowDamage += row.windowDamage;
      item.directDamage += row.directDamage;
      item.uniqueArtifacts.add(row.artifact);
      if(row.windowDamage > item.bestCall){ item.bestCall = row.windowDamage; item.bestArtifact = row.artifact; }
    }
    return Array.from(map.values()).map(item => ({
      player: item.player,
      calls: item.calls,
      artifacts: item.uniqueArtifacts.size,
      windowDamage: item.windowDamage,
      avgWindowDamage: item.calls ? item.windowDamage / item.calls : 0,
      directDamage: item.directDamage,
      bestCall: item.bestCall,
      bestArtifact: item.bestArtifact
    })).sort((a,b) => b.windowDamage - a.windowDamage);
  }

  function aggregateByArtifact(windows){
    const map = new Map();
    for(const row of windows){
      if(!map.has(row.artifact)) map.set(row.artifact, { artifact: row.artifact, calls: 0, users: new Set(), windowDamage: 0, directDamage: 0, directHits: 0, bestUser: '-', bestCall: 0, confidence: row.confidence });
      const item = map.get(row.artifact);
      item.calls++;
      item.users.add(row.player);
      item.windowDamage += row.windowDamage;
      item.directDamage += row.directDamage;
      item.directHits += row.directHits;
      if(row.windowDamage > item.bestCall){ item.bestCall = row.windowDamage; item.bestUser = row.player; }
    }
    return Array.from(map.values()).map(item => ({
      artifact: item.artifact,
      calls: item.calls,
      users: item.users.size,
      windowDamage: item.windowDamage,
      avgWindowDamage: item.calls ? item.windowDamage / item.calls : 0,
      directDamage: item.directDamage,
      directHits: item.directHits,
      bestUser: item.bestUser,
      bestCall: item.bestCall,
      confidence: item.confidence
    })).sort((a,b) => b.windowDamage - a.windowDamage);
  }

  function aggregateDirect(windows){
    return windows.filter(row => row.directDamage > 0).map(row => ({
      player: row.player,
      artifact: row.artifact,
      directDamage: row.directDamage,
      directHits: row.directHits,
      directAvg: row.directAvg,
      directMax: row.directMax,
      directCrit: row.directCrit,
      time: row.time,
      confidence: row.confidence
    })).sort((a,b) => b.directDamage - a.directDamage);
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
    return '<div class="table arti-table"><table><thead><tr>' + cols.map(col => '<th>' + esc(col[1]) + '</th>').join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(row => '<tr>' + cols.map(col => '<td>' + cell(row[col[0]], col[0]) + '</td>').join('') + '</tr>').join('') : '<tr><td class="empty" colspan="' + cols.length + '">No artifact calls found in this view.</td></tr>') +
      '</tbody></table></div>';
  }

  function renderArtiCall(){
    if(typeof state === 'undefined') return;
    const content = q('#content');
    if(!content) return;
    if(!state.rows || !state.rows.length){ content.innerHTML = '<section class="panel"><div class="empty">Upload a combat log first.</div></section>'; return; }
    const rows = typeof scopeRows === 'function' ? scopeRows() : state.rows;
    const players = state.players || [];
    const result = analyze(rows, players);
    const best = result.windows[0] || null;
    const totalWindow = result.windows.reduce((total,row) => total + row.windowDamage, 0);
    const totalDirect = result.windows.reduce((total,row) => total + row.directDamage, 0);
    const playerHead = typeof playerHeader === 'function' ? playerHeader() : '';
    content.innerHTML = playerHead + '<section class="panel arti-call-panel"><div class="arti-hero"><div><span class="eyebrow">Arti Call</span><h2>15-second damage after artifact use</h2><p class="mut">This looks across all players in the selected fight. When an artifact-like power is used, Strikeglass measures how much damage that player did in the next 15 seconds. It is a call-window checker, not magic. Sadly.</p></div><div class="arti-window">15s<br><small>after use</small></div></div>'+
      '<div class="cards">'+
      '<div class="card"><b>'+num(result.windows.length)+'</b><span>Artifact calls found</span></div>'+
      '<div class="card"><b>'+fmt(totalWindow)+'</b><span>Damage inside call windows</span></div>'+
      '<div class="card"><b>'+fmt(totalDirect)+'</b><span>Direct artifact damage</span></div>'+
      '<div class="card"><b>'+esc(best ? best.player : '-')+'</b><span>Best call player</span></div>'+
      '<div class="card"><b>'+fmt(best ? best.windowDamage : 0)+'</b><span>Best 15s call damage</span></div>'+
      '<div class="card"><b>'+esc(best ? best.artifact : '-')+'</b><span>Best call artifact</span></div>'+
      '</div>'+
      '<h3>Call windows</h3><p class="mut">Use this to check if the party actually burst after artifact calls. High window damage means the call was followed by real output.</p>'+table(result.windows,[['id','#'],['player','Player'],['artifact','Artifact / effect'],['time','Used at'],['windowDamage','Damage next 15s'],['windowDps','15s DPS'],['directDamage','Artifact damage'],['directHits','Artifact hits'],['followUpPower','Top follow-up'],['confidence','Match']])+
      '<h3>By player</h3>'+table(result.byPlayer,[['player','Player'],['calls','Calls'],['artifacts','Different artifacts'],['windowDamage','Total 15s damage'],['avgWindowDamage','Avg after call'],['directDamage','Direct artifact damage'],['bestCall','Best call'],['bestArtifact','Best artifact']])+
      '<h3>By artifact</h3>'+table(result.byArtifact,[['artifact','Artifact / effect'],['calls','Calls'],['users','Users'],['windowDamage','Total 15s damage'],['avgWindowDamage','Avg after call'],['directDamage','Direct damage'],['directHits','Direct hits'],['bestUser','Best user'],['bestCall','Best call']])+
      '<h3>Direct artifact damage rows</h3>'+table(result.direct,[['player','Player'],['artifact','Artifact / effect'],['directDamage','Damage'],['directHits','Hits'],['directAvg','Avg hit'],['directMax','Max hit'],['directCrit','Crit%'],['time','First call'],['confidence','Match']])+
      '<p class="mut">Detection is based on known artifact names, artifact asset wording, and item/enchant-style combat log names. Rows marked Review may need icon/category mapping later because Neverwinter logs, apparently, enjoy being cryptic little goblins.</p></section>';
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
      if(typeof renderPlayers === 'function') renderPlayers();
      if(typeof renderChips === 'function') renderChips();
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
  window.StrikeglassArtiCall = { analyze };
})();
