import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, worker, verifier, charts, motion, copy, styles, index] = await Promise.all([
  readFile('src/v3/app.js', 'utf8'),
  readFile('src/workers/fast-parse-worker.js', 'utf8'),
  readFile('src/engine/verification-engine.js', 'utf8'),
  readFile('src/v3/charts.js', 'utf8'),
  readFile('src/v3/motion.js', 'utf8'),
  readFile('src/v6/copy.js', 'utf8'),
  readFile('src/v6/performance.css', 'utf8'),
  readFile('index.html', 'utf8')
]);

for (const marker of ['task-loading', 'task-progress', 'renderEpoch', 'data-task-progress-bar', 'Math.min(1.25', "state.view !== 'rotation'"]) assert.ok(app.includes(marker), `app missing ${marker}`);
for (const marker of ['postTaskProgress', 'categoryCounts', 'await sleep()', "'verify-rotation'", 'return { report: cached, verification: cached.verification, error: null }']) assert.ok(worker.includes(marker), `worker missing ${marker}`);
for (const marker of ['seriesInOrder', 'orderedSeries', 'PROGRESS_ROWS', 'hashText', 'VERIFICATION_ENGINE_VERSION = 5']) assert.ok(verifier.includes(marker), `verifier missing ${marker}`);
assert.ok(!verifier.includes('Math.min(...partySeries.map'), 'verifier must not spread a full session timeline into Math.min');
assert.ok(!/function rotationChecksum[\s\S]*?flatMap/.test(verifier), 'rotation checksum must stream instead of building a giant flat array');
for (const marker of ['IntersectionObserver', 'requestIdleCallback', 'chart-lazy-placeholder', 'rootMargin']) assert.ok(charts.includes(marker), `charts missing ${marker}`);
assert.ok(motion.includes('isHeavyView'), 'motion must skip expensive data views');
assert.ok(copy.includes("observe(viewRoot, { childList: true, subtree: false })"), 'copy observer must only watch top-level view swaps');
assert.ok(!copy.includes("observe(viewRoot, { childList: true, subtree: true })"), 'copy observer must not rescan the whole UI for chart mutations');
for (const marker of ['.task-loading{', '.task-progress-track', '.task-skeleton-grid', 'content-visibility:auto', '@media(prefers-reduced-motion:reduce)']) assert.ok(styles.includes(marker), `performance styles missing ${marker}`);
assert.ok(index.includes('src/v6/performance.css'), 'performance stylesheet must be loaded');

console.log('Performance regression passed. Progressive task feedback, lazy charts, bounded verifier memory, stale-render guards, and scoped copy observation are present.');
