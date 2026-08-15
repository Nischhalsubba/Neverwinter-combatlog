const root = document.getElementById('view-root');
let scanFrame = 0;
let expandedPanel = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

function ensureStyle() {
  if (document.querySelector('link[data-chart-studio-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./chart-studio.css', import.meta.url).href;
  link.dataset.chartStudioStyle = 'true';
  document.head.append(link);
}

function icon(path) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}

function control(action, label, path, pressed = null) {
  const pressedAttr = pressed == null ? '' : ` aria-pressed="${pressed ? 'true' : 'false'}"`;
  return `<button class="sg-chart-button" type="button" data-sg-pt-action="${action}" aria-label="${label}" title="${label}"${pressedAttr}>${icon(path)}</button>`;
}

function lanes(panel) {
  return Array.from(panel.querySelectorAll('.rotation-lane'));
}

function laneIdentity(lane, index) {
  const name = lane.querySelector('.rotation-lane-label strong')?.textContent?.trim() || `Player ${index + 1}`;
  const ref = lane.querySelector('canvas[data-rotation-lane]')?.dataset.rotationLane || name;
  return { lane, name, ref };
}

function applyFocus(panel, ref) {
  const items = lanes(panel).map(laneIdentity);
  for (const item of items) {
    const focused = !ref || item.ref === ref;
    item.lane.classList.toggle('sg-lane-focus', Boolean(ref) && focused);
    item.lane.classList.toggle('sg-lane-muted', Boolean(ref) && !focused);
  }
  panel.dataset.sgPtFocus = ref || '';
  const select = panel.querySelector('[data-sg-pt-focus]');
  if (select && select.value !== (ref || '')) select.value = ref || '';
}

function setExpanded(panel, value) {
  if (expandedPanel && expandedPanel !== panel) setExpanded(expandedPanel, false);
  panel.classList.toggle('sg-pt-expanded', value);
  document.body.classList.toggle('sg-visual-expanded', value);
  panel.querySelector('[data-sg-pt-action="expand"]')?.setAttribute('aria-pressed', value ? 'true' : 'false');
  expandedPanel = value ? panel : null;
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function reset(panel) {
  panel.querySelector('[data-pt-fit]')?.click();
  const all = panel.querySelector('[data-rotation-all]');
  if (all?.getAttribute('aria-pressed') !== 'true') all?.click();
  panel.classList.remove('sg-pt-contrast');
  panel.querySelector('[data-sg-pt-action="contrast"]')?.setAttribute('aria-pressed', 'false');
  applyFocus(panel, '');
}

function enhancePowerTimeline(panel) {
  if (!panel || panel.dataset.sgGraphStudio === 'true') return;
  const baseToolbar = panel.querySelector('[data-pt-toolbar]');
  if (!baseToolbar) {
    const tries = Number(panel.dataset.sgGraphStudioWait || 0);
    if (tries < 30) {
      panel.dataset.sgGraphStudioWait = String(tries + 1);
      setTimeout(scheduleScan, 100);
    }
    return;
  }
  delete panel.dataset.sgGraphStudioWait;
  const items = lanes(panel).map(laneIdentity);
  if (!items.length) return;
  panel.dataset.sgGraphStudio = 'true';
  panel.tabIndex = 0;
  panel.setAttribute('aria-label', 'Fight Timeline graph. Use the timeline controls to zoom, pan, focus a player, change contrast, or expand the visual.');
  const studio = document.createElement('div');
  studio.className = 'sg-pt-studio';
  studio.innerHTML = `<label class="sg-pt-focus"><span>Focus player</span><select data-sg-pt-focus aria-label="Focus one player timeline"><option value="">All players</option>${items.map(item => `<option value="${esc(item.ref)}">${esc(item.name)}</option>`).join('')}</select></label>${control('reset','Reset timeline view','M4 7v5h5M5.2 16a8 8 0 1 0 .4-8.6L4 9')}${control('contrast','High contrast timeline','M12 4a8 8 0 1 0 0 16V4z',false)}${control('expand','Expand timeline','M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5',false)}`;
  baseToolbar.append(studio);
  studio.querySelector('[data-sg-pt-focus]')?.addEventListener('change', event => applyFocus(panel, event.target.value));
  studio.addEventListener('click', event => {
    const button = event.target.closest('[data-sg-pt-action]');
    if (!button) return;
    if (button.dataset.sgPtAction === 'reset') reset(panel);
    if (button.dataset.sgPtAction === 'contrast') {
      const active = !panel.classList.contains('sg-pt-contrast');
      panel.classList.toggle('sg-pt-contrast', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    if (button.dataset.sgPtAction === 'expand') setExpanded(panel, !panel.classList.contains('sg-pt-expanded'));
  });
  items.forEach(item => item.lane.querySelector('.rotation-lane-label')?.addEventListener('click', () => {
    const current = panel.dataset.sgPtFocus || '';
    applyFocus(panel, current === item.ref ? '' : item.ref);
  }));
  panel.addEventListener('keydown', event => {
    if (event.target.matches('select,button,input')) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); panel.querySelector('[data-pt-zoom-in]')?.click(); }
    else if (event.key === '-') { event.preventDefault(); panel.querySelector('[data-pt-zoom-out]')?.click(); }
    else if (event.key === '0') { event.preventDefault(); reset(panel); }
    else if (event.key.toLowerCase() === 'c') { event.preventDefault(); panel.querySelector('[data-sg-pt-action="contrast"]')?.click(); }
    else if (event.key === 'Escape' && panel.classList.contains('sg-pt-expanded')) { event.preventDefault(); setExpanded(panel, false); }
  });
}

function enhanceBars() {
  root?.querySelectorAll('.analysis-bar-row').forEach(row => {
    if (row.dataset.sgVisualBound === 'true') return;
    row.dataset.sgVisualBound = 'true';
    if (!row.hasAttribute('tabindex')) row.tabIndex = 0;
    if (!row.hasAttribute('aria-label')) row.setAttribute('aria-label', row.textContent.replace(/\s+/g, ' ').trim());
  });
}

function scan() {
  scanFrame = 0;
  ensureStyle();
  enhanceBars();
  enhancePowerTimeline(root?.querySelector('.rotation-panel'));
}

function scheduleScan() {
  if (scanFrame) return;
  scanFrame = requestAnimationFrame(scan);
}

document.addEventListener('strikeglass:view-rendered', scheduleScan);
document.addEventListener('strikeglass:dashboard-ready', scheduleScan);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && expandedPanel) setExpanded(expandedPanel, false);
});

ensureStyle();
scheduleScan();
