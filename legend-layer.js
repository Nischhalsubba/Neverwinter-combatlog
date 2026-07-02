(function(){
  function legend(){
    return '<aside class="sgLegend" aria-label="Combat color legend"><div><strong>Color index</strong><small>What the marks mean</small></div><span><i class="swatch normal"></i>Normal hit / activation</span><span><i class="swatch crit"></i>Critical hit</span><span><i class="swatch ca"></i>Combat advantage flag</span><span><i class="swatch deflect"></i>Deflect / mitigated flag</span><span><i class="swatch kill"></i>Killing blow / death flag</span><span><i class="swatch barBlue"></i>Damage over time / power share</span><span><i class="swatch barOrange"></i>Damage category share</span><span><i class="swatch unknown"></i>Icon missing or not mapped</span></aside>';
  }
  function applyLegend(){
    const content=document.querySelector('#content');
    if(!content)return;
    const hasRotation=/Rotation timeline|Power activations|Power Usage Frequency/.test(content.textContent||'');
    if(hasRotation&&!content.querySelector('.sgLegend')){
      const target=content.querySelector('.filterbar')||content.querySelector('.timelineBox')||content.firstElementChild;
      if(target)target.insertAdjacentHTML(target.classList&&target.classList.contains('filterbar')?'afterend':'afterend',legend());
    }
    const raw=content.querySelector('#raw');
    if(raw&&!raw.querySelector('.sgLegend'))raw.insertAdjacentHTML('afterbegin',legend());
  }
  const css='.sgLegend{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 14px;padding:12px 14px;border:1px solid #d6e0ea;border-radius:18px;background:#f8fafc;color:#263645}.sgLegend div{display:grid;margin-right:4px}.sgLegend strong{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#102033}.sgLegend small{color:#637282}.sgLegend span{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#435466}.swatch{width:16px;height:16px;border-radius:5px;display:inline-block;border:1px solid rgba(16,32,51,.16)}.swatch.normal{background:#2563eb}.swatch.crit{background:#e56652}.swatch.ca{background:#6b4ec3}.swatch.deflect{background:#2babc4}.swatch.kill{background:#d94b5a}.swatch.barBlue{background:linear-gradient(90deg,#3e6fd9,#1fb99a)}.swatch.barOrange{background:linear-gradient(90deg,#f2a057,#e56652)}.swatch.unknown{background:#0f1722}@media(max-width:900px){.sgLegend{align-items:flex-start}.sgLegend div{width:100%}}';
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  const mo=new MutationObserver(applyLegend);
  function start(){const c=document.querySelector('#content');if(c)mo.observe(c,{childList:true,subtree:true});applyLegend()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
