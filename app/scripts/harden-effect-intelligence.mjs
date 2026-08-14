import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/engine/effect-intelligence-engine.js';
const source = await readFile(path, 'utf8');
const before = `  const source = Array.isArray(rows) ? rows : Array.from(rows || []);\n  const times = source.map(row => number(row.time)).filter(Number.isFinite);\n  const scopeStart = Number.isFinite(Number(options.scopeStart)) ? Number(options.scopeStart) : (times.length ? Math.min(...times) : 0);\n  const scopeEnd = Number.isFinite(Number(options.scopeEnd)) ? Number(options.scopeEnd) : (times.length ? Math.max(...times) : scopeStart);`;
const after = `  const source = Array.isArray(rows) ? rows : Array.from(rows || []);\n  let observedStart = Infinity;\n  let observedEnd = -Infinity;\n  for (const row of source) {\n    const time = Number(row?.time);\n    if (!Number.isFinite(time)) continue;\n    if (time < observedStart) observedStart = time;\n    if (time > observedEnd) observedEnd = time;\n  }\n  const scopeStart = Number.isFinite(Number(options.scopeStart)) ? Number(options.scopeStart) : (Number.isFinite(observedStart) ? observedStart : 0);\n  const scopeEnd = Number.isFinite(Number(options.scopeEnd)) ? Number(options.scopeEnd) : (Number.isFinite(observedEnd) ? observedEnd : scopeStart);`;
if (!source.includes(before)) throw new Error('Expected scope-boundary block was not found.');
const next = source.replace(before, after);
if (next.includes('Math.min(...times)') || next.includes('Math.max(...times)')) throw new Error('Large-array spread remains in scope-boundary code.');
await writeFile(path, next);
console.log('Hardened Engine 3 scope boundaries for large logs.');
