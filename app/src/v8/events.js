import {
  EVENT_PAGE_SIZE,
  activeView,
  compact,
  copyText,
  currentScope,
  esc,
  icon,
  integer,
  playerSelect,
  root,
  timeLabel,
  workerRequest
} from './core.js';

const MAX_RESULTS = 250;
const MAX_SCANNED = 50000;
let searchToken = 0;
let scheduled = 0;

function playerOptions() {
  return ['<option value="">All owners</option>', ...Array.from(playerSelect?.options || []).filter(option => option.value).map(option => `<option value="${esc(option.value)}">${esc(option.textContent.trim())}</option>`)].join('');
}

function finderMarkup() {
  return `<section class="panel qol-event-finder" data-qol-event-finder>
    <div class="panel-head"><div><span class="eyebrow">Find an event</span><h2>Search verified log events</h2></div><span>Up to ${integer(MAX_RESULTS)} matches</span></div>
    <form class="qol-event-finder-form" data-qol-event-form>
      <label class="field"><span>Owner</span><select name="owner">${playerOptions()}</select></label>
      <label class="field"><span>Event type</span><select name="kind"><option value="">All event types</option><option value="damage">Damage</option><option value="healing">Healing</option><option value="shield">Shield</option><option value="resource">Resource</option><option value="control">Control</option><option value="immune">Immune</option><option value="unknown">Unknown</option></select></label>
      <label class="field"><span>Power contains</span><input name="power" type="search" placeholder="e.g. Storm Conduit" autocomplete="off"></label>
      <label class="field"><span>Target contains</span><input name="target" type="search" placeholder="Boss or target name" autocomplete="off"></label>
      <label class="field"><span>From (seconds)</span><input name="start" type="number" min="0" step="0.1" inputmode="decimal"></label>
      <label class="field"><span>To (seconds)</span><input name="end" type="number" min="0" step="0.1" inputmode="decimal"></label>
      <label class="field"><span>Minimum amount</span><input name="minimum" type="number" min="0" step="1" inputmode="numeric"></label>
      <div class="qol-event-checks">
        <label class="qol-event-check"><input name="crit" type="checkbox"> Critical</label>
        <label class="qol-event-check"><input name="ca" type="checkbox"> Flank / CA</label>
        <label class="qol-event-check"><input name="immune" type="checkbox"> Immune only</label>
        <button class="button button-primary" type="submit">${icon('search')} Search events</button>
      </div>
    </form>
    <div class="qol-event-status" data-qol-event-status>Use one or more filters to search the verified compact event store.</div>
    <div class="qol-event-results" data-qol-event-results></div>
  </section>`;
}

function ensureFinder() {
  if (!root || activeView() !== 'events') return null;
  let finder = root.querySelector('[data-qol-event-finder]');
  if (finder) return finder;
  const firstPanel = root.querySelector(':scope > .panel');
  if (!firstPanel) return null;
  firstPanel.insertAdjacentHTML('beforebegin', finderMarkup());
  finder = root.querySelector('[data-qol-event-finder]');
  finder?.querySelector('[data-qol-event-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    runSearch(finder);
  });
  return finder;
}

function formFilters(finder) {
  const data = new FormData(finder.querySelector('form'));
  const numeric = name => {
    const value = String(data.get(name) || '').trim();
    return value === '' ? null : Number(value);
  };
  return {
    owner: String(data.get('owner') || ''),
    kind: String(data.get('kind') || ''),
    power: String(data.get('power') || '').trim().toLowerCase(),
    target: String(data.get('target') || '').trim().toLowerCase(),
    start: numeric('start'),
    end: numeric('end'),
    minimum: numeric('minimum'),
    crit: data.get('crit') === 'on',
    ca: data.get('ca') === 'on',
    immune: data.get('immune') === 'on'
  };
}

function matches(row, filters) {
  if (filters.power && !String(row.powerName || '').toLowerCase().includes(filters.power)) return false;
  if (filters.target && !`${row.targetName || ''} ${row.targetRef || ''}`.toLowerCase().includes(filters.target)) return false;
  if (filters.minimum != null && Math.abs(Number(row.amount) || 0) < filters.minimum) return false;
  const flags = String(row.flagsRaw || '').toLowerCase();
  if (filters.crit && !/(?:^|\|)critical(?:\||$)/i.test(flags)) return false;
  if (filters.ca && !/(?:flank|combatadvantage)/i.test(flags)) return false;
  if (filters.immune && row.kind !== 'immune' && !/(?:^|\|)immune(?:\||$)/i.test(flags)) return false;
  return true;
}

