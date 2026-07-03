(function(){
  var SG = window.SG;
  if(!SG) return;

  var glossary = {
    'damage': ['Damage', 'How much harm was done.', 'The app adds up the damage numbers from the combat log for the current player and fight.', 'Bigger is better, but compare it with time spent fighting.'],
    'total damage': ['Total Damage', 'All damage done by the selected player in the current fight view.', 'Add every valid damage hit from this player.', 'Use this to see total contribution. Use Combat DPS to compare speed.'],
    'dps': ['DPS', 'Damage per second for the whole selected time.', 'Total Damage divided by full duration.', 'If the player was running, waiting, dead, or doing mechanics, this number drops.'],
    'combat dps': ['Combat DPS', 'Damage per second while actually fighting.', 'Total Damage divided by active fighting time.', 'This is usually the fairer number for comparing boss damage.'],
    'hits': ['Hits', 'How many damage entries the log recorded.', 'Count the matching hit rows.', 'Some powers hit many times, so this is not the same as pressing a button.'],
    'total hits': ['Total Hits', 'All valid hit rows for the selected player and fight.', 'Count this player’s valid damage hits.', 'This is used to calculate crit rate and flank rate.'],
    'duration': ['Duration', 'How long the selected fight or player window lasted.', 'Last hit time minus first hit time.', 'Long pauses can make DPS look lower.'],
    'in-combat time': ['In-Combat Time', 'Time where the player was actively doing damage.', 'The app joins together active combat windows.', 'Combat DPS uses this so downtime hurts less.'],
    'crit rate': ['Crit Rate', 'How often hits were critical hits.', 'Critical hits divided by total hits.', 'High crit is good, but damage share still matters more.'],
    'crit%': ['Crit%', 'How often this power crit.', 'Critical hits from this power divided by all hits from this power.', 'Good for checking burst powers.'],
    'flank rate': ['Flank Rate', 'How often the player hit with combat advantage.', 'Combat-advantage hits divided by total hits.', 'In Neverwinter, this can make a big difference to damage.'],
    'max hit': ['Max Hit', 'The biggest single hit in this view.', 'Find the highest damage number.', 'Fun to see, but one big hit does not prove overall performance.'],
    'avg': ['Average', 'Average value per hit.', 'Total divided by hit count.', 'Read this together with hits. A few hits can make this noisy.'],
    'average': ['Average', 'Average value per hit.', 'Total divided by hit count.', 'Read this together with hits. A few hits can make this noisy.'],
    'share': ['Share', 'How much this row contributed to the total.', 'This row’s damage divided by the table total.', 'This shows what carried the fight.'],
    '%': ['Percent Share', 'How much of the total this row represents.', 'Row value divided by the total for this table.', 'Higher means this power or category mattered more.'],
    'power': ['Power', 'The skill, proc, item, pet, or effect that caused the hit.', 'Rows with the same power name are grouped together.', 'Use this to see what actually did the damage.'],
    'category': ['Category', 'The kind of thing that caused the damage.', 'The app checks the power name against known class powers, mounts, pets, items, feats, and enchants.', 'This helps you separate your real class buttons from pets, mounts, artifacts, and random procs.'],
    'healing done': ['Healing Done', 'Healing credited to the selected player.', 'Add healing numbers owned by this player.', 'Useful for support players, but read it with deaths and damage taken.'],
    'damage taken': ['Damage Taken', 'Damage received by the selected player.', 'Add damage rows where this player was the target.', 'High damage can mean tanking, mistakes, or unavoidable mechanics.'],
    'shielded': ['Shielded', 'Damage blocked or absorbed by shields.', 'Add shield absorption rows for this player.', 'Useful for tanks and support effects.'],
    'encounters': ['Encounters', 'How many fight windows are included.', 'The app splits the log into fight sections.', 'All encounters includes more than one boss or mob pull.'],
    'player': ['Player', 'The character being inspected.', 'The app filters rows to this player.', 'Changing player recalculates the details below.'],
    'class': ['Class', 'The class detected from the player’s powers.', 'The app looks for class-specific powers in the log.', 'If it is wrong, use the class correction dropdown.'],
    'party overview': ['Party Overview', 'A quick ranking of the party for the selected fight.', 'Each player is calculated with the same fight filter.', 'Click a player row to inspect that player below.'],
    'encounter filters': ['Encounter Filters', 'Fight buttons that choose what part of the log to analyze.', 'Selecting a fight keeps only rows from that time window.', 'Use this before comparing players.'],
    'snapshot': ['Snapshot', 'The main summary page.', 'Shows the most important totals for the selected player.', 'Start here, then check rotation or power damage.'],
    'rotation': ['Rotation', 'Shows when powers were used during the fight.', 'Each activation is placed on the fight timeline.', 'Use it to check opener, burst, and downtime.'],
    'power damage': ['Power Damage', 'Damage split by power name.', 'Group hits by power, then add their damage.', 'This shows which powers carried the output.'],
    'compare players': ['Compare Players', 'Compare selected players in the same fight.', 'Every selected player uses the same filters.', 'Good for fair boss-window comparison.'],
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
    return [label || 'Item', 'This comes from the uploaded combat log or the current screen.', 'The app only uses rows inside the selected player and fight filters.', 'Use it as a clue, then check the detailed table for context.'];
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
    SG.showTooltip(event, info[0], target.power ? 'This row is one power or effect. Click it for a plain breakdown.' : info[1]);
  }

  function drawerHtml(target){
    var info = findInfo(target.label);
    var s = selectedSummary();
    var value = target.value ? '<p class="sg-drawer-value">' + SG.escape(target.value) + '</p>' : '';
    return '<span class="eyebrow">Strikeglass help</span><h2>'+SG.escape(info[0])+'</h2>'+value+
      '<section><h3>Meaning</h3><p>'+SG.escape(target.power ? 'This is one power or effect found in the log. It might be your class skill, a feat, a mount, a pet, an artifact, an enchant, or a proc.' : info[1])+'</p></section>'+ 
      '<section><h3>How it is counted</h3><p>'+SG.escape(target.power ? 'The app finds every hit with this same power name in the selected fight, then adds the damage together.' : info[2])+'</p></section>'+ 
      '<section><h3>How to use it</h3><p>'+SG.escape(target.power ? 'Check the category to see where the damage came from. Class Power means your own skill. Mount, Pet, Item, or Enchant means extra sources helped.' : info[3])+'</p></section>'+ 
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
