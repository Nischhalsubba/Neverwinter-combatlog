(function(){
  function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn()}
  ready(function(){
    document.body.classList.add('sg-v3');
    const header=document.querySelector('header');
    if(header&&!header.querySelector('.sg-kicker')){
      const wrap=header.querySelector('div');
      if(wrap){
        wrap.insertAdjacentHTML('afterbegin','<span class="sg-kicker">Local combat review</span>');
        wrap.insertAdjacentHTML('beforeend','<div class="sg-hero-actions"><span class="sg-pill">Private in browser</span><span class="sg-pill">Encounter scoped</span><span class="sg-pill">Player friendly</span></div>');
      }
    }
    const tabs=document.querySelector('#tabs');
    if(tabs)tabs.setAttribute('aria-label','Strikeglass analysis modes');
    const file=document.querySelector('#file');
    if(file)file.setAttribute('aria-label','Upload Neverwinter combat log');
  });
})();
