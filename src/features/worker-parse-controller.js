(function(){
  function txt(p){return (p.phase||'parsing')+' in worker · '+Number(p.rows||0).toLocaleString()+' rows · '+Number(p.lines||0).toLocaleString()+' lines';}
  function esc(s){return String(s||'').replace(/[&<>]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[m];});}
  function parseWorker(file,onProgress){
    return new Promise(function(resolve,reject){
      if(!window.Worker)return reject(new Error('Worker not supported'));
      var worker=new Worker('src/workers/parse-worker.js');
      worker.onmessage=function(event){
        var msg=event.data||{};
        if(msg.type==='progress'&&onProgress)onProgress(msg.progress||{});
        if(msg.type==='done'){
          worker.terminate();
          var rows=msg.rows||[];
          rows.meta=msg.meta||{};
          resolve(rows);
        }
        if(msg.type==='error'){
          worker.terminate();
          reject(new Error(msg.message||'Worker parse failed'));
        }
      };
      worker.onerror=function(event){worker.terminate();reject(new Error(event.message||'Worker parse failed'));};
      worker.postMessage({type:'parse',file:file});
    });
  }
  async function parseSmart(file,onProgress){
    if(file&&file.size>2097152&&window.Worker){
      try{return await parseWorker(file,onProgress);}catch(e){console.warn('worker parse fallback',e);}
    }
    return await NWParser.parseFile(file,{onProgress:onProgress});
  }
  async function load(file){
    var status=document.querySelector('#status');
    var content=document.querySelector('#content');
    try{
      if(!file)return;
      status.textContent='Opening '+file.name+'...';
      content.innerHTML='<section class="panel"><h2>Parsing combat log</h2><p class="mut">Large files use a worker when the browser supports it.</p></section>';
      state.rows=await parseSmart(file,function(p){status.textContent=txt(p);});
      if(!state.rows.length)throw new Error('No valid combat rows found.');
      state.players=NWParser.detectPlayers(state.rows);
      if(!state.players.length)throw new Error('Rows parsed, but no player-owned combat data was found.');
      state.playerId=state.players[0].id;
      state.encounterId='all';
      state.rawPower=null;
      state.showHidden=false;
      state.filter='all';
      rebuildEncounters();
      var skipped=state.rows.meta&&state.rows.meta.skipped?' · skipped '+state.rows.meta.skipped.toLocaleString()+' noisy lines':'';
      var lines=state.rows.meta&&state.rows.meta.lines?state.rows.meta.lines:state.rows.length;
      status.textContent='Parsed '+state.rows.length.toLocaleString()+' rows from '+lines.toLocaleString()+' lines'+skipped+'.';
      render();
    }catch(e){
      console.error(e);
      status.textContent='Parser error';
      content.innerHTML='<section class="panel"><h2>Parser error</h2><p class="mut">'+esc(e.message||e)+'</p></section>';
    }
  }
  function install(){var input=document.getElementById('file');if(input){input.onchange=function(){load(input.files&&input.files[0]);};window.StrikeglassParseFile=load;}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
