(function(){
  const css = `
    html, body, body *, body *::before, body *::after {
      border-radius: 0 !important;
      -webkit-border-radius: 0 !important;
      -moz-border-radius: 0 !important;
    }
    button, input, select, textarea, summary, meter, progress,
    input::file-selector-button, input::-webkit-file-upload-button {
      border-radius: 0 !important;
      -webkit-border-radius: 0 !important;
      -moz-border-radius: 0 !important;
      appearance: none;
      -webkit-appearance: none;
    }
    .chip, .chips .chip, .encounterChips .chip, .badge, .classPill,
    .sg-pill, .sg-kicker, .infoDot, .assetIcon, .nwIcon,
    .toolbar, .encounterGuide, .partyPanel, .panel, .playerHead,
    .tabs, .tabs button, .card, .table, .compareCard, .logHelp,
    .logSteps article, .sgLegend, .bar, .bar i, .miniBar, .miniBar i,
    .actTrack, .tick, .chart, .timelineBox, .formula, .raw, .deathCard {
      border-radius: 0 !important;
      -webkit-border-radius: 0 !important;
      -moz-border-radius: 0 !important;
    }
  `;
  function inject(){
    let style=document.getElementById('strikeglass-no-radius-final');
    if(!style){
      style=document.createElement('style');
      style.id='strikeglass-no-radius-final';
      document.head.appendChild(style);
    }
    style.textContent=css;
  }
  function flatten(root=document){
    root.querySelectorAll('*').forEach(el=>{
      el.style.borderRadius='0px';
      el.style.webkitBorderRadius='0px';
    });
  }
  function run(){inject();flatten();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  new MutationObserver(mutations=>{
    inject();
    for(const m of mutations){
      for(const n of m.addedNodes){
        if(n.nodeType===1){
          n.style.borderRadius='0px';
          n.style.webkitBorderRadius='0px';
          flatten(n);
        }
      }
    }
  }).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(run,250);
  setTimeout(run,1000);
})();
