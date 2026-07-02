(function(){
  if(!window.NWClassPowerMap||!window.NWMeta)return;
  const storeKey='strikeglass.classOverrides.v1';
  const norm=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/&/g,' and ').replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  const generic=new Set(['forte','block','roll','shift','sprint','perform','free perform','class mechanic','lore','arcana','nature','religion','dungeoneering','thievery','stamina','slash','thrust','crescendo','cure wounds','smite']);
  const ignoredCategories=new Set(['Mount','Item / Enchant','Pet / Companion','Other / Unknown']);
  const powerToClasses=new Map();
  const classColors={};
  for(const [cls,list] of Object.entries(NWClassPowerMap)){
    classColors[cls]=(NWMeta.CLASS_DEFS&&NWMeta.CLASS_DEFS[cls]&&NWMeta.CLASS_DEFS[cls].color)||'#8b95aa';
    for(const name of list||[]){
      const key=norm(name);
      if(!key||generic.has(key))continue;
      if(!powerToClasses.has(key))powerToClasses.set(key,new Set());
      powerToClasses.get(key).add(cls);
    }
  }
  const uniqueKeys=[...powerToClasses.entries()].filter(([,set])=>set.size===1).map(([k,set])=>[k,[...set][0]]);
  function overrides(){try{return JSON.parse(localStorage.getItem(storeKey)||'{}')}catch(_){return{}}}
  function weightRow(r){const a=Math.abs(Number(r.amount)||0);let w=1+Math.log10(a+10);if(r.damageType==='HitPoints'||r.damageType==='Shield')w+=.8;if(r.flags&&r.flags.has&&r.flags.has('ShowPowerDisplayName'))w*=.4;return Math.max(.8,w)}
  function classEvidence(pid,rows){
    const score={},hits={},examples={};
    const usedRows=[];
    for(const r of rows||[]){
      if(r.ownerId!==pid)continue;
      const raw=r.powerName||'';
      const key=norm(raw);
      if(!key||generic.has(key))continue;
      const cat=window.NWParser&&NWParser.category?NWParser.category(raw):'';
      const exact=powerToClasses.get(key);
      let matched=[];
      if(exact){
        matched=[...exact];
      }else if(!ignoredCategories.has(cat)){
        for(const [known,cls] of uniqueKeys){
          if(known.length<5)continue;
          if(key===known||key.includes(known)||known.includes(key)){matched=[cls];break}
        }
      }
      if(!matched.length)continue;
      const w=weightRow(r)/(matched.length>1?3:1);
      for(const cls of matched){score[cls]=(score[cls]||0)+w;hits[cls]=(hits[cls]||0)+1;(examples[cls]||(examples[cls]=new Set())).add(raw)}
      usedRows.push(r.lineNo);
    }
    return{score,hits,examples,usedRows};
  }
  function infer(pid,scope){
    const manual=overrides()[pid];
    if(manual)return{name:manual,confidence:100,manual:true,icon:'?',color:classColors[manual]||'#8b95aa',method:'manual'};
    const rows=(scope&&scope.length?scope:(window.state&&state.rows)||[]);
    const ev=classEvidence(pid,rows);
    const ranked=Object.entries(ev.score).sort((a,b)=>b[1]-a[1]);
    if(!ranked.length)return{name:'Unknown',confidence:0,lowConfidence:true,icon:'?',color:'#8b95aa',method:'no class powers found',evidenceRows:0};
    const [best,bestScore]=ranked[0];
    const second=ranked[1]?ranked[1][1]:0;
    const bestHits=ev.hits[best]||0;
    const gap=bestScore-second;
    const confident=bestHits>=1&&(bestScore>=2.2)&&(gap>=1.2||bestScore>=second*1.7||bestHits>=3);
    const confidence=confident?Math.min(99,Math.max(51,Math.round(100*(bestScore/(bestScore+second+1))))):Math.min(49,Math.round(100*(bestScore/(bestScore+second+1))));
    if(!confident)return{name:'Unknown',confidence,lowConfidence:true,probable:best,icon:'?',color:'#8b95aa',method:'ambiguous evidence',evidenceRows:bestHits,examples:[...(ev.examples[best]||[])].slice(0,5)};
    return{name:best,confidence,icon:'?',color:classColors[best]||'#8b95aa',method:'full log class powers',evidenceRows:bestHits,examples:[...(ev.examples[best]||[])].slice(0,5)};
  }
  NWMeta.inferClassForPlayer=function(pid,scope){return infer(pid,scope)};
  if(typeof inferClass==='function')window.inferClass=function(pid){return infer(pid,(window.state&&state.rows)||[]).name};
  const style=document.createElement('style');style.textContent='.classPill small[title],.classPill small{white-space:nowrap}.classPill.lowConfidence{border-color:#d99028!important;background:#fff7e8!important;color:#7a4c11!important}';document.head.appendChild(style);
})();
