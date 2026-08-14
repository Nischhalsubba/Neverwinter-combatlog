import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

// 1) Define the player-facing meaning of a team damage debuff.
{
  const path = 'src/data/support-effect-catalog.js';
  let text = read(path);
  const anchor = `export function describeEffectChanges(entry) {`;
  const helper = `const TEAM_DAMAGE_REDUCTION_STATS = new Set(['Defense', 'Awareness', 'Critical Avoidance', 'Deflect']);\n\nexport function isTeamDamageSupportEffect(entryOrName) {\n  const entry = typeof entryOrName === 'string' ? findSupportEffect(entryOrName) : entryOrName;\n  if (!entry) return false;\n  if (entry.classification === 'target-advantage') return true;\n  if (entry.classification !== 'enemy-debuff') return false;\n  return (entry.changes || []).some(change => {\n    if (change.stat === 'Damage Taken') return change.direction === 'up';\n    return TEAM_DAMAGE_REDUCTION_STATS.has(change.stat) && change.direction !== 'up';\n  });\n}\n\n${anchor}`;
  text = replaceOnce(text, anchor, helper, 'support-effect offensive helper anchor');
  text = replaceOnce(text, 'export const SUPPORT_EFFECT_CATALOG_VERSION = 1;', 'export const SUPPORT_EFFECT_CATALOG_VERSION = 2;', 'support catalog version');
  write(path, text);
}

// 2) Keep source identity and exact application times for the verified ring debuff.
{
  const path = 'src/engine/boss-effects.js';
  let text = read(path);
  text = replaceOnce(
    text,
    `    description: "Lowers the boss's Defense and Awareness by 3.5%",\n    match(row) {`,
    `    description: "Lowers the boss's Defense and Awareness by 3.5%",\n    sourceType: 'Ring',\n    sourceName: "Eilistraee's Grace",\n    match(row) {`,
    'Midnight source metadata'
  );
  text = replaceOnce(
    text,
    `      description: definition.description,\n      duration: definition.duration,\n      applications: effect.applications.length,\n      seconds: teamCoverage?.seconds ?? null,\n      uptime: teamCoverage?.uptime ?? null,\n      sources: bySource`,
    `      description: definition.description,\n      duration: definition.duration,\n      sourceType: definition.sourceType || '',\n      sourceName: definition.sourceName || '',\n      timeline: effect.applications.map(application => ({ ...application })),\n      applications: effect.applications.length,\n      seconds: teamCoverage?.seconds ?? null,\n      uptime: teamCoverage?.uptime ?? null,\n      sources: bySource`,
    'boss compact timeline metadata'
  );
  write(path, text);
}

// 3) Preserve deduplicated application times from the combat-effect engine for timeline visualization.
{
  const path = 'src/engine/combat-effects.js';
  let text = read(path);
  text = replaceOnce(
    text,
    `    source: group.meta.source || null,\n    applications: group.applications,\n    sources,`,
    `    source: group.meta.source || null,\n    applications: group.applications,\n    timeline: group.events.map(event => ({ ...event })),\n    sources,`,
    'combat effect timeline metadata'
  );
  write(path, text);
}

