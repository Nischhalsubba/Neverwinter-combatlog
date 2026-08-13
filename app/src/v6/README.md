# V6 presentation layer

The V6 frontend keeps verified combat calculations separate from presentation changes.

- `dashboard.js` wraps verified Overview sections as configurable widgets.
- `dashboard-interactions.js` limits pointer dragging to the explicit drag handle.
- `stability.css` keeps the widget drawer visible after animation cleanup and styles the metric definitions panel.
- `copy.js` converts analytical UI labels into plain language without changing combat values.
- `drawer-copy.js` applies the same plain-language rules to the body-level widget drawer.
- `COPY.md` defines the user-facing metric vocabulary.

None of these files changes parser math, verifier math, raw log values, player names, class names, power names, or damage types.
