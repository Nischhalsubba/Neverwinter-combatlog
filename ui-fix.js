(function(){
  function compact(v,d=1){
    v=Number(v)||0;
    const a=Math.abs(v);
    if(a>=1e12)return (v/1e12).toFixed(d)+'T';
    if(a>=1e9)return (v/1e9).toFixed(d)+'B';
    if(a>=1e6)return (v/1e6).toFixed(d)+'M';
    if(a>=1e3)return (v/1e3).toFixed(d)+'K';
    return Math.round(v).toLocaleString();
  }
  function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  window.formatCompact=compact;
  if(typeof cell==='function'){
    const oldCell=cell;
    cell=function(v,k){
      if(v==null)return '-';
      if(['damage','total','avg','max','done','received','taken','shielded','absorbed','nonca','missed','potential','actual','base','dps','combat','combatDps'].includes(k))return compact(v);
      if(['share','crit','critRate','flank','caRate','eff','uptime','effect'].includes(k))return (Number(v)||0).toFixed(1)+'%';
      if(['hits','ticks','caHits','full','breaks','rank'].includes(k))return Math.round(Number(v)||0).toLocaleString();
      return oldCell(v,k);
    };
  }
  if(typeof table==='function'){
    const oldTable=table;
    table=function(rows,cols){
      return '<div class="table"><table><thead><tr>'+cols.map(c=>'<th>'+safe(c[1])+'</th>').join('')+'</tr></thead><tbody>'+
      (rows.map(r=>'<tr>'+cols.map(c=>'<td data-label="'+safe(c[1])+'">'+cell(r[c[0]],c[0])+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="'+cols.length+'" class="empty">No rows</td></tr>')+
      '</tbody></table></div>';
    };
  }
  window.addEventListener('DOMContentLoaded',()=>{
    document.body.classList.add('nwhub-redesign');
    const header=document.querySelector('header');
    if(header&&!header.querySelector('.brandMark')){
      header.insertAdjacentHTML('afterbegin','<div class="brandMark"><span></span><span></span><span></span></div>');
    }
  });
})();
