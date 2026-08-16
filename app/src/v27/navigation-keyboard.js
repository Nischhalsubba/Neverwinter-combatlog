import { nav, navigate } from '../v8/core.js';

const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar']);

function ensureAccessibilityStyle() {
  if (document.querySelector('link[data-sg-navigation-accessibility]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./navigation-accessibility.css', import.meta.url).href;
  link.dataset.sgNavigationAccessibility = 'true';
  document.head.append(link);
}

nav?.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!ACTIVATION_KEYS.has(event.key)) return;
  const button = event.target?.closest?.('[data-view]');
  if (!button || !nav.contains(button) || button.disabled) return;
  event.preventDefault();
  navigate(button.dataset.view);
});

ensureAccessibilityStyle();
