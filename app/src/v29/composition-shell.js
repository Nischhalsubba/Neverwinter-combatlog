import { activeView, esc, nav, playerSelect, root, scopeSelect, workspace } from '../v8/core.js';

const title = document.getElementById('workspace-title');
const toolbar = workspace?.querySelector('.analysis-toolbar') || null;
const contextProviders = new Map();
const supportingProviders = new Map();
let contextGeneration = 0;
let supportingGeneration = 0;
let currentInvestigation = null;
let coreTitle = '';

function ensureStyle() {
  if (document.querySelector('link[data-sg-v29-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./index.css', import.meta.url).href;
  link.dataset.sgV29Style = 'true';
  document.head.append(link);
}

function ensureSlot(className, placement) {
  if (!workspace) return null;
  let slot = workspace.querySelector(`.${className}`);
  if (slot) return slot;
  slot = document.createElement('div');
  slot.className = className;
  slot.setAttribute('data-sg-composition-slot', className.replace('sg-composition-', ''));
  if (placement === 'context' && toolbar) toolbar.insertAdjacentElement('afterend', slot);
  else if (placement === 'supporting' && root) root.insertAdjacentElement('afterend', slot);
  else workspace.append(slot);
  return slot;
}

export function ensureCompositionShell() {
  ensureStyle();
  const context = ensureSlot('sg-composition-context', 'context');
  const supporting = ensureSlot('sg-composition-supporting', 'supporting');
  let investigation = workspace?.querySelector('.sg-investigation-root');
  if (!investigation && root) {
    investigation = document.createElement('section');
    investigation.className = 'sg-investigation-root';
    investigation.hidden = true;
    investigation.setAttribute('aria-live', 'polite');
    root.insertAdjacentElement('afterend', investigation);
  }
  return { context, supporting, investigation };
}

async function renderProviders(providers, slot, generationKey) {
  if (!slot || workspace?.hidden) {
    if (slot) slot.replaceChildren();
    return;
  }
  const localGeneration = generationKey === 'context' ? ++contextGeneration : ++supportingGeneration;
  const pieces = [];
  for (const [name, provider] of providers) {
    try {
      const value = await provider({ view: activeView(), investigation: currentInvestigation?.id || '' });
      if (!value) continue;
      pieces.push(`<div class="sg-composition-piece" data-sg-composition-piece="${esc(name)}">${typeof value === 'string' ? value : value.html || ''}</div>`);
    } catch (error) {
      pieces.push(`<div class="sg-composition-piece sg-composition-error" data-sg-composition-piece="${esc(name)}">Unable to load ${esc(name)}: ${esc(error?.message || error)}</div>`);
    }
  }
  const currentGeneration = generationKey === 'context' ? contextGeneration : supportingGeneration;
  if (localGeneration !== currentGeneration) return;
  slot.innerHTML = pieces.join('');
}

export function refreshComposition() {
  const { context, supporting } = ensureCompositionShell();
  void renderProviders(contextProviders, context, 'context');
  if (!currentInvestigation) void renderProviders(supportingProviders, supporting, 'supporting');
}

export function registerContextProvider(name, provider) {
  contextProviders.set(String(name), provider);
  refreshComposition();
  return () => contextProviders.delete(String(name));
}

export function registerSupportingProvider(name, provider) {
  supportingProviders.set(String(name), provider);
  refreshComposition();
  return () => supportingProviders.delete(String(name));
}

function setCustomNavActive(id = '') {
  nav?.querySelectorAll('[data-sg-investigation]').forEach(button => {
    const active = button.dataset.sgInvestigation === id;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const coreActive = nav?.querySelector('[data-view].is-active');
  if (id) coreActive?.removeAttribute('aria-current');
  else coreActive?.setAttribute('aria-current', 'page');
}

export async function openInvestigation(id, label, renderer) {
  const { investigation, supporting } = ensureCompositionShell();
  if (!investigation || !root) return;
  if (!currentInvestigation) coreTitle = title?.textContent || '';
  currentInvestigation = { id: String(id), label: String(label), renderer };
  root.hidden = true;
  if (supporting) supporting.hidden = true;
  investigation.hidden = false;
  workspace.dataset.sgInvestigation = String(id);
  if (title) title.textContent = String(label);
  setCustomNavActive(String(id));
  investigation.innerHTML = `<div class="sg-investigation-loading" role="status"><strong>${esc(label)}</strong><span>Preparing verified analysis…</span></div>`;
  investigation.setAttribute('aria-busy', 'true');
  try {
    await renderer(investigation);
  } catch (error) {
    investigation.innerHTML = `<section class="panel sg-investigation-error"><h2>${esc(label)}</h2><p>${esc(error?.message || error)}</p></section>`;
  } finally {
    investigation.setAttribute('aria-busy', 'false');
    investigation.querySelector('h2,h1,[tabindex="-1"]')?.focus?.({ preventScroll: true });
  }
  refreshComposition();
}

export function closeInvestigation() {
  if (!currentInvestigation || !root) return;
  const { investigation, supporting } = ensureCompositionShell();
  currentInvestigation = null;
  root.hidden = false;
  if (supporting) supporting.hidden = false;
  if (investigation) {
    investigation.hidden = true;
    investigation.replaceChildren();
  }
  delete workspace.dataset.sgInvestigation;
  setCustomNavActive('');
  if (title) title.textContent = nav?.querySelector('[data-view].is-active strong')?.textContent?.trim() || coreTitle || 'Combat analysis';
  refreshComposition();
}

export function currentInvestigationId() {
  return currentInvestigation?.id || '';
}

async function rerenderInvestigation() {
  if (!currentInvestigation) return;
  const { id, label, renderer } = currentInvestigation;
  await openInvestigation(id, label, renderer);
}

nav?.addEventListener('click', event => {
  if (event.target.closest('[data-view]')) closeInvestigation();
}, true);
scopeSelect?.addEventListener('change', () => { void rerenderInvestigation(); });
playerSelect?.addEventListener('change', () => { void rerenderInvestigation(); });
document.addEventListener('strikeglass:view-rendered', refreshComposition);
document.addEventListener('strikeglass:analysis-ready', refreshComposition);
document.addEventListener('strikeglass:settings-changed', refreshComposition);

ensureCompositionShell();
