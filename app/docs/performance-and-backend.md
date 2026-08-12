# Performance and backend notes

Strikeglass remains local-first. Large combat logs can still feel heavy because the browser must hold parsed rows, player summaries, encounter windows and visible tables in memory.

## What was changed

- Timeline SVG rendering was replaced with an ApexCharts controller.
- DPS data is downsampled before chart rendering.
- Old chart instances are destroyed when the DOM changes.
- Power activation rows are converted into an ApexCharts heatmap instead of drawing hundreds of DOM ticks forever.
- Asset Codex is lazy and renders one selected group at a time.

## Why not immediately use a backend?

A backend helps only if we are willing to upload logs to a server. That unlocks saved reports, share links, guild dashboards, public rankings and long-term history.

It also adds privacy issues, hosting cost, upload latency, storage rules, deletion rules, auth and security work.

For the current product direction, the better next performance step is a local worker pipeline:

1. Parse in a Web Worker.
2. Keep raw rows in one shared state object.
3. Generate lightweight aggregate indexes for each player, encounter and category.
4. Render tables from aggregates, not from repeatedly scanning every row.
5. Virtualize large tables.
6. Keep full raw details behind explicit drill-down actions.

## Recommended next performance pass

- Move parsing and first-pass aggregation to a Web Worker.
- Add a fixture-based parser benchmark.
- Cap visible table rows by default with a `Show more` action.
- Cache `metrics(playerId, encounterId, includeCompanions)` results.
- Cache `powers(playerId, encounterId, includeCompanions)` results.
- Clear chart instances on tab change and file upload.
- Add memory logging in development mode only.

## Backend option later

If backend processing becomes necessary, use it as an optional upload-and-share mode rather than the default. Default mode should stay local so players can inspect logs without sending combat history anywhere.
