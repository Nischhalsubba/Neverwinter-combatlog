(function(){
  'use strict';

  var SG = window.SG || {};
  var allowedExtensions = ['log','txt','csv','zip'];
  var tableSortState = new WeakMap();
  var perf = window.StrikeglassPerf = window.StrikeglassPerf || { marks:{}, measures:[] };

  function ready(fn){
    if(SG.ready) SG.ready(fn);
    else if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  function escapeHtml(value){
    if(SG.escape) return SG.escape(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function getText(node){ return String(node && node.textContent || '').replace(/\s+/g,' ').trim(); }

  function mark(name){
    try { perf.marks[name] = performance.now(); } catch(_) { perf.marks[name] = Date.now(); }
  }

  function measure(name, start){
    var now;
    try { now = performance.now(); } catch(_) { now = Date.now(); }
    if(perf.marks[start] == null) return;
    var value = Math.round(now - perf.marks[start]);
    perf.measures.push({ name:name, ms:value, at:new Date().toISOString() });
    if(localStorage.getItem('strikeglass.debugPerf') === '1') console.info('[Strikeglass perf]', name + ':', value + 'ms');
  }

  function closeGuideModal(){
    var modal = document.getElementById('sg-log-guide-modal');
    if(!modal) return;
    try { localStorage.setItem('strikeglass.logGuide.seen.v1', '1'); } catch(_) {}
    modal.remove();
    document.body.classList.remove('sg-modal-open');
  }

  function closeHelpDrawer(){
    var drawer = document.getElementById('sg-help-drawer');
    if(drawer) drawer.classList.remove('is-open');
  }

  function installGlobalBugFixes(){
    document.addEventListener('click', function(event){
      if(event.target && event.target.closest('.sg-guide-done')){
        event.preventDefault();
        event.stopPropagation();
        closeGuideModal();
      }
    }, true);

    document.addEventListener('keydown', function(event){
      if(event.key !== 'Escape') return;
      closeGuideModal();
      closeHelpDrawer();
    }, true);
  }

  function enhanceFileInput(){
    var input = document.getElementById('file');
    if(!input || input.dataset.sgPmEnhanced) return;
    input.dataset.sgPmEnhanced = '1';
    input.setAttribute('aria-label','Upload Neverwinter combat log file');
    input.setAttribute('accept','.log,.txt,.csv,.zip');

    input.addEventListener('change', function(event){
      var file = input.files && input.files[0];
      if(!file) return;
      var ext = String(file.name || '').split('.').pop().toLowerCase();
      if(allowedExtensions.indexOf(ext) === -1){
        event.preventDefault();
        event.stopImmediatePropagation();
        input.value = '';
        var status = document.getElementById('status');
        if(status){
          status.innerHTML = '<strong>Unsupported file.</strong> Upload a .log, .txt, .csv, or .zip combat log.';
        }
        return false;
      }
      mark('parse:start');
      document.body.classList.add('sg-loading-log');
    }, true);

    var status = document.getElementById('status');
    if(status){
      new MutationObserver(function(){
        var text = getText(status).toLowerCase();
        if(text.indexOf('parsed') !== -1 || text.indexOf('fast mode') !== -1 || text.indexOf('party overview ready') !== -1){
          measure('upload to parsed status', 'parse:start');
          document.body.classList.remove('sg-loading-log');
        }
      }).observe(status, { childList:true, characterData:true, subtree:true });
    }
  }

  function enhanceTabs(){
    var tabs = document.getElementById('tabs');
    if(!tabs) return;
    tabs.setAttribute('role','tablist');
    Array.from(tabs.querySelectorAll('button')).forEach(function(button){
      button.setAttribute('role','tab');
      button.setAttribute('aria-selected', button.classList.contains('active') ? 'true' : 'false');
      if(!button.dataset.sgPmTab){
        button.dataset.sgPmTab = '1';
        button.addEventListener('click', function(){
          mark('tab:switch');
          setTimeout(function(){
            Array.from(tabs.querySelectorAll('button')).forEach(function(item){
              item.setAttribute('aria-selected', item.classList.contains('active') ? 'true' : 'false');
            });
            measure('tab render', 'tab:switch');
            enhanceAll();
          }, 60);
        });
      }
    });
  }

  function parseNumber(text){
    var raw = String(text || '').trim();
    var multiplier = 1;
    if(/b$/i.test(raw)) multiplier = 1000000000;
    else if(/m$/i.test(raw)) multiplier = 1000000;
    else if(/k$/i.test(raw)) multiplier = 1000;
    var numeric = Number(raw.replace(/[^0-9.\-]/g,''));
    return Number.isFinite(numeric) ? numeric * multiplier : null;
  }

  function sortTable(table, columnIndex, th){
    var tbody = table.tBodies && table.tBodies[0];
    if(!tbody) return;
    var state = tableSortState.get(table) || { index:-1, dir:1 };
    var dir = state.index === columnIndex ? state.dir * -1 : 1;
    tableSortState.set(table, { index:columnIndex, dir:dir });

    var rows = Array.from(tbody.rows).filter(function(row){ return !row.querySelector('.empty'); });
    rows.sort(function(a,b){
      var at = getText(a.cells[columnIndex]);
      var bt = getText(b.cells[columnIndex]);
      var an = parseNumber(at);
      var bn = parseNumber(bt);
      if(an != null && bn != null) return (an - bn) * dir;
      return at.localeCompare(bt, undefined, { numeric:true, sensitivity:'base' }) * dir;
    });
    rows.forEach(function(row){ tbody.appendChild(row); });
    Array.from(table.querySelectorAll('th')).forEach(function(header){
      header.classList.remove('sg-sort-active');
      header.removeAttribute('data-sort-dir');
      header.setAttribute('aria-sort','none');
    });
    th.classList.add('sg-sort-active');
    th.setAttribute('data-sort-dir', dir > 0 ? 'asc' : 'desc');
    th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
  }

  function enhanceSortableTable(table){
    if(!table || table.dataset.sgSortable) return;
    table.dataset.sgSortable = '1';
    Array.from(table.querySelectorAll('thead th')).forEach(function(th,index){
      th.setAttribute('tabindex','0');
      th.setAttribute('aria-sort','none');
      th.addEventListener('click', function(event){
        if(event.target && event.target.closest('input,button,a,select,label')) return;
        sortTable(table,index,th);
      });
      th.addEventListener('keydown', function(event){
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          sortTable(table,index,th);
        }
      });
    });
  }

  function panelTitle(panel){
    var heading = panel && panel.querySelector('h2,h3');
    return getText(heading).toLowerCase();
  }

  function addPartySearch(panel){
    if(!panel || panel.dataset.sgPartySearch) return;
    if(panelTitle(panel).indexOf('party overview') === -1) return;
    var table = panel.querySelector('table');
    if(!table) return;
    panel.dataset.sgPartySearch = '1';
    var tools = document.createElement('div');
    tools.className = 'sg-table-tools sg-no-help';
    tools.innerHTML = '<input class="sg-table-search" type="search" placeholder="Search player, class, DPS..." aria-label="Search Party Overview table">';
    table.closest('.table').parentNode.insertBefore(tools, table.closest('.table'));
    var input = tools.querySelector('input');
    input.addEventListener('input', function(){
      var query = input.value.trim().toLowerCase();
      var visible = 0;
      Array.from(table.tBodies[0].rows).forEach(function(row){
        var show = !query || getText(row).toLowerCase().indexOf(query) !== -1;
        row.style.display = show ? '' : 'none';
        if(show) visible++;
      });
      var empty = panel.querySelector('.sg-empty-note');
      if(!visible){
        if(!empty){
          empty = document.createElement('div');
          empty.className = 'sg-empty-note';
          table.closest('.table').after(empty);
        }
        empty.textContent = 'No matching players in this table.';
      } else if(empty) empty.remove();
    });
  }

  function improveEmptyStates(panel){
    if(!panel) return;
    Array.from(panel.querySelectorAll('td.empty')).forEach(function(cell){
      var title = panelTitle(panel);
      if(getText(cell) && getText(cell) !== 'No rows') return;
      if(title.indexOf('healing') !== -1) cell.textContent = 'No healing found for the selected player and fight scope.';
      else if(title.indexOf('shield') !== -1) cell.textContent = 'No shielding or absorption rows found for this scope.';
      else if(title.indexOf('death') !== -1) cell.textContent = 'No deaths found in this selected fight scope.';
      else if(title.indexOf('companion') !== -1) cell.textContent = 'No companion damage found with the current filters.';
      else cell.textContent = 'No rows match the current player, encounter, and filter selection.';
    });
  }

  function enhanceToggles(){
    Array.from(document.querySelectorAll('label')).forEach(function(label){
      var box = label.querySelector('input[type="checkbox"]');
      if(!box || label.dataset.sgToggleEnhanced) return;
      label.dataset.sgToggleEnhanced = '1';
      label.classList.add('sg-toggle-pill','sg-no-help');
      box.setAttribute('role','switch');
      box.setAttribute('aria-checked', box.checked ? 'true' : 'false');
      box.addEventListener('change', function(){ box.setAttribute('aria-checked', box.checked ? 'true' : 'false'); });
    });
  }

  function pruneChartStyleLists(){
    var blocked = ['candlestick','boxplot','box plot','violin','funnel','radial','gauge','bubble','scatter','treemap'];
    Array.from(document.querySelectorAll('select')).forEach(function(select){
      if(select.dataset.sgChartPruned) return;
      var labelText = '';
      var label = select.closest('label');
      if(label) labelText = getText(label).toLowerCase();
      if(labelText.indexOf('chart style') === -1 && getText(select.parentElement).toLowerCase().indexOf('chart style') === -1) return;
      Array.from(select.options).forEach(function(option){
        var text = getText(option).toLowerCase();
        if(blocked.some(function(word){ return text.indexOf(word) !== -1; })) option.remove();
      });
      select.dataset.sgChartPruned = '1';
    });
  }

  function protectPowerRowExpansion(){
    Array.from(document.querySelectorAll('.powerRow')).forEach(function(row){
      row.classList.add('sg-no-help');
      row.setAttribute('title','Click to expand raw hits for this power.');
    });
  }

  function enhanceTables(){
    Array.from(document.querySelectorAll('.panel, section')).forEach(function(panel){
      addPartySearch(panel);
      improveEmptyStates(panel);
    });
    Array.from(document.querySelectorAll('.table table')).forEach(enhanceSortableTable);
  }

  function enhanceAll(){
    enhanceFileInput();
    enhanceTabs();
    enhanceTables();
    enhanceToggles();
    pruneChartStyleLists();
    protectPowerRowExpansion();
  }

  ready(function(){
    installGlobalBugFixes();
    enhanceAll();
    var observer = new MutationObserver(function(){ enhanceAll(); });
    observer.observe(document.body, { childList:true, subtree:true });
  });
})();
