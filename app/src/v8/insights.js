import {
  activeView,
  compact,
  currentScope,
  duration,
  esc,
  navigate,
  pct,
  root,
  verifiedBossEffects,
  verifiedReport
} from './core.js';

let token = 0;
let scheduled = 0;

function card(label, value, detail, action = '', actionLabel = 'View details') {
  return `<article class="qol-insight"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(detail)}</small>${action ? `<button type="button" data-qol-insight-action="${esc(action)}">${esc(actionLabel)}</button>` : ''}</article>`;
}

function topHit(report) {
  let best = null;
  for (const player of report.players || []) {
    if (!best || Number(player.maxHit || 0) > Number(best.maxHit || 0)) best = player;
  }
  return best;
}

function mostActive(report) {
  return [...(report.players || [])].sort((a, b) => Number(b.combatTime || 0) - Number(a.combatTime || 0))[0] || null;
}

function companionShare(report) {
  const total = (report.players || []).reduce((sum, player) => sum + Number(player.companionDamage || 0), 0);
  return report.damage ? total / report.damage * 100 : 0;
}

function ensureInsightsHost() {
  if (!root || !['overview','boss'].includes(activeView())) return null;
  let host = root.querySelector('[data-qol-matters]');
  if (host) return host;
  const verification = root.querySelector(':scope > .verification-strip');
  if (!verification) return null;
  host = document.createElement('section');
  host.className = 'panel qol-matters';
  host.dataset.qolMatters = 'true';
  host.innerHTML = '<div class="panel-head"><div><span class="eyebrow">Verified observations</span><h2>What mattered in this fight?</h2></div><span>Calculated from checked results</span></div><div class="qol-insights" data-qol-insights><article class="qol-insight"><span>Loading</span><strong>—</strong><small>Reading verified results.</small></article></div>';
  verification.insertAdjacentElement('afterend', host);
  return host;
}

function bindInsightActions(host) {
  host?.querySelectorAll('[data-qol-insight-action]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.qolInsightAction)));
}

async function renderInsights(localToken) {
  const host = ensureInsightsHost();
  if (!host) return;
  try {
    const scope = currentScope();
    const report = await verifiedReport(scope);
    if (localToken !== token || !host.isConnected || !['overview','boss'].includes(activeView())) return;
    const leader = report.players?.[0] || null;
    const biggest = topHit(report);
    const active = mostActive(report);
    const cards = [
      card('Top damage', leader ? esc(leader.name) : '—', leader ? `${compact(leader.damage)} · ${pct(leader.damageShare)} of group` : 'No player damage.', 'players'),
      card('Biggest hit', biggest ? compact(biggest.maxHit) : '—', biggest ? `${biggest.name} · ${biggest.maxPower || 'Unknown power'}` : 'No counted hit.', 'powers'),
      card('Most active', active ? esc(active.name) : '—', active ? `${duration(active.combatTime)} active fighting` : 'No active player.', 'players'),
      card('Companion share', pct(companionShare(report)), 'Share of group damage attributed to companions.', 'powers')
    ];
    host.querySelector('[data-qol-insights]').innerHTML = cards.join('');
    bindInsightActions(host);
  } catch (error) {
    if (localToken !== token || !host.isConnected) return;
    host.querySelector('[data-qol-insights]').innerHTML = `<article class="qol-insight"><span>Observations unavailable</span><strong>—</strong><small>${esc(error.message || String(error))}</small></article>`;
  }
}

function debuffLine(effect) {
  if (effect.audience === 'team') return `<div><strong>${esc(effect.name)}</strong><span>${pct(effect.uptime)} uptime · ${effect.applications} application${effect.applications === 1 ? '' : 's'}</span></div>`;
  return `<div><strong>${esc(effect.name)}</strong><span>${effect.applications} application${effect.applications === 1 ? '' : 's'} · ${effect.sources?.length || 0} source${effect.sources?.length === 1 ? '' : 's'}</span></div>`;
}

async function ensureBossDebuffSummary(localToken) {
  if (!root || activeView() !== 'boss') return;
  const scope = currentScope();
  if (scope.type !== 'boss') return;
  const existing = root.querySelector('[data-qol-boss-debuffs]');
  if (existing) return;
  const grid = root.querySelector('.boss-grid');
  if (!grid) return;
  const panel = document.createElement('section');
  panel.className = 'panel qol-boss-debuff-summary';
  panel.dataset.qolBossDebuffs = 'true';
  panel.innerHTML = '<div class="panel-head"><div><span class="eyebrow">Boss effects</span><h2>Debuff uptime</h2></div><span>Checking…</span></div><div class="qol-debuff-lines"><div><strong>Loading</strong><span>Reading verified boss events.</span></div></div>';
  grid.insertAdjacentElement('beforebegin', panel);
  try {
    const result = await verifiedBossEffects(scope.id);
    if (localToken !== token || !panel.isConnected || activeView() !== 'boss') return;
    const effects = result.effects || [];
    panel.querySelector('.panel-head > span').textContent = `${effects.length} timed`;
    panel.querySelector('.qol-debuff-lines').innerHTML = effects.length
      ? `${effects.slice(0, 4).map(debuffLine).join('')}<button class="qol-action-button" type="button" data-qol-view-debuffs>View all debuffs</button>`
      : '<div><strong>No timed debuffs</strong><span>No recognized timed boss effects were found in this fight.</span></div>';
    panel.querySelector('[data-qol-view-debuffs]')?.addEventListener('click', () => navigate('debuffs'));
  } catch (error) {
    if (localToken !== token || !panel.isConnected) return;
    panel.querySelector('.qol-debuff-lines').innerHTML = `<div><strong>Could not show debuffs</strong><span>${esc(error.message || String(error))}</span></div>`;
  }
}

function schedule() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    token += 1;
    const localToken = token;
    renderInsights(localToken);
    ensureBossDebuffSummary(localToken);
  });
}

new MutationObserver(schedule).observe(root || document.body, { childList: true, subtree: false });
document.getElementById('encounter-select')?.addEventListener('change', schedule);
document.getElementById('app-nav')?.addEventListener('click', schedule);
schedule();
