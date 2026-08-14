import { mkdir, readFile, writeFile } from 'node:fs/promises';

const replaceOnce = (source, from, to, label) => {
  if (!source.includes(from)) throw new Error(`Missing ${label}`);
  return source.replace(from, to);
};

const indexPath = 'index.html';
let index = await readFile(indexPath, 'utf8');
index = replaceOnce(index, '<meta name="color-scheme" content="light">', '<meta name="color-scheme" content="light dark">', 'color-scheme meta');
index = replaceOnce(
  index,
  '  <link rel="manifest" href="/site.webmanifest">',
  `  <link rel="manifest" href="/site.webmanifest">\n  <script>\n  (() => {\n    const root = document.documentElement;\n    const defaults = { theme: 'light', contrast: 'standard', density: 'compact', motion: 'system' };\n    let saved = defaults;\n    try { saved = { ...defaults, ...JSON.parse(localStorage.getItem('strikeglass.settings.v1') || '{}') }; } catch {}\n    const dark = saved.theme === 'dark' || (saved.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);\n    const reduced = saved.motion === 'reduced' || (saved.motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);\n    root.dataset.theme = dark ? 'dark' : 'light';\n    root.dataset.themePreference = ['light','dark','system'].includes(saved.theme) ? saved.theme : 'light';\n    root.dataset.contrast = saved.contrast === 'high' ? 'high' : 'standard';\n    root.dataset.density = saved.density === 'comfortable' ? 'comfortable' : 'compact';\n    root.dataset.motion = reduced ? 'reduced' : 'full';\n  })();\n  </script>`,
  'settings preflight'
);
index = replaceOnce(
  index,
  '  <link rel="stylesheet" href="src/v11/navigation-shell.css">',
  '  <link rel="stylesheet" href="src/v11/navigation-shell.css">\n  <link rel="stylesheet" href="src/v13/settings.css">',
  'settings stylesheet'
);
index = replaceOnce(
  index,
  '    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 14a4 4 0 0 0 1 8h12a4 4 0 0 0 1-8"/></symbol>',
  '    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 14a4 4 0 0 0 1 8h12a4 4 0 0 0 1-8"/></symbol>\n    <symbol id="i-settings" viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 13.5v-3l-2.1-.7a7.8 7.8 0 0 0-.7-1.6l1-2-2.1-2.1-2 1a7.8 7.8 0 0 0-1.6-.7L10.5 2h-3l-.7 2.1a7.8 7.8 0 0 0-1.6.7l-2-1L1.1 5.9l1 2a7.8 7.8 0 0 0-.7 1.6L0 10.5v3l2.1.7c.2.6.4 1.1.7 1.6l-1 2 2.1 2.1 2-1c.5.3 1 .5 1.6.7l.7 2.1h3l.7-2.1c.6-.2 1.1-.4 1.6-.7l2 1 2.1-2.1-1-2c.3-.5.5-1 .7-1.6l2.1-.7Z"/></symbol>',
  'settings icon'
);
index = replaceOnce(
  index,
  '      <div class="sidebar-foot">\n        <span>Trust</span><strong>Double checked</strong>\n        <small>Kept local</small>\n      </div>',
  `      <div class="sidebar-tools">\n        <button class="nav-item app-settings-button" id="app-settings-button" type="button" aria-haspopup="dialog" aria-controls="app-settings-dialog">\n          <svg aria-hidden="true"><use href="#i-settings"/></svg>\n          <span class="nav-copy"><strong>Settings</strong><small>Theme, contrast and density</small></span>\n        </button>\n      </div>\n      <div class="sidebar-foot">\n        <span>Trust</span><strong>Double checked</strong>\n        <small>Kept local</small>\n      </div>`,
  'settings sidebar trigger'
);
index = replaceOnce(
  index,
  '  <script src="src/v7/worker-bridge.js"></script>',
  '  <script type="module" src="src/v13/settings.js"></script>\n  <script src="src/v7/worker-bridge.js"></script>',
  'settings module'
);
await writeFile(indexPath, index);

