(function(){
  const NW = window.NWParser;
  if(!NW) return;

  function now(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  function fmtSafe(value){ return Number.isFinite(value) ? value : 0; }
  function isPlayerId(id){ return String(id || '').startsWith('P['); }
  function isCrit(row){ return !!(row.flags && row.flags.has && row.flags.has('Critical')); }
  function isFlank(row){ return !!(row.flags && row.flags.has && (row.flags.has('Flank') || row.flags.has('CombatAdvantage'))); }
  function isCompanion(row){ try { return NW.isCompanionRow ? NW.isCompanionRow(row) : false; } catch (_) { return false; } }
  function plainEncounter(encounter, index){
    return {
      id: encounter.id || index + 1,
      label: encounter.label,
      type: encounter.type,
      visible: !!encounter.visible,
      start: fmtSafe(encounter.start),
      end: fmtSafe(encounter.end),
      duration: fmtSafe(encounter.duration),
      enemyStats: (encounter.enemyStats || []).slice(0, 8).map(enemy => ({
        id: enemy.id,
        name: enemy.name,
        tpl: enemy.tpl,
        damage: fmtSafe(enemy.damage),
        hits: enemy.hits || 0,
        boss: !!enemy.boss,
        mob: !!enemy.mob
      }))
    };
  }
  function scopeRows(rows, encounter){
    if(!encounter) return rows;
    const start = encounter.start || 0;
    const end = encounter.end || start;
    return rows.filter(row => row.time >= start && row.time <= end);
  }
  function noRowsPower(power){
    return {
      power: power.power,
      category: power.category,
      hits: power.hits || 0,
      damage: fmtSafe(power.damage),
      share: fmtSafe(power.share),
      avg: fmtSafe(power.avg),
      max: fmtSafe(power.max),
      crit: fmtSafe(power.crit)
    };
  }
  function categories(powers){
    const map = new Map();
    for(const power of powers || []){
      const key = power.category || 'Other / Unknown';
      map.set(key, (map.get(key) || 0) + (power.damage || 0));
    }
    const total = Array.from(map.values()).reduce((a,b) => a + b, 0);
    return Array.from(map.entries()).map(([category, damage]) => ({
      category,
      damage,
      share: total ? damage / total * 100 : 0
    })).sort((a,b) => b.damage - a.damage);
  }
  function playerMetricSummary(rows, player, encounters, options){
    const metrics = NW.metrics(rows, player.id, encounters, options || {});
    return {
      id: player.id,
      name: player.name,
      damage: fmtSafe(metrics.total),
      dps: fmtSafe(metrics.dps),
      combatDps: fmtSafe(metrics.combatDps),
      hits: metrics.hits || 0,
      duration: fmtSafe(metrics.duration),
      combatTime: fmtSafe(metrics.combatTime),
      crit: fmtSafe(metrics.crit),
      flank: fmtSafe(metrics.flank),
      max: metrics.max ? { amount: metrics.max.amount, powerName: metrics.max.powerName, time: metrics.max.time } : null
    };
  }
  function quickPartyOverview(rows, players, options = {}){
    const includeCompanions = options.includeCompanions !== false;
    const map = new Map(players.map(player => [player.id, {
      id: player.id,
      name: player.name,
      damage: 0,
      dps: 0,
      combatDps: 0,
      hits: 0,
      duration: 0,
      combatTime: 0,
      crit: 0,
      flank: 0,
      max: null,
      first: null,
      last: null,
      critHits: 0,
      flankHits: 0
    }]));
    for(const row of rows){
      if(!isPlayerId(row.ownerId) || !map.has(row.ownerId)) continue;
      if(!NW.isDamage(row)) continue;
      if(!includeCompanions && isCompanion(row)) continue;
      const item = map.get(row.ownerId);
      item.damage += row.amount;
      item.hits++;
      if(item.first === null || row.time < item.first) item.first = row.time;
      if(item.last === null || row.time > item.last) item.last = row.time;
      if(isCrit(row)) item.critHits++;
      if(isFlank(row)) item.flankHits++;
      if(!item.max || row.amount > item.max.amount) item.max = { amount: row.amount, powerName: row.powerName, time: row.time };
    }
    return Array.from(map.values()).map(item => {
      item.duration = item.first === null || item.last === null ? 0 : item.last - item.first;
      item.combatTime = item.duration;
      item.dps = item.damage / Math.max(1, item.duration);
      item.combatDps = item.damage / Math.max(1, item.combatTime);
      item.crit = item.hits ? item.critHits / item.hits * 100 : 0;
      item.flank = item.hits ? item.flankHits / item.hits * 100 : 0;
      delete item.first;
      delete item.last;
      delete item.critHits;
      delete item.flankHits;
      return item;
    }).filter(item => item.hits > 0 || item.damage > 0).sort((a,b) => b.damage - a.damage);
  }
  function enrichPlayer(rows, summary, options){
    const powers = NW.powers(rows, summary.id, options || {}).slice(0, 24).map(noRowsPower);
    const healing = NW.healing(rows, summary.id);
    const taken = NW.taken(rows, summary.id);
    const shielded = NW.shielded(rows, summary.id);
    const companionDamage = NW.companionDamage ? NW.companionDamage(rows, summary.id) : 0;
    return Object.assign({}, summary, {
      healingDone: fmtSafe(healing.done),
      healingReceived: fmtSafe(healing.received),
      damageTaken: fmtSafe(taken),
      shielded: fmtSafe(shielded),
      companionDamage: fmtSafe(companionDamage),
      powers,
      categories: categories(powers)
    });
  }
  function buildReport(rows, options = {}){
    const startedAt = now();
    const includeCompanions = options.includeCompanions !== false;
    const players = NW.detectPlayers(rows);
    const primary = players[0] || null;
    const playerId = options.playerId || (primary && primary.id) || '';
    const encountersRaw = playerId ? NW.buildEncounters(rows, playerId, options.mode || 'player') : [];
    const encounters = encountersRaw.map(plainEncounter);
    const party = quickPartyOverview(rows, players, { includeCompanions }).slice(0, 120);
    const endedAt = now();
    return {
      version: 2,
      mode: 'party-overview-first',
      rowCount: rows.length,
      meta: rows.meta || {},
      generatedMs: Math.max(0, Math.round(endedAt - startedAt)),
      defaultPlayerId: party[0]?.id || playerId,
      players: party.map(player => ({ id: player.id, name: player.name, damage: player.damage || 0, hits: player.hits || 0 })).slice(0, 120),
      encounters,
      party,
      preview: {
        topPlayers: party.slice(0, 12),
        topPlayer: party[0] || null,
        visibleEncounters: encounters.filter(encounter => encounter.visible).slice(0, 12)
      }
    };
  }

  window.SGSummaryEngine = { buildReport, playerMetricSummary, enrichPlayer, scopeRows, quickPartyOverview };
})();
