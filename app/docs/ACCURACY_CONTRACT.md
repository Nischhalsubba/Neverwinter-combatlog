# Strikeglass Accuracy Contract

Strikeglass publishes combat analysis only when the underlying evidence supports the claim being shown. The browser engine in `src/engine` is the canonical production engine. Desktop experiments must pass the same golden-fixture contract before their results can be described as production-parity.

## Publication states

Every important result belongs to one evidence state:

- **Exact** — directly calculated from complete verified combat-log rows.
- **Derived** — calculated from exact verified source values using a documented formula.
- **Inferred** — reconstructed from deterministic evidence because the game log does not directly record the final concept.
- **Partial** — correct for the inspected rows, but the displayed analysis is sampled or incomplete.
- **Unknown** — insufficient evidence; Strikeglass must not guess.

`Verified` is reserved for checks that were actually performed. A green arithmetic verification result does not imply that a power category, companion classification, boss identity, or game mechanic was independently proven.

## Canonical damage contract

Published outgoing damage uses rows that satisfy all of the following:

1. The event has a positive amount.
2. The damage type is `Physical`.
3. The event is not flagged `ShowPowerDisplayName`.
4. The event is not `Immune`.
5. The row is attributable to a player owner under the current ownership contract.

Positive non-Physical rows are retained as audit evidence but do not silently enter canonical damage totals.

## Combat clocks

- **Encounter / group DPS:** group damage divided by the selected combat span.
- **Personal DPS:** player damage divided by elapsed time between that player's first and last counted hit in the selected scope.
- **Active DPS:** player damage divided by reconstructed active-damage time. Gaps longer than five seconds are excluded by the current active-time contract.

The UI must state which clock is being used. Display formatting must never recalculate source values.

## Encounter contract

Canonical encounter segmentation uses a five-second damage gap. Boss identity is inferred from creature entity templates containing `_Boss`. Same-boss phases can be merged across the documented 15-second phase tolerance. Boss identity is therefore an inferred result even when the damage values inside a verified boss scope are exact.

## Companion contract

Companion damage classification is inferred from entity/template evidence and source naming patterns. Exact damage rows can therefore feed an inferred companion-share classification. Unknown ownership must remain unresolved instead of being force-assigned.

## Taxonomy and rotation contract

Power categories and inferred activations are separate from arithmetic verification. The UI publishes taxonomy coverage, unresolved `Other / Unknown` damage, and any independent category spot-check mismatch. Generic activation-deduplication rules are fallback evidence, not proof of a cast when the log does not contain an explicit cast marker.

## Effect Intelligence contract

Effect analysis has separate evidence dimensions:

1. reconstructed timeline consistency;
2. sourced mechanic definition;
3. clean-baseline damage evidence;
4. effect-magnitude evidence when enough comparable observations exist.

A matching damage direction is supporting evidence, not proof of causation. Relaxed cross-target baselines must not be presented as equivalent to exact target baselines.

## Completeness contract

A chart, search, annotation, or visual summary that does not inspect the entire selected scope must display `Partial` or an equally explicit completeness warning. Silent row caps are not allowed to masquerade as complete analysis.

## External reference parity

External parsers such as NW-Hub or ACT are reference implementations, not automatically authoritative ground truth. Strikeglass compares only metrics that share a documented definition. A mismatch must be traced to row inclusion, ownership, scope, encounter boundaries, or metric clocks before either side is changed.

## Release gate

Changes to parsing, damage inclusion, ownership, combat clocks, encounter detection, taxonomy, effect analysis, or verification must pass:

1. synthetic edge-case regressions;
2. the anonymized real-shape golden fixture suite;
3. the independent arithmetic verifier;
4. UI accuracy-contract regressions;
5. browser smoke coverage where a browser is available in CI;
6. any supplied external-reference parity manifest.

Do not widen tolerances merely to make a failing fixture pass.
