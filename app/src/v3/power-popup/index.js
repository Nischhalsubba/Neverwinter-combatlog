import { currentPlayerRef, currentScope, workerRequest } from './worker.js';
import { summaryFromReport } from './format.js';
import { appendRows, createPopup, ensureStyles, loadedStatus, renderSummary, setStatus, updateMoreButton } from './view.js';

const TRIGGERS = [
  '.player-overview-panel .panel-subsection .analysis-bar-row',
  '.boss-grid aside .analysis-bars .analysis-bar-row',
  'tr[data-power-row]',
  '[data-power-popup-trigger]'
].join(',');
const root = document.getElementById('view-root');
const appShell = document.querySelector('.app-shell');

let dialog = null;
let backdrop = null;
let opener = null;
let scrollPoint = { x: 0, y: 0 };
let token = 0;
let detail = null;

ensureStyles();

function powerName(trigger) {
  if (trigger?.dataset?.powerPopupTrigger) return trigger.dataset.powerPopupTrigger;
  if (trigger?.matches('tr[data-power-row]')) return trigger.dataset.powerRow || '';
  return trigger?.querySelector('strong')?.textContent?.trim() || '';
}

function closePopup(restoreFocus = true) {
  const wasOpen = Boolean(dialog || backdrop);
  token += 1;
  detail = null;
  dialog?.remove();
  backdrop?.remove();
  dialog = null;
  backdrop = null;
  document.body.classList.remove('power-popup-open');
  if (appShell) appShell.inert = false;
  if (wasOpen) window.scrollTo(scrollPoint.x, scrollPoint.y);
  if (restoreFocus && opener?.isConnected) requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  opener = null;
}

function focusTrap(event) {
  if (!dialog || event.key !== 'Tab') return;
  const items = Array.from(dialog.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'));
  if (!items.length) return;
  const first = items[0];
  const last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function loadMore() {
  if (!dialog || !detail || detail.loading || detail.nextCursor == null) return;
  detail.loading = true;
  updateMoreButton(dialog, detail.nextCursor, true);
  const localToken = token;
  try {
    const page = await workerRequest('raw-page', { options: {
      cursor: detail.nextCursor,
      limit: 250,
      playerRef: detail.playerRef,
      powerName: detail.power,
      kind: 'damage',
      validDamageOnly: true,
      scope: detail.scope
    }});
    if (localToken !== token || !dialog) return;
    if (page?.verification?.status !== 'verified') throw new Error('These hits are waiting for the second accuracy check.');
    const count = appendRows(dialog, page.rows || [], detail.firstTime, false);
    detail.nextCursor = page.nextCursor;
    loadedStatus(dialog, count, detail.nextCursor == null);
  } catch (error) {
    if (localToken === token) setStatus(dialog, error.message || String(error), 'bad');
  } finally {
    if (detail) detail.loading = false;
    updateMoreButton(dialog, detail?.nextCursor ?? null, false);
  }
}

async function openPopup(trigger) {
  const power = powerName(trigger);
  const playerRef = trigger?.dataset?.powerPopupPlayer || currentPlayerRef();
  if (!power || !playerRef) return;
  if (dialog) closePopup(false);
  const localToken = ++token;
  opener = trigger;
  scrollPoint = { x: window.scrollX, y: window.scrollY };
  const scope = currentScope();
  ({ dialog, backdrop } = createPopup(power));
  detail = { power, playerRef, scope, firstTime: 0, nextCursor: null, loading: true };
  document.body.classList.add('power-popup-open');
  if (appShell) appShell.inert = true;
  backdrop.addEventListener('click', () => closePopup());
  dialog.querySelector('[data-popup-close]')?.addEventListener('click', () => closePopup());
  dialog.querySelector('[data-popup-more]')?.addEventListener('click', loadMore);
  requestAnimationFrame(() => dialog?.querySelector('[data-popup-close]')?.focus({ preventScroll: true }));

  workerRequest('scope-report', { scope }).then(report => {
    if (localToken !== token || !dialog) return;
    if (report?.verification?.status !== 'verified') throw new Error('Power totals are waiting for the second accuracy check.');
    renderSummary(dialog, summaryFromReport(report, playerRef, power));
  }).catch(error => {
    if (localToken === token && dialog) setStatus(dialog, error.message || String(error), 'bad');
  });

  try {
    const page = await workerRequest('raw-page', { options: {
      cursor: null,
      limit: 250,
      playerRef,
      powerName: power,
      kind: 'damage',
      validDamageOnly: true,
      scope
    }});
    if (localToken !== token || !dialog) return;
    if (page?.verification?.status !== 'verified') throw new Error('These hits are waiting for the second accuracy check.');
    const rows = page.rows || [];
    detail.firstTime = Number(rows[0]?.time) || 0;
    detail.nextCursor = page.nextCursor;
    detail.loading = false;
    if (!rows.length) {
      setStatus(dialog, 'No verified Physical-damage hits were found for this power in the selected fight.');
      return;
    }
    const count = appendRows(dialog, rows, detail.firstTime, true);
    loadedStatus(dialog, count, detail.nextCursor == null);
    updateMoreButton(dialog, detail.nextCursor, false);
  } catch (error) {
    if (localToken === token && dialog) setStatus(dialog, error.message || String(error), 'bad');
  }
}

function enhanceTriggers() {
  document.querySelectorAll(TRIGGERS).forEach(trigger => {
    if (trigger.dataset.powerPopupReady === 'true') return;
    const power = powerName(trigger);
    if (!power) return;
    trigger.dataset.powerPopupReady = 'true';
    trigger.classList.add('power-drilldown-trigger');
    if (!trigger.matches('button,a')) {
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');
    }
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-label', `Open hit details for ${power}`);
    trigger.setAttribute('title', 'Open hit details');
  });
}

function intercept(trigger, event) {
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPopup(trigger);
}

document.addEventListener('click', event => {
  const trigger = event.target.closest?.(TRIGGERS);
  if (!trigger) return;
  if (event.target.closest('button,a,input,select,textarea') && event.target !== trigger) return;
  intercept(trigger, event);
}, true);

document.addEventListener('keydown', event => {
  if (dialog) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePopup();
      return;
    }
    focusTrap(event);
    return;
  }
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const trigger = event.target.closest?.(TRIGGERS);
  if (trigger) intercept(trigger, event);
}, true);

if (root) {
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceTriggers();
    });
  }).observe(root, { childList: true });
}

document.addEventListener('strikeglass:power-popup-refresh', enhanceTriggers);
enhanceTriggers();
