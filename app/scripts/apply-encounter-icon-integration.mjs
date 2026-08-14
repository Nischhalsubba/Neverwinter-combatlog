import { readFile, writeFile, rm } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch anchor not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

async function patchTaxonomy() {
  const path = 'app/src/engine/power-taxonomy.js';
  let source = await readFile(path, 'utf8');
  source = replaceOnce(source, 'const CATEGORY_BY_POWER = new Map([', "import { encounterPowerClasses, isKnownEncounterPowerName } from '../data/encounter-power-icons.js';\n\nconst CATEGORY_BY_POWER = new Map([", 'taxonomy import');
  source = replaceOnce(source, '  const direct = CATEGORY_BY_POWER.get(name);\n  if (direct) return direct;\n  const lower = name.toLowerCase();', "  const direct = CATEGORY_BY_POWER.get(name);\n  if (direct) return direct;\n  if (isKnownEncounterPowerName(name)) return 'Encounter';\n  const lower = name.toLowerCase();", 'catalog Encounter classification');

  const start = source.indexOf('export function inferPlayerClass(powers = []) {');
  const end = source.indexOf('\nexport function isRotationCategory', start);
  if (start < 0 || end < 0) throw new Error('Could not locate inferPlayerClass.');
  const replacement = `export function inferPlayerClass(powers = []) {
  const scores = new Map();
  const evidence = new Map();
  const ensureClass = className => {
    if (!scores.has(className)) scores.set(className, 0);
    if (!evidence.has(className)) evidence.set(className, []);
  };

  for (const [className, hints] of Object.entries(CLASS_HINTS)) {
    ensureClass(className);
    const hintSet = new Set(hints);
    for (const power of powers) {
      if (!hintSet.has(power.power)) continue;
      const weight = Math.max(1, Math.log10(Math.max(10, Number(power.damage) || 0)));
      scores.set(className, scores.get(className) + weight);
      evidence.get(className).push(power.power);
    }
  }

  for (const power of powers) {
    const classes = encounterPowerClasses(power.power);
    if (!classes.length) continue;
    const weight = Math.max(1, Math.log10(Math.max(10, Number(power.damage) || 0))) / classes.length;
    for (const className of classes) {
      ensureClass(className);
      scores.set(className, scores.get(className) + weight);
      evidence.get(className).push(power.power);
    }
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [bestName = 'Unknown', bestScore = 0] = ranked[0] || [];
  const secondScore = ranked[1]?.[1] || 0;
  if (bestScore <= 0 || Math.abs(bestScore - secondScore) < 1e-9) return { name: 'Unknown', confidence: 0, evidence: [] };
  const confidence = Math.max(0, Math.min(1, (bestScore - secondScore) / Math.max(1, bestScore)));
  return { name: bestName, confidence, evidence: Array.from(new Set(evidence.get(bestName) || [])).slice(0, 5) };
}
`;
  source = source.slice(0, start) + replacement + source.slice(end);
  await writeFile(path, source, 'utf8');
}

