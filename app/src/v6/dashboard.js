const STORAGE_KEY = 'strikeglass.dashboard.v1';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.getElementById('view-root');
const nav = document.getElementById('app-nav');

const WIDGETS = [
  { id: 'party-summary', title: 'Party Summary', description: 'Verified party damage, DPS, Combat DPS, and scope duration.', size: 'full' },
  { id: 'party-overview', title: 'Party Overview', description: 'Player ranking and contribution for the selected scope.', size: 'wide' },
  { id: 'selected-player', title: 'Player Overview', description: 'Detailed verified metrics for the selected player.', size: 'wide' },
  { id: 'top-powers', title: 'Top Damage Powers', description: 'Highest-damage powers for the selected player.', size: 'wide' },
  { id: 'timeline', title: 'Damage Over Time', description: 'Lightweight Canvas timeline for the current verified scope.', size: 'wide' },
  { id: 'encounters', title: 'Encounters', description: 'Detected combat and boss windows for quick scope changes.', size: 'wide' }
];

const DEFAULT_LAYOUT = WIDGETS.map((widget, order) => ({
  id: widget.id,
  visible: true,
  size: widget.size,
  order
}));

let editing = false;
let enhancing = false;
let dragWidget = null;
let drawer = null;
let scrim = null;
let drawerTrigger = null;
let gsapPromise = null;

function activeView() {
  return nav?.querySelector('[data-view].is-active')?.dataset.view || '';
}

function loadGsap() {
  if (reduceMotion.matches) return Promise.resolve(null);
  if (!gsapPromise) {
    gsapPromise = import('https://cdn.jsdelivr.net/npm/gsap@3.15.0/+esm')
      .then(module => module.gsap || module.default || null)
      .catch(() => null);
  }
  return gsapPromise;
}

function readLayout() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.widgets)) return structuredClone(DEFAULT_LAYOUT);
    const known = new Map(DEFAULT_LAYOUT.map(item => [item.id, item]));
    const sanitized = parsed.widgets
      .filter(item => known.has(item?.id))
      .map(item => ({
        id: item.id,
        visible: item.visible !== false,
        size: ['small', 'medium', 'wide', 'large', 'full'].includes(item.size) ? item.size : known.get(item.id).size,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : known.get(item.id).order
      }));
    for (const item of DEFAULT_LAYOUT) if (!sanitized.some(saved => saved.id === item.id)) sanitized.push({ ...item });
    return sanitized.sort((a, b) => a.order - b.order);
  } catch {
    return structuredClone(DEFAULT_LAYOUT);
  }
}

function writeLayout(layout) {
  const normalized = layout.map((item, order) => ({ ...item, order }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, widgets: normalized }));
  } catch {
    /* Layout persistence is optional; analytics remain unaffected. */
  }
  return normalized;
}

function currentGrid() {
  return root?.querySelector('.v6-dashboard-grid') || null;
}

function widgetDefinition(id) {
  return WIDGETS.find(widget => widget.id === id) || null;
}

