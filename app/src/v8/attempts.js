import {
  bossAttempts,
  bossName,
  compact,
  duration,
  esc,
  pct,
  scopeSelect,
  verifiedBossEffects,
  verifiedReport
} from './core.js';

let dialog = null;
let backdrop = null;
let opener = null;
let compareToken = 0;

function close() {
  compareToken += 1;
  dialog?.remove();
  backdrop?.remove();
  dialog = null;
  backdrop = null;
  document.querySelector('.app-shell')?.removeAttribute('inert');
  opener?.focus?.({ preventScroll: true });
  opener = null;
}

function modal(name, attempts, current) {
  backdrop = document.createElement('div');
  backdrop.className = 'qol-modal-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  dialog = document.createElement('section');
  dialog.className = 'qol-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'qol-attempt-title');
  const selectedIndex = Math.max(0, attempts.findIndex(option => option.value === current?.value));
  const otherIndex = selectedIndex > 0 ? selectedIndex - 1 : Math.min(1, attempts.length - 1);
  const options = selected => attempts.map((option, index) => `<option value="${esc(option.value)}" ${index === selected ? 'selected' : ''}>${esc(option.textContent.trim())}</option>`).join('');
  dialog.innerHTML = `
    <header class="qol-modal-head">
      <div><span class="eyebrow">Boss attempts</span><h2 id="qol-attempt-title">Compare ${esc(name)}</h2><p>Both attempts use the same verified combat calculations and independently checked boss-effect uptime.</p></div>
      <button class="qol-icon-button" type="button" data-qol-attempt-close aria-label="Close attempt comparison">×</button>
    </header>
    <div class="qol-modal-body">
      <div class="qol-compare-grid">
        <label class="field"><span>Attempt A</span><select data-qol-attempt-a>${options(otherIndex)}</select></label>
        <label class="field"><span>Attempt B</span><select data-qol-attempt-b>${options(selectedIndex)}</select></label>
      </div>
      <div style="margin-top:10px"><button class="button button-primary" type="button" data-qol-run-attempt>Compare attempts</button></div>
      <div data-qol-attempt-result aria-live="polite" style="margin-top:14px"><div class="empty-block">Choose two attempts to compare.</div></div>
    </div>`;
  document.body.append(backdrop, dialog);
  document.querySelector('.app-shell')?.setAttribute('inert', '');
  backdrop.addEventListener('click', close);
  dialog.querySelector('[data-qol-attempt-close]')?.addEventListener('click', close);
  dialog.querySelector('[data-qol-run-attempt]')?.addEventListener('click', runComparison);
  requestAnimationFrame(() => dialog.querySelector('[data-qol-attempt-a]')?.focus({ preventScroll: true }));
}

function playerMap(report) {
  return new Map((report.players || []).map(player => [player.ref, player]));
}

function metricRows(report) {
  return [
    ['Duration', duration(report.duration)],
    ['Group damage', compact(report.damage)],
    ['Group DPS', compact(report.partyDps)],
    ['Group Active DPS', compact(report.partyCombatDps)],
    ['Hits', compact(report.hits)],
    ['Top player', report.players?.[0] ? `${report.players[0].name} · ${pct(report.players[0].damageShare)}` : '—']
  ];
}

function attemptCard(label, report) {
  return `<article class="qol-attempt-card"><header><span class="eyebrow">${esc(label)}</span><strong>${esc(report.scope?.label || label)}</strong></header><dl>${metricRows(report).map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></article>`;
}

