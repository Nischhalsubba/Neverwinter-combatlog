const workspace = document.getElementById('workspace');
const root = document.getElementById('view-root');
const nav = document.getElementById('app-nav');
const playerSelect = document.getElementById('player-select');
const toolbar = workspace?.querySelector('.analysis-toolbar') || null;
const parseState = document.getElementById('parse-state');

const HISTORY_KEY = 'strikeglass.task-history.v1';
const TRACK_DELAY_MS = 180;
const trackers = new Map();
let workerRef = null;
let originalPostMessage = null;
let parseTracker = null;

const TASK_LABELS = Object.freeze({
  'scope-report': 'Calculating selected fight',
  'rotation-report': 'Building fight timeline',
  'effect-intelligence-report': 'Analyzing team debuffs',
  'raw-page': 'Reading verified event rows',
  'player-report': 'Loading player details',
  'diagnostics': 'Checking analysis details'
});

function activeView() {
  return nav?.querySelector('[data-view].is-active')?.dataset.view || '';
}

function currentPlayerName() {
  return playerSelect?.selectedOptions?.[0]?.textContent?.trim() || 'No player selected';
}

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

function ensurePlayerContext() {
  const head = workspace?.querySelector('.workspace-head');
  if (!head || !playerSelect) return null;
  let chip = head.querySelector('[data-sg-active-player]');
  if (chip) return chip;
  chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'sg-active-player-chip';
  chip.dataset.sgActivePlayer = 'true';
  chip.innerHTML = '<span class="sg-active-player-avatar" aria-hidden="true">?</span><span class="sg-active-player-copy"><small>Active player</small><strong data-sg-active-player-name>—</strong></span><span class="sg-active-player-change">Change</span>';
  chip.addEventListener('click', () => {
    playerSelect.focus({ preventScroll: true });
    try { playerSelect.showPicker?.(); } catch {}
  });
  const replace = document.getElementById('replace-file');
  head.insertBefore(chip, replace || null);
  return chip;
}

function syncPlayerContext() {
  const chip = ensurePlayerContext();
  if (!chip || !playerSelect) return;
  const name = currentPlayerName();
  const avatar = chip.querySelector('.sg-active-player-avatar');
  const label = chip.querySelector('[data-sg-active-player-name]');
  if (avatar) avatar.textContent = initials(name);
  if (label) label.textContent = name;
  chip.hidden = Boolean(workspace?.hidden) || !playerSelect.options.length;
  chip.setAttribute('aria-label', `Active player ${name}. Change player.`);
  chip.title = `Active player: ${name}`;

  const field = playerSelect.closest('.field');
  if (field) {
    field.classList.add('sg-player-field');
    const fieldLabel = field.querySelector(':scope > span');
    if (fieldLabel) fieldLabel.textContent = 'Change active player';
  }
}

