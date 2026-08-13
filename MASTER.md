# Strikeglass V6 Design System

## Product direction

Strikeglass is a local-first Neverwinter combat-log analyzer. The interface prioritizes verified combat data, fast comparison, readable tables, compact charts, and low-friction navigation. The visual system must never compete with parsing accuracy or application responsiveness.

## Visual thesis

A light precision-analytics workspace using cool slate surfaces, restrained blue accents, high-contrast Inter typography, a compact 4/8px spacing rhythm, and softly rounded bordered cards with very limited elevation.

## Interaction thesis

Fast, calm interactions using 100-300ms transform/opacity transitions, immediate hover and press feedback, no decorative scroll choreography, no bounce or elastic motion, and full reduced-motion support.

## Color tokens

```css
--sg-page: #f6f8fb;
--sg-surface: #ffffff;
--sg-surface-muted: #f8fafc;
--sg-surface-hover: #f1f5f9;
--sg-surface-selected: #eff6ff;

--sg-text: #0f172a;
--sg-text-secondary: #475569;
--sg-text-muted: #64748b;

--sg-border: #dce4ee;
--sg-border-strong: #cbd5e1;
--sg-grid: #e7edf4;

--sg-primary: #2563eb;
--sg-primary-hover: #1d4ed8;
--sg-primary-soft: #eff6ff;
--sg-cyan: #0891b2;
--sg-green: #15803d;
--sg-amber: #b45309;
--sg-red: #b91c1c;
--sg-purple: #6d28d9;

--sg-focus: #2563eb;
--sg-scrim: rgba(15, 23, 42, 0.42);
```

### Semantic use

- Primary blue: active navigation, primary actions, chart series, focus state.
- Cyan: secondary data signal and informational accents.
- Green: verified/success states.
- Amber: boss/warning states.
- Red: errors, blocked verification, destructive actions.
- Purple: secondary player/chart series only.
- Color is never the sole carrier of meaning; labels, icons, patterns, or text must accompany semantic colors.

## Typography

Font stack:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Monospace is reserved for timestamps, parser references, checksums, line numbers, and machine-oriented telemetry.

| Role | Size | Weight | Line height |
| --- | ---: | ---: | ---: |
| Page title | 24px | 700 | 1.2 |
| Section title | 18px | 700 | 1.3 |
| Widget title | 14px | 700 | 1.35 |
| Body | 14px | 400-500 | 1.5 |
| Table | 13px | 400-600 | 1.4 |
| Secondary | 13px | 400-500 | 1.45 |
| Caption | 12px | 500-600 | 1.4 |
| Telemetry mono | 12px | 500-700 | 1.4 |
| KPI value | 24-28px | 700 | 1.1 |

No important analytical information is rendered below 12px.

## Spacing

Base rhythm: 4px.

```text
2:  8px
3: 12px
4: 16px
5: 20px
6: 24px
8: 32px
10: 40px
12: 48px
```

Default desktop workspace gap: 12px.
Default panel padding: 12-16px.
Major section gap: 16-20px.

## Shape

```text
radius-xs: 4px
radius-sm: 6px
radius-md: 8px
radius-lg: 12px
radius-pill: 999px
```

Cards use 8-12px radii. Controls use 6-8px. Data tables remain visually square enough to feel technical.

## Elevation

Elevation is deliberately restrained.

```css
--sg-shadow-1: 0 1px 2px rgba(15, 23, 42, 0.05);
--sg-shadow-2: 0 8px 24px rgba(15, 23, 42, 0.08);
--sg-shadow-dialog: 0 24px 64px rgba(15, 23, 42, 0.18);
```

Most panels use border + shadow level 1. Drawers and dialogs may use level 2/dialog. No decorative glow.

## Layout

- Sidebar: 188px desktop, 76px compact desktop/tablet.
- Top bar: 56px.
- Main workspace: max-width 1600px, centered.
- Dashboard: 12-column CSS grid with 12px gap.
- Standard widget spans: small 3, medium 4, wide 6, large 8, full 12 columns.
- Default Overview: metrics full, party overview wide, top powers wide, damage timeline wide, encounters wide.
- Mobile: single-column widgets; navigation collapses to compact mode/bottom treatment according to existing responsive behavior.

## Base components

### Button

- Minimum target: 44px on touch-capable layouts; never below 32px on desktop pointer-only contexts.
- Primary: blue fill, white text.
- Secondary: white surface, slate border, dark text.
- Hover: subtle surface/color change within 120ms.
- Active: scale 0.985 or equivalent immediate press feedback.
- Focus: 2px blue focus ring with 2px offset.
- Disabled: 45% opacity, `cursor: not-allowed`, native disabled semantics.

### Panel / widget

- White background.
- 1px slate border.
- 8-12px radius.
- Minimal shadow.
- Widget header separates title/actions from content.
- Edit mode reveals drag handle, visibility controls, size controls, and reorder alternatives.