function signedPercent(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function plainDelta(a, b) {
  const time = Number(a.duration || 0) - Number(b.duration || 0);
  const dps = Number(b.partyCombatDps || 0) - Number(a.partyCombatDps || 0);
  const timeText = Math.abs(time) < 0.05 ? 'The attempts took the same amount of time.' : `Attempt B was ${duration(Math.abs(time))} ${time > 0 ? 'faster' : 'slower'}.`;
  const dpsPct = a.partyCombatDps ? dps / a.partyCombatDps * 100 : 0;
  return `${timeText} Group Active DPS changed ${signedPercent(dpsPct)}.`;
}

function playerRows(a, b) {
  const left = playerMap(a);
  const right = playerMap(b);
  const refs = Array.from(new Set([...left.keys(), ...right.keys()]));
  return refs.map(ref => {
    const pa = left.get(ref);
    const pb = right.get(ref);
    const name = pb?.name || pa?.name || 'Player';
    const aDamage = Number(pa?.damage || 0);
    const bDamage = Number(pb?.damage || 0);
    const delta = aDamage ? (bDamage - aDamage) / aDamage * 100 : (bDamage ? 100 : 0);
    return `<tr><td><strong>${esc(name)}</strong></td><td class="num">${compact(aDamage)}</td><td class="num">${compact(bDamage)}</td><td class="num ${delta >= 0 ? 'qol-positive' : 'qol-negative'}">${signedPercent(delta)}</td><td class="num">${pct(pa?.damageShare || 0)}</td><td class="num">${pct(pb?.damageShare || 0)}</td></tr>`;
  }).join('');
}

function effectMap(result) {
  return new Map((result.effects || []).map(effect => [effect.id, effect]));
}

function effectRows(a, b) {
  const left = effectMap(a);
  const right = effectMap(b);
  const ids = Array.from(new Set([...left.keys(), ...right.keys()]));
  return ids.map(id => {
    const ea = left.get(id);
    const eb = right.get(id);
    const name = eb?.name || ea?.name || id;
    const va = ea?.audience === 'team' ? `${pct(ea.uptime)} uptime` : `${ea?.applications || 0} applications`;
    const vb = eb?.audience === 'team' ? `${pct(eb.uptime)} uptime` : `${eb?.applications || 0} applications`;
    return `<tr><td><strong>${esc(name)}</strong></td><td>${esc(va)}</td><td>${esc(vb)}</td></tr>`;
  }).join('');
}

async function runComparison() {
  if (!dialog) return;
  const aValue = dialog.querySelector('[data-qol-attempt-a]')?.value;
  const bValue = dialog.querySelector('[data-qol-attempt-b]')?.value;
  const result = dialog.querySelector('[data-qol-attempt-result]');
  if (!aValue || !bValue || !result) return;
  if (aValue === bValue) {
    result.innerHTML = '<div class="empty-block">Choose two different attempts.</div>';
    return;
  }
  const aId = Number(aValue.split(':')[1]);
  const bId = Number(bValue.split(':')[1]);
  const localToken = ++compareToken;
  result.innerHTML = '<div class="empty-block">Loading and double-checking both attempts…</div>';
  try {
    const [aReport, bReport, aEffects, bEffects] = await Promise.all([
      verifiedReport({ type: 'boss', id: aId, targetOnly: false }),
      verifiedReport({ type: 'boss', id: bId, targetOnly: false }),
      verifiedBossEffects(aId),
      verifiedBossEffects(bId)
    ]);
    if (localToken !== compareToken || !dialog?.isConnected) return;
    const aLabel = dialog.querySelector('[data-qol-attempt-a]')?.selectedOptions?.[0]?.textContent?.trim() || 'Attempt A';
    const bLabel = dialog.querySelector('[data-qol-attempt-b]')?.selectedOptions?.[0]?.textContent?.trim() || 'Attempt B';
    result.innerHTML = `
      <div class="qol-compare-grid">${attemptCard('Attempt A', aReport)}${attemptCard('Attempt B', bReport)}</div>
      <div class="qol-delta"><strong>What changed?</strong><br>${esc(plainDelta(aReport, bReport))}</div>
      <section class="qol-compare-table"><div class="panel-head"><div><span class="eyebrow">Players</span><h2>Damage comparison</h2></div><span>${esc(aLabel)} vs ${esc(bLabel)}</span></div><div class="table-wrap"><table><thead><tr><th>Player</th><th class="num">Attempt A damage</th><th class="num">Attempt B damage</th><th class="num">Change</th><th class="num">A share</th><th class="num">B share</th></tr></thead><tbody>${playerRows(aReport, bReport)}</tbody></table></div></section>
      <section class="qol-compare-table"><div class="panel-head"><div><span class="eyebrow">Boss effects</span><h2>Debuff comparison</h2></div><span>Independently checked</span></div><div class="table-wrap"><table><thead><tr><th>Effect</th><th>Attempt A</th><th>Attempt B</th></tr></thead><tbody>${effectRows(aEffects, bEffects) || '<tr><td colspan="3">No recognized timed effects.</td></tr>'}</tbody></table></div></section>`;
  } catch (error) {
    if (localToken === compareToken && result) result.innerHTML = `<div class="empty-block bad-text">${esc(error.message || String(error))}</div>`;
  }
}

function open() {
  const current = scopeSelect?.selectedOptions?.[0];
  const attempts = bossAttempts(current);
  if (!current || attempts.length < 2) return;
  opener = document.activeElement;
  modal(bossName(current) || 'boss', attempts, current);
  runComparison();
}

window.addEventListener('strikeglass:qol-attempt-compare', open);
document.addEventListener('keydown', event => {
  if (!dialog) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  }
});
