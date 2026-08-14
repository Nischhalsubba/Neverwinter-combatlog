const STORAGE_KEY = 'strikeglass.settings.v1';
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
  try {
    return sanitize({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') });
  } catch {
    return { ...DEFAULTS };
  }
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
  const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled),select:not(:disabled),[href],input:not(:disabled)')].filter(node => !node.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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
