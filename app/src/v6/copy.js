const viewRoot = document.getElementById('view-root');
const workspaceTitle = document.getElementById('workspace-title');
const topbarStatus = document.getElementById('topbar-status');
const parseState = document.getElementById('parse-state');
const nav = document.getElementById('app-nav');

const TITLE_COPY = new Map([
  ['Session overview', 'Session summary'],
  ['Party rotation', 'Power timing'],
  ['Player comparison', 'Compare players'],
  ['Boss analysis', 'Boss fight'],
  ['Encounters', 'Fights'],
  ['Party performance', 'Player results'],
  ['Damage out', 'Power damage'],
  ['Event explorer', 'Raw events'],
  ['Parser diagnostics', 'Log health']
]);

const SIMPLE_COPY = new Map([
  ['Overview workspace', 'Summary widgets'],
  ['Keep the default layout or personalize the widgets on this device.', 'Show the information you care about. Changes stay on this device.'],
  ['Add widget', 'Manage widgets'],
  ['Widgets', 'Choose what to show'],
  ['Show, hide, and size Overview widgets. Drag on desktop or use the reorder buttons in edit mode.', 'Choose which summary cards are visible and how much space they use.'],
  ['Party Summary', 'Group totals'],
  ['Verified totals for the current scope', 'Main numbers for everyone in the selected fight.'],
  ['Party Overview', 'Player damage'],
  ['Ranking and contribution', 'Who dealt the group damage.'],
  ['Player Overview', 'Selected player'],
  ['Top Damage Powers', 'Top damaging powers'],
  ['Damage Over Time', 'Damage timeline'],
  ['Verified party damage timeline', 'Group damage across the selected time.'],
  ['Encounters', 'Fights'],
  ['Detected combat windows', 'Detected fights in this log.'],

  ['Party damage', 'Group damage'],
  ['Party DPS', 'Group DPS'],
  ['Party Combat DPS', 'Group Active DPS'],
  ['Scope duration', 'Selected time'],
  ['Total Damage', 'Total damage'],
  ['Combat DPS', 'Active DPS'],
  ['Duration', 'Time'],
  ['In-Combat Time', 'Active time'],
  ['Total Hits', 'Hits'],
  ['Crit Rate', 'Critical hit rate'],
  ['Flank Rate', 'Flank / CA rate'],
  ['Max Hit', 'Biggest hit'],
  ['Healing Done', 'Healing'],
  ['Damage Taken', 'Damage taken'],
  ['Shielded', 'Damage blocked'],
  ['Critical', 'Critical hit rate'],

  ['Party overview', 'Group damage'],
  ['Damage contribution', 'Player damage'],
  ['Combat intensity', 'Damage timeline'],
  ['Party damage over time', 'Group damage over time'],
  ['Detected windows', 'Detected fights'],
  ['Comparison set', 'Players'],
  ['Players in identical scope', 'Compare players in the same fight'],
  ['Same clock, same scope', 'Same fight'],
  ['Player damage over time', 'Damage over time by player'],
  ['Exact metrics', 'Detailed numbers'],
  ['Comparison table', 'Player details'],
  ['Exact ranking', 'Player ranking'],
  ['Encounter signal', 'Fight details'],
  ['Combat windows', 'Detected fights'],
  ['Encounter browser', 'Fight list'],
  ['Player performance', 'Player results'],
  ['Damage by category', 'Damage sources'],
  ['Contribution mix', 'Where the damage came from'],
  ['Damage out', 'Power damage'],
  ['Indexed row store', 'Log records'],
  ['Event explorer', 'Raw log events'],
  ['Parser health', 'Log quality'],
  ['Reject reasons', 'Rows we could not read'],
  ['Non-canonical damage types', 'Damage types not counted'],
  ['Unknown event types', 'Events we do not recognize'],
  ['Dual-engine traceability', 'Verification check'],
  ['Verification', 'Verification details'],
  ['Verifier warnings', 'Verification warnings'],
  ['Rejected row samples', 'Examples of skipped rows'],
  ['Party rotation', 'Power timing'],
  ['Activated damage powers on one clock', 'When players used damaging powers'],
  ['Selected player', 'Selected player'],
  ['Top powers', 'Top damaging powers'],

  ['First to last canonical hit', 'From first counted hit to last'],
  ['Verified active combat time', 'Only time spent fighting'],
  ['Scope clock', 'Uses the full selected time'],
  ['Entire encounter window', 'Whole fight'],
  ['Boss target only', 'Boss only'],
  ['Entire boss encounter window', 'All damage during the boss fight'],
  ['Selected boss target only', 'Boss damage only'],
  ['Same scope for every player', 'Same fight and time for everyone'],

  ['Share', 'Group share'],
  ['Combat DPS', 'Active DPS'],
  ['Crit', 'Crit rate'],
  ['Flank / CA', 'Flank / CA rate'],
  ['Companion', 'Companion damage'],
  ['Taken', 'Damage taken'],
  ['Boss / target', 'Boss / main target'],
  ['+Offset', 'Time after first hit'],
  ['Base', 'Base damage'],
  ['Debuff%', 'Change vs base'],
  ['Flags', 'Hit details'],
  ['Avg', 'Average hit'],
  ['Max', 'Biggest hit'],
  ['Crit%', 'Crit rate'],
  ['Flank%', 'Flank / CA rate'],

  ['Accepted', 'Rows read'],
  ['Acceptance', 'Read success'],
  ['Valid damage', 'Damage rows counted'],
  ['Worker store', 'Memory used'],
  ['Primary', 'Main calculation'],
  ['Verifier', 'Second check'],
  ['Source rows · verified session', 'Verified hit records'],
  ['Raw source rows from the verified session', 'Verified log rows from this session'],
  ['Canonical damage: Physical · values remain local', 'Counting Physical damage only · your log stays on this device']
]);

