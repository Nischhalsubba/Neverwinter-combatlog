import fs from 'node:fs';

const file = 'app/src/v7/boss-effects.js';
let source = fs.readFileSync(file, 'utf8');

function replaceBlock(start, end, replacement, label) {
  const left = source.indexOf(start);
  const right = source.indexOf(end, left + start.length);
  if (left < 0 || right < 0) throw new Error(`Missing ${label} anchor`);
  source = source.slice(0, left) + replacement + '\n\n' + source.slice(right);
}

replaceBlock('function inventoryDetails(effect) {', 'function companionTimedDetails(effect) {', `function classificationLabel(effect) {
  if (effect.classification === 'enemy-debuff') return 'Actual debuff';
  if (effect.classification === 'target-advantage') return 'Combat Advantage effect';
  if (effect.classification === 'personal-target-effect') return 'Personal target effect';
  if (effect.classification === 'ally-buff') return 'Party / player buff';
  if (effect.classification === 'support-window') return 'Support window';
  if (effect.classification === 'enemy-mechanic') return 'Enemy mechanic';
  if (effect.classification === 'player-effect') return 'Player effect';
  return 'Unclassified status';
}

function sourceCopy(effect) {
  const source = effect.source;
  if (!source?.label) return '';
  const detail = [source.section, source.updated].filter(Boolean).join(' · ');
  return detail ? \`\${source.label} · \${detail}\` : source.label;
}

function changeCopy(effect) {
  const changes = effect.changes || [];
  if (!changes.length) return '';
  return changes.map(change => {
    const value = change.unit === 'percent' ? \`\${change.value}%\` : String(change.value);
    return change.direction === 'up' ? \`\${change.stat} +\${value}\` : \`\${change.stat} -\${value}\`;
  }).join(' · ');
}

function inventoryDetails(effect) {
  const known = effect.family !== 'unknown';
  const timed = effect.timedTargets?.some(target => target.verified);
  const description = effect.description || 'The combat log recorded this status signal, but its exact gameplay meaning has not been safely mapped yet.';
  const source = sourceCopy(effect);
  const changes = changeCopy(effect);
  return \`<details class="debuff-item debuff-inventory-item">
    <summary>
      <div class="debuff-item-name"><span>\${esc(classificationLabel(effect))}</span><strong>\${esc(effect.name)}</strong><small>\${esc(description)}</small></div>
      <div class="debuff-item-result"><strong>\${effect.applications}</strong><span>\${effect.applications === 1 ? 'application' : 'applications'}\${timed ? ' · uptime available' : ''}</span></div>
    </summary>
    <div class="debuff-item-body">
      \${changes ? \`<p class="debuff-time-copy"><strong>What it changes:</strong> \${esc(changes)}</p>\` : ''}
      \${source ? \`<p class="debuff-time-copy"><strong>Reference:</strong> \${esc(source)}</p>\` : ''}
      \${effect.notes ? \`<p class="debuff-time-copy"><strong>Note:</strong> \${esc(effect.notes)}</p>\` : ''}
      \${Number.isFinite(effect.duration) && effect.duration > 0 ? \`<p class="debuff-time-copy">Known duration: <strong>\${duration(effect.duration)}</strong> per application. Uptime is calculated separately for each target when enough verified damage activity exists.</p>\` : '<p class="debuff-time-copy">Uptime is not guessed because a safe fixed duration is not locked down for this effect.</p>'}
      <div class="debuff-detail-columns">
        <div class="debuff-who"><h4>Who applied it</h4>\${inventorySources(effect)}</div>
        <div class="debuff-who"><h4>Who it affected</h4>\${inventoryTargets(effect)}</div>
      </div>
    </div>
  </details>\`;
}`, 'inventory details');

