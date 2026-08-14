import { readFile, writeFile } from 'node:fs/promises';

async function text(path) { return readFile(path, 'utf8'); }
async function save(path, value) { await writeFile(path, value); }
function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}
function replaceRegex(source, pattern, to, label) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Missing regex patch target: ${label}`);
  return source.replace(pattern, to);
}

let app = await text('src/v3/app.js');
app = replaceOnce(app,
  "async function renderOverview(epoch = renderEpoch) {\n  replaceRoot(taskLoading('Loading summary', 'Calculating the selected fight and checking the values before display.', 'scope-report'));\n  const report = await getScopeReport();",
  "async function renderOverview(epoch = renderEpoch) {\n  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading summary', 'Calculating the selected fight and checking the values before display.', 'scope-report'));\n  const report = await getScopeReport();",
  'cached overview');
app = replaceOnce(app,
  "async function renderComparisonView(epoch = renderEpoch) {\n  replaceRoot(taskLoading('Loading comparison', 'Preparing the same fight for the selected players.', 'scope-report'));\n  const report = await getScopeReport();",
  "async function renderComparisonView(epoch = renderEpoch) {\n  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading comparison', 'Preparing the same fight for the selected players.', 'scope-report'));\n  const report = await getScopeReport();",
  'cached comparison');
app = replaceOnce(app,
  "  replaceRoot(taskLoading('Loading boss fight', 'Calculating this boss fight and checking the values before display.', 'scope-report'));\n  const report = await getScopeReport();",
  "  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading boss fight', 'Calculating this boss fight and checking the values before display.', 'scope-report'));\n  const report = await getScopeReport();",
  'cached boss');
app = replaceOnce(app,
  "async function renderPlayers(epoch = renderEpoch) {\n  replaceRoot(taskLoading('Loading player results', 'Calculating player totals for the selected fight.', 'scope-report'));\n  const report = await getScopeReport();",
  "async function renderPlayers(epoch = renderEpoch) {\n  if (!state.report || state.reportKey !== scopeKey()) replaceRoot(taskLoading('Loading player results', 'Calculating player totals for the selected fight.', 'scope-report'));\n  const report = await getScopeReport();",
  'cached players');
app = replaceOnce(app,
  "async function renderRotation(epoch = renderEpoch) {\n  replaceRoot(taskLoading('Loading power timing', 'Reading damaging power uses and checking them before display.', 'rotation-report'));\n  const report = await getRotationReport();",
  "async function renderRotation(epoch = renderEpoch) {\n  if (!state.rotation || state.rotationKey !== scopeKey()) replaceRoot(taskLoading('Loading power timing', 'Reading damaging power uses and checking them before display.', 'rotation-report'));\n  const report = await getRotationReport();",
  'cached rotation');
app = replaceOnce(app,
  "function drawRotation(report) {\n  const filters = state.rotationFilters;",
  "function drawRotation(report) {\n  if (window.StrikeglassViewportTimeline) return;\n  const filters = state.rotationFilters;",
  'viewport timeline guard');
app = replaceOnce(app,
  '<section class="verification-strip">${verificationBadge(report.verification)}<span>Canonical damage: Physical · values remain local</span></section>',
  '<section class="verification-strip">${verificationBadge(report.verification)}<span>Canonical damage: Physical · values remain local</span><button class="button" type="button" data-dashboard-customize>Customize overview</button></section>',
  'dashboard opt-in');
app = replaceOnce(app,
  "    else if (state.view === 'powers') await renderPowers(epoch);\n    else if (state.view === 'events') renderEvents();\n    else renderDiagnostics();\n    if (epoch !== renderEpoch) return;\n    if (!el.root.querySelector('[data-task-loading],.rotation-panel,.raw-hits-panel') && el.root.querySelectorAll('tr').length < 100) revealView(el.root);",
  "    else if (state.view === 'powers') await renderPowers(epoch);\n    else if (state.view === 'debuffs') replaceRoot(taskLoading('Loading team debuffs', 'Reconstructing verified effect timing for the selected fight.', 'effect-intelligence-report'));\n    else if (state.view === 'events') renderEvents();\n    else renderDiagnostics();\n    if (epoch !== renderEpoch) return;\n    if (!el.root.querySelector('[data-task-loading],.rotation-panel,.raw-hits-panel') && el.root.querySelectorAll('tr').length < 100) revealView(el.root);\n    document.dispatchEvent(new CustomEvent('strikeglass:view-rendered', { detail: { view: state.view, epoch } }));",
  'view rendered event');
app = replaceOnce(app,
  "  status('Combat verified · Effect Engine ready', 'good');\n  warmCharts();\n  render();",
  "  status('Combat verified · Effect Engine ready', 'good');\n  warmCharts();\n  document.dispatchEvent(new CustomEvent('strikeglass:analysis-ready', { detail: { parsed: summary.parsed || 0 } }));\n  render();",
  'analysis ready event');
await save('src/v3/app.js', app);

let index = await text('index.html');
const navMarkup = `      <nav id="app-nav" class="nav-list">
        <div class="nav-section nav-section-analyze" role="group" aria-label="Analyze">
          <span class="nav-section-label">Analyze</span>
          <button class="nav-item is-active" type="button" data-view="overview" aria-current="page"><svg><use href="#i-grid"/></svg><span class="nav-copy"><strong>Overview</strong><small>Session totals and the main story</small></span></button>
          <button class="nav-item" type="button" data-view="rotation" disabled><svg><use href="#i-rotation"/></svg><span class="nav-copy"><strong>Fight Timeline</strong><small>When powers and team debuffs happened</small></span></button>
          <button class="nav-item" type="button" data-view="boss" disabled><svg><use href="#i-boss"/></svg><span class="nav-copy"><strong>Bosses</strong><small>Boss-only fights and phases</small></span></button>
          <button class="nav-item" id="debuff-uptime-nav" type="button" data-view="debuffs" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M4.2 7.5l3.5 2M16.3 14.5l3.5 2M4.2 16.5l3.5-2M16.3 9.5l3.5-2M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"/></svg><span class="nav-copy"><strong>Team Debuffs</strong><small>What made the boss take more damage</small></span></button>
          <button class="nav-item" type="button" data-view="players" disabled><svg><use href="#i-users"/></svg><span class="nav-copy"><strong>Players</strong><small>Individual player performance</small></span></button>
          <button class="nav-item" type="button" data-view="powers" disabled><svg><use href="#i-bolt"/></svg><span class="nav-copy"><strong>Damage &amp; Powers</strong><small>What the selected player used</small></span></button>
          <button class="nav-item" type="button" data-view="comparison" disabled><svg><use href="#i-compare"/></svg><span class="nav-copy"><strong>Compare</strong><small>Players side by side</small></span></button>
        </div>
        <div class="nav-section nav-section-advanced" role="group" aria-label="Advanced">
          <span class="nav-section-label">Advanced</span>
          <button class="nav-item" type="button" data-view="encounters" disabled><svg><use href="#i-swords"/></svg><span class="nav-copy"><strong>All Fights</strong><small>Every detected combat window</small></span></button>
          <button class="nav-item" type="button" data-view="events" disabled><svg><use href="#i-list"/></svg><span class="nav-copy"><strong>Raw Events</strong><small>Parsed combat-log rows</small></span></button>
          <button class="nav-item" type="button" data-view="diagnostics" disabled><svg><use href="#i-diagnostic"/></svg><span class="nav-copy"><strong>Analysis Checks</strong><small>Parser and engine verification</small></span></button>
        </div>
      </nav>`;
index = replaceRegex(index, /      <nav id="app-nav" class="nav-list">[\s\S]*?      <\/nav>/, navMarkup, 'static navigation');
for (const line of [
  '  <script type="module" src="src/v7/boss-effects.js"></script>\n',
  '  <script type="module" src="src/v11/navigation-shell.js"></script>\n',
  '  <script type="module" src="src/v6/dashboard.js"></script>\n',
  '  <script type="module" src="src/v6/dashboard-interactions.js"></script>\n',
  '  <script type="module" src="src/v6/copy.js"></script>\n',
  '  <script type="module" src="src/v6/drawer-copy.js"></script>\n'
]) index = replaceOnce(index, line, '', `remove eager script ${line.trim()}`);
await save('index.html', index);

let effects = await text('src/v7/boss-effects.js');
effects = replaceOnce(effects,
  "  observer?.disconnect();\n  root.innerHTML = html;\n  observer?.observe(root, { childList: true, subtree: false });",
  "  root.innerHTML = html;",
  'debuff page observer writes');
effects = replaceRegex(effects,
  /observer = new MutationObserver\(\(\) => \{[\s\S]*?if \(root\) observer\.observe\(root, \{ childList: true, subtree: false \}\);\n/,
  "document.addEventListener('strikeglass:view-rendered', event => {\n  if (event.detail?.view === 'debuffs') scheduleRefresh();\n});\n",
  'debuff observer removal');
effects += "\nif (isDebuffView()) scheduleRefresh();\n";
await save('src/v7/boss-effects.js', effects);

let dashboard = await text('src/v6/dashboard.js');
dashboard = replaceRegex(dashboard,
  /function loadGsap\(\) \{[\s\S]*?\n\}/,
  "function loadGsap() { return Promise.resolve(null); }",
  'dashboard remote motion removal');
await save('src/v6/dashboard.js', dashboard);

let copy = await text('src/v6/copy.js');
copy = replaceRegex(copy,
  /if \(viewRoot\) \{\n  new MutationObserver\(scheduleCopy\)[\s\S]*?nav\?\.addEventListener\('click', \(\) => requestAnimationFrame\(scheduleCopy\)\);\n\nscheduleCopy\(\);/,
  "document.addEventListener('strikeglass:view-rendered', scheduleCopy);\ndocument.addEventListener('strikeglass:copy-refresh', scheduleCopy);\ndocument.addEventListener('strikeglass:dashboard-ready', scheduleCopy);\nnav?.addEventListener('click', () => requestAnimationFrame(scheduleCopy));\n\nscheduleCopy();",
  'copy mutation observers');
await save('src/v6/copy.js', copy);

let runtime = await text('src/v12/runtime.js');
runtime = replaceOnce(runtime,
  "    if (view === 'powers') return Promise.all([loadPowerTools(), loadQol()]);",
  "    if (view === 'powers') return Promise.all([loadPowerTools(), loadQol(), loadOnce('power-interactions', () => import('./power-timing-viewport.js'))]);",
  'power category interaction layer');
await save('src/v12/runtime.js', runtime);

let copyRegression = await text('scripts/copy-regression.mjs');
copyRegression = replaceOnce(copyRegression,
  "assert.ok(copy.includes(\"observe(viewRoot, { childList: true, subtree: false })\"), 'copy observer must only watch top-level view swaps');\nassert.ok(!copy.includes(\"observe(viewRoot, { childList: true, subtree: true })\"), 'copy observer must not rescan the whole UI for chart mutations');",
  "assert.ok(copy.includes(\"strikeglass:view-rendered\"), 'copy layer must refresh from explicit view lifecycle events');\nassert.ok(!copy.includes('new MutationObserver'), 'copy layer must not observe DOM mutations in the hot path');",
  'copy regression lifecycle');
await save('scripts/copy-regression.mjs', copyRegression);

let powerRegression = await text('scripts/power-timing-interaction-regression.mjs');
powerRegression = powerRegression.replace("../src/v10/power-timing-interactions.js", "../src/v12/power-timing-viewport.js");
powerRegression = powerRegression.replace("'MAX_TIMELINE_WIDTH = 30000','maxZoomForReport','32760'", "'MAX_WORLD_WIDTH = 200000','maxZoomForReport','lowerBound','desynchronized'");
powerRegression = replaceOnce(powerRegression,
  "assert.ok(drilldown.includes(\"../v10/power-timing-interactions.js\"));",
  "assert.ok(drilldown.includes(\"../v12/runtime.js\"));\nassert.ok(!drilldown.includes(\"../v10/power-timing-interactions.js\"));",
  'power drilldown lazy runtime test');
await save('scripts/power-timing-interaction-regression.mjs', powerRegression);

const performanceRegression = `import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const [app, worker, verifier, charts, motion, copy, styles, index, runtime, viewport, drilldown, dashboard] = await Promise.all([
  readFile('src/v3/app.js', 'utf8'),
  readFile('src/workers/fast-parse-worker.js', 'utf8'),
  readFile('src/engine/verification-engine.js', 'utf8'),
  readFile('src/v3/charts.js', 'utf8'),
  readFile('src/v3/motion.js', 'utf8'),
  readFile('src/v6/copy.js', 'utf8'),
  readFile('src/v6/performance.css', 'utf8'),
  readFile('index.html', 'utf8'),
  readFile('src/v12/runtime.js', 'utf8'),
  readFile('src/v12/power-timing-viewport.js', 'utf8'),
  readFile('src/v3/power-drilldown.js', 'utf8'),
  readFile('src/v6/dashboard.js', 'utf8')
]);