await mkdir('src/v13', { recursive: true });
await writeFile('src/v13/settings.js', `const STORAGE_KEY = 'strikeglass.settings.v1';
const DEFAULTS = Object.freeze({ theme: 'light', contrast: 'standard', density: 'compact', motion: 'system' });
const root = document.documentElement;
const colorQuery = matchMedia('(prefers-color-scheme: dark)');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let settings = readSettings();
let lastTrigger = null;

function sanitize(value = {}) {
  return {
    theme: ['light', 'dark', 'system'].includes(value.theme) ? value.theme : DEFAULTS.theme,
    contrast: value.contrast === 'high' ? 'high' : DEFAULTS.contrast,
    density: value.density === 'comfortable' ? 'comfortable' : DEFAULTS.density,
    motion: ['system', 'full', 'reduced'].includes(value.motion) ? value.motion : DEFAULTS.motion
  };
}

function readSettings() {
  try { return sanitize({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }); }
  catch { return { ...DEFAULTS }; }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

function applySettings({ announce = false } = {}) {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && colorQuery.matches);
  const reduced = settings.motion === 'reduced' || (settings.motion === 'system' && motionQuery.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.themePreference = settings.theme;
  root.dataset.contrast = settings.contrast;
  root.dataset.density = settings.density;
  root.dataset.motion = reduced ? 'reduced' : 'full';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1220' : '#f6f8fb');
  syncControls();
  if (announce) document.dispatchEvent(new CustomEvent('strikeglass:settings-changed', { detail: { ...settings } }));
}

function updateSetting(name, value) {
  settings = sanitize({ ...settings, [name]: value });
  persist();
  applySettings({ announce: true });
}

function dialogMarkup() {
  return `<div class="sg-settings-backdrop" data-settings-backdrop hidden></div>
  <section class="sg-settings-dialog" id="app-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="app-settings-title" hidden>
    <header class="sg-settings-head">
      <div><span class="eyebrow">App settings</span><h2 id="app-settings-title">Appearance & comfort</h2><p>These preferences apply across Strikeglass and stay on this device.</p></div>
      <button class="sg-settings-close" type="button" data-settings-close aria-label="Close settings">×</button>
    </header>
    <div class="sg-settings-body">
      <label class="sg-setting-row"><span><strong>Theme</strong><small>Choose a light, dark, or system-matched interface.</small></span><select data-setting="theme"><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use system</option></select></label>
      <label class="sg-setting-row"><span><strong>Contrast</strong><small>High contrast strengthens text, borders, focus rings, and table separation.</small></span><select data-setting="contrast"><option value="standard">Standard</option><option value="high">High</option></select></label>
      <label class="sg-setting-row"><span><strong>Information density</strong><small>Compact fits more combat data without shrinking interaction targets.</small></span><select data-setting="density"><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
      <label class="sg-setting-row"><span><strong>Motion</strong><small>Reduce transitions and hover movement if motion is distracting.</small></span><select data-setting="motion"><option value="system">Use system</option><option value="full">Full motion</option><option value="reduced">Reduced motion</option></select></label>
    </div>
    <footer class="sg-settings-foot"><button class="button" type="button" data-settings-reset>Reset defaults</button><button class="button button-primary" type="button" data-settings-done>Done</button></footer>
  </section>`;
}

function ensureDialog() {
  if (document.getElementById('app-settings-dialog')) return;
  document.body.insertAdjacentHTML('beforeend', dialogMarkup());
  document.querySelectorAll('[data-setting]').forEach(control => control.addEventListener('change', event => updateSetting(event.currentTarget.dataset.setting, event.currentTarget.value)));
  document.querySelector('[data-settings-close]')?.addEventListener('click', closeSettings);
  document.querySelector('[data-settings-done]')?.addEventListener('click', closeSettings);
  document.querySelector('[data-settings-backdrop]')?.addEventListener('click', closeSettings);
  document.querySelector('[data-settings-reset]')?.addEventListener('click', () => {
    settings = { ...DEFAULTS };
    persist();
    applySettings({ announce: true });
  });
  document.getElementById('app-settings-dialog')?.addEventListener('keydown', trapDialogKeys);
  syncControls();
}

function syncControls() {
  document.querySelectorAll('[data-setting]').forEach(control => {
    const next = settings[control.dataset.setting];
    if (next && control.value !== next) control.value = next;
  });
}

function openSettings(trigger = document.getElementById('app-settings-button')) {
  ensureDialog();
  lastTrigger = trigger || document.activeElement;
  const dialog = document.getElementById('app-settings-dialog');
  const backdrop = document.querySelector('[data-settings-backdrop]');
  if (!dialog || !backdrop) return;
  dialog.hidden = false;
  backdrop.hidden = false;
  document.body.classList.add('settings-open');
  dialog.querySelector('select,button')?.focus();
}

function closeSettings() {
  const dialog = document.getElementById('app-settings-dialog');
  const backdrop = document.querySelector('[data-settings-backdrop]');
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove('settings-open');
  lastTrigger?.focus?.();
}

function trapDialogKeys(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSettings();
    return;
  }
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget;
  const focusable = [...dialog.querySelectorAll('button:not(:disabled),select:not(:disabled),[href],input:not(:disabled)')].filter(node => !node.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

document.getElementById('app-settings-button')?.addEventListener('click', event => openSettings(event.currentTarget));
colorQuery.addEventListener?.('change', () => { if (settings.theme === 'system') applySettings(); });
motionQuery.addEventListener?.('change', () => { if (settings.motion === 'system') applySettings(); });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  settings = readSettings();
  applySettings({ announce: true });
});

applySettings();
window.StrikeglassSettings = Object.freeze({ open: openSettings, get: () => ({ ...settings }), update: updateSetting });
`);

