# Combat engine audit

Primary engine file: `src/engine/combat-engine.js`.

The engine exposes `window.SGEngine` for modular future development and `window.NWParser` as a backward-compatible adapter for the current UI.

## Modules

| Module | Responsibility |
|---|---|
| Utils | CSV parsing, timestamp conversion, row sorting, grouping and summing. |
| Entity | Player, creature, boss, mob and pet detection from entity IDs. |
| Classifier | Damage validation, category lookup, companion classification, healing and shield checks. |
| RowParser | Line parsing, file streaming, row finalization and metadata. |
| Players | Player discovery and valid player damage filtering. |
| Encounters | Enemy stats, encounter slicing, boss and mob labelling, and boss-window merging. |
| Metrics | Player totals, DPS, combat DPS, power breakdowns, healing, taken, shielded and companion damage. |
| Formulas | Formula registry used by documentation and help UI. |

## Logic checks

### Parsing

- Streaming parse remains enabled for large combat logs.
- Skipped line counts and source line numbers are preserved.
- Logs with or without an index column are supported.
- Relative time is normalized from the first parsed timestamp.
- Rows are sorted by relative time and then line number.

### Valid outgoing damage

A row is valid outgoing damage when:

- `damageType` is `Physical`.
- `amount` is greater than zero.
- flags do not contain `ShowPowerDisplayName`.
- target is not `*` unless the source is a creature.

This keeps totals compatible with the previous parser behavior.

### Player detection

Players are discovered from owner IDs and target IDs when the ID represents a player. Damage and hits are only credited when the owner is the player and the row is valid outgoing damage.

### Encounter slicing

- Player mode uses the selected player's valid damage rows.
- Party mode uses valid player-owned damage from the whole party.
- A new encounter starts after a 5 second damage gap.
- Boss windows separated by short mob waves can merge when the same boss returns within 15 seconds.
- Boss and mob labels come from enemy stats inside the encounter rows.

## Metric formulas

| Metric | Formula |
|---|---|
| Total Damage | Sum of valid outgoing damage rows. |
| DPS | Total Damage divided by full duration. |
| Combat DPS | Total Damage divided by active combat time. |
| Crit Rate | Critical Hits divided by Total Hits, multiplied by 100. |
| Flank Rate | Flank Hits divided by Total Hits, multiplied by 100. |
| Power Damage | Valid rows grouped by power name and summed. |
| Power Share | Power Damage divided by Total Damage, multiplied by 100. |
| Average Hit | Power Damage divided by Power Hits. |
| Max Hit | Largest single row amount. |
| Healing Done | Absolute value of negative HitPoints rows owned by the player. |
| Damage Taken | Positive Physical rows targeting the player. |
| Shielded | Absolute value of negative Shield rows targeting the player. |
| Companion Damage | Valid player damage rows classified as companion, pet, summon, or appointment-style source. |

## Interpretation rules

- DPS and Combat DPS are intentionally different. DPS includes downtime. Combat DPS uses active combat windows.
- Multi-hit powers can inflate hits and apparent activation frequency.
- Some effects are not true class powers. Feats, mounts, artifacts, items, enchants, companions and proc effects can all appear as power rows.
- Class detection is evidence-based. If no class-specific rows exist, the UI should show Unknown or require manual correction instead of inventing a class.
- Companion toggle should never delete raw rows. It should only change filtered calculations.

## Future change rules

- Add new formulas to `SGEngine.Formulas` first.
- Add new row classification rules to `SGEngine.Classifier`.
- Add new encounter rules to `SGEngine.Encounters`.
- Do not reimplement parsing, grouping, row filtering, tooltip math, or drawer behavior in UI files.
- UI layers should consume `NWParser` or `SGEngine`, not create hidden calculation logic.
