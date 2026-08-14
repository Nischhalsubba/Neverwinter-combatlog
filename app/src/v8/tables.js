import {
  activeView,
  copyText,
  currentScope,
  downloadText,
  esc,
  icon,
  prefs,
  root,
  savePrefs,
  selectedScopeLabel,
  verifiedReport
} from './core.js';

let scheduled = 0;

function tableKey(table, index) {
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim()).join('|');
  return `${activeView()}:${index}:${headers}`;
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function visibleIndexes(table) {
  const headers = Array.from(table.querySelectorAll('thead th'));
  return headers.map((_, index) => index).filter(index => !headers[index].classList.contains('qol-hidden-column'));
}

function tableCsv(table) {
  const indexes = visibleIndexes(table);
  const rows = [Array.from(table.querySelectorAll('thead th'))];
  rows.push(...Array.from(table.querySelectorAll('tbody tr:not([hidden])')).map(row => Array.from(row.cells)));
  return rows.map(cells => indexes.map(index => {
    const cell = cells[index];
    const exact = cell?.querySelector?.('.compact-number')?.getAttribute('title');
    return csvCell(exact || cell?.textContent || '');
  }).join(',')).join('\n');
}

function slug(value) {
  return String(value || 'strikeglass').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'strikeglass';
}

function applyColumns(table, key) {
  const hidden = new Set(prefs.columns[key] || []);
  const rows = [table.querySelector('thead tr'), ...table.querySelectorAll('tbody tr')].filter(Boolean);
  for (const row of rows) {
    Array.from(row.children).forEach((cell, index) => cell.classList.toggle('qol-hidden-column', hidden.has(index)));
  }
}

function columnPopover(table, key) {
  const headers = Array.from(table.querySelectorAll('thead th'));
  const hidden = new Set(prefs.columns[key] || []);
  return `<div class="qol-column-popover" hidden data-qol-column-popover>${headers.map((header, index) => `<label><input type="checkbox" data-qol-column-index="${index}" ${hidden.has(index) ? '' : 'checked'}> <span>${esc(header.textContent.trim() || `Column ${index + 1}`)}</span></label>`).join('')}</div>`;
}

async function copyFightSummary() {
  try {
    const report = await verifiedReport(currentScope());
    const lines = [
      `Strikeglass · ${selectedScopeLabel()}`,
      `Group damage: ${Math.round(report.damage || 0).toLocaleString()}`,
      `Group DPS: ${Math.round(report.partyDps || 0).toLocaleString()}`,
      `Group Active DPS: ${Math.round(report.partyCombatDps || 0).toLocaleString()}`,
      `Duration: ${Number(report.duration || 0).toFixed(1)}s`,
      '',
      'Players:'
    ];
    (report.players || []).forEach((player, index) => lines.push(`${index + 1}. ${player.name} · ${Math.round(player.damage || 0).toLocaleString()} damage · ${Number(player.damageShare || 0).toFixed(1)}% share · ${Math.round(player.combatDps || 0).toLocaleString()} Active DPS`));
    await copyText(lines.join('\n'));
  } catch (error) {
    await copyText(`Strikeglass · ${selectedScopeLabel()}\nCould not load verified summary: ${error.message || error}`);
  }
}

function addTools(table, key) {
  if (table.dataset.qolTools === 'true') return;
  table.dataset.qolTools = 'true';
  const wrap = table.closest('.table-wrap');
  if (!wrap) return;
  const tool = document.createElement('div');
  tool.className = 'qol-table-tools';
  tool.innerHTML = `
    ${currentScope().type !== 'session' ? `<button class="qol-action-button" type="button" data-qol-copy-summary>${icon('copy')}<span>Copy fight summary</span></button>` : ''}
    <button class="qol-action-button" type="button" data-qol-copy-table>${icon('copy')}<span>Copy table</span></button>
    <button class="qol-action-button" type="button" data-qol-export-table>${icon('export')}<span>Export CSV</span></button>
    <div class="qol-column-wrap"><button class="qol-action-button" type="button" data-qol-columns aria-expanded="false">${icon('columns')}<span>Columns</span></button>${columnPopover(table, key)}</div>`;
  wrap.insertAdjacentElement('beforebegin', tool);
  tool.querySelector('[data-qol-copy-summary]')?.addEventListener('click', copyFightSummary);
  tool.querySelector('[data-qol-copy-table]')?.addEventListener('click', () => copyText(tableCsv(table)));
  tool.querySelector('[data-qol-export-table]')?.addEventListener('click', () => downloadText(`${slug(selectedScopeLabel())}-${slug(activeView())}.csv`, tableCsv(table), 'text/csv;charset=utf-8'));
  const columnButton = tool.querySelector('[data-qol-columns]');
  const popover = tool.querySelector('[data-qol-column-popover]');
  columnButton?.addEventListener('click', () => {
    const open = popover.hidden;
    popover.hidden = !open;
    columnButton.setAttribute('aria-expanded', String(open));
  });
  popover?.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-qol-column-index]');
    if (!checkbox) return;
    const index = Number(checkbox.dataset.qolColumnIndex);
    const hidden = new Set(prefs.columns[key] || []);
    if (checkbox.checked) hidden.delete(index); else hidden.add(index);
    prefs.columns[key] = Array.from(hidden).sort((a, b) => a - b);
    savePrefs();
    applyColumns(table, key);
  });
}

function enhanceTables() {
  if (!root) return;
  const tables = Array.from(root.querySelectorAll('table')).filter(table => !table.closest('.power-popup,.qol-modal'));
  tables.forEach((table, index) => {
    const key = tableKey(table, index);
    applyColumns(table, key);
    if (table.querySelectorAll('tbody tr').length >= 12) table.closest('.panel')?.classList.add('qol-sticky-table');
    if (table.querySelectorAll('thead th').length >= 4) addTools(table, key);
  });
}

function schedule() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => { scheduled = 0; enhanceTables(); });
}

new MutationObserver(schedule).observe(root || document.body, { childList: true, subtree: false });
document.getElementById('app-nav')?.addEventListener('click', schedule);
document.getElementById('encounter-select')?.addEventListener('change', schedule);
document.addEventListener('click', event => {
  document.querySelectorAll('[data-qol-column-popover]:not([hidden])').forEach(popover => {
    if (!event.target.closest('.qol-column-wrap')) popover.hidden = true;
  });
});
schedule();