await writeFile('src/v13/settings.css', `:root{
  --sg-text-secondary:#334155;
  --sg-text-muted:#526174;
  --sg-border:#cbd5e1;
  --sg-border-strong:#aebdce;
  --sg-primary:#1d4ed8;
  --sg-primary-hover:#1e40af;
  --sg-focus:#1d4ed8;
}

html[data-theme="dark"]{
  color-scheme:dark;
  --sg-page:#0b1220;
  --sg-surface:#111827;
  --sg-surface-muted:#172033;
  --sg-surface-hover:#1f2a3d;
  --sg-surface-selected:#172b4f;
  --sg-text:#f8fafc;
  --sg-text-secondary:#d5deea;
  --sg-text-muted:#aab7c7;
  --sg-border:#334155;
  --sg-border-strong:#526174;
  --sg-grid:#263449;
  --sg-primary:#60a5fa;
  --sg-primary-hover:#93c5fd;
  --sg-primary-soft:#172b4f;
  --sg-cyan:#67e8f9;
  --sg-green:#4ade80;
  --sg-amber:#fbbf24;
  --sg-red:#f87171;
  --sg-purple:#c084fc;
  --sg-focus:#93c5fd;
  --sg-scrim:rgba(0,0,0,.68);
  --sg-shadow-1:0 1px 2px rgba(0,0,0,.32);
  --sg-shadow-2:0 12px 30px rgba(0,0,0,.34);
  --sg-shadow-dialog:0 28px 72px rgba(0,0,0,.55);
  --line-soft:rgba(148,163,184,.2);
}

html[data-contrast="high"]{
  --sg-text:#020617;
  --sg-text-secondary:#1e293b;
  --sg-text-muted:#334155;
  --sg-border:#94a3b8;
  --sg-border-strong:#64748b;
  --sg-primary:#1e40af;
  --sg-primary-hover:#1e3a8a;
  --sg-focus:#1d4ed8;
}
html[data-theme="dark"][data-contrast="high"]{
  --sg-text:#ffffff;
  --sg-text-secondary:#f1f5f9;
  --sg-text-muted:#cbd5e1;
  --sg-border:#64748b;
  --sg-border-strong:#94a3b8;
  --sg-primary:#93c5fd;
  --sg-primary-hover:#bfdbfe;
  --sg-focus:#bfdbfe;
}

html[data-theme="dark"] body,
html[data-theme="dark"] .shell-main,
html[data-theme="dark"] .main-stage{background:var(--sg-page);color:var(--sg-text)}
html[data-theme="dark"] .sidebar{background:rgba(17,24,39,.98);border-right-color:var(--sg-border)}
html[data-theme="dark"] .brand-block,
html[data-theme="dark"] .sidebar-foot{background:var(--sg-surface);border-color:var(--sg-border)}
html[data-theme="dark"] .topbar{background:rgba(11,18,32,.96);border-color:var(--sg-border)}
html[data-theme="dark"] .verification-strip{border-color:#27563b;background:#10261b;color:var(--sg-text-secondary)}
html[data-theme="dark"] .verification-badge{color:#86efac}
html[data-theme="dark"] .progress-track{background:#182334}
html[data-theme="dark"] .partial-row i,
html[data-theme="dark"] .mini-bar,
html[data-theme="dark"] .analysis-bar-track{background:#223047}
html[data-theme="dark"] .class-badge,
html[data-theme="dark"] .category-badge{border-color:var(--sg-border-strong);background:var(--sg-surface-muted);color:var(--sg-text-secondary)}
html[data-theme="dark"] .encounter-chip.boss{border-color:#6b4b27;background:#271b10}
html[data-theme="dark"] .qol-modal-head{background:rgba(17,24,39,.98)}
html[data-theme="dark"] .qol-filter-toggle[aria-pressed="true"],
html[data-theme="dark"] .compare-toggle:has(input:checked){border-color:#4f78b8;background:var(--sg-primary-soft);color:#bfdbfe}
html[data-theme="dark"] .rotation-filters button[aria-pressed="true"]{color:#bfdbfe}

html[data-density="compact"] .panel-head{min-height:40px;padding-top:6px;padding-bottom:6px}
html[data-density="compact"] .metric-card,
html[data-density="compact"] .telemetry-card,
html[data-density="compact"] .compare-card{padding-top:8px;padding-bottom:8px}
html[data-density="compact"] table th,
html[data-density="compact"] table td{padding-top:8px!important;padding-bottom:8px!important}
html[data-density="compact"] .qol-insight{min-height:88px;padding:10px 13px}
html[data-density="compact"] .qol-insight strong{font-size:18px}
html[data-density="comfortable"] .qol-insight{min-height:108px;padding:14px 16px}

html[data-motion="reduced"] *,
html[data-motion="reduced"] *::before,
html[data-motion="reduced"] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}

.sidebar-tools{padding:8px;border-top:1px solid var(--sg-border)}
.sidebar-tools .nav-item{width:100%;min-height:48px}
.app-settings-button svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

.sg-settings-backdrop{position:fixed;inset:0;z-index:1800;background:var(--sg-scrim);backdrop-filter:blur(2px)}
.sg-settings-dialog{position:fixed;z-index:1801;top:50%;left:50%;width:min(620px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 28px));overflow:auto;transform:translate(-50%,-50%);border:1px solid var(--sg-border-strong);border-radius:14px;background:var(--sg-surface);color:var(--sg-text);box-shadow:var(--sg-shadow-dialog)}
.sg-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px;border-bottom:1px solid var(--sg-border);background:var(--sg-surface)}
.sg-settings-head h2{margin:2px 0 0;font-size:21px;line-height:1.2}
.sg-settings-head p{margin:6px 0 0;color:var(--sg-text-secondary);font-size:13px}
.sg-settings-close{flex:0 0 44px;width:44px;height:44px;border:1px solid var(--sg-border);border-radius:9px;background:var(--sg-surface-muted);color:var(--sg-text-secondary);font-size:24px;line-height:1;cursor:pointer}
.sg-settings-close:hover{background:var(--sg-surface-hover);color:var(--sg-text)}
.sg-settings-close:focus-visible,.sg-setting-row select:focus-visible{outline:2px solid var(--sg-focus);outline-offset:2px}
.sg-settings-body{display:grid;padding:0 18px}
.sg-setting-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,190px);align-items:center;gap:20px;min-height:82px;padding:13px 0;border-bottom:1px solid var(--sg-border)}
.sg-setting-row:last-child{border-bottom:0}
.sg-setting-row span,.sg-setting-row strong,.sg-setting-row small{display:block}
.sg-setting-row strong{font-size:14px;color:var(--sg-text)}
.sg-setting-row small{margin-top:3px;color:var(--sg-text-muted);font-size:12px;line-height:1.45}
.sg-setting-row select{width:100%;min-height:44px;border:1px solid var(--sg-border-strong);border-radius:8px;padding:0 34px 0 10px;background:var(--sg-surface-muted);color:var(--sg-text);font:inherit;font-weight:650}
.sg-settings-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;border-top:1px solid var(--sg-border);background:var(--sg-surface-muted)}
body.settings-open{overflow:hidden}

.qol-matters{overflow:hidden}
.qol-matters .panel-head{min-height:54px;padding:10px 14px}
.qol-matters .panel-head>span{color:var(--sg-text-secondary);font-weight:650}
.qol-matters .qol-insights{gap:1px;margin:0;background:var(--sg-border)}
.qol-matters .qol-insight{border:0;border-radius:0;box-shadow:none;background:var(--sg-surface)}
.qol-matters .qol-insight>span{color:var(--sg-text-muted);font-weight:650}
.qol-matters .qol-insight>small{color:var(--sg-text-muted);line-height:1.4}
.qol-matters .qol-insight button{display:inline-flex;align-items:center;min-height:44px;margin-top:4px;color:var(--sg-primary)}

@media(max-width:768px){
  .sg-settings-dialog{width:calc(100vw - 16px);max-height:calc(100vh - 16px)}
  .sg-settings-head{padding:14px}
  .sg-settings-body{padding:0 14px}
  .sg-setting-row{grid-template-columns:1fr;gap:8px;padding:14px 0}
  .sg-settings-foot{padding:12px 14px;flex-wrap:wrap}
  .sg-settings-foot .button{flex:1 1 150px}
}
`);

