(function(){
  'use strict';

  var TABLE_THRESHOLD = 180;
  var OVERSCAN = 12;
  var reportCache = new Map();
  var scheduled = false;
  var toastTimer = 0;

  window.StrikeglassPerf = window.StrikeglassPerf || {};
  window.StrikeglassPerf.marks = window.StrikeglassPerf.marks || {};
  window.StrikeglassPerf.measures = Array.isArray(window.StrikeglassPerf.measures) ? window.StrikeglassPerf.measures : [];
  window.StrikeglassPerf.longTasks = Array.isArray(window.StrikeglassPerf.longTasks) ? window.StrikeglassPerf.longTasks : [];

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

  function numberFromText(raw){
    raw = String(raw || '').trim();
    var multiplier = 1;
    if(/b$/i.test(raw)) multiplier = 1e9;
    else if(/m$/i.test(raw)) multiplier = 1e6;
    else if(/k$/i.test(raw)) multiplier = 1e3;
    var value = Number(raw.replace(/[^0-9.\-]/g,''));
    return Number.isFinite(value) ? value * multiplier : null;
  }

  function showToast(message){
    var node = document.querySelector('.sg-cache-toast');
    if(!node){
      node = document.createElement('div');
      node.className = 'sg-cache-toast sg-no-help';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ node.hidden = true; }, 1800);
  }

  function cacheKey(options){
    options = options || {};
    return [
      options.playerId || '',
      options.encounterId == null ? 'all' : options.encounterId,
      options.mode || '',
      options.includeCompanions === false ? 'no-pets' : 'pets'
    ].join('|');
  }

  function clearReportCache(){
    reportCache.clear();
    if(window.StrikeglassPerf) window.StrikeglassPerf.reportCacheSize = 0;
  }

  function installReportCache(){
    if(window.StrikeglassRequestPlayerReport && !window.StrikeglassRequestPlayerReport.__sgCached){
      var original = window.StrikeglassRequestPlayerReport;
      var cached = function(options){
        var key = cacheKey(options);
        if(reportCache.has(key)){
          if(localStorage.getItem('strikeglass.debugPerf') === '1') console.info('[Strikeglass cache] hit', key);
          return Promise.resolve(reportCache.get(key));
        }
        return original(options).then(function(report){
          reportCache.set(key, report);
          if(window.StrikeglassPerf) window.StrikeglassPerf.reportCacheSize = reportCache.size;
          return report;
        });
      };
      cached.__sgCached = true;
      window.StrikeglassRequestPlayerReport = cached;
    }
  }

  function installLongTaskObserver(){
    if(window.StrikeglassPerf.__longTaskObserverInstalled) return;
    window.StrikeglassPerf.__longTaskObserverInstalled = true;
    if(!Array.isArray(window.StrikeglassPerf.longTasks)) window.StrikeglassPerf.longTasks = [];
    try{
      var observer = new PerformanceObserver(function(list){
        if(!Array.isArray(window.StrikeglassPerf.longTasks)) window.StrikeglassPerf.longTasks = [];
        list.getEntries().forEach(function(entry){
          window.StrikeglassPerf.longTasks.push({ duration: Math.round(entry.duration), start: Math.round(entry.startTime) });
          if(localStorage.getItem('strikeglass.debugPerf') === '1') console.warn('[Strikeglass long task]', Math.round(entry.duration)+'ms');
        });
      });
      observer.observe({ entryTypes:['longtask'] });
    } catch(_) {}
  }

  function shouldSkipTable(table){
    if(!table || table.dataset.sgDoNotVirtualize) return true;
    if(table.closest('#party')) return true;
    if(table.closest('.sg-compare-panel')) return true;
    if(table.closest('.sg-fast-summary')) return true;
    if(table.closest('.sg-loading-shell')) return true;
    return false;
  }

  function collectRows(table){
    var tbody = table.tBodies && table.tBodies[0];
    if(!tbody) return [];
    return Array.from(tbody.rows).filter(function(row){
      return !row.classList.contains('sg-virtual-spacer') && !row.querySelector('.empty');
    }).map(function(row){
      return {
        html: row.outerHTML,
        cells: Array.from(row.cells).map(text)
      };
    });
  }

  function installVirtualSort(table, state){
    if(table.dataset.sgVirtualSort) return;
    table.dataset.sgVirtualSort = '1';
    Array.from(table.querySelectorAll('thead th')).forEach(function(th, index){
      th.addEventListener('click', function(event){
        if(!table.dataset.sgVirtualized) return;
        if(event.target && event.target.closest('input,button,a,select,label')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var dir = state.sortIndex === index ? state.sortDir * -1 : 1;
        state.sortIndex = index;
        state.sortDir = dir;
        state.rows.sort(function(a,b){
          var at = a.cells[index] || '';
          var bt = b.cells[index] || '';
          var an = numberFromText(at);
          var bn = numberFromText(bt);
          if(an != null && bn != null) return (an - bn) * dir;
          return at.localeCompare(bt, undefined, { numeric:true, sensitivity:'base' }) * dir;
        });
        Array.from(table.querySelectorAll('thead th')).forEach(function(header){
          header.removeAttribute('data-sort-dir');
          header.classList.remove('sg-sort-active');
          header.setAttribute('aria-sort','none');
        });
        th.setAttribute('data-sort-dir', dir > 0 ? 'asc' : 'desc');
        th.classList.add('sg-sort-active');
        th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
        renderVirtualWindow(table, state, true);
      }, true);
    });
  }

  function renderVirtualWindow(table, state, forceTop){
    var tbody = table.tBodies && table.tBodies[0];
    var container = state.container;
    if(!tbody || !container) return;
    var scrollTop = forceTop ? 0 : container.scrollTop;
    if(forceTop) container.scrollTop = 0;
    var visibleCount = Math.ceil(container.clientHeight / state.rowHeight) + OVERSCAN * 2;
    var start = Math.max(0, Math.floor(scrollTop / state.rowHeight) - OVERSCAN);
    var end = Math.min(state.rows.length, start + visibleCount);
    var topHeight = start * state.rowHeight;
    var bottomHeight = Math.max(0, (state.rows.length - end) * state.rowHeight);
    var colSpan = Math.max(1, table.querySelectorAll('thead th').length || (state.rows[0] && state.rows[0].cells.length) || 1);
    tbody.innerHTML = '<tr class="sg-virtual-spacer"><td colspan="'+colSpan+'" style="height:'+topHeight+'px"></td></tr>' +
      state.rows.slice(start,end).map(function(row){ return row.html; }).join('') +
      '<tr class="sg-virtual-spacer"><td colspan="'+colSpan+'" style="height:'+bottomHeight+'px"></td></tr>';
  }

  function virtualizeTable(table){
    if(shouldSkipTable(table) || table.dataset.sgVirtualized) return;
    var rows = collectRows(table);
    if(rows.length < TABLE_THRESHOLD) return;
    var container = table.closest('.table') || table.parentElement;
    if(!container) return;
    table.dataset.sgVirtualized = '1';
    container.classList.add('sg-virtualized');
    container.style.maxHeight = container.style.maxHeight || '70vh';
    var note = document.createElement('div');
    note.className = 'sg-virtual-note sg-no-help';
    note.textContent = 'Virtualized '+rows.length.toLocaleString()+' rows for faster scrolling';
    if(container.parentNode && !(container.previousElementSibling && container.previousElementSibling.classList && container.previousElementSibling.classList.contains('sg-virtual-note'))){
      container.parentNode.insertBefore(note, container);
    }
    var firstRow = table.tBodies[0] && table.tBodies[0].rows[0];
    var state = {
      rows: rows,
      rowHeight: Math.max(32, firstRow ? firstRow.getBoundingClientRect().height || 38 : 38),
      container: container,
      sortIndex: -1,
      sortDir: 1,
      raf: 0
    };
    installVirtualSort(table, state);
    renderVirtualWindow(table, state, false);
    container.addEventListener('scroll', function(){
      if(state.raf) return;
      state.raf = requestAnimationFrame(function(){
        state.raf = 0;
        renderVirtualWindow(table, state, false);
      });
    }, { passive:true });
  }

  function installVirtualTables(){
    Array.from(document.querySelectorAll('.table table')).forEach(virtualizeTable);
  }

  function enhanceClassCorrection(){
    Array.from(document.querySelectorAll('.classFix')).forEach(function(box){
      if(box.dataset.sgClassEnhanced) return;
      box.dataset.sgClassEnhanced = '1';
      var select = box.querySelector('select');
      if(!select) return;
      var note = document.createElement('small');
      note.className = 'sg-class-save-note';
      note.textContent = '';
      box.appendChild(note);
      var reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'sg-class-reset sg-no-help';
      reset.textContent = 'Reset class override';
      box.appendChild(reset);
      select.addEventListener('change', function(){
        note.textContent = select.value === 'Unknown' ? 'Override cleared.' : 'Saved locally.';
        showToast(note.textContent);
      });
      reset.addEventListener('click', function(event){
        event.preventDefault();
        select.value = 'Unknown';
        select.dispatchEvent(new Event('change', { bubbles:true }));
      });
    });
  }

  function scheduleEnhance(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(function(){
      scheduled = false;
      installReportCache();
      installVirtualTables();
      enhanceClassCorrection();
    });
  }

  function install(){
    installLongTaskObserver();
    installReportCache();
    installVirtualTables();
    enhanceClassCorrection();
    var file = document.getElementById('file');
    if(file) file.addEventListener('change', clearReportCache, true);
    var mode = document.getElementById('mode');
    if(mode) mode.addEventListener('change', clearReportCache, true);
    document.addEventListener('click', function(event){
      if(event.target && event.target.closest('#chips,[data-e],[data-fast-e]')) clearReportCache();
    }, true);
    var observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList:true, subtree:true });
  }

  ready(install);
})();
