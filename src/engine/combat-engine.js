(function(){
  const SG = window.SG || {};
  const CATEGORIES = {
    'Chilling Cloud':'At-Will','Magic Missile':'At-Will','Electric Shot':'At-Will','Rapid Shot':'At-Will','Sly Flourish':'At-Will','Cleave':'At-Will','Brash Strike':'At-Will','Lance of Faith':'At-Will','Arpeggio':'At-Will','Eldritch Blast':'At-Will',
    'Icy Rays':'Encounter','Chill Strike':'Encounter','Repel':'Encounter','Entangling Force':'Encounter','Fanning the Flame':'Encounter','Fanned Flame':'Encounter','Gathering Flame':'Encounter','Fireball':'Encounter','Icy Terrain':'Encounter','Thorn Ward':'Encounter','Thorn Strike':'Encounter','Hindering Strike':'Encounter','Split the Sky':'Encounter','Throw Caution':'Encounter','Hindering Shot':'Encounter','Dazing Strike':'Encounter','Lashing Blade':'Encounter','Assassinate':'Encounter','Anvil of Doom':'Encounter','Not so Fast':'Encounter','Bloodletter':'Encounter','Duet':'Encounter','Volti Subito':'Encounter','Blaze Flamenco':'Encounter','Phantasmal Concerto':'Encounter','Ray of Enfeeblement':'Encounter','Killing Flames':'Encounter','Pillar of Power':'Encounter',
    'Ice Knife':'Daily','Furious Immolation':'Daily','Forest Ghost':'Daily','Whirlwind of Blades':'Daily','Crescendo':'Daily','Bloodbath':'Daily','Slam':'Daily',
    'Infernal Pounce':'Mount','Tunnel Vision':'Mount','Grand Inspiration':'Mount','Radiant Weapon':'Mount',
    'Rimefire Smolder':'Feat','Shatter Strike':'Feat','Glowing Flames':'Feat','Grasping Roots':'Feat','Reprisal Reflex':'Feat','Mutation':'Feat','Life Lessons':'Feat','Smolder':'Class Feature','Battle Awareness':'Class Feature',
    'Mark of the Giant Slayer, Rank 2':'Item / Enchant','Empowered Owlbear Figurine':'Item / Enchant','Owlbear Figurine':'Item / Enchant','Spined Devil\'s Influence':'Item / Enchant','Lightning Flash':'Item / Enchant','Enchanter\'s Hex':'Item / Enchant','Ethereal Vortex':'Item / Enchant','Realm Engine Blast':'Item / Enchant',
    'Loose the Ballista!':'Pet / Companion','Suppressing Fire!':'Pet / Companion','Slash':'Pet / Companion','Thrust':'Pet / Companion','Instructional Aid':'Pet / Companion','Winter\'s Wrath':'Pet / Companion','Witch\'s Finale':'Pet / Companion','Tail Sting':'Pet / Companion',
    'Blood Lust':'Other / Unknown','Tentacle Slam':'Other / Unknown','Infection':'Other / Unknown'
  };

  const DAMAGE_GAP_SECONDS = 5;
  const BOSS_MERGE_GAP_SECONDS = 15;

  const Utils = {
    wait(){ return new Promise(resolve => setTimeout(resolve, 0)); },
    csv(line){
      const out = [];
      let cell = '';
      let quote = false;
      for(let i = 0; i < line.length; i++){
        const ch = line[i];
        if(ch === '"'){
          if(quote && line[i + 1] === '"'){ cell += '"'; i++; }
          else quote = !quote;
        } else if(ch === ',' && !quote){ out.push(cell); cell = ''; }
        else cell += ch;
      }
      out.push(cell);
      return out;
    },
    seconds(raw){
      const parts = String(raw || '').split(':');
      if(parts.length >= 6) return (+parts[2] || 0) * 86400 + (+parts[3] || 0) * 3600 + (+parts[4] || 0) * 60 + (+parts[5] || 0);
      const parsed = Date.parse(raw);
      return Number.isFinite(parsed) ? parsed / 1000 : 0;
    },
    sortRows(rows){ return rows.sort((a,b) => a.time - b.time || a.lineNo - b.lineNo); },
    groupBy(rows, keyFn){
      const map = new Map();
      for(const row of rows){
        const key = keyFn(row);
        if(!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      }
      return map;
    },
    sum(rows, pick){ let total = 0; for(const row of rows) total += pick(row) || 0; return total; }
  };

  const Entity = {
    parse(id = ''){
      const match = String(id).match(/^C\[(\d+)\s+(.+)\]$/);
      return match ? { num: match[1], tpl: match[2], raw: id } : null;
    },
    isPlayer(id){ return String(id || '').startsWith('P['); },
    isCreature(id){ return String(id || '').startsWith('C['); },
    isBoss(id){ return (Entity.parse(id)?.tpl || '').includes('_Boss'); },
    isMob(id){
      const tpl = Entity.parse(id)?.tpl || '';
      return !tpl.includes('_Boss') && ['_Solo','_Elite','_Standard','_Minion'].some(token => tpl.includes(token));
    },
    isPet(id){
      const tpl = Entity.parse(id)?.tpl || '';
      return /Pet_|Companion|Appointment|Summon/i.test(tpl);
    }
  };

  const Classifier = {
    category(power){ return CATEGORIES[power] || 'Other / Unknown'; },
    isDamage(row){
      return row.damageType === 'Physical' && row.amount > 0 && !row.flags.has('ShowPowerDisplayName') && (row.targetId !== '*' || Entity.isCreature(row.sourceId));
    },
    isCompanionRow(row){
      const cat = Classifier.category(row.powerName);
      return cat === 'Pet / Companion' || Entity.isPet(row.ownerId) || Entity.isPet(row.sourceId) || /companion|pet|summon|appointment/i.test(row.ownerName + ' ' + row.sourceName + ' ' + row.powerName);
    },
    isHealing(row){ return row.damageType === 'HitPoints' && row.amount < 0; },
    isShield(row){ return row.damageType === 'Shield' && row.amount < 0; },
    isIncomingDamage(row, playerId){ return row.targetId === playerId && row.damageType === 'Physical' && row.amount > 0; }
  };

  const RowParser = {
    normalizeColumns(cols){
      let clean = cols.map(value => String(value ?? '').trim());
      if(clean[0] && /^\d+$/.test(clean[0]) && clean[1]?.includes('::')) clean = clean.slice(1);
      const first = clean[0]?.toLowerCase() || '';
      if(first === 'index' || first.includes('timestamp')) return null;
      return clean;
    },
    parseLine(rawLine, lineNo){
      const line = String(rawLine || '').trim();
      if(!line || line.startsWith('index,')) return null;
      const cols = RowParser.normalizeColumns(Utils.csv(line));
      if(!cols || cols.length < 12) return null;
      const split = cols[0].indexOf('::');
      if(split < 0) return null;
      const amount = Number(cols[10]);
      if(!Number.isFinite(amount)) return null;
      const timestampRaw = cols[0].slice(0, split);
      return {
        lineNo,
        timestampRaw,
        abs: Utils.seconds(timestampRaw),
        time: 0,
        ownerName: cols[0].slice(split + 2),
        ownerId: cols[1] || '',
        sourceName: cols[2] || '',
        sourceId: cols[3] || '',
        targetName: cols[4] || '',
        targetId: cols[5] || '',
        powerName: cols[6] || 'Unknown',
        powerId: cols[7] || '',
        damageType: cols[8] || '',
        flags: new Set((cols[9] || '').split('|').filter(Boolean)),
        flagsRaw: cols[9] || '',
        amount,
        baseAmount: Number(cols[11]) || 0
      };
    },
    finalizeRows(rows, meta){
      let first = Infinity;
      for(const row of rows) if(row.abs < first) first = row.abs;
      if(!Number.isFinite(first)) first = 0;
      for(const row of rows) row.time = Math.round((row.abs - first) * 1000) / 1000;
      Utils.sortRows(rows);
      rows.meta = meta || {};
      return rows;
    },
    parseLog(text, options = {}){
      const rows = [];
      let skipped = 0;
      let lineNo = 0;
      for(const line of String(text || '').split(/\r?\n/)){
        lineNo++;
        const row = RowParser.parseLine(line, lineNo);
        if(row) rows.push(row);
        else if(line.trim()) skipped++;
      }
      return RowParser.finalizeRows(rows, { skipped, lines: lineNo, bytes: String(text || '').length, mode: 'text' });
    },
    async parseFile(file, options = {}){
      if(!file.stream) return RowParser.parseLog(await file.text(), options);
      const rows = [];
      let skipped = 0;
      let lineNo = 0;
      let doneBytes = 0;
      let carry = '';
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      const decoder = new TextDecoder();
      const reader = file.stream().getReader();
      while(true){
        const result = await reader.read();
        if(result.done) break;
        doneBytes += result.value.byteLength;
        const chunk = carry + decoder.decode(result.value, { stream: true });
        const parts = chunk.split(/\r?\n/);
        carry = parts.pop() || '';
        for(const line of parts){
          lineNo++;
          const row = RowParser.parseLine(line, lineNo);
          if(row) rows.push(row);
          else if(line.trim()) skipped++;
          if(lineNo % 12000 === 0){
            onProgress && onProgress({ phase: 'parsing', rows: rows.length, lines: lineNo, bytes: doneBytes, total: file.size || 0 });
            await Utils.wait();
          }
        }
        onProgress && onProgress({ phase: 'reading', rows: rows.length, lines: lineNo, bytes: doneBytes, total: file.size || 0 });
      }
      const tail = carry + decoder.decode();
      if(tail.trim()){
        lineNo++;
        const row = RowParser.parseLine(tail, lineNo);
        if(row) rows.push(row);
        else skipped++;
      }
      onProgress && onProgress({ phase: 'finalizing', rows: rows.length, lines: lineNo, bytes: doneBytes, total: file.size || 0 });
      await Utils.wait();
      return RowParser.finalizeRows(rows, { skipped, lines: lineNo, bytes: doneBytes, totalBytes: file.size || 0, mode: 'stream' });
    }
  };

  const Players = {
    detect(rows){
      const map = new Map();
      for(const row of rows){
        if(Entity.isPlayer(row.ownerId)){
          if(!map.has(row.ownerId)) map.set(row.ownerId, { id: row.ownerId, name: row.ownerName, damage: 0, hits: 0 });
          if(Classifier.isDamage(row)){
            const player = map.get(row.ownerId);
            player.damage += row.amount;
            player.hits++;
          }
        }
        if(Entity.isPlayer(row.targetId) && !map.has(row.targetId)) map.set(row.targetId, { id: row.targetId, name: row.targetName, damage: 0, hits: 0 });
      }
      return Array.from(map.values()).sort((a,b) => b.damage - a.damage);
    },
    validDamage(rows, playerId, options = {}){
      const includeCompanions = options.includeCompanions !== false;
      const out = [];
      for(const row of rows){
        if(row.ownerId !== playerId) continue;
        if(!Classifier.isDamage(row)) continue;
        if(!includeCompanions && Classifier.isCompanionRow(row)) continue;
        out.push(row);
      }
      return Utils.sortRows(out);
    }
  };

  const Encounters = {
    enemyStats(rows){
      const map = new Map();
      function add(id, name, damage, time){
        if(!Entity.isCreature(id) || Entity.isPet(id)) return;
        if(!map.has(id)){
          const entity = Entity.parse(id);
          map.set(id, { id, name: name || entity?.tpl || id, tpl: entity?.tpl || '', damage: 0, hits: 0, boss: Entity.isBoss(id), mob: Entity.isMob(id), first: time });
        }
        const enemy = map.get(id);
        enemy.damage += Math.max(0, damage || 0);
        if((damage || 0) > 0) enemy.hits++;
        if(time < enemy.first) enemy.first = time;
      }
      for(const row of rows){
        add(row.targetId, row.targetName, row.amount, row.time);
        if(row.sourceId && row.sourceId !== '*' && !Entity.isPlayer(row.sourceId)) add(row.sourceId, row.sourceName, 0, row.time);
      }
      return Array.from(map.values()).sort((a,b) => a.boss !== b.boss ? Number(b.boss) - Number(a.boss) : b.damage - a.damage || a.first - b.first);
    },
    make(rows){
      const sorted = Utils.sortRows([...rows]);
      const enemies = Encounters.enemyStats(sorted);
      const type = enemies.some(enemy => enemy.boss) ? 'boss' : 'mob';
      let names = enemies.slice(0,3).map(enemy => enemy.name);
      let label = names.join(', ') || 'Trash';
      if(enemies.length > 3) label += ' +' + (enemies.length - 3);
      if(type !== 'boss' && enemies.length <= 4) label = 'Trash (' + enemies.length + ' mobs)';
      return {
        rows: sorted,
        start: sorted[0].time,
        end: sorted[sorted.length - 1].time,
        duration: sorted[sorted.length - 1].time - sorted[0].time,
        type,
        label,
        visible: type === 'boss',
        bossIds: new Set(enemies.filter(enemy => enemy.boss).map(enemy => enemy.id)),
        enemyStats: enemies
      };
    },
    sameBoss(a,b){ for(const id of a.bossIds) if(b.bossIds.has(id)) return true; return false; },
    merge(list){ return Encounters.make(list.flatMap(encounter => encounter.rows)); },
    build(rows, playerId, mode = 'player'){
      const source = (mode === 'party' ? rows.filter(row => Entity.isPlayer(row.ownerId) && Classifier.isDamage(row)) : Players.validDamage(rows, playerId)).sort((a,b) => a.time - b.time || a.lineNo - b.lineNo);
      if(!source.length) return [];
      const raw = [];
      let current = [];
      for(const row of source){
        if(current.length && row.time - current[current.length - 1].time > DAMAGE_GAP_SECONDS){ raw.push(Encounters.make(current)); current = []; }
        current.push(row);
      }
      if(current.length) raw.push(Encounters.make(current));
      const merged = [];
      for(let i = 0; i < raw.length; i++){
        const encounter = raw[i], next = raw[i + 1], after = raw[i + 2];
        if(encounter.type === 'boss' && next && after && after.type === 'boss' && Encounters.sameBoss(encounter, after) && next.start - encounter.end <= BOSS_MERGE_GAP_SECONDS && after.start - next.end <= BOSS_MERGE_GAP_SECONDS){
          merged.push(Encounters.merge([encounter, next, after]));
          i += 2;
          continue;
        }
        const previous = merged[merged.length - 1];
        if(previous && previous.type === 'boss' && encounter.type === 'boss' && Encounters.sameBoss(previous, encounter) && encounter.start - previous.end <= BOSS_MERGE_GAP_SECONDS) merged[merged.length - 1] = Encounters.merge([previous, encounter]);
        else merged.push(encounter);
      }
      return merged.map((encounter, index) => ({ ...encounter, id: index + 1 }));
    }
  };

  const Metrics = {
    player(rows, playerId, encounters = [], options = {}){
      const damageRows = Players.validDamage(rows, playerId, options);
      let total = 0, crit = 0, flank = 0, max = null;
      for(const row of damageRows){
        total += row.amount;
        if(row.flags.has('Critical')) crit++;
        if(row.flags.has('Flank') || row.flags.has('CombatAdvantage')) flank++;
        if(!max || row.amount > max.amount) max = row;
      }
      const hits = damageRows.length;
      const first = hits ? damageRows[0].time : 0;
      const last = hits ? damageRows[hits - 1].time : 0;
      let combatTime = 0;
      for(const encounter of encounters){
        let firstIn = null, lastIn = null;
        for(const row of damageRows){
          if(row.time < encounter.start) continue;
          if(row.time > encounter.end) break;
          if(firstIn === null) firstIn = row.time;
          lastIn = row.time;
        }
        if(firstIn !== null && lastIn !== null) combatTime += lastIn - firstIn;
      }
      const duration = last - first;
      return { total, hits, duration, dps: total / Math.max(1, duration), combatTime, combatDps: total / Math.max(1, combatTime), crit: hits ? crit / hits * 100 : 0, flank: hits ? flank / hits * 100 : 0, max };
    },
    powers(rows, playerId, options = {}){
      const damageRows = Players.validDamage(rows, playerId, options);
      const total = Utils.sum(damageRows, row => row.amount);
      const out = [];
      for(const [power, group] of Utils.groupBy(damageRows, row => row.powerName)){
        let damage = 0, max = 0, crit = 0;
        for(const row of group){
          damage += row.amount;
          if(row.amount > max) max = row.amount;
          if(row.flags.has('Critical')) crit++;
        }
        out.push({ power, category: Classifier.category(power), hits: group.length, damage, share: total ? damage / total * 100 : 0, avg: group.length ? damage / group.length : 0, max, crit: group.length ? crit / group.length * 100 : 0, rows: Utils.sortRows(group) });
      }
      return out.sort((a,b) => b.damage - a.damage);
    },
    healing(rows, playerId){
      let done = 0, received = 0;
      for(const row of rows){
        if(!Classifier.isHealing(row)) continue;
        if(row.ownerId === playerId) done += Math.abs(row.amount);
        if(row.targetId === playerId) received += Math.abs(row.amount);
      }
      return { done, received };
    },
    taken(rows, playerId){ return Utils.sum(rows.filter(row => Classifier.isIncomingDamage(row, playerId)), row => row.amount); },
    shielded(rows, playerId){ return Utils.sum(rows.filter(row => row.targetId === playerId && Classifier.isShield(row)), row => Math.abs(row.amount)); },
    companionRows(rows, playerId){ return rows.filter(row => row.ownerId === playerId && Classifier.isDamage(row) && Classifier.isCompanionRow(row)); },
    companionDamage(rows, playerId){ return Utils.sum(Metrics.companionRows(rows, playerId), row => row.amount); }
  };

  const Formulas = {
    totalDamage: 'sum(valid outgoing damage rows)',
    dps: 'totalDamage / fullDuration',
    combatDps: 'totalDamage / activeCombatTime',
    critRate: 'criticalHits / totalHits * 100',
    flankRate: 'flankHits / totalHits * 100',
    powerShare: 'powerDamage / totalDamage * 100',
    healingDone: 'sum(abs(negative HitPoints rows owned by player))',
    damageTaken: 'sum(positive Physical rows targeting player)',
    shielded: 'sum(abs(negative Shield rows targeting player))',
    companionDamage: 'sum(valid damage rows classified as Pet / Companion)'
  };

  function createEngine(rows){
    return {
      rows,
      players: () => Players.detect(rows),
      encounters: (playerId, mode) => Encounters.build(rows, playerId, mode),
      metrics: (playerId, scope = rows, encounters = [], options = {}) => Metrics.player(scope, playerId, encounters, options),
      powers: (playerId, scope = rows, options = {}) => Metrics.powers(scope, playerId, options),
      valid: (playerId, scope = rows, options = {}) => Players.validDamage(scope, playerId, options),
      companionDamage: (playerId, scope = rows) => Metrics.companionDamage(scope, playerId)
    };
  }

  const api = {
    parseLog: RowParser.parseLog,
    parseFile: RowParser.parseFile,
    parseLine: RowParser.parseLine,
    detectPlayers: Players.detect,
    buildEncounters: Encounters.build,
    metrics: Metrics.player,
    powers: Metrics.powers,
    healing: Metrics.healing,
    taken: Metrics.taken,
    shielded: Metrics.shielded,
    isDamage: Classifier.isDamage,
    validForPlayer: Players.validDamage,
    category: Classifier.category,
    createEngine,
    parseEntity: Entity.parse,
    isBoss: Entity.isBoss,
    isMob: Entity.isMob,
    isPet: Entity.isPet,
    isCompanionRow: Classifier.isCompanionRow,
    companionDamage: Metrics.companionDamage,
    formulas: Formulas
  };

  window.SGEngine = { Utils, Entity, Classifier, RowParser, Players, Encounters, Metrics, Formulas, createEngine, api, CATEGORIES };
  window.NWParser = api;
})();
