// Runtime alias for the Arti Call feature. Kept separate so index can use a clear, boring filename.
(function(){
  var script = document.createElement('script');
  script.src = 'src/features/arti-call-layer.js';
  script.defer = false;
  document.currentScript && document.currentScript.parentNode ? document.currentScript.parentNode.insertBefore(script, document.currentScript.nextSibling) : document.head.appendChild(script);
})();
