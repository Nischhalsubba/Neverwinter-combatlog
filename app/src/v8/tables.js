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

const HEADER_HELP = Object.freeze({
  '#': 'Row number.',
  player: 'The player shown in this row.',
  class: 'The player class.',
  damage: 'Total damage dealt.',
  share: 'Percent of the total damage.',
  '%': 'Percent of the total damage.',
  dps: 'Average damage per second for the selected fight.',
  'combat dps': 'Damage per second while actively in combat.',
  'active dps': 'Damage per second while actively in combat.',
  hits: 'Total number of damage hits.',
  duration: 'How long this activity lasted.',
  crit: 'Percent of hits that were critical hits.',
  'crit%': 'Percent of hits that were critical hits.',
  'flank / ca': 'Percent of hits with Combat Advantage.',
  'flank%': 'Percent of hits with Combat Advantage.',
  companion: 'Total damage dealt by the companion.',
  taken: 'Total damage received.',
  type: 'The kind of fight or event.',
  'boss / target': 'The boss or target for this fight.',
  start: 'When this fight started in the log.',
  time: 'When this event happened.',
  '+offset': 'Time since the first hit shown.',
  target: 'Who or what was hit.',
  base: 'Damage before debuff amplification.',
  'debuff%': 'Extra damage compared with the base amount.',
  flags: 'Extra labels recorded for this hit.',
  power: 'The power that caused the damage.',
  category: 'The type of power, such as At-Will or Encounter.',
  avg: 'Average damage per hit.',
  average: 'Average value for this row.',
  max: 'Highest single value.',
  min: 'Lowest single value.',
  median: 'The middle value when results are sorted.',
  owner: 'Who caused this event.',
  'damage type': 'The damage type recorded in the log.',
  'event type': 'The kind of combat-log event.',
  amount: 'Damage amount for this event.',
  uptime: 'Percent of the selected time this effect was active.',
  attempts: 'Total number of attempts.',
  count: 'Total number of matching entries.',
  delta: 'Difference from the comparison value.'
});

function normalizeHeader(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function simpleHeaderHelp(label) {
  const key = normalizeHeader(label);
  if (HEADER_HELP[key]) return HEADER_HELP[key];
  if (/avg|average/.test(key)) return 'Average value for this row.';
  if (/median/.test(key)) return 'The middle value when results are sorted.';
  if (/max|highest|peak/.test(key)) return 'Highest value for this row.';
  if (/min|lowest/.test(key)) return 'Lowest value for this row.';
  if (/damage/.test(key)) return 'Damage value for this row.';
  if (/dps/.test(key)) return 'Damage per second for this row.';
  if (/uptime/.test(key)) return 'Percent of time this was active.';
  if (/share|percent|%/.test(key)) return 'Percent of the total for this row.';
  if (/hits|count|uses|casts|events|rows/.test(key)) return 'Total number for this row.';
  if (/duration|elapsed/.test(key)) return 'How long this lasted.';
  if (/time|start|end/.test(key)) return 'When this happened in the selected fight.';
  if (/player|owner|source/.test(key)) return 'Who this row belongs to.';
  if (/target|boss/.test(key)) return 'Who or what this row refers to.';
  if (/power|effect|debuff|buff/.test(key)) return 'The combat effect shown in this row.';
  if (/delta|difference|change/i.test(key) || /[Δδ]/.test(label)) return 'Difference from the comparison value.';
  return `The ${String(label || 'column').toLowerCase()} value for this row.`;
}

function ensureHeaderTooltip() {
  let tooltip = document.getElementById('qol-header-tooltip');
  if (tooltip) return tooltip;
  tooltip = document.createElement('div');
  tooltip.id = 'qol-header-tooltip';
  tooltip.className = 'qol-header-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  return tooltip;
}

function showHeaderTooltip(button) {
  const tooltip = ensureHeaderTooltip();
  tooltip.textContent = button.dataset.qolHeaderHelp || 'Column explanation.';
  tooltip.hidden = false;
  tooltip.classList.add('is-visible');
  const rect = button.getBoundingClientRect();
  const gap = 8;
  const edge = 8;
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(edge, Math.min(left, window.innerWidth - width - edge));
  let top = rect.bottom + gap;
  if (top + height > window.innerHeight - edge) top = Math.max(edge, rect.top - height - gap);
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
  button.setAttribute('aria-describedby', tooltip.id);
}

function hideHeaderTooltip(button) {
  const tooltip = document.getElementById('qol-header-tooltip');
  tooltip?.classList.remove('is-visible');
  if (tooltip) tooltip.hidden = true;
  button?.removeAttribute('aria-describedby');
}

function addHeaderHelp(table) {
  Array.from(table.querySelectorAll('thead th')).forEach((header, index) => {
    if (header.querySelector('[data-qol-header-help-button]')) return;
    const label = header.textContent.trim() || `Column ${index + 1}`;
    const help = simpleHeaderHelp(label);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'qol-header-help';
    button.dataset.qolHeaderHelpButton = 'true';
    button.dataset.qolHeaderHelp = help;
    button.setAttribute('aria-label', `${label}: ${help}`);
    button.addEventListener('pointerenter', () => showHeaderTooltip(button));
    button.addEventListener('pointerleave', () => hideHeaderTooltip(button));
    button.addEventListener('focus', () => showHeaderTooltip(button));
    button.addEventListener('blur', () => hideHeaderTooltip(button));
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showHeaderTooltip(button);
    });
    header.append(button);
  });
}

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
  const allTables = Array.from(document.querySelectorAll('table'));
  allTables.forEach(addHeaderHelp);
  if (!root) return;
  const tables = allTables.filter(table => root.contains(table) && !table.closest('.power-popup,.qol-modal'));
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

new MutationObserver(records => {
  const hasNewTable = records.some(record => Array.from(record.addedNodes).some(node => node.nodeType === 1 && (node.matches?.('table,thead,th') || node.querySelector?.('table,thead,th'))));
  if (hasNewTable) schedule();
}).observe(document.body, { childList: true, subtree: true });
document.getElementById('app-nav')?.addEventListener('click', schedule);
document.getElementById('encounter-select')?.addEventListener('change', schedule);
document.addEventListener('strikeglass:view-rendered', schedule);
document.addEventListener('strikeglass:power-popup-refresh', schedule);
document.addEventListener('click', event => {
  document.querySelectorAll('[data-qol-column-popover]:not([hidden])').forEach(popover => {
    if (!event.target.closest('.qol-column-wrap')) popover.hidden = true;
  });
  if (!event.target.closest('[data-qol-header-help-button]')) hideHeaderTooltip();
});
schedule();
