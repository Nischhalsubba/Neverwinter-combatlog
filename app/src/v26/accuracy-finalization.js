import {
  EVENT_PAGE_SIZE,
  activeView,
  compact,
  currentPlayerRef,
  currentScope,
  downloadText,
  esc,
  playerSelect,
  root,
  scopeSelect,
  verifiedReport,
  workerRequest
} from '../v8/core.js';
import { independentCategoryEvidence } from '../engine/classification-evidence.js';
import { auditSupportEffectProvenance, supportEffectProvenance } from '../engine/support-effect-provenance.js';

const STYLE_ATTR = 'data-accuracy-finalization-style';
let scheduled = 0;
let generation = 0;
const exclusionCache = new Map();
const provenanceAudit = auditSupportEffectProvenance();

function ensureStyle() {
  if (document.querySelector(`link[${STYLE_ATTR}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./accuracy-finalization.css', import.meta.url).href;
  link.setAttribute(STYLE_ATTR, 'true');
  document.head.append(link);
}

function scopeKey(scope = currentScope()) {
  if (!scope || scope.type === 'session') return 'session';
  return `${scope.type}:${Number(scope.id)}:${scope.targetOnly ? 'target' : 'window'}`;
}

function player(report) {
  const ref = currentPlayerRef();
  return report?.players?.find(item => item.ref === ref) || report?.players?.[0] || null;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportRows(filename, headers, rows) {
  const text = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  downloadText(filename, text, 'text/csv;charset=utf-8');
}

function physicalKey(row, tick) {
  return `${String(row.ownerRef || '')}|${String(row.targetRef || '')}|${String(row.powerName || '')}|${tick}`;
}

function positiveNonPhysical(row) {
  return /^P\[/.test(String(row.ownerRef || '')) && Number(row.amount) > 0 && String(row.damageType || '').trim().toLowerCase() !== 'physical';
}

function excludedKind(row) {
  if (row.kind === 'damage') return 'Known non-Physical damage event';
  if (row.kind === 'unknown') return 'Novel positive event pattern';
  return 'Known non-damage event';
}

async function excludedPositiveAudit(scope, onProgress = null) {
  const key = scopeKey(scope);
  if (exclusionCache.has(key)) return exclusionCache.get(key);
  const promise = (async () => {
    const physical = new Set();
    const excluded = [];
    let cursor = null;
    let scanned = 0;
    let storedRows = 0;
    do {
      const page = await workerRequest('raw-page', { options: { cursor, limit: EVENT_PAGE_SIZE, scope } }, 45000);
      if (page?.verification?.status !== 'verified') throw new Error('Excluded-event audit is waiting for the independent arithmetic check.');
      const rows = page.rows || [];
      storedRows = Number(page.totalStoredRows) || storedRows;
      for (const row of rows) {
        scanned += 1;
        const tick = Math.round((Number(row.time) || 0) * 20);
        if (row.validDamage && Number(row.amount) > 0 && String(row.damageType || '').trim().toLowerCase() === 'physical') {
          physical.add(physicalKey(row, tick));
          continue;
        }
        if (positiveNonPhysical(row)) excluded.push({
          damageType: String(row.damageType || 'Unknown'),
          kind: excludedKind(row),
          ownerName: String(row.ownerName || row.ownerRef || 'Unknown'),
          ownerRef: String(row.ownerRef || ''),
          targetName: String(row.targetName || row.targetRef || 'Unknown'),
          targetRef: String(row.targetRef || ''),
          powerName: String(row.powerName || 'Unknown'),
          powerRef: String(row.powerRef || ''),
          amount: Number(row.amount) || 0,
          baseAmount: Number(row.baseAmount) || 0,
          time: Number(row.time) || 0,
          lineNo: Number(row.lineNo) || 0,
          tick
        });
      }
      cursor = page.nextCursor;
      onProgress?.({ scanned, total: storedRows, complete: cursor == null });
      if (cursor != null) await new Promise(resolve => setTimeout(resolve, 0));
    } while (cursor != null);

    const groups = new Map();
    let matchedPhysical = 0;
    let novel = 0;
    for (const row of excluded) {
      const hasPhysical = [-1, 0, 1].some(offset => physical.has(physicalKey(row, row.tick + offset)));
      if (hasPhysical) matchedPhysical += 1;
      if (row.kind === 'Novel positive event pattern') novel += 1;
      const groupKey = `${row.damageType}|${row.powerName}|${row.kind}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = {
          damageType: row.damageType,
          powerName: row.powerName,
          powerRef: row.powerRef,
          classification: row.kind,
          rows: 0,
          amount: 0,
          baseAmountRows: 0,
          matchingPhysicalRows: 0,
          owners: new Set(),
          targets: new Set(),
          sampleLines: []
        };
        groups.set(groupKey, group);
      }
      group.rows += 1;
      group.amount += row.amount;
      if (Math.abs(row.baseAmount) > 0) group.baseAmountRows += 1;
      if (hasPhysical) group.matchingPhysicalRows += 1;
      group.owners.add(row.ownerName);
      group.targets.add(row.targetName);
      if (group.sampleLines.length < 4) group.sampleLines.push(row.lineNo);
    }
    const summaries = [...groups.values()].map(item => ({
      ...item,
      owners: [...item.owners],
      targets: [...item.targets]
    })).sort((a, b) => b.rows - a.rows || b.amount - a.amount || a.powerName.localeCompare(b.powerName));
    return {
      scanned,
      complete: true,
      physicalRowsIndexed: physical.size,
      excludedRows: excluded.length,
      matchedPhysical,
      novel,
      groups: summaries
    };
  })().catch(error => { exclusionCache.delete(key); throw error; });
  exclusionCache.set(key, promise);
  return promise;
}