function eventCopy(row) {
  return [
    `Time: ${Number(row.time || 0).toFixed(2)}s`,
    `Owner: ${row.ownerName || row.ownerRef || '—'}`,
    `Target: ${row.targetName || row.targetRef || '—'}`,
    `Power: ${row.powerName || '—'}`,
    `Type: ${row.kind || '—'} / ${row.damageType || '—'}`,
    `Amount: ${row.amount}`,
    `Base: ${row.baseAmount}`,
    `Flags: ${row.flagsRaw || '—'}`,
    `Line: ${row.lineNo || '—'}`
  ].join('\n');
}

function rowMarkup(row) {
  const canOpenPower = row.kind === 'damage' && row.validDamage && row.powerName && row.ownerRef;
  return `<tr>
    <td>${esc(timeLabel(row.time))}<small style="display:block;color:var(--sg-text-muted)">${Number(row.time || 0).toFixed(2)}s</small></td>
    <td>${esc(row.ownerName || row.ownerRef || '—')}</td>
    <td>${esc(row.targetName || row.targetRef || '—')}</td>
    <td>${canOpenPower ? `<button class="qol-event-power" type="button" data-power-popup-trigger="${esc(row.powerName)}" data-power-popup-player="${esc(row.ownerRef)}">${esc(row.powerName)}</button>` : esc(row.powerName || '—')}</td>
    <td>${esc(row.kind || '—')}</td>
    <td>${esc(row.damageType || '—')}</td>
    <td class="num">${esc(String(row.amount ?? '—'))}</td>
    <td>${esc(row.flagsRaw || '—')}</td>
    <td><button class="qol-icon-button" type="button" data-qol-copy-event aria-label="Copy this event" title="Copy event">${icon('copy')}</button></td>
  </tr>`;
}

function renderResults(finder, rows, scanned, complete) {
  const host = finder.querySelector('[data-qol-event-results]');
  const status = finder.querySelector('[data-qol-event-status]');
  if (status) status.textContent = rows.length
    ? `${integer(rows.length)} match${rows.length === 1 ? '' : 'es'} shown · ${integer(scanned)} rows scanned${complete ? ' · search complete' : ' · scan limit reached; narrow the filters for later rows'}`
    : `No matches in ${integer(scanned)} scanned rows${complete ? '.' : '; narrow the filters to search later rows.'}`;
  if (!host) return;
  host.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Owner</th><th>Target</th><th>Power</th><th>Event</th><th>Damage type</th><th class="num">Amount</th><th>Flags</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${rows.map(rowMarkup).join('')}</tbody></table></div>` : '<div class="empty-block">No matching verified events found.</div>';
  host.querySelectorAll('[data-qol-copy-event]').forEach((button, index) => button.addEventListener('click', () => copyText(eventCopy(rows[index]))));
  window.dispatchEvent(new CustomEvent('strikeglass:qol-power-triggers'));
}

async function runSearch(finder) {
  if (!finder?.isConnected) return;
  const filters = formFilters(finder);
  const localToken = ++searchToken;
  const status = finder.querySelector('[data-qol-event-status]');
  const results = finder.querySelector('[data-qol-event-results]');
  if (status) status.textContent = 'Searching verified events…';
  if (results) results.innerHTML = '';
  let cursor = null;
  let scanned = 0;
  const matchesRows = [];
  let complete = false;
  try {
    do {
      const page = await workerRequest('raw-page', { options: {
        cursor,
        limit: EVENT_PAGE_SIZE,
        playerRef: filters.owner,
        kind: filters.immune ? 'immune' : filters.kind,
        start: filters.start,
        end: filters.end,
        scope: currentScope()
      }}, 45000);
      if (localToken !== searchToken || !finder.isConnected) return;
      if (page?.verification?.status !== 'verified') throw new Error('Events are waiting for the second accuracy check.');
      const pageRows = page.rows || [];
      scanned += pageRows.length;
      for (const row of pageRows) {
        if (matches(row, filters)) matchesRows.push(row);
        if (matchesRows.length >= MAX_RESULTS) break;
      }
      cursor = page.nextCursor;
      complete = cursor == null;
      if (status) status.textContent = `Searching… ${integer(scanned)} rows scanned · ${integer(matchesRows.length)} matches`;
      if (matchesRows.length >= MAX_RESULTS || scanned >= MAX_SCANNED) break;
      await new Promise(resolve => setTimeout(resolve, 0));
    } while (cursor != null);
    renderResults(finder, matchesRows, scanned, complete);
  } catch (error) {
    if (localToken !== searchToken || !finder.isConnected) return;
    if (status) status.textContent = error.message || String(error);
    if (results) results.innerHTML = '<div class="empty-block bad-text">Could not search the verified event store.</div>';
  }
}

function schedule() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => { scheduled = 0; ensureFinder(); });
}

new MutationObserver(schedule).observe(root || document.body, { childList: true, subtree: false });
document.getElementById('app-nav')?.addEventListener('click', schedule);
schedule();