async function patchWorker() {
  const path = 'app/src/workers/fast-parse-worker.js';
  let source = await readFile(path, 'utf8');
  source = replaceOnce(source, "import { activationDedupeSeconds, classifyPowerCategory, inferPlayerClass, isRotationCategory, summarizeCategories } from '../engine/power-taxonomy.js';", "import { activationDedupeSeconds, classifyPowerCategory, inferPlayerClass, isRotationCategory, summarizeCategories } from '../engine/power-taxonomy.js';\nimport { encounterPowerClasses, isKnownEncounterPowerName } from '../data/encounter-power-icons.js';", 'worker Encounter catalog import');

  const functionStart = source.indexOf('async function buildRotationReport');
  const scanStart = source.indexOf('    const location = store.location(index);', functionStart);
  const scanEnd = source.indexOf("\n  }\n\n  postTaskProgress(requestId, 'rotation-report', 'group'", scanStart);
  if (functionStart < 0 || scanStart < 0 || scanEnd < 0) throw new Error('Could not locate rotation scan block.');
  const scanReplacement = `    const location = store.location(index);
    if (!location) break;
    const { chunk, slot } = location;
    const rowTime = chunk.time[slot];
    if (rowTime < info.start || rowTime > info.end) continue;

    const ownerRef = store.pool.get(chunk.ownerRef[slot]);
    if (!isPlayerRef(ownerRef)) continue;
    const power = store.pool.get(chunk.powerName[slot]) || 'Unknown';
    const powerRef = store.pool.get(chunk.powerRef[slot]);
    const category = classifyPowerCategory(power, { companion: false, powerRef });
    if (!isRotationCategory(category)) continue;

    const catalogEncounter = category === 'Encounter' && isKnownEncounterPowerName(power);
    const encounterMarker = catalogEncounter && !info.targetOnly &&
      (CODE_TO_KIND[chunk.kind[slot]] || 'unknown') === 'resource' &&
      chunk.amount[slot] < 0 &&
      store.pool.get(chunk.sourceRef[slot]) === '*' &&
      !chunk.companion[slot];
    const damageCandidate = Boolean(chunk.validDamage[slot]) && !chunk.companion[slot];

    if (catalogEncounter && !info.targetOnly) {
      if (!encounterMarker) continue;
    } else {
      if (!damageCandidate) continue;
      if (info.targetOnly && info.bossTargetIds.size && !info.bossTargetIds.has(chunk.targetRef[slot])) continue;
    }

    let lane = lanes.get(ownerRef);
    if (!lane) {
      const known = sessionPlayers.get(ownerRef);
      const trustedClass = known?.classConfidence > 0 ? known.className : 'Unknown';
      lane = {
        ref: ownerRef,
        name: store.pool.get(chunk.ownerName[slot]) || ownerRef,
        className: trustedClass || 'Unknown',
        classConfidence: trustedClass && trustedClass !== 'Unknown' ? known?.classConfidence || 0 : 0,
        classVotes: new Map(),
        damage: 0,
        rows: []
      };
      lanes.set(ownerRef, lane);
    }
    if (catalogEncounter) {
      const classes = encounterPowerClasses(power);
      const vote = classes.length ? 1 / classes.length : 0;
      for (const className of classes) lane.classVotes.set(className, (lane.classVotes.get(className) || 0) + vote);
    }
    if (damageCandidate) lane.damage += chunk.amount[slot];
    lane.rows.push({
      time: rowTime,
      lineNo: chunk.lineNo[slot],
      power,
      category,
      amount: encounterMarker ? 0 : chunk.amount[slot]
    });`;
  source = source.slice(0, scanStart) + scanReplacement + source.slice(scanEnd);

  source = replaceOnce(source, "    activationCount += activations.length;\n    compactLanes.push({\n      ref: lane.ref,\n      name: lane.name,\n      className: lane.className,\n      classConfidence: lane.classConfidence,", `    activationCount += activations.length;
    const classRanking = Array.from(lane.classVotes.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const votedClass = classRanking[0] && (classRanking[1]?.[1] || 0) < classRanking[0][1] ? classRanking[0][0] : 'Unknown';
    const resolvedClass = lane.className && lane.className !== 'Unknown' ? lane.className : votedClass;
    compactLanes.push({
      ref: lane.ref,
      name: lane.name,
      className: resolvedClass,
      classConfidence: lane.className && lane.className !== 'Unknown' ? lane.classConfidence : (resolvedClass !== 'Unknown' ? 1 : 0),`, 'rotation lane class resolution');
  await writeFile(path, source, 'utf8');
}

