(function(){
  const DEFAULT_WINDOW_SECONDS = 15;
  const SAME_CALL_GAP_SECONDS = 10;
  const NW = window.NWParser;
  if(!NW) return;

  const norm = value => String(value || '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const knownNames = new Set([
    'blood crystal raven skull','blood lust','tentacle slam','eye of the giant','mythallar fragment','sparkling fey emblem','charm of the serpent','thayan book of the dead','lantern of revelation','sigil of the controller','sigil of the devoted','sigil of the great weapon','sigil of the guardian','sigil of the hunter','sigil of the oathbound paladin','sigil of the scourge','sigil of the trickster','horn of blasting','champion battle horn','blast scepter','wheel of elements','heart of the black dragon','heart of the blue dragon','heart of the green dragon','heart of the red dragon','heart of the white dragon','storyteller journal','frozen journal','flayed storyteller journal','darkened storyteller journal','envenomed storyteller journal','owlbear figurine','empowered owlbear figurine','realm engine blast','ethereal vortex','conflagrate','spined devils influence','winters wrath','mark of the giant slayer'
  ]);
  const artifactWords = ['artifact','sigil','journal','emblem','lantern','horn','skull','crystal','mythallar','scepter','wheel','heart','book','serpent','giant slayer','figurine','vortex','tentacle','blood lust','raven','conflagrate'];

  function clampWindow(value){
    const n = Number(value || DEFAULT_WINDOW_SECONDS);
    return Math.max(3, Math.min(60, Number.isFinite(n) ? n : DEFAULT_WINDOW_SECONDS));
  }
  function isPlayer(id){ return String(id || '').startsWith('P['); }
  function categoryOf(power){ try { return NW.category ? NW.category(power) : 'Other / Unknown'; } catch (_) { return 'Other / Unknown'; } }
  function confidenceLabel(score){ if(score >= 80) return 'High'; if(score >= 50) return 'Medium'; return 'Review'; }
  function artifactScore(row){
    const text = norm([row.powerName, row.sourceName, row.ownerName, row.powerId, row.sourceId].join(' '));
    const power = norm(row.powerName);
    const category = categoryOf(row.powerName);
    let score = 0;
    if(knownNames.has(power)) score += 90;
    if(category === 'Artifact') score += 90;
    if(category === 'Item / Enchant') score += 45;
    for(const word of artifactWords) if(text.includes(norm(word))) score += 20;
    if(category === 'Mount' || category === 'Pet / Companion' || category === 'At-Will' || category === 'Encounter' || category === 'Daily' || category === 'Feat' || category === 'Class Feature') score -= 55;
    if(/companion|pet|summon|appointment|mount power/.test(text)) score -= 45;
    if(/enchant|overload/.test(text)) score -= 15;
    return Math.max(0, Math.min(100, score));
  }
  function candidateRows(rows){
    const out = [];
    for(const row of rows){
      if(isPlayer(row.ownerId) && row.powerName && artifactScore(row) >= 40) out.push(row);
    }
    return out.sort((a,b) => a.time - b.time || a.lineNo - b.lineNo);
  }
  function dedupeCalls(rows){
    const lastByKey = new Map();
    const calls = [];
    for(const row of candidateRows(rows)){
      const key = row.ownerId + '|' + norm(row.powerName);
      const previous = lastByKey.get(key);
      if(previous != null && row.time - previous < SAME_CALL_GAP_SECONDS) continue;
      lastByKey.set(key, row.time);
      calls.push(row);
    }
    return calls;
  }
  function lowerBound(rows, start){
    let lo = 0, hi = rows.length;
    while(lo < hi){
      const mid = (lo + hi) >> 1;
      if(rows[mid].time < start) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function rowsInWindow(sortedRows, start, end){
    const out = [];
    const rows = sortedRows || [];
    for(let i = lowerBound(rows, start); i < rows.length; i++){
      const row = rows[i];
      if(row.time > end) break;
      out.push(row);
    }
    return out;
  }
  function indexDamageRows(rows, players, includeCompanions){
    const map = new Map();
    for(const player of players){
      const list = NW.validForPlayer ? NW.validForPlayer(rows, player.id, { includeCompanions }) : rows.filter(row => row.ownerId === player.id && NW.isDamage(row));
      map.set(player.id, list.sort((a,b) => a.time - b.time || a.lineNo - b.lineNo));
    }
    return map;
  }
  function topPower(windowRows){
    const map = new Map();
    for(const row of windowRows) map.set(row.powerName, (map.get(row.powerName) || 0) + row.amount);
    let best = null;
    for(const [power, damage] of map) if(!best || damage > best.damage) best = { power, damage };
    return best || { power:'-', damage:0 };
  }
  function aggregateByPlayer(windows){
    const map = new Map();
    for(const row of windows){
      for(const playerRow of row.players || []){
        if(!map.has(playerRow.player)) map.set(playerRow.player, { player: playerRow.player, calls: 0, windowDamage: 0, bestCall: 0, bestArtifact: '-', uniqueArtifacts: new Set() });
        const item = map.get(playerRow.player);
        item.calls++;
        item.windowDamage += playerRow.damage;
        item.uniqueArtifacts.add(row.artifact);
        if(playerRow.damage > item.bestCall){ item.bestCall = playerRow.damage; item.bestArtifact = row.artifact; }
      }
    }
    return Array.from(map.values()).map(item => ({ player:item.player, calls:item.calls, artifacts:item.uniqueArtifacts.size, windowDamage:item.windowDamage, avgWindowDamage:item.calls ? item.windowDamage / item.calls : 0, bestCall:item.bestCall, bestArtifact:item.bestArtifact })).sort((a,b) => b.windowDamage - a.windowDamage);
  }
  function aggregateByCaller(windows){
    const map = new Map();
    for(const row of windows){
      if(!map.has(row.player)) map.set(row.player, { player: row.player, calls: 0, callerDamage: 0, directDamage: 0, bestCall: 0, bestArtifact: '-', uniqueArtifacts: new Set() });
      const item = map.get(row.player);
      item.calls++;
      item.callerDamage += row.callerDamage;
      item.directDamage += row.directDamage;
      item.uniqueArtifacts.add(row.artifact);
      if(row.callerDamage > item.bestCall){ item.bestCall = row.callerDamage; item.bestArtifact = row.artifact; }
    }
    return Array.from(map.values()).map(item => ({ player:item.player, calls:item.calls, artifacts:item.uniqueArtifacts.size, callerDamage:item.callerDamage, avgCallerDamage:item.calls ? item.callerDamage / item.calls : 0, directDamage:item.directDamage, bestCall:item.bestCall, bestArtifact:item.bestArtifact })).sort((a,b) => b.callerDamage - a.callerDamage);
  }
  function aggregateByArtifact(windows){
    const map = new Map();
    for(const row of windows){
      if(!map.has(row.artifact)) map.set(row.artifact, { artifact: row.artifact, calls: 0, users: new Set(), partyDamage: 0, callerDamage: 0, directDamage: 0, directHits: 0, bestUser: '-', bestCall: 0, confidence: row.confidence });
      const item = map.get(row.artifact);
      item.calls++;
      item.users.add(row.player);
      item.partyDamage += row.partyDamage;
      item.callerDamage += row.callerDamage;
      item.directDamage += row.directDamage;
      item.directHits += row.directHits;
      if(row.partyDamage > item.bestCall){ item.bestCall = row.partyDamage; item.bestUser = row.player; }
    }
    return Array.from(map.values()).map(item => ({ artifact:item.artifact, calls:item.calls, users:item.users.size, partyDamage:item.partyDamage, avgPartyDamage:item.calls ? item.partyDamage / item.calls : 0, callerDamage:item.callerDamage, directDamage:item.directDamage, directHits:item.directHits, bestUser:item.bestUser, bestCall:item.bestCall, confidence:item.confidence })).sort((a,b) => b.partyDamage - a.partyDamage);
  }
  function aggregateDirect(windows){
    return windows.filter(row => row.directDamage > 0).map(row => ({ player:row.player, artifact:row.artifact, directDamage:row.directDamage, directHits:row.directHits, directAvg:row.directAvg, directMax:row.directMax, directCrit:row.directCrit, time:row.time, confidence:row.confidence })).sort((a,b) => b.directDamage - a.directDamage);
  }
  function analyze(rows, players, options = {}){
    rows = rows || [];
    players = players && players.length ? players : NW.detectPlayers(rows);
    const windowSeconds = clampWindow(options.windowSeconds);
    const includeCompanions = options.includeCompanions !== false;
    const playerMap = new Map(players.map(player => [player.id, player]));
    const damageByPlayer = indexDamageRows(rows, players, includeCompanions);
    const calls = dedupeCalls(rows);
    const windows = calls.map((call, index) => {
      const caller = playerMap.get(call.ownerId) || { id: call.ownerId, name: call.ownerName || 'Unknown' };
      const start = call.time;
      const end = call.time + windowSeconds;
      const playerBreakdown = [];
      let partyDamage = 0;
      for(const player of players){
        const windowRows = rowsInWindow(damageByPlayer.get(player.id) || [], start, end);
        const damage = windowRows.reduce((total,row) => total + row.amount, 0);
        if(damage > 0){
          partyDamage += damage;
          playerBreakdown.push({ playerId: player.id, player: player.name, damage, dps: damage / windowSeconds, hits: windowRows.length });
        }
      }
      playerBreakdown.sort((a,b) => b.damage - a.damage);
      playerBreakdown.forEach(row => { row.share = partyDamage ? row.damage / partyDamage * 100 : 0; });
      const callerRows = rowsInWindow(damageByPlayer.get(call.ownerId) || [], start, end);
      const directRows = callerRows.filter(row => norm(row.powerName) === norm(call.powerName));
      const callerDamage = callerRows.reduce((total,row) => total + row.amount, 0);
      const directDamage = directRows.reduce((total,row) => total + row.amount, 0);
      const top = topPower(callerRows);
      const topPlayer = playerBreakdown[0] || { player:'-', damage:0 };
      const crits = directRows.filter(row => row.flags && row.flags.has && row.flags.has('Critical')).length;
      const score = artifactScore(call);
      return { id:index + 1, playerId:caller.id, player:caller.name, artifact:call.powerName, category:categoryOf(call.powerName), time:start, windowEnd:end, windowSeconds, includeCompanions, partyDamage, partyDps:partyDamage / windowSeconds, callerDamage, callerDps:callerDamage / windowSeconds, directDamage, directHits:directRows.length, directAvg:directRows.length ? directDamage / directRows.length : 0, directMax:directRows.length ? Math.max(...directRows.map(row => row.amount)) : 0, directCrit:directRows.length ? crits / directRows.length * 100 : 0, topPlayer:topPlayer.player, topPlayerDamage:topPlayer.damage, followUpPower:top.power, followUpDamage:top.damage, players:playerBreakdown, score, confidence:confidenceLabel(score) };
    });
    const perCallPlayers = windows.flatMap(row => (row.players || []).map(player => ({ callId: row.id, artifact: row.artifact, caller: row.player, time: row.time, player: player.player, damage: player.damage, dps: player.dps, hits: player.hits, share: player.share })));
    return { version:2, windowSeconds, includeCompanions, rowCount:rows.length, callCount:windows.length, windows, byPlayer:aggregateByPlayer(windows), byCaller:aggregateByCaller(windows), byArtifact:aggregateByArtifact(windows), direct:aggregateDirect(windows), perCallPlayers };
  }
  window.SGArtifactWindow = { analyze, artifactScore, windowSeconds: DEFAULT_WINDOW_SECONDS };
})();
