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
  const artifactCatalog = Array.from(knownNames).reduce((map, name) => {
    map[name] = { name, defaultWindowSeconds: DEFAULT_WINDOW_SECONDS, knownCooldownSeconds: null };
    return map;
  }, {});

  function clampWindow(value){
    const n = Number(value || DEFAULT_WINDOW_SECONDS);
    return Math.max(3, Math.min(60, Number.isFinite(n) ? n : DEFAULT_WINDOW_SECONDS));
  }
  function isPlayer(id){ return String(id || '').startsWith('P['); }
  function categoryOf(power){ try { return NW.category ? NW.category(power) : 'Other / Unknown'; } catch (_) { return 'Other / Unknown'; } }
  function confidenceLabel(score){ if(score >= 80) return 'High'; if(score >= 50) return 'Medium'; return 'Review'; }
  function isCompanion(row){ try { return NW.isCompanionRow ? NW.isCompanionRow(row) : categoryOf(row.powerName) === 'Pet / Companion'; } catch (_) { return false; } }
  function isCrit(row){ return !!(row.flags && row.flags.has && row.flags.has('Critical')); }
  function isFlank(row){ return !!(row.flags && row.flags.has && (row.flags.has('Flank') || row.flags.has('CombatAdvantage'))); }
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
  function buildBurstWindows(callRows, windowSeconds){
    const windows = [];
    let active = null;
    for(const call of callRows){
      if(!active || call.time > active.end){
        active = { id: windows.length + 1, start: call.time, end: call.time + windowSeconds, calls: [] };
        windows.push(active);
      }
      active.calls.push(call);
    }
    return windows;
  }
  function observedArtifactTimers(callRows, windowSeconds){
    const map = new Map();
    for(const call of callRows){
      const key = norm(call.powerName);
      if(!map.has(key)) map.set(key, { artifact: call.powerName, times: [], users: new Set(), knownCooldownSeconds: artifactCatalog[key]?.knownCooldownSeconds ?? null });
      const item = map.get(key);
      item.times.push(call.time);
      item.users.add(call.ownerName || 'Unknown');
    }
    return Array.from(map.values()).map(item => {
      item.times.sort((a,b) => a - b);
      const gaps = [];
      for(let i = 1; i < item.times.length; i++) gaps.push(item.times[i] - item.times[i - 1]);
      const avgGap = gaps.length ? gaps.reduce((a,b) => a + b, 0) / gaps.length : 0;
      const minGap = gaps.length ? Math.min(...gaps) : 0;
      return { artifact:item.artifact, uses:item.times.length, users:item.users.size, firstUse:item.times[0] || 0, lastUse:item.times[item.times.length - 1] || 0, minGap, avgGap, windowSeconds, knownCooldownSeconds:item.knownCooldownSeconds };
    }).sort((a,b) => b.uses - a.uses || a.artifact.localeCompare(b.artifact));
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
  function powerSummary(windowRows){
    const map = new Map();
    for(const row of windowRows){
      if(!map.has(row.powerName)) map.set(row.powerName, { power: row.powerName, damage: 0, hits: 0 });
      const item = map.get(row.powerName);
      item.damage += row.amount;
      item.hits++;
    }
    return Array.from(map.values()).sort((a,b) => b.damage - a.damage);
  }
  function topPower(windowRows){
    const list = powerSummary(windowRows);
    return list[0] || { power:'-', damage:0, hits:0 };
  }
  function companionLabel(row, player){
    const raw = row.sourceName && row.sourceName !== player.name ? row.sourceName : (row.ownerName && row.ownerName !== player.name ? row.ownerName : 'Companion');
    return raw === 'Companion' ? player.name + ' companion' : raw + ' (' + player.name + ')';
  }
  function contributionGroups(windowRows, player, windowSeconds){
    const groups = new Map();
    for(const row of windowRows){
      const companion = isCompanion(row);
      const label = companion ? companionLabel(row, player) : player.name;
      const key = (companion ? 'companion|' : 'player|') + player.id + '|' + norm(label);
      if(!groups.has(key)) groups.set(key, { participantKey:key, participant:label, owner:player.name, ownerId:player.id, sourceType: companion ? 'Companion' : 'Player', damage:0, dps:0, hits:0, crits:0, flanks:0, maxHit:0, maxPower:'-', powers:new Map() });
      const item = groups.get(key);
      item.damage += row.amount;
      item.hits++;
      if(isCrit(row)) item.crits++;
      if(isFlank(row)) item.flanks++;
      if(row.amount > item.maxHit){ item.maxHit = row.amount; item.maxPower = row.powerName; }
      if(!item.powers.has(row.powerName)) item.powers.set(row.powerName, { power: row.powerName, damage: 0, hits: 0, crits:0, flanks:0, maxHit:0 });
      const power = item.powers.get(row.powerName);
      power.damage += row.amount;
      power.hits++;
      if(isCrit(row)) power.crits++;
      if(isFlank(row)) power.flanks++;
      if(row.amount > power.maxHit) power.maxHit = row.amount;
    }
    return Array.from(groups.values()).map(item => {
      const powers = Array.from(item.powers.values()).map(power => Object.assign(power, { avgDamage: power.hits ? power.damage / power.hits : 0, crit: power.hits ? power.crits / power.hits * 100 : 0, flank: power.hits ? power.flanks / power.hits * 100 : 0 })).sort((a,b) => b.damage - a.damage);
      return Object.assign({}, item, { windowSeconds, dps: item.damage / windowSeconds, avgDamage: item.hits ? item.damage / item.hits : 0, crit: item.hits ? item.crits / item.hits * 100 : 0, flank: item.hits ? item.flanks / item.hits * 100 : 0, powers: powers.slice(0, 8), topPower: powers[0]?.power || '-', topPowerDamage: powers[0]?.damage || 0 });
    }).sort((a,b) => b.damage - a.damage);
  }
  function aggregateByParticipant(windows){
    const map = new Map();
    for(const call of windows){
      for(const part of call.participants || []){
        if(!map.has(part.participantKey)) map.set(part.participantKey, { participantKey:part.participantKey, participant:part.participant, owner:part.owner, sourceType:part.sourceType, windows:0, windowSeconds:0, damage:0, hits:0, crits:0, flanks:0, maxHit:0, maxPower:'-', bestWindow:0, bestArtifact:'-', artifactSet:new Set(), powerMap:new Map() });
        const item = map.get(part.participantKey);
        item.windows++;
        item.windowSeconds += part.windowSeconds || call.windowSeconds || 0;
        item.damage += part.damage;
        item.hits += part.hits;
        item.crits += part.crits || 0;
        item.flanks += part.flanks || 0;
        for(const artifact of part.artifactList || call.artifactList || []) item.artifactSet.add(artifact);
        if(part.maxHit > item.maxHit){ item.maxHit = part.maxHit; item.maxPower = part.maxPower; }
        if(part.damage > item.bestWindow){ item.bestWindow = part.damage; item.bestArtifact = part.artifactUsed || call.artifacts; }
        for(const power of part.powers || []){
          if(!item.powerMap.has(power.power)) item.powerMap.set(power.power, { power: power.power, damage:0, hits:0, crits:0, flanks:0, maxHit:0 });
          const p = item.powerMap.get(power.power);
          p.damage += power.damage;
          p.hits += power.hits;
          p.crits += power.crits || 0;
          p.flanks += power.flanks || 0;
          if(power.maxHit > p.maxHit) p.maxHit = power.maxHit;
        }
      }
    }
    return Array.from(map.values()).map(item => {
      const topPowers = Array.from(item.powerMap.values()).map(power => Object.assign(power, { avgDamage: power.hits ? power.damage / power.hits : 0, crit: power.hits ? power.crits / power.hits * 100 : 0, flank: power.hits ? power.flanks / power.hits * 100 : 0 })).sort((a,b) => b.damage - a.damage).slice(0, 8);
      return { participantKey:item.participantKey, participant:item.participant, owner:item.owner, sourceType:item.sourceType, windows:item.windows, artifactUsed:Array.from(item.artifactSet).join(', ') || '-', artifactList:Array.from(item.artifactSet), windowSeconds:item.windowSeconds, damage:item.damage, dps:item.windowSeconds ? item.damage / item.windowSeconds : 0, avgDamage:item.hits ? item.damage / item.hits : 0, crit:item.hits ? item.crits / item.hits * 100 : 0, flank:item.hits ? item.flanks / item.hits * 100 : 0, hits:item.hits, maxHit:item.maxHit, maxPower:item.maxPower, bestWindow:item.bestWindow, bestArtifact:item.bestArtifact, topPower:topPowers[0]?.power || '-', topPowerDamage:topPowers[0]?.damage || 0, topPowers };
    }).sort((a,b) => b.damage - a.damage);
  }
  function aggregateByPlayer(windows){
    const map = new Map();
    for(const row of windows){
      for(const playerRow of row.players || []){
        if(!map.has(playerRow.player)) map.set(playerRow.player, { player: playerRow.player, windows: 0, windowDamage: 0, bestWindow: 0, bestArtifact: '-', uniqueArtifacts: new Set() });
        const item = map.get(playerRow.player);
        item.windows++;
        item.windowDamage += playerRow.damage;
        for(const artifact of row.artifactList || []) item.uniqueArtifacts.add(artifact);
        if(playerRow.damage > item.bestWindow){ item.bestWindow = playerRow.damage; item.bestArtifact = row.artifacts; }
      }
    }
    return Array.from(map.values()).map(item => ({ player:item.player, windows:item.windows, artifacts:item.uniqueArtifacts.size, windowDamage:item.windowDamage, avgWindowDamage:item.windows ? item.windowDamage / item.windows : 0, bestWindow:item.bestWindow, bestArtifact:item.bestArtifact })).sort((a,b) => b.windowDamage - a.windowDamage);
  }
  function aggregateByCaller(windows){
    const map = new Map();
    for(const row of windows){
      for(const caller of row.callerDetails || []){
        if(!map.has(caller.playerId)) map.set(caller.playerId, { player: caller.player, windows: 0, calls: 0, callerDamage: 0, directDamage: 0, bestWindow: 0, bestArtifact: '-', uniqueArtifacts: new Set() });
        const item = map.get(caller.playerId);
        item.windows++;
        item.calls += caller.calls;
        item.callerDamage += caller.damage;
        item.directDamage += caller.directDamage;
        for(const artifact of caller.artifactList || []) item.uniqueArtifacts.add(artifact);
        if(caller.damage > item.bestWindow){ item.bestWindow = caller.damage; item.bestArtifact = row.artifacts; }
      }
    }
    return Array.from(map.values()).map(item => ({ player:item.player, windows:item.windows, calls:item.calls, artifacts:item.uniqueArtifacts.size, callerDamage:item.callerDamage, avgCallerDamage:item.windows ? item.callerDamage / item.windows : 0, directDamage:item.directDamage, bestCall:item.bestWindow, bestArtifact:item.bestArtifact })).sort((a,b) => b.callerDamage - a.callerDamage);
  }
  function aggregateByArtifact(windows){
    const map = new Map();
    for(const row of windows){
      for(const detail of row.artifactDetails || []){
        const key = norm(detail.artifact);
        if(!map.has(key)) map.set(key, { artifact: detail.artifact, windows: 0, calls: 0, users: new Set(), partyDamage: 0, callerDamage: 0, directDamage: 0, directHits: 0, bestUser: '-', bestCall: 0, confidence: detail.confidence });
        const item = map.get(key);
        item.windows++;
        item.calls += detail.calls;
        for(const user of detail.users || []) item.users.add(user);
        item.partyDamage += row.partyDamage;
        item.callerDamage += detail.callerDamage;
        item.directDamage += detail.directDamage;
        item.directHits += detail.directHits;
        if(row.partyDamage > item.bestCall){ item.bestCall = row.partyDamage; item.bestUser = detail.users[0] || row.firstCaller; }
      }
    }
    return Array.from(map.values()).map(item => ({ artifact:item.artifact, windows:item.windows, calls:item.calls, users:item.users.size, partyDamage:item.partyDamage, avgPartyDamage:item.windows ? item.partyDamage / item.windows : 0, callerDamage:item.callerDamage, directDamage:item.directDamage, directHits:item.directHits, bestUser:item.bestUser, bestCall:item.bestCall, confidence:item.confidence })).sort((a,b) => b.partyDamage - a.partyDamage);
  }
  function aggregateDirect(windows){
    return windows.filter(row => row.directDamage > 0).map(row => ({ player:row.callers, artifact:row.artifacts, directDamage:row.directDamage, directHits:row.directHits, directAvg:row.directAvg, directMax:row.directMax, directCrit:row.directCrit, time:row.time, confidence:row.confidence })).sort((a,b) => b.directDamage - a.directDamage);
  }
  function analyze(rows, players, options = {}){
    rows = rows || [];
    players = players && players.length ? players : NW.detectPlayers(rows);
    const windowSeconds = clampWindow(options.windowSeconds);
    const includeCompanions = options.includeCompanions !== false;
    const playerMap = new Map(players.map(player => [player.id, player]));
    const damageByPlayer = indexDamageRows(rows, players, includeCompanions);
    const calls = dedupeCalls(rows);
    const bursts = buildBurstWindows(calls, windowSeconds);
    const windows = bursts.map((burst, index) => {
      const first = burst.calls[0];
      const firstCaller = playerMap.get(first.ownerId) || { id:first.ownerId, name:first.ownerName || 'Unknown' };
      const artifactList = Array.from(new Set(burst.calls.map(call => call.powerName)));
      const artifactNorms = new Set(artifactList.map(norm));
      const callers = Array.from(new Set(burst.calls.map(call => (playerMap.get(call.ownerId)?.name || call.ownerName || 'Unknown'))));
      const callerIds = Array.from(new Set(burst.calls.map(call => call.ownerId)));
      const artifactsByOwner = new Map();
      for(const call of burst.calls){
        if(!artifactsByOwner.has(call.ownerId)) artifactsByOwner.set(call.ownerId, new Set());
        artifactsByOwner.get(call.ownerId).add(call.powerName);
      }
      const participants = [];
      const allWindowRows = [];
      let partyDamage = 0;
      for(const player of players){
        const windowRows = rowsInWindow(damageByPlayer.get(player.id) || [], burst.start, burst.end);
        allWindowRows.push(...windowRows);
        const groups = contributionGroups(windowRows, player, windowSeconds);
        for(const group of groups){
          const ownerArtifacts = Array.from(artifactsByOwner.get(group.ownerId) || []);
          group.artifactList = ownerArtifacts.length ? ownerArtifacts : artifactList;
          group.artifactUsed = group.artifactList.join(', ');
          partyDamage += group.damage;
          participants.push(group);
        }
      }
      participants.sort((a,b) => b.damage - a.damage);
      participants.forEach(row => { row.share = partyDamage ? row.damage / partyDamage * 100 : 0; });
      const playersOnly = new Map();
      for(const part of participants){
        if(!playersOnly.has(part.ownerId)) playersOnly.set(part.ownerId, { playerId:part.ownerId, player:part.owner, damage:0, dps:0, hits:0, share:0, crits:0, flanks:0, maxHit:0 });
        const item = playersOnly.get(part.ownerId);
        item.damage += part.damage;
        item.hits += part.hits;
        item.crits += part.crits || 0;
        item.flanks += part.flanks || 0;
        if(part.maxHit > item.maxHit) item.maxHit = part.maxHit;
      }
      const playerTotals = Array.from(playersOnly.values()).map(item => Object.assign(item, { dps:item.damage / windowSeconds, avgDamage:item.hits ? item.damage / item.hits : 0, crit:item.hits ? item.crits / item.hits * 100 : 0, flank:item.hits ? item.flanks / item.hits * 100 : 0, share: partyDamage ? item.damage / partyDamage * 100 : 0 })).sort((a,b) => b.damage - a.damage);
      const directRows = allWindowRows.filter(row => artifactNorms.has(norm(row.powerName)));
      const directDamage = directRows.reduce((total,row) => total + row.amount, 0);
      const directCrits = directRows.filter(isCrit).length;
      const directMax = directRows.length ? Math.max(...directRows.map(row => row.amount)) : 0;
      const top = topPower(allWindowRows);
      const topParticipant = participants[0] || { participant:'-', damage:0, sourceType:'-' };
      const topPlayer = playerTotals[0] || { player:'-', damage:0 };
      const callerDetails = callerIds.map(id => {
        const caller = playerMap.get(id) || { id, name:'Unknown' };
        const callRows = burst.calls.filter(call => call.ownerId === id);
        const ownerTotal = playerTotals.find(row => row.playerId === id) || { damage:0, hits:0 };
        const artifacts = Array.from(new Set(callRows.map(call => call.powerName)));
        const callerDirectRows = directRows.filter(row => row.ownerId === id);
        return { playerId:id, player:caller.name, calls:callRows.length, artifactList:artifacts, artifacts:artifacts.join(', '), damage:ownerTotal.damage, hits:ownerTotal.hits, directDamage:callerDirectRows.reduce((sum,row) => sum + row.amount, 0) };
      }).sort((a,b) => b.damage - a.damage);
      const artifactDetails = artifactList.map(artifact => {
        const artifactCalls = burst.calls.filter(call => norm(call.powerName) === norm(artifact));
        const users = Array.from(new Set(artifactCalls.map(call => playerMap.get(call.ownerId)?.name || call.ownerName || 'Unknown')));
        const artifactDirectRows = directRows.filter(row => norm(row.powerName) === norm(artifact));
        return { artifact, calls:artifactCalls.length, users, callerDamage:callerDetails.filter(caller => caller.artifactList.includes(artifact)).reduce((sum,caller) => sum + caller.damage, 0), directDamage:artifactDirectRows.reduce((sum,row) => sum + row.amount, 0), directHits:artifactDirectRows.length, confidence:confidenceLabel(Math.max(...artifactCalls.map(artifactScore))) };
      });
      const confidence = confidenceLabel(Math.max(...burst.calls.map(artifactScore)));
      return { id:index + 1, callCount:burst.calls.length, artifactCount:artifactList.length, playerId:firstCaller.id, player:firstCaller.name, firstCaller:firstCaller.name, callers:callers.join(', '), callerList:callers, artifact:artifactList[0] || '-', artifacts:artifactList.join(', '), artifactList, category:categoryOf(artifactList[0]), time:burst.start, windowEnd:burst.end, windowSeconds, includeCompanions, partyDamage, partyDps:partyDamage / windowSeconds, callerDamage:callerDetails.reduce((sum,row) => sum + row.damage, 0), callerDps:callerDetails.reduce((sum,row) => sum + row.damage, 0) / windowSeconds, directDamage, directHits:directRows.length, directAvg:directRows.length ? directDamage / directRows.length : 0, directMax, directCrit:directRows.length ? directCrits / directRows.length * 100 : 0, topPlayer:topPlayer.player, topPlayerDamage:topPlayer.damage, topParticipant:topParticipant.participant, topParticipantType:topParticipant.sourceType, topParticipantDamage:topParticipant.damage, followUpPower:top.power, followUpDamage:top.damage, players:playerTotals, participants, callerDetails, artifactDetails, score:Math.max(...burst.calls.map(artifactScore)), confidence };
    });
    const perCallPlayers = windows.flatMap(row => (row.players || []).map(player => ({ callId: row.id, artifacts: row.artifacts, artifact: row.artifacts, caller: row.callers, time: row.time, player: player.player, damage: player.damage, dps: player.dps, hits: player.hits, avgDamage: player.avgDamage, crit: player.crit, flank: player.flank, maxHit: player.maxHit, share: player.share })));
    const perCallParticipants = windows.flatMap(row => (row.participants || []).map(part => ({ callId: row.id, artifacts: row.artifacts, artifact: part.artifactUsed || row.artifacts, caller: row.callers, time: row.time, participantKey: part.participantKey, participant: part.participant, owner: part.owner, sourceType: part.sourceType, damage: part.damage, dps: part.dps, hits: part.hits, avgDamage: part.avgDamage, crit: part.crit, flank: part.flank, maxHit: part.maxHit, maxPower: part.maxPower, share: part.share, topPower: part.topPower, topPowerDamage: part.topPowerDamage })));
    const byParticipant = aggregateByParticipant(windows);
    const artifactTimers = observedArtifactTimers(calls, windowSeconds);
    return { version:5, windowSeconds, includeCompanions, rowCount:rows.length, artifactUseCount:calls.length, callCount:windows.length, windows, byParticipant, byPlayer:aggregateByPlayer(windows), byCaller:aggregateByCaller(windows), byArtifact:aggregateByArtifact(windows), artifactTimers, direct:aggregateDirect(windows), perCallPlayers, perCallParticipants };
  }
  window.SGArtifactWindow = { analyze, artifactScore, artifactCatalog, windowSeconds: DEFAULT_WINDOW_SECONDS };
})();
