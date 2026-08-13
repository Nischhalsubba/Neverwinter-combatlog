# Strikeglass plain-language terms

Strikeglass keeps game terms that players already use, but analytical labels should explain what the number means without requiring parser knowledge.

| Display term | Meaning |
| --- | --- |
| Group damage | Total counted damage dealt by all players in the selected time. |
| DPS | Damage per second from a player's first counted hit to their last counted hit. |
| Active DPS | Damage per second only during active fighting time. Idle gaps longer than 5 seconds are excluded by the verified combat clock. |
| Group share | The percentage of total group damage dealt by one player. |
| Active time | Time counted as active fighting. |
| Biggest hit | The largest single counted hit. |
| Flank / CA rate | Percentage of counted hits marked as flank or Combat Advantage. |
| Change vs base | Difference between final damage and the base damage value for an individual hit. |
| Rows read | Structured log rows accepted by the parser. |
| Rows skipped | Structured log rows the parser could not safely use. |

## Copy rules

- Prefer `fight` over `scope`, `window`, or `encounter` when the distinction is not technically necessary.
- Prefer `checked twice` over engine/version terminology in normal UI.
- Prefer `counted` over `canonical` in user-facing text.
- Keep parser, verifier, checksum, row-store, and engine names inside Log Health or developer-facing diagnostics.
- Preserve exact game names, player names, power names, classes, damage types, and raw values.
- Do not rename a metric in a way that changes its mathematical meaning.
