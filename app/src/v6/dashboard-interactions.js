const dashboardRoot = document.getElementById('view-root');
let armedWidget = null;

function widgetFromEvent(event) {
  return event.target?.closest?.('.v6-widget') || null;
}

function disarm(widget = armedWidget) {
  if (widget?.isConnected) widget.draggable = false;
  if (armedWidget === widget) armedWidget = null;
}

/*
  The dashboard manager controls whether edit mode is active. This layer keeps
  pointer dragging precise: a widget is draggable only while its dedicated
  handle is the active pointer target. Keyboard/touch users retain the explicit
  move earlier/later controls, so reordering never depends on drag alone.
*/
document.addEventListener('pointerdown', event => {
  const widget = widgetFromEvent(event);
  if (!widget) return;
  const grid = widget.closest('.v6-dashboard-grid.v6-editing');
  const handle = event.target.closest?.('[data-v6-drag]');
  if (!grid || !handle) {
    disarm(widget);
    return;
  }
  if (armedWidget && armedWidget !== widget) disarm(armedWidget);
  armedWidget = widget;
  widget.draggable = true;
}, true);

document.addEventListener('dragend', () => disarm(), true);
document.addEventListener('pointercancel', () => disarm(), true);
document.addEventListener('pointerup', () => {
  if (!armedWidget) return;
  requestAnimationFrame(() => {
    if (!document.querySelector('.v6-widget.is-dragging')) disarm();
  });
}, true);

new MutationObserver(() => {
  if (!dashboardRoot?.querySelector('.v6-dashboard-grid.v6-editing')) disarm();
}).observe(dashboardRoot || document.body, { childList: true, subtree: false });
