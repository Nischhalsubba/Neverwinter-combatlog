import { activeView, esc, icon, nav, navigate } from './core.js';

let dialog = null;
let backdrop = null;
let commands = [];
let selected = 0;
let opener = null;

function commandList() {
  const items = Array.from(nav?.querySelectorAll('[data-view]:not([disabled])') || []).map(button => ({
    id: `view:${button.dataset.view}`,
    label: button.querySelector('span')?.textContent?.trim() || button.dataset.view,
    hint: button.dataset.view === activeView() ? 'Current view' : 'Open view',
    run: () => navigate(button.dataset.view)
  }));
  items.push(
    { id: 'fight:prev', label: 'Previous fight', hint: 'K', run: () => window.dispatchEvent(new CustomEvent('strikeglass:qol-prev-fight')) },
    { id: 'fight:next', label: 'Next fight', hint: 'J', run: () => window.dispatchEvent(new CustomEvent('strikeglass:qol-next-fight')) },
    { id: 'fight:all', label: 'Show all fights', hint: 'Clear fight filters', run: () => window.dispatchEvent(new CustomEvent('strikeglass:qol-all-fights')) },
    { id: 'file:change', label: 'Change combat log', hint: 'Open another local file', run: () => document.getElementById('replace-file')?.click() }
  );
  const compare = document.querySelector('[data-qol-attempt]:not([hidden])');
  if (compare) items.push({ id: 'boss:compare', label: 'Compare boss attempts', hint: 'Current repeated boss', run: () => window.dispatchEvent(new CustomEvent('strikeglass:qol-attempt-compare')) });
  return items;
}

function filtered(query = '') {
  const needle = query.trim().toLowerCase();
  return needle ? commands.filter(command => `${command.label} ${command.hint}`.toLowerCase().includes(needle)) : commands;
}

function render(query = '') {
  if (!dialog) return;
  const list = filtered(query);
  selected = Math.max(0, Math.min(selected, Math.max(0, list.length - 1)));
  const host = dialog.querySelector('[data-qol-command-list]');
  if (!host) return;
  host.innerHTML = list.length ? list.map((command, index) => `<button class="qol-command-item" type="button" data-qol-command-id="${esc(command.id)}" aria-selected="${index === selected}"><span>${esc(command.label)}</span><small>${esc(command.hint)}</small></button>`).join('') : '<div class="empty-block">No matching commands.</div>';
  host.querySelectorAll('[data-qol-command-id]').forEach(button => button.addEventListener('click', () => run(button.dataset.qolCommandId)));
  host.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

function run(id) {
  const command = commands.find(item => item.id === id);
  if (!command) return;
  close(false);
  command.run();
}

function close(restore = true) {
  dialog?.remove();
  backdrop?.remove();
  dialog = null;
  backdrop = null;
  document.querySelector('.app-shell')?.removeAttribute('inert');
  if (restore) opener?.focus?.({ preventScroll: true });
  opener = null;
}

function open() {
  if (dialog) return;
  opener = document.activeElement;
  commands = commandList();
  selected = 0;
  backdrop = document.createElement('div');
  backdrop.className = 'qol-command-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  dialog = document.createElement('section');
  dialog.className = 'qol-command';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Quick navigation');
  dialog.innerHTML = `<div class="qol-command-search">${icon('search')}<input type="search" data-qol-command-input aria-label="Search commands" placeholder="Go to a page or action…" autocomplete="off"></div><div class="qol-command-list" data-qol-command-list role="listbox"></div>`;
  document.body.append(backdrop, dialog);
  document.querySelector('.app-shell')?.setAttribute('inert', '');
  backdrop.addEventListener('click', () => close());
  const input = dialog.querySelector('[data-qol-command-input]');
  input.addEventListener('input', () => { selected = 0; render(input.value); });
  render();
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
}

document.addEventListener('keydown', event => {
  const editable = event.target?.matches?.('input,textarea,select,[contenteditable="true"]');
  if (!dialog && ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' || (!editable && !event.ctrlKey && !event.metaKey && event.key === '/'))) {
    event.preventDefault();
    open();
    return;
  }
  if (!dialog) return;
  const input = dialog.querySelector('[data-qol-command-input]');
  const list = filtered(input?.value || '');
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    selected = Math.min(list.length - 1, selected + 1);
    render(input?.value || '');
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selected = Math.max(0, selected - 1);
    render(input?.value || '');
  } else if (event.key === 'Enter' && list[selected]) {
    event.preventDefault();
    run(list[selected].id);
  }
});

window.addEventListener('strikeglass:qol-command', open);
