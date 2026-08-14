import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, transform) {
  const original = await readFile(path, 'utf8');
  const next = transform(original);
  if (next === original) throw new Error(`No changes applied to ${path}`);
  await writeFile(path, next);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(before, after);
}

await patch('src/workers/fast-parse-worker.js', source => {
  let next = replaceOnce(
    source,
    "import { verifyReport, verifyRotationReport } from '../engine/verification-engine.js';",
    "import { verifyReport, verifyRotationReport } from '../engine/verification-engine.js';\nimport { analyzeEffectIntelligence } from '../engine/effect-intelligence-engine.js';",
    'worker effect import'
  );
  next = replaceOnce(
    next,
    'const rotationCache = new Map();',
    'const rotationCache = new Map();\nconst effectCache = new Map();',
    'effect cache'
  );
  const marker = 'async function parseFile(file, generation) {';
  const builder = `async function buildEffectIntelligenceReport(scope = { type: 'session' }, requestId = 0) {\n  const key = scopeKey(scope);\n  const cached = effectCache.get(key);\n  if (cached) {\n    postTaskProgress(requestId, 'effect-intelligence-report', 'cached', 1, 'Using saved effect analysis');\n    return { report: cached, error: null };\n  }\n  if (activeSummary?.verification?.status !== 'verified') return { report: null, error: 'Effect analysis is blocked until both combat engines verify the session.' };\n  const store = activeStore;\n  const generation = activeGeneration;\n  if (!store) return { report: null, error: 'No combat log is loaded.' };\n  const info = store.scopeInfo(scope);\n  if (!info) return { report: null, error: 'Scope is unavailable.' };\n  const rows = [];\n  const totalRows = Math.max(1, info.endIndex - info.startIndex);\n  postTaskProgress(requestId, 'effect-intelligence-report', 'effect-scan', .03, 'Finding effect signals');\n  let scanned = 0;\n  for (const row of store.iterateScope(scope)) {\n    rows.push(row);\n    scanned += 1;\n    if (scanned % 4096 === 0) {\n      postTaskProgress(requestId, 'effect-intelligence-report', 'effect-scan', .03 + .42 * Math.min(1, scanned / totalRows), 'Finding effect signals');\n      await sleep();\n      if (generation !== activeGeneration || store !== activeStore) return { report: null, error: 'Effect analysis was cancelled.' };\n    }\n  }\n  postTaskProgress(requestId, 'effect-intelligence-report', 'effect-timeline', .48, 'Building effect intervals and target states');\n  await sleep();\n  const report = analyzeEffectIntelligence(rows, {\n    scope: { type: info.type, id: info.id, targetOnly: info.targetOnly, label: info.label, bosses: info.bosses || [] },\n    scopeStart: info.start,\n    scopeEnd: info.end\n  });\n  if (generation !== activeGeneration || store !== activeStore) return { report: null, error: 'Effect analysis was cancelled.' };\n  postTaskProgress(requestId, 'effect-intelligence-report', 'effect-baseline', .78, 'Comparing damage with clean baselines');\n  await sleep();\n  if (report.verification?.status === 'blocked') {\n    return { report: null, error: 'Effect timeline verification failed. Strikeglass did not publish the debuff timeline.' };\n  }\n  cacheSet(effectCache, key, report, 8);\n  postTaskProgress(requestId, 'effect-intelligence-report', 'done', 1, report.verification?.status === 'attention' ? 'Effect timing ready with items to review' : 'Effect timing verified');\n  return { report, error: null };\n}\n\n`;
  next = replaceOnce(next, marker, builder + marker, 'effect report builder');
  next = next.replaceAll('scopeCache.clear();\n  rotationCache.clear();', 'scopeCache.clear();\n  rotationCache.clear();\n  effectCache.clear();');
  next = replaceOnce(
    next,
    "  activeSummary.verification = gate.verification;\n  if (gate.error) {",
    "  activeSummary.verification = gate.verification;\n  activeSummary.effectEngine = { status: gate.error ? 'blocked' : 'ready', engine: 'Effect Intelligence V1', mode: 'scope-on-demand' };\n  if (gate.error) {",
    'effect readiness metadata'
  );
  next = replaceOnce(
    next,
    "  if (message.type === 'raw-page') {",
    "  if (message.type === 'effect-intelligence-report') {\n    const result = await buildEffectIntelligenceReport(message.scope || { type: 'session' }, message.requestId);\n    self.postMessage({ type: 'effect-intelligence-report', requestId: message.requestId, report: result.report, error: result.error, verification: result.report?.verification || null });\n    return;\n  }\n  if (message.type === 'raw-page') {",
    'effect report message handler'
  );
  return next;
});

