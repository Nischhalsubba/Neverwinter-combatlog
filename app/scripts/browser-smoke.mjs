import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const { REALSHAPE_LOG } = await import('../tests/fixtures/realshape-2026-08-14.mjs');
const fixture = `/tmp/strikeglass-realshape-${process.pid}.log`;
await writeFile(fixture, REALSHAPE_LOG, 'utf8');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

function chromeBinary() {
  for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [name], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return '';
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = normalize(join(root, rel));
      if (!file.startsWith(normalize(root))) throw new Error('bad path');
      const info = await stat(file);
      const target = info.isDirectory() ? join(file, 'index.html') : file;
      const body = await readFile(target);
      res.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  });
  await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));
  return server;
}

async function waitFor(fn, timeout = 15000, interval = 120) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('browser smoke wait timed out');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    return result.result?.value;
  }
}

const binary = chromeBinary();
if (!binary) {
  if (process.env.CI) throw new Error('Chrome/Chromium is required for browser smoke coverage in CI.');
  console.log('Browser smoke skipped: Chrome/Chromium not installed.');
  process.exit(0);
}

const server = await serve();
const chrome = spawn(binary, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9222',
  `--user-data-dir=/tmp/strikeglass-browser-${process.pid}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

try {
  const version = await waitFor(async () => {
    try { const response = await fetch('http://127.0.0.1:9222/json/version'); return response.ok ? response.json() : null; }
    catch { return null; }
  });
  const targetResponse = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:4173/', { method: 'PUT' });
  assert.equal(targetResponse.ok, true, 'Chrome debugging target should open');
  const target = await targetResponse.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl || version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const cdp = new Cdp(socket);
  await Promise.all([cdp.send('Runtime.enable'), cdp.send('DOM.enable'), cdp.send('Page.enable')]);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await waitFor(() => cdp.eval("document.readyState === 'complete'"));

  const documentNode = await cdp.send('DOM.getDocument', { depth: 2 });
  const input = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#file-input' });
  assert.ok(input.nodeId, 'combat-log file input should exist');
  await cdp.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [fixture] });
  await cdp.eval("document.getElementById('file-input').dispatchEvent(new Event('change',{bubbles:true}))");
  await waitFor(() => cdp.eval("!document.getElementById('workspace').hidden && document.querySelector('#app-nav [data-view=\"overview\"]:not(:disabled)') !== null"), 20000);
  await waitFor(() => cdp.eval("document.getElementById('workspace-title').textContent.trim() === 'Overview'"));

  const overviewWidth = await cdp.eval("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2");
  assert.equal(overviewWidth, true, 'Overview must not create page-level horizontal overflow at 1440px');

  await cdp.eval("document.querySelector('#app-nav [data-view=\"powers\"]').click()");
  await waitFor(() => cdp.eval("document.getElementById('workspace-title').textContent.includes('Damage')"));
  await cdp.eval("document.querySelector('#app-nav [data-view=\"overview\"]').click()");
  await waitFor(() => cdp.eval("document.getElementById('workspace-title').textContent.trim() === 'Overview'"));
  const overviewGrid = await cdp.eval("(() => { const table=document.querySelector('#view-root table'); if(!table) return true; return table.getBoundingClientRect().width > 600; })()");
  assert.equal(overviewGrid, true, 'Overview player table must remain full-width after route return');

  const changedPlayer = await cdp.eval("(() => { const s=document.getElementById('player-select'); if(!s || s.options.length < 3) return false; s.value=s.options[2].value; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()");
  assert.equal(changedPlayer, true, 'fixture should expose multiple players');
  await waitFor(() => cdp.eval("document.querySelector('[data-sg-active-player]') !== null"), 8000);

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 2560, height: 1440, deviceScaleFactor: 1, mobile: false });
  await new Promise(resolve => setTimeout(resolve, 250));
  const wideWidth = await cdp.eval("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2");
  assert.equal(wideWidth, true, 'workspace must not create page-level horizontal overflow at 2560px');

  await cdp.eval("document.querySelector('#app-nav [data-view=\"diagnostics\"]').click()");
  await waitFor(() => cdp.eval("document.querySelector('[data-sg-reference-parity]') !== null"), 10000);
  const referencePanel = await cdp.eval("document.querySelector('[data-sg-reference-parity] h2').textContent.trim()");
  assert.equal(referencePanel, 'Compare a trusted parser result');

  socket.close();
  console.log('Browser smoke regression passed.');
} finally {
  chrome.kill('SIGTERM');
  server.close();
}
