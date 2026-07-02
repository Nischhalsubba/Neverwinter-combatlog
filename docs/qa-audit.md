# Strikeglass QA audit

Date: 2026-07-02
Scope: static code review, runtime load-order review, parser/engine review, UX flow review, and smoke-test coverage.

## Executive summary

The previous blocker was a runtime dependency error: `help-controller.js` expected tooltip and drawer helpers that were missing after the refactor. This has been fixed by adding `src/core/sg-help-primitives.js` and loading it before feature controllers.

The app now has a clearer architecture:

- `src/core/sg-core.js` for base utilities.
- `src/core/sg-help-primitives.js` for tooltip and drawer primitives.
- `src/engine/combat-engine.js` for parser and calculation logic.
- `src/features/help-controller.js` for hover/click explanation behavior.
- `src/features/upload-flow.js` for the upload-first user journey.
- `src/ui/sg-design-system.css` and `src/ui/upload-flow.css` for the visual system.

## E2E flow checklist

### First visit / empty state

Expected behavior:

1. User lands on a dominant upload-first screen.
2. A first-run guide opens with steps for creating a Neverwinter combat log.
3. User can close the guide or choose a combat log.
4. Main analysis layout remains hidden until a log exists.

Status: implemented in `src/features/upload-flow.js` and `src/ui/upload-flow.css`.

### Upload and parse

Expected behavior:

1. User chooses `.log`, `.txt`, or `.csv`.
2. UI enters loading state.
3. Parser streams rows through `src/engine/combat-engine.js`.
4. Parsed rows, players, encounters and party overview render.
5. Body switches from `sg-empty-state` to `sg-has-log`.

Status: implemented. Needs live browser verification after deployment because file upload is browser-only.

### Analysis workspace

Expected behavior:

1. Party overview renders after parse.
2. Selecting an encounter filters party overview and detail sections.
3. Selecting a player updates the player detail panel.
4. Tabs switch between Snapshot, Rotation, Power Damage, Healing, Survival, Shielding, Timing, Positioning, Deaths, Other, How numbers work and Asset Codex.
5. Hovering meaningful UI elements shows a tooltip.
6. Clicking labels, table headers, powers or numbers opens a right-side explanation drawer.

Status: static code path implemented. Needs live browser verification with real logs.

## Smoke test coverage

Added `scripts/smoke-test.mjs`.

It checks:

- Every CSS and JS file referenced by `index.html` exists.
- Runtime load order is correct.
- Help primitives exist.
- Engine exports exist.
- Critical engine capabilities are present.

Build now runs:

```bash
node scripts/smoke-test.mjs && node build-static.mjs
```

Test now runs:

```bash
node scripts/smoke-test.mjs
```

## Code quality findings

### Fixed

- Missing `SG.showTooltip`, `SG.hideTooltip`, and `SG.openDrawer` runtime helpers.
- Upload UX was too passive and file input was not dominant enough.
- First-run user guidance was hidden instead of onboarding the user.
- Build did not run any sanity check before copying static files.

### Remaining risk

- The app still has compatibility layers at root level. They work, but long-term maintainability would improve by moving them into `src/features/` and progressively retiring old patch files.
- `app.js` remains a dense legacy renderer. It should eventually be split into view modules: party view, encounter filters, player header, summary cards, power tables, timing, survival and raw rows.
- Asset matching still depends on remote NW-Hub URL availability and filename consistency.
- Full browser E2E file-upload testing cannot be performed through this GitHub-only connector. Manual browser verification is still required after deploy.

## Recommended next refactor pass

1. Split `app.js` into `src/views/` modules.
2. Move `feature-layer.js`, `guided-ux-layer.js`, `asset-codex-layer.js`, and related files into `src/features/`.
3. Move class and asset data to `src/data/`.
4. Add a tiny fixture combat log under `tests/fixtures/`.
5. Add parser unit checks for player detection, encounter slicing, DPS, combat DPS, companion exclusion, and class detection.
6. Add browser automation later when Playwright or another browser runner is available.

## Manual QA checklist after deployment

- Hard refresh the deployed app.
- Confirm no `Parser error` panel appears on first load.
- Confirm first-run guide opens for a new browser/localStorage reset.
- Confirm upload-first screen is dominant before uploading.
- Upload a known combat log.
- Confirm layout switches to analysis mode.
- Confirm Party Overview renders.
- Click each encounter filter and verify party overview changes.
- Click at least three party members and verify detail panel updates.
- Hover tabs, headers, table columns, powers and numbers.
- Click Damage, DPS, Combat DPS, Hits, Duration and a power row to confirm drawers open.
- Confirm Asset Codex tab opens.
- Confirm no rounded elements remain if zero-radius style is still desired.
- Confirm mobile width does not break the upload guide or analysis rail.
