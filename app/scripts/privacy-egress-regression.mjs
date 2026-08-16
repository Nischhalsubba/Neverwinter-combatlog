import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchAudit } from './browser-audit-harness.mjs';

const argIndex = process.argv.indexOf('--root');
const rootDir = argIndex >= 0 ? process.argv[argIndex + 1] : '.';
if (resolve(rootDir).endsWith('/public')) {
  await assert.rejects(() => access(join(rootDir, 'src', 'integrations', 'supabase', 'browser-client.js')), 'unused Supabase integration must not ship in the local-first production package');
}
const audit = await launchAudit({ rootDir });
if (audit.skipped) { console.log('Privacy egress regression skipped: Chrome/Chromium not installed.'); process.exit(0); }
try {
  await audit.navigateAndAnalyze();
  for (const view of ['overview','powers','rotation','boss','debuffs','events']) {
    const clicked = await audit.cdp.eval(`(() => { const b=document.querySelector('#app-nav [data-view="${view}"]'); if(!b||b.disabled)return false; b.click(); return true; })()`);
    assert.equal(clicked, true, `${view} route must be available in the production artifact`);
    await audit.waitFor(() => audit.cdp.eval(`(() => { const b=document.querySelector('#app-nav [data-view="${view}"]'); const root=document.getElementById('view-root'); return Boolean(b?.classList.contains('is-active') && root && !root.querySelector('[aria-busy="true"]') && root.textContent.trim().length>20); })()`), 30000, 120, `${view} production route`);
  }
  for (const investigation of ['evidence-map','attempt-lab','fight-fingerprints','moment-inspector','compare-lab','trends']) {
    const clicked = await audit.cdp.eval(`(() => { const b=document.querySelector('[data-sg-investigation="${investigation}"]'); if(!b||b.disabled)return false; b.click(); return true; })()`);
    assert.equal(clicked, true, `${investigation} must be enabled in the production artifact`);
    await audit.waitFor(() => audit.cdp.eval(`(() => { const root=document.querySelector('.sg-investigation-root'); return Boolean(root && !root.hidden && root.getAttribute('aria-busy') !== 'true' && root.textContent.trim().length>20); })()`), 30000, 120, `${investigation} production investigation`);
  }
  const browserErrors = audit.cdp.events.flatMap(event => {
    if (event.method === 'Runtime.exceptionThrown') return [event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || 'Runtime exception'];
    if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') return [event.params.entry.text || 'Browser log error'];
    return [];
  }).filter(text => !/ResizeObserver loop/i.test(text));
  assert.deepEqual(browserErrors, [], `production artifact emitted browser errors: ${browserErrors.join(' | ')}`);
  const requests = audit.cdp.events.filter(event => event.method === 'Network.requestWillBeSent').map(event => event.params?.request?.url || '').filter(Boolean);
  const external = requests.filter(url => !url.startsWith(audit.origin) && !url.startsWith('data:') && !url.startsWith('blob:'));
  assert.deepEqual(external, [], `analysis must not send requests to third-party origins: ${external.join(', ')}`);
  await mkdir('test-artifacts/browser', { recursive:true });
  await writeFile('test-artifacts/browser/privacy-egress.json', JSON.stringify({ rootDir, requestCount:requests.length, external, browserErrors }, null, 2));
  console.log(`Privacy egress passed: ${requests.length} browser requests, zero third-party analysis requests.`);
} finally { await audit.close(); }
