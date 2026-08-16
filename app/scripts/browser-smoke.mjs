import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const artifactDir = join(root, 'test-artifacts', 'browser');
await mkdir(artifactDir, { recursive: true });
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

async function waitFor(fn, timeout = 18000, interval = 120, label = 'browser condition') {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        this.events.push(message);
        if (this.events.length > 1000) this.events.shift();
        return;
      }
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
    return result.result?.value;
  }
}

async function setViewport(cdp, width, height, mobile = false) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await new Promise(resolve => setTimeout(resolve, 180));
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(artifactDir, `${name}.png`), Buffer.from(result.data, 'base64'));
}

async function assertNoOverflow(cdp, label) {
  const metrics = await cdp.eval(`(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    inner: innerWidth
  }))()`);
  assert.ok(metrics.scroll <= metrics.client + 2 && metrics.body <= metrics.inner + 2, `${label} must not create page-level horizontal overflow (${JSON.stringify(metrics)})`);
}

async function waitRoute(cdp, view, timeout = 20000) {
  await waitFor(() => cdp.eval(`(() => {
    const button=document.querySelector('#app-nav [data-view="${view}"]');
    const root=document.getElementById('view-root');
    if(!button?.classList.contains('is-active') || !root) return false;
    const busy=root.querySelector('[data-task-loading][aria-busy="true"]');
    return !busy && root.textContent.trim().length > 20;
  })()`), timeout, 120, `${view} route`);
}

async function go(cdp, view, { wait = true } = {}) {
  const clicked = await cdp.eval(`(() => { const b=document.querySelector('#app-nav [data-view="${view}"]'); if(!b || b.disabled) return false; b.click(); return true; })()`);
  assert.equal(clicked, true, `${view} navigation must be enabled`);
  if (wait) await waitRoute(cdp, view);
}

async function press(cdp, key, code = key, keyCode = 0) {
  const params = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...params });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
}

function browserErrors(cdp) {
  return cdp.events.flatMap(event => {
    if (event.method === 'Runtime.exceptionThrown') return [event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || 'Runtime exception'];
    if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') return [event.params.entry.text || 'Browser log error'];
    return [];
  }).filter(text => !/ResizeObserver loop/i.test(text));
}

const binary = chromeBinary();
if (!binary) {
  if (process.env.CI) throw new Error('Chrome/Chromium is required for browser reliability coverage in CI.');
  console.log('Browser reliability matrix skipped: Chrome/Chromium not installed.');
  process.exit(0);
}