await patch('src/v10/power-timing-interactions.js', source => {
  let next = source
    .replace("import { analyzeCombatEffects } from '../engine/combat-effects.js';\n", '')
    .replace("import { analyzeBossEffects } from '../engine/boss-effects.js';\n", '')
    .replace("import { isBossRef } from '../engine/fast-parser-core.js';\n", '')
    .replace("import { isTeamDamageSupportEffect } from '../data/support-effect-catalog.js';\n", '');
  const detectorBlock = /async function readVerifiedScopeRows\(scope\) \{[\s\S]*?\n\}\n\nfunction debuffsNearActivation/;
  if (!detectorBlock.test(next)) throw new Error('Missing Power Timing debuff detector block');
  next = next.replace(detectorBlock, `async function loadTeamDebuffTiming(scope) {\n  const effectReport = await workerRequest('effect-intelligence-report', { scope }, 90000);\n  if (!effectReport || effectReport.verification?.status === 'blocked') throw new Error('Verified effect timing is unavailable for this fight.');\n  return effectReport.timing || { windows: [], applications: [] };\n}\n\nfunction debuffsNearActivation`);
  const oldLoad = `      readVerifiedScopeRows(scope).then(rows => {\n        if (generation !== reportGeneration || !panel.isConnected) return;\n        const timing = buildTeamDebuffTiming(rows, nextReport, scope);\n        debuffTimingCache.set(cacheKey, timing);\n        if (debuffTimingCache.size > 6) debuffTimingCache.delete(debuffTimingCache.keys().next().value);\n        debuffTiming = timing;\n        scheduleRepaint();\n      }).catch(() => {});`;
  const newLoad = `      loadTeamDebuffTiming(scope).then(timing => {\n        if (generation !== reportGeneration || !panel.isConnected) return;\n        debuffTimingCache.set(cacheKey, timing);\n        if (debuffTimingCache.size > 6) debuffTimingCache.delete(debuffTimingCache.keys().next().value);\n        debuffTiming = timing;\n        scheduleRepaint();\n      }).catch(() => {});`;
  next = replaceOnce(next, oldLoad, newLoad, 'Power Timing Engine 3 request');
  next = replaceOnce(
    next,
    'Purple glow marks a cast that applied a team damage debuff; green bands show verified timed debuff windows. Hover a power use for details.',
    'Purple glow marks a cast that applied a known team damage debuff; green bands come from the verified Effect Engine timeline. Hover a power use for details.',
    'Power Timing help copy'
  );
  return next;
});

