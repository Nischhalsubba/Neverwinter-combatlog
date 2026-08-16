import { currentPlayerRef, currentScope, esc, playerSelect, scopeSelect, verifiedReport } from '../v8/core.js';
import { SUPPORT_EFFECT_CATALOG } from '../data/support-effect-catalog.js';
import { catalogFreshness } from './analysis-model.js';
import { registerContextProvider } from './composition-shell.js';
import { openEvidenceDrawer } from './evidence-drawer.js';

const freshness = catalogFreshness(SUPPORT_EFFECT_CATALOG);
let manifestPromise = null;
let lastEvidence = null;

async function buildManifest() {
  if (!manifestPromise) manifestPromise = fetch('/build-manifest.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).catch(() => null);
  return manifestPromise;
}

function catalogLabel() {
  if (!freshness.newest?.updated) return 'Catalog: source dates incomplete';
  return `Catalog: ${freshness.newest.updated}`;
}

registerContextProvider('trust-rail', async () => {
  if (!playerSelect || playerSelect.disabled || !scopeSelect?.options?.length) return '';
  const [report, manifest] = await Promise.all([verifiedReport(currentScope()), buildManifest()]);
  const player = report.players?.find(item => item.ref === currentPlayerRef()) || report.players?.[0] || null;
  const scope = currentScope();
  const boss = scope?.type === 'boss';
  const scopedFight = scope?.type === 'encounter';
  const companion = Number(player?.companionDamage) > 0;
  const verification = report.verification || {};
  const build = manifest?.version ? `Build ${manifest.version}` : 'Development build';
  const fingerprint = manifest?.artifactIdentity ? ` · ${String(manifest.artifactIdentity).slice(0, 10)}` : '';
  lastEvidence = { report, manifest, player, boss, scopedFight, companion };
  return `<section class="sg-trust-rail" data-sg-trust-rail>
    <span class="sg-trust-chip is-good"><strong>Verified</strong><small>${esc(String(verification.checkedFields ?? 0))} checked fields</small></span>
    <span class="sg-trust-chip"><strong>${boss ? 'Boss identity: inferred' : scopedFight ? 'Fight window: inferred' : 'Session rows: exact'}</strong><small>${esc(report.scope?.label || scopeSelect.selectedOptions?.[0]?.textContent || 'Current scope')}</small></span>
    <span class="sg-trust-chip"><strong>Companion: ${companion ? 'inferred' : 'no counted share'}</strong><small>${esc(player?.name || 'Selected player')}</small></span>
    <span class="sg-trust-chip ${freshness.staleSources.length ? 'is-review' : ''}"><strong>${esc(catalogLabel())}</strong><small>${freshness.undatedSources} undated · ${freshness.staleSources.length} stale source${freshness.staleSources.length === 1 ? '' : 's'}</small></span>
    <span class="sg-trust-chip"><strong>${esc(build)}</strong><small>${esc(fingerprint || 'Local-first production package')}</small></span>
    <button class="button sg-trust-details" type="button" data-sg-trust-details>View evidence</button>
  </section>`;
});

document.addEventListener('click', event => {
  if (!event.target.closest('[data-sg-trust-details]') || !lastEvidence) return;
  const { report, manifest, player, boss, scopedFight, companion } = lastEvidence;
  openEvidenceDrawer({
    title: 'Current analysis evidence',
    intro: 'Strikeglass separates arithmetic verification from inferred game concepts. A green arithmetic check does not silently promote inferred classifications to exact facts.',
    sections: [
      { label: 'Combat arithmetic', status: report.verification?.status || 'unknown', tone: report.verification?.status === 'verified' ? 'good' : 'review', detail: `${Number(report.verification?.checkedFields) || 0} fields were independently checked for this scope.` },
      { label: 'Fight identity', status: boss ? 'Inferred boss identity' : scopedFight ? 'Inferred fight window' : 'Exact session rows', tone: boss || scopedFight ? 'review' : 'good', detail: boss ? 'Boss identity comes from deterministic entity-template evidence; damage inside the chosen scope remains verified.' : scopedFight ? 'Encounter boundaries are reconstructed from the documented combat-gap contract; damage inside the resulting window remains verified.' : 'The full-session scope uses the verified parsed row set.' },
      { label: 'Companion attribution', status: companion ? 'Inferred' : 'No counted companion share', tone: companion ? 'review' : 'neutral', detail: companion ? `${player?.name || 'The selected player'} has companion-attributed damage. Ownership classification is evidence-based inference, not an arithmetic fact.` : 'No companion-attributed canonical damage is present for the selected player in this scope.' },
      { label: 'Mechanic catalog', status: freshness.staleSources.length ? 'Review freshness' : 'Current within policy', tone: freshness.staleSources.length ? 'review' : 'good', detail: `${freshness.sourceCount} distinct source records, ${freshness.undatedSources} without dates, ${freshness.unsourcedEffects} effects without a source record.` , meta: freshness.oldest?.updated ? `Oldest dated source: ${freshness.oldest.updated}` : 'No dated source records available.' },
      { label: 'Production identity', status: manifest?.artifactIdentity ? 'Fingerprinted' : 'Development build', tone: manifest?.artifactIdentity ? 'good' : 'neutral', detail: manifest?.artifactIdentity ? `Artifact ${manifest.artifactIdentity}. Source ${manifest.sourceSha || 'unknown'}. Catalog contract ${String(manifest.contracts?.supportCatalog || 'unknown')}.` : 'No build manifest was served, which is expected during unbuilt local development.' }
    ]
  });
});
