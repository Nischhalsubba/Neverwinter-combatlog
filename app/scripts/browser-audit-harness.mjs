import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { REALSHAPE_LOG } from '../tests/fixtures/realshape-2026-08-14.mjs';

const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.txt':'text/plain; charset=utf-8' };

function chromeBinary() {
  for (const name of ['google-chrome-stable','google-chrome','chromium','chromium-browser']) {
    const found = spawnSync('which', [name], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return '';
}

async function waitFor(fn, timeout = 20000, interval = 100, label = 'browser condition') {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try { const value = await fn(); if (value) return value; } catch (error) { lastError = error; }
    await new Promise(resolvePromise => setTimeout(resolvePromise, interval));
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) { this.events.push(message); if (this.events.length > 4000) this.events.shift(); return; }
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result || {});
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolvePromise, reject) => { this.pending.set(id, { resolve: resolvePromise, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
    return result.result?.value;
  }
}

function auditBrowserErrors(cdp) {
  return cdp.events.flatMap(event => {
    if (event.method === 'Runtime.exceptionThrown') return [event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || 'Runtime exception'];
    if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') return [event.params.entry.text || 'Browser log error'];
    return [];
  }).filter(text => !/ResizeObserver loop/i.test(text));
}

function auditNetworkFailures(cdp) {
  return cdp.events.flatMap(event => {
    if (event.method === 'Network.loadingFailed') return [{ type:'loadingFailed', url:event.params?.requestId || '', error:event.params?.errorText || '', blockedReason:event.params?.blockedReason || '' }];
    if (event.method === 'Network.responseReceived' && Number(event.params?.response?.status || 0) >= 400) return [{ type:'http', url:event.params?.response?.url || '', status:event.params.response.status }];
    return [];
  }).slice(-30);
}

export async function launchAudit({ rootDir = '.', instrument = '' } = {}) {
  const binary = chromeBinary();
  if (!binary) {
    if (process.env.CI) throw new Error('Chrome/Chromium is required for browser audit coverage in CI.');
    return { skipped: true, close: async () => {} };
  }
  const root = resolve(rootDir);
  const port = 4400 + (process.pid % 1000);
  const debugPort = 9400 + (process.pid % 500);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const path = normalize(join(root, rel));
      if (!path.startsWith(root)) throw new Error('bad path');
      const info = await stat(path);
      const target = info.isDirectory() ? join(path, 'index.html') : path;
      const body = await readFile(target);
      res.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream', 'cache-control':'no-store' }); res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolvePromise => server.listen(port, '127.0.0.1', resolvePromise));
  const chrome = spawn(binary, ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${debugPort}`,`--user-data-dir=/tmp/strikeglass-audit-${process.pid}`,'about:blank'], { stdio:['ignore','ignore','pipe'] });
  const version = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`); return response.ok ? response.json() : null; } catch { return null; } }, 30000, 100, 'Chrome debugging endpoint');
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?http://127.0.0.1:${port}/`, { method:'PUT' });
  const target = await targetResponse.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl || version.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => { socket.addEventListener('open', resolvePromise, { once:true }); socket.addEventListener('error', reject, { once:true }); });
  const cdp = new Cdp(socket);
  await Promise.all([cdp.send('Runtime.enable'),cdp.send('DOM.enable'),cdp.send('Page.enable'),cdp.send('Network.enable'),cdp.send('Performance.enable'),cdp.send('Log.enable')]);
  if (instrument) await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: instrument });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:1440, height:900, deviceScaleFactor:1, mobile:false });
  const fixture = `/tmp/strikeglass-audit-${process.pid}.log`;
  await writeFile(fixture, REALSHAPE_LOG, 'utf8');
  const origin = `http://127.0.0.1:${port}`;

  async function captureReadinessFailure(error, start) {
    let state = null;
    try {
      state = await cdp.eval(`(() => ({
        elapsedMs: Math.round(performance.now() - ${Number(start) || 0}),
        readyState: document.readyState,
        location: location.href,
        workspaceHidden: document.getElementById('workspace')?.hidden ?? null,
        statusText: document.getElementById('status-text')?.textContent?.trim() || '',
        topbarStatus: document.getElementById('topbar-status')?.textContent?.trim() || '',
        taskText: document.getElementById('task-text')?.textContent?.trim() || '',
        taskProgress: document.getElementById('task-progress')?.value ?? null,
        activeView: document.querySelector('#app-nav [data-view].is-active')?.dataset?.view || '',
        overviewDisabled: document.querySelector('#app-nav [data-view="overview"]')?.disabled ?? null,
        blockedText: document.querySelector('.verification-blocked')?.innerText?.trim()?.slice(0,2000) || '',
        viewText: document.getElementById('view-root')?.innerText?.trim()?.slice(0,3000) || '',
        nav: [...document.querySelectorAll('#app-nav [data-view]')].map(button => ({ view:button.dataset.view || '', disabled:Boolean(button.disabled), active:button.classList.contains('is-active') }))
      }))()`);
    } catch (snapshotError) {
      state = { snapshotError: snapshotError.message };
    }
    const diagnostic = {
      error: error?.message || String(error),
      state,
      browserErrors: auditBrowserErrors(cdp),
      networkFailures: auditNetworkFailures(cdp)
    };
    await mkdir('test-artifacts/browser', { recursive:true });
    await writeFile('test-artifacts/browser/privacy-readiness-failure.json', JSON.stringify(diagnostic, null, 2));
    return diagnostic;
  }

  async function navigateAndAnalyze() {
    await cdp.send('Page.navigate', { url:`${origin}/` });
    await waitFor(() => cdp.eval("document.readyState === 'complete'"), 10000, 100, 'Strikeglass document');
    await waitFor(() => cdp.eval("document.getElementById('boss-target-field')?.hidden === true"), 10000, 50, 'Strikeglass app initialization');
    const documentNode = await cdp.send('DOM.getDocument', { depth:2 });
    const input = await cdp.send('DOM.querySelector', { nodeId:documentNode.root.nodeId, selector:'#file-input' });
    if (!input.nodeId) throw new Error('combat-log file input is missing');
    await cdp.send('DOM.setFileInputFiles', { nodeId:input.nodeId, files:[fixture] });
    const start = await cdp.eval('performance.now()');
    await cdp.eval("document.getElementById('file-input').dispatchEvent(new Event('change',{bubbles:true}))");
    try {
      await waitFor(() => cdp.eval("!document.getElementById('workspace').hidden && document.querySelector('#app-nav [data-view=\"overview\"]:not(:disabled)') !== null"), 45000, 120, 'verified workspace');
    } catch (error) {
      const diagnostic = await captureReadinessFailure(error, start);
      throw new Error(`${error.message}; privacy readiness state: ${JSON.stringify(diagnostic.state)}; browser errors: ${diagnostic.browserErrors.join(' | ') || 'none'}`);
    }
    const end = await cdp.eval('performance.now()');
    return end - start;
  }

  return {
    skipped:false, cdp, origin, root, waitFor, navigateAndAnalyze,
    async close() { try { socket.close(); } catch {} chrome.kill('SIGTERM'); await new Promise(resolvePromise => server.close(resolvePromise)); }
  };
}
