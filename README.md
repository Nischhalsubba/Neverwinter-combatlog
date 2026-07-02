# Strikeglass

A local-first Neverwinter combat review tool for players who want clear answers, not spreadsheet archaeology.

Strikeglass reads a combat log in the browser and turns it into player-friendly insight: what dealt damage, what wasted time, what hurt survivability, and which powers carried the run.

## Product principles

- **Local-first:** logs are parsed in the browser. There is no upload server.
- **Plain language:** numbers are explained for players who do not live inside combat formulas.
- **Decision focused:** highlight rotation, power contribution, survival pressure, encounter windows, and player comparison.
- **Source transparent:** every metric should be traceable back to the parsed log.
- **Distinct interface:** the layout and visual system are intentionally separate from NW-Hub. The behavior may feel familiar, but the product design is its own.

## What it analyzes

- Party overview with class detection and high-level contribution.
- Encounter chips for boss and non-boss windows.
- Encounter-scoped party ranking, so boss or mob filters update the whole party table.
- Clickable party rows for switching the detailed player view without losing the current encounter filter.
- Player comparison for damage, combat DPS, crit rate, flank rate, and companion contribution.
- Companion damage toggle for reviewing player-only output versus pet/companion-inclusive output.
- Companion damage ranking for identifying which pets, summons, or companion powers contributed most.
- Player summary cards for damage, DPS, combat DPS, hits, crit rate, flank rate, healing, damage taken, and shielding.
- Power breakdowns with NW-Hub asset icons where a matching file exists.
- Raw hit inspection for verifying individual powers.
- Timing, rotation, deaths, positioning, and formula reference screens.

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

The Cloudflare Worker serves the static app from `public/`. The build step copies only the files required by the app shell.

## Privacy

Combat logs stay on the user's machine. Parsing happens locally in the browser runtime.

## Repository structure

```text
index.html              App shell and product framing
styles.css              Base interface styles
theme.css               Strikeglass visual theme layer
app.js                  UI rendering and dashboard screens
parser.js               Combat-log parsing engine
assets.js               NW-Hub asset URL resolver
class-power-map.js      Class power lookup data
recovery.js             Stability and rendering patch layer
power-icon-fix.js       Power-icon rendering integration
feature-layer.js        Encounter scope, comparison, and companion controls
worker.js               Cloudflare Worker entry
wrangler.toml           Cloudflare deployment config
build-static.mjs        Static build copy script
```