replaceBlock('function companionTimedDetails(effect) {', 'function pageFrame(content, { busy = false } = {}) {', `function catalogTimedDetails(effect) {
  const targets = (effect.timedTargets || []).filter(target => target.verified);
  if (!targets.length) return '';
  const summary = targets.length === 1 ? percent(targets[0].uptime) : \`\${targets.length} targets\`;
  return \`<details class="debuff-item">
    <summary>
      <div class="debuff-item-name"><span>Verified debuff</span><strong>\${esc(effect.name)}</strong><small>\${esc(effect.description)}</small></div>
      <div class="debuff-item-result"><strong>\${esc(summary)}</strong><span>\${targets.length === 1 ? 'uptime' : 'timed separately'}</span></div>
    </summary>
    <div class="debuff-item-body">
      <p class="debuff-time-copy">Each application lasts <strong>\${duration(effect.duration)}</strong>. Overlapping refreshes are merged before uptime is shown.</p>
      \${sourceCopy(effect) ? \`<p class="debuff-time-copy"><strong>Reference:</strong> \${esc(sourceCopy(effect))}</p>\` : ''}
      <div class="debuff-who"><h4>Uptime by target</h4><div class="debuff-source-list">\${targets.map(target => \`<div class="debuff-source-row"><div><strong>\${esc(target.name)}</strong><span>\${target.kind === 'boss' ? 'Boss' : 'Enemy'} · Applied \${target.applications} time\${target.applications === 1 ? '' : 's'}</span></div><div class="debuff-source-result"><strong>\${percent(target.uptime)}</strong><span>\${duration(target.seconds)} active</span></div></div>\`).join('')}</div></div>
      <div class="debuff-who"><h4>Who applied it</h4>\${inventorySources(effect)}</div>
    </div>
  </details>\`;
}`, 'timed catalog details');

replaceBlock('function pageFrame(content, { busy = false } = {}) {', 'function loadingPage() {', `function pageFrame(content, { busy = false } = {}) {
  return \`<section class="debuff-page" data-debuff-page \${busy ? 'aria-busy="true"' : ''}>
    <section class="panel debuff-page-intro">
      <div><span class="eyebrow">\${esc(selectedFightLabel())}</span><h2>Debuffs</h2><p>Actual enemy debuffs are listed first. Party buffs, personal target effects, enemy mechanics, and unknown status signals are kept separate so they are not mislabeled as debuffs.</p></div>
      <div class="debuff-meaning"><strong>What does uptime mean?</strong><span>50% uptime means the timed debuff was active for half of that target's active combat time.</span></div>
    </section>
    \${content}
  </section>\`;
}`, 'page frame');

