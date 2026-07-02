(function(){
  var SG = window.SG || {};
  SG.tooltip = function(){
    var tip = document.getElementById('sg-tooltip');
    if(!tip){
      tip = document.createElement('div');
      tip.id = 'sg-tooltip';
      tip.setAttribute('role','tooltip');
      document.body.appendChild(tip);
    }
    return tip;
  };
  SG.showTooltip = function(event, title, body){
    var tip = SG.tooltip();
    tip.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = String(title || 'Help');
    var span = document.createElement('span');
    span.textContent = String(body || 'Click for details.');
    tip.appendChild(strong);
    tip.appendChild(span);
    tip.style.left = Math.min(event.clientX + 14, window.innerWidth - 360) + 'px';
    tip.style.top = Math.min(event.clientY + 14, window.innerHeight - 150) + 'px';
    tip.classList.add('is-visible');
  };
  SG.hideTooltip = function(){
    var tip = document.getElementById('sg-tooltip');
    if(tip) tip.classList.remove('is-visible');
  };
  SG.openDrawer = function(id, label, html){
    var drawer = document.getElementById(id);
    if(!drawer){
      drawer = document.createElement('aside');
      drawer.id = id;
      drawer.className = 'sg-drawer';
      var close = document.createElement('button');
      close.className = 'sg-drawer-close';
      close.type = 'button';
      close.textContent = 'Close';
      var body = document.createElement('div');
      body.className = 'sg-drawer-body';
      drawer.appendChild(close);
      drawer.appendChild(body);
      document.body.appendChild(drawer);
      close.onclick = function(){ drawer.classList.remove('is-open'); };
    }
    drawer.setAttribute('aria-label', label || 'Details');
    drawer.querySelector('.sg-drawer-body').innerHTML = html;
    drawer.classList.add('is-open');
    return drawer;
  };
  window.SG = SG;
})();
