(function(){
  const nextLabel = 'Icon Mapper';
  const priorLabel = ['Asset','Codex'].join(' ');
  function run(){
    const tab = document.querySelector('[data-tab="assets"]');
    if(tab) tab.textContent = nextLabel;
    document.querySelectorAll('body *').forEach(el => {
      if(el.children.length) return;
      if(el.textContent && el.textContent.includes(priorLabel)){
        el.textContent = el.textContent.split(priorLabel).join(nextLabel);
      }
    });
  }
  const oldRender = window.render;
  if(typeof oldRender === 'function'){
    window.render = function(){
      oldRender.apply(this, arguments);
      setTimeout(run, 0);
    };
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  new MutationObserver(run).observe(document.documentElement, { childList:true, subtree:true });
})();