const qolPath = 'src/v8/qol.css';
let qol = await readFile(qolPath, 'utf8');
if (!qol.includes('/* Refined insight strip */')) {
  qol += `\n/* Refined insight strip */\n.qol-matters{overflow:hidden}\n.qol-matters .panel-head{min-height:54px;padding:10px 14px}\n.qol-matters .qol-insights{gap:1px;margin:0;background:var(--sg-border)}\n.qol-matters .qol-insight{border:0;border-radius:0;box-shadow:none;background:var(--sg-surface)}\n.qol-matters .qol-insight button{display:inline-flex;align-items:center;min-height:44px;margin-top:4px}\n`;
  await writeFile(qolPath, qol);
}

await writeFile('scripts/settings-regression.mjs', `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = read('index.html');
const settings = read('src/v13/settings.js');
const css = read('src/v13/settings.css');
const qol = read('src/v8/qol.css');
assert.match(index, /strikeglass\.settings\.v1/);
assert.match(index, /src\/v13\/settings\.css/);
assert.match(index, /src\/v13\/settings\.js/);
assert.match(index, /id="app-settings-button"/);
assert.match(index, /content="light dark"/);
assert.match(settings, /prefers-color-scheme: dark/);
assert.match(settings, /prefers-reduced-motion: reduce/);
assert.match(settings, /localStorage\.setItem/);
assert.match(settings, /trapDialogKeys/);
assert.match(settings, /strikeglass:settings-changed/);
assert.match(css, /data-theme="dark"/);
assert.match(css, /data-contrast="high"/);
assert.match(css, /data-density="compact"/);
assert.match(css, /data-motion="reduced"/);
assert.match(css, /min-height:44px/);
assert.match(qol, /Refined insight strip/);
assert.match(qol, /qol-matters \.qol-insight\{border:0;border-radius:0;box-shadow:none/);
console.log('Settings and accessibility regression passed.');
`);

const packagePath = 'package.json';
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
if (!pkg.scripts.syntax.includes('src/v13/settings.js')) pkg.scripts.syntax += ' && node --check src/v13/settings.js';
if (!pkg.scripts.test.includes('settings-regression.mjs')) pkg.scripts.test += ' && node scripts/settings-regression.mjs';
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('Applied global contrast and settings integration.');