function icon(name) {
  const paths = {
    drag: '<path d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
    hide: '<path d="M3 3l18 18M10.6 10.6A2 2 0 0 0 13.4 13.4M9.9 4.2A9.6 9.6 0 0 1 12 4c5.5 0 9 8 9 8a16.3 16.3 0 0 1-2.1 3.1M6.6 6.6C4.3 8.1 3 12 3 12s3.5 8 9 8a9.8 9.8 0 0 0 4.1-.9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    tune: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function actionButton(label, iconName, attrs = '') {
  return `<button class="v6-widget-action" type="button" aria-label="${label}" title="${label}" ${attrs}>${icon(iconName)}</button>`;
}

function createWidget(id, contentNode, subtitle = '') {
  const definition = widgetDefinition(id);
  if (!definition || !contentNode) return null;
  const article = document.createElement('article');
  article.className = 'v6-widget';
  article.dataset.widgetId = id;
  article.innerHTML = `
    <header class="v6-widget-head">
      <div class="v6-widget-title"><strong>${definition.title}</strong><span>${subtitle || definition.description}</span></div>
      <div class="v6-widget-controls">
        ${actionButton(`Reorder ${definition.title}`, 'drag', 'class="v6-widget-action v6-drag-handle" data-v6-edit-only data-v6-drag')}
        ${actionButton(`Move ${definition.title} earlier`, 'up', 'data-v6-edit-only data-v6-move="-1"')}
        ${actionButton(`Move ${definition.title} later`, 'down', 'data-v6-edit-only data-v6-move="1"')}
        ${actionButton(`Hide ${definition.title}`, 'hide', 'data-v6-edit-only data-v6-hide')}
      </div>
    </header>
    <div class="v6-widget-content"></div>`;
  article.querySelector('.v6-widget-content').append(contentNode);
  return article;
}

function panelByEyebrow(text) {
  return Array.from(root.querySelectorAll(':scope > .panel')).find(panel =>
    panel.querySelector('.eyebrow')?.textContent?.trim().toLowerCase() === text.toLowerCase()
  ) || null;
}

function extractWidgets() {
  const result = [];

  const partyMetrics = root.querySelector(':scope > .party-metrics');
  if (partyMetrics) result.push(createWidget('party-summary', partyMetrics, 'Verified totals for the current scope'));

  const partyOverview = panelByEyebrow('Party overview');
  if (partyOverview) result.push(createWidget('party-overview', partyOverview, 'Ranking and contribution'));

  const playerPanel = root.querySelector(':scope > .player-overview-panel');
  if (playerPanel) {
    const playerName = playerPanel.querySelector('.panel-head h2')?.textContent?.trim() || 'Selected player';
    const playerMetrics = playerPanel.querySelector('.reference-metrics');
    if (playerMetrics) result.push(createWidget('selected-player', playerMetrics, playerName));
    const topPowers = playerPanel;
    result.push(createWidget('top-powers', topPowers, playerName));
  }

  const overviewGrid = root.querySelector(':scope > .overview-grid');
  if (overviewGrid) {
    const chart = overviewGrid.querySelector('.chart-panel');
    const encounterPanel = Array.from(overviewGrid.children).find(child => child !== chart && child.classList.contains('panel'));
    if (chart) result.push(createWidget('timeline', chart, 'Verified party damage timeline'));
    if (encounterPanel) result.push(createWidget('encounters', encounterPanel, 'Detected combat windows'));
    overviewGrid.remove();
  }

  return result.filter(Boolean);
}

function toolbarMarkup() {
  return `
    <section class="v6-dashboard-toolbar" aria-label="Dashboard layout controls">
      <div class="v6-dashboard-toolbar-copy"><strong>Overview workspace</strong><span>Keep the default layout or personalize the widgets on this device.</span></div>
      <div class="v6-dashboard-actions">
        <button class="button" type="button" data-v6-customize>${editing ? 'Done' : 'Customize layout'}</button>
        <button class="button button-primary" type="button" data-v6-add>${icon('plus')}<span>Add widget</span></button>
      </div>
    </section>`;
}

function applyLayout(grid, widgets) {
  const layout = readLayout();
  const byId = new Map(widgets.map(widget => [widget.dataset.widgetId, widget]));
  for (const item of layout) {
    const widget = byId.get(item.id);
    if (!widget) continue;
    widget.dataset.size = item.size;
    widget.hidden = !item.visible;
    grid.append(widget);
  }
  for (const widget of widgets) if (!grid.contains(widget)) grid.append(widget);
  grid.classList.toggle('v6-editing', editing);
  syncDraggable(grid);
}

function snapshotLayout() {
  const grid = currentGrid();
  if (!grid) return [];
  return Array.from(grid.querySelectorAll(':scope > .v6-widget')).map((widget, order) => ({
    id: widget.dataset.widgetId,
    visible: !widget.hidden,
    size: widget.dataset.size || widgetDefinition(widget.dataset.widgetId)?.size || 'wide',
    order
  }));
}

function saveCurrentLayout() {
  writeLayout(snapshotLayout());
  syncDrawer();
}

function syncDraggable(grid = currentGrid()) {
  if (!grid) return;
  grid.querySelectorAll(':scope > .v6-widget').forEach(widget => {
    widget.draggable = editing && matchMedia('(min-width: 761px)').matches;
  });
}

async function animateWidget(widget, showing) {
  if (!widget || reduceMotion.matches) return;
  const gsap = await loadGsap();
  if (!gsap || !widget.isConnected) return;
  gsap.killTweensOf(widget);
  if (showing) {
    gsap.fromTo(widget, { y: 8, autoAlpha: 0.01 }, { y: 0, autoAlpha: 1, duration: .22, ease: 'power2.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto' });
  } else {
    await new Promise(resolve => gsap.to(widget, { autoAlpha: 0, scale: .985, duration: .15, ease: 'power1.in', overwrite: 'auto', onComplete: resolve }));
    gsap.set(widget, { clearProps: 'transform,opacity,visibility' });
  }
}

async function setWidgetVisible(id, visible) {
  const widget = currentGrid()?.querySelector(`:scope > .v6-widget[data-widget-id="${CSS.escape(id)}"]`);
  if (!widget || widget.hidden === !visible) return;
  if (!visible) await animateWidget(widget, false);
  widget.hidden = !visible;
  if (visible) animateWidget(widget, true);
  saveCurrentLayout();
}

function moveWidget(widget, delta) {
  const grid = currentGrid();
  if (!grid || !widget) return;
  const visibleOrder = Array.from(grid.querySelectorAll(':scope > .v6-widget'));
  const index = visibleOrder.indexOf(widget);
  const target = visibleOrder[index + delta];
  if (!target) return;
  const first = widget.getBoundingClientRect();
  if (delta < 0) grid.insertBefore(widget, target);
  else grid.insertBefore(target, widget);
  const last = widget.getBoundingClientRect();
  widget.animate([
    { transform: `translate(${first.left - last.left}px,${first.top - last.top}px)` },
    { transform: 'translate(0,0)' }
  ], { duration: reduceMotion.matches ? 1 : 180, easing: 'cubic-bezier(.2,0,0,1)' });
  saveCurrentLayout();
}

function setEditing(next) {
  editing = Boolean(next);
  const grid = currentGrid();
  grid?.classList.toggle('v6-editing', editing);
  const button = root?.querySelector('[data-v6-customize]');
  if (button) button.textContent = editing ? 'Done' : 'Customize layout';
  syncDraggable(grid);
}

function drawerMarkup() {
  const available = new Set(Array.from(currentGrid()?.querySelectorAll(':scope > .v6-widget') || []).map(widget => widget.dataset.widgetId));
  const layout = readLayout();
  return `
    <header class="v6-drawer-head">
      <div><h2>Widgets</h2><p>Show, hide, and size Overview widgets. Drag on desktop or use the reorder buttons in edit mode.</p></div>
      <button class="v6-drawer-close" type="button" aria-label="Close widgets panel">×</button>
    </header>
    <div class="v6-drawer-list">${WIDGETS.filter(def => available.has(def.id)).map(def => {
      const item = layout.find(saved => saved.id === def.id) || { visible: true, size: def.size };
      return `<section class="v6-drawer-item" data-v6-drawer-id="${def.id}">
        <div class="v6-drawer-item-main"><strong>${def.title}</strong><span>${def.description}</span></div>
        <div class="v6-drawer-controls">
          <select class="v6-size-select" data-v6-size aria-label="Size for ${def.title}">
            ${['small','medium','wide','large','full'].map(size => `<option value="${size}" ${item.size === size ? 'selected' : ''}>${size[0].toUpperCase() + size.slice(1)}</option>`).join('')}
          </select>
          <button class="v6-widget-toggle" type="button" role="switch" aria-label="Show ${def.title}" aria-checked="${item.visible}" aria-pressed="${item.visible}" data-v6-toggle></button>
        </div>
      </section>`;
    }).join('')}</div>
    <footer class="v6-drawer-foot"><button class="button" type="button" data-v6-reset>Reset layout</button><button class="button button-primary" type="button" data-v6-done>Done</button></footer>`;
}

function syncDrawer() {
  if (!drawer?.isConnected) return;
  drawer.innerHTML = drawerMarkup();
}

async function openDrawer(trigger) {
  if (drawer?.isConnected) return;
  drawerTrigger = trigger || document.activeElement;
  scrim = document.createElement('div');
  scrim.className = 'v6-drawer-scrim';
  drawer = document.createElement('aside');
  drawer.className = 'v6-widget-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Customize Overview widgets');
  drawer.innerHTML = drawerMarkup();
  document.body.append(scrim, drawer);
  scrim.addEventListener('click', closeDrawer, { once: true });

  const gsap = await loadGsap();
  if (gsap && !reduceMotion.matches) {
    gsap.to(scrim, { autoAlpha: 1, duration: .16, ease: 'power1.out' });
    gsap.to(drawer, { x: 0, autoAlpha: 1, duration: .22, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  } else {
    scrim.style.opacity = '1';
    drawer.style.opacity = '1';
    drawer.style.transform = 'none';
  }
  requestAnimationFrame(() => drawer?.querySelector('.v6-drawer-close')?.focus({ preventScroll: true }));
}

async function closeDrawer() {
  if (!drawer?.isConnected) return;
  const closingDrawer = drawer;
  const closingScrim = scrim;
  drawer = null;
  scrim = null;
  const gsap = await loadGsap();
  if (gsap && !reduceMotion.matches) {
    await new Promise(resolve => gsap.to(closingDrawer, { x: 24, autoAlpha: 0, duration: .15, ease: 'power1.in', onComplete: resolve }));
  }
  closingDrawer.remove();
  closingScrim?.remove();
  drawerTrigger?.focus?.({ preventScroll: true });
  drawerTrigger = null;
}

function resetLayout() {
  writeLayout(structuredClone(DEFAULT_LAYOUT));
  const grid = currentGrid();
  if (!grid) return;
  const widgets = Array.from(grid.querySelectorAll(':scope > .v6-widget'));
  for (const item of DEFAULT_LAYOUT) {
    const widget = widgets.find(node => node.dataset.widgetId === item.id);
    if (!widget) continue;
    widget.hidden = !item.visible;
    widget.dataset.size = item.size;
    grid.append(widget);
  }
  syncDrawer();
}

function bindGrid(grid) {
  grid.addEventListener('click', event => {
    const hide = event.target.closest('[data-v6-hide]');
    if (hide) {
      const widget = hide.closest('.v6-widget');
      if (widget) setWidgetVisible(widget.dataset.widgetId, false);
      return;
    }
    const move = event.target.closest('[data-v6-move]');
    if (move) {
      moveWidget(move.closest('.v6-widget'), Number(move.dataset.v6Move));
    }
  });

  grid.addEventListener('dragstart', event => {
    const widget = event.target.closest('.v6-widget');
    if (!editing || !widget) return event.preventDefault();
    dragWidget = widget;
    widget.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', widget.dataset.widgetId);
  });

  grid.addEventListener('dragover', event => {
    if (!dragWidget) return;
    const target = event.target.closest('.v6-widget');
    if (!target || target === dragWidget) return;
    event.preventDefault();
    target.classList.add('is-drop-target');
    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2 || (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height * .2 && event.clientX < rect.left + rect.width / 2);
    grid.insertBefore(dragWidget, before ? target : target.nextSibling);
  });

  grid.addEventListener('dragleave', event => event.target.closest('.v6-widget')?.classList.remove('is-drop-target'));
  grid.addEventListener('drop', event => {
    event.preventDefault();
    grid.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
    saveCurrentLayout();
  });
  grid.addEventListener('dragend', () => {
    dragWidget?.classList.remove('is-dragging');
    grid.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
    dragWidget = null;
    saveCurrentLayout();
  });
}

function bindToolbar() {
  root.querySelector('[data-v6-customize]')?.addEventListener('click', () => setEditing(!editing));
  root.querySelector('[data-v6-add]')?.addEventListener('click', event => openDrawer(event.currentTarget));
}

function enhanceOverview() {
  if (!root || enhancing || activeView() !== 'overview' || root.querySelector('.v6-dashboard-grid')) return;
  if (!root.querySelector(':scope > .party-metrics') || !root.querySelector(':scope > .verification-strip')) return;
  enhancing = true;
  try {
    const verification = root.querySelector(':scope > .verification-strip');
    const widgets = extractWidgets();
    if (!widgets.length) return;

    verification.insertAdjacentHTML('afterend', toolbarMarkup());
    const grid = document.createElement('section');
    grid.className = 'v6-dashboard-grid';
    grid.setAttribute('aria-label', 'Customizable Overview widgets');
    root.append(grid);
    applyLayout(grid, widgets);
    bindGrid(grid);
    bindToolbar();
  } finally {
    enhancing = false;
  }
}

function closeForViewChange() {
  if (activeView() === 'overview') return;
  setEditing(false);
  closeDrawer();
}

function trapDrawerFocus(event) {
  if (!drawer?.isConnected || event.key !== 'Tab') return;
  const focusables = Array.from(drawer.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'));
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('click', event => {
  if (!drawer?.isConnected) return;
  if (event.target.closest('.v6-drawer-close,[data-v6-done]')) {
    closeDrawer();
    return;
  }
  if (event.target.closest('[data-v6-reset]')) {
    resetLayout();
    return;
  }
  const toggle = event.target.closest('[data-v6-toggle]');
  if (toggle) {
    const item = toggle.closest('[data-v6-drawer-id]');
    const id = item?.dataset.v6DrawerId;
    if (!id) return;
    const next = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(next));
    toggle.setAttribute('aria-checked', String(next));
    setWidgetVisible(id, next);
  }
});

document.addEventListener('change', event => {
  if (!drawer?.isConnected) return;
  const select = event.target.closest('[data-v6-size]');
  if (!select) return;
  const item = select.closest('[data-v6-drawer-id]');
  const widget = currentGrid()?.querySelector(`:scope > .v6-widget[data-widget-id="${CSS.escape(item?.dataset.v6DrawerId || '')}"]`);
  if (!widget) return;
  widget.dataset.size = select.value;
  saveCurrentLayout();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && drawer?.isConnected) {
    event.preventDefault();
    closeDrawer();
    return;
  }
  trapDrawerFocus(event);
});

new MutationObserver(() => {
  closeForViewChange();
  queueMicrotask(enhanceOverview);
}).observe(root || document.body, { childList: true, subtree: false });

nav?.addEventListener('click', () => queueMicrotask(() => {
  closeForViewChange();
  enhanceOverview();
}));

addEventListener('resize', () => syncDraggable(), { passive: true });
queueMicrotask(enhanceOverview);
