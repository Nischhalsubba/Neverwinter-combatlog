(function(){
  const NW = window.NWParser;
  if(!NW) return;

  function fmtSafe(value){ return Number.isFinite(value) ? value : 0; }
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
  function playerSnapshot(rows, player, encounters, options){
    const metrics = NW.metrics(rows, player.id, encounters, options || {});
    const powers = NW.powers(rows, player.id, options || {}).slice(0, 24).map(noRowsPower);
    const healing = NW.healing(rows, player.id);
    const taken = NW.taken(rows, player.id);
    const shielded = NW.shielded(rows, player.id);
    const companionDamage = NW.companionDamage ? NW.companionDamage(rows, player.id) : 0;
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
      max: metrics.max ? { amount: metrics.max.amount, powerName: metrics.max.powerName, time: metrics.max.time } : null,
      healingDone: fmtSafe(healing.done),
      healingReceived: fmtSafe(healing.received),
      damageTaken: fmtSafe(taken),
      shielded: fmtSafe(shielded),
      companionDamage: fmtSafe(companionDamage),
      powers,
      categories: categories(powers)
    };
  }
  function buildReport(rows, options = {}){
    const startedAt = performance && performance.now ? performance.now() : Date.now();
    const players = NW.detectPlayers(rows);
    const primary = players[0] || null;
    const playerId = options.playerId || (primary && primary.id) || '';
    const encountersRaw = playerId ? NW.buildEncounters(rows, playerId, options.mode || 'player') : [];
    const encounters = encountersRaw.map(plainEncounter);
    const party = players.slice(0, 80).map(player => playerSnapshot(rows, player, encountersRaw, { includeCompanions: options.includeCompanions !== false }))
      .sort((a,b) => b.damage - a.damage);
    const previewPlayers = party.slice(0, 8);
    const endedAt = performance && performance.now ? performance.now() : Date.now();
    return {
      version: 1,
      mode: 'summary-first',
      rowCount: rows.length,
      meta: rows.meta || {},
      generatedMs: Math.max(0, Math.round(endedAt - startedAt)),
      defaultPlayerId: playerId,
      players: players.map(player => ({ id: player.id, name: player.name, damage: player.damage || 0, hits: player.hits || 0 })).slice(0, 120),
      encounters,
      party,
      preview: {
        topPlayers: previewPlayers,
        topPlayer: previewPlayers[0] || null,
        visibleEncounters: encounters.filter(encounter => encounter.visible).slice(0, 12)
      }
    };
  }

  window.SGSummaryEngine = { buildReport, playerSnapshot, scopeRows };
})();
