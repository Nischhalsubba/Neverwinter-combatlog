# Strikeglass

A local-first Neverwinter combat review tool for players who want clear answers, not spreadsheet archaeology.

Strikeglass reads a combat log in the browser and turns it into player-friendly insight: what dealt damage, what wasted time, what hurt survivability, and which powers carried the run.

## Product principles

- **Local-first:** logs are parsed in the browser. There is no upload server by default.
- **Plain language:** every major number, label, table header and power row can explain itself on hover or click.
- **Decision focused:** highlight rotation, power contribution, survival pressure, encounter windows, and player comparison.
- **Source transparent:** every metric should be traceable back to parsed combat-log rows.
- **Distinct interface:** the layout and visual system are intentionally separate from NW-Hub. The behavior may feel familiar, but the product design is its own.

## What it analyzes

- Party overview with class detection and high-level contribution.
- Encounter-scoped party ranking, so boss or mob filters update the whole party table.
- Clickable party rows for switching the detailed player view without losing the current encounter filter.
- Player comparison for damage, combat DPS, crit rate, flank rate, and companion contribution.
- Companion damage toggle for reviewing player-only output versus pet/companion-inclusive output.
- Companion damage ranking for identifying which pets, summons, or companion powers contributed most.
- Player summary cards for damage, DPS, combat DPS, hits, crit rate, flank rate, healing, damage taken, and shielding.
- Power breakdowns with NW-Hub asset icons where a matching file exists.
- Asset Codex for auditing class power names against matched image filenames.
- Raw hit inspection for verifying individual powers.
- Timing, rotation, deaths, positioning, and formula reference screens.

## Interface direction

Strikeglass uses a zero-radius analytical interface: warm canvas, white data surfaces, navy analysis rail, green action accent, blue data accent, amber boss accent and restrained motion. The UI is tuned for endgame log review while staying readable for players who do not know combat-parser terminology.

## Metric notes

| Metric | Meaning |
|---|---|
| Total Damage | All valid physical damage done by the selected player in the selected scope. |
| DPS | Total damage divided by the full first-to-last damage duration. Downtime lowers this. |
| Combat DPS | Total damage divided by active encounter combat time. Better for real performance comparison. |
| Crit Rate | Critical hits divided by total valid hits. |
| Flank Rate | Combat-advantage hits divided by total valid hits. |
| Damage Taken | Physical damage received by the selected player. |
| Shielded | Shield absorption events credited in the log. |
| Companion Damage | Damage from powers or sources classified as companion, pet, summon, or appointment-style entities. |

## Run locally

```bash
pnpm install
pnpm build
pnpm start
```

Then open:

```text
http://localhost:5173
```

The static files can also be opened directly from `index.html` during quick inspection.

## Deployment

The Cloudflare Worker serves the static app from `public/`. The build script copies the app shell, runtime compatibility files, and the `src/` folder.

## Supabase

The Supabase dashboard snippet for `page.tsx`, `next/headers`, and middleware is meant for a Next.js App Router project. Strikeglass is currently a static Cloudflare Worker/browser app, so those files are not part of the runtime.

Current Supabase scaffold:

```text
.env.example
src/integrations/supabase/browser-client.js
src/integrations/supabase/README.md
```

The browser helper exposes:

```js
const supabase = await window.StrikeglassSupabase.createClient()
```

Use this only for features that are intentionally online, such as saved reports, shared links, accounts, or guild dashboards. Combat-log parsing remains local by default.

## Privacy

Combat logs stay on the user's machine by default. Parsing happens locally in the browser runtime. If a future Supabase feature uploads reports, the UI must make that explicit before sending anything.

## Repository structure

```text
index.html                                  App shell and load order
styles.css                                  Base compatibility styles
src/core/sg-core.js                         Shared DOM, escaping, normalization and style helpers
src/core/sg-help-primitives.js              Shared tooltip and drawer primitives
src/engine/combat-engine.js                 Modular parser and metric engine
src/ui/sg-design-system.css                 Primary design system, tokens, layout and motion rules
src/ui/upload-flow.css                      Upload-first layout and first-run guide styles
src/features/help-controller.js             Unified hover tooltip and click explanation drawer
src/features/upload-flow.js                 Upload-first journey and first-run log guide
src/features/chart-controller.js            ApexCharts integration and chart type controller
src/integrations/supabase/browser-client.js Lazy Supabase browser client helper
docs/architecture.md                        DRY architecture and contribution rules
parser.js                                   Legacy parser reference, not loaded by default
app.js                                      Base dashboard renderer
assets.js                                   NW-Hub asset URL resolver
asset-coverage-layer.js                     Missing icon coverage and fallback candidates
class-power-map.js                          Class power lookup data
recovery.js                                 Compatibility renderer patch layer
power-icon-fix.js                           Power-icon rendering integration
feature-layer.js                            Encounter scope, comparison, and companion controls
ui-redesign.js                              Minimal bootstrap for body class and hero affordances
legend-layer.js                             Combat color legend
guided-ux-layer.js                          Onboarding, encounter filter rendering, and class correction
class-detection-layer.js                    Full-log class inference
asset-codex-layer.js                        Power-to-image audit screen
worker.js                                   Cloudflare Worker entry
wrangler.toml                               Cloudflare deployment config
build-static.mjs                            Static build copy script
```

## Refactor rule

New shared behavior should go under `src/`. Avoid adding new one-off root-level patch files unless they are compatibility shims for the existing static runtime.
