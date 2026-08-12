(function(){
  const titleMap = new Map([
    ['Snapshot','Player summary'],
    ['Rotation','Skill timing'],
    ['Power Damage','Skill damage'],
    ['Healing','Healing'],
    ['Survival','Damage received'],
    ['Shielding','Shielding'],
    ['Timing','Use timing'],
    ['Positioning','Combat advantage'],
    ['Deaths','Deaths'],
    ['Other','Extra checks'],
    ['How numbers work','How numbers are counted'],
    ['Compare Players','Compare players'],
    ['Companions','Companion damage'],
    ['Icon Mapper','Image checks'],
    ['Asset Codex','Image checks']
  ]);
  const headerMap = new Map([
    ['DPS','Overall DPS'],
    ['COMBAT DPS','Fighting DPS'],
    ['DURATION','Time in fight'],
    ['HITS','Hit count'],
    ['CRIT%','Crit rate'],
    ['CRIT RATE','Crit rate'],
    ['FLANK RATE','Combat adv. rate'],
    ['AVG','Avg hit'],
    ['MAX','Highest hit'],
    ['POWER','Skill / source'],
    ['CATEGORY','Source type'],
    ['DAMAGE','Damage'],
    ['TOTAL DAMAGE','Total damage'],
    ['DAMAGE / SEC','Damage per second'],
    ['PLAYER / COMPANION','Player or companion'],
    ['ARTIFACT USED','Artifact used'],
    ['AVG DAMAGE','Avg hit'],
    ['HIGHEST HIT','Highest hit'],
    ['FIRST USE','First seen'],
    ['LAST USE','Last seen'],
    ['AVG INTERVAL','Average gap'],
    ['ACTIVATIONS','Times seen']
  ]);
  const phraseMap = new Map([
    ['Fast preview ready','Party overview ready'],
    ['Building a fast report first','Loading party overview first'],
    ['Power Damage -','Skill damage -'],
    ['Loaded on demand for the selected player and fight.','This view loads only after you click it. It uses the selected player and fight.'],
    ['Loaded after click from the worker. The page receives only this player and fight summary, not the whole log.','Loaded after you clicked. Only this player and fight are calculated here.'],
    ['The full raw log remains inside the worker.','The full log stays in the background so the page stays responsive.'],
    ['Rows in scope','Rows used here'],
    ['Valid player rows','Rows counted for this player'],
    ['Fight windows','Fight sections'],
    ['Companion damage','Companion damage'],
    ['Included','Included'],
    ['summary-first','overview-first']
  ]);
  function cleanText(text){
    const trimmed = String(text || '').trim();
    if(titleMap.has(trimmed)) return titleMap.get(trimmed);
    const upper = trimmed.toUpperCase();
    if(headerMap.has(upper)) return headerMap.get(upper);
    for(const [from,to] of phraseMap){
      if(trimmed.includes(from)) return trimmed.replace(from,to);
    }
    return null;
  }
  function updateTextNode(el){
    if(!el || el.dataset.sgCopyDone === '1') return;
    const next = cleanText(el.textContent);
    if(next && next !== el.textContent.trim()){
      el.textContent = next;
      el.dataset.sgCopyDone = '1';
    }
  }
  function simplify(root){
    root = root || document;
    root.querySelectorAll('#tabs button, th, .card span, h2, h3, label, summary').forEach(updateTextNode);
    root.querySelectorAll('.mut,p,small,span').forEach(function(el){
      if(el.children.length) return;
      const next = cleanText(el.textContent);
      if(next && next !== el.textContent.trim()) el.textContent = next;
    });
    root.querySelectorAll('table').forEach(function(table){
      table.classList.add('sg-aligned-table');
      table.querySelectorAll('td,th').forEach(function(cell){
        const text = cell.textContent.trim();
        if(/^[-+]?\d/.test(text) || /%$/.test(text) || /[KMGBT]$/.test(text)) cell.classList.add('sg-number-cell');
      });
    });
    root.querySelectorAll('.classPill').forEach(function(el){
      const txt = el.textContent || '';
      if(/unknown/i.test(txt)) el.setAttribute('title','Class is not certain yet. Use Class Correction if you know the right class.');
    });
  }
  function ready(fn){ if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function(){
    simplify(document);
    const mo = new MutationObserver(function(list){
      for(const item of list){
        item.addedNodes.forEach(function(node){
          if(node.nodeType === 1) simplify(node);
        });
      }
    });
    mo.observe(document.body,{ childList:true, subtree:true });
  });
})();