replaceBlock('function renderAnalysis({ bossResult, combatResult, scope }) {', 'function observeRoot() {', `function renderAnalysis({ bossResult, combatResult, scope }) {
  const bossVerified = !bossResult || bossResult.verification?.ok;
  const catalogVerified = combatResult.verification?.ok;
  const bossDebuffs = bossVerified ? (bossResult?.effects || []).filter(effect => effect.audience === 'team') : [];
  const bossPersonal = bossVerified ? (bossResult?.effects || []).filter(effect => effect.audience !== 'team') : [];
  const catalogDebuffs = combatResult.debuffsOnEnemies.filter(effect => effect.family !== 'boss');
  const timedCatalog = catalogDebuffs.filter(effect => effect.timedTargets?.some(target => target.verified));
  const timedCount = bossDebuffs.length + timedCatalog.length;
  const debuffCount = bossDebuffs.length + catalogDebuffs.length;
  const personalInventory = combatResult.personalTargetEffects.filter(effect => effect.family !== 'boss');
  const personalCount = bossPersonal.length + personalInventory.length;
  const checkOk = bossVerified && catalogVerified;
  const actualDebuffHtml = debuffCount
    ? \`<div class="debuff-list">\${bossDebuffs.map(bossEffectDetails).join('')}\${catalogDebuffs.map(inventoryDetails).join('')}</div>\`
    : '<div class="empty-block">No verified enemy debuff application was found in this fight. That is different from finding no status events.</div>';
  const timedHtml = timedCount
    ? \`<div class="debuff-list">\${bossDebuffs.map(bossEffectDetails).join('')}\${timedCatalog.map(catalogTimedDetails).join('')}</div>\`
    : '<div class="empty-block">No actual debuff with a safely timed duration was found in this fight.</div>';
  const personalHtml = personalCount
    ? \`<div class="debuff-list">\${bossPersonal.map(bossEffectDetails).join('')}\${personalInventory.map(inventoryDetails).join('')}</div>\`
    : '<div class="empty-block">No personal target effects were recorded in this fight.</div>';
  const immuneCount = combatResult.immuneEffects.reduce((sum, effect) => sum + Number(effect.applications || 0), 0);

  replacePage(pageFrame(\`
    <section class="debuff-summary" aria-label="Debuff summary">
      <article><span>Actual debuffs</span><strong>\${debuffCount}</strong><small>Enemy debuffs identified by known effect rules or negative stat metadata.</small></article>
      <article><span>Timed debuffs</span><strong>\${timedCount}</strong><small>Only effects with safe timing rules.</small></article>
      <article><span>Personal target effects</span><strong>\${personalCount}</strong><small>Useful effects that are not shared enemy debuffs.</small></article>
      <article><span>Uptime check</span><strong class="\${checkOk ? 'good-text' : 'bad-text'}">\${checkOk ? 'Matched' : 'Hidden'}</strong><small>\${checkOk ? 'Independent calculations agreed.' : 'Calculated uptime is hidden where checks disagree.'}</small></article>
    </section>
    <section class="panel debuff-results">
      <div class="panel-head"><div><span class="eyebrow">Enemy debuffs only</span><h2>Actual debuffs on enemies</h2></div><span>\${debuffCount}</span></div>
      <p class="debuff-results-help">This section no longer treats every small status row as a debuff. Known companion enhancements, support companions and mounts, current class debuffs, and strong negative stat rows can appear here.</p>
      \${actualDebuffHtml}
    </section>
    <section class="panel debuff-results">
      <div class="panel-head"><div><span class="eyebrow">Safe to time</span><h2>Verified debuff uptime</h2></div><span>\${timedCount}</span></div>
      <p class="debuff-results-help">Uptime is published only when the duration rule is locked down and the independent calculation agrees.</p>
      \${timedHtml}
    </section>
    \${combatResult.targetAdvantageEffects.length ? section('Combat Advantage effects', 'Target advantage', combatResult.targetAdvantageEffects, '') : ''}
    <section class="panel debuff-results"><div class="panel-head"><div><span class="eyebrow">Not shared debuffs</span><h2>Personal target effects</h2></div><span>\${personalCount}</span></div>\${personalHtml}</section>
    \${section('Party / player buffs', 'Not debuffs', [...combatResult.allyBuffs, ...combatResult.supportWindows], 'No catalogued party/player support buffs were exposed as status rows in this fight.')}
    \${section('Enemy buffs & mechanics', scope.type === 'boss' ? 'Boss state' : 'Encounter state', combatResult.enemyMechanics, 'No enemy-origin status mechanics were recorded in this fight.')}
    \${section('Other status signals', 'Not classified as debuffs', combatResult.unclassifiedEnemyEffects, 'No unclassified enemy-target status signals were recorded in this fight.')}
    \${section('Effects on players', 'Encounter mechanics', combatResult.playerEffects, 'No successful player-target status effects were recorded in this fight.')}
    \${immuneCount ? \`<details class="panel debuff-untimed debuff-immune"><summary>Immune / resisted effect attempts <span>\${immuneCount}</span></summary><p>These were recorded as Immune, so Strikeglass shows the attempts but does not count them as applied debuffs.</p><div>\${combatResult.immuneEffects.map(effect => \`<span><strong>\${esc(effect.name)}</strong><small>\${effect.applications} immune event\${effect.applications === 1 ? '' : 's'}</small></span>\`).join('')}</div></details>\` : ''}
    \${!bossVerified ? '<section class="panel verification-blocked"><div class="panel-head"><div><span class="eyebrow">Boss uptime check</span><h2>Boss uptime hidden</h2></div></div><div class="empty-block bad-text">The two boss-uptime calculations did not match. Observed status events remain visible, but unverified uptime percentages are not published.</div></section>' : ''}
    \${!catalogVerified ? '<section class="panel verification-blocked"><div class="panel-head"><div><span class="eyebrow">Debuff uptime check</span><h2>Target uptime hidden</h2></div></div><div class="empty-block bad-text">The two target-uptime calculations did not match. Application, source, and target details remain visible because they come directly from verified log rows.</div></section>' : ''}
  \`));
}`, 'render analysis');

source = source.replaceAll("workspaceTitle.textContent = 'Debuffs & effects'", "workspaceTitle.textContent = 'Debuffs'");
fs.writeFileSync(file, source);
console.log('Debuff catalog UI patch applied.');
