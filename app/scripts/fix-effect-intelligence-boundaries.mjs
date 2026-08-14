import { readFile, writeFile } from 'node:fs/promises';

async function replaceInFile(path, before, after, label) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing patch target: ${label}`);
  await writeFile(path, source.replace(before, after));
}

await replaceInFile(
  'src/engine/effect-intelligence-engine.js',
  `function shadowUnionSeconds(times, duration) {\n  const ordered = times.slice().sort((a, b) => a - b);\n  if (!ordered.length || !duration) return 0;\n  let start = ordered[0];\n  let end = ordered[0] + duration;\n  let seconds = 0;\n  for (let index = 1; index < ordered.length; index += 1) {\n    const time = ordered[index];\n    if (time > end) {\n      seconds += end - start;\n      start = time;\n      end = time + duration;\n    } else {\n      end = Math.max(end, time + duration);\n    }\n  }\n  return seconds + Math.max(0, end - start);\n}`,
  `function shadowUnionSeconds(times, duration, scopeStart, scopeEnd) {\n  const ordered = times.slice().sort((a, b) => a - b);\n  if (!ordered.length || !duration) return 0;\n  const clippedSeconds = (start, end) => Math.max(0, Math.min(scopeEnd, end) - Math.max(scopeStart, start));\n  let start = ordered[0];\n  let end = ordered[0] + duration;\n  let seconds = 0;\n  for (let index = 1; index < ordered.length; index += 1) {\n    const time = ordered[index];\n    if (time > end) {\n      seconds += clippedSeconds(start, end);\n      start = time;\n      end = time + duration;\n    } else {\n      end = Math.max(end, time + duration);\n    }\n  }\n  return seconds + clippedSeconds(start, end);\n}`,
  'independent interval clipping'
);

await replaceInFile(
  'src/engine/effect-intelligence-engine.js',
  `      const shadow = shadowUnionSeconds(\n        group.applications.filter(item => item.targetRef === targetRef).map(item => number(item.time) + (item.postHit ? EPSILON : 0)),\n        duration\n      );`,
  `      const shadow = shadowUnionSeconds(\n        group.applications.filter(item => item.targetRef === targetRef).map(item => number(item.time) + (item.postHit ? EPSILON : 0)),\n        duration,\n        scopeStart,\n        scopeEnd\n      );`,
  'shadow interval scope arguments'
);

await replaceInFile(
  'src/engine/effect-intelligence-engine.js',
  `        effectIds: Array.from(active.keys()).sort(),\n        names: Array.from(new Set(Array.from(active.values()).map(value => value.name))).sort()`,
  `        effectIds: Array.from(new Set(Array.from(active.values()).map(value => value.effectId))).sort(),\n        names: Array.from(new Set(Array.from(active.values()).map(value => value.name))).sort()`,
  'team window effect ids'
);

const regressionPath = 'scripts/effect-intelligence-regression.mjs';
let regression = await readFile(regressionPath, 'utf8');
const insertion = `rows.push(hit(20, { amount: 101, baseAmount: 100 }));\n`;
if (!regression.includes(insertion)) throw new Error('Missing regression insertion point.');
regression = regression.replace(insertion, `${insertion}rows.push(hit(21, { powerName: 'Commanding Shot', amount: 110, baseAmount: 100 }));\n`);
const assertionPoint = `assert.ok(report.timing.applications.some(item => item.name === 'Thorn Ward'));\n`;
if (!regression.includes(assertionPoint)) throw new Error('Missing regression assertion point.');
regression = regression.replace(assertionPoint, `${assertionPoint}const commanding = report.teamEffects.find(effect => effect.name === 'Commanding Shot');\nassert.ok(commanding, 'a known class debuff near the fight boundary should still be reconstructed');\nassert.equal(commanding.targets[0].verified, true, 'independent interval verification must clip to the selected fight boundary');\nassert.ok(commanding.targets[0].intervals[0].end <= 22 + 1e-6, 'timed effects must not extend beyond the selected scope');\nassert.ok(report.timing.windows.every(window => window.effectIds.every(id => !id.includes('|'))), 'timeline windows expose canonical effect ids, not internal interval keys');\n`);
await writeFile(regressionPath, regression);

console.log('Fixed Engine 3 fight-boundary verification and timeline IDs.');