const VIEW_NOTE_DPS = 'DPS uses the time from a player’s first counted hit to their last counted hit. Active DPS uses only active fighting time, so long idle gaps are removed. The two numbers can be the same when the player fights continuously.';
const ROTATION_HELP = 'Each marker shows when a player used a damaging power. Passive effects, companion attacks, and repeated hits from one activation are not counted as separate power uses. Use the buttons to show or hide power types.';
const RAW_HIT_HELP = 'Change vs base shows how much the final hit was above or below its base damage.';

function activeView() {
  return nav?.querySelector('[data-view].is-active')?.dataset.view || '';
}

function replaceElementText(element) {
  if (!element) return;
  const current = element.textContent.trim();
  const simple = SIMPLE_COPY.get(current);
  if (simple && simple !== current) element.textContent = simple;
}

function replaceDirectText(element, transform) {
  if (!element) return;
  for (const node of element.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const raw = node.nodeValue || '';
    const current = raw.trim();
    if (!current) continue;
    const next = transform(current);
    if (!next || next === current) continue;
    const leading = raw.match(/^\s*/)?.[0] || '';
    const trailing = raw.match(/\s*$/)?.[0] || '';
    node.nodeValue = `${leading}${next}${trailing}`;
  }
}

function simplifyMetricNotes() {
  viewRoot?.querySelectorAll('.metric-card small').forEach(note => {
    const current = note.textContent.trim();
    let next = SIMPLE_COPY.get(current) || current;
    next = next.replace(/^(\d[\d,.]*[KMB]?) valid hits$/, '$1 counted hits');
    next = next.replace(/^(\d[\d,.]*[KMB]?) rejected$/, '$1 rows skipped');
    next = next.replace(/^(\d[\d,.]*[KMB]?) lines inspected$/, '$1 log lines checked');
    next = next.replace(/^(\d[\d,.]*[KMB]?) canonical damage$/, '$1 damage counted');
    next = next.replace(/^(\d[\d,.]*[KMB]?) compact rows$/, '$1 stored rows');
    next = next.replace(/^([\d.]+%) party share$/, '$1 of group damage');
    next = next.replace(/^(.*) in combat$/, '$1 active fighting');
    next = next.replace(/^Max (.*)$/, 'Biggest hit $1');
    if (next !== current) note.textContent = next;
  });
}