await patch('index.html', source => {
  let next = replaceOnce(
    source,
    '<link rel="stylesheet" href="src/v7/boss-effects.css">',
    '<link rel="stylesheet" href="src/v7/boss-effects.css">\n  <link rel="stylesheet" href="src/v11/navigation-shell.css">',
    'navigation stylesheet'
  );
  next = replaceOnce(
    next,
    '<section class="panel status-panel">\n                <div class="panel-head"><h2>Ready to analyze</h2></div>\n                <dl class="status-list"><div><dt>Damage calculation</dt><dd>Ready</dd></div><div><dt>Second check</dt><dd class="good-text">Ready</dd></div><div><dt>Data handling</dt><dd class="good-text">Local only</dd></div></dl>\n              </section>',
    '<section class="panel status-panel">\n                <div class="panel-head"><h2>Analysis engines</h2></div>\n                <dl class="engine-ready-list">\n                  <div><dt>Combat calculation<small>Damage, DPS, players, powers and fights</small></dt><dd>Ready</dd></div>\n                  <div><dt>Independent combat check<small>Rebuilds important combat totals separately</small></dt><dd>Ready</dd></div>\n                  <div><dt>Effect intelligence<small>Debuff timing plus clean-hit damage verification</small></dt><dd>Ready</dd></div>\n                  <div><dt>Data handling<small>The combat log remains on this device</small></dt><dd>Local only</dd></div>\n                </dl>\n              </section>',
    'empty engine status'
  );
  next = replaceOnce(
    next,
    '<ol><li>Read the log in the background so the page stays responsive.</li><li>Count Physical damage and build player and fight summaries.</li><li>Show results only after a second calculation matches.</li></ol>',
    '<ol><li>Parse the combat log once into a shared event store.</li><li>Calculate combat results and independently check the important totals.</li><li>Reconstruct team-debuff applications, refreshes, and target states.</li><li>Compare debuff windows with matched clean-hit damage when enough samples exist.</li></ol>',
    'empty flow copy'
  );
  next = replaceOnce(
    next,
    '<script type="module" src="src/v7/boss-effects.js"></script>',
    '<script type="module" src="src/v7/boss-effects.js"></script>\n  <script type="module" src="src/v11/navigation-shell.js"></script>',
    'navigation module'
  );
  return next;
});

await patch('src/v3/app.js', source => {
  let next = replaceOnce(
    source,
    "    overview: 'Session overview',\n    rotation: 'Party rotation',\n    comparison: 'Player comparison',\n    boss: 'Boss analysis',\n    encounters: 'Encounters',\n    players: 'Party performance',\n    powers: 'Damage out',\n    events: 'Event explorer',\n    diagnostics: 'Parser diagnostics'",
    "    overview: 'Overview',\n    rotation: 'Fight Timeline',\n    comparison: 'Compare',\n    boss: 'Bosses',\n    encounters: 'All Fights',\n    players: 'Players',\n    powers: 'Damage & Powers',\n    events: 'Raw Events',\n    diagnostics: 'Analysis Checks',\n    debuffs: 'Team Debuffs'",
    'plain view titles'
  );
  next = replaceOnce(
    next,
    "  status('Verified · 2 engines', 'good');",
    "  status('Combat verified · Effect Engine ready', 'good');",
    'ready status'
  );
  next = replaceOnce(
    next,
    "    const phaseText = progress.phase === 'indexing' ? 'Indexing encounter windows...' : progress.phase === 'verifying' ? 'Engine 2 independently verifying all metrics...' : progress.phase === 'finalizing' ? 'Publishing verified aggregates...' : 'Engine 1 streaming and aggregating...';",
    "    const phaseText = progress.phase === 'indexing' ? 'Indexing fights and targets...' : progress.phase === 'verifying' ? 'Engine 2 independently verifying combat metrics...' : progress.phase === 'finalizing' ? 'Preparing the shared analysis store...' : 'Engine 1 reading and aggregating the log...';",
    'parse phase copy'
  );
  next = replaceOnce(
    next,
    "    <section class=\"verification-strip\">${verificationBadge(verification)}<span>Checksum ${esc(verification.checksum || '—')}</span></section>",
    "    <section class=\"verification-strip\">${verificationBadge(verification)}<span>Combat engines matched · Effect Intelligence ${esc(summary.effectEngine?.status || 'on demand')}</span></section>",
    'diagnostic engine status'
  );
  return next;
});

console.log('Applied Effect Intelligence + navigation integration patches.');
