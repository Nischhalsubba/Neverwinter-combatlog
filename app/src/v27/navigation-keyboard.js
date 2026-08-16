import { nav, navigate } from '../v8/core.js';

const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar']);

nav?.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!ACTIVATION_KEYS.has(event.key)) return;
  const button = event.target?.closest?.('[data-view]');
  if (!button || !nav.contains(button) || button.disabled) return;
  event.preventDefault();
  navigate(button.dataset.view);
});
