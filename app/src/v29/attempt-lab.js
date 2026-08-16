import { bossAttempts, bossName, compact, currentPlayerRef, duration, esc, optionScope, pct, scopeSelect, workerRequest, verifiedReport } from '../v8/core.js';
import { intervalSummary, intervalsByPower } from './analysis-model.js';
import { openInvestigation } from './composition-shell.js';

function chooseAttemptOptions() {
  const selected = scopeSelect?.selectedOptions?.[0];
  if (selected?.value?.startsWith('boss:')) return bossAttempts(selected);
  const bosses = Array.from(scopeSelect?.options || []).filter(option => option.value.startsWith('boss:'));
  const groups = new Map();
  for (const option of bosses) {
    const name = bossName(option) || option.textContent?.trim() || 'Boss';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(option);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length)[0] || [];
}

async function loadAttempt(option, playerRef) {
  const scope = optionScope(option);
  const [report, rotation] = await Promise.all([verifiedReport(scope), workerRequest('rotation-report', { scope }, 90000)]);
  const player = report.players?.find(item => item.ref === playerRef) || null;
  const lane = rotation?.lanes?.find(item => item.ref === playerRef) || null;
  return { option, scope, report, rotation, player, lane, intervals: intervalsByPower(lane?.activations || []) };
}

function activeRatio(player) {
  const elapsed = Number(player?.duration) || 0;
  return elapsed ? (Number(player?.combatTime) || 0) / elapsed * 100 : 0;
}

function buildTimingFindings(attempts) {
  const aggregate = new Map();
  for (const attempt of attempts) {
    for (const [power, data] of attempt.intervals) {
      if (!aggregate.has(power)) aggregate.set(power, []);
      aggregate.get(power).push(...data.gaps);
    }
  }
  const findings = [];
  for (const attempt of attempts) {
    for (const [power, data] of attempt.intervals) {
      const baseline = intervalSummary(aggregate.get(power));
      if (baseline.count < 3 || !data.gaps.length) continue;
      const longest = Math.max(...data.gaps);
      if (longest <= baseline.upperFence || longest <= baseline.median + 1) continue;
      findings.push({
        attempt: attempt.option.textContent?.trim() || attempt.option.value,
        power,
        observed: longest,
        typicalLow: baseline.q1,
        typicalHigh: baseline.q3,
        samples: baseline.count,
        severity: longest > baseline.upperFence * 1.35 ? 'high' : 'review'
      });
    }
  }
  return findings.sort((a, b) => (b.observed / Math.max(0.1, b.typicalHigh)) - (a.observed / Math.max(0.1, a.typicalHigh)));
}

export function openAttemptLab() {
  return openInvestigation('attempt-lab', 'Attempt Consistency Lab', async host => {
    const options = chooseAttemptOptions();
    const playerRef = currentPlayerRef();
    host.innerHTML = `<section class="sg-investigation-head"><span class="eyebrow">Attempt consistency</span><h2 tabindex="-1">Compare what actually happened across repeated boss attempts</h2><p>Timing observations are descriptive. An unusually long interval is not treated as player error because the combat log cannot prove cooldown state, mechanics, movement, or player intent.</p><div class="sg-investigation-progress" data-sg-progress>0 / ${options.length} attempts loaded</div></section><div data-sg-attempt-results></div>`;
    const attempts = [];
    for (let index = 0; index < options.length; index += 1) {
      const attempt = await loadAttempt(options[index], playerRef);
      if (attempt.player) attempts.push(attempt);
      host.querySelector('[data-sg-progress]').textContent = `${index + 1} / ${options.length} attempts loaded`;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const playerName = attempts[0]?.player?.name || 'Selected player';
    const timings = buildTimingFindings(attempts);
    const result = host.querySelector('[data-sg-attempt-results]');
    if (attempts.length < 2) {
      result.innerHTML = '<section class="panel"><h3>More repeated attempts are needed</h3><p>The selected boss/player combination does not contain at least two comparable attempts.</p></section>';
      return;
    }
    result.innerHTML = `<section class="panel"><div class="panel-head"><div><span class="eyebrow">${esc(playerName)}</span><h3>Attempt metrics</h3></div><span>${attempts.length} comparable attempts</span></div><div class="table-wrap"><table><thead><tr><th>Attempt</th><th class="num">Damage</th><th class="num">DPS</th><th class="num">Combat DPS</th><th class="num">Active time</th><th class="num">Share</th><th class="num">Crit</th><th class="num">CA</th></tr></thead><tbody>${attempts.map(attempt => `<tr><td>${esc(attempt.option.textContent?.trim() || attempt.option.value)}</td><td class="num">${compact(attempt.player.damage)}</td><td class="num">${compact(attempt.player.dps)}</td><td class="num">${compact(attempt.player.combatDps)}</td><td class="num">${pct(activeRatio(attempt.player))}</td><td class="num">${pct(attempt.player.damageShare)}</td><td class="num">${pct(attempt.player.crit)}</td><td class="num">${pct(attempt.player.flank)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">Observed timing</span><h3>Unusually long power intervals</h3></div><span>${timings.length} observations</span></div>${timings.length ? `<div class="sg-observation-list">${timings.map(item => `<article class="is-${item.severity}"><div><strong>${esc(item.power)}</strong><span>${esc(item.attempt)}</span></div><b>${duration(item.observed)}</b><small>Typical middle range ${duration(item.typicalLow)}–${duration(item.typicalHigh)} across ${item.samples} observed intervals.</small></article>`).join('')}</div>` : '<div class="empty-block good-text">No unusually long observed intervals met the evidence threshold across these attempts.</div>'}</section>`;
  });
}
