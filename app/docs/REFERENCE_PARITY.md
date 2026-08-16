# External parser parity

Strikeglass can compare the same combat log with a captured result from NW-Hub, ACT, or another combat-log parser. External tools are references, not automatic ground truth. A disagreement is evidence to investigate, not permission to change the canonical parser until the differing row, ownership, scope, or clock definition is understood.

The reference requested for the current accuracy program is Neverwinter Hub's public Combat Log Parser:

`https://nw-hub.com/logparser`

## What the parity snapshot contains

`node scripts/reference-parity.mjs <combat.log>` emits schema version 2 with:

- group Damage, DPS, Combat DPS, Duration, active combat time, and Hits;
- player Damage, DPS, Combat DPS, personal duration, in-combat time, Hits, Crit rate, Flank/CA rate, Max Hit, encounter count, Healing Done, Damage Taken, Shielded, and Companion Damage;
- per-power Damage, Hits, player-damage share, Average, Max, Crit rate, and Flank/CA rate;
- the exact Strikeglass metric-definition tokens used by the comparison engine;
- parser scope counts so a parity capture can prove that it refers to the intended input.

This vocabulary covers the major values visible in captured NW-Hub Party Overview, player Overview, Party Rotation, and Damage Out views. A metric being visible in both products does not prove that both products use the same denominator or clock.

## Capture workflow

1. Upload the exact same combat log to Strikeglass and the reference parser.
2. Select the same full-session or fight scope.
3. Capture the reference parser's unrounded values where possible. Screenshots are useful evidence, but an exported numeric value is better than a rounded `K/M/B` label.
4. Record the reference parser's definitions for every clock-sensitive field. At minimum this includes DPS, Combat DPS/in-combat time, duration, and encounter boundaries.
5. Record whether companions are folded into the player owner total and which rows the reference considers damage.
6. Save the values in the schema below.
7. Run `node scripts/reference-parity.mjs <combat.log> <reference.json>`.
8. Investigate every mismatch or definition mismatch before changing either implementation.

The CLI exits non-zero for numeric mismatches, missing expected players/powers, invalid values, definition mismatches, or supplied clock values whose definition is still unknown. This prevents a parity manifest from becoming green merely because two unrelated metrics have the same label.

## Reference JSON schema

Fields may be omitted when the reference does not expose them. `null` is treated as not supplied. `activeDps` is accepted as an alias for `combatDps`, `caRate` for `flankRate`, `maxHit` for a power's `max`, and `inCombatTime`/`activeTime` for `combatTime`.

```json
{
  "schemaVersion": 2,
  "source": "NW-Hub Combat Log Parser",
  "sourceUrl": "https://nw-hub.com/logparser",
  "capturedAt": "2026-08-16T00:00:00Z",
  "scope": {
    "type": "full-session",
    "note": "Same uploaded file and selected scope as Strikeglass"
  },
  "definitions": {
    "damage": "positive-physical-canonical-player-owned",
    "group": {
      "dps": "group-damage/selected-combat-span",
      "combatDps": "group-damage/reconstructed-active-combat-time",
      "duration": "selected-combat-span",
      "combatTime": "reconstructed-active-combat-time"
    },
    "player": {
      "dps": "player-damage/personal-first-last-hit-span",
      "combatDps": "player-damage/reconstructed-active-damage-time",
      "duration": "personal-first-last-hit-span",
      "combatTime": "reconstructed-active-damage-time",
      "encounters": "reconstructed-player-damage-windows"
    }
  },
  "group": {
    "damage": 0,
    "dps": 0,
    "combatDps": 0,
    "duration": 0,
    "combatTime": 0,
    "hits": 0
  },
  "players": [
    {
      "name": "Player name",
      "damage": 0,
      "dps": 0,
      "combatDps": 0,
      "duration": 0,
      "inCombatTime": 0,
      "hits": 0,
      "critRate": 0,
      "caRate": 0,
      "maxHit": 0,
      "encounters": 0,
      "healingDone": 0,
      "damageTaken": 0,
      "shielded": 0,
      "companionDamage": 0,
      "powers": [
        {
          "name": "Power name",
          "hits": 0,
          "damage": 0,
          "share": 0,
          "avg": 0,
          "max": 0,
          "critRate": 0,
          "caRate": 0
        }
      ]
    }
  ]
}
```

Do not copy the example definition tokens into an NW-Hub manifest merely to make the comparison run. They assert semantic equivalence. If NW-Hub's exact definition is not yet confirmed, use `"unknown"`; the comparison will report `definition-required` instead of a false match or false mismatch.

## Strikeglass definition tokens

The CLI emits these tokens in every snapshot. Clock-sensitive values are compared only when the reference declares the same token.

- `group-damage/selected-combat-span`
- `group-damage/reconstructed-active-combat-time`
- `player-damage/personal-first-last-hit-span`
- `player-damage/reconstructed-active-damage-time`
- `selected-combat-span`
- `reconstructed-active-combat-time`
- `reconstructed-player-damage-windows`

Raw damage/hit/power differences are still compared numerically and should be traced to inclusion, ownership, source attribution, or scope.

## Comparison rules

- Canonical counts and unrounded damage numerators use strict comparison with only tiny floating representation tolerance.
- Do not compare rounded `K/M/B` display strings when the underlying number is available.
- Clock-sensitive values require matching definition tokens first.
- Missing expected players or powers are hard failures.
- Companion and category differences are classification discrepancies until the underlying exact damage rows are shown to disagree.
- A reference disagreement never changes the canonical Physical-only contract by itself.
- Tolerance must not be widened merely to make an external parser agree.

## Current 2026-08-14 reference status

The supplied `combatlog_2026-08-14_00-00-00.log` is the canonical real-world parity input for the current audit. Strikeglass can generate its complete schema-v2 snapshot from that file now.

The repository also contains anonymized excerpts from that session covering a short boss, boss/add/boss phase behavior, companion-heavy damage, an unquoted-comma legacy row, and a many-hour combat gap. Those fixtures are mandatory release gates.

An exact same-log NW-Hub numeric manifest is **not** committed yet because no machine-readable NW-Hub export or complete same-log capture has been supplied. Until one exists, the parity system must report that gap rather than inventing NW-Hub values. The full user log is intentionally not committed.