async function patchVerifier() {
  const path = 'app/src/engine/verification-engine.js';
  let source = await readFile(path, 'utf8');
  source = replaceOnce(source, "import { activationDedupeSeconds, classifyPowerCategory, inferPlayerClass, isRotationCategory, summarizeCategories } from './power-taxonomy.js';", "import { activationDedupeSeconds, classifyPowerCategory, inferPlayerClass, isRotationCategory, summarizeCategories } from './power-taxonomy.js';\nimport { isKnownEncounterPowerName } from '../data/encounter-power-icons.js';", 'verifier Encounter catalog import');
  const start = source.indexOf('function rotationCandidates(rows, context = {}, onProgress = null) {');
  const end = source.indexOf('\nexport function buildShadowRotation', start);
  if (start < 0 || end < 0) throw new Error('Could not locate rotationCandidates.');
  const replacement = `function rotationCandidates(rows, context = {}, onProgress = null) {
  const targetOnly = Boolean(context.targetOnly);
  const bossTargets = context.bossTargets instanceof Set ? context.bossTargets : new Set(context.bossTargets || []);
  const totalRows = Number(context.totalRows) || 0;
  const byPlayer = new Map();
  let processed = 0;
  for (const row of rows || []) {
    processed += 1; reportProgress(onProgress, processed, totalRows);
    if (!isPlayer(row.ownerRef)) continue;
    const power = text(row.powerName) || 'Unknown';
    const category = classifyPowerCategory(power, { companion: false, powerRef: row.powerRef });
    if (!isRotationCategory(category)) continue;

    const catalogEncounter = category === 'Encounter' && isKnownEncounterPowerName(power);
    const encounterMarker = catalogEncounter && !targetOnly &&
      text(row.damageType).toLowerCase() === 'power' &&
      Number(row.amount) < 0 &&
      text(row.sourceRef) === '*' &&
      !isCompanion(row);
    const damageCandidate = isCanonicalDamage(row) && !isCompanion(row);

    if (catalogEncounter && !targetOnly) {
      if (!encounterMarker) continue;
    } else {
      if (!damageCandidate) continue;
      if (targetOnly && bossTargets.size && !bossTargets.has(row.targetRef)) continue;
    }

    let lane = byPlayer.get(row.ownerRef);
    if (!lane) { lane = { ref: row.ownerRef, name: text(row.ownerName) || row.ownerRef, rows: [] }; byPlayer.set(row.ownerRef, lane); }
    lane.rows.push({
      time: Number(row.time) || 0,
      lineNo: Number(row.lineNo) || 0,
      power,
      category,
      amount: encounterMarker ? 0 : Number(row.amount) || 0
    });
  }
  onProgress?.(1);
  return byPlayer;
}
`;
  source = source.slice(0, start) + replacement + source.slice(end);
  await writeFile(path, source, 'utf8');
}

async function patchLoader() {
  const path = 'app/src/v3/power-drilldown.js';
  let source = await readFile(path, 'utf8');
  source = replaceOnce(source, "await import('../v8/index.js');", "await import('../v8/index.js');\nawait import('../v9/encounter-power-icons.js');", 'Encounter icon UI loader');
  await writeFile(path, source, 'utf8');
}

async function patchPackage() {
  const path = 'app/package.json';
  const pkg = JSON.parse(await readFile(path, 'utf8'));
  for (const check of ['node --check src/data/encounter-power-icons.js', 'node --check src/v9/encounter-power-icons.js']) {
    if (!pkg.scripts.syntax.includes(check)) pkg.scripts.syntax += ` && ${check}`;
  }
  const regression = 'node scripts/encounter-icon-regression.mjs';
  if (!pkg.scripts.test.includes(regression)) pkg.scripts.test += ` && ${regression}`;
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

await patchTaxonomy();
await patchWorker();
await patchVerifier();
await patchLoader();
await patchPackage();

await rm('app/scripts/apply-encounter-icon-integration.mjs', { force: true });
await rm('app/scripts/generate-encounter-icon-assets.py', { force: true });
await rm('.github/workflows/apply-encounter-icon-integration.yml', { force: true });
console.log('Encounter icon integration patch applied.');
