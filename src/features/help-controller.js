(function(){
  var SG = window.SG;
  if(!SG) return;

  var glossary = {
    'damage': ['Damage', 'Amount credited to a player, power, category, source, or row group.', 'Damage = sum(amount) for matching valid damage rows.', 'Use scope and companion toggle to understand what is included.'],
    'total damage': ['Total Damage', 'All valid outgoing damage by the selected player in the selected scope.', 'Total Damage = sum(amount) where ownerId is selected player and row is valid outgoing damage.', 'Good for total contribution. Compare with Combat DPS for cleaner endgame read.'],
    'dps': ['DPS', 'Damage per second over the full elapsed duration.', 'DPS = Total Damage / Duration.', 'Downtime, travel, deaths and mechanics lower this number.'],
    'combat dps': ['Combat DPS', 'Damage per second during active combat windows.', 'Combat DPS = Total Damage / In-Combat Time.', 'Usually the cleaner performance comparison for boss windows.'],
    'hits': ['Hits', 'Count of matching combat-log rows.', 'Hits = count(matching rows).', 'Multi-hit powers can inflate this. It is not the same as button presses.'],
    'total hits': ['Total Hits', 'All valid outgoing hit rows for the selected player and scope.', 'Total Hits = count(valid outgoing damage rows).', 'Used as denominator for crit rate and flank rate.'],
    'duration': ['Duration', 'Elapsed time covered by the selected player or encounter scope.', 'Duration = last timestamp - first timestamp.', 'Long duration with low activity lowers DPS.'],
    'in-combat time': ['In-Combat Time', 'Estimated time where the player was actively contributing.', 'In-Combat Time = sum(merged active combat windows).', 'Combat DPS uses this instead of full duration.'],
    'crit rate': ['Crit Rate', 'Percent of valid hits flagged as Critical.', 'Crit Rate = Critical Hits / Total Hits x 100.', 'Use with power share. Crit rate alone does not prove output.'],
    'crit%': ['Crit%', 'Critical rate for a table row or power group.', 'Crit% = critical hits in group / hits in group x 100.', 'Good for checking burst powers and proc behavior.'],
    'flank rate': ['Flank Rate', 'Percent of hits with flank or combat advantage flag.', 'Flank Rate = Flank Hits / Total Hits x 100.', 'Endgame damage depends heavily on combat advantage uptime.'],
    'max hit': ['Max Hit', 'Largest single hit in the current scope or group.', 'Max Hit = max(amount).', 'Useful for burst checks, not full performance by itself.'],
    'avg': ['Average', 'Average value per hit or row.', 'Average = Total / Count.', 'Interpret with hits and share. Low hits can make this noisy.'],
    'average': ['Average', 'Average value per hit or row.', 'Average = Total / Count.', 'Interpret with hits and share. Low hits can make this noisy.'],
    'share': ['Share', 'Contribution of a row or group to the current total.', 'Share = Group Damage / Total Damage x 100.', 'This shows what carried the fight.'],
    '%': ['Percent Share', 'Contribution percentage inside the active table.', 'Percent = Row Value / Table Total x 100.', 'Denominator depends on the tab and filters.'],
    'power': ['Power', 'Combat-log power name grouped by the parser.', 'Power contribution = sum(amount) for rows with this power name.', 'Can be class power, feat, mount, artifact, enchant, companion, or proc.'],
    'category': ['Category', 'Parser classification for a power or effect.', 'Category = rule-based classification from power/source patterns.', 'Useful for separating true class output from pets, mounts, items and procs.'],
    'healing done': ['Healing Done', 'Outgoing healing credited to the selected player.', 'Healing Done = sum(abs(amount)) for owned healing rows.', 'Best read with damage taken, shielding and deaths.'],
    'damage taken': ['Damage Taken', 'Incoming damage against the selected player.', 'Damage Taken = sum(amount) where target is selected player.', 'High values can mean tanking, mistakes, or heavy mechanics.'],
    'shielded': ['Shielded', 'Shield absorption credited in the log.', 'Shielded = sum(abs(amount)) for shield absorption rows.', 'Useful for support and mitigation review.'],
    'encounters': ['Encounters', 'Number of encounter windows in the current scope.', 'Encounters = count(active encounter windows).', 'All encounters includes more windows than a single boss scope.'],
    'player': ['Player', 'Selected character used for detailed analysis.', 'Selected Player = ownerId filter for rows.', 'Changing player recalculates every detail view.'],
    'class': ['Class', 'Detected or manually corrected class.', 'Class = best score from class-specific owned powers.', 'If the log lacks evidence, use class correction.'],
    'party overview': ['Party Overview', 'Party ranking under the selected encounter scope.', 'Each row is metrics(playerId, activeEncounterRows).', 'Click a player to inspect them below.'],
    'encounter filters': ['Encounter Filters', 'Controls the fight window used by the app.', 'Scope rows = rows inside the selected encounter start and end timestamps.', 'Every analysis view should follow this filter.'],
    'snapshot': ['Snapshot', 'Main summary of selected player and scope.', 'Cards are aggregates from matching rows.', 'Start here before looking at rotation or raw details.'],
    'rotation': ['Rotation', 'Timing view of powers in the selected fight.', 'Activation position = (row time - start) / duration.', 'Use this for opener, burst and cooldown timing.'],
    'power damage': ['Power Damage', 'Power-by-power damage breakdown.', 'Group by powerName, then sum damage and count hits.', 'Shows which powers are carrying output.'],
    'compare players': ['Compare Players', 'Multi-player comparison in the same scope.', 'Each selected player is recalculated with the same filters.', 'Use for fair boss-window comparison.'],
    'asset codex': ['Asset Codex', 'Audit of power names and matched icon filenames.', 'Exact match first, then fallback candidates.', 'Use this when an icon is wrong or missing.']
  };

  function findInfo(label){
    var key = SG.normalize(label);
    if(glossary[key]) return glossary[key];
    var keys = Object.keys(glossary);
    for(var i=0;i<keys.length;i++){
      if(key.indexOf(keys[i]) !== -1 || keys[i].indexOf(key) !== -1) return glossary[keys[i]];
    }
    return [label || 'UI element', 'This item is generated from the uploaded combat log or app state.', 'Value = aggregate of matching rows under current player, encounter and toggles.', 'If this is a power, inspect Asset Codex and Power Damage for more detail.'];
  }

  function selectedSummary(){
    try{
      if(typeof state === 'undefined' || typeof player !== 'function' || !window.NWParser) return null;
      var p = player();
      var rows = typeof scopeRows === 'function' ? scopeRows() : state.rows;
      var encs = typeof activeEncounters === 'function' ? activeEncounters() : state.encounters;
      var m = NWParser.metrics(rows, p.id, encs);
      var valid = NWParser.validForPlayer(rows, p.id);
      return { player:p.name, total:m.total, dps:m.dps, combatDps:m.combatDps, hits:m.hits, duration:m.duration, combatTime:m.combatTime, rows:rows.length, valid:valid.length, encs:(encs||[]).length };
    } catch(e){ return null; }
  }

  function formatValue(value){
    try { return window.fmt ? window.fmt(value) : String(value); }
    catch(e){ return String(value); }
  }

  function formatDuration(value){
    try { return window.dur ? window.dur(value) : String(value) + 's'; }
    catch(e){ return String(value); }
  }

  function headerForCell(cell){
    var table = cell.closest('table');
    if(!table) return '';
    var index = Array.prototype.indexOf.call(cell.parentElement.children, cell);
    var header = table.querySelectorAll('thead th')[index];
    return header ? header.textContent.trim() : '';
  }

  function targetFromElement(el){
    if(!el || el.closest('#sg-help-drawer,#sg-tooltip,#sg-log-guide-modal,.sg-no-help')) return null;
    if(el.closest('input,select,textarea,[data-no-help]')) return null;
    var tab = el.closest('#tabs button'); if(tab) return { label:tab.textContent.trim(), source:'Analysis tab' };
    var enc = el.closest('.encounterCell,.chip'); if(enc) return { label:enc.classList.contains('boss')?'Boss':enc.classList.contains('mob')?'Mob':enc.textContent.trim(), source:'Encounter filter' };
    var th = el.closest('th'); if(th) return { label:th.textContent.trim(), source:'Table column' };
    var card = el.closest('.card'); if(card) return { label:(card.querySelector('span')||card).textContent.trim(), value:(card.querySelector('b')||card).textContent.trim(), source:'Summary card', numeric:true };
    var td = el.closest('td'); if(td) return { label:headerForCell(td) || td.textContent.trim(), value:td.textContent.trim(), source:'Table cell', numeric:/[0-9]/.test(td.textContent) };
    var power = el.closest('.barrow,.powerRow,.actRow,.miniLine'); if(power) return { label:(power.querySelector('b,span')||power).textContent.trim(), source:'Power row', power:true };
    var heading = el.closest('h1,h2,h3'); if(heading) return { label:heading.textContent.trim(), source:'Section title' };
    var cls = el.closest('.classPill'); if(cls) return { label:'Class', source:cls.textContent.trim() };
    var img = el.closest('.assetIcon,.nwIcon'); if(img) return { label:img.getAttribute('alt') || img.getAttribute('title') || 'Icon', source:'Icon' };
    var label = el.closest('label'); if(label) return { label:label.textContent.trim(), source:'Control label' };
    var button = el.closest('button'); if(button) return { label:button.textContent.trim(), source:'Button' };
    return null;
  }

  function drawerHtml(target){
    var info = findInfo(target.label);
    var s = selectedSummary();
    var value = target.value ? '<p class="sg-drawer-value">' + SG.escape(target.value) + '</p>' : '';
    return '<span class="eyebrow">Strikeglass explanation</span><h2>'+SG.escape(info[0])+'</h2>'+value+
      '<section><h3>What this is</h3><p>'+SG.escape(target.power ? 'Power or effect found in the combat log. It may be a class power, feat, mount, artifact, enchant, companion, or proc.' : info[1])+'</p></section>'+ 
      '<section><h3>Formula / rule</h3><code>'+SG.escape(target.power ? 'Power contribution = sum(amount) for rows with this power name in the active scope.' : info[2])+'</code></section>'+ 
      '<section><h3>How to read it</h3><p>'+SG.escape(target.power ? 'Use category and source columns to decide whether this is true player damage or external/proc damage. The icon is matched through Asset Codex.' : info[3])+'</p></section>'+ 
      '<section><h3>Current scope</h3><dl><dt>Clicked from</dt><dd>'+SG.escape(target.source||'-')+'</dd><dt>Player</dt><dd>'+SG.escape(s?s.player:'-')+'</dd><dt>Rows in scope</dt><dd>'+SG.escape(s?String(s.rows):'-')+'</dd><dt>Valid player rows</dt><dd>'+SG.escape(s?String(s.valid):'-')+'</dd><dt>Encounter windows</dt><dd>'+SG.escape(s?String(s.encs):'-')+'</dd><dt>Companions</dt><dd>'+SG.escape((typeof state !== 'undefined' && state.includeCompanions === false)?'Excluded':'Included')+'</dd></dl></section>'+ 
      '<section><h3>Selected player totals</h3><dl><dt>Total damage</dt><dd>'+SG.escape(s?formatValue(s.total):'-')+'</dd><dt>DPS</dt><dd>'+SG.escape(s?formatValue(s.dps):'-')+'</dd><dt>Combat DPS</dt><dd>'+SG.escape(s?formatValue(s.combatDps):'-')+'</dd><dt>Duration</dt><dd>'+SG.escape(s?formatDuration(s.duration):'-')+'</dd><dt>In-combat time</dt><dd>'+SG.escape(s?formatDuration(s.combatTime):'-')+'</dd><dt>Hits</dt><dd>'+SG.escape(s?String(s.hits):'-')+'</dd></dl></section>';
  }

  document.addEventListener('mouseover', function(event){
    var target = targetFromElement(event.target);
    if(!target) return;
    var info = findInfo(target.label);
    SG.showTooltip(event, info[0], target.power ? 'Power/effect row. Click for source, formula and scope context.' : info[1]);
  }, true);

  document.addEventListener('mousemove', function(event){
    var tip = document.getElementById('sg-tooltip');
    if(tip && tip.classList.contains('is-visible')){
      tip.style.left = Math.min(event.clientX + 14, window.innerWidth - 360) + 'px';
      tip.style.top = Math.min(event.clientY + 14, window.innerHeight - 150) + 'px';
    }
  }, true);

  document.addEventListener('mouseout', function(event){
    if(targetFromElement(event.target)) SG.hideTooltip();
  }, true);

  document.addEventListener('click', function(event){
    var target = targetFromElement(event.target);
    if(!target) return;
    if(event.target.closest('button,label,a') && !event.target.closest('#tabs,.encounterCell,.chip,.barrow,.powerRow,.actRow,.miniLine,.card,td,th,h1,h2,h3,.classPill,.assetIcon,.nwIcon')) return;
    SG.openDrawer('sg-help-drawer', 'Strikeglass explanation', drawerHtml(target));
  }, true);
})();