function stabilizeOverviewLayout() {
  if (!root || activeView() !== 'overview') return;
  root.classList.add('sg-overview');
  for (const child of Array.from(root.children)) {
    if (!child.classList.contains('panel') || child.classList.contains('qol-matters')) continue;
    child.classList.add('sg-overview-full-span');
    if (child.querySelector('[data-player-row]')) child.classList.add('sg-overview-party');
  }
  const partyPanel = Array.from(root.querySelectorAll(':scope > .panel')).find(panel => panel.querySelector('[data-player-row]'));
  partyPanel?.classList.add('sg-overview-party', 'sg-overview-full-span');
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function historicalSeconds(task) {
  const entry = loadHistory()[task];
  const value = Number(entry?.seconds);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function rememberDuration(task, seconds) {
  if (!task || !Number.isFinite(seconds) || seconds < .08 || seconds > 180) return;
  try {
    const history = loadHistory();
    const previous = Number(history[task]?.seconds);
    history[task] = {
      seconds: Number.isFinite(previous) ? previous * .65 + seconds * .35 : seconds,
      samples: Math.min(20, Number(history[task]?.samples || 0) + 1)
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ETA history is optional and never affects analysis results.
  }
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Estimating ETA…';
  if (seconds <= 1.5) return 'ETA: almost done';
  if (seconds < 60) return `ETA: ~${Math.max(2, Math.ceil(seconds))}s`;
  const minutes = Math.ceil(seconds / 60);
  return `ETA: ~${minutes}m`;
}

function trackerEta(tracker) {
  const elapsed = Math.max(.01, (performance.now() - tracker.startedAt) / 1000);
  const progress = Number(tracker.progress);
  if (progress >= .04 && progress < .995) {
    const raw = elapsed * (1 - progress) / progress;
    tracker.etaSeconds = Number.isFinite(tracker.etaSeconds) ? tracker.etaSeconds * .7 + raw * .3 : raw;
    return tracker.etaSeconds;
  }
  const historical = historicalSeconds(tracker.task);
  if (historical) return Math.max(0, historical - elapsed);
  return null;
}

function taskTitle(tracker) {
  return TASK_LABELS[tracker.task] || TASK_LABELS[tracker.type] || 'Working on analysis';
}

function ensureGlobalDock() {
  if (!workspace || workspace.hidden) return null;
  let dock = workspace.querySelector('[data-sg-global-task]');
  if (dock) return dock;
  dock = document.createElement('section');
  dock.className = 'sg-global-task';
  dock.dataset.sgGlobalTask = 'true';
  dock.setAttribute('role', 'status');
  dock.setAttribute('aria-live', 'polite');
  dock.innerHTML = '<div class="sg-global-task-head"><div><small>Analysis in progress</small><strong data-sg-task-title>Working…</strong></div><span data-sg-task-percent>2%</span></div><div class="sg-global-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="2"><i data-sg-task-bar></i></div><div class="sg-global-task-meta"><span data-sg-task-detail>Starting…</span><span data-sg-task-eta>Estimating ETA…</span></div>';
  toolbar?.insertAdjacentElement('afterend', dock);
  return dock;
}

function inlineHostsFor(tracker) {
  if (!root) return [];
  const hosts = [];
  if (tracker.task === 'effect-intelligence-report' || tracker.type === 'effect-intelligence-report') {
    const full = root.querySelector('.debuff-loading');
    if (full) hosts.push(full);
  }
  if (tracker.task === 'raw-page' || tracker.type === 'raw-page') {
    const summary = root.querySelector('.qol-boss-debuff-summary,[data-qol-boss-debuffs]');
    if (summary && /loading|checking/i.test(summary.textContent || '')) hosts.push(summary);
  }
  return hosts;
}

function ensureInlineProgress(host) {
  let block = host.querySelector(':scope > [data-sg-inline-progress]');
  if (block) return block;
  block = document.createElement('div');
  block.className = 'sg-inline-progress';
  block.dataset.sgInlineProgress = 'true';
  block.innerHTML = '<div class="sg-inline-progress-copy"><strong data-sg-inline-detail>Starting analysis…</strong><span data-sg-inline-eta>Estimating ETA…</span></div><div class="sg-global-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="2"><i data-sg-inline-bar></i></div><small data-sg-inline-percent>2%</small>';
  host.append(block);
  return block;
}

function updateExistingTaskLoader(tracker, ratio, percent, etaText) {
  if (!root) return false;
  const request = String(tracker.requestId ?? '');
  const candidates = Array.from(root.querySelectorAll('[data-task-loading]'));
  const loading = candidates.find(node => node.dataset.taskRequest === request)
    || candidates.find(node => node.dataset.taskType === tracker.task || node.dataset.taskType === tracker.type);
  if (!loading) return false;
  const bar = loading.querySelector('[data-task-progress-bar]');
  const meter = loading.querySelector('[role="progressbar"]');
  const value = loading.querySelector('[data-task-progress-value]');
  const copy = loading.querySelector('[data-task-progress-label]');
  if (bar) bar.style.setProperty('--task-progress', String(ratio));
  if (meter) meter.setAttribute('aria-valuenow', String(percent));
  if (value) value.textContent = `${percent}%`;
  if (copy && tracker.detail) copy.firstChild ? copy.firstChild.nodeValue = tracker.detail : copy.prepend(tracker.detail);
  if (copy) {
    let eta = copy.querySelector('[data-sg-task-eta]');
    if (!eta) {
      eta = document.createElement('span');
      eta.dataset.sgTaskEta = 'true';
      copy.append(eta);
    }
    eta.textContent = etaText;
  }
  return true;
}

function paintTracker(tracker) {
  const ratio = Math.max(.02, Math.min(1, Number(tracker.progress) || .02));
  const percent = Math.round(ratio * 100);
  const etaText = formatEta(trackerEta(tracker));
  const existingLoader = updateExistingTaskLoader(tracker, ratio, percent, etaText);
  const inlineHosts = inlineHostsFor(tracker);
  for (const host of inlineHosts) {
    const block = ensureInlineProgress(host);
    const detail = block.querySelector('[data-sg-inline-detail]');
    const eta = block.querySelector('[data-sg-inline-eta]');
    const bar = block.querySelector('[data-sg-inline-bar]');
    const meter = block.querySelector('[role="progressbar"]');
    const value = block.querySelector('[data-sg-inline-percent]');
    if (detail) detail.textContent = tracker.detail || taskTitle(tracker);
    if (eta) eta.textContent = etaText;
    if (bar) bar.style.transform = `scaleX(${ratio})`;
    if (meter) meter.setAttribute('aria-valuenow', String(percent));
    if (value) value.textContent = `${percent}%`;
  }

  if (existingLoader || inlineHosts.length) {
    workspace?.querySelector('[data-sg-global-task]')?.remove();
    return;
  }

  const dock = ensureGlobalDock();
  if (!dock) return;
  dock.hidden = false;
  dock.dataset.task = tracker.task || tracker.type || '';
  const title = dock.querySelector('[data-sg-task-title]');
  const detail = dock.querySelector('[data-sg-task-detail]');
  const eta = dock.querySelector('[data-sg-task-eta]');
  const value = dock.querySelector('[data-sg-task-percent]');
  const bar = dock.querySelector('[data-sg-task-bar]');
  const meter = dock.querySelector('[role="progressbar"]');
  if (title) title.textContent = taskTitle(tracker);
  if (detail) detail.textContent = tracker.detail || 'Preparing verified results…';
  if (eta) eta.textContent = etaText;
  if (value) value.textContent = `${percent}%`;
  if (bar) bar.style.transform = `scaleX(${ratio})`;
  if (meter) meter.setAttribute('aria-valuenow', String(percent));
}

function schedulePaint(tracker, immediate = false) {
  if (tracker.finished) return;
  if (immediate) {
    tracker.visible = true;
    paintTracker(tracker);
    return;
  }
  if (tracker.showTimer) return;
  tracker.showTimer = setTimeout(() => {
    tracker.showTimer = null;
    if (tracker.finished) return;
    tracker.visible = true;
    paintTracker(tracker);
  }, TRACK_DELAY_MS);
}

function createTracker(message = {}) {
  const requestId = String(message.requestId ?? `${message.type || message.task || 'task'}:${performance.now()}`);
  let tracker = trackers.get(requestId);
  if (tracker) return tracker;
  tracker = {
    requestId,
    type: message.type || message.task || '',
    task: message.task || message.type || '',
    startedAt: performance.now(),
    progress: .02,
    detail: 'Starting…',
    etaSeconds: null,
    visible: false,
    finished: false,
    showTimer: null
  };
  trackers.set(requestId, tracker);
  return tracker;
}

function completeTracker(tracker, detail = 'Ready') {
  if (!tracker || tracker.finished) return;
  tracker.progress = 1;
  tracker.detail = detail;
  if (tracker.visible) paintTracker(tracker);
  tracker.finished = true;
  if (tracker.showTimer) clearTimeout(tracker.showTimer);
  const elapsed = (performance.now() - tracker.startedAt) / 1000;
  rememberDuration(tracker.task || tracker.type, elapsed);
  trackers.delete(String(tracker.requestId));
  setTimeout(() => {
    if (trackers.size) return;
    workspace?.querySelector('[data-sg-global-task]')?.remove();
    root?.querySelectorAll('[data-sg-inline-progress]').forEach(node => node.remove());
  }, 450);
}

function handleOutgoing(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'parse') {
    parseTracker = {
      requestId: 'parse', type: 'parse', task: 'parse', startedAt: performance.now(), progress: .01,
      detail: 'Reading combat log', etaSeconds: null, finished: false
    };
    ensureParseEta();
    return;
  }
  if (!message.requestId) return;
  const trackable = ['scope-report', 'rotation-report', 'effect-intelligence-report', 'raw-page', 'player-report', 'diagnostics'];
  if (!trackable.includes(message.type)) return;
  const tracker = createTracker(message);
  tracker.type = message.type;
  tracker.task = message.type;
  tracker.detail = TASK_LABELS[message.type] || 'Preparing analysis…';
  const immediate = message.type === 'effect-intelligence-report' && Boolean(root?.querySelector('.debuff-loading'));
  schedulePaint(tracker, immediate);
}

function handleTaskProgress(message) {
  const tracker = createTracker(message);
  tracker.task = message.task || tracker.task;
  tracker.progress = Math.max(.02, Math.min(1, Number(message.progress) || tracker.progress));
  tracker.detail = message.detail || String(message.phase || 'Working…');
  schedulePaint(tracker, tracker.task === 'effect-intelligence-report');
  if (tracker.visible) paintTracker(tracker);
  if (tracker.progress >= 1) completeTracker(tracker, tracker.detail || 'Ready');
}

function handleRequestResult(message) {
  const requestId = String(message?.requestId ?? '');
  if (!requestId) return;
  const tracker = trackers.get(requestId);
  if (!tracker) return;
  if (tracker.type === 'raw-page' && message.page) {
    const scanned = Number(message.page.scannedTo);
    const total = Number(message.page.totalStoredRows);
    if (Number.isFinite(scanned) && Number.isFinite(total) && total > 0) tracker.progress = Math.max(.04, Math.min(.98, scanned / total));
    tracker.detail = message.page.nextCursor == null ? 'Verified event rows ready' : 'Reading the next verified event page';
    if (tracker.visible) paintTracker(tracker);
  }
  completeTracker(tracker, message.error ? 'Analysis stopped' : 'Ready');
}

function ensureParseEta() {
  const grid = parseState?.querySelector('.telemetry-grid');
  if (!grid) return null;
  let card = grid.querySelector('[data-sg-parse-eta-card]');
  if (card) return card;
  card = document.createElement('article');
  card.className = 'telemetry-card sg-parse-eta-card';
  card.dataset.sgParseEtaCard = 'true';
  card.innerHTML = '<span>ETA</span><strong data-sg-parse-eta>Estimating…</strong><small data-sg-parse-stage>Reading file</small>';
  grid.append(card);
  return card;
}

function handleParseProgress(message) {
  if (!parseTracker) {
    parseTracker = { requestId: 'parse', type: 'parse', task: 'parse', startedAt: performance.now(), progress: .01, detail: 'Reading combat log', etaSeconds: null, finished: false };
  }
  const progress = message.progress || {};
  const total = Number(progress.totalBytes) || 0;
  const read = Number(progress.bytesRead) || 0;
  parseTracker.progress = total ? Math.max(.01, Math.min(.99, read / total)) : parseTracker.progress;
  parseTracker.detail = String(progress.phase || 'Reading combat log').replace(/-/g, ' ');
  const card = ensureParseEta();
  const eta = card?.querySelector('[data-sg-parse-eta]');
  const stage = card?.querySelector('[data-sg-parse-stage]');
  if (eta) eta.textContent = formatEta(trackerEta(parseTracker)).replace(/^ETA:\s*/, '');
  if (stage) stage.textContent = parseTracker.detail;
}

function completeParse() {
  if (!parseTracker) return;
  parseTracker.progress = 1;
  const elapsed = (performance.now() - parseTracker.startedAt) / 1000;
  rememberDuration('parse', elapsed);
  const card = ensureParseEta();
  const eta = card?.querySelector('[data-sg-parse-eta]');
  const stage = card?.querySelector('[data-sg-parse-stage]');
  if (eta) eta.textContent = 'Complete';
  if (stage) stage.textContent = `${elapsed.toFixed(1)}s total`;
  parseTracker = null;
}

function handleWorkerMessage(event) {
  const message = event.data || {};
  if (message.type === 'task-progress') {
    handleTaskProgress(message);
    return;
  }
  if (message.type === 'progress') {
    handleParseProgress(message);
    return;
  }
  if (message.type === 'done' || message.type === 'summary') completeParse();
  if (message.requestId) handleRequestResult(message);
}

function attachWorker(worker) {
  if (!worker || worker === workerRef) return;
  if (workerRef) workerRef.removeEventListener('message', handleWorkerMessage);
  workerRef = worker;
  worker.addEventListener('message', handleWorkerMessage);
  if (worker.__strikeglassUiObserved) return;
  originalPostMessage = worker.postMessage.bind(worker);
  worker.postMessage = function observedPostMessage(message, ...rest) {
    handleOutgoing(message);
    return originalPostMessage(message, ...rest);
  };
  worker.__strikeglassUiObserved = true;
}

function syncUi() {
  syncPlayerContext();
  stabilizeOverviewLayout();
  requestAnimationFrame(stabilizeOverviewLayout);
}

playerSelect?.addEventListener('change', syncPlayerContext);
nav?.addEventListener('click', () => requestAnimationFrame(syncUi));
document.addEventListener('strikeglass:view-rendered', () => requestAnimationFrame(syncUi));
document.addEventListener('strikeglass:analysis-ready', syncUi);
window.addEventListener('strikeglass:worker-ready', event => attachWorker(event.detail?.worker));

attachWorker(window.StrikeglassWorkerBridge?.mainWorker || window.__strikeglassWorker || null);
ensureParseEta();
syncUi();
