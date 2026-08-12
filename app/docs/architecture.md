# Strikeglass architecture

Strikeglass is still a static browser app, but the runtime now follows a clearer DRY structure.

## Runtime loading order

1. `src/core/sg-core.js` provides shared utilities.
2. `parser.js` parses Neverwinter combat logs.
3. `app.js` renders the base dashboard.
4. Asset and class layers enrich the parsed data.
5. Feature layers add comparison, companions, class detection, and asset codex behavior.
6. `src/features/help-controller.js` owns hover tooltips and click-to-explain drawers.
7. `src/ui/sg-design-system.css` owns the visual system.

## DRY rules

- Shared text helpers live in `SG.escape`, `SG.normalize`, and `SG.slug`.
- Shared drawer behavior lives in `SG.openDrawer`.
- Shared tooltip behavior lives in `SG.showTooltip` and `SG.hideTooltip`.
- New UI features should use `src/core/sg-core.js` instead of defining local copies of escape, tooltip, drawer, and normalization helpers.
- Design tokens should be added to `src/ui/sg-design-system.css`, not scattered through injected style strings.
- Existing root-level feature files are runtime compatibility layers. New code should go under `src/` first.

## Current source map

```text
src/core/sg-core.js             Shared browser utilities
src/ui/sg-design-system.css     Product design system and app-wide UI rules
src/features/help-controller.js Unified hover tooltip and click explanation drawer
parser.js                       Combat log parser
app.js                          Base dashboard renderer
assets.js                       NW-Hub asset resolver
asset-coverage-layer.js         Extra missing icon coverage
class-power-map.js              Class power data
feature-layer.js                Encounter scope, compare, companion controls
guided-ux-layer.js              Onboarding, encounter filter rendering, class correction
class-detection-layer.js        Full-log class inference
asset-codex-layer.js            Power-to-image audit screen
```

## Design system

- Radius: zero-radius analytical interface.
- Palette: warm canvas, white surfaces, navy navigation, green action accent, blue data accent, amber boss accent, red danger state.
- Typography: system UI stack with tight headings, readable tables, and uppercase metadata labels.
- Motion: subtle hover and drawer transitions only. Reduced-motion users get no animation.
- Interaction: every meaningful label, title, number, row, tab, and icon should explain itself through the shared help controller.
