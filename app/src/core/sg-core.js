(function(){
  var SG = window.SG || {};
  SG.escape = function(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };
  SG.normalize = function(value){
    return String(value || '').toLowerCase().replace(/[’']/g,'').replace(/&/g,' and ').replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  };
  SG.slug = function(value){ return SG.normalize(value).replace(/\s+/g,'-'); };
  SG.ready = function(callback){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, {once:true});
    else callback();
  };
  SG.injectStyle = function(id, css){
    var style = document.getElementById(id);
    if(!style){ style = document.createElement('style'); style.id = id; document.head.appendChild(style); }
    style.textContent = css;
    return style;
  };
  window.SG = SG;
})();
