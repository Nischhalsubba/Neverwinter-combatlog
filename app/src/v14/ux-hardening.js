const root = document.getElementById('view-root');
const nav = document.getElementById('app-nav');
const main = document.getElementById('main-stage');
const workspace = document.getElementById('workspace');

if (main && !main.hasAttribute('tabindex')) main.tabIndex = -1;

function activeSectionLabel() {
  const active = nav?.querySelector('[data-view][aria-current="page"], [data-view].is-active');
  return active?.querySelector('.nav-copy strong')?.textContent?.trim()
    || active?.querySelector('span strong')?.textContent?.trim()
    || active?.querySelector('span')?.textContent?.trim()
    || document.getElementById('workspace-title')?.textContent?.trim()
    || 'Overview';
}

function hardenBreadcrumbs() {
  const breadcrumbs = workspace?.querySelector('.qol-breadcrumbs');
  if (!breadcrumbs) return;
  breadcrumbs.setAttribute('aria-label', 'Current analysis location');
  const section = breadcrumbs.querySelector('[data-qol-section]');
  const label = activeSectionLabel();
  if (section && section.textContent?.trim() !== label) section.textContent = label;
  const current = breadcrumbs.querySelector('[aria-current="page"]');
  if (current && current.tagName === 'BUTTON') current.setAttribute('aria-current', 'page');
}

function hardenView() {
  hardenBreadcrumbs();
  root?.querySelectorAll('button:not([aria-label]):empty').forEach(button => {
    const title = button.getAttribute('title');
    if (title) button.setAttribute('aria-label', title);
  });
  root?.querySelectorAll('.table-wrap').forEach(wrap => {
    if (!wrap.hasAttribute('tabindex')) wrap.tabIndex = 0;
    if (!wrap.hasAttribute('role')) wrap.setAttribute('role', 'region');
    if (!wrap.hasAttribute('aria-label')) wrap.setAttribute('aria-label', 'Scrollable combat data table');
  });
}

let scheduled = 0;
function schedule() {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    hardenView();
  });
}

nav?.addEventListener('click', schedule);
document.getElementById('encounter-select')?.addEventListener('change', schedule);
document.getElementById('player-select')?.addEventListener('change', schedule);

if (workspace) {
  new MutationObserver(schedule).observe(workspace, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-current'] });
}
if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: false });

window.addEventListener('strikeglass:settings-changed', schedule);
schedule();
