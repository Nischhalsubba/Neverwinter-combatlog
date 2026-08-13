const DRAWER_COPY = new Map([
  ['Widgets', 'Choose what to show'],
  ['Show, hide, and size Overview widgets. Drag on desktop or use the reorder buttons in edit mode.', 'Choose which summary cards are visible and how much space they use.'],
  ['Party Summary', 'Group totals'],
  ['Verified party damage, DPS, Combat DPS, and scope duration.', 'Main numbers for everyone in the selected fight.'],
  ['Party Overview', 'Player damage'],
  ['Player ranking and contribution for the selected scope.', 'Who dealt the group damage.'],
  ['Player Overview', 'Selected player'],
  ['Detailed verified metrics for the selected player.', 'Main numbers for the selected player.'],
  ['Top Damage Powers', 'Top damaging powers'],
  ['Highest-damage powers for the selected player.', 'Which powers dealt the most damage.'],
  ['Damage Over Time', 'Damage timeline'],
  ['Lightweight Canvas timeline for the current verified scope.', 'Group damage across the selected time.'],
  ['Encounters', 'Fights'],
  ['Detected combat and boss windows for quick scope changes.', 'Detected fights you can open quickly.']
]);

function simplifyDrawer() {
  document.querySelectorAll([
    '.v6-widget-drawer .v6-drawer-head h2',
    '.v6-widget-drawer .v6-drawer-head p',
    '.v6-widget-drawer .v6-drawer-item-main strong',
    '.v6-widget-drawer .v6-drawer-item-main span'
  ].join(',')).forEach(element => {
    const current = element.textContent.trim();
    const simple = DRAWER_COPY.get(current);
    if (simple && simple !== current) element.textContent = simple;
  });
}

new MutationObserver(simplifyDrawer).observe(document.body, { childList: true, subtree: true });
simplifyDrawer();