function simplifyVerification() {
  viewRoot?.querySelectorAll('.verification-badge').forEach(badge => {
    replaceDirectText(badge, current => {
      const fields = current.match(/^Verified · 2 engines · ([\d,.]+) fields$/);
      if (fields) return `Checked twice · ${fields[1]} values match`;
      const activations = current.match(/^Verified · 2 engines · ([\d,.]+) activations$/);
      if (activations) return `Checked twice · ${activations[1]} power uses match`;
      if (current === 'Verified · 2 engines · cross-check') return 'Checked twice';
      return current;
    });
  });

  viewRoot?.querySelectorAll('.verification-strip > span:not(.verification-badge)').forEach(label => {
    const current = label.textContent.trim();
    const simple = SIMPLE_COPY.get(current);
    if (simple) label.textContent = simple;
    else if (/^Checksum\s+/i.test(current)) label.textContent = current.replace(/^Checksum/i, 'Verification ID');
  });
}

function simplifyTableHeaders() {
  viewRoot?.querySelectorAll('th').forEach(header => {
    const current = header.textContent.trim();
    let next = SIMPLE_COPY.get(current) || current;
    const table = header.closest('table');
    if (table?.classList.contains('power-table')) {
      const powerHeaders = new Map([
        ['%', 'Group share'],
        ['Avg', 'Average hit'],
        ['Max', 'Biggest hit'],
        ['Crit%', 'Crit rate'],
        ['Flank%', 'Flank / CA rate']
      ]);
      next = powerHeaders.get(current) || next;
    }
    if (table?.classList.contains('raw-hits-table')) {
      const rawHeaders = new Map([
        ['Type', 'Damage type'],
        ['Base', 'Base damage'],
        ['Debuff%', 'Change vs base'],
        ['Flags', 'Hit details']
      ]);
      next = rawHeaders.get(current) || next;
    }
    if (activeView() === 'encounters' && current === 'Type') next = 'Fight type';
    if (next !== current) header.textContent = next;
  });
}

function simplifyDynamicCopy() {
  if (!viewRoot) return;

  viewRoot.querySelectorAll([
    '.metric-card > span',
    '.panel-head .eyebrow',
    '.panel-head h2',
    '.panel-head > span',
    '.subsection-head h3',
    '.v6-widget-title strong',
    '.v6-widget-title span',
    '.v6-dashboard-toolbar-copy strong',
    '.v6-dashboard-toolbar-copy span',
    '.v6-dashboard-actions .button span',
    '.v6-drawer-head h2',
    '.v6-drawer-head p',
    '.v6-drawer-item-main strong',
    '.v6-drawer-item-main span',
    '.boss-summary span',
    '.verification-details span'
  ].join(',')).forEach(replaceElementText);

  simplifyMetricNotes();
  simplifyVerification();
  simplifyTableHeaders();

  viewRoot.querySelectorAll('.view-note').forEach(note => {
    if (note.textContent.includes('DPS') && note.textContent.includes('Combat DPS')) note.textContent = VIEW_NOTE_DPS;
    else if (note.textContent.includes('Rows are paged from the worker')) note.textContent = 'Raw log rows are loaded in small pages so large logs stay responsive.';
  });

  viewRoot.querySelectorAll('.rotation-help').forEach(help => { help.textContent = ROTATION_HELP; });
  viewRoot.querySelectorAll('.raw-hits-foot > span').forEach(help => { help.textContent = RAW_HIT_HELP; });
  viewRoot.querySelectorAll('.raw-hits-head h3').forEach(title => {
    replaceDirectText(title, current => current.startsWith('Raw hits — ') ? current.replace('Raw hits — ', 'Individual hits — ') : current);
  });

  viewRoot.querySelectorAll('[data-rotation-visible-total]').forEach(label => {
    label.textContent = label.textContent.replace(/visible/g, 'shown').replace(/verified total/g, 'checked total');
  });
  viewRoot.querySelectorAll('[data-rotation-count]').forEach(label => {
    label.textContent = label.textContent.replace(/visible/g, 'shown');
  });
  viewRoot.querySelectorAll('.compare-card small').forEach(label => {
    label.textContent = label.textContent.replace(/of scoped party damage/g, 'of group damage');
  });
}

