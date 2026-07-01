(function(){
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const safeHtml=s=>String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
  function compact(v,d=1){v=Number(v)||0;const a=Math.abs(v);if(a>=1e12)return(v/1e12).toFixed(d)+'T';if(a>=1e9)return(v/1e9).toFixed(d)+'B';if(a>=1e6)return(v/1e6).toFixed(d)+'M';if(a>=1e3)return(v/1e3).toFixed(d)+'K';return Math.round(v).toLocaleString()}
  function progressText(p){const mb=p.total?(' / '+(p.total/1048576).toFixed(1)+' MB'):'';const read=p.bytes?((p.bytes/1048576).toFixed(1)+' MB'+mb):'';return `${p.phase||'parsing'} · ${p.rows.toLocaleString()} rows · ${p.lines.toLocaleString()} lines ${read}`}
  if(typeof cell==='function'){
    const oldCell=cell;
    cell=function(v,k){
      if(v==null)return'-';
      if(['damage','total','avg','max','done','received','taken','shielded','absorbed','nonca','missed','potential','actual','base','dps','combat','combatDps'].includes(k))return compact(v);
      if(['share','crit','critRate','flank','caRate','eff','uptime','effect'].includes(k))return (Number(v)||0).toFixed(1)+'%';
      if(['hits','ticks','caHits','full','breaks','rank'].includes(k))return Math.round(Number(v)||0).toLocaleString();
      return oldCell(v,k);
    };
  }
  async function safeLoad(file){
    const status=document.querySelector('#status');
    const content=document.querySelector('#content');
    try{
      if(!file)return;
      status.textContent='Opening '+file.name+'...';
      content.innerHTML='<section class="panel"><h2>Parsing combat log</h2><p class="mut">Large files are streamed in chunks, indexed, then rendered. No more stack-overflow circus, in theory.</p></section>';
      await wait(20);
      state.rows=NWParser.parseFile?await NWParser.parseFile(file,{onProgress:p=>{status.textContent=progressText(p)}}):NWParser.parseLog(await file.text());
      if(!state.rows.length)throw new Error('No valid combat rows found. Please upload a Neverwinter combat log file.');
      state.players=NWParser.detectPlayers(state.rows);
      if(!state.players.length)throw new Error('Rows parsed, but no player-owned combat data was found.');
      state.playerId=state.players[0].id;
      state.encounterId='all';
      state.rawPower=null;
      state.showHidden=false;
      state.filter='all';
      rebuildEncounters();
      const skipped=state.rows.meta&&state.rows.meta.skipped?(' · skipped '+state.rows.meta.skipped.toLocaleString()+' malformed lines'):'';
      status.textContent='Parsed '+state.rows.length.toLocaleString()+' rows from '+(state.rows.meta.lines||0).toLocaleString()+' lines'+skipped+'.';
      await wait(20);
      render();
    }catch(err){
      console.error(err);
      status.textContent='Could not parse log: '+err.message;
      content.innerHTML='<section class="panel"><h2>Could not parse this file</h2><p class="mut">'+safeHtml(err.message)+'</p><p class="mut">The parser streams files and reports malformed lines instead of getting stuck at Reading.</p></section>';
    }
  }
  window.safeLoadCombatLog=safeLoad;
  window.addEventListener('DOMContentLoaded',()=>{document.body.classList.add('nwhub-redesign');const file=document.querySelector('#file');if(file)file.onchange=e=>safeLoad(e.target.files&&e.target.files[0])});
  window.addEventListener('error',event=>{const status=document.querySelector('#status');const content=document.querySelector('#content');if(status)status.textContent='Parser error: '+event.message;if(content)content.innerHTML='<section class="panel"><h2>Parser error</h2><p class="mut">'+safeHtml(event.message)+'</p></section>'});
})();
