import fs from 'node:fs';

function patch(file, before, after, label) {
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

const worker = 'app/src/workers/fast-parse-worker.js';
patch(worker,
`async function buildRotationReport(scope = { type: 'session' }, requestId = 0) {`,
`function applyRotationActivationDetails(activations, damageRows) {
  const byPower = new Map();
  for (const activation of activations) {
    Object.assign(activation, { damage: 0, hits: 0, critHits: 0, caHits: 0, deflectedHits: 0, maxHit: 0 });
    const list = byPower.get(activation.power) || [];
    list.push(activation);
    byPower.set(activation.power, list);
  }
  for (const row of damageRows) {
    const candidates = byPower.get(row.power);
    if (!candidates) continue;
    let selected = null;
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      const delta = row.time - candidate._absoluteTime;
      if (delta < -0.15) continue;
      if (delta > activationDedupeSeconds(candidate.category)) break;
      selected = candidate;
      break;
    }
    if (!selected) continue;
    const amount = Number(row.amount) || 0;
    selected.damage += amount;
    selected.hits += 1;
    if ((row.flags & FLAG.CRITICAL) !== 0) selected.critHits += 1;
    if ((row.flags & (FLAG.FLANK | FLAG.COMBAT_ADVANTAGE)) !== 0) selected.caHits += 1;
    if ((row.flags & FLAG.DEFLECT) !== 0) selected.deflectedHits += 1;
    selected.maxHit = Math.max(selected.maxHit, amount);
  }
  for (const activation of activations) delete activation._absoluteTime;
}

async function buildRotationReport(scope = { type: 'session' }, requestId = 0) {`, 'worker helper');
patch(worker,
`    const damageCandidate = Boolean(chunk.validDamage[slot]) && !chunk.companion[slot];

    if (catalogEncounter && !info.targetOnly) {
      if (!encounterMarker) continue;
    } else {
      if (!damageCandidate) continue;
      if (info.targetOnly && info.bossTargetIds.size && !info.bossTargetIds.has(chunk.targetRef[slot])) continue;
    }`,
`    const targetAccepted = !info.targetOnly || !info.bossTargetIds.size || info.bossTargetIds.has(chunk.targetRef[slot]);
    const damageCandidate = Boolean(chunk.validDamage[slot]) && !chunk.companion[slot] && targetAccepted;
    if (!encounterMarker && !damageCandidate) continue;`, 'worker candidate gate');
patch(worker,
`        damage: 0,
        rows: []`,
`        damage: 0,
        rows: [],
        damageRows: []`, 'worker damage rows');
patch(worker,
`    if (damageCandidate) lane.damage += chunk.amount[slot];
    lane.rows.push({`,
`    if (damageCandidate) {
      lane.damage += chunk.amount[slot];
      lane.damageRows.push({ time: rowTime, lineNo: chunk.lineNo[slot], power, category, amount: chunk.amount[slot], flags: chunk.flags[slot] });
    }
    if (catalogEncounter && !info.targetOnly) {
      if (!encounterMarker) continue;
    } else if (!damageCandidate) continue;
    lane.rows.push({`, 'worker damage collection');
patch(worker,
`        category: row.category,
        amount: row.amount
      });`,
`        category: row.category,
        amount: row.amount,
        _absoluteTime: row.time
      });`, 'worker absolute time');
patch(worker,
`    activationCount += activations.length;
    const classRanking`,
`    applyRotationActivationDetails(activations, lane.damageRows);
    activationCount += activations.length;
    const classRanking`, 'worker detail apply');

const verifier = 'app/src/engine/verification-engine.js';
patch(verifier, `const FLAG_IMMUNE = 1 << 4;`, `const FLAG_IMMUNE = 1 << 4;\nconst FLAG_DEFLECT = 1 << 5;`, 'verifier deflect flag');
patch(verifier,
`    const damageCandidate = isCanonicalDamage(row) && !isCompanion(row);

    if (catalogEncounter && !targetOnly) {
      if (!encounterMarker) continue;
    } else {
      if (!damageCandidate) continue;
      if (targetOnly && bossTargets.size && !bossTargets.has(row.targetRef)) continue;
    }

    let lane = byPlayer.get(row.ownerRef);
    if (!lane) { lane = { ref: row.ownerRef, name: text(row.ownerName) || row.ownerRef, rows: [] }; byPlayer.set(row.ownerRef, lane); }`,
`    const targetAccepted = !targetOnly || !bossTargets.size || bossTargets.has(row.targetRef);
    const damageCandidate = isCanonicalDamage(row) && !isCompanion(row) && targetAccepted;
    if (!encounterMarker && !damageCandidate) continue;

    let lane = byPlayer.get(row.ownerRef);
    if (!lane) { lane = { ref: row.ownerRef, name: text(row.ownerName) || row.ownerRef, rows: [], damageRows: [] }; byPlayer.set(row.ownerRef, lane); }
    if (damageCandidate) lane.damageRows.push({ time: Number(row.time) || 0, lineNo: Number(row.lineNo) || 0, power, category, amount: Number(row.amount) || 0, flags: Number(row.flags) || 0, flagsRaw: text(row.flagsRaw) });
    if (catalogEncounter && !targetOnly) {
      if (!encounterMarker) continue;
    } else if (!damageCandidate) continue;`, 'verifier candidate gate');
patch(verifier,
`export function buildShadowRotation(rows, context = {}, onProgress = null) {`,
`function applyShadowRotationDetails(activations, damageRows) {
  const byPower = new Map();
  for (const activation of activations) {
    Object.assign(activation, { damage: 0, hits: 0, critHits: 0, caHits: 0, deflectedHits: 0, maxHit: 0 });
    const list = byPower.get(activation.power) || [];
    list.push(activation);
    byPower.set(activation.power, list);
  }
  for (const row of damageRows) {
    const candidates = byPower.get(row.power);
    if (!candidates) continue;
    let selected = null;
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      const delta = row.time - candidate._absoluteTime;
      if (delta < -0.15) continue;
      if (delta > activationDedupeSeconds(candidate.category)) break;
      selected = candidate;
      break;
    }
    if (!selected) continue;
    const amount = Number(row.amount) || 0;
    selected.damage += amount;
    selected.hits += 1;
    const raw = text(row.flagsRaw);
    if ((row.flags & FLAG_CRITICAL) !== 0 || /(?:^|\\|)critical(?:\\||$)/i.test(raw)) selected.critHits += 1;
    if ((row.flags & (FLAG_FLANK | FLAG_CA)) !== 0 || /(?:^|\\|)(?:flank|combatadvantage)(?:\\||$)/i.test(raw)) selected.caHits += 1;
    if ((row.flags & FLAG_DEFLECT) !== 0 || /(?:^|\\|)deflect(?:ed)?(?:\\||$)/i.test(raw)) selected.deflectedHits += 1;
    selected.maxHit = Math.max(selected.maxHit, amount);
  }
  for (const activation of activations) delete activation._absoluteTime;
}

export function buildShadowRotation(rows, context = {}, onProgress = null) {`, 'verifier helper');
patch(verifier,
`      activations.push({ time: Math.max(0, row.time - origin), power: row.power, category: row.category, amount: row.amount });`,
`      activations.push({ time: Math.max(0, row.time - origin), power: row.power, category: row.category, amount: row.amount, _absoluteTime: row.time });`, 'verifier absolute time');
patch(verifier,
`    activationCount += activations.length;
    lanes.push({ ref: lane.ref, name: lane.name, activations });`,
`    applyShadowRotationDetails(activations, lane.damageRows);
    activationCount += activations.length;
    lanes.push({ ref: lane.ref, name: lane.name, activations });`, 'verifier detail apply');
patch(verifier,
`    for (const item of lane.activations || []) for (const value of [item.time, item.power, item.category, item.amount]) hash = hashText(hash, value);`,
`    for (const item of lane.activations || []) for (const value of [item.time, item.power, item.category, item.amount, item.damage, item.hits, item.critHits, item.caHits, item.deflectedHits, item.maxHit]) hash = hashText(hash, value);`, 'verifier checksum');
patch(verifier,
`      if (!nearlyEqual(left?.time, right.time) || text(left?.power) !== right.power || text(left?.category) !== right.category || !nearlyEqual(left?.amount, right.amount)) {
        mismatches.push({ path: \`lanes.\${lane.ref}.activations.\${index}\`, primary: left || null, verifier: right });
        if (mismatches.length >= 40) break;
      }`,
`      if (!nearlyEqual(left?.time, right.time) || text(left?.power) !== right.power || text(left?.category) !== right.category || !nearlyEqual(left?.amount, right.amount)) {
        mismatches.push({ path: \`lanes.\${lane.ref}.activations.\${index}\`, primary: left || null, verifier: right });
        if (mismatches.length >= 40) break;
      }
      for (const field of ['damage','hits','critHits','caHits','deflectedHits','maxHit']) {
        compareNumber(mismatches, \`lanes.\${lane.ref}.activations.\${index}.\${field}\`, left?.[field], right[field]);
        if (mismatches.length >= 40) break;
      }`, 'verifier detail compare');

for (const file of ['app/scripts/patch-power-timing-engine.mjs', '.github/workflows/apply-power-timing-engine.yml']) {
  if (fs.existsSync(file)) fs.rmSync(file);
}
console.log('Power timing engine patch applied.');
