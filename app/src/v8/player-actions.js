import { activeView, copyText, esc, icon, navigate, root, setPlayer, waitFor } from './core.js';

let openMenu = null;
let scheduled = 0;

function closeMenu() {
  if (!openMenu) return;
  openMenu.hidden = true;
  openMenu = null;
}

function rowStats(row) {
  const table = row.closest('table');
  const headers = Array.from(table?.querySelectorAll('thead th') || []).map(th => th.textContent.trim());
  const cells = Array.from(row.cells || []).map(cell => cell.querySelector('.compact-number')?.getAttribute('title') || cell.textContent.trim());
  return headers.slice(0, cells.length).map((label, index) => `${label}: ${cells[index]}`).join('\n');
}

async function addToComparison(ref) {
  setPlayer(ref);
  navigate('comparison');
  const input = await waitFor(`[data-compare-ref="${CSS.escape(ref)}"]`);
  if (input && !input.checked) input.click();
}

async function openRawForPlayer(ref) {
  setPlayer(ref);
  navigate('events');
  const select = await waitFor('#raw-player-filter');
  if (select) {
    select.value = ref;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function actionMenu(ref, name) {
  return `<div class="qol-player-menu" hidden role="menu" aria-label="Actions for ${esc(name)}">
    <button type="button" role="menuitem" data-qol-player-action="powers">View powers</button>
    <button type="button" role="menuitem" data-qol-player-action="compare">Add to comparison</button>
    <button type="button" role="menuitem" data-qol-player-action="events">View raw events</button>
    <button type="button" role="menuitem" data-qol-player-action="boss">Boss damage</button>
    <button type="button" role="menuitem" data-qol-player-action="copy">Copy stats</button>
  </div>`;
}

function enhanceTable(table) {
  if (table.dataset.qolPlayerActions === 'true') return;
  const rows = Array.from(table.querySelectorAll('tbody tr[data-player-row]'));
  if (!rows.length) return;
  table.dataset.qolPlayerActions = 'true';
  const headRow = table.querySelector('thead tr');
  if (headRow) headRow.insertAdjacentHTML('beforeend', '<th class="qol-actions-cell"><span class="visually-hidden">Actions</span></th>');
  for (const row of rows) {
    const ref = row.dataset.playerRow || '';
    const name = row.querySelector('td:nth-child(2) strong')?.textContent?.trim() || 'player';
    const cell = document.createElement('td');
    cell.className = 'qol-actions-cell';
    cell.innerHTML = `<div class="qol-player-actions"><button class="qol-icon-button" type="button" data-qol-player-menu aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(name)}">${icon('more')}</button>${actionMenu(ref, name)}</div>`;
    row.append(cell);
    const button = cell.querySelector('[data-qol-player-menu]');
    const menu = cell.querySelector('.qol-player-menu');
    button.addEventListener('click', event => {
      event.stopPropagation();
      const opening = menu.hidden;
      closeMenu();
      menu.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      if (opening) {
        openMenu = menu;
        requestAnimationFrame(() => menu.querySelector('button')?.focus({ preventScroll: true }));
      }
    });
    menu.addEventListener('click', async event => {
      const action = event.target.closest('[data-qol-player-action]')?.dataset.qolPlayerAction;
      if (!action) return;
      event.stopPropagation();
      closeMenu();
      if (action === 'powers') { setPlayer(ref); navigate('powers'); }
      else if (action === 'compare') await addToComparison(ref);
      else if (action === 'events') await openRawForPlayer(ref);
      else if (action === 'boss') { setPlayer(ref); navigate('boss'); }
      else if (action === 'copy') await copyText(`${name}\n${rowStats(row)}`);
    });
  }
}

function enhance() {
  if (!root) return;
  root.querySelectorAll('table').forEach(enhanceTable);
}

function schedule() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => { scheduled = 0; enhance(); });
}

document.addEventListener('click', event => {
  if (openMenu && !event.target.closest('.qol-player-actions')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && openMenu) closeMenu();
});
new MutationObserver(schedule).observe(root || document.body, { childList: true, subtree: false });
document.getElementById('app-nav')?.addEventListener('click', schedule);
window.addEventListener('strikeglass:qol-player-actions', schedule);
schedule();
