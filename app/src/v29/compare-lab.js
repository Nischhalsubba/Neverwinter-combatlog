import { compact, currentPlayerRef, currentScope, esc, pct, verifiedReport } from '../v8/core.js';
import { fingerprintVector, percentile } from './analysis-model.js';
import { openInvestigation } from './composition-shell.js';

function median(values) { return percentile(values, 0.5); }
function delta(value, baseline) {
  const amount = Number(value) - Number(baseline);
  if (!Number.isFinite(amount)) return '—';
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(1)}`;
}

export function openCompareLab() {
  return openInvestigation('compare-lab', 'Compare 2.0', async host => {
    const report = await verifiedReport(currentScope());
    const players = report.players || [];
    const selected = currentPlayerRef();
    const activeRatios = players.map(player => fingerprintVector(player, report).activeRatio * 100);
    const dpsMedian = median(players.map(player => player.dps));
    const combatMedian = median(players.map(player => player.combatDps));
    const activeMedian = median(activeRatios);
    host.innerHTML = `<section class="sg-investigation-head"><span class="eyebrow">Compare 2.0</span><h2 tabindex="-1">Compare players on the same scope without hiding context</h2><p>Raw values stay visible while delta columns show distance from the scoped party median. Active-time and damage-mix context reduce the temptation to treat one DPS number as the whole story.</p></section><section class="panel"><div class="panel-head"><div><h3>${esc(report.scope?.label || 'Current scope')}</h3><span>Median-relative context</span></div><span>${players.length} players</span></div><div class="table-wrap"><table class="sg-compare-lab"><thead><tr><th>Player</th><th class="num">Damage</th><th class="num">Share</th><th class="num">DPS</th><th class="num">Δ DPS</th><th class="num">Combat DPS</th><th class="num">Δ Combat</th><th class="num">Active</th><th class="num">Δ Active</th><th class="num">Crit</th><th class="num">CA</th><th class="num">Companion</th><th class="num">Top-3 powers</th></tr></thead><tbody>${players.map(player => {
      const vector = fingerprintVector(player, report);
      return `<tr class="${player.ref === selected ? 'is-selected' : ''}"><td><strong>${esc(player.name)}</strong><small>${esc(player.className || 'Unknown')}</small></td><td class="num">${compact(player.damage)}</td><td class="num">${pct(player.damageShare)}</td><td class="num">${compact(player.dps)}</td><td class="num">${delta(player.dps, dpsMedian)}</td><td class="num">${compact(player.combatDps)}</td><td class="num">${delta(player.combatDps, combatMedian)}</td><td class="num">${pct(vector.activeRatio * 100)}</td><td class="num">${delta(vector.activeRatio * 100, activeMedian)} pp</td><td class="num">${pct(player.crit)}</td><td class="num">${pct(player.flank)}</td><td class="num">${pct(vector.companionShare * 100)}</td><td class="num">${pct(vector.powerConcentration * 100)}</td></tr>`;
    }).join('')}</tbody></table></div><div class="view-note">Deltas are descriptive differences from this scope's median. They are not grades and do not infer player intent, role obligations, encounter mechanics, or cooldown availability.</div></section>`;
  });
}