### Table

- 13px tabular data.
- Sticky headings only where scrolling occurs inside a bounded data region.
- Row hover uses a pale slate/blue surface.
- Selected row uses `--sg-surface-selected` plus text/icon affordance.
- Large raw-event tables remain paged/virtualized; no full-log DOM rendering.

### Badge

- Compact, bordered, semantic colors with readable text.
- Class/boss/status labels never rely on color alone.

### Drawer

- Right-side portal attached to body.
- Width 320-360px desktop, full-width on small phones.
- Background white with dialog shadow.
- Scrim uses `--sg-scrim`; no backdrop blur.
- Escape closes and focus is restored to trigger.

### Dialog

- Body-level stacking context.
- Background remains sharp beneath a simple dim scrim.
- No blur filters.
- Escape, close button, focus containment, and visible title are required.

## Dashboard customization

Overview widgets are presentation-only shells around verified reports.

Persistent UI storage key:

```text
strikeglass.dashboard.v1
```

Stored values:

- widget id
- visible state
- order
- standard size

Combat-log contents, parser rows, verified reports, and analytical values are never persisted in dashboard preferences.

Required behaviors:

- Customize layout toggles edit mode.
- Add widget opens the Widgets drawer.
- Widgets can be shown/hidden.
- Drag handle reorders widgets on desktop.
- Move earlier/later controls provide a keyboard and touch alternative.
- Size selector uses standard grid sizes only.
- Reset layout restores the product default without touching combat data.

## Motion tokens

```css
--motion-quick: 120ms;
--motion-standard: 220ms;
--motion-panel: 300ms;
--motion-enter: cubic-bezier(0.2, 0, 0, 1);
--motion-exit: cubic-bezier(0.3, 0, 1, 1);
```

GSAP equivalent for standard entrances: `power2.out`.

Use:

- Button/hover feedback: 100-120ms.
- Widget add: 220ms, 8px translate + opacity.
- Widget hide/remove: 140-160ms, opacity + scale 0.985.
- Drawer: 220ms translateX + opacity.
- Dialog: 240-300ms translateY + opacity.
- Scope/filter refresh: short fade only.

Forbidden:

- Bounce/elastic motion.
- Long page transitions.
- Animated number counting after every filter change.
- Layout-property animation (`width`, `height`, `top`, `left`) for motion.
- Continuous decorative motion while analytics are visible.

## Charts

uPlot remains the primary chart engine.

- Canvas rendering.
- Maximum visualization point budget remains bounded/downsampled.
- Underlying totals always come from exact verified aggregates, never from chart samples.
- Chart axes and legends must remain readable in light mode.
- Multi-player charts use both color and dash/pattern distinctions.
- Tooltips show compact display values while exact values remain available in tables/details.

## Three.js ambient policy

Three.js is optional and only runs in the empty/log-open state when the device is capable and reduced-motion/save-data are not active.

- Light blue particle field only.
- 50-70 points maximum.
- DPR capped at 1.25.
- Frame rate capped near 30fps.
- Low-power renderer preference.
- Full geometry/material/renderer disposal when a log is opened.
- Zero active WebGL work behind parsed combat analytics.

## Accessibility

- Normal text contrast target: at least 4.5:1.
- Large text/UI graphics: at least 3:1 where applicable.
- Visible `:focus-visible` treatment on every interactive control.
- Native `button`, `select`, `input`, table, and heading semantics preferred.
- Icon-only controls require accessible names.
- Keyboard alternative required for widget drag/reorder.
- `prefers-reduced-motion` disables nonessential spatial animation.
- Responsive validation targets: 375px, 768px, 1024px, 1440px.
- Tables use horizontal containment or responsive column reduction rather than breaking viewport width.

## Performance rules

- Parsing and verification remain in workers.
- No framework migration for the redesign.
- No full combat log in frontend state.
- No DOM node per raw combat event.
- No chart generated from raw unaggregated events.
- No continuous GSAP timeline.
- No WebGL after the app enters analytics mode.
- Widget customization never triggers reparsing.
- Hidden widget preferences are UI-only and must not mutate verified data.

## Loading and responsiveness

- Any analysis expected to take more than 300ms shows a skeleton and progress bar with a plain-language task stage.
- Navigation remains available while worker analysis is running; stale asynchronous results must never replace a newer view.
- Power Timing performs its own independent two-engine verification without redundantly rebuilding the full scoped analytics report first.
- Charts initialize only when near the viewport and yield to the browser before construction.
- Large data views skip whole-view GSAP transforms; motion is reserved for small, cheap UI feedback.
- The copy layer observes top-level view swaps rather than every chart/table mutation.
- Verifier code avoids full-session spread/flat-map allocations and only sorts event series when source timestamps are actually out of order.
- Skeleton animation is opacity-only and disabled under reduced motion.
