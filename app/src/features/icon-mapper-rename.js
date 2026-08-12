(function(){
  const nextLabel = 'Icon Mapper';
  const priorLabel = ['Asset','Codex'].join(' ');
  let scheduled = false;

  function replaceText(root){
    if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!node.nodeValue || !node.nodeValue.includes(priorLabel)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if(parent && parent.closest('script,style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const updated = node.nodeValue.split(priorLabel).join(nextLabel);
      if(updated !== node.nodeValue) node.nodeValue = updated;
    });
  }

  function run(){
    scheduled = false;
    const tab = document.querySelector('[data-tab="assets"]');
    if(tab && tab.textContent.trim() !== nextLabel) tab.textContent = nextLabel;
    replaceText(document.body);
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  const oldRender = window.render;
  if(typeof oldRender === 'function'){
    window.render = function(){
      oldRender.apply(this, arguments);
      schedule();
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();

  const observer = new MutationObserver(function(records){
    for(const record of records){
      for(const node of record.addedNodes){
        if(node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE){
          schedule();
          return;
        }
      }
    }
  });
  observer.observe(document.body || document.documentElement, { childList:true, subtree:true });
})();
