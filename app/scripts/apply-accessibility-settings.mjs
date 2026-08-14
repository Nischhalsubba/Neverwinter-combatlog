import { readFile, writeFile } from 'node:fs/promises';

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
  '    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 14a4 4 0 0 0 1 8h12a4 4 0 0 0 1-8"/></symbol>\n    <symbol id="i-settings" viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M19 13.5v-3l-2.1-.7a7.8 7.8 0 0 0-.7-1.6l1-2-2.1-2.1-2 1a7.8 7.8 0 0 0-1.6-.7L10.5 2h-3l-.7 2.1a7.8 7.8 0 0 0-1.6.7l-2-1L1.1 5.9l1 2a7.8 7.8 0 0 0-.7 1.6L0 10.5v3l2.1.7c.2.6.4 1.1.7 1.6l-1 2 2.1 2.1 2-1c.5.3 1 .5 1.6.7l.7 2.1h3l.7-2.1c.6-.2 1.1-.4 1.6-.7l2 1 2.1-2.1-1-2c.3-.5.5-1 .7-1.6l2.1-.7Z"/></symbol>',
  'settings icon'
);
index = replaceOnce(
  index,
  '      <div class="sidebar-foot">\n        <span>Trust</span><strong>Double checked</strong>\n        <small>Kept local</small>\n      </div>',
  `      <div class="sidebar-tools">\n        <button class="nav-item app-settings-button" id="app-settings-button" type="button" aria-haspopup="dialog" aria-controls="app-settings-dialog">\n          <svg aria-hidden="true"><use href="#i-settings"/></svg>\n          <span class="nav-copy"><strong>Settings</strong><small>Theme, contrast and density</small></span>\n        </button>\n      </div>\n      <div class="sidebar-foot">\n        <span>Trust</span><strong>Double checked</strong>\n        <small>Kept local</small>\n      </div>`,
  'settings trigger'
);
index = replaceOnce(
  index,
  '  <script src="src/v7/worker-bridge.js"></script>',
  '  <script type="module" src="src/v13/settings.js"></script>\n  <script src="src/v7/worker-bridge.js"></script>',
  'settings module'
);
await writeFile(indexPath, index);

const qolPath = 'src/v8/qol.css';
let qol = await readFile(qolPath, 'utf8');
if (!qol.includes('/* Refined insight strip */')) {
  qol += '\n/* Refined insight strip */\n.qol-matters{overflow:hidden}\n.qol-matters .panel-head{min-height:54px;padding:10px 14px}\n.qol-matters .qol-insights{gap:1px;margin:0;background:var(--sg-border)}\n.qol-matters .qol-insight{border:0;border-radius:0;box-shadow:none;background:var(--sg-surface)}\n.qol-matters .qol-insight button{display:inline-flex;align-items:center;min-height:44px;margin-top:4px}\n';
  await writeFile(qolPath, qol);
}

const packagePath = 'package.json';
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
if (!pkg.scripts.syntax.includes('src/v13/settings.js')) pkg.scripts.syntax += ' && node --check src/v13/settings.js';
if (!pkg.scripts.test.includes('settings-regression.mjs')) pkg.scripts.test += ' && node scripts/settings-regression.mjs';
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('Applied global contrast and settings integration.');
