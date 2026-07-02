(function(){
  const css = `
    html, body, body *, body *::before, body *::after,
    button, input, select, textarea, summary, meter, progress,
    input::file-selector-button, input::-webkit-file-upload-button,
    .chip, .chips .chip, .encounterChips .chip, .badge, .classPill,
    .sg-pill, .sg-kicker, .infoDot, .assetIcon, .nwIcon,
    .toolbar, .encounterGuide, .partyPanel, .panel, .playerHead,
    .tabs, .tabs button, .card, .table, .compareCard, .logHelp,
    .logSteps article, .sgLegend, .bar, .bar i, .miniBar, .miniBar i,
    .actTrack, .tick, .chart, .timelineBox, .formula, .raw, .deathCard {
      border-radius: 0 !important;
      -webkit-border-radius: 0 !important;
      -moz-border-radius: 0 !important;
    }
  `;
  const style = document.createElement('style');
  style.id = 'strikeglass-no-radius-final';
  style.textContent = css;
  document.head.appendChild(style);
})();
