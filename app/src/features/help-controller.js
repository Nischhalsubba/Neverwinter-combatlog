(function(){
  var SG = window.SG;
  if(!SG) return;

  var glossary = {
    'damage': ['Damage', 'How much harm was done.', 'The app adds up damage hits for the selected player and fight.', 'Use this to see who contributed the most raw output.'],
    'damage out': ['Damage Out', 'Damage done by the selected player.', 'Every valid hit from this player is grouped and added together.', 'Use this to find which skills, pets, mounts, or items carried the run.'],
    'total damage': ['Total Damage', 'All damage done by this player in the current fight view.', 'Add every valid damage hit from this player.', 'Great for total contribution. For fair speed comparison, use Combat DPS.'],
    'dps': ['DPS', 'Damage per second across the full selected time.', 'Total Damage divided by the full time from first hit to last hit.', 'This goes down when the player is running, waiting, dead, or doing mechanics.'],
    'combat dps': ['Combat DPS', 'Damage per second while the player was actually fighting.', 'Total Damage divided by active fighting time.', 'This is usually the fairest damage-speed number for boss fights.'],
    'hits': ['Hits', 'How many damage lines the log recorded.', 'Count the matching hit rows.', 'Some skills hit many times, so this is not the same as button presses.'],
    'total hits': ['Total Hits', 'All valid hit lines for this player in this view.', 'Count this player’s valid damage hits.', 'This is used for crit rate and combat advantage rate.'],
    'duration': ['Duration', 'How long this selected fight window lasted.', 'Last hit time minus first hit time.', 'Long pauses make normal DPS look lower.'],
    'in-combat time': ['In-Combat Time', 'Time where the player was actively doing damage.', 'The app joins together moments where the player was attacking.', 'Combat DPS uses this so downtime is not punished as hard.'],
    'fighting time': ['Fighting Time', 'Time where the player was actively attacking.', 'The app joins active damage windows together.', 'Useful when a boss has pauses, phases, or travel time.'],
    'crit rate': ['Crit Rate', 'How often this player landed critical hits.', 'Critical hits divided by all valid hits.', 'Good sign, but damage share matters more than crit rate alone.'],
    'crit%': ['Crit%', 'How often this power crit.', 'Critical hits from this power divided by all hits from this power.', 'Good for checking whether burst skills are critting.'],
    'flank rate': ['Combat Advantage Rate', 'How often the player hit with combat advantage.', 'Hits with combat advantage divided by all hits.', 'In Neverwinter, this is a big deal for damage. Low value often means positioning or setup needs work.'],
    'flank': ['Combat Advantage', 'A hit made with combat advantage active.', 'The log marks these hits with a combat advantage flag.', 'More combat advantage usually means more damage.'],
    'max hit': ['Max Hit', 'The biggest single hit in this view.', 'Find the highest damage number.', 'Fun for burst checks, but one big hit does not prove overall performance.'],
    'avg': ['Average Hit', 'The average damage per hit for this row.', 'Total damage divided by hit count.', 'Read this with Hits. A power with few hits can look weird.'],
    'average': ['Average Hit', 'The average value per hit.', 'Total divided by hit count.', 'Useful only when you also look at how many hits happened.'],
    'share': ['Share', 'How much of the total came from this row.', 'This row’s damage divided by the table total.', 'Higher share means this skill or source carried more of the fight.'],
    '%': ['Share', 'How much of the table total this row represents.', 'Row value divided by the table total.', 'Use it to quickly see what mattered most.'],
    'power': ['Power', 'The skill, pet attack, mount hit, item proc, or effect that caused damage.', 'Rows with the same power name are grouped together.', 'This tells you what actually produced the numbers.'],
    'category': ['Category', 'Where the damage likely came from.', 'The app matches the power name to known class skills, feats, mounts, pets, items, and enchants.', 'Use this to separate your own buttons from extra damage sources like pets, mounts, artifacts, or enchants.'],
    'class power': ['Class Power', 'Damage from a skill that belongs to the player’s class.', 'The power name matched the known class power list.', 'This is usually the player’s own rotation damage.'],
    'at-will': ['At-Will', 'A basic skill with no cooldown.', 'The app matched the power as a class at-will.', 'These are filler attacks, not usually your biggest burst.'],
    'encounter': ['Encounter Power', 'A class skill with a cooldown.', 'The app matched the power as an encounter skill.', 'These are usually important rotation buttons.'],
    'daily': ['Daily Power', 'A stronger class skill powered by action points.', 'The app matched the power as a daily skill.', 'Good for burst windows and boss phases.'],
    'feat': ['Feat', 'Extra damage from a build choice or class effect.', 'The power matched a known feat-style effect.', 'This is not always a button press, but it still belongs to the build.'],
    'class feature': ['Class Feature', 'Passive class effect damage.', 'The power matched a class feature or passive effect.', 'Useful for understanding what your build adds automatically.'],
    'mount': ['Mount', 'Damage caused by a mount power or mount-related effect.', 'The power matched a known mount source.', 'This is extra damage, not your main class rotation.'],
    'item / enchant': ['Item or Enchant', 'Damage from gear, artifact, enchantment, or item effect.', 'The power matched a known item or enchant source.', 'Good to know, because gear can inflate damage outside your class skills.'],
    'pet / companion': ['Pet or Companion', 'Damage done by a companion, pet, summon, or companion power.', 'The app matched the power or source as companion-related.', 'Turn companion damage off if you want player-only output.'],
    'other / unknown': ['Unknown Source', 'The app could not confidently identify this source yet.', 'The power name did not match the current known lists.', 'Treat it as “needs review.” It may be a proc, old name, boss effect, or missing mapping.'],
    'first use': ['First Use', 'When this power first appeared in the selected fight.', 'Time from fight start to the first hit from this power.', 'Use it to check opener timing. Important powers should usually appear early.'],
    'last use': ['Last Use', 'When this power last appeared in the selected fight.', 'Time from fight start to the final hit from this power.', 'Use it to see whether a power was used throughout the fight or only once.'],
    'avg interval': ['Average Gap', 'Average time between uses of this power.', 'Time between first and last use divided by number of gaps.', 'Shorter gap means the power was used more often. If the gap is too long, the player may be missing casts.'],
    'activations': ['Activations', 'How many times this power showed up in the log.', 'Count the rows or grouped uses for this power.', 'Use it to see whether a power was used enough during the fight.'],
    'power usage frequency': ['Power Usage Frequency', 'How often each power appeared during the fight.', 'The app checks first use, last use, and average gap between uses.', 'This helps find missed casts, late openers, and unused skills.'],
    'cooldown efficiency': ['Cooldown Efficiency', 'How well cooldown powers were used.', 'Actual uses compared with estimated possible uses.', 'Low efficiency can mean the player forgot the power, delayed it, or held it for mechanics.'],
    'cd': ['Cooldown', 'How long the skill usually waits before it can be used again.', 'This is the expected cooldown used for rough timing checks.', 'Use it only as a guide, because buffs and game effects can change cooldowns.'],
    'uses': ['Uses', 'How many times this power was used or appeared.', 'Count the matching activations in this fight.', 'Compare Uses with Max to see if casts were missed.'],
    'max': ['Max', 'The highest value in this row, or the estimated maximum possible uses in cooldown tables.', 'Meaning depends on the table you are viewing.', 'Use the column beside it to understand whether this is max hit or max possible casts.'],
    'max uses': ['Max Uses', 'Estimated number of times this cooldown could have been used.', 'Fight length divided by cooldown, rounded into possible casts.', 'This is an estimate, not a perfect rule. Boss phases and movement can change it.'],
    'efficiency': ['Efficiency', 'How close actual use was to the estimated possible use.', 'Uses divided by estimated max uses.', 'Higher usually means better uptime. Low can mean missed casts or intentional saving.'],
    'healing': ['Healing', 'Health restored by the player or received by the player.', 'The app adds healing rows from the log.', 'Useful for supports, but deaths and damage taken matter too.'],
    'healing done': ['Healing Done', 'Healing credited to this player.', 'Add healing numbers owned by this player.', 'Good for support review, but do not judge it alone.'],
    'damage taken': ['Damage Taken', 'Damage this player received.', 'Add damage rows where this player was the target.', 'High value can mean tanking, mistakes, or unavoidable mechanics.'],
    'shielded': ['Shielded', 'Damage blocked or absorbed by shields.', 'Add shield absorption rows for this player.', 'Useful for tanks and support effects.'],
    'survival': ['Survival', 'How much pressure the player took and whether they died.', 'Uses damage taken, healing, shielding, and death rows.', 'Use this to spot avoidable damage and support needs.'],
    'deaths': ['Deaths', 'Times this player was killed in the selected view.', 'The app finds killing blow rows against the player.', 'Open this when damage looks good but the player keeps dying.'],
    'death log': ['Death Log', 'List of killing hits against the selected player.', 'Each row shows what killed them and when.', 'Use it to find repeated mistakes or dangerous mechanics.'],
    'rotation': ['Rotation', 'When powers were used during the fight.', 'The app places power hits along the fight timeline.', 'Use it to check opener, burst timing, downtime, and missed casts.'],
    'dps pace': ['DPS Pace', 'Damage speed over time.', 'The app calculates rolling 3-second damage across the fight.', 'Spikes show burst. Flat parts show downtime or no damage.'],
    'power activations': ['Power Activations', 'When each power appeared during the fight.', 'Each mark or cell shows activity from that power.', 'Use it to see whether the rotation was steady or messy.'],
    'chart style': ['Chart Style', 'Choose how to view the same data.', 'The numbers stay the same; only the chart shape changes.', 'Use line or area for timing, bar for ranking, heatmap for activity, and donut for share.'],
    'party overview': ['Party Overview', 'A quick party ranking for the selected fight.', 'Each player is calculated with the same fight filter.', 'Click a player row to inspect them below.'],
    'encounter filters': ['Encounter Filters', 'Fight buttons that choose what part of the log to analyze.', 'Selecting a fight keeps only rows from that time window.', 'Use this before comparing players so everyone is judged on the same fight.'],
    'snapshot': ['Snapshot', 'The main summary page for the selected player.', 'Shows the most important totals in one place.', 'Start here, then check rotation or power damage for details.'],
    'power damage': ['Power Damage', 'Damage split by skill or source.', 'Group hits by power name, then add damage and hit count.', 'This shows which powers carried the player’s output.'],
    'compare players': ['Compare Players', 'Compare selected players in the same fight.', 'Every selected player uses the same filters.', 'Good for fair boss-window comparison.'],
    'companions': ['Companions', 'Damage from pets, summons, and companion powers.', 'The app groups companion-like rows together.', 'Use this to see how much output came from the companion instead of the player.'],
    'icon mapper': ['Icon Mapper', 'Checks which image file is matched to each power.', 'Exact filename match first, then fallback match.', 'Use this when an icon is missing or wrong.']
  };

  var activeTarget = null;
  var lastPointer = { x: 0, y: 0 };
  var raf = 0;

  function findInfo(label){
    var key = SG.normalize(label);
    if(glossary[key]) return glossary[key];
    var keys = Object.keys(glossary);
    for(var i=0;i<keys.length;i++){
      if(key.indexOf(keys[i]) !== -1 || keys[i].indexOf(key) !== -1) return glossary[keys[i]];
    }
    return [label || 'Item', 'This is part of the current fight review.', 'The app reads the combat log, applies the selected player and fight filters, then shows the matching result.', 'Use this as a clue. If it looks important, open the related table to see where it came from.'];
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

  function formatValue(value){ try { return window.fmt ? window.fmt(value) : String(value); } catch(e){ return String(value); } }
  function formatDuration(value){ try { return window.dur ? window.dur(value) : String(value) + 's'; } catch(e){ return String(value); } }

  function headerForCell(cell){
    var table = cell.closest('table');
    if(!table) return '';
    var index = Array.prototype.indexOf.call(cell.parentElement.children, cell);
    var header = table.querySelectorAll('thead th')[index];
    return header ? header.textContent.trim() : '';
  }

  function isMenuOrControl(el){ return !!(el && el.closest('button,a,label,input,select,textarea,#tabs,.chips,.sg-no-help,[data-no-help]')); }

  function targetFromElement(el){
    if(!el || el.closest('#sg-help-drawer,#sg-tooltip,#sg-log-guide-modal')) return null;
    if(isMenuOrControl(el)) return null;
    var card = el.closest('.card'); if(card) return { node:card, label:(card.querySelector('span')||card).textContent.trim(), value:(card.querySelector('b')||card).textContent.trim(), source:'Summary card', numeric:true };
    var power = el.closest('.barrow,.powerRow,.actRow,.miniLine'); if(power) return { node:power, label:(power.querySelector('b,span')||power).textContent.trim(), source:'Power row', power:true };
    var td = el.closest('td'); if(td) return { node:td, label:headerForCell(td) || td.textContent.trim(), value:td.textContent.trim(), source:'Table cell', numeric:/[0-9]/.test(td.textContent) };
    var th = el.closest('th'); if(th) return { node:th, label:th.textContent.trim(), source:'Table column', headerOnly:true };
    var heading = el.closest('h1,h2,h3'); if(heading) return { node:heading, label:heading.textContent.trim(), source:'Section title', headerOnly:true };
    var cls = el.closest('.classPill'); if(cls) return { node:cls, label:'Class', source:cls.textContent.trim() };
    var img = el.closest('.assetIcon,.nwIcon'); if(img) return { node:img, label:img.getAttribute('alt') || img.getAttribute('title') || 'Icon', source:'Icon' };
    return null;
  }

  function sameTarget(a,b){ return !!(a && b && a.node === b.node); }
  function hideHelpTooltip(){ activeTarget = null; if(raf) cancelAnimationFrame(raf); raf = 0; SG.hideTooltip(); }

  function scheduleTooltipMove(){
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      var tip = document.getElementById('sg-tooltip');
      if(!tip || !tip.classList.contains('is-visible')) return;
      tip.style.left = Math.min(lastPointer.x + 14, window.innerWidth - 360) + 'px';
      tip.style.top = Math.min(lastPointer.y + 14, window.innerHeight - 150) + 'px';
      var underPointer = document.elementFromPoint(lastPointer.x, lastPointer.y);
      if(!sameTarget(activeTarget, targetFromElement(underPointer))) hideHelpTooltip();
    });
  }

  function showForEvent(event, target){
    if(sameTarget(activeTarget, target)) return;
    activeTarget = target;
    var info = findInfo(target.label);
    SG.showTooltip(event, info[0], target.power ? 'This is one skill, pet hit, item proc, or other effect. Click it for a simple breakdown.' : info[1]);
  }

  function drawerHtml(target){
    var info = findInfo(target.label);
    var s = selectedSummary();
    var value = target.value ? '<p class="sg-drawer-value">' + SG.escape(target.value) + '</p>' : '';
    return '<span class="eyebrow">Strikeglass help</span><h2>'+SG.escape(info[0])+'</h2>'+value+
      '<section><h3>What it means</h3><p>'+SG.escape(target.power ? 'This is one skill, pet hit, item proc, or other effect found in the log.' : info[1])+'</p></section>'+ 
      '<section><h3>How the app gets it</h3><p>'+SG.escape(target.power ? 'The app finds every hit with this same name in the selected fight, then adds the damage and counts the hits.' : info[2])+'</p></section>'+ 
      '<section><h3>How players should use it</h3><p>'+SG.escape(target.power ? 'Check the category to see if this came from the player’s class, a pet, a mount, an item, or an enchant. That tells you what actually carried the damage.' : info[3])+'</p></section>'+ 
      '<section><h3>Current view</h3><dl><dt>Clicked from</dt><dd>'+SG.escape(target.source||'-')+'</dd><dt>Player</dt><dd>'+SG.escape(s?s.player:'-')+'</dd><dt>Rows in this view</dt><dd>'+SG.escape(s?String(s.rows):'-')+'</dd><dt>Player hit rows</dt><dd>'+SG.escape(s?String(s.valid):'-')+'</dd><dt>Fight windows</dt><dd>'+SG.escape(s?String(s.encs):'-')+'</dd><dt>Companion damage</dt><dd>'+SG.escape((typeof state !== 'undefined' && state.includeCompanions === false)?'Hidden':'Included')+'</dd></dl></section>'+ 
      '<section><h3>Selected player totals</h3><dl><dt>Total damage</dt><dd>'+SG.escape(s?formatValue(s.total):'-')+'</dd><dt>DPS</dt><dd>'+SG.escape(s?formatValue(s.dps):'-')+'</dd><dt>Combat DPS</dt><dd>'+SG.escape(s?formatValue(s.combatDps):'-')+'</dd><dt>Duration</dt><dd>'+SG.escape(s?formatDuration(s.duration):'-')+'</dd><dt>Fighting time</dt><dd>'+SG.escape(s?formatDuration(s.combatTime):'-')+'</dd><dt>Hits</dt><dd>'+SG.escape(s?String(s.hits):'-')+'</dd></dl></section>';
  }

  document.addEventListener('pointerover', function(event){
    var target = targetFromElement(event.target);
    if(!target) return;
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
    showForEvent(event, target);
  }, true);

  document.addEventListener('pointermove', function(event){ lastPointer.x = event.clientX; lastPointer.y = event.clientY; if(activeTarget) scheduleTooltipMove(); }, true);
  document.addEventListener('pointerout', function(event){ if(!activeTarget) return; var to = event.relatedTarget; if(!to || !sameTarget(activeTarget, targetFromElement(to))) hideHelpTooltip(); }, true);

  document.addEventListener('click', function(event){
    var target = targetFromElement(event.target);
    hideHelpTooltip();
    if(!target) return;
    if(target.headerOnly) return;
    if(!(target.numeric || target.power || target.source === 'Summary card')) return;
    SG.openDrawer('sg-help-drawer', 'Strikeglass help', drawerHtml(target));
  }, true);

  document.addEventListener('scroll', hideHelpTooltip, true);
  document.addEventListener('keydown', function(event){ if(event.key === 'Escape') hideHelpTooltip(); }, true);
  window.addEventListener('blur', hideHelpTooltip);
  document.addEventListener('visibilitychange', function(){ if(document.hidden) hideHelpTooltip(); });
})();
