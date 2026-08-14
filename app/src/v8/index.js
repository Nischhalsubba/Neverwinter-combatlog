import { clearCaches, ensureQolStyles, ensureSkipLink } from './core.js';
import './navigation.js';
import './insights.js';
import './player-actions.js';
import './attempts.js';
import './events.js';
import './tables.js';
import './command.js';

ensureQolStyles();
ensureSkipLink();

const observed = new WeakSet();
function attach(worker) {
  if (!worker || observed.has(worker)) return;
  observed.add(worker);
  worker.addEventListener('message', event => {
    if (event.data?.type === 'done' || event.data?.type === 'error') clearCaches();
  });
}

attach(window.__strikeglassWorker);
attach(window.StrikeglassWorkerBridge?.mainWorker);
window.addEventListener('strikeglass:worker-ready', event => attach(event.detail?.worker));
window.addEventListener('strikeglass:qol-power-triggers', () => {
  document.dispatchEvent(new CustomEvent('strikeglass:power-popup-refresh'));
});