for (const marker of ['task-loading','task-progress','renderEpoch','StrikeglassViewportTimeline','strikeglass:view-rendered','strikeglass:analysis-ready','data-dashboard-customize']) assert.ok(app.includes(marker), 'app missing '+marker);
for (const marker of ['postTaskProgress','categoryCounts','await sleep()',"'verify-rotation'",'return { report: cached, verification: cached.verification, error: null }']) assert.ok(worker.includes(marker), 'worker missing '+marker);
for (const marker of ['seriesInOrder','orderedSeries','PROGRESS_ROWS','hashText','VERIFICATION_ENGINE_VERSION = 5']) assert.ok(verifier.includes(marker), 'verifier missing '+marker);
assert.ok(!verifier.includes('Math.min(...partySeries.map'), 'verifier must not spread full session timelines');
assert.ok(!/function rotationChecksum[\\s\\S]*?flatMap/.test(verifier), 'rotation checksum must stream');
for (const marker of ['IntersectionObserver','requestIdleCallback','chart-lazy-placeholder','rootMargin','desynchronized','ResizeObserver','native-timeline-chart']) assert.ok(charts.includes(marker), 'charts missing '+marker);
assert.ok(!charts.includes('cdn.jsdelivr.net') && !charts.includes('uPlot'), 'charts must be local native Canvas with no runtime CDN');
assert.ok(motion.includes('element.animate'), 'motion must use native Web Animations');
assert.ok(!motion.includes('gsap') && !motion.includes('cdn.jsdelivr.net'), 'motion must not fetch a runtime animation library');
assert.ok(copy.includes('strikeglass:view-rendered'), 'copy must use explicit lifecycle events');
assert.ok(!copy.includes('new MutationObserver'), 'copy must not use mutation observers in the hot path');
assert.ok(!dashboard.includes('cdn.jsdelivr.net'), 'dashboard must not fetch GSAP from a CDN');
for (const marker of ['PerformanceObserver','probeFrames','requestIdleCallback',"import('../v7/boss-effects.js')","import('../v8/index.js')","import('./power-timing-viewport.js')"]) assert.ok(runtime.includes(marker), 'runtime missing '+marker);
for (const marker of ['MAX_ZOOM = 12','MAX_WORLD_WIDTH = 200000','lowerBound','OVERSCAN_PX','scroll.clientWidth','desynchronized','requestAnimationFrame','effect-intelligence-report']) assert.ok(viewport.includes(marker), 'viewport timeline missing '+marker);
assert.ok(!viewport.includes('overlay.width = Math.max(1, Math.floor(width'), 'viewport timeline must not allocate world-width canvases');
assert.ok(drilldown.includes('../v12/runtime.js') && !drilldown.includes('../v8/index.js') && !drilldown.includes('../v10/power-timing-interactions.js'), 'bootstrap must stay lightweight');
for (const eager of ['src/v7/boss-effects.js','src/v11/navigation-shell.js','src/v6/dashboard.js','src/v6/dashboard-interactions.js','src/v6/copy.js','src/v6/drawer-copy.js']) assert.ok(!index.includes('<script type="module" src="'+eager+'"></script>'), eager+' must not load eagerly');
assert.ok(index.includes('data-view="debuffs"'), 'Team Debuffs navigation must exist without loading its feature module');
for (const marker of ['.task-loading{','content-visibility:auto','@media(prefers-reduced-motion:reduce)']) assert.ok(styles.includes(marker), 'performance styles missing '+marker);

console.log('Performance regression passed. Route features load on demand, charts and motion have no CDN dependency, mutation observers are removed from copy/debuff hot paths, cached route revisits skip skeletons, and Power Timing draws only the visible viewport.');
`;
await save('scripts/performance-regression.mjs', performanceRegression);

const pkg = JSON.parse(await text('package.json'));
for (const file of ['src/v12/runtime.js','src/v12/power-timing-viewport.js']) {
  if (!pkg.scripts.syntax.includes(file)) pkg.scripts.syntax += ` && node --check ${file}`;
}
await save('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

console.log('Applied Strikeglass high-refresh runtime refactor.');
