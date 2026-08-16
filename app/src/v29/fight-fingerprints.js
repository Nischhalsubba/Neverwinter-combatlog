import { compact, currentPlayerRef, esc, optionScope, pct, scopeSelect, verifiedReport } from '../v8/core.js';
import { deviationReasons, fingerprintDistance, fingerprintSignature, fingerprintVector, normalizeFingerprints, similarityFromDistance } from './analysis-model.js';
import { openInvestigation } from './composition-shell.js';

async function loadFingerprints(playerRef, progress) {
  const options = Array.from(scopeSelect?.options || []).filter(option => option.value !== 'session');
  const items = [];
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const report = await verifiedReport(optionScope(option));
    const player = report.players?.find(item => item.ref === playerRef);
    if (player) items.push({ option, report, player, vector: fingerprintVector(player, report) });
    progress(index + 1, options.length);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return items;
}

function nearestNeighbors(items) {
  return items.map(item => {
    let nearest = null;
    for (const candidate of items) {
      if (candidate === item) continue;
      const distance = fingerprintDistance(item.normalized, candidate.normalized);
      if (!nearest || distance < nearest.distance) nearest = { candidate, distance };
    }
    return { ...item, nearest, similarity: nearest ? similarityFromDistance(nearest.distance) : 1 };
  });
}

export function openFightFingerprints() {
  return openInvestigation('fight-fingerprints', 'Fight Fingerprints', async host => {
    host.innerHTML = '<section class="sg-investigation-head"><span class="eyebrow">Fight fingerprints</span><h2 tabindex="-1">Find repeated performance patterns and real outliers</h2><p>Fingerprints use deterministic, visible combat features. Similarity is not a hidden score: the contributing features are shown beside every result.</p><div class="sg-investigation-progress" data-sg-progress>Preparing fights…</div></section><div data-sg-fingerprint-results></div>';
    const items = await loadFingerprints(currentPlayerRef(), (done, total) => { host.querySelector('[data-sg-progress]').textContent = `${done} / ${total} fights fingerprinted`; });
    const result = host.querySelector('[data-sg-fingerprint-results]');
    if (items.length < 2) {
      result.innerHTML = '<section class="panel"><h3>More fights are needed</h3><p>At least two fights containing the selected player are required for similarity analysis.</p></section>';
      return;
    }
    const normalized = normalizeFingerprints(items);
    const withNeighbors = nearestNeighbors(normalized.items);
    const centroidDistances = withNeighbors.map(item => Math.sqrt(Object.values(item.normalized).reduce((sum, value) => sum + value ** 2, 0) / Object.values(item.normalized).length));
    const mean = centroidDistances.reduce((sum, value) => sum + value, 0) / centroidDistances.length;
    const sd = Math.sqrt(centroidDistances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / centroidDistances.length) || 1;
    result.innerHTML = `<section class="panel"><div class="panel-head"><div><span class="eyebrow">Deterministic signatures</span><h3>${esc(items[0].player.name)} across ${items.length} fights</h3></div><span>Same features, same formula</span></div><div class="table-wrap"><table><thead><tr><th>Fight</th><th>Fingerprint</th><th>Nearest pattern</th><th class="num">Similarity</th><th>Largest differences from own baseline</th></tr></thead><tbody>${withNeighbors.map((item, index) => {
      const distance = centroidDistances[index];
      const outlier = distance > mean + sd * 1.25;
      const reasons = deviationReasons(item, normalized.stats).map(reason => `${reason.label} ${reason.z >= 0 ? 'higher' : 'lower'} (${Math.abs(reason.z).toFixed(1)}σ)`).join(' · ');
      return `<tr class="${outlier ? 'is-outlier' : ''}"><td><strong>${esc(item.option.textContent?.trim() || item.option.value)}</strong><small>${outlier ? 'Pattern outlier' : 'Within normal pattern range'}</small></td><td><code>${fingerprintSignature(item.vector)}</code></td><td>${esc(item.nearest?.candidate.option.textContent?.trim() || '—')}</td><td class="num">${pct(item.similarity * 100)}</td><td>${esc(reasons)}</td></tr>`;
    }).join('')}</tbody></table></div></section>`;
  });
}
