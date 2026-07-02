(function(){
  const css = `
  body.sg-v3{
    --radius-xl:26px;
    --radius-lg:20px;
    --radius-md:14px;
    --radius-sm:10px;
    --surface:#fffdf8;
    --surface-2:#f6f1e8;
    --surface-3:#eef3f7;
    --ink:#13202b;
    --muted:#667789;
    --line:#d9d0c4;
    --line-2:#d8e2ec;
    --brand:#1fa987;
    --brand-dark:#0e1b27;
    --blue:#3e6fd9;
    --amber:#d99028;
    --danger:#d94c5d;
    --shadow-soft:0 18px 54px rgba(22,32,42,.11);
    --shadow-card:0 10px 30px rgba(22,32,42,.07);
  }
  body.sg-v3 main{gap:20px!important;}
  body.sg-v3 .toolbar,
  body.sg-v3 .encounterGuide,
  body.sg-v3 .partyPanel,
  body.sg-v3 .panel,
  body.sg-v3 #content>.playerHead,
  body.sg-v3 .playerHead+section.panel{
    border-radius:var(--radius-xl)!important;
    border:1px solid var(--line)!important;
    background:var(--surface)!important;
    box-shadow:var(--shadow-soft)!important;
  }
  body.sg-v3 .toolbar{
    display:grid!important;
    grid-template-columns:minmax(260px,1fr) auto auto;
    gap:14px 18px!important;
    align-items:center!important;
    padding:20px 22px!important;
  }
  body.sg-v3 .toolbar:before{
    grid-column:1/-1;
    content:'Log session';
    color:var(--brand)!important;
    font-size:11px!important;
    font-weight:900!important;
    letter-spacing:.16em!important;
    text-transform:uppercase!important;
  }
  body.sg-v3 #status{
    display:inline-flex;
    align-items:center;
    width:max-content;
    max-width:100%;
    min-height:38px;
    padding:9px 12px;
    border:1px solid var(--line-2);
    border-radius:var(--radius-md);
    background:var(--surface-3);
    color:var(--ink);
    font-weight:800;
  }
  body.sg-v3 .toolbar label{
    display:inline-flex!important;
    align-items:center!important;
    gap:8px!important;
    min-height:38px;
    color:var(--muted)!important;
    font-weight:900!important;
  }
  body.sg-v3 .toolbar .toggle{
    grid-column:1/-1;
    justify-self:start;
    min-height:34px;
    padding:8px 11px;
    border:1px solid #cde6dd;
    border-radius:var(--radius-md);
    background:#ecfbf5;
    color:#176b52!important;
  }
  body.sg-v3 select,
  body.sg-v3 button,
  body.sg-v3 input{
    border-radius:var(--radius-md)!important;
    border:1px solid #cbd8e5!important;
    background:#f7fafc!important;
    color:var(--ink)!important;
  }
  body.sg-v3 .encounterGuide{
    padding:20px!important;
    overflow:hidden;
  }
  body.sg-v3 .encounterGuide:before{
    content:'';
    display:block;
    height:4px;
    width:74px;
    border-radius:999px;
    background:linear-gradient(90deg,var(--brand),var(--blue));
    margin-bottom:14px;
  }
  body.sg-v3 .encounterCopy{
    display:grid;
    gap:6px;
    margin-bottom:16px!important;
  }
  body.sg-v3 .encounterCopy h2{
    margin:0!important;
    color:var(--ink)!important;
    font-size:24px!important;
    letter-spacing:-.04em;
  }
  body.sg-v3 .encounterCopy p{
    margin:0!important;
    color:var(--muted)!important;
    font-size:14px;
  }
  body.sg-v3 .eyebrow{
    color:var(--brand)!important;
    font-size:11px!important;
    letter-spacing:.16em!important;
    font-weight:900!important;
  }
  body.sg-v3 .encounterChips{
    display:grid!important;
    grid-template-columns:repeat(auto-fit,minmax(190px,max-content));
    gap:10px!important;
    align-items:stretch!important;
  }
  body.sg-v3 .encounterChips .chip,
  body.sg-v3 .chips .chip{
    min-height:56px!important;
    border-radius:var(--radius-lg)!important;
    padding:11px 14px!important;
    background:#fff!important;
    border:1px solid var(--line-2)!important;
    color:var(--ink)!important;
    box-shadow:var(--shadow-card)!important;
    text-align:left!important;
    transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease;
  }
  body.sg-v3 .encounterChips .chip:hover,
  body.sg-v3 .chips .chip:hover{
    transform:translateY(-1px);
    border-color:#9dc8ba!important;
    box-shadow:0 16px 34px rgba(22,32,42,.11)!important;
  }
  body.sg-v3 .encounterChips .chip.active,
  body.sg-v3 .chips .chip.active{
    background:var(--brand-dark)!important;
    border-color:var(--brand-dark)!important;
    color:white!important;
    box-shadow:0 14px 32px rgba(14,27,39,.24)!important;
  }
  body.sg-v3 .encounterChips .chip.boss{
    border-left:4px solid var(--amber)!important;
  }
  body.sg-v3 .encounterChips .chip.mob{
    border-left:4px solid var(--blue)!important;
  }
  body.sg-v3 .encounterChips .chipType{
    color:#8a6a2b!important;
    font-size:10px!important;
    letter-spacing:.14em!important;
    font-weight:900!important;
  }
  body.sg-v3 .encounterChips .chip.active .chipType,
  body.sg-v3 .encounterChips .chip.active small{
    color:#9fead8!important;
  }
  body.sg-v3 .encounterChips .chip b{
    font-size:13px!important;
    line-height:1.25!important;
  }
  body.sg-v3 .encounterChips .chip small{
    color:var(--muted)!important;
    font-size:12px!important;
    font-weight:800!important;
  }
  body.sg-v3 .encounterChips .disclosure{
    border-left:4px solid #c5cdd7!important;
    border-style:solid!important;
    background:#f8fafc!important;
    color:var(--ink)!important;
  }
  body.sg-v3 .encounterChips .disclosure span{
    display:none!important;
  }
  body.sg-v3 .tabs,
  body.sg-v3 .tabs button,
  body.sg-v3 .card,
  body.sg-v3 .table,
  body.sg-v3 .badge,
  body.sg-v3 .classPill,
  body.sg-v3 .sgLegend,
  body.sg-v3 .logHelp,
  body.sg-v3 .logSteps article,
  body.sg-v3 .compareCard{
    border-radius:var(--radius-lg)!important;
  }
  body.sg-v3 .tabs{border-radius:var(--radius-xl)!important;}
  body.sg-v3 .badge,
  body.sg-v3 .classPill,
  body.sg-v3 .sg-pill,
  body.sg-v3 .sg-kicker{border-radius:999px!important;}
  body.sg-v3 .card,
  body.sg-v3 .compareCard,
  body.sg-v3 .logSteps article,
  body.sg-v3 .coachBlock,
  body.sg-v3 .bars{
    background:#f8fafc!important;
    border:1px solid var(--line-2)!important;
  }
  body.sg-v3 .assetIcon,
  body.sg-v3 .nwIcon{
    border-radius:var(--radius-sm)!important;
    border-color:#c8d6e4!important;
  }
  body.sg-v3 table th{
    background:#f1f5f9!important;
    color:#5d6d7c!important;
  }
  body.sg-v3 .partyRow.selected td{
    background:#e9fbf3!important;
  }
  @media(max-width:920px){
    body.sg-v3 .toolbar{grid-template-columns:1fr!important;}
    body.sg-v3 #status{width:100%;}
    body.sg-v3 .encounterChips{grid-template-columns:1fr!important;}
  }
  `;
  const style=document.createElement('style');
  style.id='strikeglass-design-system-layer';
  style.textContent=css;
  document.head.appendChild(style);
})();
