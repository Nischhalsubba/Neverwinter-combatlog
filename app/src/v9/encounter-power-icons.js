import { currentScope, workerRequest } from '../v3/power-popup/worker.js';
import {
  ENCOUNTER_POWER_ICON_SPRITE,
  findEncounterPowerIcon,
  loadEncounterPowerIconSprite
} from '../data/encounter-power-icons.js';

const root = document.getElementById('view-root');
let paintGeneration = 0;
let scheduled = false;

function ensureStyle() {
  if (document.querySelector('link[data-encounter-power-icon-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./encounter-power-icons.css', import.meta.url).href;
  link.dataset.encounterPowerIconStyle = 'true';
  document.head.append(link);
}

function schedulePaint() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    paintEncounterIcons().catch(() => {
      // Existing category markers remain the fallback if the optional icon layer cannot load.
    });
  });
}

function encounterFilterEnabled(panel) {
  const button = panel.querySelector('[data-rotation-filter="Encounter"]');
  return !button || button.getAttribute('aria-pressed') !== 'false';
}

function overlayFor(canvas, width, height) {
  const scroll = canvas.parentElement;
  if (!scroll) return null;
  let overlay = scroll.querySelector(`canvas[data-encounter-icon-layer="${CSS.escape(canvas.dataset.rotationLane || '')}"]`);
  if (!overlay) {
    overlay = document.createElement('canvas');
    overlay.dataset.encounterIconLayer = canvas.dataset.rotationLane || '';
    overlay.className = 'encounter-power-icon-layer';
    overlay.setAttribute('aria-hidden', 'true');
    scroll.append(overlay);
  }
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  overlay.width = Math.max(1, Math.floor(width * dpr));
  overlay.height = Math.max(1, Math.floor(height * dpr));
  overlay.style.width = `${width}px`;
  overlay.style.height = `${height}px`;
  return { overlay, dpr };
}

function updateHelp(panel) {
  const help = panel.querySelector('.rotation-help');
  if (!help || help.dataset.encounterIconsEnhanced === 'true') return;
  help.dataset.encounterIconsEnhanced = 'true';
  help.textContent = 'Encounter casts use verified player Power activation rows, so support casts appear while generated damage procs are not treated as casts. At-Will, Daily, Artifact, and Mount markers keep their existing verified timing rules.';
}

function updateCoverage(panel, matched, total, missing) {
  let badge = panel.querySelector('[data-encounter-icon-coverage]');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'encounter-icon-coverage';
    badge.dataset.encounterIconCoverage = 'true';
    panel.querySelector('.rotation-help')?.append(badge);
  }
  if (!badge) return;
  badge.textContent = total ? `Encounter icons · ${matched}/${total} power names matched` : 'Encounter icons · no Encounter powers in this scope';
  badge.classList.toggle('is-complete', total > 0 && matched === total);
  badge.title = missing.length ? `No safe icon match: ${missing.join(', ')}` : 'Every Encounter power name in this scope has a safe icon match.';
}

function paintLane(canvas, lane, report, image, enabled, matchedNames, allNames, missingNames) {
  const width = Number.parseFloat(canvas.style.width) || canvas.getBoundingClientRect().width || canvas.width || 1;
  const height = Number.parseFloat(canvas.style.height) || canvas.getBoundingClientRect().height || 42;
  const result = overlayFor(canvas, width, height);
  if (!result) return;
  const { overlay, dpr } = result;
  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const duration = Math.max(1, Number(report.duration) || 1);
  for (const item of lane.activations || []) {
    if (item.category !== 'Encounter') continue;
    allNames.add(item.power);
    const icon = findEncounterPowerIcon(item.power, lane.className);
    if (!icon) {
      missingNames.add(item.power);
      continue;
    }
    matchedNames.add(item.power);
    if (!enabled) continue;
    const x = Math.max(1, Math.min(width - 1, (Number(item.time) || 0) / duration * width));
    const size = 28;
    const drawX = Math.round(Math.max(0, Math.min(width - size, x - size / 2)));
    const drawY = Math.max(2, Math.round(height - size - 7));

    ctx.save();
    ctx.shadowColor = 'rgba(101, 228, 255, .28)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(7, 16, 24, .9)';
    ctx.fillRect(drawX - 1, drawY - 1, size + 2, size + 2);
    ctx.drawImage(image, icon.x, icon.y, icon.width, icon.height, drawX, drawY, size, size);
    ctx.restore();
  }
}

async function paintEncounterIcons() {
  const panel = root?.querySelector('.rotation-panel');
  if (!panel) return;
  const generation = ++paintGeneration;
  const scope = currentScope();
  const [report, image] = await Promise.all([
    workerRequest('rotation-report', { scope }, 45000),
    loadEncounterPowerIconSprite()
  ]);
  if (generation !== paintGeneration || !panel.isConnected) return;
  if (report?.verification?.status !== 'verified') return;

  updateHelp(panel);
  const laneByRef = new Map((report.lanes || []).map(lane => [lane.ref, lane]));
  const enabled = encounterFilterEnabled(panel);
  const matchedNames = new Set();
  const allNames = new Set();
  const missingNames = new Set();

  for (const canvas of panel.querySelectorAll('canvas[data-rotation-lane]')) {
    const lane = laneByRef.get(canvas.dataset.rotationLane || '');
    if (!lane) continue;
    paintLane(canvas, lane, report, image, enabled, matchedNames, allNames, missingNames);
  }

  updateCoverage(
    panel,
    matchedNames.size,
    allNames.size,
    Array.from(missingNames).sort((a, b) => a.localeCompare(b))
  );
}

ensureStyle();
if (root) {
  new MutationObserver(schedulePaint).observe(root, { childList: true });
  schedulePaint();
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-rotation-filter],[data-rotation-all]')) return;
  setTimeout(schedulePaint, 0);
});

window.addEventListener('resize', schedulePaint, { passive: true });

export const ENCOUNTER_POWER_ICON_LAYER = Object.freeze({
  sprite: ENCOUNTER_POWER_ICON_SPRITE,
  repaint: schedulePaint
});
