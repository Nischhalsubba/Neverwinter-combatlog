(function(){
  var SG = window.SG;
  if(!SG) return;

  var guideKey = 'strikeglass.logGuide.seen.v1';

  function hasRows(){
    try { return typeof state !== 'undefined' && state.rows && state.rows.length > 0; }
    catch(e){ return false; }
  }

  function applyLayoutState(){
    var loaded = hasRows();
    document.body.classList.toggle('sg-empty-state', !loaded);
    document.body.classList.toggle('sg-has-log', loaded);
  }

  function uploadStage(){
    var main = document.querySelector('main');
    if(!main || document.getElementById('sg-upload-stage')) return;
    var section = document.createElement('section');
    section.id = 'sg-upload-stage';
    section.className = 'sg-upload-stage';
    section.innerHTML = [
      '<div class="sg-upload-copy">',
      '<span class="sg-kicker">Upload combat log</span>',
      '<h2>Start with your GameClient.log</h2>',
      '<p>Choose a Neverwinter combat log. Strikeglass parses it locally, then changes into a focused analysis workspace.</p>',
      '<div class="sg-upload-actions">',
      '<label class="sg-upload-button" for="file">Choose combat log</label>',
      '<button id="sg-open-log-guide" type="button">How to find the log</button>',
      '</div>',
      '</div>',
      '<div class="sg-upload-checklist">',
      '<b>Quick steps</b>',
      '<ol>',
      '<li>In chat, type <code>/combatlog 1</code></li>',
      '<li>Play a dungeon, trial, boss or training run</li>',
      '<li>Type <code>/combatlog 0</code></li>',
      '<li>Upload <code>GameClient.log</code></li>',
      '</ol>',
      '</div>'
    ].join('');
    main.insertBefore(section, main.firstElementChild);
    document.getElementById('sg-open-log-guide').onclick = function(){ openGuide(false); };
  }

  function openGuide(firstRun){
    var existing = document.getElementById('sg-log-guide-modal');
    if(existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'sg-log-guide-modal';
    modal.className = 'sg-log-guide-modal';
    modal.innerHTML = [
      '<div class="sg-log-guide-card" role="dialog" aria-modal="true" aria-label="How to find your Neverwinter combat log">',
      '<button class="sg-log-guide-close" type="button">Close</button>',
      '<span class="sg-kicker">First time setup</span>',
      '<h2>How to create and find your combat log</h2>',
      '<p>Do this once before uploading. Yes, the game hides the file like it is guarding state secrets.</p>',
      '<div class="sg-guide-grid">',
      '<article><b>1</b><h3>Enable logging</h3><p>Open Neverwinter chat and type <code>/combatlog 1</code>, then press Enter.</p></article>',
      '<article><b>2</b><h3>Play content</h3><p>Run the fight you want to review. Boss practice, trial, dungeon, or training target all work.</p></article>',
      '<article><b>3</b><h3>Stop logging</h3><p>Type <code>/combatlog 0</code> after the run so the log is easier to inspect.</p></article>',
      '<article><b>4</b><h3>Upload file</h3><p>Find <code>Neverwinter\\Live\\logs\\GameClient.log</code>. Common path: <code>C:\\Users\\Public\\Games\\Cryptic Studios\\Neverwinter\\Live\\logs\\GameClient.log</code>.</p></article>',
      '</div>',
      '<div class="sg-log-guide-actions">',
      '<label for="file" class="sg-upload-button">Choose combat log</label>',
      '<button class="sg-guide-done" type="button">Got it</button>',
      '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);
    function close(){
      localStorage.setItem(guideKey, '1');
      modal.remove();
    }
    modal.querySelector('.sg-log-guide-close').onclick = close;
    modal.querySelector('.sg-guide-done').onclick = close;
    modal.querySelector('.sg-upload-button').onclick = function(){ setTimeout(close, 150); };
    if(firstRun) localStorage.setItem(guideKey, '1');
  }

  function wireFileState(){
    var file = document.getElementById('file');
    if(file){
      file.addEventListener('change', function(){
        document.body.classList.add('sg-loading-log');
        setTimeout(applyLayoutState, 800);
        setTimeout(applyLayoutState, 2200);
      });
    }
    var status = document.getElementById('status');
    if(status){
      new MutationObserver(function(){
        document.body.classList.remove('sg-loading-log');
        applyLayoutState();
      }).observe(status, { childList:true, characterData:true, subtree:true });
    }
    var previousRender = window.render;
    if(typeof previousRender === 'function'){
      window.render = function(){
        previousRender();
        applyLayoutState();
      };
    }
  }

  SG.ready(function(){
    uploadStage();
    wireFileState();
    applyLayoutState();
    if(!localStorage.getItem(guideKey) && !hasRows()){
      setTimeout(function(){ openGuide(true); }, 600);
    }
  });
})();