function ensureDataGuide() {
  if (!viewRoot || activeView() !== 'overview') return;
  const toolbar = viewRoot.querySelector('.v6-dashboard-toolbar');
  if (!toolbar || viewRoot.querySelector('.v6-data-guide')) return;
  toolbar.insertAdjacentHTML('afterend', `
    <details class="v6-data-guide">
      <summary>What do these numbers mean?</summary>
      <div class="v6-data-guide-grid">
        <p><strong>DPS</strong><span>Damage per second from the first counted hit to the last counted hit.</span></p>
        <p><strong>Active DPS</strong><span>Damage per second only while fighting. Idle gaps longer than 5 seconds are ignored, so this can match DPS during continuous combat.</span></p>
        <p><strong>Group share</strong><span>The percent of the group’s total damage dealt by that player.</span></p>
        <p><strong>CA</strong><span>Combat Advantage. The rate includes hits marked as flank or Combat Advantage.</span></p>
      </div>
    </details>`);
}

function simplifyWorkspaceTitle() {
  if (!workspaceTitle) return;
  const current = workspaceTitle.textContent.trim();
  const simple = TITLE_COPY.get(current);
  if (simple) workspaceTitle.textContent = simple;
}

function simplifyStatus() {
  const label = topbarStatus?.querySelector('span:last-child');
  if (!label) return;
  const current = label.textContent.trim();
  let next = current;
  if (current === 'Verified · 2 engines') next = 'Checked twice';
  else if (current === 'Engine 1 parsing') next = 'Reading log';
  else if (current === 'Engine 2 verifying') next = 'Double-checking results';
  else if (/^\d+% parsed$/.test(current)) next = current.replace('parsed', 'read');
  else if (current === 'Verification blocked') next = 'Check failed';
  else if (current === 'Parser error') next = 'Log read error';
  else if (current === 'Worker crashed') next = 'Log reader stopped';
  else if (current === 'Parse cancelled') next = 'Reading cancelled';
  if (next !== current) label.textContent = next;
}

function simplifyParseState() {
  if (!parseState) return;
  const phase = parseState.querySelector('#parse-phase');
  if (phase) {
    const current = phase.textContent.trim();
    const phaseCopy = new Map([
      ['Starting worker...', 'Starting log reader...'],
      ['Indexing encounter windows...', 'Finding fights...'],
      ['Engine 2 independently verifying all metrics...', 'Double-checking all numbers...'],
      ['Publishing verified aggregates...', 'Preparing results...'],
      ['Engine 1 streaming and aggregating...', 'Reading and totaling the log...']
    ]);
    const simple = phaseCopy.get(current);
    if (simple) phase.textContent = simple;
  }
}

let scheduled = false;
function applyCopy() {
  scheduled = false;
  simplifyWorkspaceTitle();
  simplifyStatus();
  simplifyParseState();
  simplifyDynamicCopy();
  ensureDataGuide();
}

function scheduleCopy() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(applyCopy);
}

if (viewRoot) new MutationObserver(scheduleCopy).observe(viewRoot, { childList: true, subtree: true });
if (workspaceTitle) new MutationObserver(scheduleCopy).observe(workspaceTitle, { childList: true, characterData: true, subtree: true });
if (topbarStatus) new MutationObserver(scheduleCopy).observe(topbarStatus, { childList: true, characterData: true, subtree: true });
if (parseState) new MutationObserver(scheduleCopy).observe(parseState, { childList: true, characterData: true, subtree: true });
nav?.addEventListener('click', scheduleCopy);

scheduleCopy();