const server = await serve();
const chrome = spawn(binary, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9222',
  `--user-data-dir=/tmp/strikeglass-browser-${process.pid}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
let cdp = null;

try {
  const version = await waitFor(async () => {
    try { const response = await fetch('http://127.0.0.1:9222/json/version'); return response.ok ? response.json() : null; }
    catch { return null; }
  }, 10000, 100, 'Chrome debugging endpoint');
  const targetResponse = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:4173/', { method: 'PUT' });
  assert.equal(targetResponse.ok, true, 'Chrome debugging target should open');
  const target = await targetResponse.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl || version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = new Cdp(socket);
  await Promise.all([cdp.send('Runtime.enable'), cdp.send('DOM.enable'), cdp.send('Page.enable'), cdp.send('Log.enable')]);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await waitFor(() => cdp.eval("document.readyState === 'complete'"), 10000, 100, 'Strikeglass document');

  const documentNode = await cdp.send('DOM.getDocument', { depth: 2 });
  const input = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#file-input' });
  assert.ok(input.nodeId, 'combat-log file input should exist');
  await cdp.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [fixture] });
  await cdp.eval("document.getElementById('file-input').dispatchEvent(new Event('change',{bubbles:true}))");
  await waitFor(() => cdp.eval("!document.getElementById('workspace').hidden && document.querySelector('#app-nav [data-view=\"overview\"]:not(:disabled)') !== null"), 25000, 120, 'verified workspace');
  await waitRoute(cdp, 'overview');
  await assertNoOverflow(cdp, 'Overview at 1440px');
  await screenshot(cdp, 'overview-1440');

  // Breadcrumb/route-return regression: the Overview table must remain wide after another analytical route renders.
  await go(cdp, 'powers');
  await go(cdp, 'overview');
  const overviewGrid = await cdp.eval("(() => { const table=document.querySelector('#view-root table'); if(!table) return true; return table.getBoundingClientRect().width > Math.min(600, innerWidth*.55); })()");
  assert.equal(overviewGrid, true, 'Overview player table must remain full-width after route return');

  // The customizable dashboard is intentionally lazy. Ask the product to load it before testing its interaction contract.
  const requestedDashboard = await cdp.eval("(() => { const b=document.querySelector('[data-dashboard-customize]'); if(!b) return false; b.click(); return true; })()");
  assert.equal(requestedDashboard, true, 'Overview must expose the on-demand Customize overview action');
  await waitFor(() => cdp.eval("document.querySelector('.v6-dashboard-grid') !== null"), 8000, 100, 'Overview dashboard enhancement');
  const openedDrawer = await cdp.eval("(() => { const b=document.querySelector('[data-v6-add]'); if(!b) return false; b.click(); return true; })()");
  assert.equal(openedDrawer, true, 'Overview widget drawer should open');
  await waitFor(() => cdp.eval("document.querySelector('.v6-widget-drawer:not([hidden])') !== null"), 4000, 80, 'Overview widget drawer');
  const toggled = await cdp.eval(`(() => {
    const b=document.querySelector('.v6-widget-drawer [data-v6-toggle]');
    if(!b) return false;
    const before=b.getAttribute('aria-checked'); b.click(); b.click();
    return b.getAttribute('aria-checked')===before;
  })()`);
  assert.equal(toggled, true, 'Overview widget visibility toggle must round-trip without corrupting layout state');
  await press(cdp, 'Escape', 'Escape', 27);
  await waitFor(() => cdp.eval("document.querySelector('.v6-widget-drawer') === null"), 4000, 80, 'Overview drawer close');

  // Selected-player context must stay visible while changing the underlying select.
  const changedPlayer = await cdp.eval("(() => { const s=document.getElementById('player-select'); if(!s || s.options.length < 3) return false; s.value=s.options[2].value; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()");
  assert.equal(changedPlayer, true, 'fixture should expose multiple players');
  await waitFor(() => cdp.eval("document.querySelector('[data-sg-active-player]') !== null"), 8000, 100, 'active player context');
  assert.ok(await cdp.eval("document.querySelector('[data-sg-active-player]').textContent.trim().length > 3"), 'active-player context must show a visible player name');

  // Every normal route must survive real rendering and retain the page-width contract.
  for (const view of ['players', 'comparison', 'encounters', 'events', 'diagnostics', 'powers', 'rotation', 'boss']) {
    await go(cdp, view);
    await assertNoOverflow(cdp, `${view} at 1440px`);
    const blocked = await cdp.eval("Boolean(document.querySelector('#view-root .verification-blocked,#view-root .bad-text[data-fatal]'))");
    assert.equal(blocked, false, `${view} must not enter a verification-blocked state for the golden browser fixture`);
  }

  // Boss target-only scope must be a real state change, not a decorative checkbox.
  const bossScope = await cdp.eval(`(() => {
    const s=document.getElementById('encounter-select');
    const o=[...s.options].find(x=>x.value.startsWith('boss:'));
    if(!o) return '';
    s.value=o.value; s.dispatchEvent(new Event('change',{bubbles:true})); return o.value;
  })()`);
  assert.ok(bossScope, 'browser fixture must contain a boss scope');
  await waitFor(() => cdp.eval("document.getElementById('boss-target-field')?.hidden === false"), 5000, 100, 'boss target control');
  await cdp.eval("(() => { const c=document.getElementById('boss-target-only'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true})); })()");
  await waitFor(() => cdp.eval("document.getElementById('boss-target-only').checked && document.getElementById('scope-label').textContent.includes('target only')"), 8000, 100, 'boss target-only scope');

  // Team Debuffs must expose a busy state and then finish without hiding uncertainty.
  await cdp.eval("document.getElementById('boss-target-only').checked=false; document.getElementById('boss-target-only').dispatchEvent(new Event('change',{bubbles:true}))");
  await go(cdp, 'debuffs', { wait: false });
  await waitFor(() => cdp.eval("document.querySelector('[data-debuff-page]') !== null"), 8000, 80, 'Team Debuffs page');
  await waitFor(() => cdp.eval("document.querySelector('[data-debuff-page][aria-busy=\"true\"]') === null && document.getElementById('workspace-title').textContent.trim() === 'Team Debuffs'"), 30000, 120, 'Team Debuffs analysis');
  const effectFailure = await cdp.eval("Boolean(document.querySelector('#view-root .verification-blocked'))");
  assert.equal(effectFailure, false, 'Team Debuffs must finish its verified effect analysis for the fixture');
  await assertNoOverflow(cdp, 'Team Debuffs at 1440px');

  // Raw Events result limit and continuation are separate concepts.
  await go(cdp, 'events');
  await waitFor(() => cdp.eval("document.querySelector('[data-qol-event-form]') !== null"), 8000, 80, 'Raw Event finder');
  await cdp.eval("document.querySelector('[data-qol-event-form]').requestSubmit()");
  await waitFor(() => cdp.eval("/Page 1/.test(document.querySelector('[data-qol-event-status]')?.textContent || '')"), 20000, 120, 'Raw Event page 1');
  const rawStatus = await cdp.eval("document.querySelector('[data-qol-event-status]').textContent");
  assert.match(rawStatus, /Page 1/);
  const hasContinue = await cdp.eval("Boolean(document.querySelector('[data-qol-continue-search]'))");
  if (hasContinue) {
    await cdp.eval("document.querySelector('[data-qol-continue-search]').click()");
    await waitFor(() => cdp.eval("/Page 2/.test(document.querySelector('[data-qol-event-status]')?.textContent || '')"), 20000, 120, 'Raw Event page 2');
  }

  // Graph Studio: actual zoom span changes, reset restores it, expanded mode exits with Escape, and advanced metric mode changes.
  await go(cdp, 'powers');
  await waitFor(() => cdp.eval("document.querySelector('.sg-chart-studio [data-sg-chart-action=\"plus\"]') !== null"), 12000, 100, 'Graph Studio');
  const beforeZoom = await cdp.eval(`(() => { const stage=document.querySelector('.sg-chart-studio [data-sg-chart-stage]'); const chart=stage&&window.echarts?.getInstanceByDom(stage); const z=chart?.getOption()?.dataZoom?.[0]; return z ? [Number(z.start)||0,Number(z.end)||100] : null; })()`);
  assert.ok(beforeZoom, 'Graph Studio must expose ECharts dataZoom state');
  await cdp.eval("document.querySelector('.sg-chart-studio [data-sg-chart-action=\"plus\"]').click()");
  await new Promise(resolve => setTimeout(resolve, 180));
  const afterZoom = await cdp.eval(`(() => { const stage=document.querySelector('.sg-chart-studio [data-sg-chart-stage]'); const chart=stage&&window.echarts?.getInstanceByDom(stage); const z=chart?.getOption()?.dataZoom?.[0]; return z ? [Number(z.start)||0,Number(z.end)||100] : null; })()`);
  assert.ok(afterZoom[1] - afterZoom[0] < beforeZoom[1] - beforeZoom[0], 'Zoom in must narrow the visible graph range');
  await cdp.eval("document.querySelector('.sg-chart-studio [data-sg-chart-action=\"reset\"]').click()");
  await new Promise(resolve => setTimeout(resolve, 120));
  const resetZoom = await cdp.eval(`(() => { const stage=document.querySelector('.sg-chart-studio [data-sg-chart-stage]'); const chart=stage&&window.echarts?.getInstanceByDom(stage); const z=chart?.getOption()?.dataZoom?.[0]; return z ? [Math.round(Number(z.start)||0),Math.round(Number(z.end)||100)] : null; })()`);
  assert.deepEqual(resetZoom, [0, 100], 'Graph reset must restore the full fight range');
  await cdp.eval("document.querySelector('.sg-chart-studio [data-sg-chart-action=\"expand\"]').click()");
  assert.equal(await cdp.eval("document.body.classList.contains('sg-visual-expanded')"), true, 'Graph expand must enter expanded mode');
  await press(cdp, 'Escape', 'Escape', 27);
  await waitFor(() => cdp.eval("!document.body.classList.contains('sg-visual-expanded')"), 3000, 80, 'expanded graph Escape');
  await waitFor(() => cdp.eval("document.querySelector('[data-sg-v17-analysis]') !== null"), 8000, 80, 'advanced graph analysis');
  await cdp.eval(`(() => { const d=document.querySelector('[data-sg-v17-analysis]'); d.open=true; const s=d.querySelector('[data-sg-v17-mode]'); s.value='cumulative'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitFor(() => cdp.eval("/cumulative/i.test(document.querySelector('[data-sg-v17-range-status]')?.textContent || '')"), 5000, 80, 'cumulative graph mode');
  await screenshot(cdp, 'powers-graph-1440');

  // Keyboard-only route activation must work as a native button interaction.
  await cdp.eval("document.querySelector('#app-nav [data-view=\"players\"]').focus()");
  await press(cdp, 'Enter', 'Enter', 13);
  await waitRoute(cdp, 'players');
  assert.equal(await cdp.eval("document.activeElement?.dataset?.view === 'players'"), true, 'keyboard navigation should retain a meaningful focus target');

  // Settings must change live application state and remain keyboard dismissible.
  await cdp.eval("document.getElementById('app-settings-button').click()");
  await waitFor(() => cdp.eval("document.getElementById('app-settings-dialog')?.hidden === false"), 3000, 80, 'settings dialog');
  await cdp.eval(`(() => {
    const set=(name,value)=>{ const s=document.querySelector('[data-setting="'+name+'"]'); s.value=value; s.dispatchEvent(new Event('change',{bubbles:true})); };
    set('theme','dark'); set('contrast','high'); set('density','comfortable'); set('motion','reduced');
  })()`);
  const settingsState = await cdp.eval("({theme:document.documentElement.dataset.theme,contrast:document.documentElement.dataset.contrast,density:document.documentElement.dataset.density,motion:document.documentElement.dataset.motion})");
  assert.deepEqual(settingsState, { theme:'dark', contrast:'high', density:'comfortable', motion:'reduced' });
  await screenshot(cdp, 'dark-high-contrast');
  await press(cdp, 'Escape', 'Escape', 27);
  await waitFor(() => cdp.eval("document.getElementById('app-settings-dialog')?.hidden === true"), 3000, 80, 'settings Escape');

  // System reduced-motion preference must propagate when the app is set to follow the system.
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] });
  await cdp.eval("window.StrikeglassSettings.update('motion','system')");
  await waitFor(() => cdp.eval("document.documentElement.dataset.motion === 'reduced'"), 3000, 80, 'system reduced motion');

  // Wide workspace and mobile viewport get their own layout checks.
  await setViewport(cdp, 2560, 1440);
  await go(cdp, 'overview');
  await assertNoOverflow(cdp, 'Overview at 2560px');
  const wideMain = await cdp.eval("document.getElementById('workspace').getBoundingClientRect().width");
  assert.ok(wideMain > 1800, 'wide-screen workspace should actually use the available width');
  await screenshot(cdp, 'overview-2560');

  await setViewport(cdp, 390, 844, true);
  await assertNoOverflow(cdp, 'Overview at 390px');
  const mobileTargets = await cdp.eval(`(() => [...document.querySelectorAll('button:not([hidden]):not(:disabled)')]
    .filter(b=>{const r=b.getBoundingClientRect(); return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;})
    .map(b=>({label:b.getAttribute('aria-label')||b.textContent.trim().slice(0,40),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))
    .filter(x=>x.w<40||x.h<40).slice(0,10))()`);
  assert.equal(mobileTargets.length, 0, `visible mobile buttons must retain usable touch targets: ${JSON.stringify(mobileTargets)}`);
  await screenshot(cdp, 'overview-mobile-390');

  // Reset settings so the browser fixture ends in product defaults.
  await setViewport(cdp, 1440, 900);
  await cdp.eval("window.StrikeglassSettings.update('theme','light'); window.StrikeglassSettings.update('contrast','standard'); window.StrikeglassSettings.update('density','compact'); window.StrikeglassSettings.update('motion','system')");
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  const errors = browserErrors(cdp);
  assert.deepEqual(errors, [], `browser runtime must not throw uncaught errors:\n${errors.join('\n')}`);
  socket.close();
  console.log('Browser reliability matrix passed: upload, every route, route return, boss target scope, Team Debuffs, Overview customization, Raw Events continuation, Graph Studio, keyboard, settings, 1440/2560/mobile layouts, and runtime errors are covered.');
} catch (error) {
  if (cdp) {
    try { await screenshot(cdp, 'failure-state'); } catch {}
    try {
      const snapshot = await cdp.eval(`(() => ({title:document.getElementById('workspace-title')?.textContent||'',view:document.querySelector('#app-nav [data-view].is-active')?.dataset.view||'',url:location.href,htmlTheme:{...document.documentElement.dataset},body:document.body.innerText.slice(0,12000)}))()`);
      await writeFile(join(artifactDir, 'failure-state.json'), JSON.stringify(snapshot, null, 2));
    } catch {}
  }
  throw error;
} finally {
  chrome.kill('SIGTERM');
  server.close();
}
