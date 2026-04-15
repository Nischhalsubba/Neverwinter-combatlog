const sections = [
  {
    title: "Sources",
    body: "Remember live folders, selected files, latest Combat*.log detection, rotation recovery, and import defaults.",
  },
  {
    title: "Parsing",
    body: "Control verbose parser logging, raw support rows, unknown rows, malformed-line handling, and parser confidence display.",
  },
  {
    title: "Attribution",
    body: "Merge pets into owners, show pets separately, clean NPC identities, and preserve uncertain owner links.",
  },
  {
    title: "Encounter Rules",
    body: "Tune inactivity timeout, noise starters, boss naming heuristics, manual split/merge behavior, and combat start rules.",
  },
  {
    title: "Display",
    body: "Choose density, theme, accent color, table columns, number formatting, and beginner/advanced visibility.",
  },
  {
    title: "Widget",
    body: "Persist widget content, size, opacity, position, always-on-top, click-through, hotkey, and presets.",
  },
  {
    title: "Export",
    body: "Configure CSV, JSON, clipboard summaries, screenshot-friendly panels, and encounter summary output.",
  },
  {
    title: "Debug",
    body: "Inspect raw lines, parsed objects, classifications, ownership decisions, encounter assignment, and parse failures.",
  },
];

export function SettingsScreen() {
  return (
    <section className="screen-grid">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Power User Mode</p>
          <h1>Settings</h1>
          <p>Configure parser behavior, attribution, encounter rules, display density, widget presets, exports, and debug logging.</p>
        </div>
      </div>
      <div className="settings-grid">
        {sections.map((section) => (
          <article key={section.title} className="panel">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            <md-divider />
            <div className="setting-row">
              <span>Ready for persistent controls</span>
              <md-switch />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
