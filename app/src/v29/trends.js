import { compact, currentPlayerRef, esc, optionScope, pct, scopeSelect, verifiedReport } from '../v8/core.js';
import { fingerprintVector } from './analysis-model.js';
import { openInvestigation } from './composition-shell.js';

function sparkline(values, label) {
  if (!values.length) return '';
  const width = 520;
  const height = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : index / (values.length - 1) * width;
    const y = height - ((value - min) / range * (height - 12) + 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="sg-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><polyline points="${points}" vector-effect="non-scaling-stroke"/><text x="4" y="14">max ${esc(max.toFixed(1))}</text><text x="4" y="114">min ${esc(min.toFixed(1))}</text></svg>`;
}

export function openTrends() {
  return openInvestigation('trends', 'Longitudinal Trends', async host => {
    const options = Array.from(scopeSelect?.options || []).filter(option => option.value !== 'session');
    const playerRef = currentPlayerRef();
    const rows = [];
    host.innerHTML = `<section class="sg-investigation-head"><span class="eyebrow">Longitudinal analysis</span><h2 tabindex="-1">Track the selected player across every detected fight</h2><p>Trends are kept inside this combat log. No report is uploaded or combined with another user's data.</p><div class="sg-investigation-progress" data-sg-progress>0 / ${options.length} fights loaded</div></section><div data-sg-trend-results></div>`;
    for (let index = 0; index < options.length; index += 1) {
      const report = await verifiedReport(optionScope(options[index]));
      const player = report.players?.find(item => item.ref === playerRef);
      if (player) rows.push({ option: options[index], report, player, vector: fingerprintVector(player, report) });
      host.querySelector('[data-sg-progress]').textContent = `${index + 1} / ${options.length} fights loaded`;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const result = host.querySelector('[data-sg-trend-results]');
    if (!rows.length) {
      result.innerHTML = '<section class="panel"><p>No comparable fights contain the selected player.</p></section>';
      return;
    }
    result.innerHTML = `<section class="section-grid sg-trend-grid"><article class="panel"><div class="panel-head"><h3>Combat DPS</h3><span>${rows.length} fights</span></div>${sparkline(rows.map(row => Number(row.player.combatDps) || 0), 'Combat DPS across detected fights')}</article><article class="panel"><div class="panel-head"><h3>Active-time ratio</h3><span>Percent</span></div>${sparkline(rows.map(row => row.vector.activeRatio * 100), 'Active-time ratio across detected fights')}</article><article class="panel"><div class="panel-head"><h3>Party damage share</h3><span>Percent</span></div>${sparkline(rows.map(row => Number(row.player.damageShare) || 0), 'Party damage share across detected fights')}</article><article class="panel"><div class="panel-head"><h3>Top-three power concentration</h3><span>Percent</span></div>${sparkline(rows.map(row => row.vector.powerConcentration * 100), 'Top-three power concentration across detected fights')}</article></section><section class="panel"><div class="panel-head"><div><h3>${esc(rows[0].player.name)}</h3><span>Full longitudinal table</span></div><span>${rows.length} fights</span></div><div class="table-wrap"><table><thead><tr><th>Fight</th><th class="num">Damage</th><th class="num">DPS</th><th class="num">Combat DPS</th><th class="num">Active</th><th class="num">Share</th><th class="num">Crit</th><th class="num">CA</th><th class="num">Companion</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.option.textContent?.trim() || row.option.value)}</td><td class="num">${compact(row.player.damage)}</td><td class="num">${compact(row.player.dps)}</td><td class="num">${compact(row.player.combatDps)}</td><td class="num">${pct(row.vector.activeRatio * 100)}</td><td class="num">${pct(row.player.damageShare)}</td><td class="num">${pct(row.player.crit)}</td><td class="num">${pct(row.player.flank)}</td><td class="num">${pct(row.vector.companionShare * 100)}</td></tr>`).join('')}</tbody></table></div></section>`;
  });
}
