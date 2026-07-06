(function(){
  'use strict';

  var compareIds = new Set();
  var decoder = new TextDecoder();

  function ready(fn){
    if(window.SG && SG.ready) SG.ready(fn);
    else if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  function esc(value){
    if(window.SG && SG.escape) return SG.escape(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function text(node){ return String(node && node.textContent || '').replace(/\s+/g,' ').trim(); }
  function fmt(value){ try { return window.fmt ? window.fmt(value) : Math.round(Number(value)||0).toLocaleString(); } catch(_) { return String(value || 0); } }
  function dur(value){ try { return window.dur ? window.dur(value) : Math.round(Number(value)||0)+'s'; } catch(_) { return String(value || 0)+'s'; } }
  function pct(value){ return (Number(value)||0).toFixed(1)+'%'; }

  function setStatus(html){
    var status = document.getElementById('status');
    if(status) status.innerHTML = html;
  }

  function ext(name){ return String(name || '').split('.').pop().toLowerCase(); }

  function readU16(view, offset){ return view.getUint16(offset, true); }
  function readU32(view, offset){ return view.getUint32(offset, true); }

  function findEndOfCentralDirectory(view){
    var min = Math.max(0, view.byteLength - 66000);
    for(var offset = view.byteLength - 22; offset >= min; offset--){
      if(readU32(view, offset) === 0x06054b50) return offset;
    }
    return -1;
  }

  function collectZipEntries(buffer){
    var view = new DataView(buffer);
    var eocd = findEndOfCentralDirectory(view);
    if(eocd < 0) throw new Error('Could not find ZIP central directory. This file may be corrupt. Naturally, the file chose violence.');
    var count = readU16(view, eocd + 10);
    var offset = readU32(view, eocd + 16);
    var entries = [];
    for(var i = 0; i < count; i++){
      if(readU32(view, offset) !== 0x02014b50) break;
      var flags = readU16(view, offset + 8);
      var method = readU16(view, offset + 10);
      var compressedSize = readU32(view, offset + 20);
      var uncompressedSize = readU32(view, offset + 24);
      var nameLength = readU16(view, offset + 28);
      var extraLength = readU16(view, offset + 30);
      var commentLength = readU16(view, offset + 32);
      var localOffset = readU32(view, offset + 42);
      var rawName = new Uint8Array(buffer, offset + 46, nameLength);
      var name = decoder.decode(rawName);
      entries.push({ name:name, flags:flags, method:method, compressedSize:compressedSize, uncompressedSize:uncompressedSize, localOffset:localOffset });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  async function inflateRaw(bytes){
    if(!('DecompressionStream' in window)) throw new Error('This browser cannot decompress deflated ZIP entries. Try extracting the ZIP first, then upload the .log file. Yes, browser APIs are a soap opera.');
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function extractLogFromZip(file){
    var buffer = await file.arrayBuffer();
    var view = new DataView(buffer);
    var entries = collectZipEntries(buffer).filter(function(entry){
      return !/\/$/.test(entry.name) && /(^|\/)(gameclient\.log|.*\.log|.*\.txt|.*\.csv)$/i.test(entry.name);
    });
    if(!entries.length) throw new Error('ZIP opened, but no .log, .txt, or .csv combat log was found inside.');
    entries.sort(function(a,b){
      var ag = /gameclient\.log$/i.test(a.name) ? 0 : 1;
      var bg = /gameclient\.log$/i.test(b.name) ? 0 : 1;
      return ag - bg || b.uncompressedSize - a.uncompressedSize;
    });
    var entry = entries[0];
    if(entry.flags & 1) throw new Error('Encrypted ZIP files are not supported. Extract it first, then upload the log.');
    if(readU32(view, entry.localOffset) !== 0x04034b50) throw new Error('ZIP local file header is invalid for '+entry.name+'.');
    var localNameLength = readU16(view, entry.localOffset + 26);
    var localExtraLength = readU16(view, entry.localOffset + 28);
    var dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
    var compressed = new Uint8Array(buffer, dataStart, entry.compressedSize);
    var output;
    if(entry.method === 0) output = compressed;
    else if(entry.method === 8) output = await inflateRaw(compressed);
    else throw new Error('ZIP compression method '+entry.method+' is not supported yet.');
    var cleanName = entry.name.split('/').pop() || 'GameClient.log';
    return new File([output], cleanName, { type:'text/plain' });
  }

  function installZipUpload(){
    var input = document.getElementById('file');
    if(!input || input.dataset.sgZipEnhanced) return;
    input.dataset.sgZipEnhanced = '1';
    input.setAttribute('accept','.log,.txt,.csv,.zip');
    input.addEventListener('change', async function(event){
      var file = input.files && input.files[0];
      if(!file || ext(file.name) !== 'zip') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.classList.add('sg-loading-log');
      setStatus('<strong>Extracting ZIP...</strong> Looking for GameClient.log inside '+esc(file.name)+'.');
      var content = document.getElementById('content');
      if(content){
        content.innerHTML = '<section class="panel sg-zip-working"><strong>Extracting compressed combat log</strong><p class="sg-zip-note">The ZIP is opened locally in your browser. Nothing is uploaded.</p><div class="sg-zip-progress"><i></i></div></section>';
      }
      try{
        var extracted = await extractLogFromZip(file);
        setStatus('<strong>ZIP extracted.</strong> Parsing '+esc(extracted.name)+'...');
        input.value = '';
        if(typeof window.StrikeglassParseFile === 'function') window.StrikeglassParseFile(extracted);
        else throw new Error('Parser entry point is not ready yet. Refresh and try again.');
      } catch(error){
        console.error(error);
        document.body.classList.remove('sg-loading-log');
        input.value = '';
        setStatus('<strong>ZIP extraction failed.</strong> '+esc(error.message || error));
        if(content) content.innerHTML = '<section class="panel"><h2>ZIP extraction failed</h2><p class="mut">'+esc(error.message || error)+'</p></section>';
      }
    }, true);
  }

  function getFastParty(){
    try { return state && state.fastReport && state.fastReport.party ? state.fastReport.party : []; } catch(_) { return []; }
  }

  function getPlayerList(){
    var merged = [];
    try { if(state && state.players) merged = merged.concat(state.players); } catch(_) {}
    getFastParty().forEach(function(player){
      if(!merged.some(function(item){ return item.id === player.id; })) merged.push(player);
    });
    return merged;
  }

  function findPlayerByName(name){
    return getPlayerList().find(function(player){ return String(player.name || '').trim() === String(name || '').trim(); });
  }

  function rowPlayer(row){
    var id = row.dataset.playerId || row.dataset.sgPlayerId;
    var name = '';
    var link = row.querySelector('[data-player-id]');
    if(link) id = id || link.dataset.playerId;
    if(id){
      var byId = getPlayerList().find(function(player){ return player.id === id; }) || getFastParty().find(function(player){ return player.id === id; });
      if(byId) return byId;
    }
    var cells = Array.from(row.cells || []);
    for(var i=0;i<cells.length;i++){
      var value = text(cells[i]);
      if(value && !/^\d+$/.test(value) && value.toLowerCase() !== 'select'){
        var match = findPlayerByName(value);
        if(match) return match;
      }
    }
    return null;
  }

  function compareToolbar(panel, table){
    var tools = panel.querySelector('.sg-table-tools');
    if(!tools){
      tools = document.createElement('div');
      tools.className = 'sg-table-tools sg-no-help';
      table.closest('.table').parentNode.insertBefore(tools, table.closest('.table'));
    }
    if(tools.querySelector('.sg-compare-tools')) return tools.querySelector('.sg-compare-tools');
    var wrap = document.createElement('div');
    wrap.className = 'sg-compare-tools sg-no-help';
    wrap.innerHTML = '<button type="button" class="sg-compare-run" disabled>Compare selected (0)</button><button type="button" class="ghost sg-compare-clear">Clear</button>';
    tools.appendChild(wrap);
    wrap.querySelector('.sg-compare-run').addEventListener('click', renderSelectedComparison);
    wrap.querySelector('.sg-compare-clear').addEventListener('click', function(){
      compareIds.clear();
      updateCompareSelection();
    });
    return wrap;
  }

  function updateCompareSelection(){
    Array.from(document.querySelectorAll('[data-sg-player-id]')).forEach(function(row){
      var selected = compareIds.has(row.dataset.sgPlayerId);
      row.classList.toggle('sg-compare-selected', selected);
      var box = row.querySelector('.sg-compare-check');
      if(box) box.checked = selected;
    });
    Array.from(document.querySelectorAll('.sg-compare-run')).forEach(function(button){
      button.textContent = 'Compare selected ('+compareIds.size+')';
      button.disabled = compareIds.size < 2;
    });
  }

  function enhancePartySelection(panel){
    if(!panel || text(panel.querySelector('h2,h3')).toLowerCase().indexOf('party overview') === -1) return;
    var table = panel.querySelector('table');
    if(!table || table.dataset.sgCompareEnhanced) return;
    table.dataset.sgCompareEnhanced = '1';
    compareToolbar(panel, table);
    var headerRow = table.tHead && table.tHead.rows[0];
    if(headerRow && !headerRow.querySelector('.sg-compare-check-cell')){
      var th = document.createElement('th');
      th.className = 'sg-compare-check-cell sg-no-help';
      th.textContent = 'Select';
      headerRow.insertBefore(th, headerRow.firstChild);
    }
    Array.from(table.tBodies[0].rows).forEach(function(row){
      if(row.querySelector('.empty')) return;
      var player = rowPlayer(row);
      if(!player || !player.id) return;
      row.dataset.sgPlayerId = player.id;
      if(!row.querySelector('.sg-compare-check-cell')){
        var td = document.createElement('td');
        td.className = 'sg-compare-check-cell sg-no-help';
        td.innerHTML = '<input class="sg-compare-check" type="checkbox" aria-label="Select '+esc(player.name)+' for comparison">';
        row.insertBefore(td, row.firstChild);
        var box = td.querySelector('input');
        box.addEventListener('click', function(event){ event.stopPropagation(); });
        box.addEventListener('change', function(event){
          event.stopPropagation();
          if(box.checked) compareIds.add(player.id);
          else compareIds.delete(player.id);
          updateCompareSelection();
        });
      }
    });
    updateCompareSelection();
  }

  function metricsFromFast(id){
    var player = getFastParty().find(function(item){ return item.id === id; });
    if(!player) return null;
    return {
      id: player.id,
      name: player.name,
      damage: player.damage || 0,
      dps: player.dps || 0,
      combatDps: player.combatDps || 0,
      hits: player.hits || 0,
      duration: player.duration || 0,
      crit: player.crit || 0,
      flank: player.flank || 0,
      companionDamage: player.companionDamage || 0
    };
  }

  function metricsFromRows(id){
    try{
      if(!state || state.summaryOnly || !state.rows || !state.rows.length || !window.NWParser) return null;
      var players = getPlayerList();
      var player = players.find(function(item){ return item.id === id; });
      var rows = typeof scopeRows === 'function' ? scopeRows() : state.rows;
      var encs = typeof activeEncounters === 'function' ? activeEncounters() : state.encounters;
      var m = NWParser.metrics(rows, id, encs);
      return {
        id: id,
        name: player ? player.name : id,
        damage: m.total || 0,
        dps: m.dps || 0,
        combatDps: m.combatDps || 0,
        hits: m.hits || 0,
        duration: m.duration || 0,
        crit: m.crit || 0,
        flank: m.flank || 0,
        companionDamage: 0
      };
    } catch(_) { return null; }
  }

  function selectedMetrics(){
    return Array.from(compareIds).map(function(id){
      return metricsFromRows(id) || metricsFromFast(id);
    }).filter(Boolean).sort(function(a,b){ return b.damage - a.damage; });
  }

  function csvValue(value){ return '"'+String(value == null ? '' : value).replace(/"/g,'""')+'"'; }
  function exportCompareCsv(rows){
    var columns = ['Player','Damage','DPS','Combat DPS','Hits','Duration seconds','Crit rate','Combat advantage rate','Companion damage'];
    var body = rows.map(function(row){
      return [row.name,row.damage,row.dps,row.combatDps,row.hits,row.duration,row.crit,row.flank,row.companionDamage].map(csvValue).join(',');
    });
    var blob = new Blob([columns.join(',')+'\n'+body.join('\n')], { type:'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'strikeglass-player-comparison.csv';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
  }

  function renderSelectedComparison(){
    var rows = selectedMetrics();
    var content = document.getElementById('content');
    if(!content) return;
    if(rows.length < 2){
      content.innerHTML = '<section class="panel"><h2>Compare players</h2><p class="mut">Select at least two players from Party Overview.</p></section>';
      return;
    }
    var cards = rows.slice(0,4).map(function(row){
      return '<article class="sg-compare-card"><h3>'+esc(row.name)+'</h3><dl><dt>Damage</dt><dd>'+fmt(row.damage)+'</dd><dt>DPS</dt><dd>'+fmt(row.dps)+'</dd><dt>Combat DPS</dt><dd>'+fmt(row.combatDps)+'</dd><dt>Hits</dt><dd>'+Number(row.hits||0).toLocaleString()+'</dd><dt>Crit</dt><dd>'+pct(row.crit)+'</dd><dt>CA</dt><dd>'+pct(row.flank)+'</dd></dl></article>';
    }).join('');
    var body = rows.map(function(row,index){
      return '<tr><td>'+(index+1)+'</td><td>'+esc(row.name)+'</td><td>'+fmt(row.damage)+'</td><td>'+fmt(row.dps)+'</td><td>'+fmt(row.combatDps)+'</td><td>'+Number(row.hits||0).toLocaleString()+'</td><td>'+dur(row.duration)+'</td><td>'+pct(row.crit)+'</td><td>'+pct(row.flank)+'</td><td>'+fmt(row.companionDamage)+'</td></tr>';
    }).join('');
    content.innerHTML = '<section class="panel sg-compare-panel"><div class="sg-compare-summary"><div><span class="eyebrow">Compare players</span><h2>'+rows.length+' selected players</h2><p class="sg-compare-note">Same active encounter scope. Sorted by total damage. Because comparing different fights would be spreadsheet astrology.</p></div><button type="button" class="sg-compare-export">Export CSV</button></div><div class="sg-compare-grid">'+cards+'</div><div class="table"><table><thead><tr><th>#</th><th>Player</th><th>Damage</th><th>DPS</th><th>Combat DPS</th><th>Hits</th><th>Duration</th><th>Crit</th><th>CA</th><th>Companion</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
    var exportButton = content.querySelector('.sg-compare-export');
    if(exportButton) exportButton.onclick = function(){ exportCompareCsv(rows); };
  }

  function installCompareEnhancer(){
    Array.from(document.querySelectorAll('section,.panel')).forEach(enhancePartySelection);
  }

  ready(function(){
    installZipUpload();
    installCompareEnhancer();
    var observer = new MutationObserver(function(){
      installCompareEnhancer();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  });
})();