// 4) Replace the player-facing Debuff page with one focused list: effects that help the party hurt the boss more.
{
  const path = 'src/v7/boss-effects.js';
  let text = read(path);
  text = replaceOnce(
    text,
    `import { ENCOUNTER_POWER_ICON_SPRITE, findEncounterPowerIcon } from '../data/encounter-power-icons.js';`,
    `import { ENCOUNTER_POWER_ICON_SPRITE, findEncounterPowerIcon } from '../data/encounter-power-icons.js';\nimport { isTeamDamageSupportEffect } from '../data/support-effect-catalog.js';`,
    'Debuff UI support-effect import'
  );
  text = replaceOnce(text, `<span>Debuff Uptime</span>`, `<span>Team Debuffs</span>`, 'Debuff nav label');
  text = replaceOnce(
    text,
    `<div><span class="eyebrow">\${esc(selectedFightLabel())}</span><h2>Debuffs</h2><p>Actual enemy debuffs are listed first. Party buffs, personal target effects, enemy mechanics, and unknown status signals are kept separate so they are not mislabeled as debuffs.</p></div>`,
    `<div><span class="eyebrow">\${esc(selectedFightLabel())}</span><h2>Team Debuffs</h2><p>Only effects that help your party deal more damage to the boss are shown here: enhancements, support gear, class powers, companions, mounts, artifacts, and other verified team damage debuffs.</p></div>`,
    'Debuff page intro'
  );

  const insertAnchor = `function pageFrame(content, { busy = false } = {}) {`;
  const helpers = `function teamDebuffSource(effect) {\n  if (effect?.sourceType || effect?.sourceName) return { type: effect.sourceType || 'Gear', name: effect.sourceName || '' };\n  if (effect?.id === 'midnights-malady') return { type: 'Ring', name: "Eilistraee's Grace" };\n  const family = String(effect?.family || '');\n  if (family === 'companion-enhancement') return { type: 'Enhancement', name: '' };\n  if (family === 'class-power') return { type: 'Class power', name: '' };\n  if (family === 'class-feat' || family === 'class-effect') return { type: 'Class effect', name: '' };\n  if (family === 'companion') return { type: 'Companion', name: '' };\n  if (family === 'mount') return { type: 'Mount', name: '' };\n  if (family === 'artifact') return { type: 'Artifact', name: '' };\n  return { type: 'Team debuff', name: '' };\n}\n\nfunction teamDebuffChanges(effect) {\n  if (effect?.id === 'midnights-malady') return 'Defense -3.5% · Awareness -3.5%';\n  return changeCopy(effect);\n}\n\nfunction teamDebuffTiming(effect, showTiming = true) {\n  if (!showTiming) return null;\n  if (effect?.audience === 'team' && Number.isFinite(effect.uptime)) {\n    return { uptime: effect.uptime, seconds: effect.seconds, activeTime: null };\n  }\n  return effect?.timedTargets?.find(target => target.verified) || null;\n}\n\nfunction teamDebuffDetails(effect, showTiming = true) {\n  const source = teamDebuffSource(effect);\n  const timing = teamDebuffTiming(effect, showTiming);\n  const changes = teamDebuffChanges(effect);\n  const sourceText = source.name ? \`\${source.type} · \${source.name}\` : source.type;\n  const result = timing ? percent(timing.uptime) : \`\${effect.applications || 0}x\`;\n  const resultLabel = timing ? 'uptime' : 'seen';\n  return \`<details class="debuff-item debuff-inventory-item">\n    <summary>\n      <div class="debuff-item-identity">\${effectIcon(effect)}<div class="debuff-item-name"><span>\${esc(sourceText)}</span><strong>\${esc(effect.name)}</strong><small>\${esc(effect.description || 'Helps the party deal more damage to the target.')}</small></div></div>\n      <div class="debuff-item-result"><strong>\${esc(result)}</strong><span>\${esc(resultLabel)}</span></div>\n    </summary>\n    <div class="debuff-item-body">\n      \${changes ? \`<p class="debuff-time-copy"><strong>Damage help:</strong> \${esc(changes)}</p>\` : ''}\n      <p class="debuff-time-copy"><strong>Source:</strong> \${esc(sourceText)}</p>\n      \${Number.isFinite(effect.duration) && effect.duration > 0 ? \`<p class="debuff-time-copy"><strong>Duration:</strong> \${duration(effect.duration)} per application.</p>\` : '<p class="debuff-time-copy">This effect is detected, but Strikeglass does not guess an uptime until its duration is safe to time.</p>'}\n      <div class="debuff-who"><h4>Who applied it</h4>\${inventorySources(effect)}</div>\n    </div>\n  </details>\`;\n}\n\n${insertAnchor}`;
  text = replaceOnce(text, insertAnchor, helpers, 'Team debuff UI helper anchor');

  const renderPattern = /function renderAnalysis\(\{ bossResult, combatResult, scope \}\) \{[\s\S]*?\n\}\n\nfunction observeRoot\(\) \{/;
  if (!renderPattern.test(text)) throw new Error('Missing renderAnalysis block');
  const render = `function renderAnalysis({ bossResult, combatResult }) {\n  const bossVerified = !bossResult || bossResult.verification?.ok;\n  const catalogVerified = combatResult.verification?.ok;\n  const bossDebuffs = bossVerified ? (bossResult?.effects || []).filter(effect => effect.audience === 'team') : [];\n  const catalogDebuffs = [\n    ...(combatResult.debuffsOnEnemies || []),\n    ...(combatResult.targetAdvantageEffects || [])\n  ].filter(effect => effect.family !== 'boss' && isTeamDamageSupportEffect(effect));\n  const sourceOrder = { Enhancement: 0, Ring: 1, 'Class power': 2, 'Class effect': 3, Companion: 4, Mount: 5, Artifact: 6, 'Team debuff': 7 };\n  const teamEffects = [...bossDebuffs, ...catalogDebuffs].sort((left, right) => {\n    const a = teamDebuffSource(left).type;\n    const b = teamDebuffSource(right).type;\n    return (sourceOrder[a] ?? 20) - (sourceOrder[b] ?? 20) || left.name.localeCompare(right.name);\n  });\n  const checksMatch = bossVerified && catalogVerified;\n  const timedCount = teamEffects.filter(effect => teamDebuffTiming(effect, checksMatch)).length;\n  const totalApplications = teamEffects.reduce((sum, effect) => sum + Number(effect.applications || 0), 0);\n  const list = teamEffects.length\n    ? \`<div class="debuff-list">\${teamEffects.map(effect => teamDebuffDetails(effect, checksMatch)).join('')}</div>\`\n    : '<div class="empty-block">No party damage debuff was found in this fight. Personal-only procs, defensive boss mechanics, and unrelated status effects are intentionally not shown here.</div>';\n\n  replacePage(pageFrame(\`\n    <section class="debuff-summary" aria-label="Team debuff summary">\n      <article><span>Team debuffs</span><strong>\${teamEffects.length}</strong><small>Effects that help the party damage the target.</small></article>\n      <article><span>With uptime</span><strong>\${timedCount}</strong><small>Only safely timed effects get a percentage.</small></article>\n      <article><span>Times applied</span><strong>\${totalApplications}</strong><small>Duplicate metadata at the same moment is merged.</small></article>\n      <article><span>Uptime check</span><strong class="\${checksMatch ? 'good-text' : 'bad-text'}">\${checksMatch ? 'Matched' : 'Hidden'}</strong><small>\${checksMatch ? 'Independent calculations agreed.' : 'Uptime stays hidden until both calculations agree.'}</small></article>\n    </section>\n    <section class="panel debuff-results">\n      <div class="panel-head"><div><span class="eyebrow">Party damage only</span><h2>What made the boss take more damage?</h2></div><span>\${teamEffects.length}</span></div>\n      <p class="debuff-results-help">Enhancements, Eilistraee's Grace / Midnight's Malady, class debuffs, support companions, mounts, artifacts, and other verified effects appear here only when they help party damage.</p>\n      \${list}\n    </section>\n    \${!checksMatch ? '<section class="panel verification-blocked"><div class="empty-block bad-text">Effect applications are still listed from the verified combat rows, but uptime percentages are hidden because the two uptime calculations did not agree.</div></section>' : ''}\n  \`));\n}\n\nfunction observeRoot() {`;
  text = text.replace(renderPattern, render);
  text = text.replaceAll(`workspaceTitle.textContent = 'Debuffs'`, `workspaceTitle.textContent = 'Team Debuffs'`);
  write(path, text);
}

// 5) Make the summary fit the simpler four-card contract without extra sections.
{
  const path = 'src/v7/boss-effects.css';
  let text = read(path);
  // Retain four compact summary cards, but make the page visibly focused and avoid decorative leftovers.
  if (!text.includes('.debuff-summary{')) throw new Error('Missing debuff summary CSS');
  write(path, text);
}

// 6) Add deep zoom plus verified team-debuff windows/glows to Power Timing.
{
  const path = 'src/v10/power-timing-interactions.js';
  let text = read(path);
  text = replaceOnce(
    text,
    `import { findEncounterPowerIcon, loadEncounterPowerIconSprite } from '../data/encounter-power-icons.js';`,
    `import { findEncounterPowerIcon, loadEncounterPowerIconSprite } from '../data/encounter-power-icons.js';\nimport { analyzeCombatEffects } from '../engine/combat-effects.js';\nimport { analyzeBossEffects } from '../engine/boss-effects.js';\nimport { isBossRef } from '../engine/fast-parser-core.js';\nimport { isTeamDamageSupportEffect } from '../data/support-effect-catalog.js';`,
    'Power Timing debuff imports'
  );
  text = replaceOnce(text, `const MAX_ZOOM = 5;\nconst BASE_PX_PER_SECOND = 3;`, `const MAX_ZOOM = 12;\nconst MAX_TIMELINE_WIDTH = 30000;\nconst BASE_PX_PER_SECOND = 3;`, 'Power Timing zoom constants');
  text = replaceOnce(text, `const laneHitboxes = new Map();`, `const laneHitboxes = new Map();\nlet debuffTiming = { windows: [], applications: [] };\nconst debuffTimingCache = new Map();`, 'Power Timing debuff state');
  text = replaceOnce(text, `return Math.max(timelineViewport(panel), Math.min(12000, Math.ceil(Math.max(1, Number(report?.duration) || 1) * BASE_PX_PER_SECOND * zoom)));`, `return Math.max(timelineViewport(panel), Math.min(MAX_TIMELINE_WIDTH, Math.ceil(Math.max(1, Number(report?.duration) || 1) * BASE_PX_PER_SECOND * zoom)));`, 'Power Timing width cap');

  const timingAnchor = `function syncScroll(panel, value, source = null) {`;
  const timingHelpers = `function mergeDebuffWindows(intervals) {\n  const ordered = intervals.filter(item => item.end > item.start).sort((a, b) => a.start - b.start || a.end - b.end);\n  const merged = [];\n  for (const interval of ordered) {\n    const previous = merged.at(-1);\n    if (!previous || interval.start > previous.end) merged.push({ ...interval });\n    else previous.end = Math.max(previous.end, interval.end);\n  }\n  return merged;\n}\n\nasync function readVerifiedScopeRows(scope) {\n  const rows = [];\n  let cursor = null;\n  do {\n    const page = await workerRequest('raw-page', { options: { cursor, limit: 500, scope } }, 45000);\n    if (!page?.verification || page.verification.status !== 'verified') throw new Error('Debuff timing is available only after both combat checks pass.');\n    rows.push(...(page.rows || []));\n    cursor = page.nextCursor;\n    if (rows.length && rows.length % 2500 === 0) await new Promise(resolve => setTimeout(resolve, 0));\n  } while (cursor != null);\n  return rows;\n}\n\nfunction buildTeamDebuffTiming(rows, nextReport, scope) {\n  const combat = analyzeCombatEffects(rows);\n  if (!combat.verification?.ok) return { windows: [], applications: [] };\n  const origin = Number(nextReport?.scope?.start) || 0;\n  const fightDuration = Math.max(0, Number(nextReport?.duration) || 0);\n  const applications = [];\n  const windows = [];\n  const register = (effect, canTime) => {\n    for (const event of effect.timeline || []) {\n      const time = Math.max(0, Math.min(fightDuration, Number(event.time) - origin));\n      applications.push({ time, name: effect.name, sourceRef: event.sourceRef || '', sourceName: event.sourceName || '' });\n      if (canTime && Number.isFinite(effect.duration) && effect.duration > 0) {\n        windows.push({ start: time, end: Math.min(fightDuration, time + effect.duration), name: effect.name });\n      }\n    }\n  };\n\n  const teamCatalog = [\n    ...(combat.debuffsOnEnemies || []),\n    ...(combat.targetAdvantageEffects || [])\n  ].filter(effect => effect.family !== 'boss' && isTeamDamageSupportEffect(effect));\n  for (const effect of teamCatalog) {\n    const canTime = effect.classification === 'enemy-debuff' && (effect.timedTargets || []).some(target => target.verified);\n    register(effect, canTime);\n  }\n\n  if (scope?.type === 'boss') {\n    const bossRows = rows.filter(row => isBossRef(row.targetRef));\n    const boss = analyzeBossEffects(bossRows);\n    if (boss.verification?.ok) {\n      for (const effect of boss.effects || []) if (effect.audience === 'team') register(effect, true);\n    }\n  }\n\n  applications.sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));\n  return { windows: mergeDebuffWindows(windows), applications };\n}\n\nfunction debuffsNearActivation(lane, item) {\n  const at = Number(item.time) || 0;\n  const names = new Set();\n  for (const application of debuffTiming.applications || []) {\n    if (Math.abs(application.time - at) > .9) continue;\n    const sameSource = application.sourceRef ? application.sourceRef === lane.ref : application.sourceName && application.sourceName === lane.name;\n    if (sameSource) names.add(application.name);\n  }\n  return Array.from(names);\n}\n\nfunction drawDebuffWindows(ctx, width, height) {\n  const duration = Math.max(1, Number(report?.duration) || 1);\n  ctx.save();\n  ctx.fillStyle = 'rgba(83, 128, 76, .20)';\n  for (const window of debuffTiming.windows || []) {\n    const left = Math.max(0, Math.min(width, window.start / duration * width));\n    const right = Math.max(left, Math.min(width, window.end / duration * width));\n    if (right > left) ctx.fillRect(left, 0, Math.max(1, right - left), height);\n  }\n  ctx.restore();\n}\n\nfunction drawDebuffGlow(ctx, x, y, size) {\n  ctx.save();\n  ctx.strokeStyle = '#c96ce7';\n  ctx.shadowColor = 'rgba(201,108,231,.9)';\n  ctx.shadowBlur = 13;\n  ctx.lineWidth = 2.2;\n  ctx.beginPath();\n  ctx.roundRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8, 6);\n  ctx.stroke();\n  ctx.restore();\n}\n\n${timingAnchor}`;
  text = replaceOnce(text, timingAnchor, timingHelpers, 'Power Timing team debuff helpers');

  text = replaceOnce(
    text,
    `<span><i class="is-deflect"></i>Deflected</span>' +\n      '<span><i class="is-size"></i>Bigger = more damage</span>`,
    `<span><i class="is-deflect"></i>Deflected</span>' +\n      '<span><i class="is-debuff-apply"></i>Debuff applied</span>' +\n      '<span><i class="is-debuff-window"></i>Debuff active</span>' +\n      '<span><i class="is-size"></i>Bigger = more damage</span>`,
    'Power Timing debuff legend'
  );
  text = replaceOnce(
    text,
    `help.textContent = 'Every verified player power use shares one clock. Drag to pan, wheel to zoom, and Shift + wheel to scroll. Blue, yellow, and gray marks show Combat Advantage, Critical, and Deflected hits. Hover a power use for verified details.';`,
    `help.textContent = 'Every verified player power use shares one clock. Drag to pan, wheel to zoom, and Shift + wheel to scroll. Purple glow marks a cast that applied a team damage debuff; green bands show verified timed debuff windows. Hover a power use for details.';`,
    'Power Timing help copy'
  );

  text = replaceOnce(
    text,
    `  const flags = '<div class="pt-tooltip-flags"><span class="is-crit">Crit ' + formatNumber(item.critHits) + '</span><span class="is-ca">Combat Adv. ' + formatNumber(item.caHits) + '</span><span class="is-deflect">Deflected ' + formatNumber(item.deflectedHits) + '</span></div>';\n  return '<strong class="pt-tooltip-title">' + escapeHtml(item.power) + '</strong><span class="pt-tooltip-meta">' + escapeHtml(hit.lane.name) + ' · ' + escapeHtml(item.category) + ' · ' + formatTime(item.time) + '</span>' + details + flags;`,
    `  const flags = '<div class="pt-tooltip-flags"><span class="is-crit">Crit ' + formatNumber(item.critHits) + '</span><span class="is-ca">Combat Adv. ' + formatNumber(item.caHits) + '</span><span class="is-deflect">Deflected ' + formatNumber(item.deflectedHits) + '</span></div>';\n  const debuffs = hit.debuffNames?.length ? '<div class="pt-tooltip-debuff"><strong>Team debuff applied</strong><span>' + hit.debuffNames.map(escapeHtml).join(', ') + '</span></div>' : '';\n  return '<strong class="pt-tooltip-title">' + escapeHtml(item.power) + '</strong><span class="pt-tooltip-meta">' + escapeHtml(hit.lane.name) + ' · ' + escapeHtml(item.category) + ' · ' + formatTime(item.time) + '</span>' + details + flags + debuffs;`,
    'Power Timing debuff tooltip'
  );

  text = replaceOnce(
    text,
    `  ctx.strokeStyle = 'rgba(120,145,162,.22)';\n  ctx.lineWidth = 1;`,
    `  drawDebuffWindows(ctx, width, height);\n  ctx.strokeStyle = 'rgba(120,145,162,.22)';\n  ctx.lineWidth = 1;`,
    'Power Timing window draw'
  );
  text = replaceOnce(
    text,
    `    drawIndicators(ctx, item, x, y, size);\n    hitboxes.push({ x, y, radius: Math.max(16, size * .62), item, lane, key });`,
    `    const debuffNames = debuffsNearActivation(lane, item);\n    if (debuffNames.length) drawDebuffGlow(ctx, x, y, size);\n    drawIndicators(ctx, item, x, y, size);\n    hitboxes.push({ x, y, radius: Math.max(16, size * .62), item, lane, key, debuffNames });`,
    'Power Timing application glow'
  );

  const enhanceBefore = `    const [nextReport, sprite] = await Promise.all([\n      workerRequest('rotation-report', { scope: currentScope() }, 45000),\n      loadEncounterPowerIconSprite().catch(() => null)\n    ]);\n    if (generation !== reportGeneration || !panel.isConnected) return;\n    if (nextReport?.verification?.status !== 'verified') return;\n    report = nextReport;\n    iconSprite = sprite;\n    fitZoom(panel);\n    paintRotation(panel);`;
  const enhanceAfter = `    const scope = currentScope();\n    const [nextReport, sprite] = await Promise.all([\n      workerRequest('rotation-report', { scope }, 45000),\n      loadEncounterPowerIconSprite().catch(() => null)\n    ]);\n    if (generation !== reportGeneration || !panel.isConnected) return;\n    if (nextReport?.verification?.status !== 'verified') return;\n    report = nextReport;\n    iconSprite = sprite;\n    debuffTiming = { windows: [], applications: [] };\n    fitZoom(panel);\n    paintRotation(panel);\n\n    const cacheKey = JSON.stringify(scope);\n    const cached = debuffTimingCache.get(cacheKey);\n    if (cached) {\n      debuffTiming = cached;\n      scheduleRepaint();\n    } else {\n      readVerifiedScopeRows(scope).then(rows => {\n        if (generation !== reportGeneration || !panel.isConnected) return;\n        const timing = buildTeamDebuffTiming(rows, nextReport, scope);\n        debuffTimingCache.set(cacheKey, timing);\n        if (debuffTimingCache.size > 6) debuffTimingCache.delete(debuffTimingCache.keys().next().value);\n        debuffTiming = timing;\n        scheduleRepaint();\n      }).catch(() => {});\n    }`;
  text = replaceOnce(text, enhanceBefore, enhanceAfter, 'Power Timing async debuff load');
  write(path, text);
}

// 7) Style the two timeline debuff cues without adding another visual subsystem.
{
  const path = 'src/v10/power-timing-interactions.css';
  let text = read(path);
  text = replaceOnce(
    text,
    `.pt-legend .is-ca{background:#62a9f5}.pt-legend .is-crit{background:#f2c94c}.pt-legend .is-deflect{background:#a9b4bd}.pt-legend .is-size{width:11px;height:11px;background:#8093a1;border:2px solid rgba(128,147,161,.35)}`,
    `.pt-legend .is-ca{background:#62a9f5}.pt-legend .is-crit{background:#f2c94c}.pt-legend .is-deflect{background:#a9b4bd}.pt-legend .is-debuff-apply{background:#c96ce7;box-shadow:0 0 0 2px rgba(201,108,231,.18)}.pt-legend .is-debuff-window{width:11px;height:8px;border-radius:2px;background:rgba(83,128,76,.62)}.pt-legend .is-size{width:11px;height:11px;background:#8093a1;border:2px solid rgba(128,147,161,.35)}`,
    'Power Timing debuff legend CSS'
  );
  text += `\n.pt-tooltip-debuff{display:grid;gap:2px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(201,108,231,.25)}.pt-tooltip-debuff strong{color:#e6a8f5}.pt-tooltip-debuff span{color:#d9c3df}\n`;
  write(path, text);
}

// 8) Update regressions to lock the simpler UI and the deeper timeline behavior.
{
  const path = 'scripts/boss-effects-regression.mjs';
  let text = read(path);
  const old = `assert.match(ui, />Debuff Uptime</);\nassert.match(ui, /Actual debuffs on enemies/);\nassert.match(ui, /Verified debuff uptime/);\nassert.match(ui, /Combat Advantage effects/);\nassert.match(ui, /Personal target effects/);\nassert.match(ui, /Party \\/ player buffs/);\nassert.match(ui, /Enemy buffs & mechanics/);\nassert.match(ui, /Other status signals/);`;
  const next = `assert.match(ui, />Team Debuffs</);\nassert.match(ui, /What made the boss take more damage\?/);\nassert.match(ui, /Party damage only/);\nassert.match(ui, /isTeamDamageSupportEffect/);\nassert.match(ui, /Eilistraee's Grace/);\nassert.doesNotMatch(ui, /section\\('Party \\/ player buffs'/);\nassert.doesNotMatch(ui, /section\\('Enemy buffs & mechanics'/);`;
  text = replaceOnce(text, old, next, 'boss UI regression expectations');
  write(path, text);
}

{
  const path = 'scripts/support-effect-catalog-regression.mjs';
  let text = read(path);
  text = replaceOnce(
    text,
    `import { SUPPORT_EFFECT_CATALOG, SUPPORT_EFFECT_CATALOG_VERSION, findSupportEffect, isCataloguedEnemyDebuff } from '../src/data/support-effect-catalog.js';`,
    `import { SUPPORT_EFFECT_CATALOG, SUPPORT_EFFECT_CATALOG_VERSION, findSupportEffect, isCataloguedEnemyDebuff, isTeamDamageSupportEffect } from '../src/data/support-effect-catalog.js';`,
    'support regression import'
  );
  text = replaceOnce(text, `assert.equal(SUPPORT_EFFECT_CATALOG_VERSION, 1);`, `assert.equal(SUPPORT_EFFECT_CATALOG_VERSION, 2);`, 'support regression version');
  text = replaceOnce(
    text,
    `assert.equal(isCataloguedEnemyDebuff('Armor Break'), true);`,
    `assert.equal(isCataloguedEnemyDebuff('Armor Break'), true);\nassert.equal(isTeamDamageSupportEffect('Armor Break'), true);\nassert.equal(isTeamDamageSupportEffect('Vulnerability'), true);\nassert.equal(isTeamDamageSupportEffect('Black Death Scorpion'), true, 'Combat Advantage target effects help party damage');\nassert.equal(isTeamDamageSupportEffect('Weapon Break'), false, 'defensive-only enemy Critical Severity reduction is not a party damage debuff');\nassert.equal(isTeamDamageSupportEffect('Advantage Nullification'), false, 'enemy Combat Advantage reduction is defensive, not party damage support');\nassert.equal(isTeamDamageSupportEffect('Controlled Momentum'), false, 'party buffs stay off the Debuff page');`,
    'support offensive regression cases'
  );
  write(path, text);
}

{
  const path = 'scripts/power-timing-interaction-regression.mjs';
  let text = read(path);
  text = replaceOnce(
    text,
    `for (const token of ['data-pt-zoom-in','data-pt-zoom-out','data-pt-fit','Combat Adv.','Deflected','wheel','pointerdown','categoryTooltipMarkup','loadEncounterPowerIconSprite']) assert.ok(ui.includes(token), token);`,
    `for (const token of ['data-pt-zoom-in','data-pt-zoom-out','data-pt-fit','Combat Adv.','Deflected','Debuff applied','Debuff active','wheel','pointerdown','categoryTooltipMarkup','loadEncounterPowerIconSprite','buildTeamDebuffTiming','raw-page','MAX_ZOOM = 12','MAX_TIMELINE_WIDTH = 30000']) assert.ok(ui.includes(token), token);`,
    'Power Timing regression tokens'
  );
  write(path, text);
}

console.log('Applied focused team-debuff page and deep Power Timing debuff overlays.');
