import { EVENT_PAGE_SIZE, currentPlayerRef, esc, optionScope, playerSelect, scopeSelect, workerRequest, verifiedReport } from '../v8/core.js';
import { isKnownEncounterPowerName } from '../data/encounter-power-icons.js';
import { verifyPowerCategories } from '../engine/classification-evidence.js';
import { openInvestigation } from './composition-shell.js';
import { openEvidenceDrawer } from './evidence-drawer.js';

const cache = new Map();

async function allRawRows(scope, options = {}) {
  const rows = [];
  let cursor = null;
  do {
    const page = await workerRequest('raw-page', { options: { cursor, limit: EVENT_PAGE_SIZE, scope, ...options } }, 60000);
    if (page?.verification?.status !== 'verified') throw new Error('Direct evidence is waiting for arithmetic verification.');
    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
    if (cursor != null) await new Promise(resolve => setTimeout(resolve, 0));
  } while (cursor != null);
  return rows;
}

async function rotationCoverage(scope) {
  const [rotation, resourceRows] = await Promise.all([
    workerRequest('rotation-report', { scope }, 90000),
    allRawRows(scope, { kind: 'resource' })
  ]);
  const origin = Number(rotation?.scope?.start) || 0;
  const explicit = resourceRows.filter(row => Number(row.amount) < 0 && row.sourceRef === '*' && !row.companion && /^P\[/.test(String(row.ownerRef || '')) && isKnownEncounterPowerName(row.powerName));
  const lanes = new Map((rotation?.lanes || []).map(lane => [lane.ref, lane]));
  let matched = 0;
  const misses = [];
  for (const marker of explicit) {
    const markerTime = Math.max(0, Number(marker.time) - origin);
    const lane = lanes.get(marker.ownerRef);
    const match = lane?.activations?.some(activation => activation.power === marker.powerName && Math.abs(Number(activation.time) - markerTime) <= 0.25);
    if (match) matched += 1;
    else misses.push(`${marker.ownerName || 'Unknown'} · ${marker.powerName} · ${markerTime.toFixed(2)}s`);
  }
  const total = Number(rotation?.activationCount) || (rotation?.lanes || []).reduce((sum, lane) => sum + (lane.activations?.length || 0), 0);
  return { total, explicit: explicit.length, matched, misses, coverage: total ? matched / total : 0, agreement: explicit.length ? matched / explicit.length : 1 };
}

function taxonomyEvidence(report) {
  const powers = (report.players || []).flatMap(player => player.powers || []);
  const result = verifyPowerCategories(powers);
  const denominator = result.checked + result.unresolved;
  return { ...result, coverage: denominator ? result.checked / denominator : 1 };
}

async function effectEvidence(scope) {
  if (scope.type !== 'boss') return { status: 'Not applicable', tone: 'neutral', detail: 'Team-debuff evidence is evaluated for boss scopes.' };
  const report = await workerRequest('effect-intelligence-report', { scope }, 90000);
  const effects = report?.effects || [];
  const conflicts = effects.filter(effect => effect.verification?.empirical?.status === 'mismatch' || !effect.verification?.timelineVerified).length;
  const strong = effects.filter(effect => effect.verification?.empirical?.status === 'matched').length;
  return {
    status: conflicts ? 'Review' : strong ? 'Strong' : effects.length ? 'Limited' : 'No effects',
    tone: conflicts ? 'bad' : strong ? 'good' : 'review',
    detail: `${effects.length} observed effects · ${strong} strong empirical checks · ${conflicts} conflicts or unresolved timelines.`
  };
}

async function evidenceForOption(option) {
  const scope = optionScope(option);
  const key = option.value;
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    const report = await verifiedReport(scope);
    const [rotation, effects] = await Promise.all([rotationCoverage(scope), effectEvidence(scope)]);
    const taxonomy = taxonomyEvidence(report);
    const selectedRef = currentPlayerRef();
    const player = report.players?.find(item => item.ref === selectedRef) || report.players?.[0] || null;
    return {
      key,
      label: option.textContent?.trim() || report.scope?.label || key,
      scope,
      report,
      player,
      rotation,
      effects,
      taxonomy,
      boss: scope.type === 'boss'
    };
  })().catch(error => { cache.delete(key); throw error; });
  cache.set(key, promise);
  return promise;
}

