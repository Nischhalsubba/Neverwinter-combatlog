import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildShadowRotation } from '../src/engine/verification-engine.js';

const player = 'P[1 Player]';
const base = { ownerRef: player, ownerName: 'Player', sourceRef: player, sourceName: 'Player', targetRef: 'C[1 target_standard]', targetName: 'Target', powerRef: '', companion: false, baseAmount: 0 };
const rows = [
  { ...base, time: 1, lineNo: 1, powerName: 'Rapid Shot', damageType: 'Physical', amount: 100, flags: 1 | 4, flagsRaw: 'Critical|CombatAdvantage' },
  { ...base, time: 1.12, lineNo: 2, powerName: 'Rapid Shot', damageType: 'Physical', amount: 60, flags: 32, flagsRaw: 'Deflect' },
  { ...base, time: 4, lineNo: 3, sourceRef: '*', powerName: 'Thorn Ward', damageType: 'Power', amount: -1, flags: 0, flagsRaw: '' },
  { ...base, time: 4.3, lineNo: 4, powerName: 'Thorn Ward', damageType: 'Physical', amount: 250, flags: 1, flagsRaw: 'Critical' },
  { ...base, time: 4.8, lineNo: 5, powerName: 'Thorn Ward', damageType: 'Physical', amount: 150, flags: 4, flagsRaw: 'CombatAdvantage' }
];
const rotation = buildShadowRotation(rows, { scopeStart: 0, targetOnly: false, totalRows: rows.length });
assert.equal(rotation.activationCount, 2);
const lane = rotation.lanes[0];
const rapid = lane.activations.find(item => item.power === 'Rapid Shot');
const thorn = lane.activations.find(item => item.power === 'Thorn Ward');
assert.ok(rapid && thorn);
assert.equal(rapid.damage, 160);
assert.equal(rapid.hits, 2);
assert.equal(rapid.critHits, 1);
assert.equal(rapid.caHits, 1);
assert.equal(rapid.deflectedHits, 1);
assert.equal(rapid.maxHit, 100);
assert.equal(thorn.damage, 400);
assert.equal(thorn.hits, 2);
assert.equal(thorn.critHits, 1);
assert.equal(thorn.caHits, 1);

const ui = fs.readFileSync(new URL('../src/v10/power-timing-interactions.js', import.meta.url), 'utf8');
for (const token of ['data-pt-zoom-in','data-pt-zoom-out','data-pt-fit','Combat Adv.','Deflected','Debuff applied','Debuff active','wheel','pointerdown','categoryTooltipMarkup','loadEncounterPowerIconSprite','loadTeamDebuffTiming','effect-intelligence-report','MAX_ZOOM = 12','MAX_TIMELINE_WIDTH = 30000','maxZoomForReport','32760']) assert.ok(ui.includes(token), token);
assert.ok(!ui.includes('buildTeamDebuffTiming'), 'Power Timing must not rebuild the effect timeline in the browser');
assert.ok(!ui.includes("workerRequest('raw-page'"), 'Power Timing must consume Engine 3 output instead of paging raw rows for debuffs');
assert.ok(!ui.includes('analyzeCombatEffects'), 'Power Timing must not run combat-effect classification in the frontend');
assert.ok(!ui.includes('analyzeBossEffects'), 'Power Timing must not run boss-effect calculations in the frontend');

const drilldown = fs.readFileSync(new URL('../src/v3/power-drilldown.js', import.meta.url), 'utf8');
assert.ok(drilldown.includes("../v10/power-timing-interactions.js"));
const worker = fs.readFileSync(new URL('../src/workers/fast-parse-worker.js', import.meta.url), 'utf8');
for (const token of ['applyRotationActivationDetails','critHits','caHits','deflectedHits','maxHit','effect-intelligence-report','buildEffectIntelligenceReport','analyzeEffectIntelligence']) assert.ok(worker.includes(token), token);
console.log('Power timing interaction regression passed.');
