const nav = document.getElementById('app-nav');

const GROUPS = [
  {
    label: 'Analyze',
    items: [
      ['overview', 'Overview', 'Session totals and the main story'],
      ['rotation', 'Fight Timeline', 'When powers and team debuffs happened'],
      ['boss', 'Bosses', 'Boss-only fights and phases'],
      ['debuffs', 'Team Debuffs', 'What made the boss take more damage'],
      ['players', 'Players', 'Individual player performance'],
      ['powers', 'Damage & Powers', 'What the selected player used'],
      ['comparison', 'Compare', 'Players side by side']
    ]
  },
  {
    label: 'Advanced',
    items: [
      ['encounters', 'All Fights', 'Every detected combat window'],
      ['events', 'Raw Events', 'Parsed combat-log rows'],
      ['diagnostics', 'Analysis Checks', 'Parser and engine verification']
    ]
  }
];

function iconButton(button, label, description) {
  const svg = button.querySelector('svg');
  button.replaceChildren();
  if (svg) button.append(svg);
  const copy = document.createElement('span');
  copy.className = 'nav-copy';
  const title = document.createElement('strong');
  title.textContent = label;
  const help = document.createElement('small');
  help.textContent = description;
  copy.append(title, help);
  button.append(copy);
  button.title = `${label}: ${description}`;
  button.setAttribute('aria-label', `${label}. ${description}`);
}

function buildNavigation() {
  if (!nav || nav.dataset.clearNavigation === 'true') return;
  const buttons = new Map(Array.from(nav.querySelectorAll('[data-view]')).map(button => [button.dataset.view, button]));
  if (!buttons.has('debuffs')) return;
  const fragment = document.createDocumentFragment();
  for (const group of GROUPS) {
    const section = document.createElement('div');
    section.className = `nav-section nav-section-${group.label.toLowerCase()}`;
    section.setAttribute('role', 'group');
    section.setAttribute('aria-label', group.label);
    const heading = document.createElement('span');
    heading.className = 'nav-section-label';
    heading.textContent = group.label;
    section.append(heading);
    for (const [view, label, description] of group.items) {
      const button = buttons.get(view);
      if (!button) continue;
      iconButton(button, label, description);
      section.append(button);
    }
    fragment.append(section);
  }
  for (const button of buttons.values()) {
    if (!button.isConnected) continue;
    if (fragment.contains(button)) continue;
    fragment.append(button);
  }
  nav.replaceChildren(fragment);
  nav.dataset.clearNavigation = 'true';
}

function updateWorkspaceContext() {
  if (!nav) return;
  const active = nav.querySelector('[data-view].is-active .nav-copy strong');
  const title = document.getElementById('workspace-title');
  if (!active || !title) return;
  if (title.textContent === 'Team Debuffs') return;
  title.textContent = active.textContent;
}

function scheduleBuild() {
  requestAnimationFrame(() => {
    buildNavigation();
    updateWorkspaceContext();
  });
}

scheduleBuild();
new MutationObserver(() => {
  if (nav?.dataset.clearNavigation !== 'true') scheduleBuild();
  else updateWorkspaceContext();
}).observe(nav || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
