const root = document.getElementById('view-root');
const nav = document.getElementById('app-nav');
const scopeSelect = document.getElementById('encounter-select');
const TOUR_KEY = 'strikeglass.analysisTour.seen.v2';

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

const ICONS = Object.freeze({
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.4 4.1L17.5 7.5l-4.1 1.4L12 13l-1.4-4.1-4.1-1.4 4.1-1.4L12 2Zm6 9 .9 2.6 2.6.9-2.6.9L18 19l-.9-2.6-2.6-.9 2.6-.9L18 11ZM6 13l1.1 3.1 3.1 1.1-3.1 1.1L6 21.5l-1.1-3.2-3.1-1.1 3.1-1.1L6 13Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>',
  scope: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/><circle cx="12" cy="12" r="9"/></svg>',
  player: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
  evidence: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16"/><path d="m7 15 4-4 3 2 4-6"/><circle cx="18" cy="7" r="2"/></svg>',
  compass: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>'
});

const TOUR_STEPS = Object.freeze([
  {
    selectors: ['#topbar-status'],
    icon: 'shield',
    placement: 'below',
    accent: '#16834a',
    title: 'Verification status',
    kicker: 'Trust the numbers before the analysis',
    summary: 'Strikeglass independently checks critical combat totals so you can tell when a result is safe to use and when the app is deliberately refusing to guess.',
    items: [
      ['success', 'check', 'Green means verified', 'Critical fields match the independent verifier and the result is ready for analysis.'],
      ['warning', 'lock', 'If a view is blocked', 'Calculated values are hidden instead of being published from engines that disagree.'],
      ['info', 'refresh', 'What you can do next', 'Use Reverify analysis after changing scope, fixing a log issue, or updating the parser. Analysis Checks shows the exact disagreement.']
    ],
    why: 'Verified data means confident comparisons, reliable rankings, and evidence you can trace instead of numbers you simply have to trust.',
    visualLabel: 'Verified',
    visualMeta: 'Independent checks passed'
  },
  {
    selectors: ['#encounter-select'],
    icon: 'scope',
    placement: 'below',
    accent: '#2563eb',
    title: 'Fight scope',
    kicker: 'Every number follows this selection',
    summary: 'The fight selector controls the time window and encounter context used by the page. A full session can tell a very different story from one boss attempt.',
    items: [
      ['info', 'scope', 'Full session', 'Use this for the broad story, total contribution, and long-session context.'],
      ['success', 'check', 'Fight or boss window', 'Use a detected encounter when you need a fair comparison inside one shared combat window.'],
      ['warning', 'info', 'Check before comparing', 'Changing scope changes DPS denominators, active time, evidence, powers, and most downstream analysis.']
    ],
    why: 'A correct scope prevents a technically accurate number from answering the wrong question.',
    visualLabel: 'Scope',
    visualMeta: 'Full session / fight / boss'
  },
  {
    selectors: ['#player-select'],
    icon: 'player',
    placement: 'below',
    accent: '#2563eb',
    title: 'Active player',
    kicker: 'Choose whose performance you are inspecting',
    summary: 'Player-specific pages follow this selection for damage, powers, timing, activity, and longitudinal context while party-wide views keep the same fight scope.',
    items: [
      ['success', 'player', 'Individual analysis', 'Damage & Powers, player timing, and trends use this player as the primary subject.'],
      ['info', 'scope', 'Scope stays shared', 'Changing the player does not silently change the selected fight window.'],
      ['warning', 'info', 'Identity matters', 'Companions and owned entities may be attributed separately when the source evidence supports that relationship.']
    ],
    why: 'Keeping player identity and fight scope explicit makes comparisons reproducible instead of accidental.',
    visualLabel: 'Active player',
    visualMeta: 'One subject, shared fight scope'
  },
  {
    selectors: ['[data-sg-trust-rail]', '.verification-strip'],
    icon: 'evidence',
    placement: 'below',
    accent: '#6d5ce7',
    title: 'Evidence and confidence',
    kicker: 'Exact arithmetic is not the same as inferred meaning',
    summary: 'Strikeglass separates what was directly counted from what was derived or inferred from Neverwinter entities, encounter patterns, and ownership evidence.',
    items: [
      ['success', 'check', 'Exact', 'Directly counted or independently checked values with no interpretive step.'],
      ['info', 'evidence', 'Derived', 'Calculated from verified inputs using an explicit metric definition.'],
      ['warning', 'info', 'Inferred or partial', 'The arithmetic may still be exact, but the label or game concept has limited evidence and is shown separately.']
    ],
    why: 'Use View evidence or Why? whenever you want the calculation, boundaries, confidence, and supporting rows behind a result.',
    visualLabel: 'Evidence',
    visualMeta: 'Exact / Derived / Inferred'
  },
  {
    selectors: ['#app-nav'],
    icon: 'compass',
    placement: 'right',
    accent: '#2563eb',
    title: 'Where to investigate',
    kicker: 'Start broad, then drill into proof',
    summary: 'Overview tells the story. The investigation views help you move from a result to timing, encounter context, confidence, and finally the supporting combat rows.',
    items: [
      ['success', 'compass', 'Start with Overview', 'Use the summary to find the fight, player, or observation that deserves attention.'],
      ['info', 'evidence', 'Investigate the reason', 'Timeline, Team Debuffs, Evidence Map, Attempt Lab, Fingerprints, Compare 2.0, and Trends explain patterns from different angles.'],
      ['warning', 'info', 'Raw Events are the ground truth', 'When you need the actual parsed rows, open Raw Events or the evidence links rather than relying on a summary alone.']
    ],
    why: 'Your combat log stays on this device. The analysis is designed to move from context to insight to evidence to the underlying row.',
    visualLabel: 'Investigate',
    visualMeta: 'Context -> insight -> evidence -> row'
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

function createTourOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'sg-tour-overlay';
  overlay.dataset.sgTourOverlay = 'true';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <span class="sg-tour-shade" data-sg-tour-shade="top"></span>
    <span class="sg-tour-shade" data-sg-tour-shade="left"></span>
    <span class="sg-tour-shade" data-sg-tour-shade="right"></span>
    <span class="sg-tour-shade" data-sg-tour-shade="bottom"></span>
    <span class="sg-tour-spotlight-ring"></span>`;
  document.body.append(overlay);
  return overlay;
}

function setSpotlight(rect) {
  if (!tourState?.overlay) return;
  const pad = 7;
  const left = Math.max(0, rect.left - pad);
  const top = Math.max(0, rect.top - pad);
  const right = Math.min(innerWidth, rect.right + pad);
  const bottom = Math.min(innerHeight, rect.bottom + pad);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const overlay = tourState.overlay;
  const shades = {
    top: [0, 0, innerWidth, top],
    left: [0, top, left, height],
    right: [right, top, Math.max(0, innerWidth - right), height],
    bottom: [0, bottom, innerWidth, Math.max(0, innerHeight - bottom)]
  };
  for (const [name, values] of Object.entries(shades)) {
    const pane = overlay.querySelector(`[data-sg-tour-shade="${name}"]`);
    if (!pane) continue;
    pane.style.left = `${Math.round(values[0])}px`;
    pane.style.top = `${Math.round(values[1])}px`;
    pane.style.width = `${Math.round(values[2])}px`;
    pane.style.height = `${Math.round(values[3])}px`;
  }
  const ring = overlay.querySelector('.sg-tour-spotlight-ring');
  if (ring) {
    ring.style.left = `${Math.round(left)}px`;
    ring.style.top = `${Math.round(top)}px`;
    ring.style.width = `${Math.round(width)}px`;
    ring.style.height = `${Math.round(height)}px`;
  }
}

function clearTourTarget() {
  if (!tourState?.target) return;
  tourState.target.removeAttribute('data-sg-tour-target');
  tourState.target = null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function choosePlacement(preferred, targetRect, cardRect, gap, margin) {
  const fits = {
    below: targetRect.bottom + gap + cardRect.height <= innerHeight - margin,
    above: targetRect.top - gap - cardRect.height >= margin,
    right: targetRect.right + gap + cardRect.width <= innerWidth - margin,
    left: targetRect.left - gap - cardRect.width >= margin
  };
  const orders = {
    below: ['below', 'left', 'right', 'above'],
    above: ['above', 'right', 'left', 'below'],
    right: ['right', 'below', 'above', 'left'],
    left: ['left', 'below', 'above', 'right']
  };
  const order = orders[preferred] || orders.below;
  return order.find(name => fits[name]) || order[0];
}

function positionTour() {
  if (!tourState?.card || !tourState.target) return;
  const card = tourState.card;
  const targetRect = tourState.target.getBoundingClientRect();
  setSpotlight(targetRect);

  const cardRect = card.getBoundingClientRect();
  const margin = 12;
  const gap = 18;
  const placement = choosePlacement(tourState.step?.placement || 'below', targetRect, cardRect, gap, margin);
  let left = margin;
  let top = margin;

  if (placement === 'below' || placement === 'above') {
    left = clamp(targetRect.left + targetRect.width / 2 - cardRect.width / 2, margin, innerWidth - cardRect.width - margin);
    top = placement === 'below' ? targetRect.bottom + gap : targetRect.top - cardRect.height - gap;
    const arrowX = clamp(targetRect.left + targetRect.width / 2 - left, 28, cardRect.width - 28);
    card.style.setProperty('--sg-tour-arrow-x', `${Math.round(arrowX)}px`);
  } else {
    top = clamp(targetRect.top + targetRect.height / 2 - cardRect.height / 2, margin, innerHeight - cardRect.height - margin);
    left = placement === 'right' ? targetRect.right + gap : targetRect.left - cardRect.width - gap;
    const arrowY = clamp(targetRect.top + targetRect.height / 2 - top, 28, cardRect.height - 28);
    card.style.setProperty('--sg-tour-arrow-y', `${Math.round(arrowY)}px`);
  }

  card.dataset.sgTourPlacement = placement;
  card.style.left = `${Math.round(clamp(left, margin, innerWidth - cardRect.width - margin))}px`;
  card.style.top = `${Math.round(clamp(top, margin, innerHeight - cardRect.height - margin))}px`;
}

function renderProgress(card, index) {
  card.querySelector('[data-sg-tour-count]').textContent = `Step ${index + 1} of ${TOUR_STEPS.length}`;
  const dots = card.querySelector('[data-sg-tour-dots]');
  dots.replaceChildren(...TOUR_STEPS.map((_, dotIndex) => {
    const dot = document.createElement('span');
    dot.className = 'sg-tour-progress-dot';
    dot.dataset.active = dotIndex === index ? 'true' : 'false';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  }));
}

function renderTourContent(card, step) {
  card.style.setProperty('--sg-tour-accent', step.accent);
  tourState?.overlay?.style.setProperty('--sg-tour-accent', step.accent);
  card.querySelector('[data-sg-tour-icon]').innerHTML = ICONS[step.icon] || ICONS.info;
  card.querySelector('[data-sg-tour-kicker]').textContent = step.kicker;
  card.querySelector('[data-sg-tour-title]').textContent = step.title;
  card.querySelector('[data-sg-tour-summary]').textContent = step.summary;
  card.querySelector('[data-sg-tour-why]').textContent = step.why;

  const itemsHost = card.querySelector('[data-sg-tour-items]');
  itemsHost.replaceChildren(...step.items.map(([kind, icon, title, body]) => {
    const item = document.createElement('div');
    item.className = `sg-tour-item is-${kind}`;
    const marker = document.createElement('span');
    marker.className = 'sg-tour-item-icon';
    marker.innerHTML = ICONS[icon] || ICONS.info;
    const copy = document.createElement('span');
    copy.className = 'sg-tour-item-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const detail = document.createElement('span');
    detail.textContent = body;
    copy.append(strong, detail);
    item.append(marker, copy);
    return item;
  }));

  const visual = card.querySelector('[data-sg-tour-visual]');
  visual.innerHTML = `
    <div class="sg-tour-visual-orbit">${ICONS[step.icon] || ICONS.info}</div>
    <div class="sg-tour-visual-card">
      <strong>${step.visualLabel}</strong>
      <span>${step.visualMeta}</span>
      <i></i><i></i><i></i>
    </div>`;
}

function finishTour({ remember = true } = {}) {
  if (!tourState) return;
  if (remember) rememberTour();
  clearTourTarget();
  const { card, overlay, previousFocus } = tourState;
  tourState = null;
  card.remove();
  overlay.remove();
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
  tourState.step = step;
  tourState.target = target;
  target.dataset.sgTourTarget = 'true';
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const card = tourState.card;
  renderProgress(card, safeIndex);
  renderTourContent(card, step);
  const back = card.querySelector('[data-sg-tour-back]');
  const next = card.querySelector('[data-sg-tour-next]');
  back.disabled = safeIndex === 0;
  next.textContent = safeIndex === TOUR_STEPS.length - 1 ? 'Done' : 'Next';
  requestAnimationFrame(() => requestAnimationFrame(positionTour));
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
  } else if (event.key === 'Tab') {
    const controls = [...tourState.card.querySelectorAll('button:not([disabled])')];
    if (!controls.length) return;
    const current = controls.indexOf(document.activeElement);
    const next = event.shiftKey
      ? (current <= 0 ? controls.length - 1 : current - 1)
      : (current < 0 || current === controls.length - 1 ? 0 : current + 1);
    event.preventDefault();
    controls[next].focus();
  }
}

function startTour({ force = false } = {}) {
  if (tourState || (!force && tourSeen())) return;
  const overlay = createTourOverlay();
  const card = document.createElement('aside');
  card.className = 'sg-first-run-tip';
  card.dataset.sgFirstRunTip = 'true';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'sg-first-run-tip-title');
  card.setAttribute('aria-describedby', 'sg-first-run-tip-summary');
  card.setAttribute('tabindex', '-1');
  card.innerHTML = `
    <div class="sg-first-run-tip-head">
      <div class="sg-tour-brand">${ICONS.sparkle}<strong>Welcome to Strikeglass</strong></div>
      <div class="sg-tour-head-actions">
        <button type="button" data-sg-tour-skip>Skip tips</button>
        <button class="sg-tour-close" type="button" data-sg-tour-close aria-label="Close quick guide">×</button>
      </div>
    </div>
    <div class="sg-tour-progress" aria-label="Onboarding progress">
      <span data-sg-tour-count>Step 1 of ${TOUR_STEPS.length}</span>
      <span class="sg-tour-progress-dots" data-sg-tour-dots></span>
    </div>
    <div class="sg-first-run-tip-body" aria-live="polite">
      <section class="sg-tour-copy">
        <div class="sg-tour-title-row">
          <span class="sg-tour-title-icon" data-sg-tour-icon>${ICONS.info}</span>
          <div>
            <span class="sg-tour-kicker" data-sg-tour-kicker>Getting oriented</span>
            <h2 id="sg-first-run-tip-title" data-sg-tour-title>Quick guide</h2>
          </div>
        </div>
        <p id="sg-first-run-tip-summary" class="sg-tour-summary" data-sg-tour-summary>Strikeglass is preparing the first tip.</p>
        <div class="sg-tour-items" data-sg-tour-items></div>
      </section>
      <aside class="sg-tour-visual" data-sg-tour-visual aria-hidden="true"></aside>
    </div>
    <div class="sg-tour-why">
      <span class="sg-tour-why-icon">${ICONS.info}</span>
      <p><strong>Why it matters</strong><span data-sg-tour-why></span></p>
    </div>
    <div class="sg-first-run-tip-actions">
      <button class="button" type="button" data-sg-tour-back>Back</button>
      <button class="button button-primary" type="button" data-sg-tour-next>Next</button>
    </div>`;

  tourState = { index: 0, step: TOUR_STEPS[0], card, overlay, target: null, previousFocus: document.activeElement };
  document.body.append(card);
  card.querySelector('[data-sg-tour-skip]').addEventListener('click', () => finishTour());
  card.querySelector('[data-sg-tour-close]').addEventListener('click', () => finishTour());
  card.querySelector('[data-sg-tour-back]').addEventListener('click', () => moveTour(-1));
  card.querySelector('[data-sg-tour-next]').addEventListener('click', () => moveTour(1));
  addEventListener('resize', positionTour);
  addEventListener('scroll', positionTour, true);
  document.addEventListener('keydown', handleTourKey);
  void renderTourStep(0);
  requestAnimationFrame(() => card.querySelector('[data-sg-tour-next]')?.focus({ preventScroll: true }));
}

document.addEventListener('strikeglass:analysis-ready', () => {
  if (tourSeen()) return;
  setTimeout(() => startTour(), 650);
});

document.addEventListener('strikeglass:replay-onboarding', () => startTour({ force: true }));
