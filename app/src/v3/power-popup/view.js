import { summaryMarkup, integer } from './format.js';
import { rowMarkup } from './rows.js';

// summaryMarkup owns the popup summary labels, including Average hit and Flank / CA.
function node(tag, className = '', text = '') {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

export function ensureStyles() {
  if (document.querySelector('link[data-power-popup-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../v6/power-popup.css', import.meta.url).href;
  link.dataset.powerPopupStyle = 'true';
  document.head.append(link);
}

export function createPopup(power) {
  const backdrop = node('div', 'power-popup-backdrop');
  backdrop.setAttribute('aria-hidden', 'true');
  const dialog = node('section', 'power-popup');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'power-popup-title');

  const head = node('header', 'power-popup-head');
  const titleWrap = node('div');
  const eyebrow = node('span', 'eyebrow', 'Power details');
  const title = node('h2', '', power);
  title.id = 'power-popup-title';
  const description = node('p', '', 'Verified hits from the current player and fight. The page behind this window does not change.');
  titleWrap.append(eyebrow, title, description);
  const close = node('button', 'power-popup-close', '×');
  close.type = 'button';
  close.dataset.popupClose = 'true';
  close.setAttribute('aria-label', 'Close power details');
  head.append(titleWrap, close);

  const meta = node('div', 'power-popup-meta');
  meta.append(node('span', '', 'Damage type'), node('strong', '', 'Physical'), node('small', '', 'Hits are shown in time order. Offset starts at the first hit below.'));

  const summary = node('section', 'power-popup-summary');
  summary.dataset.popupSummary = 'true';
  summary.setAttribute('aria-label', 'Power summary');
  for (let index = 0; index < 6; index += 1) {
    const card = node('article');
    card.append(node('span', '', 'Loading'), node('strong', '', '—'));
    summary.append(card);
  }

  const status = node('div', 'power-popup-status', 'Loading verified hits…');
  status.dataset.popupStatus = 'true';

  const wrap = node('div', 'power-popup-table-wrap');
  wrap.dataset.popupTable = 'true';
  wrap.hidden = true;
  const table = node('table');
  const thead = node('thead');
  const headRow = node('tr');
  ['Time','After first hit','Target','Damage','Base damage','Change vs base','Damage type','Hit details'].forEach((label, index) => {
    const th = node('th', index >= 3 && index <= 5 ? 'num' : '', label);
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = node('tbody');
  tbody.dataset.popupRows = 'true';
  table.append(thead, tbody);
  wrap.append(table);

  const foot = node('footer', 'power-popup-foot');
  foot.append(node('span', '', 'Change vs base shows how much the final hit was above or below the base damage.'));
  const more = node('button', 'button', 'Load 250 more');
  more.type = 'button';
  more.dataset.popupMore = 'true';
  more.hidden = true;
  foot.append(more);

  dialog.append(head, meta, summary, status, wrap, foot);
  document.body.append(backdrop, dialog);
  return { backdrop, dialog };
}

export function renderSummary(dialog, summary) {
  const host = dialog?.querySelector('[data-popup-summary]');
  if (host && summary) host.innerHTML = summaryMarkup(summary);
}

export function setStatus(dialog, text, tone = '') {
  const host = dialog?.querySelector('[data-popup-status]');
  if (!host) return;
  host.textContent = text;
  host.dataset.tone = tone;
}

export function appendRows(dialog, rows, firstTime, reset = false) {
  const body = dialog?.querySelector('[data-popup-rows]');
  const wrap = dialog?.querySelector('[data-popup-table]');
  if (!body || !wrap) return 0;
  if (reset) body.innerHTML = '';
  body.insertAdjacentHTML('beforeend', rows.map(row => rowMarkup(row, firstTime)).join(''));
  wrap.hidden = false;
  return body.rows.length;
}

export function updateMoreButton(dialog, nextCursor, loading = false) {
  const button = dialog?.querySelector('[data-popup-more]');
  if (!button) return;
  button.hidden = nextCursor == null;
  button.disabled = loading;
  button.textContent = loading ? 'Loading…' : 'Load 250 more';
}

export function loadedStatus(dialog, count, complete) {
  setStatus(dialog, `${integer(count)} hit${count === 1 ? '' : 's'} loaded${complete ? ' · complete' : ''}`, 'good');
}
