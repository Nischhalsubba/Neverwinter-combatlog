import { EVENT_PAGE_SIZE, compact, currentScope, esc, timeLabel, workerRequest, verifiedReport } from '../v8/core.js';
import { openInvestigation } from './composition-shell.js';
import { openEvidenceDrawer } from './evidence-drawer.js';

async function rowsForWindow(scope, start, end) {
  const rows = [];
  let cursor = null;
  do {
    const page = await workerRequest('raw-page', { options: { cursor, limit: EVENT_PAGE_SIZE, scope, start, end } }, 60000);
    if (page?.verification?.status !== 'verified') throw new Error('Moment Inspector is waiting for arithmetic verification.');
    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
  } while (cursor != null);
  return rows;
}

function summarize(rows) {
  const damageByPlayer = new Map();
  const powers = new Map();
  for (const row of rows) {
    if (row.validDamage && Number(row.amount) > 0) damageByPlayer.set(row.ownerName || 'Unknown', (damageByPlayer.get(row.ownerName || 'Unknown') || 0) + Number(row.amount));
    const key = `${row.ownerName || 'Unknown'}|${row.powerName || 'Unknown'}`;
    if (row.validDamage && Number(row.amount) > 0) powers.set(key, (powers.get(key) || 0) + Number(row.amount));
  }
  return { damageByPlayer: [...damageByPlayer].sort((a, b) => b[1] - a[1]), powers: [...powers].sort((a, b) => b[1] - a[1]) };
}

export function openMomentInspector() {
  return openInvestigation('moment-inspector', 'Moment Inspector', async host => {
    const scope = currentScope();
    const report = await verifiedReport(scope);
    const origin = Number(report.scope?.start) || 0;
    const max = Math.max(0, Number(report.duration) || 0);
    host.innerHTML = `<section class="sg-investigation-head"><span class="eyebrow">Moment inspector</span><h2 tabindex="-1">Inspect the verified rows around one instant</h2><p>Choose a time relative to the current fight. Strikeglass reads every stored row in the selected window and keeps raw evidence next to the summary.</p></section><form class="sg-moment-form" data-sg-moment-form><label class="field"><span>Time in fight (seconds)</span><input name="time" type="number" min="0" max="${max}" step="0.1" value="${Math.min(10, max).toFixed(1)}"></label><label class="field"><span>Window</span><select name="window"><option value="2">2 seconds</option><option value="5" selected>5 seconds</option><option value="10">10 seconds</option></select></label><button class="button button-primary" type="submit">Inspect moment</button></form><div data-sg-moment-results class="sg-moment-results"><div class="empty-block">Choose a moment to inspect.</div></div>`;
    const form = host.querySelector('[data-sg-moment-form]');
    const results = host.querySelector('[data-sg-moment-results]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const relative = Math.max(0, Math.min(max, Number(data.get('time')) || 0));
      const span = Math.max(0.5, Number(data.get('window')) || 5);
      const start = origin + Math.max(0, relative - span / 2);
      const end = origin + Math.min(max, relative + span / 2);
      results.innerHTML = '<div class="sg-investigation-loading" role="status">Reading verified rows...</div>';
      const rows = await rowsForWindow(scope, start, end);
      const summary = summarize(rows);
      results.innerHTML = `<section class="metrics"><article><span>Rows</span><strong>${compact(rows.length)}</strong><small>${timeLabel(relative)} center</small></article><article><span>Canonical damage</span><strong>${compact(summary.damageByPlayer.reduce((sum, item) => sum + item[1], 0))}</strong><small>${span.toFixed(1)}s window</small></article><article><span>Owners</span><strong>${summary.damageByPlayer.length}</strong><small>with canonical damage</small></article><article><span>Damaging powers</span><strong>${summary.powers.length}</strong><small>owner + power pairs</small></article></section><section class="section-grid"><article class="panel"><div class="panel-head"><h3>Damage in this moment</h3><button type="button" class="button" data-sg-moment-evidence>Evidence rules</button></div>${summary.damageByPlayer.length ? `<div class="sg-observation-list">${summary.damageByPlayer.map(([name, value]) => `<article><strong>${esc(name)}</strong><b>${compact(value)}</b></article>`).join('')}</div>` : '<div class="empty-block">No canonical damage rows in this window.</div>'}</article><article class="panel"><div class="panel-head"><h3>Top power-owner pairs</h3></div>${summary.powers.length ? `<div class="sg-observation-list">${summary.powers.slice(0, 12).map(([key, value]) => { const [owner, power] = key.split('|'); return `<article><div><strong>${esc(power)}</strong><span>${esc(owner)}</span></div><b>${compact(value)}</b></article>`; }).join('')}</div>` : '<div class="empty-block">No damaging powers in this window.</div>'}</article></section><section class="panel"><div class="panel-head"><h3>Raw rows</h3><span>${rows.length} rows</span></div><div class="table-wrap raw"><table><thead><tr><th>Time</th><th>Owner</th><th>Target</th><th>Power</th><th>Type</th><th class="num">Amount</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc((Number(row.time) - origin).toFixed(2))}s</td><td>${esc(row.ownerName)}</td><td>${esc(row.targetName)}</td><td>${esc(row.powerName)}</td><td>${esc(row.kind)}</td><td class="num">${compact(row.amount)}</td></tr>`).join('')}</tbody></table></div></section>`;
      results.querySelector('[data-sg-moment-evidence]')?.addEventListener('click', () => openEvidenceDrawer({ title: 'Moment Inspector evidence', sections: [{ label: 'Completeness', status: 'Complete selected window', detail: 'The inspector follows raw-page cursors until the selected time range is exhausted. No silent row cap is used.' }, { label: 'Damage contract', status: 'Canonical rows only in summaries', detail: 'Summary damage uses the same verified canonical damage flag as the main engine. The raw table also shows non-damage rows for context.' }] }));
    });
  });
}
