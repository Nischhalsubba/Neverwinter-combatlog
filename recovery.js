(function(){
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function safeLoad(file){
    const status=document.querySelector('#status');
    const content=document.querySelector('#content');
    try{
      if(!file)return;
      status.textContent='Reading '+file.name+'...';
      await wait(30);
      const text=await file.text();
      status.textContent='Parsing '+file.name+'...';
      await wait(30);
      state.rows=NWParser.parseLog(text);
      if(!state.rows.length)throw new Error('No valid combat rows found. Please upload a Neverwinter combat log file.');
      state.players=NWParser.detectPlayers(state.rows);
      if(!state.players.length)throw new Error('Rows parsed, but no player-owned combat data was found.');
      state.playerId=state.players[0].id;
      state.encounterId='all';
      state.rawPower=null;
      state.showHidden=false;
      rebuildEncounters();
      const skipped=state.rows.meta&&state.rows.meta.skipped?(' · skipped '+state.rows.meta.skipped.toLocaleString()+' malformed lines'):'';
      status.textContent='Parsed '+state.rows.length.toLocaleString()+' rows'+skipped+'.';
      render();
    }catch(err){
      console.error(err);
      status.textContent='Could not parse log: '+err.message;
      content.innerHTML='<section class="panel"><h2>Could not parse this file</h2><p class="mut">'+String(err.message).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</p><p class="mut">The parser now fails visibly instead of getting stuck at Reading, because apparently that was too generous to debugging.</p></section>';
    }
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const file=document.querySelector('#file');
    if(file)file.onchange=e=>safeLoad(e.target.files&&e.target.files[0]);
  });
  window.addEventListener('error',event=>{
    const status=document.querySelector('#status');
    if(status)status.textContent='Parser error: '+event.message;
  });
})();
