import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchAudit } from './browser-audit-harness.mjs';

const argIndex = process.argv.indexOf('--root');
const rootDir = argIndex >= 0 ? process.argv[argIndex + 1] : '.';
const budgets = Object.freeze({ parseReadyMs:25000, routeReadyMs:8000, cls:0.25, heapMb:256, worstLongTaskMs:1200 });
const instrument = `window.__sgBudget={cls:0,long:[]};try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(!e.hadRecentInput)window.__sgBudget.cls+=e.value}}).observe({type:'layout-shift',buffered:true})}catch{};try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__sgBudget.long.push(e.duration)}).observe({type:'longtask',buffered:true})}catch{};`;
const audit = await launchAudit({ rootDir, instrument });
if (audit.skipped) { console.log('Browser performance budget skipped: Chrome/Chromium not installed.'); process.exit(0); }
try {
  const parseReadyMs = await audit.navigateAndAnalyze();
  const routeStart = Date.now();
  const clicked = await audit.cdp.eval("(() => { const b=document.querySelector('#app-nav [data-view=\"powers\"]'); if(!b||b.disabled)return false; b.click(); return true; })()");
  assert.equal(clicked, true, 'powers route should be available for performance measurement');
  await audit.waitFor(() => audit.cdp.eval("document.querySelector('#app-nav [data-view=\"powers\"].is-active') && !document.querySelector('#view-root [aria-busy=\"true\"]') && document.getElementById('view-root').textContent.trim().length>20"), budgets.routeReadyMs, 100, 'powers route');
  const routeReadyMs = Date.now() - routeStart;
  const runtime = await audit.cdp.eval('window.__sgBudget || {cls:0,long:[]}');
  const perf = await audit.cdp.send('Performance.getMetrics');
  const heapBytes = Number(perf.metrics?.find(metric => metric.name === 'JSHeapUsedSize')?.value) || 0;
  const heapMb = heapBytes / 1048576;
  const worstLongTaskMs = Math.max(0, ...(runtime.long || []));
  const metrics = { parseReadyMs, routeReadyMs, cls:Number(runtime.cls)||0, heapMb, worstLongTaskMs, budgets };
  assert.ok(parseReadyMs <= budgets.parseReadyMs, `parse-to-ready ${parseReadyMs.toFixed(0)}ms exceeds ${budgets.parseReadyMs}ms budget`);
  assert.ok(routeReadyMs <= budgets.routeReadyMs, `route ready ${routeReadyMs}ms exceeds ${budgets.routeReadyMs}ms budget`);
  assert.ok(metrics.cls <= budgets.cls, `CLS ${metrics.cls.toFixed(3)} exceeds ${budgets.cls} budget`);
  assert.ok(heapMb <= budgets.heapMb, `JS heap ${heapMb.toFixed(1)}MB exceeds ${budgets.heapMb}MB budget`);
  assert.ok(worstLongTaskMs <= budgets.worstLongTaskMs, `worst long task ${worstLongTaskMs.toFixed(1)}ms exceeds ${budgets.worstLongTaskMs}ms budget`);
  await mkdir('test-artifacts/browser', { recursive:true });
  await writeFile('test-artifacts/browser/performance-budget.json', JSON.stringify(metrics, null, 2));
  console.log(`Browser budgets passed: parse ${parseReadyMs.toFixed(0)}ms, route ${routeReadyMs}ms, CLS ${metrics.cls.toFixed(3)}, heap ${heapMb.toFixed(1)}MB, longest task ${worstLongTaskMs.toFixed(1)}ms.`);
} finally { await audit.close(); }
