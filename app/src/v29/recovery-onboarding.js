const root = document.getElementById('view-root');
const nav = document.getElementById('app-nav');
const scopeSelect = document.getElementById('encounter-select');
const TOUR_KEY = 'strikeglass.analysisTour.seen.v1';

function ensureStyle() {
  if (document.querySelector('link[data-strikeglass-recovery-onboarding]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./recovery-onboarding.css', import.meta.url).href;
  link.dataset.strikeglassRecoveryOnboarding = 'true';
  document.head.append(link);
}

ensureStyle();

function installRecovery(panel) {
  if (!(panel instanceof HTMLElement) || panel.dataset.sgRecoveryReady === 'true') return;
  panel.dataset.sgRecoveryReady = 'true';
  panel.dataset.sgRecovery = 'true';

  const actions = document.createElement('div');
  actions.className = 'sg-recovery-actions';
  actions.innerHTML = `
    <div class="sg-recovery-copy">
      <strong>Try the verification again</strong>
      <span>Reverify reruns this fight through the primary engine and the independent verifier. If they still disagree, the analytics stay blocked.</span>
    </div>
    <div class="sg-recovery-buttons">
      <button class="button button-primary" type="button" data-sg-reverify>Reverify analysis</button>
      <button class="button" type="button" data-sg-open-checks>Open Analysis Checks</button>
    </div>`;

  const note = panel.querySelector('.view-note');
  if (note) note.insertAdjacentElement('afterend', actions);
  else panel.append(actions);

  const reverify = actions.querySelector('[data-sg-reverify]');
  reverify?.addEventListener('click', () => {
    if (!scopeSelect || scopeSelect.disabled) return;
    reverify.disabled = true;
    reverify.textContent = 'Reverifying...';
    panel.setAttribute('aria-busy', 'true');
    requestAnimationFrame(() => {
      scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  actions.querySelector('[data-sg-open-checks]')?.addEventListener('click', () => {
    const checks = nav?.querySelector('[data-view="diagnostics"]');
    if (!checks || checks.disabled) return;
    checks.click();
  });
}

function scanRecovery() {
  root?.querySelectorAll('.verification-blocked').forEach(installRecovery);
}

if (root) new MutationObserver(scanRecovery).observe(root, { childList: true, subtree: true });
document.addEventListener('strikeglass:view-rendered', scanRecovery);
scanRecovery();

const TOUR_STEPS = Object.freeze([
  {
    selectors: ['#topbar-status'],
    title: 'Verification status',
    body: 'Green means the important combat totals passed an independent check. If a view is blocked, Strikeglass hides calculated values instead of guessing. Use Reverify analysis to run that scope through both engines again.'
  },
  {
    selectors: ['#encounter-select'],
    title: 'Fight scope',
    body: 'Choose the full session, one detected fight, or a boss window here. Every number on the page follows this scope, so check it before comparing players or powers.'
  },
  {
    selectors: ['#player-select'],
    title: 'Active player',
    body: 'This chooses whose individual damage, powers, rotation, and context you are inspecting. Party-wide pages still use the same selected fight.'
  },
  {
    selectors: ['[data-sg-trust-rail]', '.verification-strip'],
    title: 'Evidence and confidence',
    body: 'Strikeglass separates checked arithmetic from inferred game concepts such as boss identity or companion attribution. Use View evidence when you want to see why a result is marked Exact, Derived, Inferred, Partial, or Unknown.'
  },
  {
    selectors: ['#app-nav'],
    title: 'Where to investigate',
    body: 'Start with Overview, then use Fight Timeline, Bosses, Team Debuffs, Damage & Powers, Raw Events, and Analysis Checks when you need deeper evidence. Nothing in the analysis is sent away from this device.'
  }
]);

let tourState = null;

function tourSeen() {
  try { return localStorage.getItem(TOUR_KEY) === '1'; }
  catch { return false; }
}

function rememberTour() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
}

function visibleTarget(step) {
  for (const selector of step.selectors) {
    const node = document.querySelector(selector);
    if (!(node instanceof HTMLElement)) continue;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none') return node;
  }
  return null;
}

async function waitForTarget(step, timeout = 2400) {
  const started = performance.now();
  let target = visibleTarget(step);
  while (!target && performance.now() - started < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
    target = visibleTarget(step);
  }
  return target;
}

function clearTourTarget() {
  if (!tourState?.target) return;
  tourState.target.removeAttribute('data-sg-tour-target');
  tourState.target = null;
}

function positionTour() {
  if (!tourState?.card || !tourState.target) return;
  const card = tourState.card;
  const target = tourState.target;
  const targetRect = target.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const margin = 12;
  const gap = 12;

  let left = targetRect.right + gap;
  if (left + cardRect.width > innerWidth - margin) left = targetRect.left - cardRect.width - gap;
  if (left < margin) left = Math.min(Math.max(margin, targetRect.left), Math.max(margin, innerWidth - cardRect.width - margin));

  let top = Math.max(margin, targetRect.top);
  if (top + cardRect.height > innerHeight - margin) top = Math.max(margin, innerHeight - cardRect.height - margin);

  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
}

function finishTour({ remember = true } = {}) {
  if (!tourState) return;
  if (remember) rememberTour();
  clearTourTarget();
  const { card, previousFocus } = tourState;
  tourState = null;
  card.remove();
  removeEventListener('resize', positionTour);
  removeEventListener('scroll', positionTour, true);
  document.removeEventListener('keydown', handleTourKey);
  if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
}

async function renderTourStep(index) {
  if (!tourState) return;
  const safeIndex = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
  const step = TOUR_STEPS[safeIndex];
  clearTourTarget();
  const target = await waitForTarget(step);
  if (!tourState) return;
  if (!target) {
    if (safeIndex < TOUR_STEPS.length - 1) return renderTourStep(safeIndex + 1);
    finishTour();
    return;
  }

  tourState.index = safeIndex;
  tourState.target = target;
  target.dataset.sgTourTarget = 'true';
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const card = tourState.card;
  card.querySelector('[data-sg-tour-count]').textContent = `Quick guide · ${safeIndex + 1} of ${TOUR_STEPS.length}`;
  card.querySelector('[data-sg-tour-title]').textContent = step.title;
  card.querySelector('[data-sg-tour-body]').textContent = step.body;
  const back = card.querySelector('[data-sg-tour-back]');
  const next = card.querySelector('[data-sg-tour-next]');
  back.disabled = safeIndex === 0;
  next.textContent = safeIndex === TOUR_STEPS.length - 1 ? 'Done' : 'Next';
  requestAnimationFrame(positionTour);
}

function moveTour(delta) {
  if (!tourState) return;
  const next = tourState.index + delta;
  if (next < 0) return;
  if (next >= TOUR_STEPS.length) {
    finishTour();
    return;
  }
  void renderTourStep(next);
}

function handleTourKey(event) {
  if (!tourState) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    finishTour();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    moveTour(1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    moveTour(-1);
  }
}

function startTour({ force = false } = {}) {
  if (tourState || (!force && tourSeen())) return;
  const card = document.createElement('aside');
  card.className = 'sg-first-run-tip';
  card.dataset.sgFirstRunTip = 'true';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'sg-first-run-tip-title');
  card.setAttribute('tabindex', '-1');
  card.innerHTML = `
    <div class="sg-first-run-tip-head">
      <span data-sg-tour-count>Quick guide</span>
      <button type="button" data-sg-tour-skip>Skip tips</button>
    </div>
    <div class="sg-first-run-tip-body">
      <h2 id="sg-first-run-tip-title" data-sg-tour-title>Getting oriented</h2>
      <p data-sg-tour-body>Strikeglass is preparing the first tip.</p>
    </div>
    <div class="sg-first-run-tip-actions">
      <button class="button" type="button" data-sg-tour-back>Back</button>
      <button class="button button-primary" type="button" data-sg-tour-next>Next</button>
    </div>`;

  tourState = { index: 0, card, target: null, previousFocus: document.activeElement };
  document.body.append(card);
  card.querySelector('[data-sg-tour-skip]').addEventListener('click', () => finishTour());
  card.querySelector('[data-sg-tour-back]').addEventListener('click', () => moveTour(-1));
  card.querySelector('[data-sg-tour-next]').addEventListener('click', () => moveTour(1));
  addEventListener('resize', positionTour);
  addEventListener('scroll', positionTour, true);
  document.addEventListener('keydown', handleTourKey);
  void renderTourStep(0);
  requestAnimationFrame(() => card.focus({ preventScroll: true }));
}

document.addEventListener('strikeglass:analysis-ready', () => {
  if (tourSeen()) return;
  setTimeout(() => startTour(), 650);
});

document.addEventListener('strikeglass:replay-onboarding', () => startTour({ force: true }));