async function ensureExcludedAudit(localGeneration) {
  if (activeView() !== 'diagnostics' || root.querySelector('[data-sg-excluded-audit]')) return;
  const panel = document.createElement('section');
  panel.className = 'panel sg-final-audit';
  panel.dataset.sgExcludedAudit = 'true';
  panel.innerHTML = '<div class="sg-final-loading"><strong>Auditing every positive non-Physical player event…</strong><span data-sg-exclusion-progress>Starting verified row scan</span><i><b data-sg-exclusion-bar></b></i></div>';
  root.prepend(panel);
  try {
    const result = await excludedPositiveAudit(currentScope(), progress => {
      if (!panel.isConnected) return;
      const ratio = progress.total ? Math.min(1, progress.scanned / progress.total) : 0;
      const label = panel.querySelector('[data-sg-exclusion-progress]');
      const bar = panel.querySelector('[data-sg-exclusion-bar]');
      if (label) label.textContent = `${progress.scanned.toLocaleString()} verified rows inspected${progress.total ? ` of approximately ${progress.total.toLocaleString()}` : ''}`;
      if (bar) bar.style.setProperty('--sg-final-progress', String(ratio));
    });
    if (localGeneration !== generation || !panel.isConnected || activeView() !== 'diagnostics') return;
    panel.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">Excluded event audit</span><h2>What Strikeglass deliberately did not count as damage</h2></div><div class="sg-final-head-actions"><span class="good-text">Complete verified scan</span><button type="button" class="button" data-sg-export-excluded>Export CSV</button></div></div>
      <div class="sg-final-summary-grid">
        <article><span>Rows inspected</span><strong>${result.scanned.toLocaleString()}</strong><small>Complete selected scope</small></article>
        <article><span>Positive non-Physical rows</span><strong>${result.excludedRows.toLocaleString()}</strong><small>Excluded from canonical damage</small></article>
        <article><span>Near matching Physical rows</span><strong>${result.matchedPhysical.toLocaleString()}</strong><small>Same owner, power, target and ±50ms tick</small></article>
        <article><span>Novel positive patterns</span><strong class="${result.novel ? 'warn-text' : 'good-text'}">${result.novel.toLocaleString()}</strong><small>${result.novel ? 'Review before changing parser rules' : 'No unknown positive event shape detected'}</small></article>
      </div>
      <p class="sg-final-help">This audit does <strong>not</strong> add these values to player damage. It exists to prove what was excluded and to make new Neverwinter event shapes visible before anyone changes the canonical Physical-only contract.</p>
      <div class="sg-final-table-wrap"><table><thead><tr><th>Type</th><th>Power</th><th>Interpretation</th><th class="num">Rows</th><th class="num">Positive value</th><th class="num">Base value rows</th><th class="num">Matching Physical</th><th>Owners / targets</th></tr></thead><tbody>${result.groups.slice(0, 100).map(item => `<tr><td>${esc(item.damageType)}</td><td><strong>${esc(item.powerName)}</strong><small>${esc(item.powerRef || 'No power reference')}</small></td><td>${esc(item.classification)}</td><td class="num">${item.rows.toLocaleString()}</td><td class="num">${compact(item.amount)}</td><td class="num">${item.baseAmountRows.toLocaleString()}</td><td class="num">${item.matchingPhysicalRows.toLocaleString()}</td><td><small>${esc(item.owners.slice(0, 3).join(', ') || '—')} → ${esc(item.targets.slice(0, 3).join(', ') || '—')}</small></td></tr>`).join('')}</tbody></table></div>`;
    panel.querySelector('[data-sg-export-excluded]')?.addEventListener('click', () => exportRows('strikeglass-excluded-positive-events.csv', ['damage_type','power','power_ref','classification','rows','positive_value','base_value_rows','matching_physical_rows','owners','targets','sample_lines'], result.groups.map(item => [item.damageType,item.powerName,item.powerRef,item.classification,item.rows,item.amount,item.baseAmountRows,item.matchingPhysicalRows,item.owners.join(' | '),item.targets.join(' | '),item.sampleLines.join(' | ')])));
  } catch (error) {
    if (panel.isConnected) panel.innerHTML = `<div class="sg-final-error">${esc(error.message || String(error))}</div>`;
  }
}

function taxonomySuggestion(power) {
  const evidence = independentCategoryEvidence(power);
  if (evidence) return { category: evidence.expected, evidence: evidence.reason, strength: 'Independent reference' };
  const ref = String(power.powerRef || '').toLowerCase();
  if (/combat_power_mount|mount/.test(ref)) return { category: 'Mount', evidence: 'Power reference contains a mount identifier.', strength: 'Reference hint' };
  if (/artifact|sigil_of_|storyteller|journal/.test(ref)) return { category: 'Artifact', evidence: 'Power reference contains an artifact identifier.', strength: 'Reference hint' };
  if (/belt|potion|consumable|enchant/.test(ref)) return { category: 'Item / Enchant', evidence: 'Power reference contains an item/consumable identifier.', strength: 'Reference hint' };
  return { category: 'Needs source', evidence: 'No independent reference evidence currently identifies this power safely.', strength: 'Unresolved' };
}

async function ensureUnclassifiedReport(localGeneration) {
  if (activeView() !== 'powers' || root.querySelector('[data-sg-unclassified-report]')) return;
  try {
    const report = await verifiedReport(currentScope());
    if (localGeneration !== generation || activeView() !== 'powers' || root.querySelector('[data-sg-unclassified-report]')) return;
    const selected = player(report);
    if (!selected) return;
    const powers = selected.powers || [];
    const totalDamage = Math.max(1, Number(selected.damage) || 0);
    const unknown = powers.filter(item => String(item.category || '') === 'Other / Unknown').map(item => ({
      ...item,
      suggestion: taxonomySuggestion(item),
      shareOfPlayer: (Number(item.damage) || 0) / totalDamage * 100
    })).sort((a, b) => Number(b.damage) - Number(a.damage));
    const unknownDamage = unknown.reduce((sum, item) => sum + (Number(item.damage) || 0), 0);
    const coverage = Math.max(0, 100 - unknownDamage / totalDamage * 100);
    const panel = document.createElement('section');
    panel.className = 'panel sg-final-audit';
    panel.dataset.sgUnclassifiedReport = 'true';
    panel.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">Unclassified power report</span><h2>${esc(selected.name)} · classification coverage ${coverage.toFixed(1)}%</h2></div><div class="sg-final-head-actions"><span class="${coverage >= 95 ? 'good-text' : 'warn-text'}">${unknown.length ? `${unknown.length} need evidence` : 'All damaging powers classified'}</span>${unknown.length ? '<button type="button" class="button" data-sg-export-taxonomy>Export CSV</button>' : ''}</div></div>
      <p class="sg-final-help">Strikeglass does not auto-promote a power from <strong>Other / Unknown</strong> just because a name looks familiar. Independent references can justify a category; weaker power-reference hints are shown for review and remain inferred until confirmed.</p>
      ${unknown.length ? `<div class="sg-final-table-wrap"><table><thead><tr><th>Power</th><th class="num">Damage</th><th class="num">Share</th><th class="num">Hits</th><th>Power ref</th><th>Suggested category</th><th>Evidence</th></tr></thead><tbody>${unknown.map(item => `<tr><td><strong>${esc(item.power || 'Unknown')}</strong></td><td class="num">${compact(item.damage)}</td><td class="num">${item.shareOfPlayer.toFixed(2)}%</td><td class="num">${Number(item.hits || 0).toLocaleString()}</td><td><code>${esc(item.powerRef || '—')}</code></td><td><strong>${esc(item.suggestion.category)}</strong><small>${esc(item.suggestion.strength)}</small></td><td>${esc(item.suggestion.evidence)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-block good-text">No unresolved damaging powers in this scope.</div>'}`;
    const anchor = root.querySelector('[data-sg-taxonomy-audit]');
    if (anchor) anchor.insertAdjacentElement('afterend', panel); else root.prepend(panel);
    panel.querySelector('[data-sg-export-taxonomy]')?.addEventListener('click', () => exportRows('strikeglass-unclassified-powers.csv', ['player','power','damage','share_percent','hits','power_ref','suggested_category','evidence_strength','evidence'], unknown.map(item => [selected.name,item.power,item.damage,item.shareOfPlayer,item.hits,item.powerRef,item.suggestion.category,item.suggestion.strength,item.suggestion.evidence])));
  } catch {}
}

async function ensureSupportProvenance(localGeneration) {
  if (activeView() !== 'debuffs' || root.querySelector('[data-sg-support-provenance]')) return;
  const panel = document.createElement('section');
  panel.className = 'panel sg-final-audit';
  panel.dataset.sgSupportProvenance = 'true';
  panel.innerHTML = '<div class="sg-final-loading"><strong>Checking support-effect source provenance…</strong><span>Reading the reviewed support catalog and observed effects.</span></div>';
  const anchor = root.querySelector('[data-sg-effect-coverage]') || root.querySelector('[data-sg-effect-evidence-legend]');
  if (anchor) anchor.insertAdjacentElement('afterend', panel); else root.prepend(panel);
  try {
    const effects = await workerRequest('effect-intelligence-report', { scope: currentScope() }, 90000);
    if (localGeneration !== generation || !panel.isConnected || activeView() !== 'debuffs') return;
    const observedNames = [...new Set((effects?.effects || []).map(item => item.name).filter(Boolean))];
    const rows = observedNames.map(name => supportEffectProvenance(name)).filter(Boolean);
    const missing = observedNames.filter(name => !supportEffectProvenance(name));
    panel.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">Mechanic provenance</span><h2>Where these debuff definitions came from</h2></div><span>${rows.length} sourced · ${missing.length} unresolved</span></div>
      <div class="sg-final-summary-grid">
        <article><span>Catalog effects</span><strong>${provenanceAudit.total}</strong><small>Reviewed support definitions</small></article>
        <article><span>Current source + date</span><strong>${provenanceAudit.current}</strong><small>Source carries a review/update date</small></article>
        <article><span>Catalog needs review</span><strong class="${provenanceAudit.needsReview ? 'warn-text' : 'good-text'}">${provenanceAudit.needsReview}</strong><small>Missing source or source date</small></article>
        <article><span>Reference snapshot</span><strong>${esc(provenanceAudit.snapshot.snapshotDate)}</strong><small>Strikeglass reviewed ${esc(provenanceAudit.snapshot.reviewedAt)}</small></article>
      </div>
      <div class="sg-final-table-wrap"><table><thead><tr><th>Observed effect</th><th>Status</th><th>Source</th><th>Source updated</th><th>Effective from</th><th>Reviewed</th><th>Reference snapshot</th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td class="${item.status === 'reviewed-source' ? 'good-text' : 'warn-text'}">${esc(item.status.replace(/-/g, ' '))}</td><td>${esc(item.sourceLabel || 'No source')}</td><td>${esc(item.sourceUpdated || '—')}</td><td>${esc(item.effectiveFrom || '—')}</td><td>${esc(item.strikeglassReviewedAt)}</td><td>${esc(item.gameDataSnapshot)}</td></tr>`).join('')}${missing.map(name => `<tr><td><strong>${esc(name)}</strong></td><td class="warn-text">not in reviewed catalog</td><td colspan="5">Mechanic stays unresolved until a reviewed source is added.</td></tr>`).join('')}</tbody></table></div>
      <p class="sg-final-help">A dated source proves what definition Strikeglass reviewed; it does not prove the game can never change. Effects without a current reviewed source remain visibly unresolved instead of inheriting confidence from a similarly named mechanic.</p>`;
  } catch (error) {
    if (panel.isConnected) panel.innerHTML = `<div class="sg-final-error">${esc(error.message || String(error))}</div>`;
  }
}

async function scan() {
  ensureStyle();
  const localGeneration = ++generation;
  await Promise.allSettled([
    ensureExcludedAudit(localGeneration),
    ensureUnclassifiedReport(localGeneration),
    ensureSupportProvenance(localGeneration)
  ]);
}

function schedule(delay = 20) {
  clearTimeout(scheduled);
  scheduled = setTimeout(() => requestAnimationFrame(scan), delay);
}

document.addEventListener('strikeglass:view-rendered', () => schedule());
document.addEventListener('strikeglass:analysis-ready', () => schedule());
scopeSelect?.addEventListener('change', () => schedule());
playerSelect?.addEventListener('change', () => schedule());
window.addEventListener('strikeglass:worker-ready', () => { exclusionCache.clear(); schedule(); });

ensureStyle();
schedule(0);
