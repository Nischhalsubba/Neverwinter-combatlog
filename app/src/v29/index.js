import { nav, playerSelect } from '../v8/core.js';
import { closeInvestigation, ensureCompositionShell } from './composition-shell.js';
import './recovery-onboarding.js';
import './trust-rail.js';
import './evidence-drawer.js';
import { openEvidenceMap } from './evidence-map.js';
import { openAttemptLab } from './attempt-lab.js';
import { openFightFingerprints } from './fight-fingerprints.js';
import { openMomentInspector } from './moment-inspector.js';
import { openCompareLab } from './compare-lab.js';
import { openTrends } from './trends.js';

const VIEWS = Object.freeze([
  ['evidence-map', 'Evidence Map', 'Trust by fight', openEvidenceMap, '<path d="M4 18h16M6 15V9m4 6V5m4 10v-3m4 3V7"/>'],
  ['attempt-lab', 'Attempt Lab', 'Consistency across pulls', openAttemptLab, '<path d="M5 19V5m0 14h14M8 15l3-4 3 2 4-6"/>'],
  ['fight-fingerprints', 'Fight Fingerprints', 'Patterns and outliers', openFightFingerprints, '<path d="M12 3a6 6 0 0 0-6 6v3m12 0V9a6 6 0 0 0-6-6m-3 8v5a3 3 0 0 0 6 0v-5m-3-2v8"/>'],
  ['moment-inspector', 'Moment Inspector', 'Rows around one instant', openMomentInspector, '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'],
  ['compare-lab', 'Compare 2.0', 'Median-relative context', openCompareLab, '<path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3"/>'],
  ['trends', 'Trends', 'Across every fight', openTrends, '<path d="M4 17l5-5 4 3 7-8M4 20h16"/>']
]);

function installNavigation() {
  if (!nav || nav.querySelector('[data-sg-investigation-section]')) return;
  const section = document.createElement('div');
  section.className = 'nav-section nav-section-investigate';
  section.dataset.sgInvestigationSection = 'true';
  section.setAttribute('role', 'group');
  section.setAttribute('aria-label', 'Investigate');
  section.innerHTML = `<span class="nav-section-label">Investigate</span>${VIEWS.map(([id, label, detail,, icon]) => `<button class="nav-item" type="button" data-sg-investigation="${id}" disabled><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span class="nav-copy"><strong>${label}</strong><small>${detail}</small></span></button>`).join('')}`;
  const advanced = nav.querySelector('.nav-section-advanced');
  advanced?.insertAdjacentElement('beforebegin', section) || nav.append(section);
  section.addEventListener('click', event => {
    const button = event.target.closest('[data-sg-investigation]');
    if (!button || button.disabled) return;
    const entry = VIEWS.find(([id]) => id === button.dataset.sgInvestigation);
    if (entry) void entry[3]();
  });
}

function setEnabled(enabled) {
  nav?.querySelectorAll('[data-sg-investigation]').forEach(button => { button.disabled = !enabled; });
}

ensureCompositionShell();
installNavigation();
setEnabled(Boolean(playerSelect && !playerSelect.disabled));
document.addEventListener('strikeglass:analysis-ready', () => setEnabled(true));
nav?.addEventListener('click', event => {
  if (event.target.closest('[data-view]')) closeInvestigation();
}, true);
