# Captured NW-Hub parity evidence

Strikeglass keeps external-reference parity separate from its canonical combat contract. This document records behavior observed in saved NW-Hub Combat Log Parser captures so future parser changes can be checked against evidence rather than memory.

## Calibration capture

The primary capture used for this contract was NW-Hub parsing `combatlog_2026-08-13_00-00-00.log` (82,917 parsed lines). The saved Party Overview shows 15 players and 11 encounters. A saved Damage Out view provides per-power values for the top-damage player.

Character/account identifiers are not stored in repository fixtures. The regression fixture uses anonymous IDs while preserving the captured numbers.

## Confirmed equivalent metrics

The following NW-Hub fields reproduce the same canonical positive Physical player-owned rows used by Strikeglass for the captured log:

- Party Overview Damage
- Party Overview Hits
- Party Overview Duration (player first counted hit through last counted hit, displayed with whole seconds truncated)
- Party Overview DPS for non-zero spans
- Damage Out Hits
- Damage Out Damage
- Damage Out damage share
- Damage Out average hit
- Damage Out maximum hit
- Damage Out critical-hit percentage

The saved Damage Out capture is especially strong evidence because multiple independent columns match simultaneously for many different powers, including high-hit-count proc powers and large single-hit powers.

## Zero-span DPS behavior

NW-Hub does not use Strikeglass's one-second safety floor for a player whose counted hits have the same timestamp. The capture shows a 23.4K-damage, two-hit row with 0s displayed duration and 23.4M DPS. The compatibility profile therefore uses a 1 millisecond denominator floor for NW-Hub display comparison only.

Strikeglass canonical Personal DPS keeps its documented contract unless that contract is deliberately versioned. Compatibility behavior must not silently change the canonical metric.

## Combat DPS is a different clock

NW-Hub's `Combat DPS` must not be compared to Strikeglass `Active DPS` as if they were the same definition.

The captured NW-Hub log reports 11 encounters. The same raw log produces 11 party combat clusters when outgoing positive Physical player events are grouped with an approximately 10-second inactivity boundary. Summing party encounter spans for encounters in which a player dealt canonical damage closely reproduces the captured Combat DPS values, including exact display matches for several short-lived and support players.

That is materially different from Strikeglass Active DPS, which reconstructs player damage windows using the documented five-second idle-gap rule and boss-phase merging.

`src/engine/nwhub-compatibility.js` therefore exposes a separate captured-reference clock instead of modifying Active DPS.

## What this evidence does not prove

The capture does not expose NW-Hub source code or an exported exact combat-time field. Several long-session Combat DPS rows differ slightly from the current compatibility reconstruction even though Damage, Hits, Duration, DPS and per-power rows match. Those differences remain reference-clock calibration evidence, not permission to tune combat formulas until rounded numbers happen to agree.

A same-log NW-Hub export or source-level metric definition can tighten this clock further without changing the canonical Strikeglass damage numerator.

## Release gate

`pnpm test` runs `scripts/nwhub-captured-parity-regression.mjs`. It locks the externally captured Party Overview display for Damage/DPS/Hits/Duration, the visible Damage Out power metrics, the zero-span NW-Hub DPS behavior, and the fact that NW-Hub Combat DPS is a separate compatibility clock.