function percent(value) { return `${(Math.max(0, Math.min(1, Number(value) || 0)) * 100).toFixed(1)}%`; }
function cell(label, state, detail, tone = 'neutral') {
  return `<button type="button" class="sg-evidence-cell is-${tone}" data-evidence-label="${esc(label)}" data-evidence-state="${esc(state)}" data-evidence-detail="${esc(detail)}"><strong>${esc(state)}</strong><small>${esc(label)}</small></button>`;
}

function renderRow(item) {
  const companion = Number(item.player?.companionDamage) > 0;
  const taxonomyState = item.taxonomy.mismatches.length ? 'Mismatch' : item.taxonomy.unresolved ? 'Partial' : 'Verified';
  const taxonomyTone = item.taxonomy.mismatches.length ? 'bad' : item.taxonomy.unresolved ? 'review' : 'good';
  return `<tr>
    <th scope="row"><strong>${esc(item.label)}</strong><small>${esc(item.scope.type)}</small></th>
    <td>${cell('Damage arithmetic', 'Exact', `${item.report.verification?.checkedFields || 0} fields independently checked.`, 'good')}</td>
    <td>${cell('Boss identity', item.boss ? 'Inferred' : 'N/A', item.boss ? 'Boss identity comes from deterministic entity-template evidence.' : 'This row is not a boss scope.', item.boss ? 'review' : 'neutral')}</td>
    <td>${cell('Companion attribution', companion ? 'Inferred' : 'None counted', companion ? 'Companion share uses ownership/entity evidence and remains an inferred classification.' : 'No companion-attributed damage for the selected player.', companion ? 'review' : 'neutral')}</td>
    <td>${cell('Direct rotation markers', percent(item.rotation.coverage), `${item.rotation.matched}/${item.rotation.total} reconstructed activations have matching explicit Encounter markers; explicit-marker agreement ${percent(item.rotation.agreement)}.`, item.rotation.misses.length ? 'review' : 'good')}</td>
    <td>${cell('Team-debuff evidence', item.effects.status, item.effects.detail, item.effects.tone)}</td>
    <td>${cell('Power taxonomy', `${percent(item.taxonomy.coverage)} ${taxonomyState}`, `${item.taxonomy.checked} independently classified · ${item.taxonomy.unresolved} unresolved · ${item.taxonomy.mismatches.length} mismatches.`, taxonomyTone)}</td>
  </tr>`;
}

export function openEvidenceMap() {
  return openInvestigation('evidence-map', 'Evidence & Confidence Map', async host => {
    const options = Array.from(scopeSelect?.options || []).filter(option => option.value !== 'session');
    host.innerHTML = `<section class="sg-investigation-head"><span class="eyebrow">Evidence map</span><h2 tabindex="-1">How much should each conclusion be trusted?</h2><p>Every detected fight is inspected. Direct evidence, deterministic inference, and unresolved evidence stay visibly separate.</p><div class="sg-investigation-progress" data-sg-progress>0 / ${options.length} fights checked</div></section><div class="sg-evidence-map-wrap"><table class="sg-evidence-map"><thead><tr><th>Fight</th><th>Damage</th><th>Boss identity</th><th>Companion</th><th>Rotation evidence</th><th>Team debuffs</th><th>Taxonomy</th></tr></thead><tbody data-sg-evidence-rows></tbody></table></div>`;
    const body = host.querySelector('[data-sg-evidence-rows]');
    for (let index = 0; index < options.length; index += 1) {
      const item = await evidenceForOption(options[index]);
      body.insertAdjacentHTML('beforeend', renderRow(item));
      host.querySelector('[data-sg-progress]').textContent = `${index + 1} / ${options.length} fights checked`;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (!options.length) body.innerHTML = '<tr><td colspan="7">No detected fights are available in this log.</td></tr>';
  });
}

document.addEventListener('click', event => {
  const button = event.target.closest('.sg-evidence-cell');
  if (!button) return;
  openEvidenceDrawer({
    title: button.dataset.evidenceLabel || 'Evidence detail',
    sections: [{ label: button.dataset.evidenceLabel || 'Evidence', status: button.dataset.evidenceState || '', detail: button.dataset.evidenceDetail || '' }]
  });
});

document.addEventListener('strikeglass:analysis-ready', () => cache.clear());
