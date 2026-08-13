import { compact, esc, integer } from './format.js';

export function rowMarkup(row, firstTime) {
  const target = row.targetName || row.targetRef || 'Unknown target';
  const damage = Number(row.amount) || 0;
  const base = Number(row.baseAmount) || 0;
  const change = base ? `${damage >= base ? '+' : ''}${Math.round((damage / base - 1) * 100)}%` : '—';
  return `<tr><td>${esc(Number(row.time || 0).toFixed(2))}s</td><td>+${Math.max(0, Number(row.time || 0) - firstTime).toFixed(2)}s</td><td>${esc(target)}</td><td class="num" title="${esc(integer(damage))}"><strong>${esc(compact(damage))}</strong></td><td class="num" title="${esc(integer(base))}">${esc(compact(base))}</td><td class="num raw-debuff">${esc(change)}</td><td>${esc(row.damageType || 'Unknown')}</td><td>${esc(row.flagsRaw || '—')}</td></tr>`;
}
