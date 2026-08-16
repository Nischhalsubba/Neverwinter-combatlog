import { esc } from '../v8/core.js';

let dialog = null;
let returnFocus = null;

function ensureDialog() {
  if (dialog?.isConnected) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'sg-evidence-drawer';
  dialog.setAttribute('aria-labelledby', 'sg-evidence-drawer-title');
  dialog.innerHTML = `
    <div class="sg-evidence-drawer-shell">
      <header><div><span class="eyebrow">Evidence</span><h2 id="sg-evidence-drawer-title">Trust details</h2></div><button class="button" type="button" data-sg-evidence-close>Close</button></header>
      <div class="sg-evidence-drawer-body" data-sg-evidence-body></div>
    </div>`;
  document.body.append(dialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-sg-evidence-close]')) closeEvidenceDrawer();
  });
  dialog.addEventListener('close', () => {
    returnFocus?.focus?.({ preventScroll: true });
    returnFocus = null;
  });
  return dialog;
}

export function openEvidenceDrawer({ title = 'Trust details', intro = '', sections = [] } = {}) {
  const node = ensureDialog();
  returnFocus = document.activeElement;
  node.querySelector('#sg-evidence-drawer-title').textContent = title;
  node.querySelector('[data-sg-evidence-body]').innerHTML = `
    ${intro ? `<p class="sg-evidence-intro">${esc(intro)}</p>` : ''}
    <div class="sg-evidence-section-list">
      ${sections.map(section => `<article class="sg-evidence-section is-${esc(section.tone || 'neutral')}"><div><span>${esc(section.label || '')}</span><strong>${esc(section.status || '')}</strong></div><p>${esc(section.detail || '')}</p>${section.meta ? `<small>${esc(section.meta)}</small>` : ''}</article>`).join('')}
    </div>`;
  if (typeof node.showModal === 'function') node.showModal();
  else node.setAttribute('open', '');
  node.querySelector('[data-sg-evidence-close]')?.focus?.();
}

export function closeEvidenceDrawer() {
  if (!dialog) return;
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}
