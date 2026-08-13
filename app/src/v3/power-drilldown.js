const POWER_BAR_SELECTOR = [
  '.player-overview-panel .panel-subsection .analysis-bar-row',
  '.boss-grid aside .analysis-bars .analysis-bar-row'
].join(',');

const root = document.getElementById('view-root');
let originView = '';
let requestedPower = '';
let powerSummary = null;
let modalWasOpen = false;
let backdrop = null;
let requestToken = 0;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function activeView() {
  return document.querySelector('#app-nav [data-view].is-active')?.dataset.view || '';
}

function exactCell(row, index) {
  const cell = row?.cells?.[index];
  if (!cell) return '—';
  const compact = cell.querySelector('.compact-number');
  return (compact?.getAttribute('title') || cell.textContent || '—').trim();
}

function summaryFromPowerRow(row) {
  if (!row) return null;
  return {
    power: row.dataset.powerRow || row.cells?.[0]?.textContent?.trim() || 'Power',
    hits: exactCell(row, 2),
    damage: exactCell(row, 3),
    average: exactCell(row, 5),
    max: exactCell(row, 6),
    crit: exactCell(row, 7),
    flank: exactCell(row, 8)
  };
}

function powerNameFromBar(bar) {
  return bar?.querySelector('strong')?.textContent?.trim() || '';
}

function enhancePowerBars() {
  document.querySelectorAll(POWER_BAR_SELECTOR).forEach(bar => {
    if (bar.dataset.powerDrilldownReady === 'true') return;
    const power = powerNameFromBar(bar);
    if (!power) return;
    bar.dataset.powerDrilldownReady = 'true';
    bar.classList.add('power-drilldown-trigger');
    bar.setAttribute('role', 'button');
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('aria-label', `Open raw hit details for ${power}`);
    bar.setAttribute('title', 'Open verified raw hits');
  });
}

function findPowerRow(power) {
  return Array.from(document.querySelectorAll('tr[data-power-row]'))
    .find(row => row.dataset.powerRow === power) || null;
}

function waitForPowerRow(power, token, timeoutMs = 6000) {
  return new Promise(resolve => {
    const existing = findPowerRow(power);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      if (token !== requestToken) {
        observer.disconnect();
        resolve(null);
        return;
      }
      const row = findPowerRow(power);
      if (!row) return;
      observer.disconnect();
      resolve(row);
    });
    observer.observe(root || document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(findPowerRow(power));
    }, timeoutMs);
  });
}

async function openPowerFromBar(bar) {
  const power = powerNameFromBar(bar);
  if (!power) return;
  const token = ++requestToken;
  originView = activeView();
  requestedPower = power;
  powerSummary = null;

  const powersNav = document.querySelector('#app-nav [data-view="powers"]');
  if (!powersNav || powersNav.disabled) return;
  powersNav.click();

  const row = await waitForPowerRow(power, token);
  if (token !== requestToken) return;
  if (!row) {
    const returnNav = originView && document.querySelector(`#app-nav [data-view="${originView}"]`);
    originView = '';
    requestedPower = '';
    returnNav?.click();
    return;
  }

  powerSummary = summaryFromPowerRow(row);
  row.scrollIntoView({ block: 'nearest' });
  row.click();
}

function summaryMarkup(summary) {
  if (!summary) return '';
  const entries = [
    ['Total damage', summary.damage],
    ['Entries', summary.hits],
    ['Average hit', summary.average],
    ['Max hit', summary.max],
    ['Crit', summary.crit],
    ['Flank / CA', summary.flank]
  ];
  return `<section class="power-hit-summary" aria-label="Power damage summary">${entries.map(([label, value]) => `
    <article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join('')}
  </section>`;
}

function ensureBackdrop() {
  if (backdrop?.isConnected) return;
  backdrop = document.createElement('div');
  backdrop.className = 'power-drilldown-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.addEventListener('click', () => document.querySelector('.raw-hits-panel [data-close-power]')?.click());
  document.body.append(backdrop);
}

function removeBackdrop() {
  backdrop?.remove();
  backdrop = null;
}

function enhanceRawPanel(panel) {
  if (panel.dataset.powerModalReady === 'true') return;
  panel.dataset.powerModalReady = 'true';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', `Raw hits for ${requestedPower || powerSummary?.power || 'selected power'}`);

  if (!powerSummary) {
    const selected = document.querySelector('.power-table tr[data-power-row].selected');
    powerSummary = summaryFromPowerRow(selected);
  }

  const head = panel.querySelector('.raw-hits-head');
  const titleSmall = head?.querySelector('h3 small');
  if (titleSmall && powerSummary?.hits) {
    const loaded = panel.querySelectorAll('.raw-hits-table tbody tr').length;
    titleSmall.textContent = `(${powerSummary.hits} entries${loaded ? ` · ${loaded} loaded` : ''})`;
  }

  if (head && !panel.querySelector('.power-hit-type')) {
    head.insertAdjacentHTML('afterend', `
      <div class="power-hit-type"><span>Type</span><strong>Physical</strong><small>Chronological verified hits; +Offset shows time from the first hit in this drilldown.</small></div>
      ${summaryMarkup(powerSummary)}
    `);
  }

  const close = panel.querySelector('[data-close-power]');
  if (close) {
    close.setAttribute('aria-label', 'Close raw hit details');
    requestAnimationFrame(() => close.focus({ preventScroll: true }));
  }
}

function returnToOrigin() {
  const destination = originView;
  originView = '';
  requestedPower = '';
  powerSummary = null;
  if (!destination || destination === 'powers' || activeView() !== 'powers') return;
  document.querySelector(`#app-nav [data-view="${destination}"]`)?.click();
}

function syncModalState() {
  enhancePowerBars();
  const panel = document.querySelector('.raw-hits-panel');
  if (panel) {
    enhanceRawPanel(panel);
    ensureBackdrop();
    document.body.classList.add('power-drilldown-open');
    modalWasOpen = true;
    return;
  }
  if (!modalWasOpen) return;
  modalWasOpen = false;
  document.body.classList.remove('power-drilldown-open');
  removeBackdrop();
  queueMicrotask(returnToOrigin);
}

function trapFocus(event, panel) {
  const focusables = Array.from(panel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('click', event => {
  const bar = event.target.closest(POWER_BAR_SELECTOR);
  if (!bar) return;
  openPowerFromBar(bar);
});

document.addEventListener('keydown', event => {
  const bar = event.target.closest?.(POWER_BAR_SELECTOR);
  if (bar && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openPowerFromBar(bar);
    return;
  }
  const panel = document.querySelector('.raw-hits-panel');
  if (!panel) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    panel.querySelector('[data-close-power]')?.click();
  } else if (event.key === 'Tab') {
    trapFocus(event, panel);
  }
});

new MutationObserver(syncModalState).observe(root || document.body, { childList: true, subtree: true });
syncModalState();
